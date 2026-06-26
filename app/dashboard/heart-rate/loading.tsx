import { Heart } from "lucide-react";
import { PageLoader } from "@/components/ui/page-loader";

export default function Loading() {
  return <PageLoader icon={Heart} label="A carregar frequência cardíaca…" color="#fb7185" animation="spin" />;
}
