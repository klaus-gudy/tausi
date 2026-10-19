import type { Metadata } from "next";
import { ArrowLeftRight } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = {
  title: "Transfers",
};

export default function TransfersPage() {
  return (
    <ComingSoon
      title="Transfers"
      description="Move stock between warehouses and salespeople."
      icon={ArrowLeftRight}
    />
  );
}
