import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = {
  title: "Stock counts",
};

export default function StockCountsPage() {
  return (
    <ComingSoon
      title="Stock counts"
      description="Count a warehouse or a salesperson's stock and correct differences."
      icon={ClipboardCheck}
    />
  );
}
