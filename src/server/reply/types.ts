import type { SerializeOptions } from "cookie";
import type { NectRequest } from "../NectRequest";
import type { NectResponse } from "../NectResponse";

export type Pagination = {
  /** Indicates whether there is next data (for pagination) */
  hasNext?: boolean;
  /** Next offset for pagination */
  nextOffset?: number | null;
};

/**
 * Structure of an error response payload.
 */
export interface ErrorReplyType<C extends string = string> {
  /** Unique error code */
  code: C;
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
export interface ReplyEnvelope<T, Success extends boolean = boolean> {
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

/**
 * Cookie map: keys are cookie names, values extend SerializeOptions with a `value` field.
 */
export type Cookie = Record<string, Omit<SerializeOptions, "name"> & { value: string }>;

export type ReplyOption<C extends string = string> = {
  req: NectRequest;
  res: NectResponse;
  debugMode?: boolean;
  /** `statusMap` map error code to HTTP status */
  statusMap?: { code: C[]; status: number }[];
};
