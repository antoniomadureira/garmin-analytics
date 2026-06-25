import { NextRequest, NextResponse } from "next/server";
import { getFreddyDataService } from "@/lib/freddy/data-adapter";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Parâmetro 'date' inválido ou ausente (formato YYYY-MM-DD)." }, { status: 400 });
  }

  try {
    const service = await getFreddyDataService();
    const detail = await service.getActivityDetailFull(date);
    return NextResponse.json(detail);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
