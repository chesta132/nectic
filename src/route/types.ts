import { NextResponse } from "next/server";
import { NectRequest, NectResponse, NectSendResult, Reply } from "../server";
import { ZodObject, ZodType } from "zod";

// ─── METHOD ───────────────────────────────────────────────────────────────────

/** Standard HTTP methods (GET, POST, PUT, etc.) */
export type BasicMethod = "GET" | "HEAD" | "POST" | "PUT" | "DELETE" | "OPTIONS" | "TRACE" | "PATCH";

/** Any uppercase string valid as an HTTP method, including custom ones */
export type AllowedMethod = Uppercase<string & {}>;

// ─── BRANDS ───────────────────────────────────────────────────────────────────

/** Brand symbol to distinguish param type in RouteRequest at the type level */
declare const __ParamBrand: unique symbol;

/** Brand symbol to distinguish query type in RouteRequest at the type level */
declare const __QueryBrand: unique symbol;

// ─── FUNCS ────────────────────────────────────────────────────────────────────

/**
 * Recovery function invoked when a handler throws an error.
 * Receives the error, request, and response, and must return an appropriate response.
 *
 * @template Handler - The handler type in use (App Router or Pages Router)
 * @param err - The error thrown by the handler
 * @param req - The request object
 * @param res - The response object
 * @returns A response matching the router type in use
 */
export type RecoverFunc<Handler extends SupportedHandlers> = (
  err: unknown,
  req: RouteRequest,
  res: RouteResponse,
) => Handler extends AppRouterHandler ? AppRouterResponse | Promise<AppRouterResponse> : PageRouterResponse | Promise<PageRouterResponse>;

/**
 * Function to control CORS on a per-origin basis.
 * Called on every request with the `Origin` header value as the argument.
 *
 * @param origin - The value of the `Origin` request header
 * @returns A boolean or CORS config object — can be async
 */
export type CORSFunc = (origin: string) => boolean | CORSObjOpt | Promise<CORSObjOpt | boolean>;

/** Return type of `next()` — either void or Promise<void> */
export type NextResult = PromiseOrValue<void>;

/**
 * The `next()` function used inside a middleware/handler chain
 * to pass control to the next handler.
 */
export type NextFunc = () => NextResult;

// ─── ROUTE REQUEST & ROUTE RESPONSE ──────────────────────────────────────────

/**
 * The request object used inside route handlers.
 * Extends NectRequest with branded types for param and query
 * to improve type inference accuracy.
 *
 * @template TBody - Request body type
 * @template TParam - URL path params type
 * @template TQuery - Query string type
 */
export type RouteRequest<
  TBody = unknown,
  TParam extends Record<string, any> = Record<string, any>,
  TQuery extends Record<string, any> = Record<string, any>,
> = NectRequest<TBody> & {
  readonly [__ParamBrand]?: TParam;
  readonly [__QueryBrand]?: TQuery;
};

/**
 * The response object used inside route handlers.
 *
 * @template TBody - Response body type
 */
export type RouteResponse<TBody = unknown> = NectResponse<TBody>;

// ─── ROUTE VALIDATED ─────────────────────────────────────────────────────────

/**
 * The parsed and Zod-validated result of a request.
 * Available inside handlers via `context.validated`.
 *
 * @template TBody - Validated body type
 * @template TParam - Validated URL params type
 * @template TQuery - Validated query string type
 */
export type RouteValidated<
  TBody = unknown,
  TParam extends Record<string, any> = Record<string, any>,
  TQuery extends Record<string, any> = Record<string, any>,
> = {
  body: TBody;
  param: TParam;
  query: TQuery;
};

// ─── CONTEXT ─────────────────────────────────────────────────────────────────

/**
 * Context object received by every handler.
 * Contains `next()` to advance the handler chain,
 * `reply` to build the response, and `validated` for parsed request data.
 *
 * @template NativeContext - Extra context from the framework (e.g. App Router params)
 * @template R - Reply object type
 * @template Validated - Validated request data type
 */
export type RouteContext<
  NativeContext extends Record<string, any> = {},
  R extends Reply = Reply,
  Validated extends RouteValidated = RouteValidated,
> = NativeContext & {
  /** Calls the next handler in the chain */
  next: () => void | Promise<void>;
  /** Object used to build and send the response */
  reply: R;
  /** Validated request data (body, param, query) */
  validated: Validated;
};

// ─── APP ROUTER ───────────────────────────────────────────────────────────────

/** All possible return types from an App Router handler */
export type AppRouterResponse = NectSendResult | NextResponse | Response | NextResult;

/**
 * Native context from Next.js App Router.
 * Contains `params` from dynamic route segments.
 *
 * @template Param - URL params type (string or string array)
 */
export type AppRouterContext<Param extends Record<string, string | string[]> = Record<string, string | string[]>> = {
  /** URL path params from dynamic segments, already awaited */
  params?: Param;
};

/**
 * Handler signature for Next.js App Router.
 * Receives `req`, `res`, and a `context` enriched with reply, next, and validated data.
 *
 * @template Req - RouteRequest type
 * @template Res - RouteResponse type
 * @template Code - Union string of custom status codes
 */
export type AppRouterHandler<Req extends RouteRequest = RouteRequest, Res extends RouteResponse = RouteResponse, Code extends string = string> = (
  req: Req extends RouteRequest<infer TBody> ? NectRequest<TBody> : never,
  res: Res extends RouteResponse<infer TBody> ? NectResponse<TBody> : never,
  context: Req extends RouteRequest<infer ReqBody, infer ReqParam, infer ReqQuery>
    ? Res extends RouteResponse<infer ResBody>
      ? RouteContext<AppRouterContext<ReqParam>, Reply<ResBody, Code>, RouteValidated<ReqBody, ReqParam, ReqQuery>>
      : never
    : never,
) => Promise<AppRouterResponse> | AppRouterResponse;

