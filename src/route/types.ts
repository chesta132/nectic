import { NextResponse } from "next/server";
import { NectRequest, NectResponse, NectSendResult, Reply } from "../server";
import { ZodObject, ZodType } from "zod";

// METHOD
export type BasicMethod = "GET" | "HEAD" | "POST" | "PUT" | "DELETE" | "OPTIONS" | "TRACE" | "PATCH";
export type AllowedMethod = Uppercase<string & {}>;

// BRANDS
declare const __ParamBrand: unique symbol;
declare const __QueryBrand: unique symbol;

// FUNCS
export type RecoverFunc<Handler extends SupportedHandlers> = (
  err: unknown,
  req: RouteRequest,
  res: RouteResponse,
) => Handler extends AppRouterHandler ? AppRouterResponse | Promise<AppRouterResponse> : PageRouterResponse | Promise<PageRouterResponse>;
export type CORSFunc = (origin: string) => boolean | CORSObjOpt | Promise<CORSObjOpt | boolean>;
export type NextResult = PromiseOrValue<void>;
export type NextFunc = () => NextResult;

// ROUTE REQUEST & ROUTE RESPONSE
export type RouteRequest<
  TBody = unknown,
  TParam extends Record<string, any> = Record<string, any>,
  TQuery extends Record<string, any> = Record<string, any>,
> = NectRequest<TBody> & {
  readonly [__ParamBrand]?: TParam;
  readonly [__QueryBrand]?: TQuery;
};
export type RouteResponse<TBody = unknown> = NectResponse<TBody>;

// ROUTE VALIDATED
export type RouteValidated<
  TBody = unknown,
  TParam extends Record<string, any> = Record<string, any>,
  TQuery extends Record<string, any> = Record<string, any>,
> = {
  body: TBody;
  param: TParam;
  query: TQuery;
};

// CONTEXT
export type RouteContext<
  NativeContext extends Record<string, any> = {},
  R extends Reply = Reply,
  Validated extends RouteValidated = RouteValidated,
> = NativeContext & {
  next: () => void | Promise<void>;
  reply: R;
  validated: Validated;
};

// APP ROUTER
export type AppRouterResponse = NectSendResult | NextResponse | Response | NextResult;
export type AppRouterContext<Param extends Record<string, string | string[]> = Record<string, string | string[]>> = {
  // awaited in Route
  params?: Param;
};
export type AppRouterHandler<Req extends RouteRequest = RouteRequest, Res extends RouteResponse = RouteResponse, Code extends string = string> = (
  req: Req extends RouteRequest<infer TBody> ? NectRequest<TBody> : never,
  res: Res extends RouteResponse<infer TBody> ? NectResponse<TBody> : never,
  context: Req extends RouteRequest<infer ReqBody, infer ReqParam, infer ReqQuery>
    ? Res extends RouteResponse<infer ResBody>
      ? RouteContext<AppRouterContext<ReqParam>, Reply<ResBody, Code>, RouteValidated<ReqBody, ReqParam, ReqQuery>>
      : never
    : never,
) => Promise<AppRouterResponse> | AppRouterResponse;

// PAGES ROUTER
export type PageRouterResponse = NectSendResult | void | NextResult;
export type PagesRouterHandler<Req extends RouteRequest = RouteRequest, Res extends RouteResponse = RouteResponse, Code extends string = string> = (
  req: Req extends RouteRequest<infer TBody> ? NectRequest<TBody> : never,
  res: Res extends RouteResponse<infer TBody> ? NectResponse<TBody> : never,
  context: Req extends RouteRequest<infer ReqBody, infer ReqParam, infer ReqQuery>
    ? Res extends RouteResponse<infer ResBody>
      ? RouteContext<{}, Reply<ResBody, Code>, RouteValidated<ReqBody, ReqParam, ReqQuery>>
      : never
    : never,
) => Promise<PageRouterResponse> | PageRouterResponse;

// SHARED
export type AnyRouterResponse = AppRouterResponse | PageRouterResponse;
export type SupportedHandlers = AppRouterHandler<any, any, any> | PagesRouterHandler<any, any, any>;

// HANDLERS
export type Handlers<Method extends AllowedMethod, Handler extends SupportedHandlers> = Partial<Record<
  Method | "FALLBACK",
  AppRouterHandler<any, any, any> | AppRouterHandler<any, any, any>[] | PagesRouterHandler<any, any, any> | PagesRouterHandler<any, any, any>[]
>> // TODO: makes more strict to accept app router handler if one of them is app router handler, accpet pages router handler if none of them is app router handler
export type FlattenHandlers<H extends Handlers<any, any>> =
  H extends Handlers<infer Method, infer Handler> ? Partial<Record<Method | "FALLBACK", Handler[]>> : never;

// OPTIONS
export type HandlerValidatorOption = {
  body?: ZodType;
  param?: ZodObject;
  query?: ZodObject;
};
export type HandlerOption<Handler extends SupportedHandlers> = {
  validator?: HandlerValidatorOption;
  cors?: CORSOpt;
  recover?: RecoverFunc<Handler>;
};
export type RouteOptions<H extends Handlers<any, any>, C extends string> =
  H extends Handlers<infer Method, infer Handler>
    ? {
        debugMode?: boolean;
        statusMap?: { code: C[]; status: number }[];
        cors?: CORSOpt;
        recover?: RecoverFunc<Handler>;
      } & Record<AllowedMethod | Method, HandlerOption<Handler>>
    : never;

// OTHERS
export type CORSObjOpt = {
  allowCredentials?: boolean;
  origin?: string;
};
export type CORSOpt = boolean | string | CORSFunc | CORSObjOpt;
