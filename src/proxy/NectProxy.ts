import { NextFetchEvent, NextProxy, NextResponse } from "next/server";
import { nectRequest, NectRequest } from "../server";
import { NectProxyContext, NectProxyFunc, ProxyList, UseOption } from "./types";

/**
 * Middleware proxy chain manager for Next.js.
 * Lets you stack multiple proxy handlers and run them in order
 * based on optional matchers (regex or custom function).
 *
 * @example
 * ```ts
 * const proxy = createNectProxy()
 *   .use(loggingProxy)
 *   .use([authProxy, extractIdProxy], { matcher: /^\/dashboard/ })
 *   .use(i18nProxy, { matcher: (req) => req.nextUrl.host === PUBLIC_HOST });
 *
 * export default proxy.handle();
 * ```
 */
export class NectProxy {
  private proxies: ProxyList;

  /**
   * @param proxies - Initial proxy list. Defaults to empty.
   */
  constructor(proxies: ProxyList = []) {
    this.proxies = proxies;
  }

  /**
   * Builds the execution context for a matched proxy chain.
   * Each call to `next()` advances to the next proxy in the list.
   *
   * @param req - The incoming Nect request.
   * @param event - The Next.js fetch event.
   * @param matchedProxies - Proxies that passed the matcher check.
   * @returns Context object with `next` and `isHasNext`.
   */
  private createContext(req: NectRequest, event: NextFetchEvent, matchedProxies: NectProxyFunc[]): NectProxyContext {
    let i = 0;
    const isHasNext = () => i < matchedProxies.length;
    const next = async () => {
      const proxy = matchedProxies[i++] as NectProxyFunc | undefined;
      if (proxy) {
        return await Promise.resolve(proxy(req, event, { next, isHasNext }));
      }
    };

    return { next, isHasNext };
  }

  /**
   * Registers one or more proxy handlers into the chain.
   *
   * @param proxy - A single proxy function or an array of them.
   * @param option - Optional config, including a matcher to scope when they run.
   * @returns The current `NectProxy` instance for chaining.
   *
   * @example
   * ```ts
   * proxy.use(myHandler, { matcher: /^\/api/ });
   * ```
   */
  use(proxy: NectProxyFunc | NectProxyFunc[], option?: UseOption) {
    this.proxies.push({
      proxies: Array.isArray(proxy) ? proxy : [proxy],
      matcher: option?.matcher ?? (() => true),
    });
    return this;
  }

  /**
   * Returns a Next.js-compatible middleware function.
   * Evaluates all registered matchers and runs matched proxies in order.
   *
   * @returns A `NextProxy` handler ready to be exported as middleware.
   *
   * @example
   * ```ts
   * export default createNectProxy().use(myProxy).handle();
   * ```
   */
  handle(): NextProxy {
    return async (request, event) => {
      const req = nectRequest(request);
      const matchedProxies = [];
      for (const { proxies, matcher } of this.proxies) {
        const isMatch = typeof matcher === "function" ? await matcher(req, event) : matcher.test(req.nextUrl.pathname);

        if (isMatch) {
          matchedProxies.push(...proxies);
        }
      }

      if (matchedProxies.length === 0) {
        return NextResponse.next();
      }
      const ctx = this.createContext(req, event, matchedProxies);
      return await ctx.next();
    };
  }
}

/**
 * Creates a new `NectProxy` instance with an empty proxy chain.
 *
 * @returns A fresh `NectProxy` ready for `.use()` calls.
 *
 * @example
 * ```ts
 * export default createNectProxy()
 *   .use(authProxy)
 *   .handle();
 * ```
 */
export const createNectProxy = () => {
  return new NectProxy();
};
