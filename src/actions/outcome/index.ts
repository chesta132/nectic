import { pick } from "../../shared";
import type { OutcomeEnvelope, ErrorOutcomeType, PaginationOption, OutcomeOption, OutcomeSendResult } from "./types";
import { NectError } from "../../error";

const defaultPayload = <T>(): OutcomeEnvelope<T, false> => ({
  data: { code: "SERVER_ERROR", message: "Payload is empty." },
  meta: { status: "ERROR" },
});

/**
 * Chainable response builder for server actions.
 *
 * `Outcome` is responsible for shaping the `OutcomeEnvelope` that gets returned
 * from an action. It follows a builder pattern — call payload setters first
 * (`.success()`, `.error()`, `.info()`, etc.), then finalize with a send method
 * (`.ok()`, `.fail()`, or `.respond()`).
 *
 * An `Outcome` instance is provided via `ctx.outcome` inside every action handler
 * and middleware. You should not instantiate this class directly — use `createOutcome()`
 * or rely on the one injected by `NectAction`.
 *
 * **Typical usage:**
 * ```ts
 * // Success path
 * return outcome.success({ id: "123" }).ok();
 *
 * // Error path
 * return outcome.error({ code: "NOT_FOUND", message: "User not found" }).fail();
 *
 * // With metadata
 * return outcome.info("Record updated").success(user).ok();
 *
 * // With pagination (only when SuccessType extends any[])
 * return outcome.success(users).paginate({ limit: 10, offset: 0 }).ok();
 * ```
 *
 * @template SuccessType - The expected shape of the success data payload
 */
export class Outcome<SuccessType = unknown> {
  private payload: OutcomeEnvelope<typeof this.data | typeof this.errorData, boolean> = defaultPayload();

  private opt: OutcomeOption;

  private successMeta: OutcomeEnvelope<SuccessType, true>["meta"] = {
    status: "SUCCESS",
  };
  private data?: SuccessType;
  private errorData?: ErrorOutcomeType;
  private debugValue: any[] = [];

  /**
   * @param opt - Options for this `Outcome` instance
   * @param opt.debugMode - When `true`, `.debug()` values are included in the error envelope's `meta.debug` field
   */
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
    if (success) {
      this.payload.meta = this.successMeta;
    } else {
      this.payload.meta.status = "ERROR";
    }
    this.payload.data = (success ? this.data : pick(this.errorData!, ["code", "message", "fields", "information"])) as any;
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
   * Must be followed by `.ok()`, `.respond()`, or another send method to finalize.
   *
   * @param data - The success data to include in `envelope.data`
   * @returns `this` for chaining
   *
   * @example
   * ```ts
   * return outcome.success({ userId: 123 }).ok();
   * ```
   */
  success<T extends SuccessType>(data: T) {
    this.data = data;
    return this as unknown as Outcome<T>;
  }

  /**
   * Set the response body as an error payload.
   * Must be followed by `.fail()` or `.respond()` to finalize.
   *
   * @param data - The error payload: `code`, `message`, and optional `fields`/`information`
   * @returns `this` for chaining
   *
   * @example
   * ```ts
   * return outcome.error({ code: "NOT_FOUND", message: "User not found" }).fail();
   * ```
   */
  error(data: ErrorOutcomeType) {
    this.errorData = data;
    return this;
  }

  /**
   * Attach an information message to the response metadata.
   * Only appears in the envelope when the final send is a success (`.ok()` / `.respond()`).
   * Must be called before `.success()` or `.ok()`.
   *
   * @param information - A human-readable string added to `envelope.meta.information`
   * @returns `this` for chaining
   *
   * @example
   * ```ts
   * return outcome.info("Profile updated").success(user).ok();
   * ```
   */
  info(information: string) {
    this.successMeta = { ...this.successMeta, information };
    return this;
  }

