import { createNectProxy } from "#/proxy";
import { NextResponse } from "next/server";
import { sleep } from "./helper";

export const proxy = createNectProxy()
  .use(
    (req, event, ctx) => {
      const resChance = Math.random() * 100;
      if (resChance < 20) {
        return NextResponse.json({ info: "You're lucky man", chance: resChance });
      }
      if (resChance < 40) {
        return ctx.next();
      }
    },
    { matcher: /^\/$/ },
  )
  .use(
    [
      (req, event, ctx) => {
        return NextResponse.json({ info: "From second proxy", hasNext: ctx.isHasNext() });
      },
    ],
    {
      matcher: async (req) => {
        sleep(500);
        return true;
      },
    },
  )
  .handle();
