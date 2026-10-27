"use client";

import { useState } from "react";
import { Truck } from "lucide-react";

import { recordDelivery } from "./actions";
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type DeliveryDealer = { id: string; name: string; place: string | null };

/** For a salesperson: supply a super dealer from the stock they hold. */
export function RecordDeliveryDialog({
  products,
  dealers,
}: {
  /** What the salesperson holds; onHand is their count. */
  products: StockProduct[];
  dealers: DeliveryDealer[];
}) {
  return (
    <FormDialog label="Supply a dealer" icon={<Truck data-icon="inline-start" />}>
      {(close) => <DeliveryForm products={products} dealers={dealers} onDone={close} />}
    </FormDialog>
  );
}

function DeliveryForm({
  products,
  dealers,
  onDone,
}: {
  products: StockProduct[];
  dealers: DeliveryDealer[];
  onDone: () => void;
}) {
  const [state, onSubmit, pending] = useDialogAction(recordDelivery, onDone);
  const [dealerId, setDealerId] = useState("");
  const day = today();

  return (
    <form onSubmit={onSubmit}>
      <DialogHeader>
        <DialogTitle>Supply a super dealer</DialogTitle>
        <DialogDescription>Record what you handed over. It comes off the stock you hold.</DialogDescription>
      </DialogHeader>
      <FieldGroup className="py-4">
        <div className="grid gap-5 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="delivery-dealer">Super dealer</FieldLabel>
            <input type="hidden" name="superDealerId" value={dealerId} />
            <Select value={dealerId} onValueChange={setDealerId}>
              <SelectTrigger id="delivery-dealer" className="w-full">
                <SelectValue placeholder="Pick a dealer" />
              </SelectTrigger>
              <SelectContent>
                {dealers.map((dealer) => (
                  <SelectItem key={dealer.id} value={dealer.id}>
                    {dealer.name}
                    {dealer.place ? <span className="text-muted-foreground">{dealer.place}</span> : null}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="delivery-reference">Delivery note / receipt</FieldLabel>
            <Input id="delivery-reference" name="reference" autoComplete="off" maxLength={100} />
          </Field>
          <Field>
            <FieldLabel htmlFor="delivery-day">Delivered on</FieldLabel>
            <DatePicker id="delivery-day" name="deliveredOn" defaultValue={day} maxDate={day} />
          </Field>
        </div>
        <ProductLines products={products} withCost={false} showOnHand onHandLabel="with you" />
        <Field>
          <FieldLabel htmlFor="delivery-note">Note</FieldLabel>
          <Textarea id="delivery-note" name="note" maxLength={1000} rows={2} />
        </Field>
        {state.message && !state.success ? <FieldError>{state.message}</FieldError> : null}
      </FieldGroup>
      <DialogFooter>
        <Button type="submit" disabled={pending || !dealers.length}>
          {pending ? "Recording…" : "Record delivery"}
        </Button>
      </DialogFooter>
    </form>
  );
}
