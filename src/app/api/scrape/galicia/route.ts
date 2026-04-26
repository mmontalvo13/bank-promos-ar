import { NextResponse } from "next/server";
import { scrapeGaliciaPromotions } from "@/lib/scrapers/galicia";

export async function GET() {
  const result = await scrapeGaliciaPromotions();
  return NextResponse.json(result, {
    status: result.ok ? 200 : 502
  });
}

