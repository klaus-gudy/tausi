"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import { setWarehouseActive } from "./actions";
import { EditWarehouseDialog, type EditableWarehouse, type Keeper } from "./warehouse-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PlaceZone } from "@/lib/dealers";

export function WarehouseMenu({
  warehouse,
  places,
  keepers,
  inactive,
}: {
  warehouse: EditableWarehouse;
  places: PlaceZone[];
  keepers: Keeper[];
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
            aria-label={`Options for ${warehouse.name}`}
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
                const result = await setWarehouseActive(warehouse.id, inactive);
                if (result.success) toast.success(result.message);
                else toast.error(result.message);
              })
            }
          >
            {inactive ? "Reactivate" : "Deactivate"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <EditWarehouseDialog
        warehouse={warehouse}
        places={places}
        keepers={keepers}
        open={editing}
        onOpenChange={setEditing}
      />
    </>
  );
}
