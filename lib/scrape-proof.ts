import { createHmac, timingSafeEqual } from "node:crypto";

type ScrapeProofPayload = {
  uid: string;
  name: string;
  joinedAt: string;
  expiresAt: number;
};

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function secret() {
  // A server-only key that is already required for protected API operations.
  return process.env.TURNSTILE_SECRET_KEY;
}

export function createScrapeProof(payload: Omit<ScrapeProofPayload, "expiresAt">): string | null {
  const key = secret();
  if (!key) return null;
  const encoded = Buffer.from(JSON.stringify({ ...payload, expiresAt: Date.now() + 15 * 60_000 })).toString("base64url");
  return `${encoded}.${sign(encoded, key)}`;
}

export function verifyScrapeProof(
  proof: unknown,
  expected: { uid: string; name: string; joinedAt: string },
): boolean {
  const key = secret();
  if (!key || typeof proof !== "string" || proof.length > 2048) return false;
  const [encoded, signature, extra] = proof.split(".");
  if (!encoded || !signature || extra) return false;

  const expectedSignature = Buffer.from(sign(encoded, key));
  const actualSignature = Buffer.from(signature);
  if (expectedSignature.length !== actualSignature.length || !timingSafeEqual(expectedSignature, actualSignature)) return false;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as ScrapeProofPayload;
    return payload.uid === expected.uid
      && payload.name === expected.name
      && payload.joinedAt === expected.joinedAt
      && Number.isFinite(payload.expiresAt)
      && payload.expiresAt > Date.now();
  } catch {
    return false;
  }
}
