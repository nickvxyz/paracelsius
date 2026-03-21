import { NextRequest } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createServiceClient } from "@/lib/supabase";
import { buildSystemPrompt, PatientProfile } from "@/lib/system-prompt";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const FREE_DAILY_LIMIT = 30;

function getTodayKey(): string {
  return new Date().toISOString().split("T")[0];
}

function streamLLMResponse(
  systemPrompt: string,
  conversationHistory: Array<{ role: string; parts: Array<{ text: string }> }>,
  message: string,
  onComplete?: (fullResponse: string) => Promise<void>
) {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      let fullResponse = "";

      try {
        const model = genAI.getGenerativeModel({
          model: "gemini-2.5-flash",
          systemInstruction: systemPrompt,
        });

        const result = await model.generateContentStream({
          contents: conversationHistory.length > 0
            ? conversationHistory
            : [{ role: "user", parts: [{ text: message }] }],
        });

        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            fullResponse += text;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          }
        }

        const jsonMatches = fullResponse.match(/```json\s*\n(\{[^`]+\})\s*\n```/g);
        if (jsonMatches) {
          for (const match of jsonMatches) {
            const jsonStr = match.replace(/```json\s*\n/, "").replace(/\s*\n```/, "");
            try {
              const parsed = JSON.parse(jsonStr);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ command: parsed })}\n\n`));
            } catch { /* skip */ }
          }
        }

        if (onComplete) await onComplete(fullResponse);
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        console.error("[chat] LLM error:", err instanceof Error ? err.message : err);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "The connection between centuries is unstable. Try again." })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });
}

