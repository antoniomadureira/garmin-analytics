import { NextRequest, NextResponse } from "next/server";
import { setGearCost } from "@/lib/strava-lab/client";

export async function POST(req: NextRequest) {
  try {
    const { gearId, priceEur } = await req.json();
    if (!gearId || typeof priceEur !== "number") {
      return NextResponse.json({ error: "gearId e priceEur (número) são obrigatórios." }, { status: 400 });
    }
    await setGearCost(gearId, priceEur);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
