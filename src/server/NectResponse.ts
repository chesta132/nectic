import type { NextApiResponse } from "next";
import { NextResponse } from "next/server";
import { serialize, type SerializeOptions } from "cookie";

// ─── Types ───────────────────────────────────────────────────────────────────

export type AnyNextResponse = NextApiResponse | NextResponse;

export type NectResponseSource = "pages" | "app";

export type NectCookieOptions = SerializeOptions;

/**
 * The result of a `NectResponse` send operation.
 *
 * - Pages router: `void` — response is sent imperatively via `NextApiResponse`
 * - App router: `NextResponse` — must be returned from the route handler
 */
export type NectSendResult = NextResponse | void;

// ─── Guards ──────────────────────────────────────────────────────────────────

function isNextApiResponse(res: AnyNextResponse): res is NextApiResponse {
  // NextApiResponse has `setHeader` from Node's http.ServerResponse
  return typeof (res as NextApiResponse).setHeader === "function";
}

// ─── Pending cookie store (app router only) ──────────────────────────────────

interface PendingCookie {
  name: string;
  value: string;
  options?: NectCookieOptions;
}

interface PendingDeleteCookie {
  name: string;
}

// ─── NectResponse ────────────────────────────────────────────────────────────

/**
 * Unified response wrapper for both Pages Router (`NextApiResponse`)
 * and App Router (`NextResponse`).
 *
 * ## Pages Router
 * `NectResponse` wraps the existing `res` object and calls methods on it
 * imperatively — same as you normally would.
 *
 * ## App Router
 * `NectResponse` **builds** a `NextResponse` internally. Call `.send()`,
 * `.json()`, `.text()`, or `.redirect()` — each returns the `NextResponse`
 * you must `return` from your route handler.
 *
 * @example
 * ```ts
 * // Pages Router
 * export default function handler(req: NextApiRequest, res: NextApiResponse) {
 *   const nRes = nectResponse(res)
 *   nRes.setCookie('token', 'abc', { httpOnly: true })
 *   nRes.json(200, { ok: true })
 * }
 *
 * // App Router
 * export async function GET(req: NextRequest) {
 *   const nRes = nectResponse()
 *   nRes.setCookie('token', 'abc', { httpOnly: true })
 *   return nRes.json(200, { ok: true })
 * }
 * ```
 */
export class NectResponse<TBody = unknown> {
  private _raw: NextApiResponse | null;
  private _source: NectResponseSource;

  // App router state
  private _pendingHeaders: Record<string, string> = {};
  private _pendingCookies: PendingCookie[] = [];
  private _pendingDeleteCookies: PendingDeleteCookie[] = [];

  constructor(res?: NextApiResponse) {
    if (res && isNextApiResponse(res)) {
      this._raw = res;
      this._source = "pages";
    } else {
      this._raw = null;
      this._source = "app";
    }
  }

  // ── Meta ──────────────────────────────────────────────────────────────────

  get source(): NectResponseSource {
    return this._source;
  }

  /**
   * Raw `NextApiResponse`. Only available on pages router.
   * Throws if called on app router.
   */
  get raw(): NextApiResponse {
    if (!this._raw) {
      throw new Error("[NectResponse] .raw is only available on the pages router.");
    }
    return this._raw;
  }

  // ── Headers ───────────────────────────────────────────────────────────────

  /**
   * Set a response header.
   *
   * - Pages: calls `res.setHeader()` immediately
   * - App: queued, applied when `.json()` / `.text()` / `.send()` is called
   */
  setHeader(name: string, value: string): this {
    if (this._source === "pages") {
      this._raw!.setHeader(name, value);
    } else {
      this._pendingHeaders[name] = value;
    }
    return this;
  }

  /**
   * Set multiple headers at once.
   */
  setHeaders(headers: Record<string, string>): this {
    for (const [key, val] of Object.entries(headers)) {
      this.setHeader(key, val);
    }
    return this;
  }

  // ── Status (pages only helper) ────────────────────────────────────────────

  /**
   * Set status code — pages only, returns `this` for chaining.
   * On app router this is a no-op (status is passed directly to send methods).
   *
   * Prefer passing `status` directly to `.json()` / `.text()` / `.send()`.
   */
  status(code: number): this {
    if (this._source === "pages") {
      this._raw!.status(code);
    }
    return this;
  }

  // ── Cookies ───────────────────────────────────────────────────────────────

  /**
   * Set a cookie on the response.
   *
   * - Pages: serializes via `cookie` package → `res.setHeader('Set-Cookie', ...)`
   *   Appends to existing `Set-Cookie` headers instead of overwriting.
   * - App: queued, applied when a send method is called via `NextResponse.cookies.set()`
   */
  setCookie(name: string, value: string, options?: NectCookieOptions): this {
    if (this._source === "pages") {
      const serialized = serialize(name, value, options);
      const existing = this._raw!.getHeader("Set-Cookie");
      const cookies: string[] = existing ? (Array.isArray(existing) ? (existing as string[]) : [existing as string]) : [];
      this._raw!.setHeader("Set-Cookie", [...cookies, serialized]);
    } else {
      this._pendingCookies.push({ name, value, options });
    }
    return this;
  }

