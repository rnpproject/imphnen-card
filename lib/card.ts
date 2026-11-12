import { GROUP_URL, THEMES, type ThemeId } from "./themes";

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
  badge: "Member Resmi",
  theme: "navy",
  accent: "#ffc93c",
  showUid: false,
};

export function cleanUser(v: string): string {
  return v.replace(/^@+/, "").replace(/[^A-Za-z0-9._]/g, "").slice(0, 24);
}

export function locationText(c: CardState): string {
  return [c.city.trim(), c.province.trim()].filter(Boolean).join(", ") || "Kota, Provinsi";
}

export function nameClass(n: string): "" | "m" | "s" {
  return n.length > 24 ? "s" : n.length > 16 ? "m" : "";
}

export function buildMetadata(c: CardState) {
  return {
    name: "Kartu Member IMPHNEN - " + (c.name.trim() || "Member"),
    description: "Kartu member komunitas IMPHNEN (Ingin Menjadi Programmer Handal Namun Enggan Ngoding).",
    external_url: "https://" + GROUP_URL,
    attributes: [
      { trait_type: "Kota", value: c.city.trim() || "-" },
      { trait_type: "Provinsi", value: c.province.trim() || "-" },
      { trait_type: "Username", value: "@" + (c.username || "-") },
      { trait_type: "Bergabung", value: c.joined || "-" },
      { trait_type: "Status", value: c.badge.trim() || "Member" },
      { trait_type: "Warna kartu", value: THEMES[c.theme].title },
    ],
  };
}
