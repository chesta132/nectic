import { pick } from "../../shared";
import type { SerializeOptions } from "cookie";
import type { NectRequest } from "../NectRequest";
import type { NectResponse, NectSendResult } from "../NectResponse";
import type { ReplyEnvelope, ErrorReplyType, PaginationOption, Cookie, ReplyOption } from "./types";
import { NectError } from "../../error";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const defaultPayload = <T>(): ReplyEnvelope<T> => ({
  data: { code: "SERVER_ERROR", message: "Payload is empty." } as T,
  meta: { status: "ERROR" },
});

// ─── Reply ───────────────────────────────────────────────────────────────────

/**
 * Chainable response builder that works across both Pages and App router.
 *
 * `Reply` knows nothing about which router is running — all routing abstraction
 * is handled by `NectRequest` and `NectResponse`. `Reply` only deals with
 * shaping the payload and delegating send/cookie/header operations to `NectResponse`.
 *
 * @example
 * ```ts
 * // Pages Router
 * export default function handler(req: NextApiRequest, res: NextApiResponse) {
 *   const reply = new Reply({ req: nectRequest(req), res: nectResponse(res) })
 *   return reply.success({ userId: 1 }).ok()
 * }
 *
 * // App Router
 * export async function GET(req: NextRequest) {
 *   const reply = new Reply({ req: nectRequest(req), res: nectResponse() })
 *   return reply.success({ userId: 1 }).ok()
 * }
 * ```
 */
export class Reply<SuccessType = unknown, Code extends string = string> {
  private payload: ReplyEnvelope<typeof this.data | typeof this.errorData, boolean> = defaultPayload();

  private req: NectRequest;
  private res: NectResponse;
  private opt: Omit<ReplyOption<Code>, "req" | "res">;

  private data?: SuccessType;
  private errorData?: ErrorReplyType<Code>;
  private debugValue: any[] = [];

