import { createAppRouter } from "#/route";
import { appPing, appTest, appTestWithNext } from "@/controllers/app/test";
import { pagesTestWithNext } from "@/controllers/pages/test";
import { user } from "@/validator/zod";

export const { POST, GET } = createAppRouter(
  {
    POST: [appTestWithNext, appTest],
    GET: appPing,
  },
  {
    POST: {
      validator: {
        body: user,
      },
    },
  },
);
