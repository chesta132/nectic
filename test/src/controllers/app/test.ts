import { User } from "@/validator/zod";
import { AppRouterHandler, RouteRequest } from "../../../../dist/route";

export const appPing: AppRouterHandler = (req, res, { reply }) => {
  return reply.success("ok").ok();
};

export const appTest: AppRouterHandler<RouteRequest<User>> = (req, res, { next, reply, validated }) => {
  return reply.success(validated.body).ok();
};

export const appTestWithNext: AppRouterHandler<RouteRequest<User>> = (req, res, { next, validated }) => {
  req.set("user", validated.body);
  return next();
};
