"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, usePatientProfile, useSubscription } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import { ZOLMAN_CATEGORIES } from "@/lib/zolman-categories";
import LifespanBar from "@/components/LifespanBar";
import SpiritChat, { type ChatMessage } from "@/components/SpiritChat";
import TermsConsent from "@/components/TermsConsent";

type Tab = "terminal" | "examination";

export default function ProfilePage() {
  const { user, session, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, refresh: refreshProfile } = usePatientProfile(user?.id);
  const { sub, loading: subLoading, refresh: refreshSub } = useSubscription(user?.id);
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>("terminal");
  const [lifespanYears, setLifespanYears] = useState<number | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [nameSaved, setNameSaved] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [tosConfirmed, setTosConfirmed] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  // ── Handle payment redirect (?exam_purchased=true) ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("exam_purchased") === "true") {
      window.history.replaceState({}, "", window.location.pathname);
      setPaymentProcessing(true);
      // Poll for webhook to process (up to 10 seconds)
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        await refreshProfile();
        await refreshSub();
        const { data } = await supabase
          .from("patient_profiles")
          .select("exam_purchased")
          .eq("user_id", user?.id ?? "")
          .single();
        if (data?.exam_purchased || attempts >= 10) {
          clearInterval(poll);
          setPaymentProcessing(false);
          if (data?.exam_purchased) {
            setActiveTab("terminal");
          }
        }
      }, 1000);
      return () => clearInterval(poll);
    }
  }, [user?.id, refreshProfile, refreshSub]);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (profile?.display_name) setDisplayName(profile.display_name as string);
  }, [profile?.display_name]);

  const handleLifespanUpdate = useCallback((years: number) => {
    setLifespanYears(years);
    refreshProfile();
  }, [refreshProfile]);

  const handleAssessmentComplete = useCallback(() => {
    refreshProfile();
  }, [refreshProfile]);

  const handleNameSave = async () => {
    const trimmed = displayName.trim().slice(0, 50);
    if (!trimmed || !user) return;
    setEditingName(false);
    setDisplayName(trimmed);
    await supabase.from("patient_profiles").update({ display_name: trimmed }).eq("user_id", user.id);
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 1500);
  };

  if (authLoading || profileLoading || subLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm" style={{ color: "rgba(140,230,180,0.6)", textShadow: "0 0 8px rgba(140,230,180,0.2)" }}>
          Paracelsus is preparing...
        </p>
      </div>
    );
  }

  if (!user || !session) return null;

  // ToS check
  const tosAccepted = tosConfirmed || !!(profile?.tos_accepted_at);

  if (profile && !tosAccepted) {
    return (
      <TermsConsent
        userId={user.id}
        accessToken={session.access_token}
        onAccepted={() => { setTosConfirmed(true); refreshProfile(); }}
        onDeclined={async () => {
          const { supabase: sb } = await import("@/lib/supabase");
          await sb.auth.signOut();
          window.location.href = "/";
        }}
      />
    );
  }

  // Payment processing overlay
  if (paymentProcessing) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-accent text-2xl animate-pulse">&#x2234;</div>
          <p className="text-sm" style={{ color: "rgba(140,230,180,0.8)", textShadow: "0 0 8px rgba(140,230,180,0.3)" }}>
            Payment processing...
          </p>
          <p className="text-xs text-muted">This will take a moment.</p>
        </div>
      </div>
    );
  }

  const rawLifespan = lifespanYears ?? (profile?.lifespan_years as number) ?? 94;
  const currentLifespan = isNaN(rawLifespan) ? 94 : rawLifespan;
  const baselineYears = (profile?.baseline_years as number) ?? null;
  const assessmentCompleted = (profile?.assessment_completed as boolean) ?? false;
  const examPurchased = (profile?.exam_purchased as boolean) ?? false;
  const penaltyAdvice = (profile?.penalty_advice as Record<string, string>) ?? {};
  const convState = (profile?.conversation_state as { committed_factors?: string[] }) ?? {};
  const committedFactors = convState.committed_factors || [];

  // Normalize penalties
  const rawPenalties = profile?.penalties;
  let penaltiesNormalized: Record<string, number> = {};
  if (Array.isArray(rawPenalties)) {
    for (const p of rawPenalties as Array<{ factor?: string; name?: string; years_lost?: number; penalty?: number }>) {
      const key = (p.factor || p.name || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "_");
      penaltiesNormalized[key] = p.years_lost ?? p.penalty ?? 0;
    }
  } else if (rawPenalties && typeof rawPenalties === "object") {
    penaltiesNormalized = rawPenalties as Record<string, number>;
  }
  const penaltyEntries = Object.entries(penaltiesNormalized)
    .filter(([, v]) => typeof v === "number" && v > 0)
    .sort(([, a], [, b]) => b - a);
  const nameToShow = displayName || (user.email?.split("@")[0] ?? "Individual");

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full">
      {/* ── Compact user header ── */}
      <div className="shrink-0 px-4 py-2">
        <div className="flex items-center gap-2 min-w-0">
          {editingName ? (
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value.slice(0, 50))}
              onBlur={handleNameSave}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleNameSave();
                if (e.key === "Escape") { setEditingName(false); setDisplayName((profile?.display_name as string) || ""); }
              }}
              autoFocus
              maxLength={50}
              className="bg-surface-light px-2 py-0.5 text-sm text-foreground focus:outline-none border border-accent/20 flex-1"
            />
          ) : (
            <button
              onClick={() => { setDisplayName(displayName || nameToShow); setEditingName(true); }}
              className={`text-sm transition-colors truncate flex items-center gap-1.5 ${nameSaved ? "text-green-400" : "text-foreground hover:text-accent"}`}
              title="Click to edit name"
            >
              {nameSaved ? "\u2713 Saved" : nameToShow}
              {!nameSaved && <span className="text-muted text-[10px] shrink-0">&#x270E;</span>}
            </button>
          )}
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="shrink-0 flex border-b border-white/10">
        <button
          onClick={() => setActiveTab("terminal")}
          className={`flex-1 py-3 text-xs font-heading font-bold uppercase tracking-widest text-center transition-colors ${
            activeTab === "terminal" ? "text-accent border-b-2 border-accent" : "text-muted hover:text-foreground"
          }`}
        >
          Terminal
        </button>
        <button
          onClick={() => setActiveTab("examination")}
          className={`flex-1 py-3 text-xs font-heading font-bold uppercase tracking-widest text-center transition-colors ${
            activeTab === "examination" ? "text-accent border-b-2 border-accent" : "text-muted hover:text-foreground"
          }`}
        >
          Examination
        </button>
      </div>

      {/* ── Tab content ── */}
      {activeTab === "terminal" ? (
        <SpiritChat
          accessToken={session.access_token}
          assessmentCompleted={assessmentCompleted}
          examPurchased={examPurchased}
          lifespanYears={currentLifespan}
          onLifespanUpdate={handleLifespanUpdate}
          onAssessmentComplete={handleAssessmentComplete}
          onPaywall={() => {}}
          freeMessagesUsed={(sub?.free_messages_used as number) ?? 0}
          freeMessagesLimit={(sub?.free_messages_limit as number) ?? 30}
          messages={chatMessages}
          setMessages={setChatMessages}
        />
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4">
          <div className="max-w-[800px] mx-auto space-y-5">
            {assessmentCompleted ? (
              <ExaminationResults
                currentLifespan={currentLifespan}
                baselineYears={baselineYears}
                penaltyEntries={penaltyEntries}
                penaltiesNormalized={penaltiesNormalized}
                penaltyAdvice={penaltyAdvice}
                committedFactors={committedFactors}
              />
            ) : (
              <ExaminationEmptyState
                examPurchased={examPurchased}
                accessToken={session.access_token}
                onStartExam={() => setActiveTab("terminal")}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Examination Results (post-assessment) ──────────────────────

function ExaminationResults({
  currentLifespan,
  baselineYears,
  penaltyEntries,
  penaltiesNormalized,
  penaltyAdvice,
  committedFactors,
}: {
  currentLifespan: number;
  baselineYears: number | null;
  penaltyEntries: [string, number][];
  penaltiesNormalized: Record<string, number>;
  penaltyAdvice: Record<string, string>;
  committedFactors: string[];
}) {
  const [expandedFactor, setExpandedFactor] = useState<string | null>(null);

  // Build all 17 factors list — red (has penalty) and green (no penalty)
  const allFactors = ZOLMAN_CATEGORIES.map((cat) => {
    const penalty = penaltiesNormalized[cat.id] ?? 0;
    const isRed = penalty > 0;
    const advice = penaltyAdvice[cat.id];
    const isCommitted = committedFactors.includes(cat.id);
    return { ...cat, penalty, isRed, advice, isCommitted };
  });

  // Sort: red factors first (by penalty desc), then green
  allFactors.sort((a, b) => {
    if (a.isRed && !b.isRed) return -1;
    if (!a.isRed && b.isRed) return 1;
    return b.penalty - a.penalty;
  });

  return (
    <>
      {/* Projected lifespan card */}
      <div className="border p-4 sm:p-6 space-y-3" style={{ borderColor: "rgba(140,230,180,0.25)" }}>
        <div className="text-center space-y-2">
          <p className="text-muted text-[10px] font-heading uppercase tracking-widest">Projected Lifespan</p>
          <p
            className="font-heading font-black text-5xl sm:text-6xl"
            style={{ color: "rgba(140,230,180,0.9)", textShadow: "0 0 20px rgba(140,230,180,0.3)" }}
          >
            {currentLifespan.toFixed(1)}
          </p>
          <p className="text-muted text-xs">years</p>
        </div>

        <LifespanBar years={currentLifespan} animate={true} />

        {baselineYears && (
          <div className="flex justify-center gap-4 sm:gap-6 text-[11px] text-muted pt-1">
            <span>Initial: <span className="text-foreground">{baselineYears}</span></span>
            <span>Current: <span className="text-foreground">{currentLifespan.toFixed(1)}</span></span>
            <span>
              <span className={currentLifespan - baselineYears >= 0 ? "text-green-400" : "text-red-400"}>
                {currentLifespan - baselineYears >= 0 ? "+" : ""}{(currentLifespan - baselineYears).toFixed(1)}
              </span>
            </span>
          </div>
        )}
      </div>

      {/* All 17 factors — accordion list */}
      <div className="space-y-2 pt-2">
        <h2 className="font-heading text-[11px] tracking-widest text-accent uppercase">
          Zolman Level 1 Protocol — 17 Factors
        </h2>
        <div className="space-y-1">
          {allFactors.map((factor) => {
            const isExpanded = expandedFactor === factor.id;
            return (
              <div key={factor.id}>
                <button
                  onClick={() => setExpandedFactor(isExpanded ? null : factor.id)}
                  className="w-full text-left"
                >
                  <div
                    className={`py-3 px-3 transition-colors ${
                      factor.isRed
                        ? "border-l-2 border-red-400/40 hover:bg-red-400/5"
                        : "border-l-2 border-green-400/40 hover:bg-green-400/5"
                    }`}
                    style={{
                      boxShadow: factor.isRed
                        ? "inset 0 0 20px rgba(248,113,113,0.06)"
                        : "inset 0 0 20px rgba(74,222,128,0.06)",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs ${factor.isRed ? "text-red-400" : "text-green-400"}`}>
                          {factor.isRed ? "\u25CB" : "\u2713"}
                        </span>
                        <span className="text-sm text-foreground/80">{factor.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {factor.isRed ? (
                          <span className="text-sm text-red-400">-{factor.penalty.toFixed(1)}</span>
                        ) : (
                          <span className="text-xs text-green-400/60">OK</span>
                        )}
                        <span className="text-muted text-[10px]">{isExpanded ? "\u25B2" : "\u25BC"}</span>
                      </div>
                    </div>
                  </div>
                </button>
                {isExpanded && (
                  <div
                    className="px-3 py-3 ml-3 text-xs leading-relaxed space-y-2"
                    style={{
                      borderLeft: `1px solid ${factor.isRed ? "rgba(248,113,113,0.2)" : "rgba(74,222,128,0.2)"}`,
                      color: "rgba(160,240,190,0.7)",
                    }}
                  >
                    {factor.isRed ? (
                      <>
                        {factor.advice && <p>{factor.advice}</p>}
                        <p className="text-red-400/70">
                          Costing you up to {factor.penalty.toFixed(1)} years. Max possible: {factor.maxPenalty} years.
                        </p>
                        <p className="text-muted">Address this factor to recover lost years.</p>
                      </>
                    ) : (
                      <>
                        <p>This factor is working in your favor. No immediate action needed.</p>
                        <p className="text-muted">
                          Continue your current habits. Max penalty if neglected: {factor.maxPenalty} years.
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-muted pt-1">
          {committedFactors.length} of {penaltyEntries.length} penalty factors addressed
        </p>
      </div>
    </>
  );
}

// ── Examination Empty State (pre-assessment) ──────────────────

function ExaminationEmptyState({
  examPurchased,
  accessToken,
  onStartExam,
}: {
  examPurchased: boolean;
  accessToken: string;
  onStartExam: () => void;
}) {
  const [subscribing, setSubscribing] = useState(false);

  async function handlePurchase() {
    setSubscribing(true);
    try {
      const res = await fetch("/api/subscribe", { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } });
      const data = await res.json();
      if (data.paymentUrl) { window.location.href = data.paymentUrl; }
      else { alert(data.error || "Could not start checkout."); setSubscribing(false); }
    } catch { alert("Payment service unavailable."); setSubscribing(false); }
  }

  if (examPurchased) {
    // Exam purchased but not yet completed — direct to terminal
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <img
          src="/paracelsus-portrait.png"
          alt="Paracelsus"
          className="w-16 h-16 rounded-sm object-cover opacity-60"
          style={{ border: "1px solid rgba(140,230,180,0.2)" }}
        />
        <p className="text-sm text-center leading-6 max-w-xs" style={{ color: "rgba(140,230,180,0.7)" }}>
          Your examination is ready. Paracelsus will assess all 17 factors of Dr. Zolman&apos;s Level 1 Longevity Protocol.
        </p>
        <button
          onClick={onStartExam}
          className="bg-accent px-6 py-2 text-xs font-heading font-bold uppercase tracking-wider text-background hover:opacity-90"
        >
          Begin Examination
        </button>
      </div>
    );
  }

  // Not purchased — show CTA
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-5">
      <img
        src="/paracelsus-portrait.png"
        alt="Paracelsus"
        className="w-20 h-20 rounded-sm object-cover opacity-70"
        style={{ border: "1px solid rgba(140,230,180,0.2)" }}
      />
      <div className="text-center space-y-2 max-w-sm">
        <h3
          className="font-heading text-sm tracking-widest uppercase"
          style={{ color: "rgba(140,230,180,0.8)" }}
        >
          Level 1 Longevity Examination
        </h3>
        <p className="text-muted text-xs leading-relaxed">
          Discover your projected lifespan based on Dr. Oliver Zolman&apos;s protocol.
          17 factors. Evidence-based. Your number in 10 minutes.
        </p>
      </div>
      <button
        onClick={handlePurchase}
        disabled={subscribing}
        className="bg-accent px-8 py-3 text-xs font-heading font-bold uppercase tracking-wider text-background hover:opacity-90 disabled:opacity-50"
      >
        {subscribing ? "Redirecting..." : "Examine Now \u2014 $17"}
      </button>
      <p className="text-[10px] text-muted">One-time payment. Results are permanent.</p>
    </div>
  );
}
