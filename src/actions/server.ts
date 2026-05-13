import { omit } from "../shared";
import { zodErrorToReplyError } from "../validator/formatZod";
import { Outcome } from "./outcome";
import { ActionContext, ActionFunc, ActionMiddlewareFunc, ActionOption, ActionValidator, InferZodTypeInArray } from "./types";
import { IsUnknown } from "../shared.type";

export class NectAction<ArgsType extends any[] = unknown[], ValidatedArgs extends any[] = unknown[], ReturnType = unknown> {
  private middlewares: ActionMiddlewareFunc<ValidatedArgs, ReturnType>[] = [];
  private handler?: ActionFunc<ArgsType, ValidatedArgs, ReturnType>;
  private opt: ActionOption = {};

  constructor(middlewares?: typeof this.middlewares, handler?: typeof this.handler) {
    this.middlewares = middlewares ?? [];
    this.handler = handler;
  }

  private createContext(args: ArgsType) {
    const outcome = new Outcome<ReturnType>({ debugMode: this.opt.debugMode });
    const result = this.opt.validator?.args.map((validator, idx) => validator.safeParse(args[idx]));
    if (result) {
      const failed = result.find((r) => !r.success);
      if (failed) {
        return { outcome, error: zodErrorToReplyError(failed.error) };
      }
    }
    const safe: Record<string, unknown> = {};
    const ctx: ActionContext<ValidatedArgs, ReturnType> = {
      outcome,
      validated: (result?.map((r) => r.data) ?? []) as ValidatedArgs,
      get: (name) => safe[name],
      set: (name, value) => (safe[name] = value),
    };

    let i = 0;
    let handlerExecuted = false;
    const next = async () => {
      const middleware = this.middlewares[i++] as ActionMiddlewareFunc<ValidatedArgs, ReturnType> | undefined;
      if (middleware) {
        return await middleware({ ...ctx, next }, ...args);
      }
      if (this.handler && !handlerExecuted) {
        handlerExecuted = true;
        return await this.handler(ctx, ...args);
      }
      return ctx.outcome.error({ code: "UNHANDLED_ERROR", message: "No handler" }).fail();
    };
    return { ...ctx, next };
  }

  private dispatch(...args: ArgsType) {
    const ctx = this.createContext(args);
    if (ctx.error) {
      return ctx.outcome
        .error(omit(ctx.error, ["debug"]))
        .debug(ctx.error.debug)
        .fail();
    }
    return ctx.next();
  }

  clone() {
    const cloned = new NectAction(this.middlewares, this.handler);
    cloned.opt = this.opt;
    return cloned;
  }

  option<V extends ActionValidator>(opt: ActionOption<V>) {
    const cloned = this.clone() as unknown as NectAction<ArgsType, InferZodTypeInArray<V["args"]>, ReturnType>;
    cloned.opt = { ...cloned.opt, ...opt };
    return cloned;
  }

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

  handle<NewArgsType extends any[] = unknown[], NewReturnType = unknown>(handler: ActionFunc<NewArgsType, ValidatedArgs, NewReturnType>) {
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

export const createNectAction = () => {
  return new NectAction();
};
