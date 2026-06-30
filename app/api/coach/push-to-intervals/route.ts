import { NextRequest, NextResponse } from "next/server";
import { pushWorkoutToIntervals } from "@/lib/intervals/client";

/** Remove formatação Markdown (###, **, etc.) para texto simples legível na descrição do evento. */
function markdownToPlainText(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, "") // títulos
    .replace(/\*\*(.+?)\*\*/g, "$1") // negrito
    .replace(/^[*-]\s+/gm, "• ") // listas
    .trim();
}

function extractTitle(md: string): string {
  const headingMatch = md.match(/^#{1,6}\s+(.+)$/m);
  if (headingMatch) {
    // remove emojis simples do início, mantém o resto
    return headingMatch[1].replace(/^[^\w]+/, "").trim();
  }
  return "Treino sugerido";
}

export async function POST(req: NextRequest) {
  try {
    const { content, date } = await req.json();
    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "Campo 'content' obrigatório." }, { status: 400 });
    }
    const dateStr = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);

    const result = await pushWorkoutToIntervals({
      name: extractTitle(content),
      description: markdownToPlainText(content),
      dateStr,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
