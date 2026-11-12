import { NextResponse } from "next/server";
import { buildMetadata, type CardState } from "@/lib/card";
import { THEMES } from "@/lib/themes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PINATA_FILES = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const PINATA_JSON = "https://api.pinata.cloud/pinning/pinJSONToIPFS";
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

async function pinFile(file: File, name: string, jwt: string): Promise<string> {
  const body = new FormData();
  body.append("file", file, name);
  body.append("pinataMetadata", JSON.stringify({ name }));
  body.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

  const response = await fetch(PINATA_FILES, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || typeof result?.IpfsHash !== "string") {
    throw new Error(typeof result?.error === "string" ? result.error : `Pinata menolak upload (${response.status}).`);
  }
  return result.IpfsHash;
}

async function pinJson(content: object, name: string, jwt: string): Promise<string> {
  const response = await fetch(PINATA_JSON, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      pinataOptions: { cidVersion: 1 },
      pinataMetadata: { name },
      pinataContent: content,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || typeof result?.IpfsHash !== "string") {
    throw new Error(typeof result?.error === "string" ? result.error : `Pinata menolak metadata (${response.status}).`);
  }
  return result.IpfsHash;
}

function parseCard(value: FormDataEntryValue | null): CardState | null {
  if (typeof value !== "string") return null;
  try {
    const raw = JSON.parse(value) as Partial<CardState>;
    if (
      !raw || typeof raw.uid !== "string" || !/^\d{5,20}$/.test(raw.uid)
      || typeof raw.name !== "string" || !raw.name.trim()
      || typeof raw.joined !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw.joined)
    ) return null;

    const theme = raw.theme === "malam" ? "dark" : raw.theme && raw.theme in THEMES ? raw.theme : "navy";
    return {
      uid: raw.uid,
      name: raw.name.trim().slice(0, 40),
      city: typeof raw.city === "string" ? raw.city.trim().slice(0, 40) : "",
      province: typeof raw.province === "string" ? raw.province.trim().slice(0, 40) : "",
      username: typeof raw.username === "string" ? raw.username.trim().slice(0, 24) : "",
      joined: raw.joined,
      badge: typeof raw.badge === "string" ? raw.badge.trim().slice(0, 40) : "Member Resmi",
      theme,
      accent: typeof raw.accent === "string" && /^#[0-9a-fA-F]{6}$/.test(raw.accent) ? raw.accent : "#ffc93c",
      showUid: false,
    };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return fail(403, "Upload hanya bisa dimulai dari situs ini.");

  const jwt = process.env.PINATA_JWT;
  if (!jwt) return fail(503, "Fitur mint belum siap. PINATA_JWT belum dikonfigurasi di server.");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "Data media NFT tidak valid.");
  }

  const card = parseCard(form.get("card"));
  const front = form.get("front");
  const back = form.get("back");
  if (!card || !(front instanceof File) || !(back instanceof File)) {
    return fail(400, "Data kartu atau gambar depan/belakang tidak lengkap.");
  }
  if (front.type !== "image/png" || back.type !== "image/png" || front.size === 0 || back.size === 0) {
    return fail(400, "Media NFT harus berupa PNG.");
  }
  if (front.size > MAX_IMAGE_BYTES || back.size > MAX_IMAGE_BYTES || front.size + back.size > 3_800_000) {
    return fail(413, "Gambar NFT terlalu besar. Coba lagi dengan media yang lebih kecil.");
  }

  try {
    const [frontCid, backCid] = await Promise.all([
      pinFile(front, `imphnen-${card.uid}-front.png`, jwt),
      pinFile(back, `imphnen-${card.uid}-back.png`, jwt),
    ]);
    if (!/^[a-zA-Z0-9]+$/.test(frontCid) || !/^[a-zA-Z0-9]+$/.test(backCid)) {
      throw new Error("Pinata mengembalikan CID yang tidak valid.");
    }

    const frontGateway = `https://gateway.pinata.cloud/ipfs/${frontCid}`;
    const backGateway = `https://gateway.pinata.cloud/ipfs/${backCid}`;
    const viewerHtml = `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>Kartu Member IMPHNEN 3D</title><style>*{box-sizing:border-box}html,body{min-height:100%;margin:0}body{display:grid;place-items:center;overflow:hidden;color:#eaf5ff;background:radial-gradient(ellipse at 50% 42%,#203b66,#091326 72%);font:600 15px system-ui,sans-serif}main{width:100%;min-height:100vh;display:grid;place-items:center;padding:32px 18px}.scene{width:min(92vw,850px);perspective:1400px}.card{position:relative;width:100%;aspect-ratio:1.586;transform-style:preserve-3d;border-radius:3.2%;background:#10234a;box-shadow:0 34px 90px #0008;animation:rotate 14s ease-in-out infinite}.face{position:absolute;inset:0;overflow:hidden;border:1px solid #ffffff35;border-radius:inherit;backface-visibility:hidden}.face img{display:block;width:100%;height:100%;object-fit:cover}.front{transform:translateZ(5px)}.back{transform:rotateY(180deg) translateZ(5px)}.edge{position:absolute;inset:0;border:5px solid #15315f;border-radius:inherit;transform:translateZ(0)}.label{margin:25px 0 0;text-align:center;color:#b9cee8}@keyframes rotate{0%,8%{transform:rotateY(0) rotateX(3deg)}42%,58%{transform:rotateY(180deg) rotateX(-3deg)}92%,100%{transform:rotateY(360deg) rotateX(3deg)}}@media(prefers-reduced-motion:reduce){.card{animation-duration:30s}}</style></head><body><main><div class="scene"><div class="card"><div class="face front"><img src="${frontGateway}" alt="Sisi depan kartu member"></div><div class="face back"><img src="${backGateway}" alt="Sisi belakang kartu member"></div><div class="edge"></div></div><p class="label">Kartu Member IMPHNEN · model 3D</p></div></main></body></html>`;
    const viewerFile = new File([viewerHtml], `imphnen-${card.uid}-viewer.html`, { type: "text/html" });
    const viewerCid = await pinFile(viewerFile, `imphnen-${card.uid}-3d-viewer.html`, jwt);
    if (!/^[a-zA-Z0-9]+$/.test(viewerCid)) throw new Error("Pinata mengembalikan CID viewer yang tidak valid.");

    const baseMetadata = buildMetadata(card);
    const metadata = {
      ...baseMetadata,
      image: `ipfs://${frontCid}`,
      animation_url: `ipfs://${viewerCid}`,
      properties: { back_image: `ipfs://${backCid}` },
    };
    const metadataCid = await pinJson(metadata, `imphnen-${card.uid}-metadata.json`, jwt);
    if (!/^[a-zA-Z0-9]+$/.test(metadataCid)) throw new Error("Pinata mengembalikan CID metadata yang tidak valid.");

    return NextResponse.json({
      tokenURI: `ipfs://${metadataCid}`,
      metadataCID: metadataCid,
      viewerURL: `https://gateway.pinata.cloud/ipfs/${viewerCid}`,
    });
  } catch (error) {
    return fail(502, error instanceof Error ? error.message : "Media NFT gagal dipin ke IPFS.");
  }
}
