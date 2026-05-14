import { omit } from "../shared";
import { zodErrorToReplyError } from "../validator/formatZod";
import { Outcome } from "./outcome";
import { ActionContext, ActionFunc, ActionMiddlewareFunc, ActionOption, NectActionFunc, NectActionFuncInternalArgs } from "./types";
import { InferZodTypeInArray, IsUnknown } from "../shared.type";
import { ZodType } from "zod";
import { excludeUnserializable } from "./helper";

/**
 * The core server-side action builder.
 *
 * `NectAction` follows a fluent, immutable builder pattern — every method returns
 * a cloned instance so you can safely branch and reuse configurations.
 *
 * **Typical usage:**
 * 1. Create a base action with `createNectAction()`
 * 2. Optionally configure via `.option()` (debug mode, Zod validators)
 * 3. Optionally attach middleware via `.use()` (runs before the handler)
 * 4. Finalize with `.handle()` — returns the dispatchable action function
 *
 * @template ArgsType - Tuple of raw argument types the action accepts
 * @template ValidatedArgs - Tuple of Zod-validated argument types (set by `.option()`)
 * @template ReturnType - The expected success data type of the action
 *
 * @example
 * ```ts
 * // Basic action — no validation, no middleware
 * export const getUser = createNectAction()
 *   .handle(({ outcome }, id: string) => {
 *     return outcome.success({ id }).ok();
 *   });
 *
 * // With Zod validation and middleware
 * export const createUser = createNectAction()
 *   .option({ debugMode: process.env.NODE_ENV === "development" })
 *   .validate([z.object({ name: z.string() })])
 *   .use(async ({ next, set, validated: [user] }) => {
 *     set("role", "admin");
 *     return await next();
 *   })
 *   .handle(({ outcome, validated: [user], get }) => {
 *     const role = get("role");
 *     return outcome.success({ ...user, role }).ok();
 *   });
 * ```
 */
export class NectAction<ArgsType extends readonly any[] = readonly unknown[], ValidatedArgs extends any[] = [], ReturnType = unknown> {
  private middlewares: ActionMiddlewareFunc<ValidatedArgs, ReturnType>[] = [];
  private handler?: ActionFunc<ArgsType, ValidatedArgs, ReturnType>;
  private opt: ActionOption = { debugMode: process.env.NODE_ENV === "development" };
  private validator: ZodType[] = [];

  constructor(middlewares?: typeof this.middlewares, handler?: typeof this.handler) {
    this.middlewares = middlewares ?? [];
    this.handler = handler;
  }

  private createContext(args: ArgsType) {
    const outcome = new Outcome<ReturnType>({ debugMode: this.opt.debugMode });
    const result = this.validator.map((validator, idx) => validator.safeParse(args[idx]));
    const failed = result.find((r) => !r.success);
    if (failed) {
      return { outcome, error: zodErrorToReplyError(failed.error) };
    }
    const safe: Record<string, unknown> = {};
    const ctx: ActionContext<ValidatedArgs, ReturnType> = {
      outcome,
      validated: (result?.map((r) => r.data) ?? []) as unknown as ValidatedArgs,
      get: (name) => safe[name],
      set: (name, value) => (safe[name] = value),
    };

    let i = 0;
    let handlerExecuted = false;
    const next = async () => {
      const middleware = this.middlewares[i++] as ActionMiddlewareFunc<ValidatedArgs, ReturnType> | undefined;
      if (middleware) {
        return await middleware({ ...ctx, next }, ...(args as any));
      }
      if (this.handler && !handlerExecuted) {
        handlerExecuted = true;
        return await (this.handler as Function)(ctx, ...args);
      }
      return ctx.outcome.error({ code: "UNHANDLED_ERROR", message: "No handler" }).fail();
    };
    return { ...ctx, next };
  }

  private dispatch = (async ({ fromCSR }: NectActionFuncInternalArgs, ...args: ArgsType) => {
    const ctx = this.createContext(args);
    if (ctx.error) {
      return ctx.outcome
        .error(omit(ctx.error, ["debug"]))
        .debug(ctx.error.debug)
        .fail();
    }
    try {
      const result = await ctx.next();
      if (fromCSR) {
        return excludeUnserializable(result);
      }
      return result;
    } catch (err) {
      return ctx.outcome.error({ code: "UNHANDLED_ERROR", message: "Unhandled error" }).debug(err).fail();
    }
  }) as NectActionFunc<ArgsType, ReturnType>;

  /**
   * Returns a shallow clone of this `NectAction` instance.
   * Used internally to ensure immutability across the builder chain.
   *
   * @returns A new `NectAction` with the same middlewares, handler, and options
   */
  clone() {
    const cloned = new NectAction(this.middlewares, this.handler);
    cloned.opt = this.opt;
    cloned.validator = this.validator;
    return cloned;
  }

