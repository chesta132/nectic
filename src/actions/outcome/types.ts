export type Pagination = {
  /** Indicates whether there is next data (for pagination) */
  hasNext?: boolean;
  /** Next offset for pagination */
  nextOffset?: number | null;
};

/**
 * Structure of an error response payload.
 */
export interface ErrorOutcomeType {
  /** Unique error code */
  code: string;
  /** Human-readable message */
  message: string;
  /** Optional field reference (useful for forms) */
  fields?: Record<string, string>;
  /** Optional custom info */
  information?: any;
}

/**
 * Standard response envelope.
 */
export interface OutcomeEnvelope<T, Success extends boolean = boolean> {
  meta: {
    /** Optional debug values */
    debug?: any[];
    /** Status of response (SUCCESS/ERROR) */
    status: Success extends true ? "SUCCESS" : "ERROR";
  } & (Success extends true
    ? {
        /** Optional pagination meta */
        pagination?: Pagination;
        /** Optional information message */
        information?: string;
      }
    : {});
  /** Response payload data */
  data: T;
}

export type PaginationOption = { limit: number; offset: number };

export type OutcomeOption = {
  debugMode?: boolean;
};

export type OutcomeSendResult<T> = OutcomeEnvelope<T | ErrorOutcomeType, boolean>;
