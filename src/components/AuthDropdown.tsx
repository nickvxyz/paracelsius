"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface AuthDropdownProps {
  trigger: React.ReactNode;
}

export default function AuthDropdown({ trigger }: AuthDropdownProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setError("");
  }, []);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        close();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, close]);

  async function handleGoogleSignIn() {
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <div onClick={() => setOpen(!open)}>{trigger}</div>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-[280px] border border-accent/20 bg-surface p-4 space-y-3 z-50"
          style={{ opacity: 1, transition: "opacity 100ms ease" }}
          role="menu"
          aria-expanded={open}
        >
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 border border-white/10 bg-surface-light px-4 py-3 text-sm text-foreground transition-all hover:border-accent/30 disabled:opacity-40"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 2.58 9 3.58z" fill="#EA4335"/>
            </svg>
            {loading ? "Summoning..." : "Enter with Google"}
          </button>

          {error && (
            <p
              className="text-xs text-center leading-5"
              style={{
                color: "rgba(140,230,180,0.9)",
                textShadow: "0 0 8px rgba(140,230,180,0.3)",
              }}
            >
              The ritual has failed: {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
