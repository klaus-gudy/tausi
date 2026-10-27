"use client";

import { useState } from "react";
import { Package, Store, Truck } from "lucide-react";

import { recordDelivery } from "./actions";
import {
  FormDialog,
  ProductLines,
  today,
  useDialogAction,
  type StockProduct,
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
      <FieldGroup className="gap-4 py-4">
        <FormSection icon={Store} title="Dealer" description="Who you supplied and on what day.">
          <div className="grid gap-4 sm:grid-cols-2">
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
              <FieldLabel htmlFor="delivery-day">Delivered on</FieldLabel>
              <DatePicker id="delivery-day" name="deliveredOn" defaultValue={day} maxDate={day} />
            </Field>
          </div>
        </FormSection>
        <FormSection icon={Package} title="Stock supplied" description="What you handed over, from the stock you hold.">
          <ProductLines products={products} showOnHand onHandLabel="with you" />
        </FormSection>
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
