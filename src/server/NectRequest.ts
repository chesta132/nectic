import type { NextApiRequest } from "next";
import type { NextRequest } from "next/server";

// ─── Types ───────────────────────────────────────────────────────────────────

export type AnyNextRequest = NextApiRequest | NextRequest;

export type NectRequestSource = "pages" | "app";

export interface NectCookie {
  name: string;
  value: string;
}

// ─── Guards ──────────────────────────────────────────────────────────────────

function isNextApiRequest(req: AnyNextRequest): req is NextApiRequest {
  return typeof (req as NextApiRequest).socket !== "undefined";
}

function isNextRequest(req: AnyNextRequest): req is NextRequest {
  return typeof (req as NextRequest).nextUrl !== "undefined";
}

// ─── NectRequest ─────────────────────────────────────────────────────────────

export class NectRequest<TBody = unknown> {
  private _raw: AnyNextRequest;
  private _source: NectRequestSource;

  constructor(req: AnyNextRequest) {
    this._raw = req;

    if (isNextApiRequest(req)) {
      this._source = "pages";
    } else if (isNextRequest(req)) {
      this._source = "app";
    } else {
      throw new Error("[NectRequest] Unrecognized request type. Must be NextApiRequest or NextRequest.");
    }
  }

  // ── Meta ──────────────────────────────────────────────────────────────────

  /** Where this request originated from: `"pages"` or `"app"` router */
  get source(): NectRequestSource {
    return this._source;
  }

  /** Raw underlying request object */
  get raw(): AnyNextRequest {
    return this._raw;
  }

  // ── Method ────────────────────────────────────────────────────────────────

  get method(): string {
    if (isNextApiRequest(this._raw)) {
      return (this._raw.method ?? "GET").toUpperCase();
    }
    return this._raw.method.toUpperCase();
  }

  // ── URL ───────────────────────────────────────────────────────────────────

  /**
   * Full URL string.
   * - Pages: reconstructed from host header + url
   * - App: from `nextUrl.toString()`
   */
  get url(): string {
    if (isNextApiRequest(this._raw)) {
      const host = this._raw.headers["host"] ?? this._raw.headers["x-forwarded-host"] ?? "localhost";
      const proto = (this._raw.headers["x-forwarded-proto"] as string | undefined) ?? "http";
      return `${proto}://${host}${this._raw.url ?? "/"}`;
    }
    return this._raw.nextUrl.toString();
  }

  /**
   * Parsed URL object.
   * - Pages: native `URL` from reconstructed string
   * - App: `nextUrl` (extends URL)
   */
  get nextUrl(): URL {
    if (isNextApiRequest(this._raw)) {
      return new URL(this.url);
    }
    return this._raw.nextUrl;
  }

  /** Pathname only, e.g. `/api/users` */
  get pathname(): string {
    return this.nextUrl.pathname;
  }

  // ── Query ─────────────────────────────────────────────────────────────────

