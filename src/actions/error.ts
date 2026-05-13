import { ErrorOutcomeType, OutcomeEnvelope } from "./outcome/types";

export class NectOutcomeError {
  readonly data: ErrorOutcomeType;
  readonly meta: OutcomeEnvelope<ErrorOutcomeType, false>["meta"];
  readonly message: string;

  constructor(envelope: OutcomeEnvelope<ErrorOutcomeType, false>) {
    this.meta = envelope.meta;
    this.data = envelope.data;
    this.message = envelope.data.message;
  }
}
