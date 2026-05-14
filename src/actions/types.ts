import { ZodType } from "zod";
import { Outcome } from "./outcome";
import { OutcomeSendResult } from "./outcome/types";
import { IsPrefixOf, PromiseOrValue } from "../shared.type";

/**
 * Context object passed to every action handler and middleware.
 * Provides access to the `Outcome` builder, validated args, and a shared key-value store.
 *
 * @template ValidatedArgs - Tuple of validated argument types (inferred from `ActionValidator`)
 * @template ReturnType - The expected success data type of the action
 */
export type ActionContext<ValidatedArgs extends readonly any[] = readonly unknown[], ReturnType = unknown> = {
  /** The `Outcome` builder used to shape and send the action response */
  outcome: Outcome<ReturnType>;
  /**
   * Array of validated arguments, produced by the Zod schemas declared in `option({ validator })`.
   * Matches positionally with the original action arguments.
   *
   * @example
   * ```ts
   * const action = createNectAction()
   *   .validate([z.object({ name: z.string() })])
   *   .handle(({ outcome, validated }, raw) => {
   *     const [user] = validated; // user is { name: string }
   *     return outcome.success(user).ok();
   *   });
   * ```
   */
  validated: ValidatedArgs;
  /**
   * Retrieve a value from the shared context store.
   * Typically set by a middleware via `set()` and consumed by the next handler.
   *
   * @param name - Key to retrieve
   * @returns The stored value, or `undefined` if not set
   *
   * @example
   * ```ts
   * const user = ctx.get("user") as User;
   * ```
   */
  get: (name: string) => unknown;
  /**
   * Store a value in the shared context store.
   * Useful for passing data from middleware to subsequent handlers.
   *
   * @param name - Key to store under
   * @param value - Value to store
   *
   * @example
   * ```ts
   * ctx.set("user", fetchedUser);
   * ```
   */
  set: (name: string, value: unknown) => void;
};

/**
 * Context passed to middleware — extends `ActionContext` with a `next()` function
 * to advance to the next middleware or the final handler.
 *
 * @template ValidatedArgs - Tuple of validated argument types
 * @template ReturnType - The expected success data type of the action
 */
export type ActionMiddlewareContext<ValidatedArgs extends readonly any[] = readonly unknown[], ReturnType = unknown> = ActionContext<
  ValidatedArgs,
  ReturnType
> & {
  /**
   * Calls the next middleware in the chain, or the final handler if no more middleware remain.
   * Must be awaited to ensure the chain executes correctly.
   *
   * @example
   * ```ts
   * const authMw: ActionMiddlewareFunc = async ({ next, set }, token) => {
   *   const user = await verifyToken(token);
   *   set("user", user);
   *   return await next();
   * };
   * ```
   */
  next: NextFunc;
};

/**
 * The `next()` function used inside middleware to advance the execution chain.
 * Can return synchronously or as a Promise.
 */
export type NextFunc = () => PromiseOrValue<any>;

/**
 * Signature for an action middleware function.
 * Receives the extended middleware context (including `next`) followed by the raw action arguments.
 *
 * @template ValidatedArgs - Tuple of validated argument types
 * @template ReturnType - The expected success data type of the action
 *
 * @example
 * ```ts
 * const logMw: ActionMiddlewareFunc<[User], { user: User }> = async (
 *   { outcome, validated: [validatedUser], next, set },
 *   rawUser
 * ) => {
 *   set("user", validatedUser);
 *   return await next();
 * };
 * ```
 */
export type ActionMiddlewareFunc<ValidatedArgs extends readonly any[] = readonly unknown[], ReturnType = unknown> = (
  ctx: ActionMiddlewareContext<ValidatedArgs, ReturnType>,
  ...args: [...ValidatedArgs, unknown[]]
) => PromiseOrValue<OutcomeSendResult<ReturnType>>;

/**
 * Signature for the final action handler function.
 * Receives the base context (without `next`) and the raw action arguments.
 *
 * @template ArgsType - Tuple of raw argument types passed when the action is called
 * @template ValidatedArgs - Tuple of validated argument types (from Zod schemas)
 * @template ReturnType - The expected success data type of the action
 *
 * @example
 * ```ts
 * const handler: ActionFunc<[user: User, fromAuth: boolean], [User], { id: string }> = (
 *   { outcome, validated: [validUser] },
 *   rawUser,
 *   fromAuth
 * ) => {
 *   return outcome.success({ id: validUser.id }).ok();
 * };
 * ```
 */
export type ActionFunc<
  ArgsType extends readonly any[] = readonly unknown[],
  ValidatedArgs extends readonly any[] = readonly unknown[],
  ReturnType = unknown,
> =
  IsPrefixOf<ValidatedArgs, ArgsType> extends true
    ? (ctx: ActionContext<ValidatedArgs, ReturnType>, ...args: ArgsType) => PromiseOrValue<OutcomeSendResult<ReturnType>>
    : { __error: "ValidatedArgs must be a prefix of ArgsType" };

/**
 * Configuration options for a `NectAction` instance.
 * Used with `.option()` to set debug mode and/or attach Zod validators.
 *
 * @template V - The validator type (inferred from the provided `validator`)
 *
 * @example
 * ```ts
 * createNectAction().option({
 *   debugMode: true,
 * });
 * ```
 */
export type ActionOption = {
  /**
   * When `true`, error responses will include a `debug` field in `meta`
   * containing the raw thrown value. Useful during development.
   */
  debugMode?: boolean;
};

export type NectActionFuncInternalArgs<FromCSR extends boolean = boolean> = { fromCSR: FromCSR };

/**
 * The callable function type returned by `.handle()`.
 * Represents the final dispatchable action — called like a regular async function.
 *
 * @template Args - Tuple of argument types the action accepts
 * @template Result - The success data type wrapped in `OutcomeSendResult`
 *
 * @example
 * ```ts
 * const getUser: NectActionFunc<[string], User> = createNectAction()
 *   .handle(({ outcome }, id) => outcome.success({ id }).ok());
 *
 * const result = await getUser("user-123");
 * ```
 */
export type NectActionFunc<Args extends readonly any[] = readonly unknown[], Result = unknown> = (
  internalArgs: NectActionFuncInternalArgs,
  ...args: Args
) => Promise<OutcomeSendResult<Result>>;

/**
 * Options for `nectAction()` — the client-side action caller.
 * Wraps a `NectActionFunc` and optionally enables `unsafe` mode.
 *
 * @template Args - Tuple of argument types the action accepts
 * @template Result - The success data type of the action
 * @template Unsafe - If `true`, throws `NectOutcomeError` on error responses instead of returning them
 *
 * @example
 * ```ts
 * // Safe mode (default): returns the envelope regardless of success/error
 * const result = await nectAction({ action: getUser }, "user-123");
 *
 * // Unsafe mode: throws NectOutcomeError if the action returns an error
 * const result = await nectAction({ action: getUser, unsafe: true }, "user-123");
 * ```
 */
export type NectActionOption<
  Args extends any[] = unknown[],
  Result = unknown,
  Unsafe extends boolean = boolean,
  FromCSR extends boolean = boolean,
> = {
  /** The action function to invoke */
  action: NectActionFunc<Args, Result>;
  /**
   * When `true`, throws a `NectOutcomeError` if the action returns an error envelope.
   * When `false` or omitted, always returns the `OutcomeEnvelope` regardless of status.
   */
  unsafe?: Unsafe;
  /**
   * When `true`, NectActions will remove all unserializable.
   * @default false
   */
  fromCSR?: FromCSR;
};
