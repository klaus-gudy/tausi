"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { saveWarehouse } from "./actions";
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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useFormAction } from "@/hooks/use-form-action";
import { formatPhone, type PlaceZone } from "@/lib/dealers";
import type { ActionResult } from "@/lib/inventory";
import { CAPACITY_UNITS } from "@/lib/warehouses";

export type EditableWarehouse = {
  id: string;
  name: string;
  regionKey: string | null;
  districtKey: string | null;
  address: string | null;
  capacity: number | null;
  capacityUnit: string;
  contactName: string | null;
  phone: string | null;
};

const initialState: ActionResult = { message: "" };

/** The "Add warehouse" button and its dialog. */
export function AddWarehouseDialog({ places }: { places: PlaceZone[] }) {
  const [open, setOpen] = useState(false);
  // Remounting the form clears it for the next warehouse.
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
          Add warehouse
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <WarehouseForm key={formKey} places={places} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

/** Edits a warehouse; opened from its row menu. */
export function EditWarehouseDialog({
  warehouse,
  places,
  open,
  onOpenChange,
}: {
  warehouse: EditableWarehouse;
  places: PlaceZone[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        {open ? (
          <WarehouseForm warehouse={warehouse} places={places} onSaved={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function WarehouseForm({
  warehouse,
  places,
  onSaved,
}: {
  warehouse?: EditableWarehouse;
  places: PlaceZone[];
  onSaved: () => void;
}) {
  // The zone isn't stored; it only narrows the region list.
  const [zoneKey, setZoneKey] = useState(
    () => places.find((zone) => zone.regions.some((region) => region.key === warehouse?.regionKey))?.key ?? ""
  );
  const [regionKey, setRegionKey] = useState(warehouse?.regionKey ?? "");
  const [state, onSubmit, pending] = useFormAction(
    async (previous: ActionResult, formData: FormData) => {
      const result = await saveWarehouse(previous, formData);
      if (result.success) {
        toast.success(result.message);
        onSaved();
      }
      return result;
    },
    initialState
  );

  const zone = places.find((zone) => zone.key === zoneKey);
  const region = zone?.regions.find((region) => region.key === regionKey);

  return (
    <form onSubmit={onSubmit}>
      <DialogHeader>
        <DialogTitle>{warehouse ? "Edit warehouse" : "Add a warehouse"}</DialogTitle>
        <DialogDescription>
          A store or depot where you keep stock: where it is and roughly how much it holds.
        </DialogDescription>
      </DialogHeader>
      {warehouse ? <input type="hidden" name="id" value={warehouse.id} /> : null}
      <FieldGroup className="gap-6 py-4">
        <FieldSet className="gap-3">
          <FieldLegend className="mb-0">Basic details</FieldLegend>
          <Field>
            <FieldLabel htmlFor="warehouse-name">Name</FieldLabel>
            <Input
              id="warehouse-name"
              name="name"
              defaultValue={warehouse?.name ?? ""}
              placeholder="Mikocheni main store"
              autoComplete="off"
              maxLength={200}
              required
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="warehouse-contact">
                Storekeeper <span className="font-normal text-muted-foreground">(optional)</span>
              </FieldLabel>
              <Input
                id="warehouse-contact"
                name="contactName"
                defaultValue={warehouse?.contactName ?? ""}
                placeholder="Juma Hassan"
                autoComplete="off"
                maxLength={200}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="warehouse-phone">
                Phone <span className="font-normal text-muted-foreground">(optional)</span>
              </FieldLabel>
              <Input
                id="warehouse-phone"
                name="phone"
                type="tel"
                defaultValue={warehouse?.phone ? formatPhone(warehouse.phone) : ""}
                placeholder="0754 123 456"
                autoComplete="off"
                maxLength={40}
              />
            </Field>
          </div>
        </FieldSet>
        <FieldSet className="gap-3">
          <FieldLegend className="mb-0">Estimated capacity</FieldLegend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="warehouse-capacity">How much it holds</FieldLabel>
              <Input
                id="warehouse-capacity"
                name="capacity"
                inputMode="numeric"
                defaultValue={warehouse?.capacity ?? ""}
                placeholder="5,000"
                autoComplete="off"
                maxLength={20}
              />
              <FieldDescription>A rough figure is fine. Leave empty if unknown.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="warehouse-unit">Measured in</FieldLabel>
              <NativeSelect
                id="warehouse-unit"
                name="capacityUnit"
                defaultValue={warehouse?.capacityUnit ?? "units"}
                className="w-full"
              >
                {CAPACITY_UNITS.map((unit) => (
                  <NativeSelectOption key={unit.value} value={unit.value}>
                    {unit.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          </div>
        </FieldSet>
        <FieldSet className="gap-3">
          <FieldLegend className="mb-0">Location</FieldLegend>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="warehouse-zone">Zone</FieldLabel>
              <NativeSelect
                id="warehouse-zone"
                value={zoneKey}
                onChange={(event) => {
                  setZoneKey(event.target.value);
                  setRegionKey("");
                }}
                className="w-full"
              >
                <NativeSelectOption value="">No zone</NativeSelectOption>
                {places.map((zone) => (
                  <NativeSelectOption key={zone.key} value={zone.key}>
                    {zone.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="warehouse-region">Region</FieldLabel>
              <NativeSelect
                id="warehouse-region"
                name="regionKey"
                value={regionKey}
                onChange={(event) => setRegionKey(event.target.value)}
                className="w-full"
                disabled={!zone}
              >
                <NativeSelectOption value="">
                  {zone ? "No region" : "Pick a zone first"}
                </NativeSelectOption>
                {zone?.regions.map((region) => (
                  <NativeSelectOption key={region.key} value={region.key}>
                    {region.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="warehouse-district">District</FieldLabel>
              {/* Remounted per region so a district from another region is cleared. */}
              <NativeSelect
                key={regionKey}
                id="warehouse-district"
                name="districtKey"
                defaultValue={regionKey === warehouse?.regionKey ? (warehouse.districtKey ?? "") : ""}
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
          </div>
          <Field>
            <FieldLabel htmlFor="warehouse-address">Address</FieldLabel>
            <Input
              id="warehouse-address"
              name="address"
              defaultValue={warehouse?.address ?? ""}
              placeholder="Plot 12, Nyerere Road, near the Tazara junction"
              autoComplete="off"
              maxLength={300}
            />
          </Field>
        </FieldSet>
        {state.message && !state.success ? <FieldError>{state.message}</FieldError> : null}
      </FieldGroup>
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : warehouse ? "Save changes" : "Add warehouse"}
        </Button>
      </DialogFooter>
    </form>
  );
}
