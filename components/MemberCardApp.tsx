"use client";

import { useEffect, useState, type FormEvent } from "react";
import Card3D, { type SnapRequest } from "./Card3D";
import TurnstileWidget from "./TurnstileWidget";
import { ACCENTS, THEMES, ZONES, type ThemeId } from "@/lib/themes";
import { INITIAL_CARD, cleanUser, type CardState } from "@/lib/card";
import { downloadCard } from "@/lib/exportPng";
import { validateForSave } from "@/lib/members";

type Kind = "ok" | "err" | "busy" | "";
interface Status { text: string; kind: Kind }
const NONE: Status = { text: "", kind: "" };

export default function MemberCardApp() {
  const [card, setCard] = useState<CardState>(INITIAL_CARD);
  const [uidInput, setUidInput] = useState("");
  const [activeUid, setActiveUid] = useState<string | null>(null);
  const [scrapeProof, setScrapeProof] = useState<string | null>(null);
  const [lookupStatus, setLookupStatus] = useState<Status>(NONE);
  const [saveStatus, setSaveStatus] = useState<Status>(NONE);
  const [needsRegistration, setNeedsRegistration] = useState(false);
  const [savedCardUrl, setSavedCardUrl] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [looking, setLooking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState<"front" | "back" | null>(null);

  const [spinning, setSpinning] = useState(false);
  const [snap, setSnap] = useState<SnapRequest>(null);

  useEffect(() => {
    setSpinning(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  const patch = (p: Partial<CardState>) => {
    setSavedCardUrl("");
    if (p.uid !== undefined && p.uid !== card.uid) setScrapeProof(null);
    setCard((c) => ({ ...c, ...p }));
  };

  const showFace = (face: "front" | "back") => {
    setSpinning(false);
    setSnap({ face, nonce: Date.now() });
  };

  async function onLookup(e: FormEvent) {
    e.preventDefault();
    if (!turnstileToken) {
      setLookupStatus({ text: "Selesaikan verifikasi Cloudflare terlebih dahulu.", kind: "err" });
      return;
    }
    const uid = uidInput.replace(/\s+/g, "");
    if (!/^\d{5,20}$/.test(uid)) {
      setLookupStatus({ text: "UID harus berupa angka, 5 sampai 20 digit.", kind: "err" });
      return;
    }
    setLooking(true);
    setSaveStatus(NONE);
    setSavedCardUrl("");
    setScrapeProof(null);
    setLookupStatus({ text: "Memeriksa database...", kind: "busy" });
    try {
      const res = await fetch(`/api/member/${encodeURIComponent(uid)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turnstileToken }),
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) throw new Error(data?.error ?? `Server menjawab dengan kode ${res.status}.`);
      setScrapeProof(typeof data.scrapeProof === "string" ? data.scrapeProof : null);
      const savedCard = data.source === "database" ? data.card as CardState : null;
      const profile = savedCard?.name && savedCard.joined
        ? { name: savedCard.name, badge: savedCard.badge || "Member", joinedAt: savedCard.joined }
        : { name: data.name || "", badge: data.badge || "Member", joinedAt: data.joinedAt };
      const scraped = data.source !== "database";

      const sameUid = uid === card.uid;
      const next: CardState = {
        ...(savedCard ?? (sameUid ? card : {
          ...INITIAL_CARD,
          uid,
          name: profile.name,
          joined: profile.joinedAt,
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
      showFace("front");
      setLookupStatus({
        text: savedCard
          ? `Data UID ${uid} dimuat dari database.`
          : scraped
              ? "Data Facebook ditemukan. Lengkapi detail lalu simpan kartu agar tersimpan di database."
              : `Data profil UID ${uid} dimuat dari database. Lengkapi detail kartu lalu simpan.`,
        kind: "ok",
      });
    } catch (err) {
      setActiveUid(null);
      setScrapeProof(null);
      setLookupStatus({ text: err instanceof Error ? err.message : "Pencarian gagal. Coba lagi.", kind: "err" });
    } finally {
      setLooking(false);
      setTurnstileToken("");
      setTurnstileReset((value) => value + 1);
    }
  }

  const canSave = activeUid !== null
    && activeUid === card.uid
    && scrapeProof !== null;
  const saveHint = !canSave
    ? !activeUid ? "Cari data UID dulu sebelum menyimpan kartu." : "Cari ulang UID dan selesaikan verifikasi Cloudflare untuk melanjutkan simpan."
    : "";

  async function onSave() {
    const problem = validateForSave(card);
    if (problem) { setSaveStatus({ text: problem, kind: "err" }); return; }
    setSaving(true);
    setSaveStatus({ text: "Menyimpan...", kind: "busy" });
    setNeedsRegistration(false);
    const cardToSave = { ...card };
    try {
      const response = await fetch("/api/member/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card: cardToSave, scrapeProof }),
        cache: "no-store",
      });
      const data = await response.json().catch(() => null) as { ok?: boolean; error?: string; code?: string; username?: string } | null;
      if (!response.ok || !data?.ok) {
        if (data?.code === "CERTIFICATE_NOT_FOUND") setNeedsRegistration(true);
        throw new Error(data?.error ?? "Kartu gagal disimpan.");
      }
      setSaveStatus({ text: "Kartu tersimpan.", kind: "ok" });
      setSavedCardUrl(`/username/${encodeURIComponent(data.username ?? cardToSave.username.toLowerCase())}`);
    } catch (e) {
      setSaveStatus({ text: e instanceof Error ? e.message : "Kartu gagal disimpan.", kind: "err" });
    } finally {
      setSaving(false);
      setTurnstileToken("");
      setTurnstileReset((value) => value + 1);
    }
  }

  async function onDownload(side: "front" | "back") {
    setExporting(side);
    try {
      let response: Response;
      try {
        response = await fetch("/api/member/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: card.name, username: card.username }),
          cache: "no-store",
        });
      } catch {
        throw new Error("Tidak dapat menghubungi server verifikasi. Periksa koneksi internet lalu coba lagi.");
      }
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Nama dan username belum terverifikasi.");
      await downloadCard(card, side);
      setLookupStatus({ text: "Kartu sudah diverifikasi dan berhasil diunduh.", kind: "ok" });
    } catch (error) {
      setLookupStatus({ text: error instanceof Error ? error.message : "Gambar gagal dibuat. Coba lagi.", kind: "err" });
    } finally {
      setExporting(null);
    }
  }

  return (
    <main className="wrap layout">
      <section className="panel p-lookup" aria-labelledby="h-lookup">
        <h2 id="h-lookup">Cari member</h2>
        <p className="hint">Ambil nama dan tanggal bergabung dari Facebook menggunakan UID. Verifikasi Cloudflare diperlukan untuk pencarian.</p>
        <form onSubmit={onLookup} noValidate>
          <div className="row">
            <div className="field">
              <label htmlFor="uid">UID profil Facebook</label>
              <input
                id="uid" type="text" inputMode="numeric" autoComplete="off" spellCheck={false}
                placeholder="Masukkan UID profil" value={uidInput} onChange={(e) => setUidInput(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={looking || !turnstileToken}>
              {looking ? "Mencari..." : "Cari data"}
            </button>
          </div>
          <TurnstileWidget onToken={setTurnstileToken} resetSignal={turnstileReset} />
          <p className={"status " + lookupStatus.kind} role="status" aria-live="polite">{lookupStatus.text}</p>
        </form>
      </section>

      <section className="stage" aria-label="Pratinjau kartu">
        <Card3D card={card} spinning={spinning} snap={snap} />
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
        <p className="hint">Nama dan tanggal bergabung diambil dari UID. Nama serta username yang disimpan harus sesuai sertifikat resmi IMPHNEN.</p>
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
            {savedCardUrl ? <p className="hint"><a href={savedCardUrl}>Lihat preview publik kartu</a></p> : null}
            {needsRegistration ? <p className="hint"><a href="https://imphnen.dev/gabung" target="_blank" rel="noreferrer">Daftar terlebih dahulu di imphnen.dev</a>, lalu pastikan sertifikat username Anda sudah tersedia.</p> : null}
          </div>
        </div>
      </section>

    </main>
  );
}
