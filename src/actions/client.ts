import { NectOutcomeError } from "./error";
import { ErrorOutcomeType, OutcomeEnvelope } from "./outcome/types";
import { NectActionOption } from "./types";

/**
 * Client-side action caller that invokes a `NectActionFunc` and optionally throws on error.
 *
 * Use this inside React Server Components, form actions, or any client/server boundary
 * where you want a consistent way to call actions and handle their outcomes.
 *
 * **Safe mode** (default — `unsafe` omitted or `false`):
 * Always returns the `OutcomeEnvelope`. You must check `result.meta.status` yourself.
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
 */
export const nectAction = async <Args extends any[] = unknown[], Result = unknown, Unsafe extends boolean = boolean>(
  { action, unsafe }: NectActionOption<Args, Result, Unsafe>,
  ...args: Args
): Promise<Unsafe extends true ? OutcomeEnvelope<Exclude<Result, ErrorOutcomeType>, true> : OutcomeEnvelope<Result | ErrorOutcomeType, boolean>> => {
  const result = await action(...args);

  if (result.meta.status === "ERROR" && unsafe) {
    throw new NectOutcomeError(result as OutcomeEnvelope<ErrorOutcomeType, false>);
  }

  return result as any;
};
