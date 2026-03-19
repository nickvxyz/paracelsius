"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/hooks";
import EtherText from "@/components/EtherText";
import AuthDropdown from "@/components/AuthDropdown";

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

  const authError = searchParams.get("error");

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => setPatientCount(d.count))
      .catch(() => {});
  }, []);

  // Redirect authenticated users to profile
  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/profile");
    }
  }, [authLoading, user, router]);

  // Loading
  if (authLoading) {
    return (
      <div className="flex min-h-[calc(100vh-200px)] items-center justify-center">
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

  // Authenticated — redirect in progress
  if (user) return null;

  // Landing page
  return (
    <div className="flex flex-col items-center gap-4 px-4 pb-12">
      {authError && (
        <p
          className="text-sm text-center leading-6 mb-2"
          style={{
            color: "rgba(140,230,180,0.9)",
            textShadow: "0 0 8px rgba(140,230,180,0.3)",
          }}
        >
          The ritual has failed: {decodeURIComponent(authError)}
        </p>
      )}

      <EtherText
        lines={INTRO_LINES}
        charSpeed={20}
        lineDelay={2500}
        scramblePasses={2}
        onLineStart={() => {}}
      />

      <h2 className="font-heading text-lg sm:text-xl font-bold tracking-wider text-accent text-center mt-4">
        READY TO EXAMINE YOUR LIFESPAN?
      </h2>

      {patientCount !== null && patientCount > 0 && (
        <p className="text-muted text-xs">
          {patientCount.toLocaleString()} patients examined
        </p>
      )}

      <AuthDropdown
        trigger={
          <button className="mt-2 bg-accent px-8 py-3 text-xs font-heading font-bold uppercase tracking-wider text-background transition-opacity hover:opacity-90">
            Sign In
          </button>
        }
      />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-200px)] items-center justify-center">
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
