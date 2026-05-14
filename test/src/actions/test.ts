"use server";

import { createNectAction } from "#/actions";
import { User, user } from "@/validator/zod";
import { actionTestFunc, actionTestFuncZeroArgs, actionTestMw } from "./funcs";

export const actionTest = createNectAction()
  // .option({ validator: { args: [user] as const } })
  // .handle(({ outcome, validated }, user: User) => {
  //   return outcome.success(validated[0]).ok();
  // });
  // .use(actionTestMw)
  .validate([user])
  // .use(actionTestMw)
  .handle(actionTestFunc);

type Test = typeof actionTest;

export const actionTestZeroArgs = createNectAction().handle(actionTestFuncZeroArgs);
