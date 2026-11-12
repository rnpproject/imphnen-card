"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { GROUP_URL, THEMES } from "@/lib/themes";
import { fmtDate } from "@/lib/date";
import { identiconCells } from "@/lib/identicon";
import { locationText, nameClass, verifiedBadge, type CardState } from "@/lib/card";

export type SnapRequest = { face: "front" | "back"; nonce: number } | null;

interface Props {
  card: CardState;
  spinning: boolean;
  snap: SnapRequest;
}

const AUTO_SPEED = 26; // derajat per detik, satu putaran penuh sekitar 14 detik
const SLICES = 12;
const SLICE_Z = Array.from({ length: SLICES }, (_, i) => (-0.8 + (1.6 * i) / (SLICES - 1)).toFixed(3));

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

interface Live {
  spinning: boolean;
  dragging: boolean;
  snapFace: "front" | "back" | null;
  snapTarget: number | null;
}

const DECO = (
  <svg className="deco" viewBox="0 0 100 63.05" preserveAspectRatio="none" aria-hidden="true">
    <path d="M31 33 L15 49 L31 65" />
    <path d="M57 28 L45 68" />
    <path d="M72 33 L88 49 L72 65" />
  </svg>
);

export default function Card3D({ card, spinning, snap }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const floorRef = useRef<HTMLDivElement>(null);
  const live = useRef<Live>({ spinning, dragging: false, snapFace: null, snapTarget: null });

  useEffect(() => { live.current.spinning = spinning; }, [spinning]);
  useEffect(() => {
    if (!snap) return;
    live.current.snapFace = snap.face;
    live.current.snapTarget = null;
  }, [snap]);

  useEffect(() => {
    const stage = stageRef.current, el = cardRef.current, floor = floorRef.current;
    if (!stage || !el || !floor) return;
    const s = live.current;

    let angle = 0, vel = s.spinning ? AUTO_SPEED : 0;
    let rx = 0, dragRx = 0, swayT = 0;
    let last = performance.now(), raf = 0;
    let lastX = 0, lastY = 0, lastT = 0;

    const apply = () => {
      const rad = (angle * Math.PI) / 180;
      const sn = Math.sin(rad);
      el.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${angle.toFixed(2)}deg)`;
      el.style.setProperty("--shine-f", `${(50 + 75 * sn).toFixed(1)}%`);
      el.style.setProperty("--shine-b", `${(50 - 75 * sn).toFixed(1)}%`);
      floor.style.transform = `scaleX(${(0.3 + 0.7 * Math.abs(Math.cos(rad))).toFixed(3)})`;
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (s.snapFace) {
        if (s.snapTarget === null) {
          const base = s.snapFace === "front" ? 0 : 180;
          s.snapTarget = base + 360 * Math.round((angle - base) / 360);
        }
        const diff = s.snapTarget - angle;
        angle += diff * (1 - Math.exp(-dt * 7));
        vel = 0;
        if (Math.abs(diff) < 0.15) {
          angle = s.snapTarget;
          s.snapFace = null;
          s.snapTarget = null;
        }
      } else if (!s.dragging) {
        const target = s.spinning ? AUTO_SPEED : 0;
        vel += (target - vel) * (1 - Math.exp(-dt * 2.4));
        angle += vel * dt;
        if (Math.abs(angle) > 360) angle %= 360;
      }

      const swaying = s.spinning && !s.dragging && !s.snapFace;
      if (swaying) swayT += dt;
      const rxTarget = s.dragging ? dragRx : swaying ? 5 * Math.sin(swayT * 0.9) : 0;
      rx += (rxTarget - rx) * (1 - Math.exp(-dt * 6));

      apply();
      raf = requestAnimationFrame(frame);
    };

    const down = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      s.dragging = true;
      s.snapFace = null;
      s.snapTarget = null;
      lastX = e.clientX; lastY = e.clientY; lastT = e.timeStamp;
      stage.setPointerCapture(e.pointerId);
      stage.dataset.dragging = "true";
    };
    const move = (e: PointerEvent) => {
      if (!s.dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      const dt = Math.max(1, e.timeStamp - lastT) / 1000;
      angle += dx * 0.45;
      vel = clamp(vel * 0.5 + ((dx * 0.45) / dt) * 0.5, -500, 500);
      if (e.pointerType === "mouse") dragRx = clamp(dragRx - dy * 0.2, -22, 22);
      lastX = e.clientX; lastY = e.clientY; lastT = e.timeStamp;
    };
    const up = () => {
      s.dragging = false;
      dragRx = 0;
      delete stage.dataset.dragging;
    };

    stage.addEventListener("pointerdown", down);
    stage.addEventListener("pointermove", move);
    stage.addEventListener("pointerup", up);
    stage.addEventListener("pointercancel", up);
    apply();
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      stage.removeEventListener("pointerdown", down);
      stage.removeEventListener("pointermove", move);
      stage.removeEventListener("pointerup", up);
      stage.removeEventListener("pointercancel", up);
    };
  }, []);

  const T = THEMES[card.theme];
  const userColor = T.userAccent ? card.accent : T.text;
  const name = card.name.trim() || "Nama member";
  const vars = {
    "--c-bg1": T.bg1, "--c-bg2": T.bg2, "--c-edge": T.edge, "--c-text": T.text, "--c-sub": T.sub,
    "--c-label": T.label, "--c-deco": T.deco, "--c-stripe": T.stripe, "--c-tile": T.tile, "--c-user": userColor,
  } as CSSProperties;

  const cells = identiconCells(card.uid || card.username);
  const label = `Kartu member ${name}, ${locationText(card)}, @${card.username || "username"}`;

  return (
    <div className="cardbox" style={vars}>
      <div className="persp" ref={stageRef} role="img" aria-label={label}>
        <div className="card" ref={cardRef}>
          {SLICE_Z.map((z) => (
            <i key={z} className="slice" style={{ transform: `translateZ(${z}cqw)` }} />
          ))}

          <div className="face front" aria-hidden="true">
            {DECO}
            <img className="abs f-logo" src="/logo.png" alt="" />
            <p className="abs f-badge">{verifiedBadge(card.badge)}</p>
            <p className={"abs f-name " + nameClass(name)}>{name}</p>
            <p className="abs f-zone">{locationText(card)}</p>
            <p className="abs lbl f-ulbl">Username</p>
            <p className="abs f-user">@{card.username || "username"}</p>
            <p className="abs lbl f-slbl">Sejak</p>
            <p className="abs f-since">{fmtDate(card.joined, false)}</p>
          </div>

          <div className="face back" aria-hidden="true">
            {DECO}
            <div className="abs b-stripe" />
            <p className="abs b-tag">Ingin Menjadi Programmer Handal<br />Namun Enggan Ngoding</p>
            <div className="abs b-ident">
              <svg viewBox="0 0 20 20" aria-hidden="true">
                {cells.map((row, r) =>
                  row.map((on, c) =>
                    on ? <rect key={`${r}-${c}`} x={2 + c * 3.2} y={2 + r * 3.2} width="2.6" height="2.6" rx=".7" fill={userColor} /> : null,
                  ),
                )}
              </svg>
            </div>
            <p className="abs lbl b-l1">Terdaftar sejak</p>
            <p className="abs b-v1">{fmtDate(card.joined, true)}</p>
            {card.showUid && card.uid ? (
              <>
                <p className="abs lbl b-l2">UID Facebook</p>
                <p className="abs b-v2">{card.uid}</p>
              </>
            ) : null}
            <p className="abs b-link">{GROUP_URL}</p>
          </div>
        </div>
      </div>
      <div className="floor" ref={floorRef} aria-hidden="true" />
    </div>
  );
}
