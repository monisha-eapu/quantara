import { z } from "zod";
import { createSignedRecord } from "./records.js";
import { getSigner } from "../crypto/keystore.js";
import { badRequest } from "./errors.js";

export const PROPERTY_TYPES = ["Agricultural", "Residential", "Commercial", "Industrial", "Institutional"] as const;
export const LAND_STATUSES = ["Active", "Mortgaged", "Under Dispute", "Transferred"] as const;

export const landRecordSchema = z.object({
  propertyId: z.string().trim().regex(/^[A-Z]{2}-[A-Z]{3}-\d{3,6}$/, "Property ID must look like AP-VZM-10293"),
  ownerName: z.string().trim().min(2).max(120),
  surveyNumber: z.string().trim().min(1).max(40),
  district: z.string().trim().min(2).max(60),
  state: z.string().trim().min(2).max(60),
  area: z.string().trim().min(1).max(40),
  propertyType: z.enum(PROPERTY_TYPES),
  registrationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  status: z.enum(LAND_STATUSES),
  issuingAuthority: z.string().trim().min(2).max(120),
  signerId: z.string().default("revenue-ap"),
});

export type LandRecordInput = z.input<typeof landRecordSchema>;

export function landRecordId(propertyId: string): string {
  return `LAND-${propertyId}`;
}

export function createLandRecord(raw: unknown, opts: { featured?: boolean; timestamp?: string; actor?: string; allowLegacy?: boolean } = {}) {
  const input = landRecordSchema.parse(raw);
  const signer = getSigner(input.signerId);
  const allowed = signer.role === "LAND_REGISTRAR" || (opts.allowLegacy && signer.role === "LEGACY_SIGNER");
  if (!allowed) throw badRequest(`${signer.name} is not authorised to sign new land records`);
  const { signerId, ...fields } = input;
  const data = { recordType: "LAND_RECORD", ...fields };
  return createSignedRecord({
    id: landRecordId(input.propertyId),
    recordType: "LAND_RECORD",
    title: `${input.ownerName} — Survey ${input.surveyNumber}, ${input.district}`,
    data,
    signerId,
    featured: opts.featured,
    timestamp: opts.timestamp,
    actor: opts.actor,
  });
}
