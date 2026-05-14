import { Transform, TransformInput, User } from "@/validator/zod";
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
  func = () => {};
  variable = "123";
}

export const actionTestFunc: ActionFunc<[user: User], [user: User], { user: User; validated: User; fromMw: boolean; f: [() => void, Test] }> = (
  { outcome, validated: [validated], get },
  user,
) => {
  const u = get("user");
  if (u) return outcome.success({ user: u as User, validated, fromMw: true, f: [() => {}, new Test()] }).ok();
  return outcome.success({ user, validated, fromMw: false, f: [() => {}, new Test()] }).ok();
};

export const actionTestFuncZeroArgs: ActionFunc<[], [], { success: boolean; user: User }> = ({ outcome }) => {
  return outcome.success({ success: true, user: { id: 123, username: "1234" } }).ok();
};

export const actionTestFuncTransform: ActionFunc<[TransformInput], [Transform], { success: boolean; user: User }> = ({ outcome }) => {
  return outcome.success({ success: true, user: { id: 123, username: "1234" } }).ok();
};
