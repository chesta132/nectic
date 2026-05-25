import { ExcludeUnserializable } from "../shared.type";
import { NectOutcomeError } from "./error";
import { ErrorOutcomeType, OutcomeEnvelope } from "./outcome/types";
import { NectActionFunc, NectActionOption } from "./types";

/**
 * Wraps a `NectActionFunc` into a reusable callable function with built-in outcome handling.
 *
 * Returns a new function with the same argument signature as the original action,
 *
 * **Unsafe mode** (`unsafe: true`):
 * The wrapped function throws a `NectOutcomeError` if the action returns an error envelope.
 *
 * @template Args - Tuple of argument types passed to the action
 * @template Result - The success data type returned by the action
 * @template Unsafe - Determines whether errors throw or are returned in the envelope
 * @template FromCSR - Indicates whether the action is called from a Client-Side Render context
 *
 * @param action - The `NectActionFunc` to wrap
 * @param options - Optional config (e.g. `unsafe`, `fromCSR`) — excludes the `action` key
 * @returns
 *   - If `unsafe: true` → `(...args: Args) => OutcomeEnvelope<Result, true>` (error path throws instead)
 *   - If `unsafe: false` or omitted → `(...args: Args) => OutcomeEnvelope<Result | ErrorOutcomeType, boolean>`
 *
 * @throws {NectOutcomeError} When `unsafe: true` and the action returns an error envelope
 *
 * @example
 * ```ts
 * // Safe mode — wrap once, call many times
 * const getUser = nectAction(getUserAction);
 * const result = await getUser("user-123");
 * if (result.meta.status === "ERROR") {
 *   console.error(result.data.message);
 * }
 *
 * // Unsafe mode — throws on error
 * const getUser = nectAction(getUserAction, { unsafe: true });
 * try {
 *   const result = await getUser("user-123");
 *   console.log(result.data);
 * } catch (err) {
 *   if (err instanceof NectOutcomeError) {
 *     console.error(err.data.code);
 *   }
 * }
 * ```
 */
// wrap func
export function nectAction<Args extends any[] = unknown[], Result = unknown, Unsafe extends boolean = boolean, FromCSR extends boolean = boolean>(
  action: NectActionFunc<Args, Result>,
  options?: Omit<NectActionOption<Args, Result, Unsafe, FromCSR>, "action">,
): (...args: Args) => ActionReturn<Result, FromCSR, Unsafe>;

// exec func (legacy)
/**
 * Client-side action caller that invokes a `NectActionFunc` and optionally throws on error.
 *
 * Use this inside React Server Components, form actions, or any client/server boundary
 * where you want a consistent way to call actions and handle their outcomes.
 *
 * **Unsafe mode** (`unsafe: true`):
 * Throws a `NectOutcomeError` if the action returns an error envelope,
 * so you can use try/catch instead of manually checking `meta.status`.
 *
 * @template Args - Tuple of argument types passed to the action
 * @template Result - The success data type returned by the action
 * @template Unsafe - Determines the return type based on whether errors throw or are returned
 *
 * @param option - Object containing the `action` to call and optional `unsafe` flag
 * @param args - Arguments forwarded directly to the action function
 * @returns
 *   - If `unsafe: true` → `OutcomeEnvelope<Result, true>` (error path throws instead)
 *   - If `unsafe: false` or omitted → `OutcomeEnvelope<Result | ErrorOutcomeType, boolean>`
 *
 * @throws {NectOutcomeError} When `unsafe: true` and the action returns an error envelope
 *
 * @example
 * ```ts
 * // Safe mode — always returns, check status manually
 * const result = await nectAction({ action: getUser }, "user-123");
 * if (result.meta.status === "ERROR") {
 *   console.error(result.data.message);
 * } else {
 *   console.log(result.data); // typed as User
 * }
 *
 * // Unsafe mode — throws NectOutcomeError on error
 * try {
 *   const result = await nectAction({ action: getUser, unsafe: true }, "user-123");
 *   console.log(result.data); // typed as User (error path already thrown)
 * } catch (err) {
 *   if (err instanceof NectOutcomeError) {
 *     console.error(err.data.code); // e.g. "NOT_FOUND"
 *   }
 * }
 * ```
 * @deprecated use wrap func overload
 */
export function nectAction<Args extends any[] = unknown[], Result = unknown, Unsafe extends boolean = boolean, FromCSR extends boolean = boolean>(
  { action, unsafe, fromCSR }: NectActionOption<Args, Result, Unsafe, FromCSR>,
  ...args: Args
): ActionReturn<Result, FromCSR, Unsafe>;

export function nectAction(actionOrOpt: NectActionOption | NectActionFunc, ...args: any) {
  let option: NectActionOption | undefined;
  try {
    if (typeof actionOrOpt === "function") {
      const action = actionOrOpt;
      option = args[0];
      option ? (option.action = action) : (option = { action });

      const { fromCSR, unsafe } = option || {};
      return (...args: any) =>
        action({ fromCSR: fromCSR || false }, ...args).then((result) => {
          if (result.meta.status === "ERROR" && unsafe) {
            throw new NectOutcomeError(result as OutcomeEnvelope<ErrorOutcomeType, false>);
          }
          return result;
        });
    } else {
      option = actionOrOpt;

      const { action, fromCSR, unsafe } = option;
      return action({ fromCSR: fromCSR || false }, ...args).then((result) => {
        if (result.meta.status === "ERROR" && unsafe) {
          throw new NectOutcomeError(result as OutcomeEnvelope<ErrorOutcomeType, false>);
        }
        return result;
      });
    }
  } catch (err) {
    if (option?.unsafe) throw err;
    return { meta: { status: "ERROR" }, data: { code: "UNHANDLED_ERROR", message: "Unhandled error", information: { err } } } as any;
  }
}

// helper types
type WrapFromCSR<T, FromCSR> = [FromCSR] extends [true] ? ExcludeUnserializable<T> : T;
type ActionReturn<Result, FromCSR extends boolean, Unsafe extends boolean> = Promise<
  [Unsafe] extends [true]
    ? OutcomeEnvelope<WrapFromCSR<Exclude<Result, ErrorOutcomeType>, FromCSR>, true>
    : OutcomeEnvelope<WrapFromCSR<Result | ErrorOutcomeType, FromCSR>, boolean>
>;

/** Check is `result` error in envelope */
export const isOutcomeError = <T>(result: OutcomeEnvelope<T>): result is OutcomeEnvelope<ErrorOutcomeType, false> => result.meta.status === "ERROR";
/** Check is `result` success in envelope */
export const isOutcomeSuccess = <T>(result: OutcomeEnvelope<T>): result is OutcomeEnvelope<Exclude<T, ErrorOutcomeType>, true> =>
  result.meta.status === "SUCCESS";
/** Check is `err` is NectOutcomeError instance */
export const isNectOutcomeError = (err: any): err is NectOutcomeError => err instanceof NectOutcomeError;
