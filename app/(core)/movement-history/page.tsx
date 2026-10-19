import type { Metadata } from "next";
import { History } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = {
  title: "Movement history",
};

export default function MovementHistoryPage() {
  return (
    <ComingSoon
      title="Movement history"
      description="Every stock movement, by product and location."
      icon={History}
    />
  );
}
