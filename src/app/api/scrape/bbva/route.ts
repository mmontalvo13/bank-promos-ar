import { NextResponse } from "next/server";
import { scrapeBbvaPromotions } from "@/lib/scrapers/bbva";

export async function GET() {
  const result = await scrapeBbvaPromotions();
  return NextResponse.json(result, {
    status: result.ok ? 200 : 502
  });
}
