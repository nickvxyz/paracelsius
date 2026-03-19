"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AuthOverlay from "./AuthOverlay";

interface NavProps {
  user?: { email?: string } | null;
  onSignOut?: () => void;
}

export default function Nav({ user, onSignOut }: NavProps) {
  const pathname = usePathname();
  const [authOpen, setAuthOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const linkClass = (path: string) =>
    `uppercase tracking-[1px] text-xs transition-colors hover:text-accent ${
      pathname === path ? "text-accent" : "text-muted"
    }`;

  return (
    <>
      <nav className="relative z-20 flex items-center justify-between px-4 sm:px-6 py-4 max-w-full">
        <Link
          href="/"
          className="font-heading text-sm font-bold tracking-[1.2px] text-accent shrink-0"
        >
          PARACELSUS
        </Link>

        {/* Desktop nav */}
        <div className="hidden sm:flex items-center gap-5">
          <Link href="/" className={linkClass("/")}>
            Home
          </Link>
          <Link href="/about" className={linkClass("/about")}>
            About
          </Link>
          {user ? (
            <>
              <Link href="/profile" className={linkClass("/profile")}>
                Profile
              </Link>
              <button
                onClick={onSignOut}
                className="uppercase tracking-[1px] text-xs text-muted hover:text-accent transition-colors"
              >
                Sign Out
              </button>
            </>
          ) : (
            <button
              onClick={() => setAuthOpen(true)}
              className="font-heading text-[11px] font-bold uppercase tracking-[1.1px] bg-accent text-background px-[18px] py-2 hover:opacity-85 transition-opacity"
            >
              Sign In
            </button>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="sm:hidden flex flex-col gap-1.5 p-2"
          aria-label="Toggle menu"
        >
          <span className={`block w-5 h-[1.5px] bg-foreground transition-transform ${menuOpen ? "rotate-45 translate-y-[5px]" : ""}`} />
          <span className={`block w-5 h-[1.5px] bg-foreground transition-opacity ${menuOpen ? "opacity-0" : ""}`} />
          <span className={`block w-5 h-[1.5px] bg-foreground transition-transform ${menuOpen ? "-rotate-45 -translate-y-[5px]" : ""}`} />
        </button>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="sm:hidden relative z-20 border-t border-white/5 bg-background px-4 py-4 space-y-3">
          <Link
            href="/"
            className={`block py-2 ${linkClass("/")}`}
            onClick={() => setMenuOpen(false)}
          >
            Home
          </Link>
          <div className="border-t border-white/5" />
          <Link
            href="/about"
            className={`block py-2 ${linkClass("/about")}`}
            onClick={() => setMenuOpen(false)}
          >
            About
          </Link>
          {user ? (
            <>
              <div className="border-t border-white/5" />
              <Link
                href="/profile"
                className={`block py-2 ${linkClass("/profile")}`}
                onClick={() => setMenuOpen(false)}
              >
                Profile
              </Link>
              <div className="border-t border-white/5" />
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onSignOut?.();
                }}
                className="block py-2 uppercase tracking-[1px] text-xs text-muted hover:text-accent transition-colors"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <div className="border-t border-white/5" />
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setAuthOpen(true);
                }}
                className="block w-full py-3 bg-accent text-center text-xs font-heading font-bold uppercase tracking-wider text-background"
              >
                Sign In
              </button>
            </>
          )}
        </div>
      )}

      {/* Auth overlay */}
      <AuthOverlay open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}