  /**
   * Delete a cookie by setting `Max-Age=0`.
   *
   * - Pages: immediately sets `Set-Cookie` header with expired value
   * - App: queued, applied when a send method is called
   */
  deleteCookie(name: string, options?: Pick<NectCookieOptions, "path" | "domain">): this {
    return this.setCookie(name, "", {
      ...options,
      maxAge: 0,
      expires: new Date(0),
    });
  }

  // ── Internal: apply pending state to a NextResponse ──────────────────────

  private _applyToNextResponse(res: NextResponse): NextResponse {
    for (const [key, val] of Object.entries(this._pendingHeaders)) {
      res.headers.set(key, val);
    }
    for (const { name, value, options } of this._pendingCookies) {
      res.cookies.set(name, value, options);
    }
    for (const { name } of this._pendingDeleteCookies) {
      res.cookies.delete(name);
    }
    return res;
  }

  // ── Send methods ──────────────────────────────────────────────────────────

  /**
   * Send a JSON response.
   *
   * - Pages: calls `res.status(status).json(data)` → returns `void`
   * - App: returns a `NextResponse` — **must be returned** from your route handler
   */
  json(status: number, data: TBody): NectSendResult {
    if (this._source === "pages") {
      this._raw!.status(status).json(data);
      return;
    }
    const res = NextResponse.json(data, {
      status,
      headers: this._pendingHeaders,
    });
    return this._applyToNextResponse(res);
  }

  /**
   * Send a plain text response.
   *
   * - Pages: sets `Content-Type: text/plain` then calls `res.status(status).send(body)`
   * - App: returns a `NextResponse` — **must be returned** from your route handler
   */
  text(status: number, body: string): NectSendResult {
    if (this._source === "pages") {
      this._raw!.setHeader("Content-Type", "text/plain; charset=utf-8");
      this._raw!.status(status).send(body);
      return;
    }
    const res = new NextResponse(body, {
      status,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        ...this._pendingHeaders,
      },
    });
    return this._applyToNextResponse(res);
  }

  /**
   * Send a raw body response with optional content type.
   *
   * - Pages: calls `res.status(status).send(body)`
   * - App: returns a `NextResponse` — **must be returned** from your route handler
   */
  send(status: number, body: BodyInit | null, contentType?: string): NectSendResult {
    if (this._source === "pages") {
      if (contentType) this._raw!.setHeader("Content-Type", contentType);
      this._raw!.status(status).send(body);
      return;
    }
    const res = new NextResponse(body, {
      status,
      headers: {
        ...(contentType ? { "Content-Type": contentType } : {}),
        ...this._pendingHeaders,
      },
    });
    return this._applyToNextResponse(res);
  }

  /**
   * Send an empty `204 No Content` response.
   *
   * - Pages: calls `res.status(204).end()`
   * - App: returns a `NextResponse` — **must be returned** from your route handler
   */
  noContent(): NectSendResult {
    if (this._source === "pages") {
      this._raw!.status(204).end();
      return;
    }
    const res = new NextResponse(null, {
      status: 204,
      headers: this._pendingHeaders,
    });
    return this._applyToNextResponse(res);
  }

  /**
   * Redirect to a URL.
   *
   * - Pages: calls `res.redirect(status, url)` — defaults to `307`
   * - App: returns `NextResponse.redirect(url, status)` — **must be returned**
   */
  redirect(url: string, status: number = 307): NectSendResult {
    if (this._source === "pages") {
      this._raw!.redirect(status, url);
      return;
    }
    const res = NextResponse.redirect(url, { status });
    return this._applyToNextResponse(res);
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create a `NectResponse` for the **Pages Router**.
 * Pass in the `NextApiResponse` received from the handler.
 *
 * @example
 * ```ts
 * export default function handler(req: NextApiRequest, res: NextApiResponse) {
 *   const nRes = nectResponse(res)
 *   return nRes.ok({ message: 'hello' })
 * }
 * ```
 */
export function nectResponse<TBody = unknown>(res: NextApiResponse): NectResponse<TBody>;

/**
 * Create a `NectResponse` for the **App Router**.
 * Call a send method and `return` the result from your route handler.
 *
 * @example
 * ```ts
 * export async function GET() {
 *   const nRes = nectResponse<{ message: string }>()
 *   return nRes.ok({ message: 'hello' })
 * }
 * ```
 */
export function nectResponse<TBody = unknown>(): NectResponse<TBody>;

export function nectResponse<TBody = unknown>(res?: NextApiResponse): NectResponse<TBody> {
  return new NectResponse<TBody>(res);
}
