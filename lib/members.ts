import { doc, getDoc, runTransaction, serverTimestamp, setDoc } from "firebase/firestore";
import { getDb } from "./firebase";
import { THEMES, type ThemeId } from "./themes";
import type { CardState } from "./card";

const USERNAME_RE = /^[A-Za-z0-9._]{3,24}$/;

export interface ScrapedProfile {
  name: string;
  badge: string;
  joinedAt: string;
}

export async function loadScrapedProfile(uid: string): Promise<ScrapedProfile | null> {
  const db = getDb();
  if (!db) throw new Error("Firebase belum dikonfigurasi.");
  const snap = await getDoc(doc(db, "memberProfiles", uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  if (typeof data.name !== "string" || typeof data.joinedAt !== "string") return null;
  return {
    name: data.name,
    badge: typeof data.badge === "string" && data.badge.trim() ? data.badge : "Member",
    joinedAt: data.joinedAt,
  };
}

export async function saveScrapedProfile(uid: string, profile: ScrapedProfile): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("Firebase belum dikonfigurasi.");
  await setDoc(doc(db, "memberProfiles", uid), {
    uid,
    name: profile.name,
    badge: profile.badge,
    joinedAt: profile.joinedAt,
    updatedAt: serverTimestamp(),
  });
}

export async function loadMemberCard(uid: string): Promise<CardState | null> {
  const db = getDb();
  if (!db) throw new Error("Firebase belum dikonfigurasi.");
  const snap = await getDoc(doc(db, "members", uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    uid,
    name: typeof d.name === "string" ? d.name : "",
    username: typeof d.username === "string" ? d.username : "",
    city: typeof d.city === "string" ? d.city : "",
    province: typeof d.province === "string" ? d.province : "",
    joined: typeof d.joinedAt === "string" ? d.joinedAt : "",
    badge: typeof d.badge === "string" ? d.badge : "Member",
    theme: (d.theme in THEMES ? d.theme : "navy") as ThemeId,
    accent: typeof d.accent === "string" && /^#[0-9a-fA-F]{6}$/.test(d.accent) ? d.accent : "#ffc93c",
    showUid: d.showUid === true,
  };
}

export function validateForSave(c: CardState): string | null {
  if (!/^\d{5,20}$/.test(c.uid)) return "UID harus berupa angka, 5 sampai 20 digit.";
  if (!c.name.trim()) return "Isi nama sebelum menyimpan.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.joined)) return "Isi tanggal bergabung yang valid.";
  if (!USERNAME_RE.test(c.username)) return "Username harus 3 sampai 24 karakter: huruf, angka, titik, atau garis bawah.";
  return null;
}

/** Menulis members/{uid} dan usernames/{lower} dalam satu transaksi, sesuai firestore.rules. */
export async function saveCard(c: CardState): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("Firebase belum dikonfigurasi.");
  const lower = c.username.toLowerCase();

  await runTransaction(db, async (tx) => {
    const memberRef = doc(db, "members", c.uid);
    const claimRef = doc(db, "usernames", lower);

    const memberSnap = await tx.get(memberRef);
    const claimSnap = await tx.get(claimRef);

    if (claimSnap.exists() && claimSnap.data().uid !== c.uid) {
      throw new Error("Username sudah dipakai member lain.");
    }

    const oldLower: string | null = memberSnap.exists() ? (memberSnap.data().usernameLower ?? null) : null;

    if (!claimSnap.exists()) tx.set(claimRef, { uid: c.uid, createdAt: serverTimestamp() });
    if (oldLower && oldLower !== lower) tx.delete(doc(db, "usernames", oldLower));

    tx.set(memberRef, {
      uid: c.uid,
      name: c.name.trim(),
      badge: c.badge.trim() || "Member",
      city: c.city.trim(),
      province: c.province.trim(),
      username: c.username,
      usernameLower: lower,
      joinedAt: c.joined,
      theme: c.theme,
      accent: c.accent,
      showUid: c.showUid,
      createdAt: memberSnap.exists() ? memberSnap.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

export function saveErrorMessage(e: unknown): string {
  if (e instanceof Error) {
    if (e.message.startsWith("Username sudah")) return e.message;
    const code = (e as { code?: string }).code;
    if (code === "permission-denied") return "Firestore menolak penyimpanan. Deploy firestore.rules terbaru, lalu coba lagi.";
    if (code === "unavailable") return "Tidak bisa menghubungi Firestore. Periksa koneksi, lalu coba lagi.";
  }
  return "Kartu gagal disimpan. Coba lagi.";
}
