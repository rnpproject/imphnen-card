import { NextResponse } from "next/server";
import { toYMD } from "@/lib/date";

export const dynamic = "force-dynamic";

const UID_RE = /^\d{5,20}$/;
const TIMEOUT_MS = 10_000;
const GROUP_URL = "https://www.facebook.com/groups/1032515944638255/user/";
const JOINED_RE = /\b([A-Za-z][A-Za-z-]*(?:\s+[A-Za-z][A-Za-z-]*){0,2}?)\s+of\s+Ingin Menjadi Programmer Handal,\s*Namun Enggan Ngoding\s+since\s+([^"<]+)/i;

function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export async function GET(_req: Request, ctx: { params: Promise<{ uid: string }> }) {
  const { uid } = await ctx.params;
  if (!UID_RE.test(uid)) return fail(400, "UID Facebook harus berupa angka, 5 sampai 20 digit.");

  const cookie = process.env.COOKIE;
  if (!cookie) return fail(503, "Scraper belum dikonfigurasi. Isi COOKIE di environment server.");

  let res: Response;
  try {
    res = await fetch(GROUP_URL + encodeURIComponent(uid), {
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
        "Cache-Control": "no-cache",
        Cookie: `cookie=${cookie}`,
        DPR: "1",
        Pragma: "no-cache",
        Priority: "u=0, i",
        Referer: "https://www.facebook.com/",
        "Sec-CH-Prefers-Color-Scheme": "light",
        "Sec-CH-UA": '"Not-A.Brand";v="99", "Google Chrome";v="157", "Chromium";v="157"',
        "Sec-CH-UA-Full-Version-List": '"Not-A.Brand";v="99.0.0.0", "Google Chrome";v="157.0.8103.51", "Chromium";v="157.0.8103.51"',
        "Sec-CH-UA-Mobile": "?0",
        "Sec-CH-UA-Model": '""',
        "Sec-CH-UA-Platform": '"Windows"',
        "Sec-CH-UA-Platform-Version": '"10.0.0"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36",
        "Viewport-Width": "1114",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    const timeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return fail(504, timeout ? "Facebook tidak merespons. Coba lagi." : "Server tidak bisa menghubungi Facebook.");
  }

  if (res.status === 404) return fail(404, "UID tidak ditemukan di halaman Facebook.");
  if (!res.ok) return fail(502, `Facebook menjawab dengan kode ${res.status}.`);

  const html = await res.text();
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const memberMatch = JOINED_RE.exec(html);
  if (!title || !memberMatch) {
    return fail(404, "Data member tidak ditemukan. Pastikan COOKIE aktif dan akun dapat melihat grup.");
  }

  const name = decodeHtml(title.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
  const badge = memberMatch[1].trim().replace(/\s+/g, " ").replace(/\b[a-z]/gi, (letter) => letter.toUpperCase());
  const joinedAt = toYMD(decodeHtml(memberMatch[2]).trim());
  if (!name || !joinedAt) return fail(502, "Format tanggal bergabung dari Facebook tidak dikenali.");

  return NextResponse.json({ name, badge, joinedAt });
}
