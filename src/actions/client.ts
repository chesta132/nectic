import { NectOutcomeError } from "./error";
import { ErrorOutcomeType, OutcomeEnvelope } from "./outcome/types";
import { NectActionOption } from "./types";

export const nectAction = async <Args extends any[] = unknown[], Result = unknown, Safe extends boolean = boolean>(
  { action, safe }: NectActionOption<Args, Result, Safe>,
  ...args: Args
): Promise<Safe extends true ? OutcomeEnvelope<Exclude<Result, ErrorOutcomeType>, true> : OutcomeEnvelope<Result | ErrorOutcomeType, boolean>> => {
  const result = await action(...args);

  if (result.meta.status === "ERROR" && !safe) {
    throw new NectOutcomeError(result as OutcomeEnvelope<ErrorOutcomeType, false>);
  }

  return result as any;
};
