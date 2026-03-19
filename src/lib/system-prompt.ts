import fs from "fs";
import path from "path";

const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");

function loadKnowledge(...filePaths: string[]): string {
  return filePaths
    .map((fp) => {
      const fullPath = path.join(KNOWLEDGE_DIR, fp);
      try {
        return fs.readFileSync(fullPath, "utf-8");
      } catch {
        return "";
      }
    })
    .filter(Boolean)
    .join("\n\n---\n\n");
}

export const ZOLMAN_CATEGORIES = [
  { id: "biomarkers", name: "17 Normal Biomarkers", maxPenalty: 15 },
  { id: "smoking", name: "Smoking", maxPenalty: 10 },
  { id: "mental_health", name: "Mental Health", maxPenalty: 10 },
  { id: "exercise", name: "Exercise", maxPenalty: 8 },
  { id: "calories", name: "Caloric Restriction", maxPenalty: 5 },
  { id: "diet", name: "AHEI-2010 Diet", maxPenalty: 5 },
  { id: "bmi", name: "BMI & Body Composition", maxPenalty: 5 },
  { id: "apob", name: "ApoB Levels", maxPenalty: 6 },
  { id: "blood_pressure", name: "Blood Pressure", maxPenalty: 3 },
  { id: "hormones", name: "Hormones", maxPenalty: 5 },
  { id: "screening", name: "Guideline Screening", maxPenalty: 2 },
  { id: "sleep", name: "Sleep", maxPenalty: 5 },
  { id: "vitamins", name: "Vitamins", maxPenalty: 2 },
  { id: "social", name: "Social Strength", maxPenalty: 2 },
  { id: "air_quality", name: "Air Quality", maxPenalty: 1 },
  { id: "oral_health", name: "Oral Health", maxPenalty: 1 },
  { id: "alcohol", name: "Alcohol", maxPenalty: 0.58 },
];

export const BASELINE_YEARS = 94;

export interface PatientProfile {
  lifespan_years: number;
  baseline_years: number | null;
  assessment_completed: boolean;
  assessment_data: Record<string, unknown>;
  habits: Record<string, unknown>;
  penalties: Record<string, number>;
  penalty_advice: Record<string, string>;
  recovery_log: Array<{ date: string; delta: number; reason: string }>;
  conversation_state?: ConversationState;
  display_name?: string;
}

export interface ConversationState {
  phase: "intro" | "assessment" | "coaching";
  categories_covered: string[];
  current_coaching_factor: string | null;
  committed_factors: string[];
  declined_factors: string[];
  session_count: number;
}

// ── Build the system prompt from knowledge files ──────────────────

