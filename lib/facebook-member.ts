import { toYMD } from "./date";

const GROUP_MEMBER_URL = "https://www.facebook.com/groups/1032515944638255/user/";
const JOINED_RE = /\b([A-Za-z][A-Za-z-]*(?:\s+[A-Za-z][A-Za-z-]*){0,2}?)\s+of\s+Ingin Menjadi Programmer Handal,\s*Namun Enggan Ngoding\s+since\s+([^"<]+)/i;

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchFacebookMember(uid: string): Promise<{ name: string; joinedAt: string } | null> {
  const cookie = process.env.COOKIE;
  if (!cookie) throw new Error("Scraper belum dikonfigurasi. Isi COOKIE di environment server.");
  let response: Response;
  try {
    response = await fetch(GROUP_MEMBER_URL + encodeURIComponent(uid), {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
        Cookie: `cookie=${cookie}`,
        Referer: "https://www.facebook.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error("Facebook tidak bisa dihubungi untuk memverifikasi UID.");
  }
  if (!response.ok) throw new Error("UID Facebook tidak dapat diverifikasi sebagai anggota grup IMPHNEN.");
  const html = await response.text();
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const joinedMatch = JOINED_RE.exec(html);
  if (!title || !joinedMatch) return null;
  const name = decodeHtml(title).replace(/\s*(?:\||·|—)\s*Facebook.*$/i, "").trim();
  const joinedAt = toYMD(decodeHtml(joinedMatch[2]));
  return name && joinedAt ? { name, joinedAt } : null;
}
