import { NextRequest, NextResponse } from "next/server";
import { pushWorkoutToIntervals } from "@/lib/intervals/client";
import { parseIcuWorkout, savePrescription } from "@/lib/coach/prescription-store";

export async function POST(req: NextRequest) {
  try {
    const { name, description, date } = await req.json();
    if (!name || !description) {
      return NextResponse.json({ error: "Campos 'name' e 'description' obrigatórios." }, { status: 400 });
    }
    const dateStr = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : new Date().toISOString().slice(0, 10);

    const result = await pushWorkoutToIntervals({ name, description, dateStr });

    // Guardar prescrição estruturada em Redis (fire-and-forget — não bloqueia resposta)
    savePrescription(dateStr, parseIcuWorkout(name, description)).catch(() => {});

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
