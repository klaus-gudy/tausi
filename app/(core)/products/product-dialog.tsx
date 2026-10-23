"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { saveProduct } from "./actions";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupText } from "@/components/ui/input-group";
import { useFormAction } from "@/hooks/use-form-action";
import type { ActionResult } from "@/lib/inventory";
import { productCode } from "@/lib/product-code";

export type EditableProduct = {
  id: string;
  code: string;
  name: string;
  size: string | null;
  sellingPrice: number;
};

const initialState: ActionResult = { message: "" };

/** The "Add product" button and its dialog. */
export function AddProductDialog() {
  const [open, setOpen] = useState(false);
  // Remounting the form clears it for the next product.
  const [formKey, setFormKey] = useState(0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setFormKey((key) => key + 1);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus data-icon="inline-start" />
          Add product
        </Button>
      </DialogTrigger>
      <DialogContent>
        <ProductForm key={formKey} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

/** Edits a product; opened from its row menu. */
export function EditProductDialog({
  product,
  open,
  onOpenChange,
}: {
  product: EditableProduct;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? <ProductForm product={product} onSaved={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ProductForm({
  product,
  onSaved,
}: {
  product?: EditableProduct;
  onSaved: () => void;
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [size, setSize] = useState(product?.size ?? "");
  const [state, onSubmit, pending] = useFormAction(
    async (previous: ActionResult, formData: FormData) => {
      const result = await saveProduct(previous, formData);
      if (result.success) {
        toast.success(result.message);
        onSaved();
      }
      return result;
    },
    initialState
  );

  return (
    <form onSubmit={onSubmit}>
      <DialogHeader>
        <DialogTitle>{product ? `Edit ${product.name}` : "Add a product"}</DialogTitle>
        <DialogDescription>
          {product
            ? "Change its name, size or selling price."
            : "Stock on hand isn't set here: it comes from what you receive and issue."}
        </DialogDescription>
      </DialogHeader>
      {product ? <input type="hidden" name="id" value={product.id} /> : null}
      <FieldGroup className="py-4">
        <Field>
          <FieldLabel htmlFor="product-name">Name</FieldLabel>
          <Input
            id="product-name"
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Sunflower oil"
            autoComplete="off"
            maxLength={200}
            required
          />
          <FieldDescription>
            Code:{" "}
            <span className="font-mono text-foreground">
              {product ? product.code : productCode(name, size) || "—"}
            </span>
            {product ? " (stays the same if you rename it)" : " (made from the name and size)"}
          </FieldDescription>
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="product-size">Size</FieldLabel>
            <Input
              id="product-size"
              name="size"
              value={size}
              onChange={(event) => setSize(event.target.value)}
              placeholder="1L"
              autoComplete="off"
              maxLength={30}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="product-price">Selling price</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>TZS</InputGroupText>
              </InputGroupAddon>
              <MoneyInput
                id="product-price"
                name="sellingPrice"
                defaultValue={product ? String(product.sellingPrice) : ""}
                placeholder="0"
              />
            </InputGroup>
          </Field>
        </div>
        {state.message && !state.success ? <FieldError>{state.message}</FieldError> : null}
      </FieldGroup>
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : product ? "Save changes" : "Add product"}
        </Button>
      </DialogFooter>
    </form>
  );
}
