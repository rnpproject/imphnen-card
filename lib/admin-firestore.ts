import type { CardState } from "./card";
import type { ThemeId } from "./themes";

type FirestoreValue = { stringValue?: string; booleanValue?: boolean; timestampValue?: string };
type FirestoreDocument = { name?: string; fields?: Record<string, FirestoreValue> };

export async function getFirestoreAccessToken(): Promise<string | null> {
  const email = process.env.FIREBASE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) return null;

  const crypto = await import("node:crypto");
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iss: email,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${signer.sign(key, "base64url")}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) return null;
  const data = await response.json() as { access_token?: string };
  return data.access_token ?? null;
}

function text(fields: Record<string, FirestoreValue>, key: string, fallback = "") {
  const value = fields[key]?.stringValue;
  return typeof value === "string" ? value : fallback;
}

function decodeRunQueryResponse(raw: string): FirestoreDocument[] {
  try {
    const parsed = JSON.parse(raw) as Array<{ document?: FirestoreDocument }>;
    return parsed.flatMap((item) => item.document ? [item.document] : []);
  } catch {
    return raw.split(/\r?\n/).filter(Boolean).flatMap((line) => {
      try {
        const item = JSON.parse(line) as { document?: FirestoreDocument };
        return item.document ? [item.document] : [];
      } catch {
        return [];
      }
    });
  }
}

function cardFromDocument(document: FirestoreDocument | null | undefined): CardState | null {
  if (!document?.fields) return null;
  const d = document.fields;
  const uid = text(d, "uid");
  const username = text(d, "username");
  const rawTheme = text(d, "theme", "navy");
  if (!/^\d{5,20}$/.test(uid) || !/^[a-z][a-z0-9_]{2,19}$/i.test(username)) return null;
  return {
    uid,
    name: text(d, "name"),
    username,
    city: text(d, "city"),
    province: text(d, "province"),
    joined: text(d, "joinedAt"),
    badge: text(d, "badge", "Member"),
    theme: (rawTheme === "langit" || rawTheme === "dark" || rawTheme === "navy" ? rawTheme : "navy") as ThemeId,
    accent: /^#[0-9a-fA-F]{6}$/.test(text(d, "accent")) ? text(d, "accent") : "#ffc93c",
    showUid: d.showUid?.booleanValue === true,
  };
}

function documentsUrl(projectId: string) {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents`;
}

export async function loadPublicCardByUid(uid: string): Promise<CardState | null> {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) return null;
  const accessToken = await getFirestoreAccessToken();
  if (!accessToken) return null;
  const response = await fetch(`${documentsUrl(projectId)}/members/${encodeURIComponent(uid)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) return null;
  return cardFromDocument(await response.json() as FirestoreDocument);
}

export async function loadPublicCardByUsername(username: string): Promise<CardState | null> {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) return null;
  const accessToken = await getFirestoreAccessToken();
  if (!accessToken) return null;
  const response = await fetch(`${documentsUrl(projectId)}:runQuery`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "members" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "usernameLower" },
            op: "EQUAL",
            value: { stringValue: username.toLowerCase() },
          },
        },
        limit: 1,
      },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) return null;
  const [document] = decodeRunQueryResponse(await response.text());
  return cardFromDocument(document);
}
