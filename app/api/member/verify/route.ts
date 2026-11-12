import { NextResponse } from "next/server";
import { fetchOfficialCertificate } from "@/lib/certificate";

export const dynamic = "force-dynamic";

function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as {
    name?: unknown;
    username?: unknown;
  } | null;
  if (!body) return fail(400, "Data verifikasi tidak valid.");

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const username = typeof body.username === "string" ? body.username.trim().replace(/^@/, "") : "";
  if (!name || !/^[a-z][a-z0-9_]{2,19}$/i.test(username)) {
    return fail(400, "Nama dan username harus diisi dengan benar.");
  }

  let certificate;
  try {
    certificate = await fetchOfficialCertificate(username);
  } catch (error) {
    return fail(502, error instanceof Error ? error.message : "Sertifikat IMPHNEN tidak bisa diverifikasi.");
  }
  if (!certificate) return fail(409, "Username belum memiliki sertifikat resmi. Daftar terlebih dahulu di imphnen.dev.");
  if (certificate.name.toLocaleLowerCase("id-ID") !== name.toLocaleLowerCase("id-ID")) {
    return fail(409, `Nama harus sesuai sertifikat resmi: ${certificate.name}.`);
  }

  return NextResponse.json({ ok: true, name: certificate.name, username: certificate.username });
}
