"use client";

import { useState, useRef, useEffect } from "react";
import { DashboardNav } from "@/components/dashboard/nav";
import { Send, MessageCircle } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Estou apto para um treino de séries amanhã?",
  "Como está a minha forma atual?",
  "Porque desceu o meu VO2 Max?",
  "Devo correr hoje ou descansar?",
];

export default function CoachPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Olá! Sou o seu treinador de corrida. Pergunte-me sobre a sua forma, prontidão para treino, ou recuperação — uso os seus dados reais do Freddy para responder." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

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
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro desconhecido.");
        return;
      }
      setMessages([...newMessages, { role: "assistant", content: data.reply }]);
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
        <h2 className="mb-3 text-sm font-medium text-slate-400">Treinador IA</h2>

        <div className="flex-1 space-y-4 overflow-y-auto pb-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                  m.role === "user" ? "bg-emerald-600 text-white" : "border border-slate-800 bg-slate-900 text-slate-200"
                }`}
              >
                {m.content}
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

        {messages.length <= 1 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
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
