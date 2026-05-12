import { pagePing, pagesTest } from "@/controllers/pages/test";
import { user } from "@/validator/zod";
import { appTest } from "@/controllers/app/test";
import { createPagesRouter } from "#/route";

export default createPagesRouter(
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
