"use server";

import { createNectAction } from "#/actions";
import { transfom, user } from "@/validator/zod";
import { actionTestFunc, actionTestFuncTransform, actionTestFuncZeroArgs } from "./funcs";

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

export const actionTestTransform = createNectAction().validate([transfom]).handle(actionTestFuncTransform);
