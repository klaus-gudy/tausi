"use client";

import { Send } from "lucide-react";

import { initiateTransfer } from "./actions";
import {
  FormDialog,
  ProductLines,
  today,
  useDialogAction,
  type StockProduct,
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
}: {
  products: StockProduct[];
  salespeople: TransferSalesperson[];
}) {
  return (
    <FormDialog label="New transfer" icon={<Send data-icon="inline-start" />}>
      {(close) => <TransferForm products={products} salespeople={salespeople} onDone={close} />}
    </FormDialog>
  );
}

function TransferForm({
  products,
  salespeople,
  onDone,
}: {
  products: StockProduct[];
  salespeople: TransferSalesperson[];
  onDone: () => void;
}) {
  const [state, onSubmit, pending] = useDialogAction(initiateTransfer, onDone);
  const day = today();
  const inStock = products.filter((product) => product.onHand > 0);

  return (
    <form onSubmit={onSubmit}>
      <DialogHeader>
        <DialogTitle>Send stock to a salesperson</DialogTitle>
        <DialogDescription>
          The stock comes off stock on hand now. Mark the transfer in transit when it leaves, and
          arrived when the salesperson has it.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup className="py-4">
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
          <ProductLines products={inStock} withCost={false} showOnHand />
        ) : (
          <FieldDescription>Nothing is on hand to send. Receive stock first.</FieldDescription>
        )}
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
