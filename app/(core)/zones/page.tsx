import type { Metadata } from "next";
import { MapPinned } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = {
  title: "Zones",
};

export default function ZonesPage() {
  return (
    <ComingSoon
      title="Zones"
      description="The regions dealers belong to, each with its salesperson."
      icon={MapPinned}
    />
  );
}
