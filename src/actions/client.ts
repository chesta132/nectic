import { NectOutcomeError } from "./error";
import { ErrorOutcomeType, OutcomeEnvelope } from "./outcome/types";
import { NectActionOption } from "./types";

export const nectAction = async <Args extends any[] = unknown[], Result = unknown, Unsafe extends boolean = boolean>(
  { action, unsafe }: NectActionOption<Args, Result, Unsafe>,
  ...args: Args
): Promise<Unsafe extends true ? OutcomeEnvelope<Exclude<Result, ErrorOutcomeType>, true> : OutcomeEnvelope<Result | ErrorOutcomeType, boolean>> => {
  const result = await action(...args);

  if (result.meta.status === "ERROR" && unsafe) {
    throw new NectOutcomeError(result as OutcomeEnvelope<ErrorOutcomeType, false>);
  }

  return result as any;
};
