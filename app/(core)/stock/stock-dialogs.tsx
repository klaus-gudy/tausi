"use client";

import { Fragment, useRef, useState } from "react";
import { format } from "date-fns";
import { ClipboardCheck, PackagePlus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { addSupplier, adjustStock, receiveStock, type Supplier } from "./actions";
import { DatePicker } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxSeparator,
} from "@/components/ui/combobox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCount } from "@/lib/format";
import { useFormAction } from "@/hooks/use-form-action";
import type { ActionResult } from "@/lib/inventory";

export type StockProduct = {
  id: string;
  name: string;
  code: string;
  size: string | null;
  onHand: number;
};
export type StockWarehouse = { id: string; name: string };
/** Stock on hand per warehouse id, then per product id; missing entries are 0. */
export type StockLevels = Record<string, Record<string, number>>;

type Action = (previous: ActionResult, formData: FormData) => Promise<ActionResult>;

const initialState: ActionResult = { message: "" };

/** Today in the browser's time zone, which may differ from the server's. */
export const today = () => format(new Date(), "yyyy-MM-dd");

/** A button that opens a dialog holding a fresh form each time. */
export function FormDialog({
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
export function useDialogAction(action: Action, onDone: () => void) {
  return useFormAction(async (previous: ActionResult, formData: FormData) => {
    const result = await action(previous, formData);
    if (result.success) {
      toast.success(result.message);
      onDone();
    }
    return result;
  }, initialState);
}

/**
 * Product rows for a receive, transfer or delivery form; submits parallel
 * productId/quantity fields. A product picked on one line isn't offered on
 * the others.
 */
export function ProductLines({
  products,
  showOnHand,
  onHandLabel = "on hand",
}: {
  products: StockProduct[];
  showOnHand: boolean;
  /** What the count next to each product is, e.g. "with you". */
  onHandLabel?: string;
}) {
  const nextKey = useRef(1);
  const [lines, setLines] = useState([{ key: 0, productId: "" }]);
  const picked = new Set(lines.map((line) => line.productId).filter(Boolean));
  // Another line only once every line has its product and some are left to pick.
  const canAdd = picked.size === lines.length && picked.size < products.length;
  const pick = (key: number, productId: string) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, productId } : line)));

  return (
    <FieldSet>
      <FieldLegend variant="label">Products</FieldLegend>
      <div className="grid gap-2">
        {lines.map((line, index) => (
          <div key={line.key} className="grid grid-cols-[minmax(0,1fr)_6rem_auto] gap-2">
            <input type="hidden" name="productId" value={line.productId} />
            <Select value={line.productId} onValueChange={(productId) => pick(line.key, productId)}>
              <SelectTrigger aria-label={`Product, line ${index + 1}`} className="w-full">
                <SelectValue placeholder="Pick a product" />
              </SelectTrigger>
              <SelectContent>
                {products
                  .filter((product) => product.id === line.productId || !picked.has(product.id))
                  .map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                      {product.size ? ` · ${product.size}` : ""}
                      <span className="text-muted-foreground">
                        {product.code}
                        {showOnHand ? ` · ${formatCount(product.onHand)} ${onHandLabel}` : ""}
                      </span>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
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
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove line ${index + 1}`}
              disabled={lines.length === 1}
              onClick={() => setLines((current) => current.filter((other) => other.key !== line.key))}
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
          disabled={!canAdd}
          onClick={() => setLines((current) => [...current, { key: nextKey.current++, productId: "" }])}
        >
          <Plus data-icon="inline-start" />
          Add another product
        </Button>
      </div>
    </FieldSet>
  );
}

/** Units on hand in a warehouse, all products together. */
export function unitsIn(stock: StockLevels, warehouseId: string) {
  return Object.values(stock[warehouseId] ?? {}).reduce((sum, quantity) => sum + quantity, 0);
}

/** The products with what's on hand in `warehouseId`. */
export function productsIn(products: StockProduct[], stock: StockLevels, warehouseId: string) {
  return products.map((product) => ({ ...product, onHand: stock[warehouseId]?.[product.id] ?? 0 }));
}

/** A stock form's warehouse picker; submits warehouseId. Shows units on hand when given `stock`. */
export function WarehouseField({
  id,
  warehouses,
  value,
  onChange,
  stock,
}: {
  id: string;
  warehouses: StockWarehouse[];
  value: string;
  onChange: (warehouseId: string) => void;
  stock?: StockLevels;
}) {
  if (!warehouses.length) {
    return <FieldDescription>Add a warehouse under Warehouses first.</FieldDescription>;
  }
  return (
    <Field>
      <FieldLabel htmlFor={id}>Warehouse</FieldLabel>
      <input type="hidden" name="warehouseId" value={value} />
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="Pick a warehouse" />
        </SelectTrigger>
        <SelectContent>
          {warehouses.map((warehouse) => (
            <SelectItem key={warehouse.id} value={warehouse.id}>
              {warehouse.name}
              {stock ? (
                <span className="text-muted-foreground">
                  {formatCount(unitsIn(stock, warehouse.id))} units on hand
                </span>
              ) : null}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

/** A supplier on the list, or the name typed in offered to be added. */
type SupplierOption = Supplier & { isNew?: boolean };

/** Lowercase with spaces collapsed, for comparing supplier names. */
const supplierKey = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * The receive form's supplier picker; submits supplierId. Typing a name
 * that isn't on the list offers to add it, as the last option. Left empty,
 * the receipt is filed under "Manufactured".
 */
function SupplierField({
  id,
  suppliers: initialSuppliers,
  onAddingChange,
}: {
  id: string;
  suppliers: Supplier[];
  onAddingChange: (adding: boolean) => void;
}) {
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [value, setValue] = useState<Supplier | null>(null);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);

  const typed = query.trim().replace(/\s+/g, " ");
  const match = suppliers.find((supplier) => supplierKey(supplier.name) === supplierKey(typed));
  // While the input shows the pick, the whole list is offered again.
  const shown =
    value && query === value.name
      ? suppliers
      : suppliers.filter((supplier) => supplierKey(supplier.name).includes(supplierKey(typed)));
  const options: SupplierOption[] =
    typed && !match ? [...shown, { id: "", name: typed, isNew: true }] : shown;

  async function add(name: string) {
    setAdding(true);
    onAddingChange(true);
    try {
      const result = await addSupplier(name);
      if (!result.supplier) {
        toast.error(result.message);
        setQuery(value?.name ?? "");
        return;
      }
      const supplier = result.supplier;
      toast.success(result.message);
      setSuppliers((current) =>
        current.some((other) => other.id === supplier.id)
          ? current
          : [...current, supplier].sort((a, b) => a.name.localeCompare(b.name))
      );
      setValue(supplier);
      setQuery(supplier.name);
    } finally {
      setAdding(false);
      onAddingChange(false);
    }
  }

  return (
    <Field>
      <FieldLabel htmlFor={id}>Supplier</FieldLabel>
      <input type="hidden" name="supplierId" value={value?.id ?? ""} />
      <Combobox<SupplierOption>
        items={options}
        filteredItems={options}
        value={value}
        onValueChange={(next) => {
          if (next?.isNew) void add(next.name);
          else setValue(next);
        }}
        inputValue={query}
        onInputValueChange={setQuery}
        onOpenChange={(open, details) => {
          if (open || details.reason === "item-press") return;
          // Leaving the field settles what was typed: a supplier's name picks
          // it, anything else goes back to the last pick.
          if (!typed) setValue(null);
          else if (match) {
            setValue(match);
            setQuery(match.name);
          } else setQuery(value?.name ?? "");
        }}
        itemToStringLabel={(option) => option.name}
        isItemEqualToValue={(option, other) => option.id === other.id && !option.isNew}
      >
        <ComboboxInput
          id={id}
          className="w-full"
          placeholder="Manufactured"
          autoComplete="off"
          maxLength={200}
          disabled={adding}
        />
        <ComboboxContent>
          <ComboboxEmpty>Type a name to add a supplier.</ComboboxEmpty>
          <ComboboxList>
            {(option: SupplierOption) =>
              option.isNew ? (
                <Fragment key="new">
                  {shown.length ? <ComboboxSeparator /> : null}
                  <ComboboxItem value={option}>
                    <Plus />
                    Add &ldquo;{option.name}&rdquo;
                  </ComboboxItem>
                </Fragment>
              ) : (
                <ComboboxItem key={option.id} value={option}>
                  {option.name}
                </ComboboxItem>
              )
            }
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </Field>
  );
}

export function ReceiveStockDialog({
  products,
  warehouses,
  suppliers,
}: {
  products: StockProduct[];
  warehouses: StockWarehouse[];
  suppliers: Supplier[];
}) {
  return (
    <FormDialog label="Receive stock" icon={<PackagePlus data-icon="inline-start" />}>
      {(close) => (
        <ReceiveForm products={products} warehouses={warehouses} suppliers={suppliers} onDone={close} />
      )}
    </FormDialog>
  );
}

function ReceiveForm({
  products,
  warehouses,
  suppliers,
  onDone,
}: {
  products: StockProduct[];
  warehouses: StockWarehouse[];
  suppliers: Supplier[];
  onDone: () => void;
}) {
  const [state, onSubmit, pending] = useDialogAction(receiveStock, onDone);
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [addingSupplier, setAddingSupplier] = useState(false);
  const day = today();

  return (
    <form onSubmit={onSubmit}>
      <DialogHeader>
        <DialogTitle>Receive stock</DialogTitle>
        <DialogDescription>Record what arrived from a supplier. It adds to stock on hand.</DialogDescription>
      </DialogHeader>
      <FieldGroup className="py-4">
        <WarehouseField
          id="receive-warehouse"
          warehouses={warehouses}
          value={warehouseId}
          onChange={setWarehouseId}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <SupplierField
            id="receive-supplier"
            suppliers={suppliers}
            onAddingChange={setAddingSupplier}
          />
          <Field>
            <FieldLabel htmlFor="receive-day">Received on</FieldLabel>
            <DatePicker id="receive-day" name="occurredOn" defaultValue={day} maxDate={day} />
          </Field>
        </div>
        <ProductLines products={products} showOnHand={false} />
        {state.message && !state.success ? <FieldError>{state.message}</FieldError> : null}
      </FieldGroup>
      <DialogFooter>
        <Button type="submit" disabled={pending || addingSupplier || !warehouseId}>
          {pending ? "Recording…" : "Record receipt"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function AdjustStockDialog({
  products,
  warehouses,
  stock,
}: {
  products: StockProduct[];
  warehouses: StockWarehouse[];
  stock: StockLevels;
}) {
  return (
    <FormDialog
      label="Stock count"
      variant="outline"
      icon={<ClipboardCheck data-icon="inline-start" />}
    >
      {(close) => (
        <AdjustForm products={products} warehouses={warehouses} stock={stock} onDone={close} />
      )}
    </FormDialog>
  );
}

function AdjustForm({
  products,
  warehouses,
  stock,
  onDone,
}: {
  products: StockProduct[];
  warehouses: StockWarehouse[];
  stock: StockLevels;
  onDone: () => void;
}) {
  const [state, onSubmit, pending] = useDialogAction(adjustStock, onDone);
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [productId, setProductId] = useState("");
  const warehouse = warehouses.find((other) => other.id === warehouseId);
  const product = productsIn(products, stock, warehouseId).find((other) => other.id === productId);
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
        <WarehouseField
          id="adjust-warehouse"
          warehouses={warehouses}
          value={warehouseId}
          onChange={setWarehouseId}
        />
        <Field>
          <FieldLabel htmlFor="adjust-product">Product</FieldLabel>
          <input type="hidden" name="productId" value={productId} />
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger id="adjust-product" className="w-full">
              <SelectValue placeholder="Pick a product" />
            </SelectTrigger>
            <SelectContent>
              {products.map((other) => (
                <SelectItem key={other.id} value={other.id}>
                  {other.name}
                  <span className="text-muted-foreground">{other.code}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {product ? (
            <FieldDescription>
              The system shows {formatCount(product.onHand)} on hand
              {warehouse ? ` in ${warehouse.name}` : ""}.
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
        <Button type="submit" disabled={pending || !warehouse}>
          {pending ? "Saving…" : "Save count"}
        </Button>
      </DialogFooter>
    </form>
  );
}
