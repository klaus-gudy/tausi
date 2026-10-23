"use client";

import { useState } from "react";
import { MapPin, Plus, UserRound, Warehouse } from "lucide-react";
import { toast } from "sonner";

import { saveWarehouse } from "./actions";
import { FormSection } from "@/components/form-section";
import { PlaceFields } from "@/components/place-fields";
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

// Radix Select items can't have an empty value, so "no storekeeper" is this.
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
      <FieldGroup className="gap-4 py-4">
        <FormSection icon={Warehouse} title="Warehouse" description="What you call this store or depot.">
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
        </FormSection>
        <FormSection icon={UserRound} title="Storekeeper" description="Pick a member; their phone is filled in for you.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="warehouse-keeper">
                Member <span className="font-normal text-muted-foreground">(optional)</span>
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
        </FormSection>
        <FormSection icon={MapPin} title="Location" description="Where it is, so stock can be planned by zone.">
          <div className="grid gap-4 sm:grid-cols-3">
            <PlaceFields
              places={places}
              regionKey={warehouse?.regionKey ?? null}
              districtKey={warehouse?.districtKey ?? null}
              idPrefix="warehouse"
            />
          </div>
          <Field>
            <FieldLabel htmlFor="warehouse-address">
              Address <span className="font-normal text-muted-foreground">(optional)</span>
            </FieldLabel>
            <Input
              id="warehouse-address"
              name="address"
              defaultValue={warehouse?.address ?? ""}
              placeholder="Plot 12, Nyerere Road, near the Tazara junction"
              autoComplete="off"
              maxLength={300}
            />
          </Field>
        </FormSection>
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
