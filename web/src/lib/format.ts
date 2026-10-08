export function shortHash(h: string | null | undefined, n = 8): string {
  if (!h) return "—";
  return h.length <= n * 2 + 1 ? h : `${h.slice(0, n)}…${h.slice(-n)}`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "never";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export const nf = new Intl.NumberFormat("en-US");

export function humanize(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export const LAND_FIELD_LABELS: Record<string, string> = {
  propertyId: "Property ID",
  ownerName: "Owner name",
  surveyNumber: "Survey number",
  district: "District",
  state: "State",
  area: "Area",
  propertyType: "Property type",
  registrationDate: "Registration date",
  status: "Status",
  issuingAuthority: "Issuing authority",
};

export function fieldLabel(key: string): string {
  return LAND_FIELD_LABELS[key] ?? humanize(key);
}
