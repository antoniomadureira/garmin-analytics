import { NextRequest, NextResponse } from "next/server";
import { findStravaActivityIdByDate, getActivityDetailByStravaId, getActivityLaps } from "@/lib/strava-lab/client";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Parâmetro 'date' inválido ou ausente." }, { status: 400 });
  }
  try {
    const activityId = await findStravaActivityIdByDate(date);
    if (!activityId) {
      return NextResponse.json({ segmentEfforts: [], bestEfforts: [], prCount: 0, laps: [], notFound: true });
    }
    const [detail, laps] = await Promise.all([
      getActivityDetailByStravaId(activityId),
      getActivityLaps(activityId).catch(() => []),
    ]);
    return NextResponse.json({ ...detail, laps });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 200 });
  }
}
