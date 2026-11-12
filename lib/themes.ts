export type ThemeId = "navy" | "langit" | "dark";

export interface Theme {
  title: string;
  swatch: string;
  bg1: string;
  bg2: string;
  edge: string;
  text: string;
  sub: string;
  label: string;
  deco: string;
  stripe: string;
  tile: string;
  userAccent: boolean;
}

export const THEMES: Record<ThemeId, Theme> = {
  navy:   { title: "Navy",   swatch: "#1b3a6b", bg1: "#1f4075", bg2: "#12294f", edge: "rgba(255,255,255,.14)", text: "#ffffff", sub: "#b8cbe8", label: "#93acd4", deco: "rgba(110,170,235,.16)", stripe: "rgba(5,14,32,.45)", tile: "rgba(255,255,255,.08)", userAccent: true },
  langit: { title: "Langit", swatch: "#79c4f4", bg1: "#9bd6f8", bg2: "#52b2ee", edge: "rgba(255,255,255,.55)", text: "#0e2547", sub: "#1d4a7a", label: "#255a8f", deco: "rgba(255,255,255,.30)", stripe: "rgba(14,37,71,.55)", tile: "rgba(255,255,255,.35)", userAccent: false },
  dark:  { title: "Dark",  swatch: "#0c1830", bg1: "#0f1f3d", bg2: "#070f20", edge: "rgba(255,255,255,.10)", text: "#ffffff", sub: "#9fb3d4", label: "#7f98c0", deco: "rgba(80,140,220,.12)", stripe: "rgba(0,0,0,.5)", tile: "rgba(255,255,255,.06)", userAccent: true },
};

export const ACCENTS = [
  { id: "kuning", label: "Kuning", color: "#ffc93c" },
  { id: "biru",   label: "Biru",   color: "#2cb0ff" },
  { id: "mint",   label: "Mint",   color: "#4fe3b8" },
  { id: "pink",   label: "Pink",   color: "#ff8fc7" },
] as const;

export const GROUP_URL = "facebook.com/groups/programmerhandal";

export const ZONES = ["Aceh","Sumatera Utara","Sumatera Barat","Riau","Kepulauan Riau","Jambi","Sumatera Selatan","Kepulauan Bangka Belitung","Bengkulu","Lampung","DKI Jakarta","Banten","Jawa Barat","Jawa Tengah","DI Yogyakarta","Jawa Timur","Bali","Nusa Tenggara Barat","Nusa Tenggara Timur","Kalimantan Barat","Kalimantan Tengah","Kalimantan Selatan","Kalimantan Timur","Kalimantan Utara","Sulawesi Utara","Gorontalo","Sulawesi Tengah","Sulawesi Barat","Sulawesi Selatan","Sulawesi Tenggara","Maluku","Maluku Utara","Papua","Papua Barat","Papua Barat Daya","Papua Tengah","Papua Pegunungan","Papua Selatan"];
