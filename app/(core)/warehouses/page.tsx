import type { Metadata } from "next";
import { Warehouse } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = {
  title: "Warehouses",
};

export default function WarehousesPage() {
  return (
    <ComingSoon
      title="Warehouses"
      description="The places stock is kept."
      icon={Warehouse}
    />
  );
}
