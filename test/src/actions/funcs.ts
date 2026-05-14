import { User } from "@/validator/zod";
import { ActionFunc, ActionMiddlewareFunc } from "#/actions";

export const actionTestMw: ActionMiddlewareFunc<[user: User], { user: User; validated: User }> = async ({
  outcome,
  validated: [validated],
  next,
  set,
}) => {
  set("user", validated);
  // return outcome.success({ user: validated, validated }).ok();
  return await next();
};

export const actionTestFunc: ActionFunc<[user: User], [user: User], { user: User; validated: User; fromMw: boolean }> = (
  { outcome, validated: [validated], get },
  user,
) => {
  const u = get("user");
  if (u) return outcome.success({ user: u as User, validated, fromMw: true }).ok();
  return outcome.success({ user, validated, fromMw: false }).ok();
};
