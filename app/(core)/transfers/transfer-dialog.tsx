"use client";

import { Send } from "lucide-react";

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
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

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
      <FieldGroup className="py-4">
        <WarehouseField
          id="transfer-warehouse"
          warehouses={warehouses}
          value={warehouseId}
          onChange={setWarehouseId}
          stock={stock}
        />
        <div className="grid gap-5 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="transfer-salesperson">Salesperson</FieldLabel>
            <NativeSelect
              id="transfer-salesperson"
              name="salespersonId"
              defaultValue=""
              className="w-full"
              required
            >
              <NativeSelectOption value="" disabled>
                Pick a salesperson
              </NativeSelectOption>
              {salespeople.map((salesperson) => (
                <NativeSelectOption key={salesperson.id} value={salesperson.id}>
                  {salesperson.name}
                  {salesperson.zone ? ` · ${salesperson.zone}` : ""}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="transfer-reference">Dispatch note / vehicle</FieldLabel>
            <Input
              id="transfer-reference"
              name="reference"
              placeholder="T 123 ABC"
              autoComplete="off"
              maxLength={100}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="transfer-day">Picked on</FieldLabel>
            <DatePicker id="transfer-day" name="initiatedOn" defaultValue={day} maxDate={day} />
          </Field>
        </div>
        {inStock.length ? (
          // Lines picked from one warehouse don't carry over to another.
          <ProductLines key={warehouseId} products={inStock} withCost={false} showOnHand />
        ) : warehouse ? (
          <FieldDescription>Nothing is on hand in {warehouse.name} to send. Receive stock first.</FieldDescription>
        ) : null}
        <Field>
          <FieldLabel htmlFor="transfer-note">Note</FieldLabel>
          <Textarea id="transfer-note" name="note" maxLength={1000} rows={2} />
        </Field>
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
