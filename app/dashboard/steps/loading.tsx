import { Footprints } from "lucide-react";
import { PageLoader } from "@/components/ui/page-loader";

export default function Loading() {
  return <PageLoader icon={Footprints} label="A carregar passos…" color="#34d399" animation="bounce" />;
}
