"use client";

import { useEffect, useRef } from "react";
import { Drawer } from "vaul";

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
  const contentRef = useRef<HTMLDivElement>(null);

  // Em controlled mode, vaul só chama onOpenChange(false) — o (true) nunca
  // dispara porque open vem de fora. useEffect é o lugar correcto.
  // preventScroll evita que o browser faça scroll até ao elemento fora de vista
  // durante a animação de entrada.
  useEffect(() => {
    if (open) contentRef.current?.focus({ preventScroll: true });
  }, [open]);

  return (
    <Drawer.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Drawer.Portal>
        {/* Overlay com fade — clicar fecha (built-in do vaul) */}
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/60 transition-opacity duration-300" />

        {/* Painel — arrasto para fechar via vaul; Portal rende em document.body
            (resolve o problema de backdrop-filter em antepassados, mesmo que os
            consumidores continuem a colocar BottomSheet fora de elementos com filter) */}
        <Drawer.Content
          ref={contentRef}
          tabIndex={-1}
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col rounded-t-2xl border-t border-slate-800 bg-slate-900 shadow-2xl outline-none"
        >
          {/* Handle de arrasto */}
          <div className="mx-auto mt-2 mb-1 h-1 w-10 flex-shrink-0 rounded-full bg-slate-700" />

          {/* Título — alinhado ao padding do conteúdo; sem X (fecha por drag ou overlay) */}
          <Drawer.Title className="flex-shrink-0 border-b border-slate-800 px-4 py-3 text-sm font-medium text-slate-200">
            {title}
          </Drawer.Title>

          {/* Área com scroll */}
          <div
            className="overflow-y-auto px-4 py-4"
            style={{
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
