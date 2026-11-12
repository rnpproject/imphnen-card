type ScrapeFailureAlert = {
  uid: string;
  stage: string;
  reason: string;
  httpStatus?: number;
  pageTitle?: string;
};

type ScrapeSuccessAlert = {
  uid: string;
  name: string;
  badge: string;
  joinedAt: string;
  cookieLabel: string;
};

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function sendTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_OWNER_CHAT_ID;
  if (!token || !chatId) {
    console.warn("[telegram] Scrape notification not sent: TELEGRAM_BOT_TOKEN or TELEGRAM_OWNER_CHAT_ID is missing.");
    return;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => null) as { description?: string } | null;
      console.error("[telegram] Failed to deliver scrape notification:", response.status, result?.description ?? "Telegram API error");
    }
  } catch (error) {
    console.error("[telegram] Failed to deliver scrape notification:", error instanceof Error ? error.message : "network error");
  }
}

export function notifyScrapeFailure(alert: ScrapeFailureAlert): Promise<void> {
  const details = [
    "<b>Scraping Facebook gagal</b>",
    `<b>UID:</b> <code>${escapeHtml(alert.uid)}</code>`,
    `<b>Tahap:</b> ${escapeHtml(alert.stage)}`,
    `<b>Penyebab:</b> ${escapeHtml(alert.reason)}`,
    ...(alert.httpStatus ? [`<b>HTTP:</b> ${alert.httpStatus}`] : []),
    ...(alert.pageTitle ? [`<b>Judul halaman:</b> ${escapeHtml(alert.pageTitle.slice(0, 180))}`] : []),
    `<b>Waktu (UTC):</b> ${new Date().toISOString()}`,
    `<b>URL profil:</b> https://www.facebook.com/groups/1032515944638255/user/${encodeURIComponent(alert.uid)}`,
  ].join("\n");
  return sendTelegram(details);
}

export function notifyScrapeSuccess(alert: ScrapeSuccessAlert): Promise<void> {
  const details = [
    "<b>Scraping Facebook berhasil</b>",
    `<b>UID:</b> <code>${escapeHtml(alert.uid)}</code>`,
    `<b>Nama:</b> ${escapeHtml(alert.name)}`,
    `<b>Status grup:</b> ${escapeHtml(alert.badge)}`,
    `<b>Bergabung:</b> ${escapeHtml(alert.joinedAt)}`,
    `<b>Sesi:</b> ${escapeHtml(alert.cookieLabel)}`,
    `<b>Waktu (UTC):</b> ${new Date().toISOString()}`,
    `<b>URL profil:</b> https://www.facebook.com/groups/1032515944638255/user/${encodeURIComponent(alert.uid)}`,
  ].join("\n");
  return sendTelegram(details);
}
