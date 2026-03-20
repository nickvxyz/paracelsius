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
      <div className="flex flex-col h-[100dvh] overflow-x-hidden overflow-y-auto">
        {/* Nav — fixed height */}
        <Nav user={user} onSignOut={signOut} />

        {/* Main — fills remaining space */}
        <main className="relative z-10 flex flex-col items-center flex-1 min-h-0">
          {/* CRT Portrait — compact */}
          <div className="shrink-0 portrait-container">
            <CRTPortrait ref={portraitRef} />
          </div>
          {/* Page content — fills remaining space */}
          <div className="flex-1 min-h-0 w-full flex flex-col items-center">
            {children}
          </div>
        </main>

        {/* Footer — compact, always at bottom */}
        <footer className="relative z-10 shrink-0 border-t border-white/5 py-2 px-4">
          <div className="max-w-2xl mx-auto flex items-center justify-between text-[10px] text-muted">
            <span>&copy; {new Date().getFullYear()} Paracelsus</span>
            <div className="flex gap-3">
              <a href="/about" className="hover:text-accent transition-colors">About</a>
              <span className="opacity-30">|</span>
              <a href="/disclaimer" className="hover:text-accent transition-colors">Disclaimer</a>
            </div>
          </div>
        </footer>
      </div>

      <style jsx>{`
        .portrait-container {
          transform: scale(0.4);
          transform-origin: top center;
          margin-bottom: -280px;
        }
        @media (min-width: 431px) and (max-width: 768px) {
          .portrait-container {
            transform: scale(0.55);
            margin-bottom: -230px;
          }
        }
        @media (min-width: 769px) {
          .portrait-container {
            transform: scale(0.75);
            margin-bottom: -140px;
          }
        }
        @media (min-height: 900px) and (min-width: 769px) {
          .portrait-container {
            transform: scale(1);
            margin-bottom: -40px;
          }
        }
      `}</style>
    </PortraitProvider>
  );
}
