import { pagePing, pagesTest } from "@/controllers/pages/test";
import { NectRoute, PagesRouterHandler } from "#/route";
import { user } from "@/validator/zod";
import { appTest } from "@/controllers/app/test";

export default NectRoute.pagesRouter(
  {
    GET: pagePing,
    // POST: appTest,
    FALLBACK: pagesTest,
  },
  {
    POST: {
      validator: {
        body: user,
      },
    },
  },
);
