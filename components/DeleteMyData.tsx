"use client";

import { useEffect, useState } from "react";
import { FacebookAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { doc, runTransaction } from "firebase/firestore";
import { getDb, getFirebaseAuth } from "@/lib/firebase";

function facebookUid(user: User): string | null {
  return user.providerData.find((provider) => provider.providerId === "facebook.com")?.uid ?? null;
}

export default function DeleteMyData() {
  const [user, setUser] = useState<User | null>(null);
  const [fbUid, setFbUid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) return;
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setFbUid(nextUser ? facebookUid(nextUser) : null);
    });
  }, []);

  async function login() {
    const auth = getFirebaseAuth();
    if (!auth) {
      setError(true);
      setMessage("Firebase belum dikonfigurasi.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await signInWithPopup(auth, new FacebookAuthProvider());
    } catch {
      setError(true);
      setMessage("Login Facebook gagal. Pastikan Facebook Login aktif di Firebase dan domain situs diizinkan.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteData() {
    if (!fbUid || !/^\d{5,20}$/.test(fbUid)) {
      setError(true);
      setMessage("Akun Facebook tidak memberikan UID yang valid.");
      return;
    }
    const db = getDb();
    if (!db) {
      setError(true);
      setMessage("Database belum dikonfigurasi.");
      return;
    }
    if (!window.confirm(`Hapus data aplikasi untuk UID Facebook ${fbUid}? Tindakan ini tidak dapat dibatalkan.`)) return;

    setBusy(true);
    setMessage("");
    try {
      await runTransaction(db, async (tx) => {
        const memberRef = doc(db, "members", fbUid);
        const profileRef = doc(db, "memberProfiles", fbUid);
        const [memberSnap, profileSnap] = await Promise.all([tx.get(memberRef), tx.get(profileRef)]);
        const usernameLower = memberSnap.exists() ? memberSnap.data().usernameLower : null;
        const claimRef = typeof usernameLower === "string" ? doc(db, "usernames", usernameLower) : null;
        const claimSnap = claimRef ? await tx.get(claimRef) : null;

        if (memberSnap.exists()) tx.delete(memberRef);
        if (profileSnap.exists()) tx.delete(profileRef);
        if (claimRef && claimSnap?.exists() && claimSnap.data().uid === fbUid) tx.delete(claimRef);
      });
      setError(false);
      setMessage("Data aplikasi untuk UID Facebook terverifikasi berhasil dihapus.");
    } catch {
      setError(true);
      setMessage("Penghapusan gagal. Pastikan Firestore Rules terbaru sudah dipasang, lalu coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    const auth = getFirebaseAuth();
    if (auth) await signOut(auth);
    setMessage("");
  }

  return (
    <section className="deletion-form" aria-live="polite">
      {!user ? (
        <button className="primary-button" type="button" onClick={login} disabled={busy}>
          {busy ? "Membuka login…" : "Verifikasi dengan Facebook"}
        </button>
      ) : (
        <>
          <p className="deletion-identity">Login terverifikasi · UID Facebook: <strong>{fbUid ?? "tidak tersedia"}</strong></p>
          {fbUid && /^\d{5,20}$/.test(fbUid) ? (
            <button className="delete-button" type="button" onClick={deleteData} disabled={busy}>
              {busy ? "Menghapus…" : "Hapus data saya sekarang"}
            </button>
          ) : (
            <p className="deletion-message is-error">Facebook tidak memberikan ID yang cocok untuk menghapus data aplikasi.</p>
          )}
          <button className="text-button" type="button" onClick={logout} disabled={busy}>Keluar</button>
        </>
      )}
      {message && <p className={error ? "deletion-message is-error" : "deletion-message is-ok"} role="status">{message}</p>}
    </section>
  );
}
