import { LayoutDashboard } from "lucide-react";
import { PageLoader } from "@/components/ui/page-loader";

export default function Loading() {
  return <PageLoader icon={LayoutDashboard} label="A carregar painel…" color="#22d3ee" animation="spin" />;
}
