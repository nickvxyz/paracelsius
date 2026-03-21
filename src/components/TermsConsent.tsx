"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

interface TermsConsentProps {
  userId: string;
  accessToken: string;
  onAccepted: () => void;
  onDeclined: () => void;
}

export default function TermsConsent({ accessToken, onAccepted, onDeclined }: TermsConsentProps) {
  const [tosChecked, setTosChecked] = useState(false);
  const [emailChecked, setEmailChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  async function handleAgree() {
    if (!tosChecked) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/accept-terms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ email_subscribed: emailChecked }),
      });

      if (!res.ok) {
        const err = await res.json();
        console.error("ToS accept failed:", err);
      }
    } catch (e) {
      console.error("ToS accept error:", e);
    }

    setSubmitting(false);
    onAccepted();
  }

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 px-4">
      <div className="w-full max-w-md bg-surface border border-white/10 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold tracking-wider text-accent">
            Before you continue
          </h2>
          <button
            onClick={onDeclined}
            className="text-muted hover:text-foreground text-xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <p className="text-sm text-foreground/80 leading-relaxed">
          Before we go any further, we need to make sure you&apos;ve seen the legal stuff.
        </p>

        <p className="text-sm text-foreground/80 leading-relaxed">
          By clicking &ldquo;I agree&rdquo;, you&apos;re saying you&apos;ve read and
          understood our Terms of Service.
        </p>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={tosChecked}
            onChange={(e) => setTosChecked(e.target.checked)}
            className="mt-1 w-4 h-4 shrink-0 accent-accent"
          />
          <span className="text-sm text-foreground/80 leading-relaxed">
            I&apos;ve read and agree to the{" "}
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:opacity-80 underline"
            >
              Terms of Service &#x2197;
            </a>
          </span>
        </label>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={emailChecked}
            onChange={(e) => setEmailChecked(e.target.checked)}
            className="mt-1 w-4 h-4 shrink-0 accent-accent"
          />
          <span className="text-sm text-muted leading-relaxed">
            I&apos;d like to receive news and updates from Paracelsus
          </span>
        </label>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onDeclined}
            className="flex-1 py-3 text-xs font-heading font-bold uppercase tracking-wider text-muted border border-white/10 hover:text-foreground transition-colors"
          >
            No thanks
          </button>
          <button
            onClick={handleAgree}
            disabled={!tosChecked || submitting}
            className="flex-1 py-3 text-xs font-heading font-bold uppercase tracking-wider bg-accent text-background hover:opacity-90 transition-opacity disabled:opacity-30"
          >
            {submitting ? "..." : "I agree"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
