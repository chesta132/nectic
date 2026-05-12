import { createAppRouter } from "#/route";
import { appPing, appTest } from "@/controllers/app/test";
import { user } from "@/validator/zod";

export const { POST, GET } = createAppRouter(
  {
    POST: appTest,
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
