import { NextResponse } from "next/server";
import { scrapeBbvaPromotions } from "@/lib/scrapers/bbva";

export async function GET() {
  // Guardrail to keep this endpoint responsive in serverless.
  // Raise as needed once we add caching / prefetch.
  const result = await scrapeBbvaPromotions({ maxPages: 8 });
  return NextResponse.json(result, {
    status: result.ok ? 200 : 502
  });
}
