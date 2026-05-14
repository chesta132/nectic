/**
 * Pagination state included in a success envelope's `meta` field.
 * Populated when `.paginate()` is called on `Outcome` or `Reply`.
 */
export type Pagination = {
  /** Whether there is a next page — `true` if the result array length was `>= limit` */
  hasNext?: boolean;
  /** The offset to use for the next page request, or `null` if there is no next page */
  nextOffset?: number | null;
};

/**
 * Structure of an error response payload inside `OutcomeEnvelope.data` when the action fails.
 *
 * @example
 * ```ts
 * outcome.error({
 *   code: "VALIDATION_ERROR",
 *   message: "Invalid input",
 *   fields: { email: "Must be a valid email" },
 * }).fail();
 * ```
 */
export interface ErrorOutcomeType {
  /** Unique error code — use a consistent set of codes across your app for easier error handling on the client */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Per-field error messages, useful for form validation errors */
  fields?: Record<string, string>;
  /** Arbitrary extra information attached to the error (e.g. upstream error details) */
  information?: any;
}

/**
 * The standard response envelope returned by every action.
 * Both success and error responses share this shape — consumers should
 * check `meta.status` to distinguish between them.
 *
 * @template T - The type of `data` (either `SuccessType` or `ErrorOutcomeType`)
 * @template Success - Boolean brand that narrows `meta.status` and available `meta` fields
 *
 * @example
 * ```ts
 * // Checking status on the client
 * const result: OutcomeEnvelope<User> = await getUser("123");
 * if (result.meta.status === "SUCCESS") {
 *   console.log(result.data); // User
 * } else {
 *   console.error(result.data.code); // error code string
 * }
 * ```
 */
export type OutcomeEnvelope<T, Success extends boolean = boolean> = Success extends true
  ? {
      meta: {
        /** Response status: "SUCCESS" */
        status: "SUCCESS";
        /** Pagination state — only present when `.paginate()` was called with an array payload */
        pagination?: Pagination;
        /** Optional information message set via `.info()` */
        information?: string;
        /** Raw debug values — only present when `debugMode: true` */
        debug?: any[];
      };
      /** The success response payload */
      data: Exclude<T, ErrorOutcomeType>;
    }
  : {
      meta: {
        /** Response status: "ERROR" */
        status: "ERROR";
        /** Raw debug values — only present when `debugMode: true` */
        debug?: any[];
      };
      /** The error response payload */
      data: ErrorOutcomeType;
    };

/**
 * Input for `.paginate()` — describes the current page window.
 *
 * @example
 * ```ts
 * outcome.success(rows).paginate({ limit: 20, offset: 40 }).ok();
 * ```
 */
export type PaginationOption = { limit: number; offset: number };

/**
 * Constructor options for `Outcome` and `createOutcome()`.
 */
export type OutcomeOption = {
  /**
   * When `true`, values passed to `.debug()` are serialized into `meta.debug`
   * on error envelopes. Has no effect on success envelopes.
   * Should be disabled in production.
   */
  debugMode?: boolean;
};

/**
 * The return type of every action finalize method (`.ok()`, `.fail()`, `.respond()`).
 * Always an `OutcomeEnvelope` where `data` is either `T` (success) or `ErrorOutcomeType` (error).
 *
 * @template T - The success data type
 */
export type OutcomeSendResult<T> = OutcomeEnvelope<T | ErrorOutcomeType, boolean>;
