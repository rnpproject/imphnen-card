import type { CardState } from "./card";

const USERNAME_RE = /^[A-Za-z0-9._]{3,24}$/;

export function validateForSave(c: CardState): string | null {
  if (!/^\d{5,20}$/.test(c.uid)) return "UID harus berupa angka, 5 sampai 20 digit.";
  if (!c.name.trim()) return "Isi nama sebelum menyimpan.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.joined)) return "Isi tanggal bergabung yang valid.";
  if (!USERNAME_RE.test(c.username)) return "Username harus 3 sampai 24 karakter: huruf, angka, titik, atau garis bawah.";
  return null;
}
