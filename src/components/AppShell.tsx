"use client";

import { useRef } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/hooks";
import { PortraitProvider } from "@/lib/portrait-context";
import Nav from "./Nav";
import EmberParticles from "./EmberParticles";
import CRTPortrait, { type CRTPortraitHandle } from "./CRTPortrait";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const portraitRef = useRef<CRTPortraitHandle>(null);
  const pathname = usePathname();

  const isProfile = pathname === "/profile";

  return (
    <PortraitProvider value={portraitRef}>
      <EmberParticles />
      <div className="flex flex-col h-[100dvh] overflow-hidden">
        {/* Nav */}
        <Nav user={user} onSignOut={signOut} />

        {/* Main */}
        <main className="relative z-10 flex flex-col items-center flex-1 min-h-0">
          {/* CRT Portrait — hidden on mobile profile, shown elsewhere */}
          <div className={`shrink-0 portrait-container ${isProfile ? "hidden sm:block" : ""}`}>
            <CRTPortrait ref={portraitRef} />
          </div>
          {/* Page content */}
          <div className="flex-1 min-h-0 w-full flex flex-col items-center overflow-hidden">
            {children}
          </div>
        </main>

        {/* Footer — hidden on mobile profile */}
        <footer className={`relative z-10 shrink-0 border-t border-white/5 py-2 px-4 ${isProfile ? "hidden" : ""}`}>
          <div className="max-w-2xl mx-auto flex items-center justify-between text-[10px] text-muted">
            <span>&copy; {new Date().getFullYear()} Paracelsus</span>
            <div className="flex items-center gap-3">
              <a href="https://x.com/paracelsus_live" target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors" aria-label="X (Twitter)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
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
