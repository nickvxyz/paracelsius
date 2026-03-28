"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface AuthOverlayProps {
  open: boolean;
  onClose: () => void;
}

export default function AuthOverlay({ open, onClose }: AuthOverlayProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, handleEscape]);

  async function handleGoogleSignIn() {
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center animate-fade-in"
      style={{ backgroundColor: "rgba(10,10,10,0.95)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-5 right-5 text-muted hover:text-foreground transition-colors text-2xl leading-none p-2"
        aria-label="Close"
      >
        &times;
      </button>

      {/* Content */}
      <div className="flex flex-col items-center gap-8 px-6 max-w-sm w-full">
        <h2 className="font-heading text-[15px] font-bold tracking-[1.5px] text-accent">
          PARACELSUS
        </h2>

        <div className="w-full space-y-4">
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 border border-white/10 bg-surface px-5 py-4 text-[15px] text-foreground transition-all hover:border-accent/30 disabled:opacity-40"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
                fill="#4285F4"
              />
              <path
                d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
                fill="#34A853"
              />
              <path
                d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
                fill="#FBBC05"
              />
              <path
                d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 2.58 9 3.58z"
                fill="#EA4335"
              />
            </svg>
            {loading ? "Summoning..." : "Enter with Google"}
          </button>
        </div>

        {error && (
          <p
            className="text-[13px] text-center leading-5"
            style={{
              color: "rgba(140,230,180,0.9)",
              textShadow: "0 0 8px rgba(140,230,180,0.3)",
            }}
          >
            The ritual has failed: {error}
          </p>
        )}

        <p className="text-muted text-[13px] text-center leading-4 max-w-[260px]">
          By entering, you acknowledge that Paracelsus is an educational
          experience, not medical advice.
        </p>
      </div>
    </div>
  );
}
