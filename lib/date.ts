export function toYMD(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = new Date(typeof value === "number" && value < 1e12 ? value * 1000 : (value as string | number));
  if (isNaN(d.getTime())) return null;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

export function fmtDate(ymd: string, long: boolean): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || "");
  if (!m) return "-";
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  const opts: Intl.DateTimeFormatOptions = long
    ? { day: "numeric", month: "long", year: "numeric" }
    : { month: "short", year: "numeric" };
  return new Intl.DateTimeFormat("id-ID", { ...opts, timeZone: "UTC" }).format(d);
}