  /**
   * Query params as a plain record.
   * - Pages: `req.query` (already parsed by Next.js)
   * - App: parsed from `nextUrl.searchParams`
   */
  get query(): Record<string, string | string[]> {
    if (isNextApiRequest(this._raw)) {
      return this._raw.query as Record<string, string | string[]>;
    }

    const params: Record<string, string | string[]> = {};
    this._raw.nextUrl.searchParams.forEach((value, key) => {
      if (key in params) {
        const existing = params[key];
        params[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
      } else {
        params[key] = value;
      }
    });
    return params;
  }

  /**
   * Get a single query param value.
   * Returns the first value if multiple exist.
   */
  getQuery(key: string): string | undefined {
    const val = this.query[key];
    return Array.isArray(val) ? val[0] : val;
  }

  /**
   * Get all values for a query param key.
   */
  getQueryAll(key: string): string[] {
    const val = this.query[key];
    if (!val) return [];
    return Array.isArray(val) ? val : [val];
  }

  // ── Headers ───────────────────────────────────────────────────────────────

  /**
   * Get a single header value by name (case-insensitive).
   */
  getHeader(name: string): string | null {
    const lower = name.toLowerCase();
    if (isNextApiRequest(this._raw)) {
      const val = this._raw.headers[lower];
      if (Array.isArray(val)) return val[0] ?? null;
      return val ?? null;
    }
    return this._raw.headers.get(lower);
  }

  /**
   * Get all values for a header (relevant for multi-value headers like `set-cookie`).
   */
  getHeaderAll(name: string): string[] {
    const lower = name.toLowerCase();
    if (isNextApiRequest(this._raw)) {
      const val = this._raw.headers[lower];
      if (!val) return [];
      return Array.isArray(val) ? val : [val];
    }
    const val = this._raw.headers.get(lower);
    if (!val) return [];
    return val.split(",").map((v) => v.trim());
  }

  /** Raw headers as a plain `Record<string, string>` */
  get headers(): Record<string, string> {
    if (isNextApiRequest(this._raw)) {
      const result: Record<string, string> = {};
      for (const [key, val] of Object.entries(this._raw.headers)) {
        result[key] = Array.isArray(val) ? val.join(", ") : (val ?? "");
      }
      return result;
    }

    const result: Record<string, string> = {};
    this._raw.headers.forEach((val, key) => {
      result[key] = val;
    });
    return result;
  }

  // ── Cookies ───────────────────────────────────────────────────────────────

  /**
   * All cookies as a plain `Record<string, string>`.
   */
  get cookies(): Record<string, string> {
    if (isNextApiRequest(this._raw)) {
      return this._raw.cookies as Record<string, string>;
    }

    const result: Record<string, string> = {};
    this._raw.cookies.getAll().forEach(({ name, value }) => {
      result[name] = value;
    });
    return result;
  }

  /**
   * Get a single cookie value by name.
   */
  getCookie(name: string): string | undefined {
    return this.cookies[name];
  }

  /**
   * Get all cookies as `NectCookie[]` array.
   */
  getCookieAll(): NectCookie[] {
    if (isNextApiRequest(this._raw)) {
      return Object.entries(this._raw.cookies as Record<string, string>).map(([name, value]) => ({ name, value }));
    }
    return this._raw.cookies.getAll();
  }

  // ── Body ──────────────────────────────────────────────────────────────────

  /**
   * Returns the body as parsed by Next.js.
   *
   * - Pages (`NextApiRequest`): returns `req.body` synchronously (already parsed by Next.js bodyParser)
   * - App (`NextRequest`): returns a **Promise** that resolves to parsed JSON or text
   *
   * Use `await nectReq.body()` consistently for both — if pages returns a non-promise,
   * it's still safe to `await` it.
   */
  async body(): Promise<TBody> {
    if (isNextApiRequest(this._raw)) {
      return this._raw.body as TBody;
    }

    const contentType = this.getHeader("content-type") ?? "";

    if (contentType.includes("application/json")) {
      return this._raw.json() as Promise<TBody>;
    }

    if (contentType.includes("text/")) {
      return this._raw.text() as unknown as Promise<TBody>;
    }

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await this._raw.text();
      const params = new URLSearchParams(text);
      const result: Record<string, string> = {};
      params.forEach((val, key) => {
        result[key] = val;
      });
      return result as unknown as Promise<TBody>;
    }

    // Fallback: try JSON, then text
    try {
      return this._raw.clone().json() as Promise<TBody>;
    } catch {
      return this._raw.text() as unknown as Promise<TBody>;
    }
  }

  // ── IP ────────────────────────────────────────────────────────────────────

  /**
   * Best-effort client IP.
   * Checks `x-forwarded-for` → `x-real-ip` → socket address (pages only).
   */
  get ip(): string | undefined {
    const forwarded = this.getHeader("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0]?.trim();

    const realIp = this.getHeader("x-real-ip");
    if (realIp) return realIp;

    if (isNextApiRequest(this._raw)) {
      return this._raw.socket?.remoteAddress;
    }

    return undefined;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Whether the request is a JSON request */
  get isJson(): boolean {
    return (this.getHeader("content-type") ?? "").includes("application/json");
  }

  /** Whether the request is multipart */
  get isMultipart(): boolean {
    return (this.getHeader("content-type") ?? "").includes("multipart/form-data");
  }

  /** Whether the request is a form submission */
  get isForm(): boolean {
    return (this.getHeader("content-type") ?? "").includes("application/x-www-form-urlencoded");
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Wrap a `NextApiRequest` or `NextRequest` into a unified `NectRequest`.
 *
 * @example
 * ```ts
 * // Pages Router
 * export default function handler(req: NextApiRequest, res: NextApiResponse) {
 *   const nReq = nectRequest(req)
 *   const userId = nReq.getQuery('id')
 * }
 *
 * // App Router
 * export async function GET(req: NextRequest) {
 *   const nReq = nectRequest(req)
 *   const body = await nReq.body<{ name: string }>()
 * }
 * ```
 */
export function nectRequest<TBody = unknown>(req: AnyNextRequest): NectRequest<TBody> {
  return new NectRequest<TBody>(req);
}
