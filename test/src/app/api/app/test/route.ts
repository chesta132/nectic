import { NextRequest } from "next/server";
import { NectRoute, RouteContext } from "../../../../../../dist/route";
import { NectRequest, NectResponse } from "../../../../../../dist/server";
import { NextResponse } from "next/server";
import { appTest } from "@/controllers/app/test";
import { pagesTest } from "@/controllers/pages/test";

export const { POST } = new NectRoute({
  POST: appTest,
  // FALLBACK: pagesTest,
}).toAppRouter();
