import { NextRequest, NextResponse } from "next/server";
import { getFreddyDataService } from "@/lib/freddy/data-adapter";
import { loadPrescription } from "@/lib/coach/prescription-store";
import { buildExecutionAnalysis, saveExecution } from "@/lib/coach/execution-analysis";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Parâmetro 'date' inválido ou ausente (formato YYYY-MM-DD)." }, { status: 400 });
  }

  try {
    const service = await getFreddyDataService();
    const [detail, prescription] = await Promise.all([
      service.getActivityDetailFull(date),
      loadPrescription(date),
    ]);

    let execution = null;
    if (!detail.samplesUnavailable) {
      execution = buildExecutionAnalysis({
        date,
        distanceKm: detail.distanceKm,
        durationSec: detail.durationSec,
        avgHrBpm: detail.avgHr,
        series: detail.series,
        prescription,
      });
      // Guardar em Redis (fire-and-forget — não bloqueia resposta)
      saveExecution(date, execution).catch(() => {});
    }

    return NextResponse.json({ ...detail, prescription, execution });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
