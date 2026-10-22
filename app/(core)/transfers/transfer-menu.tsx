"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import { cancelTransfer, markArrived, markInTransit } from "./actions";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { StockTransferStatus } from "@/lib/generated/prisma/client";

/** The next step for an open transfer, and cancelling it before it leaves. */
export function TransferMenu({
  id,
  name,
  status,
}: {
  id: string;
  /** "TR-0007" */
  name: string;
  status: Extract<StockTransferStatus, "initiated" | "in_transit">;
}) {
  const [pending, startTransition] = useTransition();
  const [cancelling, setCancelling] = useState(false);

  function run(action: (id: string) => Promise<{ success?: boolean; message: string }>) {
    startTransition(async () => {
      const result = await action(id);
      if (result.success) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Options for ${name}`} disabled={pending}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {status === "initiated" ? (
            <>
              <DropdownMenuItem onSelect={() => run(markInTransit)}>Mark in transit</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setCancelling(true)}>
                Cancel transfer
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem onSelect={() => run(markArrived)}>Mark arrived</DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDeleteDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title={`Cancel ${name}?`}
        description="Its stock goes back on hand. The transfer stays on record as cancelled."
        action={() => cancelTransfer(id)}
        confirmLabel="Cancel transfer"
        pendingLabel="Cancelling…"
      />
    </>
  );
}
