"use client";

import { useRef } from "react";
import { useAuth } from "@/lib/hooks";
import { PortraitProvider } from "@/lib/portrait-context";
import Nav from "./Nav";
import EmberParticles from "./EmberParticles";
import CRTPortrait, { type CRTPortraitHandle } from "./CRTPortrait";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const portraitRef = useRef<CRTPortraitHandle>(null);

  return (
    <PortraitProvider value={portraitRef}>
      <EmberParticles />
      <Nav user={user} onSignOut={signOut} />
      <main className="relative z-10 flex flex-col items-center">
        {/* CRT Portrait — brand anchor, visible on ALL pages */}
        <div className="pt-2 portrait-container">
          <CRTPortrait ref={portraitRef} />
        </div>
        {children}
      </main>

      <footer className="relative z-10 border-t border-white/5 mt-16 py-6 px-6">
        <div className="max-w-2xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted">
          <span>&copy; {new Date().getFullYear()} Paracelsus</span>
          <div className="flex gap-4">
            <a href="/about" className="hover:text-accent transition-colors">About</a>
            <span className="opacity-30">|</span>
            <a href="/disclaimer" className="hover:text-accent transition-colors">Not medical advice</a>
          </div>
        </div>
      </footer>

      <style jsx>{`
        .portrait-container {
          transform: scale(0.55);
          transform-origin: top center;
          margin-bottom: -220px;
        }
        @media (min-width: 431px) and (max-width: 768px) {
          .portrait-container {
            transform: scale(0.7);
            margin-bottom: -150px;
          }
        }
        @media (min-width: 769px) {
          .portrait-container {
            transform: scale(1);
            margin-bottom: -40px;
          }
        }
      `}</style>
    </PortraitProvider>
  );
}
