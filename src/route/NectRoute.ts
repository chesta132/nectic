import { NextApiRequest, NextApiResponse } from "next";
import { AnyNextRequest, ErrorReplyType, nectRequest, NectRequest, nectResponse, NectResponse, Reply } from "../server";
import { flattenHandlers, setCors } from "./helper";
import {
  AllowedMethod,
  AnyRouterResponse,
  AppRouterHandler,
  AppRouterHandlers,
  FlattenHandlers,
  HandlerOption,
  Handlers,
  PagesRouterHandler,
  PagesRouterHandlers,
  RouteOptions,
  RouteValidated,
  SupportedHandlers,
} from "./types";
import { NextRequest } from "next/server";
import { NectRouteError } from "./error";
import { zodErrorToReplyError } from "../validator/formatZod";
import { omit, record } from "../shared";

export class NectRoute<Method extends AllowedMethod, Handler extends SupportedHandlers, Code extends string = string> {
  private handlers: FlattenHandlers<Handlers<Method, Handler>>;
  private options?: RouteOptions<Handlers<Method, Handler>, Code>;

  constructor(handlers: Handlers<Method, Handler>, options?: RouteOptions<Handlers<Method, Handler>, Code>) {
    this.handlers = flattenHandlers(handlers);
    this.options = options;
  }

  private createReply(req: NectRequest, res: NectResponse) {
    return new Reply({ req, res, debugMode: this.options?.debugMode, statusMap: this.options?.statusMap });
  }

  private createContext(
    req: NectRequest,
    res: NectResponse,
    { handlers, validated, nativeContext }: { handlers: SupportedHandlers[]; validated: RouteValidated; nativeContext?: Record<string, any> },
  ) {
    const reply = this.createReply(req, res);
    let i = 0;
    const next = async () => {
      const handler = handlers[i++] as SupportedHandlers | undefined;
      if (handler) {
        return await Promise.resolve(handler(req as NectRequest & RouteValidated, res as never, { ...nativeContext, next, reply, validated }));
      }
    };

    return { ...nativeContext, reply, next };
  }

  private async dispatch(request: AnyNextRequest, response?: NextApiResponse, nativeContext?: Record<string, any>): Promise<AnyRouterResponse> {
    const req = nectRequest(request);
    const res = response ? nectResponse(response) : nectResponse();
    const reply = this.createReply(req, res); // internal reply

    const method = req.method as AllowedMethod;
    let handlers = this.handlers[method] as Handler[] | undefined;
    let handlerOption = this.options?.[method];
    if (!handlers) {
      handlers = this.handlers["FALLBACK" as Method] as Handler[] | undefined;
      if (!handlerOption) handlerOption = this.options?.FALLBACK;
    }

    try {
      if (!handlers) {
        return reply.error({ code: "NOT_FOUND" as Code, message: `Can not ${req.method} ${req.pathname}` }).fail(404);
      }

      await this.handleCORS(req, res);

      const validated = await this.handleValidator(req, { handlerOption, nativeContext });
      if ("code" in validated) {
        return reply
          .error(omit(validated, ["debug"]) as ErrorReplyType<Code>)
          .debug(validated.debug)
          .fail(400);
      }

      const context = this.createContext(req, res, { handlers, validated, nativeContext });
      return await context.next();
    } catch (err) {
      if (err instanceof NectRouteError) {
        return err.handle(req, res, { debugMode: this.options?.debugMode });
      }
      const { recover } = handlerOption || {};
      if (recover) return recover(err, req, res);
      return reply.error({ code: "SERVER_ERROR" as Code, message: "Unhandled error", information: err }).fail(500);
    }
  }

  private async handleCORS(req: NectRequest, res: NectResponse) {
    const { options } = this;
    if (options?.cors) {
      const { cors } = options;
      const availableMethods = Object.keys(this.handlers);
      switch (typeof cors) {
        case "function":
          const result = await cors(req.headers.origin);
          if (result) setCors(req, res, { availableMethods, ...(result === true ? {} : result) });
          break;
        case "string":
          setCors(req, res, { availableMethods, origin: cors });
          break;
        case "boolean": // true
          setCors(req, res, { availableMethods });
          break;
        case "object":
          setCors(req, res, { availableMethods, ...cors });
          break;
        default:
          break;
      }
    }
  }

  private async handleValidator(
    req: NectRequest,
    { handlerOption, nativeContext }: { handlerOption?: HandlerOption<SupportedHandlers>; nativeContext?: Record<string, any> },
  ) {
    const validated: RouteValidated = { body: undefined, param: {}, query: {} };
    if (handlerOption?.validator) {
      const { body, param, query } = handlerOption.validator;
      if (body) {
        const result = body.safeParse(await req.body());
        if (result.success) {
          validated.body = result.data;
        } else return zodErrorToReplyError(result.error, "body");
      }

      if (param) {
        // app router
        if (nativeContext?.params) {
          const result = param.safeParse(await nativeContext.params);
          if (result.success) {
            validated.param = result.data;
          } else return zodErrorToReplyError(result.error, "param");
        }
        // pages router
        else {
          const result = param.safeParse(req.query);
          if (result.success) {
            validated.param = result.data;
          } else return zodErrorToReplyError(result.error, "param");
        }
      }

      if (query) {
        const result = query.safeParse(req.query);
        if (result.success) {
          validated.query = result.data;
        } else return zodErrorToReplyError(result.error, "query");
      }
    }
    return validated;
  }

  toPagesRouter() {
    return async (req: NextApiRequest, res: NextApiResponse) => {
      return await this.dispatch(req, res);
    };
  }

  toAppRouter() {
    return record(Object.keys(this.handlers) as Method[], async (req: NextRequest, nativeContext: Record<string, any>) => {
      return await this.dispatch(req, undefined, nativeContext);
    });
  }
}

export const createPagesRouter = <M extends AllowedMethod, Code extends string = string>(
  handlers: PagesRouterHandlers,
  options?: RouteOptions<PagesRouterHandlers<M>, Code>,
) => {
  return new NectRoute<M, PagesRouterHandler, Code>(handlers, options).toPagesRouter();
};

export const createAppRouter = <M extends AllowedMethod, Code extends string = string>(
  handlers: AppRouterHandlers,
  options?: RouteOptions<AppRouterHandlers<M>, Code>,
) => {
  return new NectRoute<M, AppRouterHandler, Code>(handlers, options).toAppRouter();
};
