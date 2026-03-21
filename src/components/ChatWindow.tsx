"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import DailyReceipt from "./DailyReceipt";
import LifespanBar from "./LifespanBar";

interface Message {
  role: "user" | "assistant";
  content: string;
  commands?: AgentCommand[];
}

interface AgentCommand {
  type: string;
  [key: string]: unknown;
}

interface ChatWindowProps {
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

export default function ChatWindow({
  accessToken,
  assessmentCompleted,
  lifespanYears,
  onLifespanUpdate,
  onAssessmentComplete,
  onPaywall,
  freeMessagesUsed,
  freeMessagesLimit,
  subscriptionStatus,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming, scrollToBottom]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

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
        body: JSON.stringify({
          message: trimmed,
          isAssessment: !assessmentCompleted,
        }),
      });

      if (res.status === 402) {
        onPaywall();
        setIsStreaming(false);
        return;
      }

      if (!res.ok) {
        const err = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `*Paracelsus's connection falters.* ${err.error || "An error occurred."}`,
          },
        ]);
        setIsStreaming(false);
        return;
      }

      // Stream SSE response
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let assistantContent = "";
      const commands: AgentCommand[] = [];

      // Add empty assistant message to fill
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "", commands: [] },
      ]);

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
              commands.push(parsed.command);

              if (parsed.command.type === "assessment_result") {
                onAssessmentComplete(parsed.command);
                onLifespanUpdate(parsed.command.lifespan);
              } else if (parsed.command.type === "lifespan_update") {
                onLifespanUpdate(parsed.command.new_lifespan);
              } else if (parsed.command.type === "what_if") {
                // Handled in render
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
              assistantContent += `\n\n*${parsed.error}*`;
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
            // Skip unparseable lines
          }
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "*Paracelsus is momentarily unreachable. The connection between centuries is unstable. Try again.*",
        },
      ]);
    } finally {
      setIsStreaming(false);
      inputRef.current?.focus();
    }
  }

  const remainingFree =
    subscriptionStatus === "free"
      ? Math.max(0, freeMessagesLimit - freeMessagesUsed)
      : null;

  return (
    <div className="w-full max-w-2xl space-y-4">
      {/* Chat messages */}
      <div className="border border-white/10 bg-surface p-4 h-[28rem] overflow-y-auto">
        {messages.length === 0 && !isStreaming && (
          <div className="text-center mt-32 space-y-3">
            <p className="text-muted text-[15px]">
              {assessmentCompleted
                ? "Speak, and Paracelsus shall answer."
                : "Paracelsus awaits your first words to begin the examination."}
            </p>
            {!assessmentCompleted && (
              <p className="text-accent/60 text-[13px]">
                Say hello to start your initial assessment
              </p>
            )}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className="mb-4">
            <div
              className={`${msg.role === "user" ? "text-right" : "text-left"}`}
            >
              <span
                className={`inline-block max-w-[85%] px-3 py-2 text-[15px] leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-accent/20 text-foreground"
                    : "bg-surface-light text-foreground"
                }`}
              >
                {renderContent(msg.content)}
              </span>
            </div>

            {/* Render commands inline */}
            {msg.commands?.map((cmd, j) => (
              <div key={j} className="mt-3">
                {cmd.type === "assessment_result" && (
                  <div className="space-y-3">
                    <LifespanBar
                      years={cmd.lifespan as number}
                      animate={true}
                    />
                  </div>
                )}
                {cmd.type === "lifespan_update" && (
                  <div className="space-y-2">
                    <div className="text-center">
                      <span
                        className={`text-[15px] font-bold ${(cmd.delta as number) >= 0 ? "text-green-400" : "text-red-400"}`}
                      >
                        {(cmd.delta as number) >= 0 ? "+" : ""}
                        {(cmd.delta as number).toFixed(1)} years
                      </span>
                      <span className="text-muted text-[13px] ml-2">
                        {cmd.reason as string}
                      </span>
                    </div>
                    <LifespanBar
                      years={cmd.new_lifespan as number}
                      animate={true}
                    />
                  </div>
                )}
                {cmd.type === "what_if" && (
                  <div className="space-y-2 p-3 border border-accent/20 bg-accent/5">
                    <p className="font-heading text-[13px] tracking-wider text-accent uppercase">
                      What If: {cmd.scenario as string}
                    </p>
                    <LifespanBar
                      years={cmd.projected_lifespan as number}
                      animate={true}
                    />
                    <p className="text-[13px] text-muted">
                      {cmd.recovery_timeline as string}
                    </p>
                  </div>
                )}
                {cmd.type === "daily_receipt" && (
                  <DailyReceipt
                    items={
                      cmd.items as Array<{
                        habit: string;
                        delta: number;
                        unit: string;
                      }>
                    }
                    netDelta={cmd.net_delta as number}
                    runningTotal={cmd.running_total as number}
                  />
                )}
              </div>
            ))}
          </div>
        ))}

        {isStreaming && messages[messages.length - 1]?.content === "" && (
          <div className="mb-3 text-left">
            <span className="inline-flex gap-1 bg-surface-light px-4 py-3">
              <span className="typing-dot w-2 h-2 rounded-full bg-accent" />
              <span className="typing-dot w-2 h-2 rounded-full bg-accent" />
              <span className="typing-dot w-2 h-2 rounded-full bg-accent" />
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex border border-white/10 overflow-hidden -mt-4"
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            assessmentCompleted
              ? "Ask Paracelsus..."
              : "Say hello to begin your examination..."
          }
          disabled={isStreaming}
          className="flex-1 bg-surface-light px-4 py-3 text-[15px] text-foreground placeholder:text-muted focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          className="bg-accent px-5 py-3 text-[13px] font-heading font-bold uppercase tracking-wider text-background transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Send
        </button>
      </form>

      {/* Free message counter */}
      {remainingFree !== null && (
        <p className="text-center text-[13px] text-muted">
          {remainingFree > 0
            ? `${remainingFree} free message${remainingFree !== 1 ? "s" : ""} remaining`
            : "Free messages exhausted"}
        </p>
      )}
    </div>
  );
}

function renderContent(content: string): string {
  // Strip JSON code blocks from display (they're rendered as components)
  return content
    .replace(/```json\s*\n\{[^`]+\}\s*\n```/g, "")
    .trim();
}
