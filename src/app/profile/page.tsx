"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, usePatientProfile, useSubscription } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import LifespanBar from "@/components/LifespanBar";
import SpiritChat, { type ChatMessage } from "@/components/SpiritChat";

type Tab = "terminal" | "examination";

export default function ProfilePage() {
  const { user, session, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, refresh: refreshProfile } = usePatientProfile(user?.id);
  const { sub, loading: subLoading } = useSubscription(user?.id);
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>("terminal");
  const [lifespanYears, setLifespanYears] = useState<number | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [nameSaved, setNameSaved] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

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

  const rawLifespan = lifespanYears ?? (profile?.lifespan_years as number) ?? 94;
  const currentLifespan = isNaN(rawLifespan) ? 94 : rawLifespan;
  const baselineYears = (profile?.baseline_years as number) ?? null;
  const assessmentCompleted = (profile?.assessment_completed as boolean) ?? false;
  const penaltyAdvice = (profile?.penalty_advice as Record<string, string>) ?? {};
  const convState = (profile?.conversation_state as { committed_factors?: string[] }) ?? {};
  const committedFactors = convState.committed_factors || [];

  // Normalize penalties — handle both flat object and array formats
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

      {/* ── Tab content — fills all remaining height ── */}
      {activeTab === "terminal" ? (
        <SpiritChat
          accessToken={session.access_token}
          assessmentCompleted={assessmentCompleted}
          lifespanYears={currentLifespan}
          onLifespanUpdate={handleLifespanUpdate}
          onAssessmentComplete={handleAssessmentComplete}
          onPaywall={() => {}}
          freeMessagesUsed={(sub?.free_messages_used as number) ?? 0}
          freeMessagesLimit={(sub?.free_messages_limit as number) ?? 10}
          subscriptionStatus={(sub?.status as string) ?? "free"}
          messages={chatMessages}
          setMessages={setChatMessages}
        />
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4">
          <div className="max-w-[800px] mx-auto space-y-5">
            {assessmentCompleted ? (
              <>
                {/* Projected lifespan — contained card */}
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

                {/* Zolman Level 1 checklist */}
                {penaltyEntries.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <h2 className="font-heading text-[11px] tracking-widest text-accent uppercase">
                      Zolman Level 1 Protocol
                    </h2>
                    <div className="space-y-1">
                      {penaltyEntries.map(([key, value]) => {
                        const isCommitted = committedFactors.includes(key);
                        const advice = penaltyAdvice[key];
                        return (
                          <div
                            key={key}
                            className={`py-3 px-3 ${isCommitted ? "border-l-2 border-green-400/50 bg-green-400/5" : "border-l-2 border-red-400/30"}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs ${isCommitted ? "text-green-400" : "text-muted"}`}>
                                  {isCommitted ? "\u2713" : "\u25CB"}
                                </span>
                                <span className="text-sm text-foreground/80 capitalize">{key.replace(/_/g, " ")}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-red-400">-{(value as number).toFixed(1)}</span>
                                {isCommitted && (
                                  <span className="text-[10px] font-heading uppercase tracking-widest text-green-400">&#x2713;</span>
                                )}
                              </div>
                            </div>
                            {advice && <p className="text-xs text-muted mt-1 ml-5">{advice}</p>}
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-muted pt-1">
                      {committedFactors.length} of {penaltyEntries.length + committedFactors.filter(f => !penaltyEntries.some(([k]) => k === f)).length} factors addressed
                    </p>
                  </div>
                )}
              </>
            ) : (
              /* Empty state */
              <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <img
                  src="/paracelsus-portrait.png"
                  alt="Paracelsus"
                  className="w-16 h-16 rounded-sm object-cover opacity-60"
                  style={{ border: "1px solid rgba(140,230,180,0.2)" }}
                />
                <p className="text-muted text-sm text-center leading-6 max-w-xs">
                  Complete your examination in Terminal to see your projected lifespan and personalized protocol.
                </p>
                <button
                  onClick={() => setActiveTab("terminal")}
                  className="bg-accent px-6 py-2 text-xs font-heading font-bold uppercase tracking-wider text-background hover:opacity-90"
                >
                  Go to Terminal
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
