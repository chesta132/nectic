import { pagePing, pagesTest } from "@/controllers/pages/test";
import { NectRoute, RouteContext } from "../../../../../dist/route";
import { NectRequest, NectResponse } from "../../../../../dist/server";
import { user } from "@/validator/zod";
import { appTest } from "@/controllers/app/test";

export default new NectRoute(
  {
    GET: pagePing,
    POST: pagesTest,
    // FALLBACK: pagesTest,
  },
  {
    POST: {
      validator: {
        body: user,
      },
    },
  },
).toPagesRouter();
