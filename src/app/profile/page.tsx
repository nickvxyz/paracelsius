"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, usePatientProfile, useSubscription } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import LifespanBar from "@/components/LifespanBar";
import SpiritChat from "@/components/SpiritChat";

export default function ProfilePage() {
  const { user, session, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, refresh: refreshProfile } = usePatientProfile(user?.id);
  const { sub, loading: subLoading } = useSubscription(user?.id);
  const router = useRouter();

  const [lifespanYears, setLifespanYears] = useState<number | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [todoOpen, setTodoOpen] = useState(true);

  // Redirect unauthenticated users
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/");
    }
  }, [authLoading, user, router]);

  // Initialize display name
  useEffect(() => {
    if (profile?.display_name) {
      setDisplayName(profile.display_name as string);
    }
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
    await supabase
      .from("patient_profiles")
      .update({ display_name: trimmed })
      .eq("user_id", user.id);
  };

  if (authLoading || profileLoading || subLoading) {
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

  if (!user || !session) return null;

  const currentLifespan = lifespanYears ?? (profile?.lifespan_years as number) ?? 94;
  const baselineYears = (profile?.baseline_years as number) ?? null;
  const assessmentCompleted = (profile?.assessment_completed as boolean) ?? false;
  const penalties = (profile?.penalties as Record<string, number>) ?? {};
  const penaltyAdvice = (profile?.penalty_advice as Record<string, string>) ?? {};
  const convState = (profile?.conversation_state as { committed_factors?: string[] }) ?? {};
  const committedFactors = convState.committed_factors || [];

  const penaltyEntries = Object.entries(penalties)
    .sort(([, a], [, b]) => (b as number) - (a as number));

  const nameToShow = displayName || (user.email?.split("@")[0] ?? "Patient");

  return (
    <div className="flex min-h-[calc(100vh-57px)] justify-center px-4 sm:px-6 py-6">
      <div className="w-full max-w-2xl space-y-5">
        {/* ① Patient File */}
        <div className="space-y-1">
          <div className="flex items-baseline gap-2">
            <h1 className="font-heading text-2xl font-bold tracking-wider text-accent">
              Patient File
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {editingName ? (
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value.slice(0, 50))}
                onBlur={handleNameSave}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleNameSave();
                  if (e.key === "Escape") {
                    setEditingName(false);
                    setDisplayName((profile?.display_name as string) || "");
                  }
                }}
                autoFocus
                maxLength={50}
                aria-label="Edit display name"
                className="bg-surface-light px-2 py-1 text-lg text-foreground focus:outline-none border border-accent/20"
              />
            ) : (
              <button
                onClick={() => {
                  setDisplayName(displayName || nameToShow);
                  setEditingName(true);
                }}
                className="text-lg text-foreground hover:text-accent transition-colors text-left"
                title="Click to edit name"
              >
                {nameToShow}
              </button>
            )}
          </div>
          <p className="text-muted text-xs">{user.email}</p>
        </div>

        {/* ② LifespanBar — only after assessment */}
        {assessmentCompleted && (
          <div className="space-y-3">
            <LifespanBar years={currentLifespan} animate={true} />
            {baselineYears && (
              <div className="flex flex-wrap gap-4 text-xs text-muted">
                <span>
                  Initial:{" "}
                  <span className="text-foreground">{baselineYears} yrs</span>
                </span>
                <span>
                  Current:{" "}
                  <span className="text-foreground">{currentLifespan} yrs</span>
                </span>
                <span>
                  Change:{" "}
                  <span
                    className={
                      currentLifespan - baselineYears >= 0
                        ? "text-green-400"
                        : "text-red-400"
                    }
                  >
                    {currentLifespan - baselineYears >= 0 ? "+" : ""}
                    {(currentLifespan - baselineYears).toFixed(1)} yrs
                  </span>
                </span>
              </div>
            )}
          </div>
        )}

        {/* ③ To-Do Checklist — only after assessment, collapsible */}
        {assessmentCompleted && penaltyEntries.length > 0 && (
          <div className="border border-white/10 bg-surface space-y-0">
            <button
              onClick={() => setTodoOpen(!todoOpen)}
              className="w-full flex items-center justify-between p-4"
              aria-expanded={todoOpen}
            >
              <h2 className="font-heading text-sm tracking-widest text-accent uppercase">
                Lifestyle Factors
              </h2>
              <span className="text-muted text-xs">
                {todoOpen ? "▴" : "▾"} {committedFactors.length}/{penaltyEntries.length}
              </span>
            </button>
            {todoOpen && (
              <div className="px-4 pb-4 space-y-1">
                {penaltyEntries.map(([key, value]) => {
                  const isCommitted = committedFactors.includes(key);
                  const advice = penaltyAdvice[key];
                  return (
                    <div
                      key={key}
                      className={`py-2 px-3 ${
                        isCommitted
                          ? "border-l-2 border-green-400/50 bg-green-400/5"
                          : "border-l-2 border-red-400/30"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span
                            className={`text-xs ${
                              isCommitted ? "text-green-400" : "text-muted"
                            }`}
                          >
                            {isCommitted ? "\u2713" : "\u25CB"}
                          </span>
                          <span className="text-sm text-foreground/80 capitalize">
                            {key.replace(/_/g, " ")}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-red-400">
                            -{(value as number).toFixed(1)} yrs
                          </span>
                          {isCommitted && (
                            <span className="text-[10px] font-heading uppercase tracking-widest text-green-400/70">
                              Committed
                            </span>
                          )}
                        </div>
                      </div>
                      {advice && (
                        <p className="text-xs text-muted mt-1 ml-6">{advice}</p>
                      )}
                    </div>
                  );
                })}
                {committedFactors.length > 0 && (
                  <p className="text-xs text-muted pt-2 border-t border-white/5">
                    {committedFactors.length} of {penaltyEntries.length} factors addressed
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ④ Chat */}
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
        />
      </div>
    </div>
  );
}
