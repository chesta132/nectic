import { pick } from "../../shared";
import type { OutcomeEnvelope, ErrorOutcomeType, PaginationOption, OutcomeOption, OutcomeSendResult } from "./types";
import { NectError } from "../../error";

const defaultPayload = <T>(): OutcomeEnvelope<T> => ({
  data: { code: "SERVER_ERROR", message: "Payload is empty." } as T,
  meta: { status: "ERROR" },
});

export class Outcome<SuccessType = unknown> {
  private payload: OutcomeEnvelope<typeof this.data | typeof this.errorData, boolean> = defaultPayload();

  private opt: OutcomeOption;

  private data?: SuccessType;
  private errorData?: ErrorOutcomeType
  private debugValue: any[] = [];

  constructor(opt: OutcomeOption) {
    this.opt = opt;
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private _reset() {
    this.data = undefined;
    this.errorData = undefined;
    this.payload = defaultPayload();
    this.debugValue = [];
  }

  private _finalize<S extends boolean>(success: S) {
    this.payload.meta.status = success ? "SUCCESS" : "ERROR";
    this.payload.data = success ? this.data : pick(this.errorData!, ["code", "message", "fields", "information"]);
    if (!success && this.opt.debugMode && this.debugValue.length > 0) {
      this.payload.meta.debug = this.debugValue;
    }
  }

  private _finalizeAndReset<S extends boolean>(success: S) {
    this._finalize(success);
    const payload = { ...this.payload };
    this._reset();
    return payload;
  }

  // ── Payload builders ──────────────────────────────────────────────────────

  /**
   * Set the response body as a success payload.
   *
   * @example
   * ```ts
   * outcome.success({ userId: 123 }).ok()
   * ```
   */
  success<T extends SuccessType>(data: T) {
    this.data = data;
    return this as unknown as Outcome<T>;
  }

  /**
   * Set the response body as an error payload.
   *
   * @example
   * ```ts
   * outcome.error({ code: "NOT_FOUND", message: "User not found" }).fail()
   * ```
   */
  error(data: ErrorOutcomeType) {
    this.errorData = data;
    return this;
  }

  /**
   * Attach an information message to the response metadata.
   *
   * @example
   * ```ts
   * outcome.info("Profile updated").success(user).ok()
   * ```
   */
  info(information: string) {
    this.payload.meta = { ...this.payload.meta, information };
    return this;
  }

  /**
   * Attach pagination metadata (only effective when success data is an array).
   *
   * @example
   * ```ts
   * outcome.success(users).paginate({ limit: 10, offset: 0 }).ok()
   * ```
   */
  paginate: SuccessType extends any[] ? (meta: PaginationOption) => this : never = ((meta: PaginationOption) => {
    if (Array.isArray(this.data)) {
      const { limit, offset } = meta;
      const hasNext = this.data.length >= limit;
      const nextOffset = hasNext ? offset + limit : null;
      this.payload.meta = { ...this.payload.meta, pagination: { hasNext, nextOffset } };
    }
    return this;
  }) as any;

  /**
   * Set debug values — only included in the response when `debugMode` is enabled.
   *
   * @example
   * ```ts
   * outcome.debug(error).error(formattedError).fail()
   * ```
   */
  debug(...messages: any[]) {
    this.debugValue.push(...messages);
    return this;
  }

  /**
   * Smart send — sends success if `.success()` was called, error if `.error()` was called.
   *
   * @example
   * ```ts
   * outcome.info("Updated").success(user).respond()
   * outcome.error(err).respond()
   * ```
   */
  respond(): OutcomeSendResult<SuccessType> {
    if (this.data !== undefined) return this.ok();
    if (this.errorData !== undefined) return this.fail();
    throw new NectError("Cannot call .respond() — no success or error set. Call .success() or .error() first.");
  }

  /**
   * Send a `200 OK` response.
   *
   * @example
   * ```ts
   * return outcome.success(user).ok()
   * ```
   */
  ok(): OutcomeSendResult<SuccessType> {
    return this._finalizeAndReset(true) as OutcomeSendResult<SuccessType>;
  }

  /**
   * Send an error response.
   *
   * @example
   * ```ts
   * return outcome.error({ code: "INVALID_AUTH", message: "Invalid token" }).fail()
   * ```
   */
  fail(): OutcomeSendResult<SuccessType> {
    const errorBody = this.errorData;
    if (!errorBody) throw new NectError("Cannot call .fail() — no error set. Call .error() first.");
    return this._finalizeAndReset(false) as OutcomeSendResult<SuccessType>;
  }
}

export function createOutcome<SuccessType = unknown>(opt: OutcomeOption): Outcome<SuccessType> {
  return new Outcome<SuccessType>(opt);
}