  /**
   * Configure options for this action — debug mode.
   * Merges with any existing options and returns a new cloned instance.
   *
   * @param opt - Options to apply: `debugMode`.
   * @default opt.debugMode = process.env.NODE_ENV === "development"
   * @returns A new `NectAction`
   *
   * @example
   * ```ts
   * const action = createNectAction()
   *   .option({
   *     debugMode: true,
   *   });
   * ```
   */
  option(opt: ActionOption) {
    const cloned = this.clone();
    cloned.opt = { ...cloned.opt, ...opt };
    return cloned;
  }

  /**
   * Configure arguments validator for this action.
   *
   * @param validator - Array of Zod schemas to validate the action arguments.
   * @returns A new `NectAction`
   *
   * @example
   * ```ts
   * const action = createNectAction()
   *   .validate([user])
   *   .handle(({ outcome, validated: [user] }, userArg) => {
   *     // userArg is not validated and clear from caller
   *     return outcome.success(user).ok(); // user is { name: string }
   *   });
   * ```
   */
  validate<V extends readonly ZodType[]>(validator: readonly [...V]) {
    const clonned = this.clone() as unknown as NectAction<[...InferZodTypeInArray<V>, ...unknown[]], InferZodTypeInArray<V>, ReturnType>;
    clonned.validator = validator as any;
    return clonned;
  }

  /**
   * Attach a middleware to the action chain.
   * Middleware runs before the final handler and receives `ctx.next()` to continue the chain.
   *
   * Multiple `.use()` calls stack in order — the first registered runs first.
   * Returns a new cloned instance with the middleware appended.
   *
   * @template NewReturnType - The return type contributed by this middleware
   * @param middleware - The middleware function to attach
   * @returns A new `NectAction` instance with the middleware added
   *
   * @example
   * ```ts
   * const action = createNectAction()
   *   .use(async ({ next, set, validated: [user] }) => {
   *     set("role", await fetchRole(user.id));
   *     return await next();
   *   })
   *   .handle(({ outcome, get }) => {
   *     const role = get("role") as string;
   *     return outcome.success({ role }).ok();
   *   });
   * ```
   */
  use<NewReturnType = unknown>(middleware: ActionMiddlewareFunc<ValidatedArgs, NewReturnType>) {
    const cloned = this.clone();
    cloned.middlewares.push(middleware as any);
    return cloned as NectAction<
      ArgsType,
      ValidatedArgs,
      // prevent assert to unknown
      IsUnknown<ReturnType> extends true ? NewReturnType : ReturnType | NewReturnType
    >;
  }

  /**
   * Finalize the action with a handler function and return the dispatchable action.
   *
   * Calling `.handle()` locks the builder — it returns a plain async function
   * (not a `NectAction`) that can be called directly or passed to `nectAction()`.
   *
   * The handler receives `ActionContext` (without `next`) and the raw action arguments.
   * It must return a result from `outcome.ok()`, `outcome.fail()`, or `outcome.respond()`.
   *
   * @template NewArgsType - Tuple of raw argument types the action accepts
   * @template NewReturnType - The expected success data type
   * @param handler - The final handler function
   * @returns A bound async function `(...args: NewArgsType) => Promise<OutcomeSendResult<NewReturnType>>`
   *
   * @example
   * ```ts
   * export const getUser = createNectAction()
   *   .validate([z.string()])
   *   .handle(({ outcome, validated: [id] }, rawId) => {
   *     if (!id) return outcome.error({ code: "NOT_FOUND", message: "User not found" }).fail();
   *     return outcome.success({ id }).ok();
   *   });
   *
   * // Call it directly
   * const result = await getUser("user-123");
   * ```
   */
  handle<NewArgsType extends ArgsType = ArgsType, NewReturnType = unknown>(handler: ActionFunc<NewArgsType, ValidatedArgs, NewReturnType>) {
    const cloned = this.clone() as unknown as NectAction<
      NewArgsType,
      ValidatedArgs,
      // prevent assert to unknown
      IsUnknown<ReturnType> extends true ? NewReturnType : ReturnType | NewReturnType
    >;
    cloned.handler = handler as any;
    return cloned.dispatch.bind(cloned);
  }
}

/**
 * Creates a fresh `NectAction` builder instance.
 *
 * This is the entry point for defining server actions in Nect.
 * Chain `.option()`, `.use()`, and `.handle()` to build the action.
 *
 * @returns A new `NectAction` instance with no options, middlewares, or handler
 *
 * @example
 * ```ts
 * // Minimal action
 * export const ping = createNectAction()
 *   .handle(({ outcome }) => outcome.success({ pong: true }).ok());
 *
 * // With validation
 * export const createPost = createNectAction()
 *   .option([z.object({ title: z.string() })])
 *   .handle(({ outcome, validated: [post] }) => {
 *     return outcome.success({ id: "new-id", ...post }).ok();
 *   });
 * ```
 */
export const createNectAction = () => {
  return new NectAction();
};