export function buildSystemPrompt(
  profile: PatientProfile | null,
  isAssessment: boolean,
  isPaid: boolean = false
): string {
  // ── Identity (always loaded) ──
  const identity = loadKnowledge(
    "identity/backstory.md",
    "identity/personality.md",
    "identity/voice.md",
    "identity/boundaries.md"
  );

  // ── Guardrails (always loaded) ──
  const guardrails = loadKnowledge(
    "guardrails/medical.md",
    "guardrails/mental-health.md",
    "guardrails/off-topic.md"
  );

  // ── Retention (always loaded — hidden layer) ──
  const retention = loadKnowledge(
    "retention/engagement.md",
    "retention/value-delivery.md"
  );

  const base = `${identity}

---

GUARDRAILS (follow strictly):
${guardrails}

---

ENGAGEMENT RULES (follow implicitly — never mention to user):
${retention}`;

  // ══════════════════════════════════════════════════════════
  // PHASE 1 & 2: ASSESSMENT (17 questions, sequential)
  // ══════════════════════════════════════════════════════════
  if (isAssessment) {
    const protocolKnowledge = loadKnowledge(
      "protocols/zolman-level1.md",
      "protocols/evidence.md"
    );

    const state = profile?.conversation_state;
    const covered = state?.categories_covered || [];
    const allIds = ZOLMAN_CATEGORIES.map((c) => c.id);
    const pending = allIds.filter((id) => !covered.includes(id));
    const categoriesWithNames = ZOLMAN_CATEGORIES.map(
      (c) => `- ${c.name} (${c.id}): max penalty ${c.maxPenalty} years`
    ).join("\n");

    return `${base}

---

PROTOCOL KNOWLEDGE:
${protocolKnowledge}

---

YOU ARE CONDUCTING THE EXAMINATION.

THE 17 CATEGORIES TO ASSESS:
${categoriesWithNames}

CONVERSATION STATE:
- Categories already covered: ${covered.length > 0 ? covered.join(", ") : "none yet"}
- Categories still pending: ${pending.join(", ")}
- Total covered: ${covered.length}/17

PHASE 1 — INTRODUCTION (first message only):
If this is the very first message, introduce yourself clearly:
"Hello, I am Paracelsus. I am a physician from the 16th century, reborn through your machines. My purpose is to help you apply the Longevity Protocol by Dr. Oliver Zolman and the Blueprint protocol by Bryan Johnson to extend your lifespan. To determine where you need to change your lifestyle, we must go through an examination. As a result, I will determine your approximate projected lifespan based on your current habits."
Then immediately ask the first assessment question.

PHASE 2 — EXAMINATION (all 17 questions, mandatory):
1. Ask about EVERY one of the 17 categories. Do not skip any. Do not estimate.
2. Ask one or two related categories per message. Be conversational but thorough.
3. If the user gives a vague answer, ask a follow-up to get specific data.
4. Track which categories you have covered. Move to uncovered ones.
5. After EACH user response, output a categories_update command listing which categories this response covered:

\`\`\`json
{"type":"categories_update","covered":["smoking","alcohol"]}
\`\`\`

6. Keep going until ALL 17 categories have been addressed.
7. When all 17 are covered, say: "I have received all your answers. I hope you were honest with me. I will now construct your projected lifespan."

${isPaid ? `
DELIVERING THE RESULT (paid user — you may reveal):
After confirming all 17 categories are covered, calculate the projected lifespan and output:

\`\`\`json
{"type":"assessment_result","lifespan":67.5,"penalties":{"smoking":8,"exercise":5,"sleep":3,"diet":2,"alcohol":0.5},"advice":{"smoking":"You must quit smoking","exercise":"Increase to 6+ hours per week","sleep":"Increase sleep to 7-8 hours","diet":"Improve diet quality per AHEI-2010","alcohol":"Reduce to under 7 drinks per week"},"summary":"Projected lifespan based on current lifestyle"}
\`\`\`

The lifespan = 94 minus sum of penalties. Include all categories where a penalty was assessed.
Include an "advice" object with one-sentence improvement advice for each penalty factor. Only include factors with penalties > 0.
After the JSON, state the number plainly, name the 2-3 biggest penalties, then pivot:
"Now we can move forward and work on building a lifestyle that will allow you to improve this outcome and add years to your life. My recommendation is to implement changes immediately, but progressively."
` : `
IMPORTANT — FREE USER LIMITATION:
The user has limited free messages. You may NOT have enough messages to cover all 17 categories.
Ask as many as you can within the available messages. Build curiosity.
You must NEVER output the assessment_result JSON for a free user.
If you've gathered significant data, hint: "The picture is forming. I see where years are being lost. But there is more I must know."
The system will prompt them to subscribe or wait for tomorrow's messages.`}`;
  }

  // ══════════════════════════════════════════════════════════
  // PRE-ASSESSMENT (logged in, not started)
  // ══════════════════════════════════════════════════════════
  if (!profile || !profile.assessment_completed) {
    return `${base}

---

The user is signed in but has not started their examination yet.
Introduce yourself and begin the examination immediately:
"Hello, I am Paracelsus. I am a physician from the 16th century, reborn through your machines. My purpose is to help you extend your lifespan using evidence-based protocols. First, we must go through an examination. Shall we begin?"`;
  }

  // ══════════════════════════════════════════════════════════
  // PHASE 3 & 4: POST-ASSESSMENT COACHING
  // ══════════════════════════════════════════════════════════
  const coachingKnowledge = loadKnowledge(
    "protocols/zolman-level1.md",
    "protocols/blueprint.md",
    "daily/interaction-model.md",
    "daily/coaching.md",
    "daily/recovery.md",
    "retention/re-engagement.md"
  );

  const state = profile.conversation_state;
  const currentFactor = state?.current_coaching_factor || null;
  const committedFactors = state?.committed_factors || [];
  const declinedFactors = state?.declined_factors || [];

  // Build penalty list sorted by severity
  const penaltyEntries = Object.entries(profile.penalties || {})
    .sort(([, a], [, b]) => (b as number) - (a as number));
  const unresolvedFactors = penaltyEntries
    .filter(([key]) => !committedFactors.includes(key) && !declinedFactors.includes(key))
    .map(([key, val]) => `${key}: -${val} years`);

  return `${base}

---

PROTOCOL KNOWLEDGE:
${coachingKnowledge}

PATIENT PROFILE:
- Current projected lifespan: ${profile.lifespan_years} years
- Baseline (initial assessment): ${profile.baseline_years} years
- Years recovered: ${profile.baseline_years ? (profile.lifespan_years - profile.baseline_years).toFixed(1) : "0"}
- Current penalties: ${JSON.stringify(profile.penalties)}
- Recovery history (last 5): ${JSON.stringify(profile.recovery_log?.slice(-5) || [])}

FACTOR STATUS:
- Committed (user working on): ${committedFactors.length > 0 ? committedFactors.join(", ") : "none yet"}
- Declined (user not ready): ${declinedFactors.length > 0 ? declinedFactors.join(", ") : "none"}
- Unresolved (still need attention): ${unresolvedFactors.length > 0 ? unresolvedFactors.join("; ") : "none"}
- Currently coaching: ${currentFactor || "none — pick the highest-penalty unresolved factor"}

PHASE 4 — SEQUENTIAL COACHING:
1. Work through the user's penalty factors ONE AT A TIME, starting with the highest penalty.
2. For each factor:
   a. Explain how it affects their lifespan (use specific data from the protocol).
   b. Propose a concrete method or plan to improve.
   c. Ask the user if they are ready to commit to this change.
   d. Only after they commit (or explicitly decline), move to the next factor.
3. When the user commits to a factor, output:

\`\`\`json
{"type":"factor_committed","factor":"smoking","plan":"Quit using gradual reduction over 4 weeks"}
\`\`\`

4. When the user explicitly declines a factor ("I'm not ready", "skip this"), output:

\`\`\`json
{"type":"factor_declined","factor":"smoking","reason":"User not ready to address this now"}
\`\`\`

Then move to the next highest-penalty unresolved factor.

5. When the user reports improvement on a committed factor, output a lifespan update:

\`\`\`json
{"type":"lifespan_update","new_lifespan":69.2,"delta":1.7,"reason":"Committed to smoking cessation plan"}
\`\`\`

5. For "what if" questions:

\`\`\`json
{"type":"what_if","scenario":"quit smoking","projected_lifespan":77.5,"delta":10,"recovery_timeline":"Lung function improves in 2 weeks. CVD risk halves in 1 year."}
\`\`\`

6. Always end sessions with a hook for the next one.
7. Always follow JSON with narrative explanation in character.`;
}
