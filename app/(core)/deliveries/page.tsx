import type { Metadata } from "next";
import { Truck } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = {
  title: "Deliveries",
};

export default function DeliveriesPage() {
  return (
    <ComingSoon
      title="Deliveries"
      description="Stock salespeople hand over to super dealers."
      icon={Truck}
    />
  );
}
