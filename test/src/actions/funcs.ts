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

class Test {
  y = "yesss";
  constructor() {}

  d() {
    console.log("D");
  }
}

export const actionTestFunc: ActionFunc<[user: User], [user: User], { user: User; validated: User; fromMw: boolean; f: Test }> = (
  { outcome, validated: [validated], get },
  user,
) => {
  const u = get("user");
  if (u) return outcome.success({ user: u as User, validated, fromMw: true, f: new Test() }).ok();
  return outcome.success({ user, validated, fromMw: false, f: new Test() }).ok();
};
