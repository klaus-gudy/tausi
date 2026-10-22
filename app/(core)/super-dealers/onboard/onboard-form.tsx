"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LocateFixed } from "lucide-react";
import { toast } from "sonner";

import { onboardSuperDealer, type OnboardResult } from "../actions";
import { PlaceFields } from "../dealer-dialog";
import { SignaturePad } from "@/components/signature-pad";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { useFormAction } from "@/hooks/use-form-action";
import type { PlaceZone } from "@/lib/dealers";

const initialState: OnboardResult = { message: "" };

type Location = { latitude: number; longitude: number; accuracy: number };

/**
 * Filled in by a salesperson standing in the dealer's shop, usually on a
 * phone. The dealer reads the details back, ticks the declaration and signs.
 */
export function OnboardForm({
  places,
  organizationName,
}: {
  places: PlaceZone[];
  organizationName: string;
}) {
  const router = useRouter();
  const [contactName, setContactName] = useState("");
  const [signedByName, setSignedByName] = useState<string | null>(null);
  const [signed, setSigned] = useState(false);
  const [location, setLocation] = useState<Location | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");

  const [state, onSubmit, pending] = useFormAction(
    async (previous: OnboardResult, formData: FormData) => {
      const result = await onboardSuperDealer(previous, formData);
      if (result.success && result.id) {
        toast.success(result.message);
        router.push(`/super-dealers/${result.id}`);
      }
      return result;
    },
    initialState
  );

  function locate() {
    if (!navigator.geolocation) {
      setLocationError("This device can't share its location.");
      return;
    }
    setLocating(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
          accuracy: Math.round(position.coords.accuracy),
        });
        setLocating(false);
      },
      () => {
        setLocationError("Couldn't get the location. Allow location access and try again.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <Card>
        <CardContent>
          <FieldSet>
            <FieldLegend>Business</FieldLegend>
            <FieldDescription>Give a shop name, a contact name, or both.</FieldDescription>
            <FieldGroup>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="onboard-shop">Shop name</FieldLabel>
                  <Input
                    id="onboard-shop"
                    name="shopName"
                    placeholder="Kariakoo General Store"
                    autoComplete="off"
                    maxLength={200}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="onboard-contact">Owner / contact name</FieldLabel>
                  <Input
                    id="onboard-contact"
                    name="contactName"
                    value={contactName}
                    onChange={(event) => setContactName(event.target.value)}
                    placeholder="Neema Mushi"
                    autoComplete="off"
                    maxLength={200}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="onboard-tin">TIN</FieldLabel>
                  <Input
                    id="onboard-tin"
                    name="tin"
                    placeholder="123-456-789"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={20}
                  />
                  <FieldDescription>From the TRA certificate, if they have one.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="onboard-licence">Business licence no.</FieldLabel>
                  <Input
                    id="onboard-licence"
                    name="businessLicence"
                    autoComplete="off"
                    maxLength={50}
                  />
                </Field>
              </div>
            </FieldGroup>
          </FieldSet>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <FieldSet>
            <FieldLegend>Contact</FieldLegend>
            <FieldDescription>A phone number, an email, or both.</FieldDescription>
            <FieldGroup>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="onboard-phone">Phone</FieldLabel>
                  <Input
                    id="onboard-phone"
                    name="phone"
                    type="tel"
                    placeholder="0754 123 456"
                    autoComplete="off"
                    maxLength={40}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="onboard-email">Email</FieldLabel>
                  <Input
                    id="onboard-email"
                    name="email"
                    type="email"
                    autoComplete="off"
                    maxLength={200}
                  />
                </Field>
              </div>
            </FieldGroup>
          </FieldSet>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <FieldSet>
            <FieldLegend>Location</FieldLegend>
            <FieldGroup>
              <div className="grid gap-5 sm:grid-cols-2">
                <PlaceFields places={places} regionKey={null} districtKey={null} />
              </div>
              <Field>
                <FieldLabel htmlFor="onboard-address">Street, area or landmark</FieldLabel>
                <Input
                  id="onboard-address"
                  name="address"
                  placeholder="Mtaa wa Msimbazi, near the bus stand"
                  autoComplete="off"
                  maxLength={300}
                />
              </Field>
              <Field>
                <FieldLabel>Shop location</FieldLabel>
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" variant="outline" onClick={locate} disabled={locating}>
                    <LocateFixed data-icon="inline-start" />
                    {locating ? "Finding you…" : location ? "Update location" : "Use my location"}
                  </Button>
                  {location ? (
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {location.latitude}, {location.longitude} (±{location.accuracy} m)
                    </span>
                  ) : null}
                </div>
                <FieldDescription>Press while standing in the shop.</FieldDescription>
                {locationError ? <FieldError>{locationError}</FieldError> : null}
                <input type="hidden" name="latitude" value={location?.latitude ?? ""} />
                <input type="hidden" name="longitude" value={location?.longitude ?? ""} />
              </Field>
            </FieldGroup>
          </FieldSet>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <FieldSet>
            <FieldLegend>Notes</FieldLegend>
            <Field>
              <FieldLabel htmlFor="onboard-notes" className="sr-only">
                Notes
              </FieldLabel>
              <Textarea
                id="onboard-notes"
                name="notes"
                placeholder="Opening hours, best time to deliver, products they want…"
                maxLength={1000}
                rows={2}
              />
            </Field>
          </FieldSet>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <FieldSet>
            <FieldLegend>Dealer&apos;s signature</FieldLegend>
            <FieldDescription>
              Hand the phone to the dealer to read the details above, tick the declaration and sign.
            </FieldDescription>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="onboard-signer">Name of the person signing</FieldLabel>
                <Input
                  id="onboard-signer"
                  name="signedByName"
                  // Follows the contact name until someone types here.
                  value={signedByName ?? contactName}
                  onChange={(event) => setSignedByName(event.target.value)}
                  autoComplete="off"
                  maxLength={200}
                  required
                />
              </Field>
              <Field orientation="horizontal">
                <Checkbox id="onboard-declaration" name="declaration" required />
                <FieldLabel htmlFor="onboard-declaration" className="font-normal">
                  I confirm these details are correct and agree to be supplied as a super dealer of{" "}
                  {organizationName}.
                </FieldLabel>
              </Field>
              <SignaturePad name="signature" label="Dealer's signature" onSignedChange={setSigned} />
            </FieldGroup>
          </FieldSet>
        </CardContent>
      </Card>

      {state.message && !state.success ? <FieldError>{state.message}</FieldError> : null}
      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={pending || !signed}>
          {pending ? "Saving…" : "Onboard dealer"}
        </Button>
      </div>
    </form>
  );
}
