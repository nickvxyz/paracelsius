"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="relative z-20 flex items-center justify-between px-6 py-4 border-b border-white/5">
      <Link
        href="/"
        className="font-heading text-lg font-bold tracking-widest text-accent"
      >
        PARACELSIUS
      </Link>
      <div className="flex gap-6 font-body text-sm">
        <Link
          href="/"
          className={`transition-colors hover:text-accent ${
            pathname === "/" ? "text-accent" : "text-muted"
          }`}
        >
          Home
        </Link>
        <Link
          href="/about"
          className={`transition-colors hover:text-accent ${
            pathname === "/about" ? "text-accent" : "text-muted"
          }`}
        >
          About
        </Link>
      </div>
    </nav>
  );
}
