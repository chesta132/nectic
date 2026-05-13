import { User } from "@/validator/zod";
import { PagesRouterHandler, RouteRequest } from "#/route";

export const pagePing: PagesRouterHandler = (req, res, { reply }) => {
  return reply.success("ok").ok();
};

export const pagesTest: PagesRouterHandler<RouteRequest<User>> = (req, res, { next, reply, validated }) => {
  const user = req.get("user");
  console.log("user", user);
  if (user) return reply.success({ withNext: true, user }).ok();
  return reply.success(validated.body).ok();
};

export const pagesTestWithNext: PagesRouterHandler<RouteRequest<User>> = (req, res, { next, validated }) => {
  req.set("user", validated.body);
  return next();
};
