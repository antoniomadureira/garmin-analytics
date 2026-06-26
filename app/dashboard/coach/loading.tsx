import { MessageCircle } from "lucide-react";
import { PageLoader } from "@/components/ui/page-loader";

export default function Loading() {
  return <PageLoader icon={MessageCircle} label="A abrir o treinador…" color="#22d3ee" animation="pulse" />;
}
