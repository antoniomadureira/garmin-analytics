import { Activity } from "lucide-react";
import { PageLoader } from "@/components/ui/page-loader";

export default function Loading() {
  return <PageLoader icon={Activity} label="A carregar corridas…" color="#fb923c" animation="bounce" />;
}
