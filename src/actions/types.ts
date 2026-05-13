import { ZodType } from "zod";
import { Outcome } from "./outcome";
import { OutcomeSendResult } from "./outcome/types";
import { PromiseOrValue } from "../shared.type";

export type ActionContext<ValidatedArgs extends any[] = unknown[], ReturnType = unknown> = {
  outcome: Outcome<ReturnType>;
  validated: ValidatedArgs;
  get: (name: string) => unknown;
  set: (name: string, value: unknown) => void;
};
export type ActionMiddlewareContext<ValidatedArgs extends any[] = unknown[], ReturnType = unknown> = ActionContext<ValidatedArgs, ReturnType> & {
  next: NextFunc;
};

export type NextFunc = () => PromiseOrValue<any>;
export type ActionMiddlewareFunc<ValidatedArgs extends any[] = unknown[], ReturnType = unknown> = (
  ctx: ActionMiddlewareContext<ValidatedArgs, ReturnType>,
  ...args: unknown[]
) => PromiseOrValue<OutcomeSendResult<ReturnType>>;
export type ActionFunc<ArgsType extends any[] = unknown[], ValidatedArgs extends any[] = unknown[], ReturnType = unknown> = (
  ctx: ActionContext<ValidatedArgs, ReturnType>,
  ...args: ArgsType
) => PromiseOrValue<OutcomeSendResult<ReturnType>>;

export type ActionOption<V extends ActionValidator = ActionValidator> = {
  debugMode?: boolean;
  validator?: V;
};

export type ActionValidator = {
  readonly args: ZodType[];
};

export type NectActionFunc<Args extends any[] = unknown[], Result = unknown> = (...args: Args) => Promise<OutcomeSendResult<Result>>;

export type NectActionOption<Args extends any[] = unknown[], Result = unknown, Safe extends boolean = boolean> = {
  action: NectActionFunc<Args, Result>;
  safe?: Safe;
};
