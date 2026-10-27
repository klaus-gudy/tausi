"use client";

import { Package, Route, Send } from "lucide-react";

import { initiateTransfer } from "./actions";
import { useState } from "react";

import {
  FormDialog,
  ProductLines,
  productsIn,
  today,
  unitsIn,
  useDialogAction,
  WarehouseField,
  type StockLevels,
  type StockProduct,
  type StockWarehouse,
} from "../stock/stock-dialogs";
import { DatePicker } from "@/components/date-picker";
import { FormSection } from "@/components/form-section";
import { Button } from "@/components/ui/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type TransferSalesperson = { id: string; name: string; zone: string | null };

export function InitiateTransferDialog({
  products,
  salespeople,
  warehouses,
  stock,
}: {
  products: StockProduct[];
  salespeople: TransferSalesperson[];
  warehouses: StockWarehouse[];
  stock: StockLevels;
}) {
  return (
    <FormDialog label="New transfer" icon={<Send data-icon="inline-start" />}>
      {(close) => (
        <TransferForm
          products={products}
          salespeople={salespeople}
          warehouses={warehouses}
          stock={stock}
          onDone={close}
        />
      )}
    </FormDialog>
  );
}

function TransferForm({
  products,
  salespeople,
  warehouses,
  stock,
  onDone,
}: {
  products: StockProduct[];
  salespeople: TransferSalesperson[];
  warehouses: StockWarehouse[];
  stock: StockLevels;
  onDone: () => void;
}) {
  const [state, onSubmit, pending] = useDialogAction(initiateTransfer, onDone);
  // Start from the first warehouse that has anything to send.
  const [warehouseId, setWarehouseId] = useState(
    () => (warehouses.find((warehouse) => unitsIn(stock, warehouse.id) > 0) ?? warehouses[0])?.id ?? ""
  );
  const [salespersonId, setSalespersonId] = useState("");
  const warehouse = warehouses.find((other) => other.id === warehouseId);
  const day = today();
  const inStock = productsIn(products, stock, warehouseId).filter((product) => product.onHand > 0);

  return (
    <form onSubmit={onSubmit}>
      <DialogHeader>
        <DialogTitle>Send stock to a salesperson</DialogTitle>
        <DialogDescription>
          The stock comes off the warehouse&apos;s stock on hand now. Mark the transfer in transit
          when it leaves, and arrived when the salesperson has it.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup className="gap-4 py-4">
        <FormSection icon={Route} title="From and to" description="The warehouse it leaves and who it goes to.">
          <div className="grid gap-4 sm:grid-cols-2">
            <WarehouseField
              id="transfer-warehouse"
              warehouses={warehouses}
              value={warehouseId}
              onChange={setWarehouseId}
              stock={stock}
            />
            <Field>
              <FieldLabel htmlFor="transfer-salesperson">Salesperson</FieldLabel>
              <input type="hidden" name="salespersonId" value={salespersonId} />
              <Select value={salespersonId} onValueChange={setSalespersonId}>
                <SelectTrigger id="transfer-salesperson" className="w-full">
                  <SelectValue placeholder="Pick a salesperson" />
                </SelectTrigger>
                <SelectContent>
                  {salespeople.map((salesperson) => (
                    <SelectItem key={salesperson.id} value={salesperson.id}>
                      {salesperson.name}
                      {salesperson.zone ? (
                        <span className="text-muted-foreground">{salesperson.zone}</span>
                      ) : null}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="transfer-day">Picked on</FieldLabel>
            <DatePicker id="transfer-day" name="initiatedOn" defaultValue={day} maxDate={day} />
          </Field>
        </FormSection>
        <FormSection icon={Package} title="Stock to send" description="What's going, from what the warehouse has on hand.">
          {inStock.length ? (
            // Lines picked from one warehouse don't carry over to another.
            <ProductLines key={warehouseId} products={inStock} showOnHand />
          ) : (
            <FieldDescription>
              {warehouse ? `Nothing is on hand in ${warehouse.name} to send. Receive stock first.` : "Pick a warehouse first."}
            </FieldDescription>
          )}
        </FormSection>
        {state.message && !state.success ? <FieldError>{state.message}</FieldError> : null}
      </FieldGroup>
      <DialogFooter>
        <Button type="submit" disabled={pending || !inStock.length || !salespeople.length}>
          {pending ? "Sending…" : "Initiate transfer"}
        </Button>
      </DialogFooter>
    </form>
  );
}
