import { NextResponse } from "next/server";
import { getPromotions } from "@/lib/data/promotions";

export async function GET() {
  try {
    const promotions = await getPromotions();
    return NextResponse.json({ promotions });
  } catch (e) {
    return NextResponse.json(
      {
        promotions: [],
        error: e instanceof Error ? e.message : "Unknown error"
      },
      { status: 502 }
    );
  }
}

