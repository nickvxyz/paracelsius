"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AuthDropdown from "./AuthDropdown";

interface NavProps {
  user?: { email?: string } | null;
  onSignOut?: () => void;
}

export default function Nav({ user, onSignOut }: NavProps) {
  const pathname = usePathname();

  const linkClass = (path: string) =>
    `uppercase tracking-[1px] text-xs transition-colors hover:text-accent ${
      pathname === path ? "text-accent" : "text-muted"
    }`;

  return (
    <nav className="relative z-20 flex items-center justify-between px-6 py-4">
      <Link
        href="/"
        className="font-heading text-sm font-bold tracking-[1.2px] text-accent"
      >
        PARACELSUS
      </Link>
      <div className="flex items-center gap-5">
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
          <AuthDropdown
            trigger={
              <button className="font-heading text-[11px] font-bold uppercase tracking-[1.1px] bg-accent text-background px-[18px] py-2 hover:opacity-85 transition-opacity">
                Sign In
              </button>
            }
          />
        )}
      </div>
    </nav>
  );
}