// ─── PAGES ROUTER ─────────────────────────────────────────────────────────────

/** All possible return types from a Pages Router handler */
export type PageRouterResponse = NectSendResult | void | NextResult;

/**
 * Handler signature for Next.js Pages Router.
 * Similar to AppRouterHandler but without AppRouterContext (no native params).
 *
 * @template Req - RouteRequest type
 * @template Res - RouteResponse type
 * @template Code - Union string of custom status codes
 */
export type PagesRouterHandler<Req extends RouteRequest = RouteRequest, Res extends RouteResponse = RouteResponse, Code extends string = string> = (
  req: Req extends RouteRequest<infer TBody> ? NectRequest<TBody> : never,
  res: Res extends RouteResponse<infer TBody> ? NectResponse<TBody> : never,
  context: Req extends RouteRequest<infer ReqBody, infer ReqParam, infer ReqQuery>
    ? Res extends RouteResponse<infer ResBody>
      ? RouteContext<{}, Reply<ResBody, Code>, RouteValidated<ReqBody, ReqParam, ReqQuery>>
      : never
    : never,
) => Promise<PageRouterResponse> | PageRouterResponse;

// ─── SHARED ───────────────────────────────────────────────────────────────────

/** Union of all possible response types (App Router and Pages Router) */
export type AnyRouterResponse = AppRouterResponse | PageRouterResponse;

/** Union of all supported handler types */
export type SupportedHandlers = AppRouterHandler<any, any, any> | PagesRouterHandler<any, any, any>;

// ─── HANDLERS ─────────────────────────────────────────────────────────────────

/**
 * Map from HTTP method to a handler or array of handlers.
 * The `FALLBACK` key is optional and used when no matching method is found.
 *
 * @template Method - Allowed HTTP methods
 * @template Handler - Handler type in use
 */
export type Handlers<Method extends AllowedMethod, Handler extends SupportedHandlers> = Record<Method, Handler | Handler[]> & {
  /** Fallback handler invoked when no method match is found */
  FALLBACK?: Handler | Handler[];
};

/** Handlers specific to the App Router */
export type AppRouterHandlers<Method extends AllowedMethod = AllowedMethod> = Handlers<Method, AppRouterHandler>;

/** Handlers specific to the Pages Router */
export type PagesRouterHandlers<Method extends AllowedMethod = AllowedMethod> = Handlers<Method, PagesRouterHandler>;

/**
 * Flattened version of Handlers — all handlers normalized to arrays.
 * Used internally by NectRoute after `flattenHandlers()`.
 *
 * @template H - Original Handlers type
 */
export type FlattenHandlers<H extends Handlers<any, any>> =
  H extends Handlers<infer Method, infer Handler> ? Partial<Record<Method | "FALLBACK", Handler[]>> : never;

// ─── OPTIONS ─────────────────────────────────────────────────────────────────

/**
 * Validation options for a specific handler.
 * Supports body, param, and query validation using Zod schemas.
 */
export type HandlerValidatorOption = {
  /** Zod schema for validating the request body */
  body?: ZodType;
  /** Zod schema for validating URL path params */
  param?: ZodObject;
  /** Zod schema for validating query string params */
  query?: ZodObject;
};

/**
 * Per-handler options: validation, CORS, and recovery function.
 *
 * @template Handler - The handler type in use
 */
export type HandlerOption<Handler extends SupportedHandlers> = {
  /** Zod validation config for this handler */
  validator?: HandlerValidatorOption;
  /** CORS config for this handler */
  cors?: CORSOpt;
  /** Recovery function if this handler throws an error */
  recover?: RecoverFunc<Handler>;
};

/**
 * Global options for a single route (NectRoute instance).
 * Supports debug mode, custom status code mapping, global CORS, and per-method overrides.
 *
 * @template H - The Handlers type in use
 * @template C - Union string of custom status codes
 */
export type RouteOptions<H extends Handlers<any, any>, C extends string> =
  H extends Handlers<infer Method, infer Handler>
    ? {
        /** Enable debug mode for more verbose error responses */
        debugMode?: boolean;
        /**
         * Mapping from custom status codes to HTTP status numbers.
         * @example [{ code: ["NOT_FOUND"], status: 404 }]
         */
        statusMap?: { code: C[]; status: number }[];
        /** Global CORS config applied to all methods */
        cors?: CORSOpt;
        /** Global recovery function if any handler throws an error */
        recover?: RecoverFunc<Handler>;
      } & Partial<Record<Method, HandlerOption<Handler>> & Record<AllowedMethod, HandlerOption<Handler>>>
    : never;

// ─── OTHERS ───────────────────────────────────────────────────────────────────

/**
 * CORS config in object form.
 * Used as the return type of CORSFunc or as a direct value in CORSOpt.
 */
export type CORSObjOpt = {
  /** Allow credentials (cookies, Authorization header, etc.) */
  allowCredentials?: boolean;
  /** Allowed `Access-Control-Allow-Origin` value */
  origin?: string;
};

/**
 * All accepted forms of CORS configuration in NectRoute.
 *
 * - `true` → allow all origins
 * - `string` → allow a specific origin
 * - `string[]` → allow a multiple specific origin
 * - `CORSFunc` → dynamic per-request evaluation
 * - `CORSObjOpt` → static object config
 */
export type CORSOpt = boolean | string | CORSFunc | CORSObjOpt | string[];
