import { NextResponse } from "next/server";
import { getPromotions } from "@/lib/data/promotions";

export async function GET() {
  const promotions = await getPromotions();
  return NextResponse.json({ promotions });
}

