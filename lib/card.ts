import type { ThemeId } from "./themes";

export interface CardState {
  uid: string;
  name: string;
  city: string;
  province: string;
  username: string;
  joined: string; // YYYY-MM-DD
  badge: string;
  theme: ThemeId;
  accent: string;
  showUid: boolean;
}

export const INITIAL_CARD: CardState = {
  uid: "100079664152403",
  name: "Rizky",
  city: "Bogor",
  province: "Jawa Barat",
  username: "rnpproject",
  joined: "2026-11-05",
  badge: "Member",
  theme: "navy",
  accent: "#ffc93c",
  showUid: false,
};

export function verifiedBadge(badge?: string | null): string {
  const role = (badge?.trim() || "Member").replace(/\s+Resmi\b/gi, "").trim() || "Member";
  return /\bverified\b/i.test(role) ? role : `${role} Verified`;
}

export function cleanUser(v: string): string {
  return v.replace(/^@+/, "").replace(/[^A-Za-z0-9._]/g, "").slice(0, 24);
}

export function locationText(c: CardState): string {
  return [c.city.trim(), c.province.trim()].filter(Boolean).join(", ") || "Kota, Provinsi";
}

export function nameClass(n: string): "" | "m" | "s" {
  return n.length > 24 ? "s" : n.length > 16 ? "m" : "";
}
