"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import { setProductArchived } from "./actions";
import { EditProductDialog, type EditableProduct } from "./product-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ProductMenu({
  product,
  archived,
}: {
  product: EditableProduct;
  archived: boolean;
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
            aria-label={`Options for ${product.name}`}
            disabled={pending}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditing(true)}>Edit</DropdownMenuItem>
          <DropdownMenuItem
            variant={archived ? "default" : "destructive"}
            onSelect={() =>
              startTransition(async () => {
                const result = await setProductArchived(product.id, !archived);
                if (result.success) toast.success(result.message);
                else toast.error(result.message);
              })
            }
          >
            {archived ? "Restore" : "Archive"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <EditProductDialog product={product} open={editing} onOpenChange={setEditing} />
    </>
  );
}
