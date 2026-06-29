import { NextRequest, NextResponse } from "next/server";
import { findStravaActivityIdByDate, getActivityDetailByStravaId } from "@/lib/strava-lab/client";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Parâmetro 'date' inválido ou ausente." }, { status: 400 });
  }
  try {
    const activityId = await findStravaActivityIdByDate(date);
    if (!activityId) {
      return NextResponse.json({ segmentEfforts: [], bestEfforts: [], prCount: 0, notFound: true });
    }
    const detail = await getActivityDetailByStravaId(activityId);
    return NextResponse.json(detail);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 200 }); // [Certo] 200 de propósito — o painel trata isto como "secção opcional ausente", não como erro a mostrar
  }
}
