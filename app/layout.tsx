import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";

export const metadata: Metadata = {
  title: "freddy running intelligence",
  description: "Plataforma pessoal de análise de performance desportiva",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body className="bg-slate-950 antialiased">{children}</body>
    </html>
  );
}
