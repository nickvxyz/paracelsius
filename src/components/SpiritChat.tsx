"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import DailyReceipt from "./DailyReceipt";
import LifespanBar from "./LifespanBar";
import ShockMoment from "./ShockMoment";
import { usePortrait } from "@/lib/portrait-context";

// ── Types ────────────────────────────────────────────────────────

interface AgentCommand {
  type: string;
  [key: string]: unknown;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  commands?: AgentCommand[];
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
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}


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
  messages,
  setMessages,
}: SpiritChatProps) {
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [dailyLimitHit, setDailyLimitHit] = useState(false);
  const [kbOffset, setKbOffset] = useState(0);
  const [localUsed, setLocalUsed] = useState(freeMessagesUsed);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const portraitRef = usePortrait();

  // Sync when prop changes (e.g. page refresh)
  useEffect(() => { setLocalUsed(freeMessagesUsed); }, [freeMessagesUsed]);

  const isPaid = subscriptionStatus === "active";
  const remaining = isPaid ? null : Math.max(0, freeMessagesLimit - localUsed);

  // ── Keyboard detection via visualViewport ──
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    if ("virtualKeyboard" in navigator) {
      try { (navigator as any).virtualKeyboard.overlaysContent = true; } catch {}
    }
    function onResize() {
      const offset = window.innerHeight - vv!.height;
      setKbOffset(offset > 50 ? offset : 0);
    }
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  // ── Auto-scroll to bottom ──
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);
  useEffect(() => { scrollToBottom(); }, [messages, isStreaming, scrollToBottom]);

  // ── Send message ──
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming || dailyLimitHit) return;

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setIsStreaming(true);
    if (!isPaid) setLocalUsed((prev) => prev + 1);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ message: trimmed }),
      });

      if (res.status === 402) {
        const err = await res.json();
        setDailyLimitHit(err.error === "daily_limit");
        setMessages((prev) => [...prev, { role: "assistant", content: "You have used your free messages for today. Subscribe or return tomorrow." }]);
        setIsStreaming(false);
        return;
      }

      if (!res.ok) {
        const err = await res.json();
        setMessages((prev) => [...prev, { role: "assistant", content: `The connection between centuries grows weak. ${err.error || "Try again."}` }]);
        setIsStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let assistantContent = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "", commands: [] }]);
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
                const u = [...prev]; const l = u[u.length - 1];
                if (l?.role === "assistant") l.content = assistantContent;
                return u;
              });
            }
            if (parsed.command) {
              if (parsed.command.type === "assessment_result") { onAssessmentComplete(parsed.command); onLifespanUpdate(parsed.command.lifespan ?? parsed.command.projected_lifespan ?? 94); }
              else if (parsed.command.type === "lifespan_update") { onLifespanUpdate(parsed.command.new_lifespan); }
              setMessages((prev) => {
                const u = [...prev]; const l = u[u.length - 1];
                if (l?.role === "assistant") l.commands = [...(l.commands || []), parsed.command];
                return u;
              });
            }
            if (parsed.error) {
              assistantContent += `\n\n${parsed.error}`;
              setMessages((prev) => {
                const u = [...prev]; const l = u[u.length - 1];
                if (l?.role === "assistant") l.content = assistantContent;
                return u;
              });
            }
          } catch {}
        }
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "The connection between centuries is unstable. Try again." }]);
    } finally {
      setIsStreaming(false);
      inputRef.current?.focus();
      // Delayed refresh — gives server time to process commands and write to DB
      setTimeout(() => { onLifespanUpdate(lifespanYears); }, 2000);
    }
  }

  async function handleSubscribe() {
    setSubscribing(true);
    try {
      const res = await fetch("/api/subscribe", { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } });
      const data = await res.json();
      if (data.paymentUrl) { window.location.href = data.paymentUrl; }
      else { alert(data.error || "Could not start checkout."); setSubscribing(false); }
    } catch { alert("Payment service unavailable."); setSubscribing(false); }
  }

  const borderColor = "rgba(140,230,180,0.25)";
  const inputBarH = 95; // textarea form + counter

  /*
   * Layout: the parent provides full height via flex.
   * Messages area fills everything, with padding-bottom for the fixed input bar.
   * Input bar is position:fixed, adjusted by kbOffset when keyboard opens.
   */
  return (
    <div className="flex flex-col flex-1 min-h-0 w-full relative">
      {/* ── Messages (scrollable) ── */}
      <div
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 sm:px-4 pt-3"
        style={{ paddingBottom: `${inputBarH + 12}px` }}
      >
        {messages.length === 0 && !isStreaming && (
          <div className="text-center pt-4 space-y-2" style={{ color: "rgba(140,230,180,0.5)", textShadow: "0 0 6px rgba(140,230,180,0.15)" }}>
            <p className="text-sm">Start your longevity examination.</p>
            <p className="text-xs text-muted max-w-xs mx-auto leading-relaxed">
              Paracelsus will assess 17 lifestyle factors from Dr. Zolman&apos;s protocol and calculate your projected lifespan.
            </p>
          </div>
        )}

        <div className="space-y-4 max-w-[800px] mx-auto">
          {messages.map((msg, i) => (
            <div key={i}>
              {msg.role === "user" ? (
                <div className="text-left">
                  <span className="inline-block max-w-[85%] bg-accent/15 px-3 py-2 text-base text-foreground/90 break-words whitespace-pre-wrap" style={{ overflowWrap: "anywhere" }}>
                    {msg.content}
                  </span>
                </div>
              ) : (
                <div className="flex gap-2 items-start" aria-live="polite">
                  <img
                    src="/paracelsus-portrait.png"
                    alt="Paracelsus"
                    className="w-7 h-7 rounded-sm shrink-0 mt-0.5 object-cover"
                    style={{ border: "1px solid rgba(140,230,180,0.2)" }}
                  />
                  <div className="min-w-0 flex-1">
                    <div
                      className="text-base leading-relaxed whitespace-pre-wrap break-words"
                      style={{
                        color: "rgba(160,240,190,0.9)",
                        textShadow: "0 0 8px rgba(140,230,180,0.3), 0 0 20px rgba(120,200,160,0.12)",
                      }}
                    >
                      {renderContent(msg.content)}
                    </div>
                  </div>
                </div>
              )}

              {msg.commands?.map((cmd, j) => (
                <div key={j} className="mt-3">
                  {cmd.type === "assessment_result" && <ShockMoment years={(cmd.lifespan ?? cmd.projected_lifespan ?? 94) as number} />}
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
                      <p className="font-heading text-xs tracking-widest text-accent uppercase">What If: {cmd.scenario as string}</p>
                      <LifespanBar years={cmd.projected_lifespan as number} animate={true} />
                      <p className="text-xs text-muted">{cmd.recovery_timeline as string}</p>
                    </div>
                  )}
                  {cmd.type === "daily_receipt" && <DailyReceipt items={cmd.items as Array<{habit:string;delta:number;unit:string}>} netDelta={cmd.net_delta as number} runningTotal={cmd.running_total as number} />}
                  {cmd.type === "factor_committed" && (
                    <div className="p-3 border border-green-400/20 bg-green-400/5">
                      <p className="text-xs text-green-400 font-heading uppercase tracking-widest">Committed: {(cmd.factor as string).replace(/_/g, " ")}</p>
                      <p className="text-xs text-muted mt-1">{cmd.plan as string}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}

          {isStreaming && messages[messages.length - 1]?.content === "" && (
            <div className="flex gap-2 items-start">
              <img
                src="/paracelsus-portrait.png"
                alt="Paracelsus is thinking"
                className="w-7 h-7 rounded-sm shrink-0 object-cover spirit-thinking"
                style={{ border: "1px solid rgba(140,230,180,0.3)" }}
              />
              <span className="text-xs mt-2" style={{ color: "rgba(140,230,180,0.4)" }}>...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Paywall overlay ── */}
      {dailyLimitHit && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/70">
          <div className="border bg-surface p-6 space-y-4 max-w-sm mx-4" style={{ borderColor }} role="alertdialog">
            <div className="text-center space-y-2">
              <div className="text-accent text-2xl">&#x2620;</div>
              <h3 className="font-heading text-sm tracking-widest text-accent uppercase">Free Messages Used</h3>
              <p className="text-muted text-xs">You have used all 10 free messages for today.</p>
            </div>
            <button onClick={handleSubscribe} disabled={subscribing} className="block w-full bg-accent py-3 text-center text-xs font-heading font-bold uppercase tracking-wider text-background hover:opacity-90 disabled:opacity-50">
              {subscribing ? "Redirecting..." : "Subscribe \u2014 $30/month"}
            </button>
            <p className="text-center text-xs text-muted">Or return tomorrow for 10 more free messages</p>
          </div>
        </div>
      )}

      {/* ── Fixed input bar — moves above keyboard ── */}
      <div
        className="fixed left-0 right-0 z-50 px-2 sm:px-0"
        style={{
          bottom: `${kbOffset}px`,
          transition: kbOffset > 0 ? "none" : "bottom 0.15s ease-out",
        }}
      >
        <div className="max-w-[800px] mx-auto bg-background" style={{ borderTop: `1px solid ${borderColor}`, borderBottom: `1px solid ${borderColor}` }}>
          <form onSubmit={handleSubmit} className="flex items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                // Auto-grow
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Speak to Paracelsus..."
              disabled={isStreaming || dailyLimitHit}
              aria-label="Message Paracelsus"
              rows={2}
              className="flex-1 min-w-0 bg-transparent px-3 py-4 text-base text-foreground focus:outline-none disabled:opacity-50 resize-none"
              style={{
                maxHeight: "120px",
              }}
            />
            <button
              type="submit"
              disabled={isStreaming || dailyLimitHit || !input.trim()}
              className="shrink-0 px-4 py-4 text-xs font-heading font-bold uppercase tracking-wider text-accent hover:opacity-90 disabled:opacity-30"
            >
              Send
            </button>
          </form>
        </div>
        {/* Free messages counter */}
        {remaining !== null && !dailyLimitHit && (
          <div className="max-w-[800px] mx-auto px-3 py-1 bg-background">
            <div className="flex items-center gap-2 text-[10px] text-muted">
              <span className="shrink-0">{localUsed}/{freeMessagesLimit} free messages</span>
              <div className="flex-1 h-[2px] bg-white/5 overflow-hidden">
                <div
                  className="h-full bg-accent/50 transition-all"
                  style={{ width: `${(localUsed / freeMessagesLimit) * 100}%` }}
                />
              </div>
              <span className="shrink-0 text-muted">
                {Math.round((localUsed / freeMessagesLimit) * 100)}%
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function renderContent(content: string): string {
  return content.replace(/```json\s*\n\{[^`]+\}\s*\n```/g, "").trim();
}
