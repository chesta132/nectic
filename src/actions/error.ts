import { ErrorOutcomeType, OutcomeEnvelope } from "./outcome/types";

/**
 * Error class thrown by `nectAction()` when `unsafe: true` and the action returns an error envelope.
 *
 * Instead of returning the error envelope to the caller, `nectAction` throws this class
 * so you can use try/catch to handle action errors in a more ergonomic way.
 *
 * @example
 * ```ts
 * try {
 *   const result = await nectAction(getUser, { unsafe: true })("user-123");
 *   console.log(result.data); // { id: "user-123" }
 * } catch (err) {
 *   if (err instanceof NectOutcomeError) {
 *     console.error(err.message);   // "User not found"
 *     console.error(err.data.code); // "NOT_FOUND"
 *   }
 * }
 * ```
 */
export class NectOutcomeError {
  /**
   * The error payload returned by the action.
   * Contains `code`, `message`, and optionally `fields` or `information`.
   */
  readonly data: ErrorOutcomeType;

  /**
   * The `meta` object from the error envelope.
   * Always has `status: "ERROR"` and optionally `debug` values if `debugMode` was enabled.
   */
  readonly meta: OutcomeEnvelope<ErrorOutcomeType, false>["meta"];

  /**
   * Shorthand for `data.message` — the human-readable error message.
   */
  readonly message: string;

  constructor(envelope: OutcomeEnvelope<ErrorOutcomeType, false>) {
    this.meta = envelope.meta;
    this.data = envelope.data;
    this.message = envelope.data.message;
  }
}
