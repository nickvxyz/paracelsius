import { NextRequest } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createServiceClient } from "@/lib/supabase";
import { buildSystemPrompt, PatientProfile } from "@/lib/system-prompt";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const FREE_DAILY_LIMIT = 10;

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
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
            );
          }
        }

        const jsonMatches = fullResponse.match(
          /```json\s*\n(\{[^`]+\})\s*\n```/g
        );
        if (jsonMatches) {
          for (const match of jsonMatches) {
            const jsonStr = match
              .replace(/```json\s*\n/, "")
              .replace(/\s*\n```/, "");
            try {
              const parsed = JSON.parse(jsonStr);
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ command: parsed })}\n\n`
                )
              );
            } catch {
              // Invalid JSON in response, skip
            }
          }
        }

        if (onComplete) {
          await onComplete(fullResponse);
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "LLM API error";
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: errorMessage })}\n\n`
          )
        );
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
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return Response.json({ error: "Invalid token" }, { status: 401 });
  }

  const { message } = await req.json();
  if (!message?.trim()) {
    return Response.json({ error: "Message required" }, { status: 400 });
  }

  const { data: existingProfile } = await supabase
    .from("patient_profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .single();

  if (!existingProfile) {
    await supabase.from("patient_profiles").insert({
      user_id: user.id,
      lifespan_years: 94,
      assessment_completed: false,
      penalties: {},
      penalty_advice: {},
      conversation_state: { phase: "intro", categories_covered: [], committed_factors: [], declined_factors: [], current_coaching_factor: null, session_count: 0 },
    });
  }

  let { data: sub } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!sub) {
    const { data: newSub } = await supabase
      .from("subscriptions")
      .insert({
        user_id: user.id,
        status: "free",
        free_messages_used: 0,
        free_messages_limit: 10,
        free_messages_date: getTodayKey(),
      })
      .select()
      .single();
    sub = newSub;
  }

  if (!sub) {
    return Response.json({ error: "Failed to initialize subscription" }, { status: 500 });
  }

  const today = getTodayKey();
  const isPaid = sub.status === "active";

  if (!isPaid) {
    if (sub.free_messages_date !== today) {
      await supabase
        .from("subscriptions")
        .update({ free_messages_used: 0, free_messages_date: today })
        .eq("user_id", user.id);
      sub.free_messages_used = 0;
    }

    const messageLimit = sub.free_messages_limit || FREE_DAILY_LIMIT;
    if (sub.free_messages_used >= messageLimit) {
      return Response.json(
        {
          error: "daily_limit",
          message: "You have used all 10 free messages for today.",
          remaining: 0,
          resets_at: "midnight",
        },
        { status: 402 }
      );
    }
  }

  await supabase.from("messages").insert({
    user_id: user.id,
    role: "user",
    content: message.trim(),
  });

  if (!isPaid) {
    await supabase
      .from("subscriptions")
      .update({ free_messages_used: sub.free_messages_used + 1 })
      .eq("user_id", user.id);
  }

  const { data: patientProfile } = await supabase
    .from("patient_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  const { data: recentMessages } = await supabase
    .from("messages")
    .select("role, content")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(15);

  const conversationHistory =
    recentMessages?.reverse().map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    })) || [];

  const isAssessment = !patientProfile?.assessment_completed;
  const systemPrompt = buildSystemPrompt(
    patientProfile as PatientProfile | null,
    isAssessment,
    isPaid
  );

  const stream = streamLLMResponse(
    systemPrompt,
    conversationHistory,
    message.trim(),
    async (fullResponse) => {
      await supabase.from("messages").insert({
        user_id: user.id,
        role: "assistant",
        content: fullResponse,
        metadata: { model: "gemini-2.5-flash" },
      });

      const jsonMatches = fullResponse.match(
        /```json\s*\n(\{[^`]+\})\s*\n```/g
      );
      if (jsonMatches) {
        for (const match of jsonMatches) {
          const jsonStr = match
            .replace(/```json\s*\n/, "")
            .replace(/\s*\n```/, "");
          try {
            const parsed = JSON.parse(jsonStr);
            await handleAgentCommand(supabase, user.id, parsed);
          } catch {
            // Invalid JSON, skip
          }
        }
      }
    }
  );

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleAgentCommand(supabase: any, userId: string, command: any) {
  switch (command.type) {
    case "assessment_result": {
      // Normalize lifespan — Gemini may use "lifespan" or "projected_lifespan"
      const lifespan = command.lifespan ?? command.projected_lifespan ?? 94;

      // Normalize penalties — Gemini may return array [{factor, years_lost}] or flat object {factor: number}
      let penaltiesFlat: Record<string, number> = {};
      let adviceFlat: Record<string, string> = {};
      const rawPenalties = command.penalties || [];

      if (Array.isArray(rawPenalties)) {
        // Array format: [{factor: "Smoking", years_lost: 10, details: "..."}]
        for (const p of rawPenalties) {
          const key = (p.factor || p.name || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "_");
          penaltiesFlat[key] = p.years_lost ?? p.penalty ?? 0;
          if (p.details || p.advice) {
            adviceFlat[key] = p.details || p.advice;
          }
        }
      } else if (typeof rawPenalties === "object") {
        // Flat format: {smoking: 8, exercise: 5}
        penaltiesFlat = rawPenalties;
        adviceFlat = command.advice || {};
      }

      await supabase
        .from("patient_profiles")
        .update({
          lifespan_years: lifespan,
          baseline_years: lifespan,
          assessment_completed: true,
          penalties: penaltiesFlat,
          penalty_advice: adviceFlat,
          assessment_data: command,
          conversation_state: { phase: "coaching", categories_covered: [], committed_factors: [], declined_factors: [], current_coaching_factor: null, session_count: 0 },
          last_interaction_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
      break;
    }
    case "lifespan_update": {
      await supabase
        .from("patient_profiles")
        .update({
          lifespan_years: command.new_lifespan,
          last_interaction_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      const { data: profile } = await supabase
        .from("patient_profiles")
        .select("recovery_log")
        .eq("user_id", userId)
        .single();

      const log = Array.isArray(profile?.recovery_log) ? profile.recovery_log : [];
      log.push({ date: new Date().toISOString(), delta: command.delta, reason: command.reason });

      await supabase
        .from("patient_profiles")
        .update({ recovery_log: log })
        .eq("user_id", userId);
      break;
    }
    case "factor_committed": {
      const { data: currentProfile } = await supabase
        .from("patient_profiles")
        .select("conversation_state")
        .eq("user_id", userId)
        .single();

      const convState = currentProfile?.conversation_state || {};
      const committed = Array.isArray(convState.committed_factors) ? convState.committed_factors : [];
      if (!committed.includes(command.factor)) committed.push(command.factor);

      await supabase
        .from("patient_profiles")
        .update({
          conversation_state: { ...convState, committed_factors: committed, current_coaching_factor: command.factor },
          last_interaction_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
      break;
    }
    case "categories_update": {
      const { data: catProfile } = await supabase
        .from("patient_profiles")
        .select("conversation_state")
        .eq("user_id", userId)
        .single();

      const catState = catProfile?.conversation_state || {};
      const covered = Array.isArray(catState.categories_covered) ? catState.categories_covered : [];
      for (const cat of (command.covered || [])) {
        if (!covered.includes(cat)) covered.push(cat);
      }

      await supabase
        .from("patient_profiles")
        .update({
          conversation_state: { ...catState, categories_covered: covered, phase: "assessment" },
          last_interaction_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
      break;
    }
    case "factor_declined": {
      const { data: decProfile } = await supabase
        .from("patient_profiles")
        .select("conversation_state")
        .eq("user_id", userId)
        .single();

      const decState = decProfile?.conversation_state || {};
      const declined = Array.isArray(decState.declined_factors) ? decState.declined_factors : [];
      if (!declined.includes(command.factor)) declined.push(command.factor);

      await supabase
        .from("patient_profiles")
        .update({
          conversation_state: { ...decState, declined_factors: declined, current_coaching_factor: null },
          last_interaction_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
      break;
    }
    case "factor_resolved": {
      // Update or remove a penalty when user reports a factor is resolved
      const { data: resolvedProfile } = await supabase
        .from("patient_profiles")
        .select("penalties, penalty_advice, conversation_state")
        .eq("user_id", userId)
        .single();

      const currentPenalties = resolvedProfile?.penalties || {};
      const currentAdvice = resolvedProfile?.penalty_advice || {};
      const convState = resolvedProfile?.conversation_state || {};

      // Normalize penalties if array (legacy)
      let penaltiesObj: Record<string, number> = {};
      let adviceObj: Record<string, string> = {};
      if (Array.isArray(currentPenalties)) {
        for (const p of currentPenalties as Array<{ factor?: string; years_lost?: number; details?: string }>) {
          const key = (p.factor || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "_");
          penaltiesObj[key] = p.years_lost ?? 0;
          if (p.details) adviceObj[key] = p.details;
        }
      } else {
        penaltiesObj = { ...currentPenalties };
        adviceObj = { ...currentAdvice };
      }

      const factor = command.factor;
      const newPenalty = command.new_penalty ?? 0;

      if (newPenalty <= 0) {
        // Fully resolved — remove from penalties and advice
        delete penaltiesObj[factor];
        delete adviceObj[factor];
      } else {
        // Partially resolved — update the penalty value
        penaltiesObj[factor] = newPenalty;
        if (command.reason) adviceObj[factor] = command.reason;
      }

      // Mark as committed in conversation state
      const committed = Array.isArray(convState.committed_factors) ? convState.committed_factors : [];
      if (!committed.includes(factor)) committed.push(factor);

      await supabase
        .from("patient_profiles")
        .update({
          penalties: penaltiesObj,
          penalty_advice: adviceObj,
          conversation_state: { ...convState, committed_factors: committed },
          last_interaction_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
      break;
    }
    case "daily_receipt":
    case "what_if":
      break;
  }
}
