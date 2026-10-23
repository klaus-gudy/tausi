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
import { useFormAction } from "@/hooks/use-form-action";
import { formatPhone, type PlaceZone } from "@/lib/dealers";
import type { ActionResult } from "@/lib/inventory";

export type EditableWarehouse = {
  id: string;
  name: string;
  regionKey: string | null;
  districtKey: string | null;
  address: string | null;
  contactName: string | null;
  phone: string | null;
};

/** A member who can be picked as a warehouse's storekeeper. */
export type Keeper = { id: string; name: string; phone: string | null; role: string };

const initialState: ActionResult = { message: "" };

// Radix Select items can't have an empty value, so "nothing picked" is this.
const NONE = "none";
// The storekeeper saved before, when they aren't one of the members.
const SAVED = "saved";

/** The "Add warehouse" button and its dialog. */
export function AddWarehouseDialog({ places, keepers }: { places: PlaceZone[]; keepers: Keeper[] }) {
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
        <WarehouseForm key={formKey} places={places} keepers={keepers} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

/** Edits a warehouse; opened from its row menu. */
export function EditWarehouseDialog({
  warehouse,
  places,
  keepers,
  open,
  onOpenChange,
}: {
  warehouse: EditableWarehouse;
  places: PlaceZone[];
  keepers: Keeper[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        {open ? (
          <WarehouseForm
            warehouse={warehouse}
            places={places}
            keepers={keepers}
            onSaved={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function WarehouseForm({
  warehouse,
  places,
  keepers,
  onSaved,
}: {
  warehouse?: EditableWarehouse;
  places: PlaceZone[];
  keepers: Keeper[];
  onSaved: () => void;
}) {
  // The zone isn't stored; it only narrows the region list.
  const [zoneKey, setZoneKey] = useState(
    () => places.find((zone) => zone.regions.some((region) => region.key === warehouse?.regionKey))?.key ?? ""
  );
  const [regionKey, setRegionKey] = useState(warehouse?.regionKey ?? "");
  const [districtKey, setDistrictKey] = useState(warehouse?.districtKey ?? "");
  // The storekeeper is picked from the members, which fills in their name and
  // phone; the phone can still be changed for this warehouse.
  const savedName = warehouse?.contactName ?? "";
  const [keeper, setKeeper] = useState(() =>
    savedName ? (keepers.find((k) => k.name === savedName)?.id ?? SAVED) : NONE
  );
  const [phone, setPhone] = useState(warehouse?.phone ? formatPhone(warehouse.phone) : "");
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
  const keeperName =
    keeper === SAVED ? savedName : (keepers.find((k) => k.id === keeper)?.name ?? "");

  return (
    <form onSubmit={onSubmit}>
      <DialogHeader>
        <DialogTitle>{warehouse ? "Edit warehouse" : "Add a warehouse"}</DialogTitle>
        <DialogDescription>A store or depot where you keep stock, and who looks after it.</DialogDescription>
      </DialogHeader>
      {warehouse ? <input type="hidden" name="id" value={warehouse.id} /> : null}
      <input type="hidden" name="contactName" value={keeperName} />
      <input type="hidden" name="regionKey" value={regionKey} />
      <input type="hidden" name="districtKey" value={districtKey} />
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
              <FieldLabel htmlFor="warehouse-keeper">
                Storekeeper <span className="font-normal text-muted-foreground">(optional)</span>
              </FieldLabel>
              <Select
                value={keeper}
                onValueChange={(next) => {
                  setKeeper(next);
                  const picked = keepers.find((k) => k.id === next);
                  if (picked) setPhone(picked.phone ? formatPhone(picked.phone) : "");
                  if (next === NONE) setPhone("");
                }}
              >
                <SelectTrigger id="warehouse-keeper" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No storekeeper</SelectItem>
                  {savedName && !keepers.some((k) => k.name === savedName) ? (
                    <SelectItem value={SAVED}>{savedName}</SelectItem>
                  ) : null}
                  {keepers.map((k) => (
                    <SelectItem key={k.id} value={k.id}>
                      {k.name}
                      <span className="text-muted-foreground">· {k.role}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="warehouse-phone">
                Phone <span className="font-normal text-muted-foreground">(optional)</span>
              </FieldLabel>
              <Input
                id="warehouse-phone"
                name="phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="0754 123 456"
                autoComplete="off"
                maxLength={40}
              />
            </Field>
          </div>
        </FieldSet>
        <FieldSet className="gap-3">
          <FieldLegend className="mb-0">Location</FieldLegend>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="warehouse-zone">Zone</FieldLabel>
              <Select
                value={zoneKey || NONE}
                onValueChange={(next) => {
                  setZoneKey(next === NONE ? "" : next);
                  setRegionKey("");
                  setDistrictKey("");
                }}
              >
                <SelectTrigger id="warehouse-zone" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No zone</SelectItem>
                  {places.map((zone) => (
                    <SelectItem key={zone.key} value={zone.key}>
                      {zone.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="warehouse-region">Region</FieldLabel>
              <Select
                value={regionKey || NONE}
                onValueChange={(next) => {
                  setRegionKey(next === NONE ? "" : next);
                  setDistrictKey("");
                }}
                disabled={!zone}
              >
                <SelectTrigger id="warehouse-region" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{zone ? "No region" : "Pick a zone first"}</SelectItem>
                  {zone?.regions.map((region) => (
                    <SelectItem key={region.key} value={region.key}>
                      {region.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="warehouse-district">District</FieldLabel>
              <Select
                value={districtKey || NONE}
                onValueChange={(next) => setDistrictKey(next === NONE ? "" : next)}
                disabled={!region}
              >
                <SelectTrigger id="warehouse-district" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{region ? "No district" : "Pick a region first"}</SelectItem>
                  {region?.districts.map((district) => (
                    <SelectItem key={district.key} value={district.key}>
                      {district.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
