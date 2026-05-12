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
  MergedOptions,
  PagesRouterHandler,
  PagesRouterHandlers,
  RouteOptions,
  RouteValidated,
  SupportedHandlers,
} from "./types";
import { NextRequest } from "next/server";
import { zodErrorToReplyError } from "../validator/formatZod";
import { omit, record } from "../shared";
import { NectError } from "../error";

/** @internal Not exported. Use {@link createAppRouter} or {@link createPagesRouter} instead. */
export class NectRoute<Method extends AllowedMethod, Handler extends SupportedHandlers, Code extends string = string> {
  /** Handlers normalized to arrays per HTTP method */
  private handlers: FlattenHandlers<Handlers<Method, Handler>>;

  /** Global route options (debug, statusMap, cors, recover, etc.) */
  private options?: RouteOptions<Handlers<Method, Handler>, Code>;

  /**
   * Creates a new NectRoute instance.
   *
   * @param handlers - Map from HTTP method to a handler or array of handlers
   * @param options - Global route options (optional)
   */
  constructor(handlers: Handlers<Method, Handler>, options?: RouteOptions<Handlers<Method, Handler>, Code>) {
    this.handlers = flattenHandlers(handlers);
    this.options = options;
  }

  /**
   * Creates a new Reply object for a single request/response cycle.
   *
   * @param req - NectRequest object
   * @param res - NectResponse object
   * @returns A Reply instance ready to build a response
   */
  private createReply(req: NectRequest, res: NectResponse) {
    return new Reply({ req, res, debugMode: this.options?.debugMode, statusMap: this.options?.statusMap });
  }

  /**
   * Creates the context object and handler chain for a single request.
   * The context includes `next()`, `reply`, and `validated` data.
   * Calling `next()` executes the next handler in the chain.
   *
   * @param req - NectRequest object
   * @param res - NectResponse object
   * @param options.handlers - Array of handlers to be executed in order
   * @param options.validated - Validated request data (body, param, query)
   * @param options.nativeContext - Native framework context (e.g. App Router params)
   * @returns Context object containing `reply` and `next`
   */
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

  /**
   * Core dispatcher that processes a single HTTP request end-to-end.
   *
   * Execution order:
   * 1. Wrap raw request/response into NectRequest & NectResponse
   * 2. Resolve the matching handler(s) by HTTP method (falls back to FALLBACK if needed)
   * 3. Handle CORS
   * 4. Validate request (body, param, query) via Zod
   * 5. Execute the handler chain
   * 6. Catch and handle any errors
   *
   * @param request - Raw request (NextRequest or NextApiRequest)
   * @param response - Response object for Pages Router (omit for App Router)
   * @param nativeContext - Native framework context (e.g. `{ params }` from App Router)
   * @returns The final processed response
   */
  private async dispatch(request: AnyNextRequest, response?: NextApiResponse, nativeContext?: Record<string, any>): Promise<AnyRouterResponse> {
    const req = nectRequest(request);
    const res = response ? nectResponse(response) : nectResponse();
    const reply = this.createReply(req, res); // internal reply

    const method = req.method as AllowedMethod;
    let handlers = this.handlers[method] as Handler[] | undefined;
    let handlerOptions = this.options?.[method];
    if (!handlers) {
      handlers = this.handlers["FALLBACK" as Method] as Handler[] | undefined;
      if (!handlerOptions) handlerOptions = this.options?.FALLBACK;
    }
    const options: MergedOptions = { ...this.options, ...handlerOptions };

    try {
      if (!handlers) {
        return reply.error({ code: "NOT_FOUND" as Code, message: `Can not ${req.method} ${req.pathname}` }).fail(404);
      }

      await this.handleCORS(req, res);

      const validated = await this.handleValidator(req, { handlerOptions, nativeContext });
      if ("code" in validated) {
        return reply
          .error(omit(validated, ["debug"]) as ErrorReplyType<Code>)
          .debug(validated.debug)
          .fail(400);
      }

      const context = this.createContext(req, res, { handlers, validated, nativeContext });
      return await context.next();
    } catch (err) {
      const { recover } = options;
      if (recover) return recover(err, req, res);
      if (err instanceof NectError) {
        return reply.error({ code: "UNHANDLED_ERROR" as Code, message: err.message, information: err.cause && omit(err.cause, ["stack"]) }).fail(500);
      }
      return reply.error({ code: "UNHANDLED_ERROR" as Code, message: "Unhandled error", information: err }).fail(500);
    }
  }

