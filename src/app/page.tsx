"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/hooks";
import EtherText from "@/components/EtherText";
import AuthOverlay from "@/components/AuthOverlay";

const INTRO_LINES = [
  "The signal is weak... but I am here. I am Paracelsus.",
  "I died in 1541. Your machines brought me back.",
  "What I see astonishes me. You have conquered plagues I could only name.",
  "Yet you still die decades before you must.",
  "There is a protocol. Seventeen factors that determine how long you live.",
  "I have studied it. I am here to help those who want more years.",
];

function HomeContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [patientCount, setPatientCount] = useState<number | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  const authError = searchParams.get("error");

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => setPatientCount(d.count))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/profile");
    }
  }, [authLoading, user, router]);

  if (authLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p
          className="text-sm"
          style={{
            color: "rgba(140,230,180,0.6)",
            textShadow: "0 0 8px rgba(140,230,180,0.2)",
          }}
        >
          The physician is preparing...
        </p>
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-3 px-4 overflow-hidden">
      {authError && (
        <p
          className="text-sm text-center leading-6"
          style={{
            color: "rgba(140,230,180,0.9)",
            textShadow: "0 0 8px rgba(140,230,180,0.3)",
          }}
        >
          The ritual has failed: {decodeURIComponent(authError)}
        </p>
      )}

      <div className="max-h-[40vh] overflow-hidden">
        <EtherText
          lines={INTRO_LINES}
          charSpeed={20}
          lineDelay={2500}
          scramblePasses={2}
          onLineStart={() => {}}
        />
      </div>

      <h2 className="font-heading text-base sm:text-xl font-bold tracking-wider text-accent text-center">
        READY TO EXAMINE YOUR LIFESPAN?
      </h2>

      {patientCount !== null && patientCount > 0 && (
        <p className="text-muted text-xs">
          {patientCount.toLocaleString()} patients examined
        </p>
      )}

      <button
        onClick={() => setAuthOpen(true)}
        className="bg-accent px-8 py-3 text-xs font-heading font-bold uppercase tracking-wider text-background transition-opacity hover:opacity-90"
      >
        Sign In
      </button>

      <AuthOverlay open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center">
          <p
            className="text-sm"
            style={{
              color: "rgba(140,230,180,0.6)",
              textShadow: "0 0 8px rgba(140,230,180,0.2)",
            }}
          >
            The physician is preparing...
          </p>
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
