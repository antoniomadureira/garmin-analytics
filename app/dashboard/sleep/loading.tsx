import { Moon } from "lucide-react";
import { PageLoader } from "@/components/ui/page-loader";

export default function Loading() {
  return <PageLoader icon={Moon} label="A carregar dados de sono…" color="#a78bfa" animation="pulse" />;
}
