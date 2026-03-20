"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import DailyReceipt from "./DailyReceipt";
import LifespanBar from "./LifespanBar";
import ShockMoment from "./ShockMoment";
import { usePortrait } from "@/lib/portrait-context";

const ALCH_GLYPHS = "\u263f\ud83d\udf0d\ud83d\udf14\ud83d\udf03\ud83d\udf02\ud83d\udf04\ud83d\udf01\u2609\u263d\ud83d\udf0f\u2295\u2644\u2234\u2235\u229b";

interface Message {
  role: "user" | "assistant";
  content: string;
  commands?: AgentCommand[];
}

interface AgentCommand {
  type: string;
  [key: string]: unknown;
}

interface SpiritChatProps {
  accessToken: string;
  assessmentCompleted: boolean;
  lifespanYears: number;
  onLifespanUpdate: (years: number) => void;
  onAssessmentComplete: (result: AgentCommand) => void;
  onPaywall: () => void;
  freeMessagesUsed: number;
  freeMessagesLimit: number;
  subscriptionStatus: string;
}

// ── Scramble text effect ─────────────────────────────────────────

function ScrambleText({ text, onComplete }: { text: string; onComplete?: () => void }) {
  const [resolved, setResolved] = useState(0);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!text) return;
    let charIdx = 0;
    let pass = 0;
    const interval = setInterval(() => {
      pass++;
      if (pass >= 2) {
        charIdx++;
        pass = 0;
        setResolved(charIdx);
      }
      setTick((t) => t + 1);
      if (charIdx >= text.length) {
        clearInterval(interval);
        onComplete?.();
      }
    }, 15);
    return () => clearInterval(interval);
  }, [text, onComplete]);

  return (
    <span>
      {text.split("").map((ch, i) => {
        if (i < resolved) return ch;
        if (ch === " ") return " ";
        return (
          <span key={i} style={{ opacity: 0.6 }}>
            {ALCH_GLYPHS[Math.floor(Math.random() * ALCH_GLYPHS.length)]}
          </span>
        );
      })}
    </span>
  );
}

// ── Spirit message display ───────────────────────────────────────

function SpiritMessage({ content, isNew }: { content: string; isNew: boolean }) {
  const [showScramble, setShowScramble] = useState(isNew);
  if (!content) return null;

  return (
    <div
      className="text-sm leading-relaxed whitespace-pre-wrap break-words max-w-full"
      style={{
        color: "rgba(160,240,190,0.9)",
        textShadow: "0 0 8px rgba(140,230,180,0.3), 0 0 20px rgba(120,200,160,0.12)",
      }}
    >
      {showScramble ? (
        <ScrambleText text={content} onComplete={() => setShowScramble(false)} />
      ) : (
        content
      )}
    </div>
  );
}

// ── Fixed input bar height (used for padding) ────────────────────
const INPUT_BAR_HEIGHT = 52; // px — form height including border

// ── Main component ───────────────────────────────────────────────

