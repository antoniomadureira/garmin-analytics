import { Fragment } from "react";

/** Aplica **negrito** dentro de uma linha, devolvendo nós React. */
function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

/**
 * [Certo] Parser de Markdown leve, escrito à mão — suporta só o que o
 * Consultor de Treino realmente produz (títulos ###, negrito **,
 * listas com * ou -, parágrafos). Evita adicionar uma dependência nova
 * (react-markdown, etc.) só para isto.
 */
export function MarkdownLite({ content }: { content: string }) {
  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];
  let currentList: string[] = [];
  let key = 0;

  function flushList() {
    if (currentList.length === 0) return;
    blocks.push(
      <ul key={key++} className="ml-4 list-disc space-y-1">
        {currentList.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>
    );
    currentList = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === "") {
      flushList();
      continue;
    }
    if (line.startsWith("### ")) {
      flushList();
      blocks.push(
        <h4 key={key++} className="mt-2 text-sm font-semibold text-slate-100">
          {renderInline(line.slice(4))}
        </h4>
      );
      continue;
    }
    if (line.startsWith("## ")) {
      flushList();
      blocks.push(
        <h3 key={key++} className="mt-2 text-base font-semibold text-slate-100">
          {renderInline(line.slice(3))}
        </h3>
      );
      continue;
    }
    if (/^[*-]\s+/.test(line)) {
      currentList.push(line.replace(/^[*-]\s+/, ""));
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      flushList();
      blocks.push(
        <p key={key++} className="font-medium text-slate-200">
          {renderInline(line)}
        </p>
      );
      continue;
    }
    flushList();
    blocks.push(
      <p key={key++} className="leading-relaxed">
        {renderInline(line)}
      </p>
    );
  }
  flushList();

  return <div className="space-y-1.5">{blocks}</div>;
}
