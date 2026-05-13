import { User } from "@/validator/zod";
import { AppRouterHandler, RouteRequest } from "../../../../dist/route";

export const appPing: AppRouterHandler = (req, res, { reply }) => {
  return reply.success("ok").ok();
};

export const appTest: AppRouterHandler<RouteRequest<User>> = (req, res, { next, reply, validated }) => {
  const user = req.get("user");
  console.log("user", user);
  if (user) return reply.success({ withNext: true, user }).ok();
  return reply.success(validated.body).ok();
};

export const appTestWithNext: AppRouterHandler<RouteRequest<User>> = (req, res, { next, validated, reply }) => {
  req.set("user", validated.body);
  return next();
};
