import type { Metadata } from "next";
import { PackagePlus } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = {
  title: "Goods received",
};

export default function GoodsReceivedPage() {
  return (
    <ComingSoon
      title="Goods received"
      description="Count stock that arrives and put it into a warehouse."
      icon={PackagePlus}
    />
  );
}
