export interface OfficialCertificate {
  username: string;
  name: string;
}

function decodeHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detail(html: string, label: string) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`<dt\\b[^>]*>\\s*${escapedLabel}\\s*<\\/dt>\\s*<dd\\b[^>]*>([\\s\\S]*?)<\\/dd>`, "i").exec(html);
  return match ? decodeHtml(match[1]) : "";
}

export async function fetchOfficialCertificate(usernameInput: string): Promise<OfficialCertificate | null> {
  const username = usernameInput.trim().replace(/^@/, "").toLowerCase();
  if (!/^[a-z][a-z0-9_]{2,19}$/.test(username)) return null;

  let response: Response;
  try {
    response = await fetch(`https://imphnen.dev/sertifikat/${encodeURIComponent(username)}`, {
      headers: { Accept: "text/html" },
      cache: "no-store",
      signal: AbortSignal.timeout(7000),
    });
  } catch {
    throw new Error("Situs sertifikat IMPHNEN tidak bisa dihubungi. Coba lagi.");
  }

  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Situs sertifikat IMPHNEN sedang bermasalah. Coba lagi.");

  const html = await response.text();
  if (!html.includes("Sertifikat ini asli.")) return null;
  const name = detail(html, "Nama");
  const certificateUsername = detail(html, "Username").replace(/^@/, "").toLowerCase();
  if (!name || certificateUsername !== username) return null;
  return { username: certificateUsername, name };
}
