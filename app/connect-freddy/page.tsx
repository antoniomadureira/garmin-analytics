"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

export default function ConnectFreddyPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "waiting" | "connected" | "error">("idle");
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  async function start() {
    setError(null);
    const res = await fetch("/api/freddy/device/start", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setStatus("error");
      setError(data.error ?? "Não foi possível iniciar a ligação.");
      return;
    }
    setVerificationUrl(data.verificationUrl);
    setStatus("waiting");

    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = setInterval(async () => {
      const pollRes = await fetch("/api/freddy/device/poll", { method: "POST" });
      const pollData = await pollRes.json();
      if (pollData.status === "connected") {
        if (pollTimer.current) clearInterval(pollTimer.current);
        setStatus("connected");
        setTimeout(() => router.push("/dashboard"), 1000);
      } else if (pollData.status === "error") {
        if (pollTimer.current) clearInterval(pollTimer.current);
        setStatus("error");
        setError(pollData.error);
      }
      // "pending" -> continua a fazer polling
    }, (data.intervalSeconds ?? 6) * 1000);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-center shadow-xl backdrop-blur">
        <h1 className="mb-2 text-xl font-semibold text-slate-100">Ligar dados Garmin (Freddy)</h1>
        <p className="mb-6 text-sm text-slate-400">
          Autoriza o acesso aos seus dados de treino através do Freddy Coach (OAuth device flow).
        </p>

        {status === "idle" && (
          <button
            onClick={start}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white transition hover:bg-emerald-500"
          >
            Iniciar ligação
          </button>
        )}

        {status === "waiting" && verificationUrl && (
          <div className="space-y-4">
            <p className="text-sm text-slate-300">Abra este link e aprove a ligação:</p>
            <a
              href={verificationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block break-all rounded-lg bg-slate-800 px-3 py-2 text-sm text-emerald-400 underline"
            >
              {verificationUrl}
            </a>
            <p className="text-xs text-slate-500">A aguardar aprovação...</p>
          </div>
        )}

        {status === "connected" && <p className="text-emerald-400">Ligado! A redirecionar...</p>}

        {status === "error" && (
          <div className="space-y-3">
            <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-400">{error}</p>
            <button
              onClick={start}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white transition hover:bg-emerald-500"
            >
              Tentar novamente
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
