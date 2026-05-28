import { NextMiddlewareResult } from "next/dist/server/web/types";
import { NextFetchEvent } from "next/server";
import { PromiseOrValue } from "../shared.type";
import { NectRequest } from "../server";

/** Function-based matcher that determines if a proxy should handle the request. */
export type MatcherFunc = (req: NectRequest, event: NextFetchEvent) => boolean | Promise<boolean>;

/** A matcher can be a RegExp tested against the pathname, or a custom function. */
export type Matcher = RegExp | MatcherFunc;

/** A proxy handler function that processes the request and can call the next proxy in chain. */
export type NectProxyFunc = (req: NectRequest, event: NextFetchEvent, ctx: NectProxyContext) => PromiseOrValue<NextMiddlewareResult>;

export type ProxyListItem = { proxies: NectProxyFunc[]; matcher: Matcher };
export type ProxyList = ProxyListItem[];

/** Calls the next proxy in the chain. */
export type NextFunc = () => PromiseOrValue<NextMiddlewareResult>;

/**
 * Context passed to each proxy function.
 * Provides control over the proxy chain execution.
 */
export type NectProxyContext = { next: NextFunc; isHasNext: () => boolean };

/** Options for registering a proxy via `use()`. */
export type UseOption = {
  /** Restricts the proxy to matching requests only. Defaults to matching all. */
  matcher?: Matcher;
};
