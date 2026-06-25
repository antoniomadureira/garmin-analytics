import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-center shadow-xl backdrop-blur">
        <h1 className="mb-2 text-xl font-semibold text-slate-100">Ligar dados Garmin</h1>
        <p className="mb-6 text-sm text-slate-400">
          A sua conta está criada. Agora precisa de autorizar o acesso aos seus dados de
          treino e saúde através do Freddy Coach.
        </p>

        {error && (
          <p className="mb-4 rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-400">
            Não foi possível ligar ao Freddy ({error}). Tente novamente.
          </p>
        )}

        <a
          href="/api/freddy/connect"
          className="inline-block w-full rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white transition hover:bg-emerald-500"
        >
          Autorizar com o Freddy Coach
        </a>
      </div>
    </main>
  );
}
