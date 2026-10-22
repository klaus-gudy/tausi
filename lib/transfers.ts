import type { StockTransferStatus } from "@/lib/generated/prisma/client"

// Shared by the transfers, salespeople and stock pages.

/** "TR-0007": how a transfer is named on screen and on paperwork. */
export function transferNumber(number: number) {
  return `TR-${String(number).padStart(4, "0")}`
}

export const TRANSFER_STATUS_LABELS: Record<StockTransferStatus, string> = {
  initiated: "Initiated",
  in_transit: "In transit",
  arrived: "Arrived",
  cancelled: "Cancelled",
}
