"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import { setSalespersonActive } from "./actions";
import {
  EditSalespersonDialog,
  type EditableSalesperson,
} from "./salesperson-dialog";
import type { PlaceZone } from "@/lib/dealers";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SalespersonMenu({
  salesperson,
  places,
  inactive,
}: {
  salesperson: EditableSalesperson;
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
            aria-label={`Options for ${salesperson.name}`}
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
                const result = await setSalespersonActive(salesperson.id, inactive);
                if (result.success) toast.success(result.message);
                else toast.error(result.message);
              })
            }
          >
            {inactive ? "Reactivate" : "Deactivate"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <EditSalespersonDialog
        salesperson={salesperson}
        places={places}
       
        open={editing}
        onOpenChange={setEditing}
      />
    </>
  );
}
