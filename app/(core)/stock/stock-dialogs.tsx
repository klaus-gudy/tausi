"use client";

import { useRef, useState } from "react";
import { format } from "date-fns";
import { ClipboardCheck, PackageMinus, PackagePlus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { adjustStock, issueStock, receiveStock } from "./actions";
import { DatePicker } from "@/components/date-picker";
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
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup } from "@/components/ui/input-group";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { formatCount } from "@/lib/format";
import { useFormAction } from "@/hooks/use-form-action";
import type { ActionResult } from "@/lib/inventory";

export type StockProduct = { id: string; name: string; sku: string; unit: string; onHand: number };
export type StockDealer = { id: string; name: string; region: string | null };

type Action = (previous: ActionResult, formData: FormData) => Promise<ActionResult>;

const initialState: ActionResult = { message: "" };

/** Today in the browser's time zone, which may differ from the server's. */
const today = () => format(new Date(), "yyyy-MM-dd");

/** A button that opens a dialog holding a fresh form each time. */
function FormDialog({
  label,
  icon,
  variant,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  variant?: "default" | "outline";
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
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
        <Button variant={variant}>
          {icon}
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <div key={formKey} className="contents">
          {children(() => setOpen(false))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Runs `action`, and on success shows its message and closes the dialog. */
function useDialogAction(action: Action, onDone: () => void) {
  return useFormAction(async (previous: ActionResult, formData: FormData) => {
    const result = await action(previous, formData);
    if (result.success) {
      toast.success(result.message);
      onDone();
    }
    return result;
  }, initialState);
}

/** Product rows for a receive or issue form; submits parallel productId/quantity fields. */
function ProductLines({
  products,
  withCost,
  showOnHand,
}: {
  products: StockProduct[];
  withCost: boolean;
  showOnHand: boolean;
}) {
  const nextKey = useRef(1);
  const [lines, setLines] = useState([0]);

  return (
    <FieldSet>
      <FieldLegend variant="label">Products</FieldLegend>
      <div className="grid gap-2">
        {lines.map((key, index) => (
          <div
            key={key}
            className={
              withCost
                ? "grid grid-cols-[1fr_5.5rem_auto] gap-2 sm:grid-cols-[1fr_6rem_8rem_auto]"
                : "grid grid-cols-[1fr_6rem_auto] gap-2"
            }
          >
            <NativeSelect
              name="productId"
              aria-label={`Product, line ${index + 1}`}
              defaultValue=""
              className="w-full"
              required={index === 0}
            >
              <NativeSelectOption value="" disabled>
                Pick a product
              </NativeSelectOption>
              {products.map((product) => (
                <NativeSelectOption key={product.id} value={product.id}>
                  {product.name} ({product.sku})
                  {showOnHand ? ` · ${formatCount(product.onHand)} on hand` : ""}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <Input
              name="quantity"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              placeholder="Qty"
              aria-label={`Quantity, line ${index + 1}`}
              required={index === 0}
            />
            {withCost ? (
              <InputGroup className="col-span-2 sm:col-span-1 sm:col-start-3 row-start-2 sm:row-start-1">
                <MoneyInput
                  name="unitCost"
                  placeholder="Unit cost"
                  aria-label={`Unit cost, line ${index + 1}`}
                />
              </InputGroup>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove line ${index + 1}`}
              disabled={lines.length === 1}
              onClick={() => setLines((current) => current.filter((other) => other !== key))}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
      </div>
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setLines((current) => [...current, nextKey.current++])}
        >
          <Plus data-icon="inline-start" />
          Add another product
        </Button>
      </div>
    </FieldSet>
  );
}

export function ReceiveStockDialog({ products }: { products: StockProduct[] }) {
  return (
    <FormDialog label="Receive stock" icon={<PackagePlus data-icon="inline-start" />}>
      {(close) => <ReceiveForm products={products} onDone={close} />}
    </FormDialog>
  );
}

function ReceiveForm({ products, onDone }: { products: StockProduct[]; onDone: () => void }) {
  const [state, onSubmit, pending] = useDialogAction(receiveStock, onDone);
  const day = today();

  return (
    <form onSubmit={onSubmit}>
      <DialogHeader>
        <DialogTitle>Receive stock</DialogTitle>
        <DialogDescription>Record what arrived from a supplier. It adds to stock on hand.</DialogDescription>
      </DialogHeader>
      <FieldGroup className="py-4">
        <div className="grid gap-5 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="receive-supplier">Supplier</FieldLabel>
            <Input id="receive-supplier" name="supplier" autoComplete="off" maxLength={200} />
          </Field>
          <Field>
            <FieldLabel htmlFor="receive-reference">Delivery note / invoice</FieldLabel>
            <Input id="receive-reference" name="reference" autoComplete="off" maxLength={100} />
          </Field>
          <Field>
            <FieldLabel htmlFor="receive-day">Received on</FieldLabel>
            <DatePicker id="receive-day" name="occurredOn" defaultValue={day} maxDate={day} />
          </Field>
        </div>
        <ProductLines products={products} withCost showOnHand={false} />
        <Field>
          <FieldLabel htmlFor="receive-note">Note</FieldLabel>
          <Textarea id="receive-note" name="note" maxLength={1000} rows={2} />
        </Field>
        {state.message && !state.success ? <FieldError>{state.message}</FieldError> : null}
      </FieldGroup>
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Recording…" : "Record receipt"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function IssueStockDialog({
  products,
  dealers,
}: {
  products: StockProduct[];
  dealers: StockDealer[];
}) {
  return (
    <FormDialog
      label="Issue to dealer"
      variant="outline"
      icon={<PackageMinus data-icon="inline-start" />}
    >
      {(close) => <IssueForm products={products} dealers={dealers} onDone={close} />}
    </FormDialog>
  );
}

function IssueForm({
  products,
  dealers,
  onDone,
}: {
  products: StockProduct[];
  dealers: StockDealer[];
  onDone: () => void;
}) {
  const [state, onSubmit, pending] = useDialogAction(issueStock, onDone);
  const day = today();
  const inStock = products.filter((product) => product.onHand > 0);

  return (
    <form onSubmit={onSubmit}>
      <DialogHeader>
        <DialogTitle>Issue stock to a super dealer</DialogTitle>
        <DialogDescription>Record stock leaving the store. It comes off stock on hand.</DialogDescription>
      </DialogHeader>
      <FieldGroup className="py-4">
        <div className="grid gap-5 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="issue-dealer">Super dealer</FieldLabel>
            <NativeSelect
              id="issue-dealer"
              name="superDealerId"
              defaultValue=""
              className="w-full"
              required
            >
              <NativeSelectOption value="" disabled>
                Pick a dealer
              </NativeSelectOption>
              {dealers.map((dealer) => (
                <NativeSelectOption key={dealer.id} value={dealer.id}>
                  {dealer.name}
                  {dealer.region ? ` · ${dealer.region}` : ""}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="issue-reference">Dispatch number</FieldLabel>
            <Input id="issue-reference" name="reference" autoComplete="off" maxLength={100} />
          </Field>
          <Field>
            <FieldLabel htmlFor="issue-day">Issued on</FieldLabel>
            <DatePicker id="issue-day" name="occurredOn" defaultValue={day} maxDate={day} />
          </Field>
        </div>
        {inStock.length ? (
          <ProductLines products={inStock} withCost={false} showOnHand />
        ) : (
          <FieldDescription>Nothing is in stock. Receive stock first.</FieldDescription>
        )}
        <Field>
          <FieldLabel htmlFor="issue-note">Note</FieldLabel>
          <Textarea id="issue-note" name="note" maxLength={1000} rows={2} />
        </Field>
        {state.message && !state.success ? <FieldError>{state.message}</FieldError> : null}
      </FieldGroup>
      <DialogFooter>
        <Button type="submit" disabled={pending || !inStock.length}>
          {pending ? "Recording…" : "Record issue"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function AdjustStockDialog({ products }: { products: StockProduct[] }) {
  return (
    <FormDialog
      label="Stock count"
      variant="outline"
      icon={<ClipboardCheck data-icon="inline-start" />}
    >
      {(close) => <AdjustForm products={products} onDone={close} />}
    </FormDialog>
  );
}

function AdjustForm({ products, onDone }: { products: StockProduct[]; onDone: () => void }) {
  const [state, onSubmit, pending] = useDialogAction(adjustStock, onDone);
  const [productId, setProductId] = useState("");
  const product = products.find((other) => other.id === productId);
  const day = today();

  return (
    <form onSubmit={onSubmit}>
      <DialogHeader>
        <DialogTitle>Correct stock after a count</DialogTitle>
        <DialogDescription>
          Enter what&apos;s on the shelf. The difference is recorded as an adjustment.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup className="py-4">
        <Field>
          <FieldLabel htmlFor="adjust-product">Product</FieldLabel>
          <NativeSelect
            id="adjust-product"
            name="productId"
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
            className="w-full"
            required
          >
            <NativeSelectOption value="" disabled>
              Pick a product
            </NativeSelectOption>
            {products.map((other) => (
              <NativeSelectOption key={other.id} value={other.id}>
                {other.name} ({other.sku})
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {product ? (
            <FieldDescription>
              The system shows {formatCount(product.onHand)} on hand.
            </FieldDescription>
          ) : null}
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="adjust-counted">Counted quantity</FieldLabel>
            <Input
              id="adjust-counted"
              name="counted"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="adjust-day">Counted on</FieldLabel>
            <DatePicker id="adjust-day" name="occurredOn" defaultValue={day} maxDate={day} />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="adjust-note">Reason</FieldLabel>
          <Textarea
            id="adjust-note"
            name="note"
            placeholder="Damaged in storage, recount, found in back room…"
            maxLength={1000}
            rows={2}
            required
          />
        </Field>
        {state.message && !state.success ? <FieldError>{state.message}</FieldError> : null}
      </FieldGroup>
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save count"}
        </Button>
      </DialogFooter>
    </form>
  );
}
