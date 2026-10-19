import type { Metadata } from "next";
import { Boxes } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = {
  title: "Stock on hand",
};

export default function StockOnHandPage() {
  return (
    <ComingSoon
      title="Stock on hand"
      description="How much of each product is in each warehouse and with each salesperson."
      icon={Boxes}
    />
  );
}
