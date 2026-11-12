"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { FacebookAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import Card3D, { type SnapRequest } from "./Card3D";
import NftMintPanel from "./NftMintPanel";
import { ACCENTS, THEMES, ZONES, type ThemeId } from "@/lib/themes";
import { INITIAL_CARD, buildMetadata, cleanUser, type CardState } from "@/lib/card";
import { downloadCard } from "@/lib/exportPng";
import { firebaseReady, getFirebaseAuth } from "@/lib/firebase";
import { loadMemberCard, loadScrapedProfile, saveCard, saveErrorMessage, saveScrapedProfile, validateForSave } from "@/lib/members";

type Kind = "ok" | "err" | "busy" | "";
interface Status { text: string; kind: Kind }
const NONE: Status = { text: "", kind: "" };

function cardSignature(c: CardState) {
  return JSON.stringify([
    c.uid, c.name.trim(), c.badge.trim(), c.city.trim(), c.province.trim(), c.username,
    c.joined, c.theme, c.accent, c.showUid,
  ]);
}

export default function MemberCardApp() {
  const [card, setCard] = useState<CardState>(INITIAL_CARD);
  const [uidInput, setUidInput] = useState(INITIAL_CARD.uid);
  const [activeUid, setActiveUid] = useState<string | null>(null);
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [facebookUid, setFacebookUid] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authStatus, setAuthStatus] = useState("");

  const [lookupStatus, setLookupStatus] = useState<Status>(NONE);
  const [saveStatus, setSaveStatus] = useState<Status>(NONE);
  const [copyStatus, setCopyStatus] = useState<Status>(NONE);
  const [looking, setLooking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState<"front" | "back" | null>(null);

  const [spinning, setSpinning] = useState(false);
  const [snap, setSnap] = useState<SnapRequest>(null);

  useEffect(() => {
    setSpinning(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) return;
    return onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setFacebookUid(user?.providerData.find((provider) => provider.providerId === "facebook.com")?.uid ?? null);
    });
  }, []);

  async function onFacebookLogin() {
    const auth = getFirebaseAuth();
    if (!auth) { setAuthStatus("Firebase belum dikonfigurasi."); return; }
    setAuthBusy(true);
    setAuthStatus("");
    try {
      await signInWithPopup(auth, new FacebookAuthProvider());
    } catch {
      setAuthStatus("Login gagal. Pastikan Facebook Login aktif di Firebase dan domain situs diizinkan.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function onFacebookLogout() {
    const auth = getFirebaseAuth();
    if (auth) await signOut(auth);
    setAuthStatus("");
  }

  const patch = (p: Partial<CardState>) => setCard((c) => ({ ...c, ...p }));
  const ownsCard = facebookUid !== null && facebookUid === card.uid;
  const verifiedProfile = ownsCard && activeUid === card.uid;
  const displayedCard = useMemo(() => ({
    ...card,
    badge: verifiedProfile ? `${card.badge.trim() || "Member"} Verified` : "Member",
  }), [card, verifiedProfile]);
  const metadata = useMemo(() => JSON.stringify(buildMetadata(displayedCard), null, 2), [displayedCard]);

  const showFace = (face: "front" | "back") => {
    setSpinning(false);
    setSnap({ face, nonce: Date.now() });
  };

  async function onLookup(e: FormEvent) {
    e.preventDefault();
    if (!facebookUid) {
      setLookupStatus({ text: "Login dengan Facebook terlebih dahulu untuk mencari data.", kind: "err" });
      return;
    }
    const uid = uidInput.replace(/\s+/g, "");
    if (!/^\d{5,20}$/.test(uid)) {
      setLookupStatus({ text: "UID harus berupa angka, 5 sampai 20 digit.", kind: "err" });
      return;
    }
    setLooking(true);
    setSavedSignature(null);
    setSaveStatus(NONE);
    setLookupStatus({ text: "Memeriksa database...", kind: "busy" });
    try {
      const savedCard = firebaseReady ? await loadMemberCard(uid) : null;
      let profile = firebaseReady ? await loadScrapedProfile(uid) : null;
      if (!profile && savedCard?.name && savedCard.joined) {
        profile = { name: savedCard.name, badge: savedCard.badge || "Member", joinedAt: savedCard.joined };
      }
      let scraped = false;
      let cacheWriteFailed = false;
      let profileCached = false;
      let cacheSkipped = false;

      if (!profile) {
        setLookupStatus({ text: "UID tidak ada di database. Mengambil data dari Facebook...", kind: "busy" });
        const res = await fetch(`/api/member/${encodeURIComponent(uid)}`, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) throw new Error(data?.error ?? `Server menjawab dengan kode ${res.status}.`);
        profile = { name: data.name, badge: data.badge || "Member", joinedAt: data.joinedAt };
        scraped = true;
        if (firebaseReady && facebookUid === uid) {
          try {
            await saveScrapedProfile(uid, profile);
            profileCached = true;
          } catch {
            cacheWriteFailed = true;
          }
        } else if (firebaseReady) {
          cacheSkipped = true;
        }
      }

      const sameUid = uid === card.uid;
      const next: CardState = {
        ...(savedCard ?? (sameUid ? card : {
          ...INITIAL_CARD,
          uid,
          username: "",
          city: "",
          province: "",
          showUid: false,
        })),
        uid,
        name: profile.name,
        badge: profile.badge,
        joined: profile.joinedAt,
      };
      setActiveUid(uid);
      setCard(next);
      setSavedSignature(savedCard ? cardSignature(savedCard) : null);
      showFace("front");
      setLookupStatus({
        text: savedCard
          ? `Data UID ${uid} dimuat dari database.`
          : scraped && !firebaseReady
            ? `Data Facebook ditemukan, tetapi Firestore belum dikonfigurasi sehingga profil belum tersimpan.`
          : scraped && cacheWriteFailed
            ? `Data Facebook ditemukan, tetapi gagal disimpan ke cache database.`
            : scraped && profileCached
              ? `Data Facebook ditemukan dan disimpan ke memberProfiles/${uid}. Lengkapi kartu lalu tekan Simpan kartu.`
            : scraped && cacheSkipped
              ? `Data Facebook ditemukan untuk preview. Login dengan akun pemilik UID tersebut agar profil dapat disimpan ke database.`
              : `Data profil UID ${uid} dimuat dari database. Lengkapi detail kartu lalu simpan.`,
        kind: "ok",
      });
    } catch (err) {
      setActiveUid(null);
      setSavedSignature(null);
      setLookupStatus({ text: err instanceof Error ? err.message : "Pencarian gagal. Coba lagi.", kind: "err" });
    } finally {
      setLooking(false);
    }
  }

  const canSave = firebaseReady && activeUid !== null && activeUid === card.uid && ownsCard;
  const cardSaved = savedSignature !== null && savedSignature === cardSignature(card);
  const saveHint = !firebaseReady
    ? "Firebase belum dikonfigurasi. Isi NEXT_PUBLIC_FIREBASE_* untuk menyimpan kartu."
      : !authUser
        ? "Login dengan Facebook untuk menyimpan kartu."
      : !ownsCard
        ? "Login dengan akun Facebook yang UID-nya cocok dengan kartu ini."
      : !canSave
      ? "Cari data UID Facebook dulu sebelum menyimpan kartu."
      : "";

  async function onSave() {
    if (!ownsCard) { setSaveStatus({ text: "Verifikasi Facebook dengan UID yang sama sebelum menyimpan.", kind: "err" }); return; }
    const problem = validateForSave(card);
    if (problem) { setSaveStatus({ text: problem, kind: "err" }); return; }
    setSaving(true);
    setSaveStatus({ text: "Menyimpan...", kind: "busy" });
    const cardToSave = { ...card };
    try {
      await saveCard(cardToSave);
      setSavedSignature(cardSignature(cardToSave));
      setSaveStatus({ text: "Kartu tersimpan.", kind: "ok" });
    } catch (e) {
      setSaveStatus({ text: saveErrorMessage(e), kind: "err" });
    } finally {
      setSaving(false);
    }
  }

  async function onDownload(side: "front" | "back") {
    setExporting(side);
    try {
      await downloadCard(displayedCard, side);
    } catch {
      setLookupStatus({ text: "Gambar gagal dibuat. Coba lagi.", kind: "err" });
    } finally {
      setExporting(null);
    }
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(metadata);
      setCopyStatus({ text: "Metadata disalin.", kind: "ok" });
    } catch {
      setCopyStatus({ text: "Salin gagal. Pilih teks lalu tekan Ctrl+C.", kind: "" });
    }
  }

  return (
    <main className="wrap layout">
      <section className="panel p-lookup" aria-labelledby="h-lookup">
        <h2 id="h-lookup">Cari member</h2>
        <p className="hint">Ambil nama dan tanggal bergabung dari Facebook menggunakan UID.</p>
        <form onSubmit={onLookup} noValidate>
          <div className="row">
            <div className="field">
              <label htmlFor="uid">UID Facebook</label>
              <input
                id="uid" type="text" inputMode="numeric" autoComplete="off" spellCheck={false}
                placeholder="100079664152403" value={uidInput} onChange={(e) => setUidInput(e.target.value)}
              />
            </div>
            {facebookUid ? (
              <button className="btn btn-primary" type="submit" disabled={looking}>{looking ? "Mencari..." : "Cari data"}</button>
            ) : (
              <button className="btn btn-primary" type="button" onClick={onFacebookLogin} disabled={authBusy || !firebaseReady}>
                {authBusy ? "Membuka login..." : "Login Facebook"}
              </button>
            )}
          </div>
          <p className={"status " + lookupStatus.kind} role="status" aria-live="polite">{lookupStatus.text}</p>
        </form>
        {!firebaseReady ? (
          <p className="mode">Pencarian Facebook tetap tersedia. Isi <code>NEXT_PUBLIC_FIREBASE_*</code> untuk menyimpan pengaturan kartu.</p>
        ) : null}
        <div className="facebook-session">
          {authUser && facebookUid ? (
            <>
              <p className="deletion-identity">Login Facebook · UID: <strong>{facebookUid}</strong></p>
              <button className="text-button" type="button" onClick={onFacebookLogout}>Keluar</button>
            </>
          ) : null}
          {authStatus ? <p className="status err" role="status">{authStatus}</p> : null}
        </div>
      </section>

      <section className="stage" aria-label="Pratinjau kartu">
        <Card3D card={displayedCard} spinning={spinning} snap={snap} />
        <div className="tools">
          <button className="btn btn-ghost" type="button" onClick={() => setSpinning((v) => !v)} aria-pressed={spinning}>
            {spinning ? "Jeda putaran" : "Putar otomatis"}
          </button>
          <button className="btn btn-ghost" type="button" onClick={() => showFace("front")}>Lihat depan</button>
          <button className="btn btn-ghost" type="button" onClick={() => showFace("back")}>Lihat belakang</button>
        </div>
        <div className="tools tools-dl">
          <button className="btn btn-primary" type="button" onClick={() => onDownload("front")} disabled={exporting !== null}>Unduh depan (PNG)</button>
          <button className="btn btn-ghost" type="button" onClick={() => onDownload("back")} disabled={exporting !== null}>Unduh belakang (PNG)</button>
        </div>
        <p className="tip">Seret kartu untuk memutarnya. Lepaskan, dan kartu berputar lagi.</p>
      </section>

      <section className="panel p-edit" aria-labelledby="h-edit">
        <h2 id="h-edit">Ubah tampilan</h2>
        <p className="hint">Nama dan tanggal bergabung diambil dari UID. Ubah detail kartu di sini; tanggal hanya tampil di preview.</p>
        <div className="stack">
          <div className="grid-2">
            <div className="field">
              <label htmlFor="name">Nama</label>
              <input id="name" type="text" maxLength={40} autoComplete="off" value={card.name} onChange={(e) => patch({ name: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="username">Username</label>
              <input id="username" type="text" maxLength={24} autoComplete="off" spellCheck={false} value={card.username} onChange={(e) => patch({ username: cleanUser(e.target.value) })} />
            </div>
            <div className="field">
              <label htmlFor="joined">Tanggal bergabung</label>
              <input id="joined" type="date" value={card.joined} onChange={(e) => patch({ joined: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="city">Kota</label>
              <input id="city" type="text" maxLength={40} autoComplete="off" value={card.city} onChange={(e) => patch({ city: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="province">Provinsi</label>
              <input id="province" type="text" maxLength={40} autoComplete="off" list="zones" value={card.province} onChange={(e) => patch({ province: e.target.value })} />
              <datalist id="zones">{ZONES.map((z) => <option key={z} value={z} />)}</datalist>
            </div>
          </div>

          <fieldset>
            <span className="legend" id="lg-theme">Warna kartu</span>
            <div className="chips" role="radiogroup" aria-labelledby="lg-theme">
              {(Object.keys(THEMES) as ThemeId[]).map((id) => (
                <label className="chip" key={id}>
                  <input type="radio" name="theme" value={id} checked={card.theme === id} onChange={() => patch({ theme: id })} />
                  <span><i className="dot" style={{ background: THEMES[id].swatch }} />{THEMES[id].title}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <span className="legend" id="lg-accent">Warna aksen</span>
            <div className="chips" role="radiogroup" aria-labelledby="lg-accent">
              {ACCENTS.map((a) => (
                <label className="chip" key={a.id}>
                  <input type="radio" name="accent" value={a.id} checked={card.accent === a.color} onChange={() => patch({ accent: a.color })} />
                  <span><i className="dot" style={{ background: a.color }} />{a.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="check">
            <input type="checkbox" checked={card.showUid} onChange={(e) => patch({ showUid: e.target.checked })} />
            <span>Tampilkan UID di belakang kartu<small>Matikan jika kartu akan dibagikan ke publik.</small></span>
          </label>

          <div>
            <button className="btn btn-primary" type="button" onClick={onSave} disabled={!canSave || saving}>
              {saving ? "Menyimpan..." : "Simpan kartu"}
            </button>
            {saveHint ? <p className="hint hint-save">{saveHint}</p> : null}
            <p className={"status " + saveStatus.kind} role="status" aria-live="polite">{saveStatus.text}</p>
          </div>
        </div>
      </section>

      <NftMintPanel card={displayedCard} cardSaved={cardSaved} ownerVerified={ownsCard} metadata={metadata} onCopy={onCopy} copyStatus={copyStatus} />
    </main>
  );
}
