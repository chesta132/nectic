import { NectRequest, NectResponse } from "../server";
import { AllowedMethod, CORSObjOpt, FlattenHandlers, Handlers, SupportedHandlers } from "./types";

export const flattenHandlers = <Method extends AllowedMethod, Handler extends SupportedHandlers>(
  handlers: Handlers<Method, Handler>,
): FlattenHandlers<Handlers<Method, Handler>> => {
  const result: any = {};
  for (const method in handlers) {
    const handler = handlers[method as keyof typeof handlers];
    result[method] = Array.isArray(handler) ? handler : [handler];
  }
  return result;
};

export const setCors = (
  req: NectRequest,
  res: NectResponse,
  { availableMethods, allowCredentials = false, origin }: { availableMethods: string[] } & CORSObjOpt,
) => {
  const headers = {
    "Access-Control-Allow-Origin": origin || req.headers.origin || "*",
    "Access-Control-Allow-Methods": availableMethods.join(", "),
    "Access-Control-Allow-Headers": req.nextUrl.origin,
    "Access-Control-Allow-Credentials": String(allowCredentials),
  };

  res.setHeaders(headers);
};
