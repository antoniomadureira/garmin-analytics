"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  // Bloqueia o scroll do body enquanto o painel está aberto.
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  return (
    <>
      {/* Fundo escurecido — clicar fecha */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/60 ${open ? "" : "pointer-events-none"}`}
        style={{ transition: "opacity 300ms ease-out", opacity: open ? 1 : 0 }}
      />

      {/* Painel — desliza de baixo para cima */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88vh] flex-col overflow-hidden rounded-t-2xl border-t border-slate-800 bg-slate-950 shadow-2xl"
        style={{
          transition: "transform 350ms cubic-bezier(0.32, 0.72, 0, 1)",
          transform: open ? "translateY(0)" : "translateY(100%)",
        }}
        role="dialog"
        aria-modal="true"
      >
        {/* Pega visual de arrasto, sinaliza que o painel é deslizável/scrollável */}
        <div className="flex justify-center pt-2">
          <div className="h-1 w-10 rounded-full bg-slate-700" />
        </div>
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h3 className="text-sm font-medium text-slate-200">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100">
            <X size={18} />
          </button>
        </div>
        <div
          className="overflow-y-auto px-4 py-4"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)", WebkitOverflowScrolling: "touch" }}
        >
          {children}
        </div>
      </div>
    </>
  );
}
