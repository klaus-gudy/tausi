"use server";

import { revalidatePath } from "next/cache";

import { dealerName, normalizePhone, normalizeTin } from "@/lib/dealers";
import { isEmail } from "@/lib/email";
import {
  isUniqueViolation,
  memberWith,
  notAllowed,
  readText,
  type ActionResult,
} from "@/lib/inventory";
import { getPrisma } from "@/lib/prisma";

// The biggest signature accepted. A phone-sized pad makes 10–60 KB.
const MAX_SIGNATURE_BYTES = 300_000;
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export type OnboardResult = ActionResult & { id?: string };

/**
 * The dealer fields shared by the office form and onboarding, checked. A
 * dealer needs a phone, and a shop name or a contact name; the rest is
 * optional. The region and district are picked from the organization's
 * places. Notes are only saved from a form that has them, so the office form,
 * which doesn't, leaves any a dealer already has.
 */
async function readDealer(formData: FormData, organizationId: string) {
  const shopName = readText(formData.get("shopName"));
  const contactName = readText(formData.get("contactName"));
  const typedPhone = readText(formData.get("phone"), 40);
  const phone = typedPhone ? normalizePhone(typedPhone) : null;
  const email = readText(formData.get("email"))?.toLowerCase() ?? null;
  const typedTin = readText(formData.get("tin"), 20);
  const tin = typedTin ? normalizeTin(typedTin) : null;
  const regionKey = readText(formData.get("regionKey"), 100);
  const districtKey = regionKey ? readText(formData.get("districtKey"), 100) : null;
  if (!shopName && !contactName) return "Enter a shop name, a contact name, or both.";
  if (!typedPhone) return "Enter the dealer's phone number.";
  if (!phone) return "Enter a phone number like 0754 123 456.";
  if (email && !isEmail(email)) return "Enter a valid email address, or leave it empty.";
  if (typedTin && !tin) return "Enter the TIN as 9 digits, like 123-456-789, or leave it empty.";

  // A district is only found in its own region, so finding it checks both.
  if (regionKey) {
    const prisma = getPrisma();
    const found = districtKey
      ? await prisma.district.findUnique({
          where: { organizationId_regionKey_key: { organizationId, regionKey, key: districtKey } },
        })
      : await prisma.region.findUnique({ where: { organizationId_key: { organizationId, key: regionKey } } });
    if (!found) return districtKey ? "Pick a district in that region." : "Pick the region from the list.";
  }

  return {
    shopName,
    contactName,
    phone,
    email,
    tin,
    businessLicence: readText(formData.get("businessLicence"), 50),
    regionKey,
    districtKey,
    address: readText(formData.get("address"), 300),
    ...(formData.has("notes") ? { notes: readText(formData.get("notes"), 1000) } : {}),
  };
}

function revalidateDealers() {
  revalidatePath("/super-dealers");
  revalidatePath("/movement-history");
  revalidatePath("/deliveries");
}

/** Adds a super dealer from the office, or edits one when the form carries its id. */
export async function saveSuperDealer(
  _previous: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const member = await memberWith("dealers.manage");
  if (!member) return notAllowed;

  const id = readText(formData.get("id"));
  const prisma = getPrisma();
  const organizationId = member.organization.id;
  const data = await readDealer(formData, organizationId);
  if (typeof data === "string") return { message: data };

  const name = dealerName(data);
  try {
    if (id) {
      const { count } = await prisma.superDealer.updateMany({ where: { id, organizationId }, data });
      if (!count) return { message: "That dealer no longer exists." };
    } else {
      await prisma.superDealer.create({ data: { ...data, organizationId } });
    }
  } catch (error) {
    if (isUniqueViolation(error)) return { message: `There's already a dealer called ${data.shopName}.` };
    throw error;
  }

  revalidateDealers();
  return { success: true, message: id ? `${name} saved.` : `${name} added.` };
}

/** The PNG of a "data:image/png;base64,…" signature, or null when it isn't one. */
function readSignature(value: FormDataEntryValue | null) {
  const text = String(value ?? "");
  const prefix = "data:image/png;base64,";
  if (!text.startsWith(prefix)) return null;
  const bytes = Buffer.from(text.slice(prefix.length), "base64");
  if (bytes.length > MAX_SIGNATURE_BYTES) return null;
  if (!PNG_MAGIC.every((byte, index) => bytes[index] === byte)) return null;
  return new Uint8Array(bytes);
}

/**
 * Signs up a dealer met in the field: their details, where the shop is, and
 * their signature under a declaration that the details are right.
 */
export async function onboardSuperDealer(
  _previous: OnboardResult,
  formData: FormData
): Promise<OnboardResult> {
  const member = await memberWith("dealers.onboard");
  if (!member) return notAllowed;

  const data = await readDealer(formData, member.organization.id);
  if (typeof data === "string") return { message: data };

  // Both coordinates or neither; the phone fills them in.
  const latitude = Number(formData.get("latitude") || Number.NaN);
  const longitude = Number(formData.get("longitude") || Number.NaN);
  const located =
    Number.isFinite(latitude) && Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;

  const signedByName = readText(formData.get("signedByName"));
  if (!signedByName) return { message: "Enter the name of the person signing." };
  if (formData.get("declaration") !== "on") {
    return { message: "The dealer needs to confirm the declaration before signing." };
  }
  const signature = readSignature(formData.get("signature"));
  if (!signature) return { message: "Have the dealer sign in the box." };

  const now = new Date();
  try {
    const dealer = await getPrisma().superDealer.create({
      data: {
        ...data,
        organizationId: member.organization.id,
        latitude: located ? latitude : null,
        longitude: located ? longitude : null,
        signature,
        signedByName,
        signedAt: now,
        onboardedById: member.userId,
      },
      select: { id: true },
    });
    revalidateDealers();
    return { success: true, message: `${dealerName(data)} onboarded.`, id: dealer.id };
  } catch (error) {
    if (isUniqueViolation(error)) return { message: `There's already a dealer called ${data.shopName}.` };
    throw error;
  }
}

/** Inactive dealers can't be issued stock; what they were issued stays on record. */
export async function setSuperDealerActive(id: string, active: boolean): Promise<ActionResult> {
  const member = await memberWith("dealers.manage");
  if (!member) return notAllowed;

  const { count } = await getPrisma().superDealer.updateMany({
    where: { id, organizationId: member.organization.id },
    data: { deactivatedAt: active ? null : new Date() },
  });
  if (!count) return { message: "That dealer no longer exists." };

  revalidateDealers();
  return { success: true, message: active ? "Dealer reactivated." : "Dealer deactivated." };
}
