import { NextRequest, NextResponse } from "next/server";
import { pushWorkoutToIntervals, updateWorkoutInIntervals, getPlannedWorkoutForDate } from "@/lib/intervals/client";
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

    // Se já existe um evento ICU para esta data, substitui em vez de criar um segundo.
    const existing = await getPlannedWorkoutForDate(dateStr).catch(() => null);
    const result = existing
      ? await updateWorkoutInIntervals({ eventId: existing.id, name, description, dateStr })
      : await pushWorkoutToIntervals({ name, description, dateStr });
    console.log(JSON.stringify({ evt: "coach:push", action: existing ? "update" : "create", eventId: result.id, date: dateStr }));

    // Guardar prescrição estruturada em Redis (fire-and-forget — não bloqueia resposta)
    savePrescription(dateStr, parseIcuWorkout(name, description)).catch(() => {});

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
