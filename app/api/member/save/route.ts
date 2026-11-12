import { NextResponse } from "next/server";
import { fetchOfficialCertificate } from "@/lib/certificate";
import { getFirestoreAccessToken } from "@/lib/admin-firestore";
import { verifyScrapeProof } from "@/lib/scrape-proof";

export const dynamic = "force-dynamic";

type CardInput = {
  uid?: unknown;
  name?: unknown;
  username?: unknown;
  city?: unknown;
  province?: unknown;
  joined?: unknown;
  badge?: unknown;
  theme?: unknown;
  accent?: unknown;
  showUid?: unknown;
};

type FirestoreValue = { stringValue?: string; booleanValue?: boolean; timestampValue?: string };
type FirestoreWrite =
  | { update: { name: string; fields: Record<string, FirestoreValue> }; updateMask: { fieldPaths: string[] } }
  | { delete: string };

function fail(status: number, error: string, code?: string) {
  return NextResponse.json({ error, ...(code ? { code } : {}) }, { status });
}

function firestoreValue(value: string | boolean) {
  return typeof value === "boolean" ? { booleanValue: value } : { stringValue: value };
}

export async function POST(req: Request) {
  if (!process.env.TURNSTILE_SECRET_KEY) return fail(503, "Turnstile belum dikonfigurasi di server.");
  const body = await req.json().catch(() => null) as { card?: CardInput; scrapeProof?: unknown } | null;
  if (!body?.card) return fail(400, "Data kartu tidak valid.");

  const card = body.card;
  const uid = typeof card.uid === "string" ? card.uid.trim() : "";
  const username = typeof card.username === "string" ? card.username.trim().replace(/^@/, "") : "";
  const name = typeof card.name === "string" ? card.name.trim() : "";
  if (!/^\d{5,20}$/.test(uid) || !/^[a-z][a-z0-9_]{2,19}$/i.test(username) || !name) {
    return fail(400, "UID, nama, atau username tidak valid.");
  }
  const joinedAt = typeof card.joined === "string" ? card.joined : "";
  if (!verifyScrapeProof(body.scrapeProof, { uid, name, joinedAt })) {
    return fail(403, "Bukti pencarian sudah kedaluwarsa. Cari ulang UID dan selesaikan verifikasi Cloudflare.");
  }

  let certificate;
  try {
    certificate = await fetchOfficialCertificate(username);
  } catch (error) {
    return fail(502, error instanceof Error ? error.message : "Sertifikat IMPHNEN tidak bisa diverifikasi.");
  }
  if (!certificate) {
    return fail(409, "Username belum memiliki sertifikat member IMPHNEN. Daftar terlebih dahulu di imphnen.dev.", "CERTIFICATE_NOT_FOUND");
  }
  if (certificate.name.toLocaleLowerCase("id-ID") !== name.toLocaleLowerCase("id-ID")) {
    return fail(409, `Nama harus sesuai sertifikat resmi: ${certificate.name}.`, "CERTIFICATE_NAME_MISMATCH");
  }
  // The lookup endpoint already scraped this UID and validated Turnstile.
  // Reuse its short-lived signed result; Facebook may reject a duplicate fetch.
  const facebookProfile = { name, joinedAt };
  if (!facebookProfile || facebookProfile.name.toLocaleLowerCase("id-ID") !== certificate.name.toLocaleLowerCase("id-ID")) {
    return fail(409, "Nama pada profil Facebook untuk UID ini tidak cocok dengan sertifikat resmi IMPHNEN.", "FACEBOOK_NAME_MISMATCH");
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) return fail(503, "Database belum dikonfigurasi di server.");
  let accessToken: string | null;
  try {
    accessToken = await getFirestoreAccessToken();
  } catch {
    accessToken = null;
  }
  if (!accessToken) return fail(503, "Service account Firestore belum dikonfigurasi. Isi FIREBASE_SERVICE_ACCOUNT_EMAIL dan FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY di environment server.");

  const documentResource = `projects/${encodeURIComponent(projectId)}/databases/(default)/documents`;
  const documentsBase = `https://firestore.googleapis.com/v1/${documentResource}`;
  let transaction = "";
  try {
    const begin = await fetch(`${documentsBase}:beginTransaction`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ options: { readWrite: {} } }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!begin.ok) return fail(502, "Database tidak bisa memulai transaksi penyimpanan.");
    transaction = (await begin.json() as { transaction?: string }).transaction ?? "";
  } catch {
    return fail(502, "Database tidak bisa dihubungi. Coba lagi.");
  }
  // Firestore's `documents` and `write.update.name` fields use resource names,
  // not REST URLs (the URL form is only for the request endpoint).
  const memberName = `${documentResource}/members/${encodeURIComponent(uid)}`;
  const ownerName = `${documentResource}/memberOwners/${encodeURIComponent(uid)}`;
  const claimName = `${documentResource}/usernames/${encodeURIComponent(certificate.username)}`;
  let docs: Array<{ name?: string; fields?: Record<string, { stringValue?: string; timestampValue?: string }> }>;
  try {
    const batch = await fetch(`${documentsBase}:batchGet`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ documents: [memberName, ownerName, claimName], transaction }),
      cache: "no-store",
      signal: AbortSignal.timeout(7000),
    });
    if (!batch.ok) {
      const rawError = await batch.text();
      let providerStatus = "";
      let providerMessage = "";
      try {
        const parsed = JSON.parse(rawError) as Array<{ error?: { status?: string; message?: string } }> | { error?: { status?: string; message?: string } };
        const error = Array.isArray(parsed) ? parsed[0]?.error : parsed.error;
        providerStatus = error?.status ?? "";
        providerMessage = error?.message ?? "";
      } catch { /* Firestore can return a non-JSON error body. */ }
      console.error("[firestore] Ownership batchGet failed:", { httpStatus: batch.status, providerStatus, providerMessage });
      if (batch.status === 403) {
        return fail(502, "Akun service account Firestore tidak memiliki izin membaca dokumen. Berikan role Cloud Datastore User (roles/datastore.user) pada project Firebase.");
      }
      return fail(502, `Database tidak dapat memeriksa kepemilikan kartu (HTTP ${batch.status}${providerStatus ? ` ${providerStatus}` : ""}).`);
    }
    const raw = await batch.text();
    docs = raw.split(/\r?\n/).filter(Boolean).flatMap((line) => {
      try {
        const item = JSON.parse(line) as { found?: { name?: string; fields?: Record<string, { stringValue?: string; timestampValue?: string }> } };
        return item.found ? [item.found] : [];
      } catch {
        return [];
      }
    });
  } catch {
    return fail(502, "Database tidak bisa dihubungi. Coba lagi.");
  }
  const byName = new Map(docs.map((document) => [document.name, document]));
  const existing = byName.get(memberName);
  const owner = byName.get(ownerName);
  const claim = byName.get(claimName);
  const existingOwnerUid = owner?.fields?.ownerUid?.stringValue;
  if (existing && existingOwnerUid !== certificate.username) {
    const oldName = existing.fields?.name?.stringValue?.toLocaleLowerCase("id-ID");
    const oldUsername = existing.fields?.usernameLower?.stringValue;
    if (oldName !== certificate.name.toLocaleLowerCase("id-ID") || oldUsername !== certificate.username) {
      return fail(409, "UID ini sudah memiliki kartu dengan identitas berbeda. Hubungi pemilik kartu.");
    }
  }
  if (claim && claim.fields?.uid?.stringValue !== uid) return fail(409, "Username sertifikat ini sudah digunakan pada kartu lain.");

  const oldUsername = existing?.fields?.usernameLower?.stringValue;
  let oldClaim: typeof claim = undefined;
  let oldClaimName = "";
  if (oldUsername && oldUsername !== certificate.username) {
    oldClaimName = `${documentResource}/usernames/${encodeURIComponent(oldUsername)}`;
    try {
      const previous = await fetch(`${documentsBase}:batchGet`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ documents: [oldClaimName], transaction }),
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      if (!previous.ok) return fail(502, "Database tidak bisa memeriksa username sebelumnya.");
      const lines = (await previous.text()).split(/\r?\n/).filter(Boolean);
      const found = lines.flatMap((line) => {
        try {
          const item = JSON.parse(line) as { found?: typeof claim };
          return item.found ? [item.found] : [];
        } catch {
          return [];
        }
      });
      oldClaim = found[0];
    } catch {
      return fail(502, "Database tidak bisa memeriksa username sebelumnya.");
    }
  }

  const now = new Date().toISOString();
  const fields: Record<string, FirestoreValue> = {
    uid: firestoreValue(uid),
    name: firestoreValue(certificate.name),
    username: firestoreValue(certificate.username),
    usernameLower: firestoreValue(certificate.username),
    city: firestoreValue(typeof card.city === "string" ? card.city.trim().slice(0, 40) : ""),
    province: firestoreValue(typeof card.province === "string" ? card.province.trim().slice(0, 40) : ""),
    joinedAt: firestoreValue(facebookProfile.joinedAt),
    badge: firestoreValue(typeof card.badge === "string" ? card.badge.trim().slice(0, 40) : "Member"),
    theme: firestoreValue(typeof card.theme === "string" ? card.theme : "navy"),
    accent: firestoreValue(typeof card.accent === "string" ? card.accent : "#ffc93c"),
    showUid: firestoreValue(card.showUid === true),
    createdAt: existing?.fields?.createdAt ?? { timestampValue: now },
    updatedAt: { timestampValue: now },
  };
  const ownerFields: Record<string, FirestoreValue> = {
    uid: firestoreValue(uid),
    ownerUid: firestoreValue(certificate.username),
    createdAt: owner?.fields?.createdAt ?? { timestampValue: now },
    updatedAt: { timestampValue: now },
  };
  const claimFields: Record<string, FirestoreValue> = {
    uid: firestoreValue(uid),
    createdAt: claim?.fields?.createdAt ?? { timestampValue: now },
  };
  const write = (name: string, docFields: Record<string, FirestoreValue>): FirestoreWrite => ({
    update: { name, fields: docFields },
    updateMask: { fieldPaths: Object.keys(docFields) },
  });
  const writes: FirestoreWrite[] = [write(memberName, fields), write(ownerName, ownerFields), write(claimName, claimFields)];
  if (oldClaimName && oldClaim?.fields?.uid?.stringValue === uid) writes.push({ delete: oldClaimName });
  let saved: Response;
  try {
    saved = await fetch(`${documentsBase}:commit`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        transaction,
        writes,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(7000),
    });
  } catch {
    return fail(502, "Kartu gagal disimpan. Database tidak bisa dihubungi.");
  }
  if (!saved.ok) return fail(502, "Database menolak penyimpanan kartu.");
  if (saved.status === 409 || saved.status === 400) return fail(409, "Data kartu berubah bersamaan. Muat ulang lalu coba lagi.");
  return NextResponse.json({ ok: true, name: certificate.name, username: certificate.username });
}
