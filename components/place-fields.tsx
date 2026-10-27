"use client"

import { useState } from "react"

import { Field, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { PlaceZone } from "@/lib/dealers"

// Radix Select items can't have an empty value, so "nothing picked" is this.
const NONE = "none"

/**
 * Zone, region and district pickers from the organization's places. Submits
 * zoneKey, regionKey and districtKey; what's kept of them is up to the form's
 * action. Place them in a three-column grid.
 */
export function PlaceFields({
  places,
  zoneKey: initialZoneKey,
  regionKey: initialRegionKey,
  districtKey: initialDistrictKey,
  idPrefix,
}: {
  places: PlaceZone[]
  /** Only needed when nothing finer than the zone was picked. */
  zoneKey?: string | null
  regionKey: string | null
  districtKey: string | null
  /** Keeps the field ids apart from the rest of the form's, e.g. "dealer". */
  idPrefix: string
}) {
  const [zoneKey, setZoneKey] = useState(
    () =>
      places.find((zone) => zone.regions.some((region) => region.key === initialRegionKey))?.key ??
      initialZoneKey ??
      ""
  )
  const [regionKey, setRegionKey] = useState(initialRegionKey ?? "")
  const [districtKey, setDistrictKey] = useState(initialDistrictKey ?? "")
  const zone = places.find((zone) => zone.key === zoneKey)
  const region = zone?.regions.find((region) => region.key === regionKey)

  return (
    <>
      <input type="hidden" name="zoneKey" value={zoneKey} />
      <input type="hidden" name="regionKey" value={regionKey} />
      <input type="hidden" name="districtKey" value={districtKey} />
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-zone`}>Zone</FieldLabel>
        <Select
          value={zoneKey || NONE}
          onValueChange={(next) => {
            setZoneKey(next === NONE ? "" : next)
            setRegionKey("")
            setDistrictKey("")
          }}
        >
          <SelectTrigger id={`${idPrefix}-zone`} className="w-full">
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
        <FieldLabel htmlFor={`${idPrefix}-region`}>Region</FieldLabel>
        <Select
          value={regionKey || NONE}
          onValueChange={(next) => {
            setRegionKey(next === NONE ? "" : next)
            setDistrictKey("")
          }}
          disabled={!zone}
        >
          <SelectTrigger id={`${idPrefix}-region`} className="w-full">
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
        <FieldLabel htmlFor={`${idPrefix}-district`}>District</FieldLabel>
        <Select
          value={districtKey || NONE}
          onValueChange={(next) => setDistrictKey(next === NONE ? "" : next)}
          disabled={!region}
        >
          <SelectTrigger id={`${idPrefix}-district`} className="w-full">
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
    </>
  )
}
