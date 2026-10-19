"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import { setSuperDealerActive } from "./actions";
import { EditDealerDialog, type EditableDealer } from "./dealer-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { dealerName, type PlaceZone } from "@/lib/dealers";

export function DealerMenu({
  dealer,
  places,
  inactive,
}: {
  dealer: EditableDealer;
  places: PlaceZone[];
  inactive: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Options for ${dealerName(dealer)}`}
            disabled={pending}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditing(true)}>Edit</DropdownMenuItem>
          <DropdownMenuItem
            variant={inactive ? "default" : "destructive"}
            onSelect={() =>
              startTransition(async () => {
                const result = await setSuperDealerActive(dealer.id, inactive);
                if (result.success) toast.success(result.message);
                else toast.error(result.message);
              })
            }
          >
            {inactive ? "Reactivate" : "Deactivate"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <EditDealerDialog dealer={dealer} places={places} open={editing} onOpenChange={setEditing} />
    </>
  );
}
