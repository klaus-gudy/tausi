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
import { InputGroup } from "@/components/ui/input-group";
import { Textarea } from "@/components/ui/textarea";
import { useFormAction } from "@/hooks/use-form-action";
import type { ActionResult } from "@/lib/inventory";

export type EditableProduct = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  price: number;
  reorderLevel: number | null;
  description: string | null;
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
          Stock on hand isn&apos;t set here: it comes from what you receive and issue.
        </DialogDescription>
      </DialogHeader>
      {product ? <input type="hidden" name="id" value={product.id} /> : null}
      <FieldGroup className="py-4">
        <div className="grid gap-5 sm:grid-cols-[10rem_1fr]">
          <Field>
            <FieldLabel htmlFor="product-sku">SKU</FieldLabel>
            <Input
              id="product-sku"
              name="sku"
              defaultValue={product?.sku}
              placeholder="TS-001"
              autoComplete="off"
              maxLength={40}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="product-name">Name</FieldLabel>
            <Input
              id="product-name"
              name="name"
              defaultValue={product?.name}
              placeholder="Sunflower oil 1L"
              autoComplete="off"
              maxLength={200}
              required
            />
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="product-unit">Unit</FieldLabel>
            <Input
              id="product-unit"
              name="unit"
              defaultValue={product?.unit ?? "piece"}
              placeholder="piece"
              autoComplete="off"
              maxLength={30}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="product-price">Price per unit</FieldLabel>
            <InputGroup>
              <MoneyInput
                id="product-price"
                name="price"
                defaultValue={product ? String(product.price) : ""}
                placeholder="0"
              />
            </InputGroup>
          </Field>
          <Field>
            <FieldLabel htmlFor="product-reorder">Reorder level</FieldLabel>
            <Input
              id="product-reorder"
              name="reorderLevel"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              defaultValue={product?.reorderLevel ?? ""}
              placeholder="Off"
            />
          </Field>
        </div>
        <FieldDescription className="-mt-3">
          Stock at or below the reorder level is flagged as low.
        </FieldDescription>
        <Field>
          <FieldLabel htmlFor="product-description">Description</FieldLabel>
          <Textarea
            id="product-description"
            name="description"
            defaultValue={product?.description ?? ""}
            maxLength={1000}
            rows={2}
          />
        </Field>
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