export default function SpiritChat({
  accessToken,
  assessmentCompleted,
  lifespanYears,
  onLifespanUpdate,
  onAssessmentComplete,
  onPaywall,
  freeMessagesUsed,
  freeMessagesLimit,
  subscriptionStatus,
}: SpiritChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [dailyLimitHit, setDailyLimitHit] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const portraitRef = usePortrait();

  const isPaid = subscriptionStatus === "active";
  const remaining = isPaid ? null : Math.max(0, freeMessagesLimit - freeMessagesUsed);

  // ── VisualViewport keyboard detection ──
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    // Enable manual keyboard handling if available
    if ("virtualKeyboard" in navigator) {
      (navigator as unknown as Record<string, { overlaysContent: boolean }>).virtualKeyboard.overlaysContent = true;
    }

    function onResize() {
      const kbHeight = window.innerHeight - vv!.height;
      setKeyboardOffset(kbHeight > 50 ? kbHeight : 0);
    }

    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming, scrollToBottom]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming || dailyLimitHit) return;

    const userMsg: Message = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ message: trimmed }),
      });

      if (res.status === 402) {
        const err = await res.json();
        if (err.error === "daily_limit") {
          setDailyLimitHit(true);
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content:
                "You have used your free messages for today. I will be here tomorrow \u2014 or, if you wish to continue now, you may subscribe.\n\nThe examination is not complete. Your projected lifespan awaits.",
            },
          ]);
        } else {
          onPaywall();
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content:
                "My tokens run dry. Subscribe to continue the examination.",
            },
          ]);
        }
        setIsStreaming(false);
        return;
      }

      if (!res.ok) {
        const err = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `The connection between centuries grows weak. ${err.error || "Try again."}`,
          },
        ]);
        setIsStreaming(false);
        return;
      }

      // Stream SSE
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let assistantContent = "";

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "", commands: [] },
      ]);

      portraitRef?.current?.disturb();

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);

            if (parsed.text) {
              assistantContent += parsed.text;
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  last.content = assistantContent;
                }
                return updated;
              });
            }

            if (parsed.command) {
              if (parsed.command.type === "assessment_result") {
                onAssessmentComplete(parsed.command);
                onLifespanUpdate(parsed.command.lifespan);
              } else if (parsed.command.type === "lifespan_update") {
                onLifespanUpdate(parsed.command.new_lifespan);
              }

              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  last.commands = [...(last.commands || []), parsed.command];
                }
                return updated;
              });
            }

            if (parsed.error) {
              assistantContent += `\n\n${parsed.error}`;
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  last.content = assistantContent;
                }
                return updated;
              });
            }
          } catch {
            // Skip
          }
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "The connection between centuries is unstable. Try again.",
        },
      ]);
    } finally {
      setIsStreaming(false);
      inputRef.current?.focus();
    }
  }

  async function handleSubscribe() {
    setSubscribing(true);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        alert(data.error || "Could not start checkout. Try again.");
        setSubscribing(false);
      }
    } catch {
      alert("Payment service unavailable. Try again later.");
      setSubscribing(false);
    }
  }

  const borderColor = "rgba(140,230,180,0.25)";

  return (
    <>
      {/* ── Messages area (scrollable, with bottom padding for fixed input) ── */}
      <div
        className="w-full max-w-[800px] mx-auto flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
        style={{
          borderLeft: `1px solid ${borderColor}`,
          borderRight: `1px solid ${borderColor}`,
          borderTop: `1px solid ${borderColor}`,
          paddingBottom: `${INPUT_BAR_HEIGHT + 8}px`,
        }}
      >
        <div className="p-4 space-y-5">
          {messages.length === 0 && !isStreaming && (
            <p
              className="text-center text-sm pt-4"
              style={{
                color: "rgba(140,230,180,0.5)",
                textShadow: "0 0 6px rgba(140,230,180,0.15)",
              }}
            >
              {assessmentCompleted
                ? "Speak, and the physician shall answer."
                : "Say hello to begin your examination."}
            </p>
          )}

          {messages.map((msg, i) => (
            <div key={i}>
              {msg.role === "user" ? (
                <div className="text-right">
                  <span className="inline-block max-w-[85%] bg-accent/15 px-3 py-2 text-sm text-foreground/90 break-words" style={{ overflowWrap: "anywhere" }}>
                    {msg.content}
                  </span>
                </div>
              ) : (
                <div aria-live="polite">
                  <SpiritMessage
                    content={renderContent(msg.content)}
                    isNew={i === messages.length - 1 && !isStreaming}
                  />
                </div>
              )}

              {msg.commands?.map((cmd, j) => (
                <div key={j} className="mt-3">
                  {cmd.type === "assessment_result" && (
                    <ShockMoment years={cmd.lifespan as number} />
                  )}
                  {cmd.type === "lifespan_update" && (
                    <div className="space-y-2">
                      <div className="text-center">
                        <span className={`text-sm font-bold ${(cmd.delta as number) >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {(cmd.delta as number) >= 0 ? "+" : ""}{(cmd.delta as number).toFixed(1)} years
                        </span>
                        <span className="text-muted text-xs ml-2">{cmd.reason as string}</span>
                      </div>
                      <LifespanBar years={cmd.new_lifespan as number} animate={true} />
                    </div>
                  )}
                  {cmd.type === "what_if" && (
                    <div className="space-y-2 p-3 border border-accent/20 bg-accent/5">
                      <p className="font-heading text-xs tracking-widest text-accent uppercase">
                        What If: {cmd.scenario as string}
                      </p>
                      <LifespanBar years={cmd.projected_lifespan as number} animate={true} />
                      <p className="text-xs text-muted">{cmd.recovery_timeline as string}</p>
                    </div>
                  )}
                  {cmd.type === "daily_receipt" && (
                    <DailyReceipt
                      items={cmd.items as Array<{ habit: string; delta: number; unit: string }>}
                      netDelta={cmd.net_delta as number}
                      runningTotal={cmd.running_total as number}
                    />
                  )}
                  {cmd.type === "factor_committed" && (
                    <div className="p-3 border border-green-400/20 bg-green-400/5">
                      <p className="text-xs text-green-400 font-heading uppercase tracking-widest">
                        Committed: {(cmd.factor as string).replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-muted mt-1">{cmd.plan as string}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}

          {isStreaming && messages[messages.length - 1]?.content === "" && (
            <div>
              <span className="inline-flex gap-1 px-1 py-2">
                <span className="typing-dot w-2 h-2 rounded-full bg-accent" />
                <span className="typing-dot w-2 h-2 rounded-full bg-accent" />
                <span className="typing-dot w-2 h-2 rounded-full bg-accent" />
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Paywall freeze overlay ── */}
      {dailyLimitHit && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
          <div
            className="border bg-surface p-6 space-y-4 max-w-sm mx-4"
            style={{ borderColor }}
            role="alertdialog"
            aria-labelledby="paywall-title"
          >
            <div className="text-center space-y-2">
              <div className="text-accent text-2xl">&#x2620;</div>
              <h3 id="paywall-title" className="font-heading text-sm tracking-widest text-accent uppercase">
                Free Messages Used
              </h3>
              <p className="text-muted text-xs leading-5">
                You have used all 10 free messages for today.
              </p>
            </div>
            <button
              onClick={handleSubscribe}
              disabled={subscribing}
              className="block w-full bg-accent py-3 text-center text-xs font-heading font-bold uppercase tracking-wider text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {subscribing ? "Redirecting..." : "Subscribe \u2014 $30/month"}
            </button>
            <p className="text-center text-xs text-muted">
              Or return tomorrow for 10 more free messages
            </p>
          </div>
        </div>
      )}

      {/* ── Fixed input bar — stays above keyboard ── */}
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="fixed left-0 right-0 z-50 flex max-w-[800px] mx-auto bg-background"
        style={{
          bottom: `${keyboardOffset}px`,
          borderTop: `1px solid ${borderColor}`,
          borderLeft: `1px solid ${borderColor}`,
          borderRight: `1px solid ${borderColor}`,
          borderBottom: `1px solid ${borderColor}`,
          transition: keyboardOffset > 0 ? "none" : "bottom 0.15s ease-out",
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Speak to the physician..."
          disabled={isStreaming || dailyLimitHit}
          aria-label="Message Paracelsus"
          className="flex-1 min-w-0 bg-transparent px-4 py-3 text-sm text-foreground placeholder:text-muted focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isStreaming || dailyLimitHit || !input.trim()}
          className="shrink-0 w-[80px] sm:w-[100px] bg-accent py-3 text-xs font-heading font-bold uppercase tracking-wider text-background transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ borderLeft: `1px solid ${borderColor}` }}
        >
          Send
        </button>
      </form>

      {/* Message counter — outside the panel */}
      {remaining !== null && !dailyLimitHit && remaining > 0 && (
        <p className="text-center text-[10px] text-muted mt-1">
          {remaining} free message{remaining !== 1 ? "s" : ""} remaining
        </p>
      )}
    </>
  );
}

function renderContent(content: string): string {
  return content
    .replace(/```json\s*\n\{[^`]+\}\s*\n```/g, "")
    .trim();
}
