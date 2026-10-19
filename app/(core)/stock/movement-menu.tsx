"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";

import { reverseMovement } from "./actions";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function MovementMenu({ movementId, summary }: { movementId: string; summary: string }) {
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Options for ${summary}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)}>
            Reverse
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDeleteDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Reverse ${summary}?`}
        description="An opposite movement is recorded today, so stock goes back to what it was before. Both stay in the history."
        confirmLabel="Reverse"
        pendingLabel="Reversing…"
        action={() => reverseMovement(movementId)}
      />
    </>
  );
}