  constructor({ req, res, ...opt }: ReplyOption<Code>) {
    this.req = req;
    this.res = res;
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

  // ── Payload builders ──────────────────────────────────────────────────────

  /**
   * Set the response body as a success payload.
   *
   * @example
   * ```ts
   * reply.success({ userId: 123 }).ok()
   * ```
   */
  success<T extends SuccessType>(data: T) {
    this.data = data;
    return this as unknown as Reply<SuccessType, Code>;
  }

  /**
   * Set the response body as an error payload.
   *
   * @example
   * ```ts
   * reply.error({ code: "NOT_FOUND", message: "User not found" }).fail()
   * ```
   */
  error(data: ErrorReplyType<Code>) {
    this.errorData = data;
    return this;
  }

  /**
   * Attach an information message to the response metadata.
   *
   * @example
   * ```ts
   * reply.info("Profile updated").success(user).ok()
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
   * reply.success(users).paginate({ limit: 10, offset: 0 }).ok()
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
   * reply.debug(error).error(formattedError).fail()
   * ```
   */
  debug(...messages: any[]) {
    this.debugValue.push(...messages);
    return this;
  }

  // ── Cookie / Header passthrough ───────────────────────────────────────────

  /**
   * Set one or multiple cookies via `NectResponse`.
   *
   * @example
   * ```ts
   * reply.setCookies("token", value, { httpOnly: true }).success(user).ok()
   * reply.setCookies({ accessToken: { value, httpOnly: true } }).success(user).ok()
   * ```
   */
  setCookies(cookies: Cookie): this;
  setCookies(key: string, value: string, options?: Partial<SerializeOptions>): this;
  setCookies(keyOrCookies: string | Cookie, value?: string, options?: Partial<SerializeOptions>) {
    if (typeof keyOrCookies === "string") {
      this.res.setCookie(keyOrCookies, value!, options);
    } else {
      for (const key in keyOrCookies) {
        const { value, ...opts } = keyOrCookies[key];
        this.res.setCookie(key, value, opts);
        this.req.url;
      }
    }
    return this;
  }

  /**
   * Delete one or more cookies via `NectResponse`.
   *
   * @example
   * ```ts
   * reply.success(user).deleteCookies("accessToken", "refreshToken").ok()
   * ```
   */
  deleteCookies(...names: string[]) {
    names.forEach((name) => this.res.deleteCookie(name));
    return this;
  }

  /**
   * Set a response header or multiple headers via `NectResponse`.
   *
   * @example
   * ```ts
   * reply.setHeader("Allow", "GET, POST").error(err).fail()
   * reply.setHeader(new Headers({ "X-Custom": "value" })).success(data).ok()
   * ```
   */
  setHeader(name: string, value: string): this;
  setHeader(headers: Headers): this;
  setHeader(headerOrName: string | Headers, value?: string) {
    if (headerOrName instanceof Headers) {
      headerOrName.forEach((val, key) => this.res.setHeader(key, val));
    } else {
      this.res.setHeader(headerOrName, value!);
    }
    return this;
  }

  // ── Send methods ──────────────────────────────────────────────────────────

  /**
   * Redirect the client to a specified URL.
   *
   * @example
   * ```ts
   * return reply.redirect("/login")
   * ```
   */
  redirect(url: string, status?: number): NectSendResult {
    return this.res.redirect(url, status);
  }

  /**
   * Send a stream response.
   *
   * @example
   * ```ts
   * const stream = new ReadableStream({ ... })
   * return reply.stream(stream, { contentType: "text/event-stream" })
   * ```
   */
  stream(data: ReadableStream, { contentType = "application/octet-stream" } = {}) {
    this.res.setHeader("Content-Type", contentType);
    this.res.setHeader("Connection", "keep-alive");
    this.res.setHeader("Cache-Control", "no-cache");
    const result = this.res.send(200, data as unknown as BodyInit, contentType);
    this._reset();
    return result;
  }

  /**
   * Smart send — sends success if `.success()` was called, error if `.error()` was called.
   *
   * @example
   * ```ts
   * reply.info("Updated").success(user).respond()
   * reply.error(err).respond()
   * ```
   */
  respond(): NectSendResult {
    if (this.data !== undefined) return this.ok();
    if (this.errorData !== undefined) return this.fail();
  }

  /**
   * Send a success JSON response.
   *
   * @example
   * ```ts
   * return reply.success(null).send(202)
   * ```
   */
  send(httpStatus: number): NectSendResult {
    this._finalize(true);
    const result = this.res.json(httpStatus, this.payload as any);
    this._reset();
    return result;
  }

  /**
   * Send a `200 OK` JSON response.
   *
   * @example
   * ```ts
   * return reply.success(user).ok()
   * ```
   */
  ok(): NectSendResult {
    this._finalize(true);
    const result = this.res.json(200, this.payload as any);
    this._reset();
    return result;
  }

  /**
   * Send a `201 Created` JSON response.
   *
   * @example
   * ```ts
   * return reply.success(newUser).created()
   * ```
   */
  created(): NectSendResult {
    this._finalize(true);
    const result = this.res.json(201, this.payload as any);
    this._reset();
    return result;
  }

  /**
   * Send a `204 No Content` response.
   *
   * @example
   * ```ts
   * return reply.noContent()
   * ```
   */
  noContent(): NectSendResult {
    const result = this.res.noContent();
    this._reset();
    return result;
  }

  /**
   * Send an error response. HTTP status is resolved from `statusMap` or defaults to `500`.
   *
   * @example
   * ```ts
   * return reply.error({ code: "INVALID_AUTH", message: "Invalid token" }).fail()
   * return reply.error({ code: "NOT_FOUND", message: "User not found" }).fail(404)
   * ```
   */
  fail(httpStatus?: number): NectSendResult {
    const errorBody = this.errorData;
    if (!errorBody) throw new NectError("Cannot call .fail() — no error set. Call .error() first.");
    this._finalize(false);

    const status = httpStatus ?? this.opt.statusMap?.find((s) => s.code.includes(errorBody.code))?.status ?? 500;

    const result = this.res.json(status, this.payload as any);
    this._reset();
    return result;
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create a `Reply` instance.
 *
 * @example
 * ```ts
 * // Pages Router
 * const reply = createReply({ req: nectRequest(req), res: nectResponse(res) })
 *
 * // App Router
 * const reply = createReply({ req: nectRequest(req), res: nectResponse() })
 * ```
 */
export function createReply<SuccessType = unknown, Code extends string = string>(opt: ReplyOption<Code>): Reply<SuccessType, Code> {
  return new Reply<SuccessType, Code>(opt);
}
