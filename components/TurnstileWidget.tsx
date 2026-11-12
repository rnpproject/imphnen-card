"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (container: HTMLElement, options: {
    sitekey: string;
    action: string;
    callback: (token: string) => void;
    "expired-callback": () => void;
    "error-callback": () => void;
  }) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window { turnstile?: TurnstileApi }
}

interface Props {
  onToken: (token: string) => void;
  resetSignal: number;
}

export default function TurnstileWidget({ onToken, resetSignal }: Props) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const [scriptReady, setScriptReady] = useState(false);
  const [scriptError, setScriptError] = useState(false);

  useEffect(() => { onTokenRef.current = onToken; }, [onToken]);

  const renderWidget = useCallback(() => {
    if (!siteKey || !containerRef.current || !window.turnstile || widgetIdRef.current) return;
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action: "member_search",
      callback: (token) => onTokenRef.current(token),
      "expired-callback": () => onTokenRef.current(""),
      "error-callback": () => onTokenRef.current(""),
    });
  }, [siteKey]);

  useEffect(() => {
    if (scriptReady) renderWidget();
  }, [scriptReady, renderWidget]);

  useEffect(() => {
    if (resetSignal > 0 && widgetIdRef.current) window.turnstile?.reset(widgetIdRef.current);
  }, [resetSignal]);

  useEffect(() => () => {
    if (widgetIdRef.current) window.turnstile?.remove(widgetIdRef.current);
  }, []);

  if (!siteKey) return <p className="status err">Turnstile belum dikonfigurasi. Isi NEXT_PUBLIC_TURNSTILE_SITE_KEY.</p>;

  return (
    <div className="turnstile-wrap">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
        onError={() => { setScriptError(true); onTokenRef.current(""); }}
      />
      <div ref={containerRef} aria-label="Verifikasi Cloudflare Turnstile" />
      {scriptError ? <p className="status err">Verifikasi Cloudflare gagal dimuat. Muat ulang halaman.</p> : null}
    </div>
  );
}
