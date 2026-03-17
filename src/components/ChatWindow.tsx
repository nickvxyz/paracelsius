"use client";

import { useState, useRef, useEffect } from "react";

const CANNED_RESPONSES = [
  "Your body is a pharmacy. The question is whether you are the pharmacist or the patient.",
  "You ask me how long you will live. The better question: how long have you been dying?",
  "Sleep is not rest. Sleep is reconstruction. Every hour stolen is a brick removed from your foundation.",
  "The dose makes the poison. This is true of sugar. This is true of work. This is true of worry.",
  "I have watched civilizations crumble from the same disease: the belief that tomorrow will forgive what today destroys.",
  "Your cells replace themselves. You are not who you were seven years ago. The question is whether you are building a better version or a worse copy.",
  "Alcohol is a solvent. It dissolves marriages, memories, and liver cells with equal indifference.",
  "Move your body or it will move without you — toward the ground, permanently.",
  "You eat as though food has no consequences. Your arteries disagree.",
  "I survived five centuries by one principle: pay attention to what keeps you alive, and stop doing what kills you.",
];

interface Message {
  role: "user" | "assistant";
  text: string;
}

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const responseIndex = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isTyping) return;

    const userMsg: Message = { role: "user", text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    const response = CANNED_RESPONSES[responseIndex.current % CANNED_RESPONSES.length];
    responseIndex.current++;

    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [...prev, { role: "assistant", text: response }]);
    }, 800 + Math.random() * 800);
  }

  return (
    <div className="w-full max-w-xl">
      <div className="rounded-t-lg border border-white/10 bg-surface p-4 h-72 overflow-y-auto">
        {messages.length === 0 && !isTyping && (
          <p className="text-muted text-sm text-center mt-24">
            Speak, and the physician shall answer.
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`mb-3 ${msg.role === "user" ? "text-right" : "text-left"}`}
          >
            <span
              className={`inline-block max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-accent/20 text-foreground"
                  : "bg-surface-light text-foreground"
              }`}
            >
              {msg.text}
            </span>
          </div>
        ))}
        {isTyping && (
          <div className="mb-3 text-left">
            <span className="inline-flex gap-1 rounded-lg bg-surface-light px-4 py-3">
              <span className="typing-dot w-2 h-2 rounded-full bg-accent" />
              <span className="typing-dot w-2 h-2 rounded-full bg-accent" />
              <span className="typing-dot w-2 h-2 rounded-full bg-accent" />
            </span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="flex border border-t-0 border-white/10 rounded-b-lg overflow-hidden">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the physician..."
          className="flex-1 bg-surface-light px-4 py-3 text-sm text-foreground placeholder:text-muted focus:outline-none"
        />
        <button
          type="submit"
          disabled={isTyping || !input.trim()}
          className="bg-accent px-5 py-3 text-sm font-bold text-background transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