  /**
   * Attach pagination metadata to the response.
   * Only available (at the type level) when `SuccessType extends any[]`.
   * Only takes effect if `.success()` was called with an array value.
   *
   * Computes `hasNext` by checking if the array length is `>= limit`,
   * and sets `nextOffset` to `offset + limit` if there is a next page, or `null` otherwise.
   *
   * @param meta - Pagination input: `limit` (page size) and `offset` (current position)
   * @returns `this` for chaining
   *
   * @example
   * ```ts
   * const users = await db.users.findMany({ take: 11, skip: 0 });
   * return outcome.success(users).paginate({ limit: 10, offset: 0 }).ok();
   * // If users.length >= 10 → hasNext: true, nextOffset: 10
   * // If users.length < 10  → hasNext: false, nextOffset: null
   * ```
   */
  paginate: SuccessType extends any[] ? (meta: PaginationOption) => this : never = ((meta: PaginationOption) => {
    if (Array.isArray(this.data)) {
      const { limit, offset } = meta;
      const hasNext = this.data.length >= limit;
      const nextOffset = hasNext ? offset + limit : null;
      this.successMeta = { ...this.successMeta, pagination: { hasNext, nextOffset } };
    }
    return this;
  }) as any;

  /**
   * Attach one or more debug values to be included in `meta.debug` on error responses.
   * Values are only serialized into the envelope when `debugMode: true` was passed to the constructor.
   * Safe to call in production — silently ignored when debug mode is off.
   *
   * @param messages - Any values to attach (typically caught errors or diagnostic data)
   * @returns `this` for chaining
   *
   * @example
   * ```ts
   * try {
   *   const user = await db.findUser(id);
   *   return outcome.success(user).ok();
   * } catch (err) {
   *   return outcome.debug(err).error({ code: "DB_ERROR", message: "Database error" }).fail();
   * }
   * ```
   */
  debug(...messages: any[]) {
    this.debugValue.push(...messages);
    return this;
  }

  /**
   * Smart send — automatically resolves to `.ok()` or `.fail()` based on
   * whether `.success()` or `.error()` was called last.
   *
   * Throws a `NectError` if neither `.success()` nor `.error()` was called first.
   *
   * @returns The finalized `OutcomeSendResult`
   * @throws {NectError} If called without a prior `.success()` or `.error()` call
   *
   * @example
   * ```ts
   * outcome.info("Updated").success(user).respond();
   * outcome.error({ code: "FORBIDDEN", message: "Access denied" }).respond();
   * ```
   */
  respond(): OutcomeSendResult<SuccessType> {
    if (this.data !== undefined) return this.ok();
    if (this.errorData !== undefined) return this.fail();
    throw new NectError("Cannot call .respond() — no success or error set. Call .success() or .error() first.");
  }

  /**
   * Finalize and return a success envelope.
   * Requires `.success()` to have been called beforehand.
   *
   * @returns The finalized `OutcomeSendResult` with `meta.status: "SUCCESS"`
   *
   * @example
   * ```ts
   * return outcome.success(user).ok();
   * ```
   */
  ok(): OutcomeSendResult<SuccessType> {
    return this._finalizeAndReset(true) as OutcomeSendResult<SuccessType>;
  }

  /**
   * Finalize and return an error envelope.
   * Requires `.error()` to have been called beforehand.
   *
   * @returns The finalized `OutcomeSendResult` with `meta.status: "ERROR"`
   * @throws {NectError} If called without a prior `.error()` call
   *
   * @example
   * ```ts
   * return outcome.error({ code: "INVALID_AUTH", message: "Invalid token" }).fail();
   * ```
   */
  fail(): OutcomeSendResult<SuccessType> {
    const errorBody = this.errorData;
    if (!errorBody) throw new NectError("Cannot call .fail() — no error set. Call .error() first.");
    return this._finalizeAndReset(false) as OutcomeSendResult<SuccessType>;
  }
}

/**
 * Creates a new `Outcome` instance with the given options.
 *
 * Prefer using the `outcome` object injected via `ActionContext` inside handlers.
 * Use this factory directly only when constructing an `Outcome` outside of a `NectAction` handler,
 * such as in tests or standalone utilities.
 *
 * @template SuccessType - The expected shape of the success data payload
 * @param opt - Options: `debugMode` to enable debug values in error envelopes
 * @returns A new `Outcome<SuccessType>` instance
 *
 * @example
 * ```ts
 * const outcome = createOutcome<{ id: string }>({ debugMode: true });
 * return outcome.success({ id: "abc" }).ok();
 * ```
 */
export function createOutcome<SuccessType = unknown>(opt: OutcomeOption): Outcome<SuccessType> {
  return new Outcome<SuccessType>(opt);
}
