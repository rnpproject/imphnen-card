import { GROUP_URL, THEMES, type Theme } from "./themes";
import { fmtDate } from "./date";
import { identiconCells } from "./identicon";
import { locationText, type CardState } from "./card";

const loadImg = (src: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
  return t + "…";
}

function txt(
  ctx: CanvasRenderingContext2D, str: string, x: number, y: number, font: string, color: string,
  align: CanvasTextAlign = "left", spacing = "0px", maxW?: number,
) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  try { ctx.letterSpacing = spacing; } catch { /* browser lama */ }
  ctx.fillText(maxW ? fitText(ctx, str, maxW) : str, x, y);
  try { ctx.letterSpacing = "0px"; } catch { /* browser lama */ }
}

function drawBase(ctx: CanvasRenderingContext2D, W: number, H: number, u: number, T: Theme) {
  rr(ctx, 0.5, 0.5, W - 1, H - 1, 5 * u);
  ctx.save();
  ctx.clip();
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, T.bg1);
  g.addColorStop(1, T.bg2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = T.deco;
  ctx.lineWidth = 9 * u;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const paths = [[[31, 33], [15, 49], [31, 65]], [[57, 28], [45, 68]], [[72, 33], [88, 49], [72, 65]]];
  paths.forEach((pts) => {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0] * u, p[1] * u) : ctx.moveTo(p[0] * u, p[1] * u)));
    ctx.stroke();
  });
  return () => {
    ctx.restore();
    rr(ctx, 0.5, 0.5, W - 1, H - 1, 5 * u);
    ctx.strokeStyle = T.edge;
    ctx.lineWidth = 2;
    ctx.stroke();
  };
}

/** Font keluarga diambil dari elemen yang sudah dirender, karena next/font memberi nama keluarga ber-hash. */
function families() {
  const pick = (sel: string, fallback: string) => {
    const el = document.querySelector(sel);
    return el ? getComputedStyle(el).fontFamily : fallback;
  };
  return {
    display: pick(".f-badge", "system-ui, sans-serif"),
    body: pick(".f-name", "system-ui, sans-serif"),
  };
}

export async function renderCanvas(c: CardState, side: "front" | "back", width = 2640): Promise<HTMLCanvasElement> {
  const F = families();
  await Promise.all([
    document.fonts.load("800 20px " + F.body),
    document.fonts.load("700 20px " + F.body),
    document.fonts.load("500 20px " + F.display),
  ]);

  const W = width, H = Math.round(W / 1.586), u = W / 100;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d")!;
  const T = THEMES[c.theme];
  const finish = drawBase(ctx, W, H, u, T);
  const name = c.name.trim() || "Nama member";
  const userColor = T.userAccent ? c.accent : T.text;
  const N = F.body, D = F.display;

  if (side === "front") {
    const logo = await loadImg("/logo.png");
    ctx.drawImage(logo, 6.5 * u, 6 * u, 20 * u, (20 * u * logo.height) / logo.width);
    txt(ctx, c.badge.trim() || "Member", W - 6.5 * u, 11.3 * u, `600 ${4 * u}px ${D}`, userColor, "right");
    const ns = name.length > 24 ? 5 : name.length > 16 ? 6 : 7.2;
    const ny = (name.length > 24 ? 26.2 : name.length > 16 ? 25.4 : 24.8) + ns / 2;
    txt(ctx, name, 6.5 * u, ny * u, `800 ${ns * u}px ${N}`, T.text, "left", "0px", 87 * u);
    txt(ctx, locationText(c), 6.5 * u, 34.65 * u, `600 ${3.7 * u}px ${N}`, T.sub, "left", "0px", 87 * u);
    txt(ctx, "USERNAME", 6.5 * u, 48.5 * u, `800 ${2.6 * u}px ${N}`, T.label, "left", 0.12 * 2.6 * u + "px");
    txt(ctx, "@" + (c.username || "username"), 6.5 * u, 54.2 * u, `800 ${6.2 * u}px ${N}`, userColor, "left", "0px", 56 * u);
    txt(ctx, "SEJAK", W - 6.5 * u, 48.5 * u, `800 ${2.6 * u}px ${N}`, T.label, "right", 0.12 * 2.6 * u + "px");
    txt(ctx, fmtDate(c.joined, false), W - 6.5 * u, 54.2 * u, `800 ${4.6 * u}px ${N}`, T.text, "right");
  } else {
    ctx.fillStyle = T.stripe;
    ctx.fillRect(0, 7 * u, W, 9 * u);
    txt(ctx, "Ingin Menjadi Programmer Handal", 6.5 * u, 21.5 * u + 1.9 * u, `500 ${3.8 * u}px ${D}`, T.text);
    txt(ctx, "Namun Enggan Ngoding", 6.5 * u, 21.5 * u + 1.9 * u + 3.8 * 1.3 * u, `500 ${3.8 * u}px ${D}`, T.text);
    const ix = W - 6.5 * u - 16 * u, iy = 21 * u;
    rr(ctx, ix, iy, 16 * u, 16 * u, 2.4 * u);
    ctx.fillStyle = T.tile;
    ctx.fill();
    ctx.fillStyle = userColor;
    identiconCells(c.uid || c.username).forEach((row, r) =>
      row.forEach((on, cc) => {
        if (!on) return;
        const k = (16 * u) / 20;
        rr(ctx, ix + (2 + cc * 3.2) * k, iy + (2 + r * 3.2) * k, 2.6 * k, 2.6 * k, 0.7 * k);
        ctx.fill();
      }),
    );
    const lab = (s: string, y: number) =>
      txt(ctx, s, 6.5 * u, y * u, `800 ${2.6 * u}px ${N}`, T.label, "left", 0.12 * 2.6 * u + "px");
    lab("TERDAFTAR SEJAK", 38 + 1.3);
    txt(ctx, fmtDate(c.joined, true), 6.5 * u, (41.2 + 1.7) * u, `800 ${3.4 * u}px ${N}`, T.text);
    if (c.showUid && c.uid) {
      lab("UID FACEBOOK", 47 + 1.3);
      txt(ctx, c.uid, 6.5 * u, (50.2 + 1.7) * u, `800 ${3.4 * u}px ${N}`, T.text, "left", 0.04 * 3.4 * u + "px");
    }
    txt(ctx, GROUP_URL, 6.5 * u, (56.2 + 1.35) * u, `700 ${2.7 * u}px ${N}`, T.sub);
  }
  finish();
  return cv;
}

export async function downloadCard(c: CardState, side: "front" | "back") {
  const cv = await renderCanvas(c, side);
  const blob = await new Promise<Blob | null>((r) => cv.toBlob(r, "image/png"));
  if (!blob) throw new Error("toBlob gagal");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `kartu-imphnen-${c.username || "member"}-${side === "front" ? "depan" : "belakang"}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
