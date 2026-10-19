import type { Metadata } from "next";
import { UserCheck } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = {
  title: "Salespeople",
};

export default function SalespeoplePage() {
  return (
    <ComingSoon
      title="Salespeople"
      description="Who covers which zones, and the stock they carry."
      icon={UserCheck}
    />
  );
}
