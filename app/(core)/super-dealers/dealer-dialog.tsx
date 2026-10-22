"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { saveSuperDealer } from "./actions";
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
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useFormAction } from "@/hooks/use-form-action";
import { formatPhone, type PlaceZone } from "@/lib/dealers";
import type { ActionResult } from "@/lib/inventory";

export type EditableDealer = {
  id: string;
  shopName: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  regionKey: string | null;
  districtKey: string | null;
  tin: string | null;
  businessLicence: string | null;
  address: string | null;
  notes: string | null;
};

const initialState: ActionResult = { message: "" };

/** The "Add dealer" button and its dialog. */
export function AddDealerDialog({ places }: { places: PlaceZone[] }) {
  const [open, setOpen] = useState(false);
  // Remounting the form clears it for the next dealer.
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
          Add dealer
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DealerForm key={formKey} places={places} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

/** Edits a dealer; opened from its row menu. */
export function EditDealerDialog({
  dealer,
  places,
  open,
  onOpenChange,
}: {
  dealer: EditableDealer;
  places: PlaceZone[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? <DealerForm dealer={dealer} places={places} onSaved={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function DealerForm({
  dealer,
  places,
  onSaved,
}: {
  dealer?: EditableDealer;
  places: PlaceZone[];
  onSaved: () => void;
}) {
  const [state, onSubmit, pending] = useFormAction(
    async (previous: ActionResult, formData: FormData) => {
      const result = await saveSuperDealer(previous, formData);
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
        <DialogTitle>{dealer ? "Edit dealer" : "Add a super dealer"}</DialogTitle>
        <DialogDescription>
          A shop or distributor you issue stock to. Give a shop or contact name, and a phone or
          email.
        </DialogDescription>
      </DialogHeader>
      {dealer ? <input type="hidden" name="id" value={dealer.id} /> : null}
      <FieldGroup className="py-4">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="dealer-shop">Shop name</FieldLabel>
            <Input
              id="dealer-shop"
              name="shopName"
              defaultValue={dealer?.shopName ?? ""}
              placeholder="Kariakoo General Store"
              autoComplete="off"
              maxLength={200}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="dealer-contact">Contact name</FieldLabel>
            <Input
              id="dealer-contact"
              name="contactName"
              defaultValue={dealer?.contactName ?? ""}
              placeholder="Neema Mushi"
              autoComplete="off"
              maxLength={200}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="dealer-phone">Phone</FieldLabel>
            <Input
              id="dealer-phone"
              name="phone"
              type="tel"
              defaultValue={dealer?.phone ? formatPhone(dealer.phone) : ""}
              placeholder="0754 123 456"
              autoComplete="off"
              maxLength={40}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="dealer-email">Email</FieldLabel>
            <Input
              id="dealer-email"
              name="email"
              type="email"
              defaultValue={dealer?.email ?? ""}
              placeholder="mauzo@kariakoostore.co.tz"
              autoComplete="off"
              maxLength={200}
            />
          </Field>
          <PlaceFields
            places={places}
            regionKey={dealer?.regionKey ?? null}
            districtKey={dealer?.districtKey ?? null}
          />
          <Field>
            <FieldLabel htmlFor="dealer-tin">TIN</FieldLabel>
            <Input
              id="dealer-tin"
              name="tin"
              defaultValue={dealer?.tin ?? ""}
              placeholder="123-456-789"
              inputMode="numeric"
              autoComplete="off"
              maxLength={20}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="dealer-licence">Business licence no.</FieldLabel>
            <Input
              id="dealer-licence"
              name="businessLicence"
              defaultValue={dealer?.businessLicence ?? ""}
              autoComplete="off"
              maxLength={50}
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="dealer-address">Address</FieldLabel>
          <Input
            id="dealer-address"
            name="address"
            defaultValue={dealer?.address ?? ""}
            placeholder="Mtaa wa Msimbazi, Kariakoo"
            autoComplete="off"
            maxLength={300}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="dealer-notes">Notes</FieldLabel>
          <Textarea
            id="dealer-notes"
            name="notes"
            defaultValue={dealer?.notes ?? ""}
            maxLength={1000}
            rows={2}
          />
        </Field>
        {state.message && !state.success ? <FieldError>{state.message}</FieldError> : null}
      </FieldGroup>
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : dealer ? "Save changes" : "Add dealer"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/**
 * Region and district pickers: regions grouped by zone, with the zone shown
 * once one is picked, and only that region's districts. Two grid cells.
 */
export function PlaceFields({
  places,
  regionKey: initialRegionKey,
  districtKey,
}: {
  places: PlaceZone[];
  regionKey: string | null;
  districtKey: string | null;
}) {
  const [regionKey, setRegionKey] = useState(initialRegionKey ?? "");
  const zone = places.find((zone) => zone.regions.some((region) => region.key === regionKey));
  const region = zone?.regions.find((region) => region.key === regionKey);

  return (
    <>
      <Field>
        <FieldLabel htmlFor="dealer-region">Region</FieldLabel>
        <NativeSelect
          id="dealer-region"
          name="regionKey"
          value={regionKey}
          onChange={(event) => setRegionKey(event.target.value)}
          className="w-full"
        >
          <NativeSelectOption value="">No region</NativeSelectOption>
          {places.map((zone) => (
            <NativeSelectOptGroup key={zone.key} label={zone.name}>
              {zone.regions.map((region) => (
                <NativeSelectOption key={region.key} value={region.key}>
                  {region.name}
                </NativeSelectOption>
              ))}
            </NativeSelectOptGroup>
          ))}
        </NativeSelect>
        {zone ? <FieldDescription>{zone.name}</FieldDescription> : null}
      </Field>
      <Field>
        <FieldLabel htmlFor="dealer-district">District</FieldLabel>
        {/* Remounted per region so a district from another region is cleared. */}
        <NativeSelect
          key={regionKey}
          id="dealer-district"
          name="districtKey"
          defaultValue={regionKey === initialRegionKey ? (districtKey ?? "") : ""}
          className="w-full"
          disabled={!region}
        >
          <NativeSelectOption value="">
            {region ? "No district" : "Pick a region first"}
          </NativeSelectOption>
          {region?.districts.map((district) => (
            <NativeSelectOption key={district.key} value={district.key}>
              {district.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
    </>
  );
}
