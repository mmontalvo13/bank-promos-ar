import { NextResponse } from "next/server";
import { scrapeModoPromotions } from "@/lib/scrapers/modo";

export async function GET() {
  // Safety guard: don't accidentally pull thousands in the UI path.
  // Increase via query params later if needed.
  const result = await scrapeModoPromotions({ maxPages: 10, limit: 100 });
  return NextResponse.json(result, {
    status: result.ok ? 200 : 502
  });
}

