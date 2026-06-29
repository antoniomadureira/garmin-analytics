import { NextResponse } from "next/server";
import { getAthleteZones } from "@/lib/strava-lab/client";

export async function GET() {
  try {
    const zones = await getAthleteZones();
    return NextResponse.json(zones);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 200 });
  }
}
