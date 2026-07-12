"use client";

import { useState, useRef, useEffect } from "react";
import { DashboardNav } from "@/components/dashboard/nav";
import { Send, MessageCircle, CalendarPlus } from "lucide-react";
import { MarkdownLite } from "@/components/dashboard/markdown-lite";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Que treino posso fazer hoje?",
  "Estou apto para um treino de séries amanhã?",
  "Como está a minha forma atual?",
  "Devo correr hoje ou descansar?",
];

const INITIAL_BRIEFING_PROMPT =
  "Dá-me um resumo direto da minha condição atual, em 4-6 frases: saúde geral, sono, preparação física, e se estou apto para treinar hoje — e se sim, que tipo de treino fazer hoje (ex: fácil, séries, longo, descanso). Usa os dados reais fornecidos.";

export default function CoachPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);
  const [pushState, setPushState] = useState<Record<number, "idle" | "sending" | "done" | "error">>({});
  const [pushUrls, setPushUrls] = useState<Record<number, string>>({});
  const [icuWorkouts, setIcuWorkouts] = useState<Record<number, { name: string; description: string }>>({});
  const [consistencyWarnings, setConsistencyWarnings] = useState<Record<number, string>>({});
  const [plannedWorkout, setPlannedWorkout] = useState("");

  async function pushToIntervals(index: number) {
    const workout = icuWorkouts[index];
    if (!workout) return;
    setPushState((s) => ({ ...s, [index]: "sending" }));
    try {
      const res = await fetch("/api/coach/push-to-intervals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: workout.name,
          description: workout.description,
          date: new Date().toISOString().slice(0, 10),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro desconhecido.");
      setPushState((s) => ({ ...s, [index]: "done" }));
      setPushUrls((s) => ({ ...s, [index]: data.url }));
    } catch {
      setPushState((s) => ({ ...s, [index]: "error" }));
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // [Certo] Pedido automático de insight inicial ao abrir a página — não é
  // visível como mensagem do utilizador no histórico (não entra em
  // `messages`), só dispara a chamada e mostra a resposta como primeira
  // fala do treinador.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      try {
        const res = await fetch("/api/coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [{ role: "user", content: INITIAL_BRIEFING_PROMPT }] }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Erro ao gerar o resumo inicial.");
          setMessages([
            { role: "assistant", content: "Olá. Posso analisar a sua forma, prontidão para treino e recuperação com base nos seus dados reais — pergunte à vontade." },
          ]);
          return;
        }
        setMessages([{ role: "assistant", content: data.reply }]);
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    setError(null);
    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          ...(plannedWorkout.trim() ? { plannedWorkout: plannedWorkout.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro desconhecido.");
        return;
      }
      setMessages([...newMessages, { role: "assistant", content: data.reply }]);
      if (data.icuWorkout) {
        setIcuWorkouts((prev) => ({ ...prev, [newMessages.length]: data.icuWorkout }));
      }
      if (data.consistencyWarning) {
        setConsistencyWarnings((prev) => ({ ...prev, [newMessages.length]: data.consistencyWarning }));
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <DashboardNav />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-6">
        <h2 className="mb-3 text-sm font-medium text-slate-400">Consultor de Treino</h2>

        <div className="flex-1 space-y-4 overflow-y-auto pb-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                  m.role === "user" ? "bg-emerald-600 text-white" : "border border-slate-800 bg-slate-900 text-slate-200"
                }`}
              >
                {m.role === "assistant" ? <MarkdownLite content={m.content} /> : m.content}
                {m.role === "assistant" && icuWorkouts[i] && (
                  <div className="mt-3 border-t border-slate-800 pt-2">
                    {pushState[i] === "done" ? (
                      <a href={pushUrls[i]} target="_blank" rel="noreferrer" className="text-xs text-emerald-400 hover:underline">
                        ✓ Enviado — ver no calendário do Intervals.icu (treino aparece hoje)
                      </a>
                    ) : (
                      <button
                        onClick={() => pushToIntervals(i)}
                        disabled={pushState[i] === "sending"}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-400 transition hover:border-cyan-700 hover:text-cyan-400 disabled:opacity-50"
                      >
                        <CalendarPlus size={13} />
                        {pushState[i] === "sending" ? "A enviar…" : "Adicionar ao Intervals.icu → Garmin"}
                      </button>
                    )}
                    {pushState[i] === "error" && <p className="mt-1 text-[11px] text-amber-500">Falha ao enviar — verifique as env vars (INTERVALS_ICU_API_KEY).</p>}
                    {consistencyWarnings[i] && (
                      <p className="mt-2 rounded border border-amber-700/40 bg-amber-900/20 px-2 py-1.5 text-[11px] text-amber-400">
                        ⚠ {consistencyWarnings[i]}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-slate-400">
                <MessageCircle size={14} className="animate-pulse" />a pensar…
              </div>
            </div>
          )}
          {error && <p className="text-xs text-amber-500">Erro: {error}</p>}
          <div ref={bottomRef} />
        </div>

        {/* Plano do dia — ativa modo evaluate quando preenchido */}
        <div className="mb-3">
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-widest text-slate-600">
            Plano de hoje <span className="normal-case tracking-normal text-slate-700">(opcional — ativa modo avaliar)</span>
          </label>
          <input
            value={plannedWorkout}
            onChange={(e) => setPlannedWorkout(e.target.value)}
            placeholder="ex: 6x1km @ 4:10/km, rec 2min…"
            className="w-full rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs text-slate-300 outline-none focus:border-emerald-800 placeholder:text-slate-700"
          />
        </div>

        {messages.length <= 1 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {(plannedWorkout.trim()
              ? ["Avalia o plano de hoje", "Devo ajustar alguma coisa?", "Estou pronto para este esforço?"]
              : SUGGESTIONS
            ).map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="rounded-full border border-slate-800 px-3 py-1.5 text-xs text-slate-400 transition hover:bg-slate-800/60 hover:text-slate-200"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte algo sobre o seu treino..."
            className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </form>
      </main>
    </div>
  );
}