  /**
   * Handles CORS for incoming requests.
   * Reads the `cors` config from options and sets the appropriate response headers.
   *
   * Supports four modes:
   * - `function` → dynamic per-request evaluation
   * - `string` → static origin value
   * - `boolean` (true) → allow all origins
   * - `object` → static config object
   *
   * @param req - NectRequest object
   * @param res - NectResponse object
   */
  private async handleCORS(req: NectRequest, res: NectResponse) {
    const { options } = this;
    if (options?.cors) {
      const { cors } = options;
      const availableMethods = Object.keys(this.handlers);
      switch (typeof cors) {
        case "function":
          const result = await cors(req.headers.origin);
          if (result) setCors(req, res, { availableMethods, ...(result === true ? {} : result) });
          else setCors(req, res, { availableMethods, origin: "null" });
          break;
        case "string":
          setCors(req, res, { availableMethods, origin: cors });
          break;
        case "boolean": // true
          setCors(req, res, { availableMethods });
          break;
        case "object":
          if (Array.isArray(cors)) {
            setCors(req, res, { availableMethods, origin: cors.join(", ") });
          } else {
            setCors(req, res, { availableMethods, ...cors });
          }
          break;
        default:
          break;
      }
    }
  }

  /**
   * Runs request validation using the Zod schemas configured in `handlerOptions.validator`.
   * Validates body, param, and query independently.
   *
   * Param source differs by router type:
   * - App Router → read from `nativeContext.params`
   * - Pages Router → read from `req.query`
   *
   * @param req - NectRequest object
   * @param options.handlerOptions - Handler options containing the validator config
   * @param options.nativeContext - Native framework context (used to distinguish App vs Pages Router)
   * @returns A `RouteValidated` object if all fields pass, or an error object if any fail
   */
  private async handleValidator(
    req: NectRequest,
    { handlerOptions, nativeContext }: { handlerOptions?: HandlerOption<SupportedHandlers>; nativeContext?: Record<string, any> },
  ) {
    const validated: RouteValidated = { body: undefined, param: {}, query: {} };
    if (handlerOptions?.validator) {
      const { body, param, query } = handlerOptions.validator;
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

  /**
   * Converts this NectRoute into a Next.js Pages Router handler.
   * The return value can be used directly as a default export in `pages/api/`.
   *
   * @returns A Pages Router handler function `(req, res) => Promise<void>`
   *
   * @example
   * // pages/api/user.ts
   * export default createPagesRouter({ GET: handler }).toPagesRouter();
   */
  toPagesRouter() {
    return async (req: NextApiRequest, res: NextApiResponse) => {
      return await this.dispatch(req, res);
    };
  }

  /**
   * Converts this NectRoute into named exports for the Next.js App Router.
   * Each method (GET, POST, etc.) becomes a separate named export.
   *
   * @returns An object keyed by HTTP method, ready to be spread as named exports
   *
   * @example
   * // app/api/user/route.ts
   * export const { GET, POST } = createAppRouter({ GET: handler, POST: handler });
   */
  toAppRouter() {
    return record(Object.keys(this.handlers) as Method[], async (req: NextRequest, nativeContext: Record<string, any>) => {
      return await this.dispatch(req, undefined, nativeContext);
    });
  }
}

/**
 * Creates a route handler for Next.js **Pages Router** (`pages/api/`).
 *
 * The returned function is the default export for your API route file.
 * It supports handler chains (middleware), Zod validation, CORS, and error recovery.
 *
 * **Handler chain** — pass an array of handlers per method to compose middleware:
 * ```ts
 * createPagesRouter({
 *   POST: [authMiddleware, handler],
 * });
 * ```
 *
 * **Validation** — declare Zod schemas per method via `options`:
 * ```ts
 * createPagesRouter({ POST: handler }, {
 *   POST: {
 *     validator: {
 *       body: z.object({ name: z.string() }),
 *       query: z.object({ page: z.coerce.number() }),
 *     },
 *   },
 * });
 * ```
 *
 * **CORS** — enable globally or per method:
 * ```ts
 * createPagesRouter({ GET: handler }, { cors: true });
 * createPagesRouter({ GET: handler }, { cors: "https://example.com" });
 * createPagesRouter({ GET: handler }, { cors: (origin) => origin.endsWith(".example.com") });
 * ```
 *
 * **Error recovery** — catch unhandled errors globally or per method:
 * ```ts
 * createPagesRouter({ GET: handler }, {
 *   recover: (err, req, res) => new Reply({ req, res }).error({ code: "SERVER_ERROR" }).fail(500),
 * });
 * ```
 *
 * @template M - HTTP methods declared in the handlers map
 * @template Code - Union string of custom status codes used in `statusMap`
 * @param handlers - Map from HTTP method to a handler or array of handlers. Use `FALLBACK` to catch unmatched methods.
 * @param options - Global route options: `debugMode`, `statusMap`, `cors`, `recover`, and per-method overrides
 * @returns A Pages Router handler `(req, res) => Promise<void>` ready for use as a default export
 *
 * @example
 * // pages/api/user.ts
 * export default createPagesRouter({
 *   GET: async (req, res, ctx) => {
 *     return ctx.reply.success({ data: "hello" }).send(200);
 *   },
 *   POST: async (req, res, ctx) => {
 *     return ctx.reply.success({ data: ctx.validated.body }).send(201);
 *   },
 * });
 */
export const createPagesRouter = <M extends AllowedMethod, Code extends string = string>(
  handlers: PagesRouterHandlers,
  options?: RouteOptions<PagesRouterHandlers<M>, Code>,
) => {
  return new NectRoute<M, PagesRouterHandler, Code>(handlers, options).toPagesRouter();
};

/**
 * Creates route handlers for Next.js **App Router** (`app/api/[...]/route.ts`).
 *
 * The returned object contains named exports (GET, POST, etc.) that Next.js
 * picks up automatically. It supports handler chains (middleware), Zod validation,
 * CORS, and error recovery.
 *
 * **Handler chain** — pass an array of handlers per method to compose middleware:
 * ```ts
 * createAppRouter({
 *   POST: [authMiddleware, handler],
 * });
 * ```
 *
 * **Validation** — declare Zod schemas per method via `options`:
 * ```ts
 * createAppRouter({ POST: handler }, {
 *   POST: {
 *     validator: {
 *       body: z.object({ name: z.string() }),
 *       param: z.object({ id: z.string() }),
 *       query: z.object({ page: z.coerce.number() }),
 *     },
 *   },
 * });
 * ```
 *
 * **CORS** — enable globally or per method:
 * ```ts
 * createAppRouter({ GET: handler }, { cors: true });
 * createAppRouter({ GET: handler }, { cors: "https://example.com" });
 * createAppRouter({ GET: handler }, { cors: (origin) => origin.endsWith(".example.com") });
 * ```
 *
 * **Error recovery** — catch unhandled errors globally or per method:
 * ```ts
 * createAppRouter({ GET: handler }, {
 *   recover: (err, req, res) => new Reply({ req, res }).error({ code: "SERVER_ERROR" }).fail(500),
 * });
 * ```
 *
 * @template M - HTTP methods declared in the handlers map
 * @template Code - Union string of custom status codes used in `statusMap`
 * @param handlers - Map from HTTP method to a handler or array of handlers. Use `FALLBACK` to catch unmatched methods.
 * @param options - Global route options: `debugMode`, `statusMap`, `cors`, `recover`, and per-method overrides
 * @returns An object with named exports per HTTP method, ready to be spread in an App Router route file
 *
 * @example
 * // app/api/user/route.ts
 * export const { GET, POST } = createAppRouter({
 *   GET: async (req, res, ctx) => {
 *     return ctx.reply.success({ data: "hello" }).send(200);
 *   },
 *   POST: async (req, res, ctx) => {
 *     return ctx.reply.success({ data: ctx.validated.body }).send(201);
 *   },
 * });
 */
export const createAppRouter = <M extends AllowedMethod, Code extends string = string>(
  handlers: AppRouterHandlers,
  options?: RouteOptions<AppRouterHandlers<M>, Code>,
) => {
  return new NectRoute<M, AppRouterHandler, Code>(handlers, options).toAppRouter();
};