export async function POST(req: NextRequest) {
  const supabase = createServiceClient();

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return Response.json({ error: "Invalid token" }, { status: 401 });

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const { message } = body;
  if (!message?.trim()) return Response.json({ error: "Message required" }, { status: 400 });
  if (message.length > 10000) return Response.json({ error: "Message too long" }, { status: 400 });

  // Upsert profile — safe against concurrent first-message race
  await supabase.from("patient_profiles").upsert({
    user_id: user.id, lifespan_years: 94, assessment_completed: false, exam_purchased: false,
    penalties: {}, penalty_advice: {},
    conversation_state: { phase: "intro", categories_covered: [], committed_factors: [], declined_factors: [], current_coaching_factor: null, session_count: 0 },
  }, { onConflict: "user_id", ignoreDuplicates: true });

  const { data: patientProfile } = await supabase.from("patient_profiles").select("*").eq("user_id", user.id).single();
  const examPurchased = patientProfile?.exam_purchased ?? false;

  // Free message limiting — only for users who haven't purchased the exam
  // Upsert subscription — safe against concurrent first-message race
  await supabase.from("subscriptions").upsert({
    user_id: user.id, status: "free", free_messages_used: 0, free_messages_limit: FREE_DAILY_LIMIT, free_messages_date: getTodayKey(),
  }, { onConflict: "user_id", ignoreDuplicates: true });
  const { data: sub } = await supabase.from("subscriptions").select("*").eq("user_id", user.id).single();
  if (!sub) return Response.json({ error: "Failed to initialize subscription" }, { status: 500 });

  const today = getTodayKey();

  if (!examPurchased) {
    if (sub.free_messages_date !== today) {
      await supabase.from("subscriptions").update({ free_messages_used: 0, free_messages_date: today }).eq("user_id", user.id);
      sub.free_messages_used = 0;
    }
    if (sub.free_messages_used >= FREE_DAILY_LIMIT) {
      return Response.json({ error: "daily_limit", message: "You have used all free messages for today.", remaining: 0, resets_at: "midnight" }, { status: 402 });
    }
    // Atomic increment — prevents race condition with concurrent requests
    const { data: updated, error: incError } = await supabase.rpc("increment_free_messages", { p_user_id: user.id, p_limit: FREE_DAILY_LIMIT });
    if (incError || !updated) {
      // Fallback to non-atomic if RPC doesn't exist yet
      await supabase.from("subscriptions").update({ free_messages_used: sub.free_messages_used + 1 }).eq("user_id", user.id);
    }
  }

  await supabase.from("messages").insert({ user_id: user.id, role: "user", content: message.trim().slice(0, 10000) });

  const { data: recentMessages } = await supabase
    .from("messages").select("role, content").eq("user_id", user.id)
    .order("created_at", { ascending: false }).limit(15);

  const conversationHistory =
    recentMessages?.reverse().map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    })) || [];

  const isAssessment = !patientProfile?.assessment_completed;
  const systemPrompt = buildSystemPrompt(patientProfile as PatientProfile | null, isAssessment, examPurchased);

  const stream = streamLLMResponse(systemPrompt, conversationHistory, message.trim(), async (fullResponse) => {
    await supabase.from("messages").insert({
      user_id: user.id, role: "assistant", content: fullResponse, metadata: { model: "gemini-2.5-flash" },
    });

    const jsonMatches = fullResponse.match(/```json\s*\n(\{[^`]+\})\s*\n```/g);
    if (jsonMatches) {
      for (const match of jsonMatches) {
        const jsonStr = match.replace(/```json\s*\n/, "").replace(/\s*\n```/, "");
        try {
          const parsed = JSON.parse(jsonStr);
          await handleAgentCommand(supabase, user.id, parsed);
        } catch { /* skip */ }
      }
    }
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}

const VALID_COMMAND_TYPES = ["assessment_result", "lifespan_update", "factor_committed", "categories_update", "factor_declined", "factor_resolved", "daily_receipt", "what_if"];
const VALID_FACTOR_IDS = ["biomarkers", "apob_levels", "hormones", "vitamins", "screening", "air_quality", "sleep", "exercise", "nutrition", "body_composition", "dental", "mental_health", "substance_use", "social", "sun_exposure", "hydration", "smoking"];

function clampLifespan(v: unknown): number {
  const n = Number(v);
  if (isNaN(n)) return 94;
  return Math.max(0, Math.min(120, n));
}

function clampPenalty(v: unknown): number {
  const n = Number(v);
  if (isNaN(n)) return 0;
  return Math.max(0, Math.min(30, n));
}

function sanitizeString(v: unknown, maxLen = 500): string {
  return typeof v === "string" ? v.slice(0, maxLen) : "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleAgentCommand(supabase: any, userId: string, command: any) {
  if (!command?.type || !VALID_COMMAND_TYPES.includes(command.type)) return;

  switch (command.type) {
    case "assessment_result": {
      const lifespan = clampLifespan(command.lifespan ?? command.projected_lifespan ?? 94);
      let penaltiesFlat: Record<string, number> = {};
      let adviceFlat: Record<string, string> = {};
      const rawPenalties = command.penalties || [];

      if (Array.isArray(rawPenalties)) {
        for (const p of rawPenalties) {
          const key = (p.factor || p.name || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "_");
          penaltiesFlat[key] = p.years_lost ?? p.penalty ?? 0;
          if (p.details || p.advice) adviceFlat[key] = p.details || p.advice;
        }
      } else if (typeof rawPenalties === "object") {
        penaltiesFlat = rawPenalties;
        adviceFlat = command.advice || {};
      }

      await supabase.from("patient_profiles").update({
        lifespan_years: lifespan, baseline_years: lifespan, assessment_completed: true,
        penalties: penaltiesFlat, penalty_advice: adviceFlat, assessment_data: command,
        conversation_state: { phase: "coaching", categories_covered: [], committed_factors: [], declined_factors: [], current_coaching_factor: null, session_count: 0 },
        last_interaction_at: new Date().toISOString(),
      }).eq("user_id", userId);
      break;
    }
    case "lifespan_update": {
      const { data: luProfile } = await supabase
        .from("patient_profiles").select("penalties, penalty_advice, recovery_log, conversation_state")
        .eq("user_id", userId).single();

      const updateData: Record<string, unknown> = {
        lifespan_years: clampLifespan(command.new_lifespan),
        last_interaction_at: new Date().toISOString(),
      };

      const resolvedFactors = command.resolved_factors;
      if (Array.isArray(resolvedFactors) && resolvedFactors.length > 0) {
        let penObj = { ...(luProfile?.penalties || {}) } as Record<string, number>;
        let advObj = { ...(luProfile?.penalty_advice || {}) } as Record<string, string>;
        const convState = luProfile?.conversation_state || {};
        const committed = Array.isArray(convState.committed_factors) ? [...convState.committed_factors] : [];

        if (Array.isArray(luProfile?.penalties)) {
          penObj = {}; advObj = {};
          for (const p of luProfile.penalties as Array<{ factor?: string; years_lost?: number; details?: string }>) {
            const key = (p.factor || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "_");
            penObj[key] = p.years_lost ?? 0;
            if (p.details) advObj[key] = p.details;
          }
        }

        for (const rf of resolvedFactors) {
          const factor = sanitizeString(rf.factor, 50);
          if (!factor) continue;
          const newPenalty = clampPenalty(rf.new_penalty ?? 0);
          if (newPenalty <= 0) { delete penObj[factor]; delete advObj[factor]; }
          else { penObj[factor] = newPenalty; }
          if (!committed.includes(factor)) committed.push(factor);
        }

        updateData.penalties = penObj;
        updateData.penalty_advice = advObj;
        updateData.conversation_state = { ...convState, committed_factors: committed };
      }

      const log = Array.isArray(luProfile?.recovery_log) ? luProfile.recovery_log : [];
      log.push({ date: new Date().toISOString(), delta: command.delta, reason: command.reason });
      updateData.recovery_log = log;

      await supabase.from("patient_profiles").update(updateData).eq("user_id", userId);
      break;
    }
    case "factor_committed": {
      const { data: currentProfile } = await supabase
        .from("patient_profiles").select("conversation_state").eq("user_id", userId).single();
      const convState = currentProfile?.conversation_state || {};
      const committed = Array.isArray(convState.committed_factors) ? convState.committed_factors : [];
      if (!committed.includes(command.factor)) committed.push(command.factor);
      await supabase.from("patient_profiles").update({
        conversation_state: { ...convState, committed_factors: committed, current_coaching_factor: command.factor },
        last_interaction_at: new Date().toISOString(),
      }).eq("user_id", userId);
      break;
    }
    case "categories_update": {
      const { data: catProfile } = await supabase
        .from("patient_profiles").select("conversation_state").eq("user_id", userId).single();
      const catState = catProfile?.conversation_state || {};
      const covered = Array.isArray(catState.categories_covered) ? catState.categories_covered : [];
      for (const cat of (command.covered || [])) { if (!covered.includes(cat)) covered.push(cat); }
      await supabase.from("patient_profiles").update({
        conversation_state: { ...catState, categories_covered: covered, phase: "assessment" },
        last_interaction_at: new Date().toISOString(),
      }).eq("user_id", userId);
      break;
    }
    case "factor_declined": {
      const { data: decProfile } = await supabase
        .from("patient_profiles").select("conversation_state").eq("user_id", userId).single();
      const decState = decProfile?.conversation_state || {};
      const declined = Array.isArray(decState.declined_factors) ? decState.declined_factors : [];
      if (!declined.includes(command.factor)) declined.push(command.factor);
      await supabase.from("patient_profiles").update({
        conversation_state: { ...decState, declined_factors: declined, current_coaching_factor: null },
        last_interaction_at: new Date().toISOString(),
      }).eq("user_id", userId);
      break;
    }
    case "factor_resolved": {
      const { data: resolvedProfile } = await supabase
        .from("patient_profiles").select("penalties, penalty_advice, conversation_state").eq("user_id", userId).single();
      let penObj = { ...(resolvedProfile?.penalties || {}) } as Record<string, number>;
      let advObj = { ...(resolvedProfile?.penalty_advice || {}) } as Record<string, string>;
      const convState = resolvedProfile?.conversation_state || {};
      const committed = Array.isArray(convState.committed_factors) ? [...convState.committed_factors] : [];

      if (Array.isArray(resolvedProfile?.penalties)) {
        penObj = {}; advObj = {};
        for (const p of resolvedProfile.penalties as Array<{ factor?: string; years_lost?: number; details?: string }>) {
          const key = (p.factor || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "_");
          penObj[key] = p.years_lost ?? 0;
          if (p.details) advObj[key] = p.details;
        }
      }

      const factor = sanitizeString(command.factor, 50);
      if (!factor) break;
      const newPenalty = clampPenalty(command.new_penalty ?? 0);
      if (newPenalty <= 0) { delete penObj[factor]; delete advObj[factor]; }
      else { penObj[factor] = newPenalty; if (command.reason) advObj[factor] = sanitizeString(command.reason); }
      if (!committed.includes(factor)) committed.push(factor);

      await supabase.from("patient_profiles").update({
        penalties: penObj, penalty_advice: advObj,
        conversation_state: { ...convState, committed_factors: committed },
        last_interaction_at: new Date().toISOString(),
      }).eq("user_id", userId);
      break;
    }
    case "daily_receipt":
    case "what_if":
      break;
  }
}
