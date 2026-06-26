import { Trophy } from "lucide-react";
import { PageLoader } from "@/components/ui/page-loader";

export default function Loading() {
  return <PageLoader icon={Trophy} label="A carregar recordes…" color="#fbbf24" animation="bounce" />;
}
