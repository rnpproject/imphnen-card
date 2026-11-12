import { NextResponse } from "next/server";
import { toYMD } from "@/lib/date";
import { verifyTurnstile } from "@/lib/turnstile";
import { fetchOfficialCertificate } from "@/lib/certificate";
import { loadPublicCardByUid } from "@/lib/admin-firestore";
import { createScrapeProof } from "@/lib/scrape-proof";
import { notifyScrapeFailure, notifyScrapeSuccess } from "@/lib/telegram-alert";

export const dynamic = "force-dynamic";

const UID_RE = /^\d{5,20}$/;
const TIMEOUT_MS = 10_000;
const GROUP_URL = "https://www.facebook.com/groups/1032515944638255/user/";
const JOINED_RE = /\b([A-Za-z][A-Za-z-]*(?:\s+[A-Za-z][A-Za-z-]*){0,2}?)\s+of\s+Ingin Menjadi Programmer Handal,\s*Namun Enggan Ngoding\s+since\s+([^"<]+)/i;

type ScrapeAttempt =
  | { ok: true; name: string; badge: string; joinedAt: string }
  | { ok: false; status: number; clientError: string; stage: string; reason: string; httpStatus?: number; pageTitle?: string };

function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

async function scrapeFail(
  uid: string,
  status: number,
  error: string,
  details: { stage: string; reason: string; httpStatus?: number; pageTitle?: string },
) {
  await notifyScrapeFailure({ uid, ...details });
  return fail(status, error);
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function scrapeWithCookie(uid: string, cookie: string): Promise<ScrapeAttempt> {
  let response: Response;
  try {
    response = await fetch(GROUP_URL + encodeURIComponent(uid), {
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
        "Cache-Control": "no-cache",
        Cookie: "cookie=" + cookie,
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
    return {
      ok: false,
      status: 504,
      clientError: timeout ? "Facebook tidak merespons. Coba lagi." : "Server tidak bisa menghubungi Facebook.",
      stage: "Menghubungi Facebook",
      reason: timeout
        ? "Request melewati batas waktu " + TIMEOUT_MS + " ms."
        : error instanceof Error ? (error.name + ": " + error.message).slice(0, 300) : "Kesalahan jaringan yang tidak diketahui.",
    };
  }

  if (!response.ok) return {
    ok: false,
    status: response.status === 404 ? 404 : 502,
    clientError: response.status === 404 ? "UID tidak ditemukan di halaman Facebook." : "Facebook menjawab dengan kode " + response.status + ".",
    stage: "Respons Facebook",
    reason: response.status === 404
      ? "Halaman profil grup tidak ditemukan untuk UID tersebut."
      : "Facebook menolak atau gagal memuat halaman profil (HTTP " + response.status + ").",
    httpStatus: response.status,
  };

  let html: string;
  try {
    html = await response.text();
  } catch (error) {
    return {
      ok: false,
      status: 502,
      clientError: "Respons Facebook terputus saat membaca halaman.",
      stage: "Membaca respons Facebook",
      reason: error instanceof Error ? (error.name + ": " + error.message).slice(0, 300) : "Stream respons gagal dibaca.",
      httpStatus: response.status,
    };
  }

  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const memberMatch = JOINED_RE.exec(html);
  const pageTitle = title ? decodeHtml(title.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim() : undefined;
  if (!title || !memberMatch) return {
    ok: false,
    status: 404,
    clientError: "Data member tidak ditemukan.",
    stage: "Membaca halaman profil",
    reason: "Pola nama/tanggal keanggotaan tidak ditemukan (title=" + Boolean(title) + ", pola member=" + Boolean(memberMatch) + "). Halaman mungkin meminta login, menampilkan checkpoint, atau format Facebook berubah.",
    httpStatus: response.status,
    pageTitle,
  };

  const name = pageTitle || "";
  const badge = memberMatch[1].trim().replace(/\s+/g, " ").replace(/\b[a-z]/gi, (letter) => letter.toUpperCase());
  const rawDate = decodeHtml(memberMatch[2]).trim();
  const joinedAt = toYMD(rawDate);
  if (!name || !joinedAt) return {
    ok: false,
    status: 502,
    clientError: "Format tanggal bergabung dari Facebook tidak dikenali.",
    stage: "Mem-parsing data anggota",
    reason: "Nama valid=" + Boolean(name) + "; hasil parsing tanggal=" + (joinedAt || "tidak dikenali") + "; teks tanggal=" + rawDate.slice(0, 120) + ".",
    httpStatus: response.status,
    pageTitle,
  };

  return { ok: true, name, badge, joinedAt };
}

export async function POST(req: Request, ctx: { params: Promise<{ uid: string }> }) {
  const { uid } = await ctx.params;
  if (!UID_RE.test(uid)) return fail(400, "UID Facebook harus berupa angka, 5 sampai 20 digit.");

  if (!process.env.TURNSTILE_SECRET_KEY) return fail(503, "Turnstile belum dikonfigurasi di server.");
  const body = await req.json().catch(() => null) as { turnstileToken?: unknown } | null;
  if (!body?.turnstileToken) return fail(400, "Selesaikan verifikasi anti-bot terlebih dahulu.");
  const verified = await verifyTurnstile(body.turnstileToken, req.headers.get("CF-Connecting-IP"));
  if (!verified) return fail(403, "Verifikasi anti-bot gagal atau kedaluwarsa. Coba lagi.");

  const savedCard = await loadPublicCardByUid(uid).catch(() => null);
  if (savedCard?.username && savedCard.name && savedCard.joined) {
    const certificate = await fetchOfficialCertificate(savedCard.username).catch(() => null);
    if (certificate && certificate.name.toLocaleLowerCase("id-ID") === savedCard.name.toLocaleLowerCase("id-ID")) {
      const scrapeProof = createScrapeProof({ uid, name: certificate.name, joinedAt: savedCard.joined });
      return NextResponse.json({
        source: "database",
        card: { ...savedCard, name: certificate.name, username: certificate.username },
        scrapeProof,
      });
    }
  }

  const cookies = [
    { label: "COOKIE", value: process.env.COOKIE },
    { label: "COOKIE1", value: process.env.COOKIE1 },
  ].filter((item): item is { label: string; value: string } => Boolean(item.value?.trim()));

  if (cookies.length === 0) return scrapeFail(uid, 503, "Scraper belum dikonfigurasi. Isi COOKIE atau COOKIE1 di environment server.", {
    stage: "Konfigurasi sesi",
    reason: "Environment COOKIE dan COOKIE1 kosong; request Facebook tidak dikirim.",
  });

  const failures: Array<{ label: string; result: Extract<ScrapeAttempt, { ok: false }> }> = [];
  for (const cookie of cookies) {
    const result = await scrapeWithCookie(uid, cookie.value);
    if (result.ok) {
      await notifyScrapeSuccess({ uid, name: result.name, badge: result.badge, joinedAt: result.joinedAt, cookieLabel: cookie.label });
      const scrapeProof = createScrapeProof({ uid, name: result.name, joinedAt: result.joinedAt });
      return NextResponse.json({ source: "scrape", name: result.name, badge: result.badge, joinedAt: result.joinedAt, scrapeProof });
    }
    failures.push({ label: cookie.label, result });
  }

  const lastFailure = failures[failures.length - 1].result;
  const allNotFound = failures.every(({ result }) => result.status === 404);
  const reasons = failures.map(({ label, result }) => label + ": " + result.stage + " — " + result.reason).join(" | ");
  return scrapeFail(uid, allNotFound ? 404 : lastFailure.status, lastFailure.clientError, {
    stage: "Semua sesi gagal (" + failures.map(({ label }) => label).join(", ") + ")",
    reason: reasons,
    httpStatus: lastFailure.httpStatus,
    pageTitle: lastFailure.pageTitle,
  });
}
