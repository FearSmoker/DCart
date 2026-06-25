"use client";

import React, { useState, useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MdHeadset } from "react-icons/md";

interface Message {
  role: "user" | "support";
  content: string;
  tools?: string[];
  mode?: string;
}

const QUICK_ACTIONS = [
  { label: "📦 Track my order", query: "Where is my order? What's the status?" },
  { label: "💰 Refund policy", query: "What is the refund and return policy?" },
  { label: "🚚 Shipping info", query: "How long does shipping take and what are the charges?" },
  { label: "❌ Cancel order", query: "How do I cancel my order?" },
  { label: "🛍️ My purchases", query: "Show me my recent orders" },
  { label: "💳 Payment options", query: "What payment methods do you accept?" },
  { label: "🛡️ Warranty", query: "What is the warranty policy?" },
];

function renderMarkdown(text: string): React.ReactNode {
  const html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-accent dark:text-orange-400">$1</strong>')
    .replace(/^\* (.*)/gm, '<li class="ml-4 list-disc text-xs leading-relaxed">$1</li>')
    .replace(/\[(.*?)\]\((.*?)\)/g, (match, label, href) => {
      if (href.startsWith("/")) {
        return `<a href="${href}" class="inline-flex items-center justify-center px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black rounded-xl shadow-md transition-all duration-200 text-[10px] uppercase tracking-wider mt-2 mb-1 mr-1">${label}</a>`;
      }
      return `<a href="${href}" class="text-orange-500 hover:underline font-semibold">${label}</a>`;
    })
    .replace(/\n/g, "<br />");
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

const CustomerSupport = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close when shopping copilot opens
  useEffect(() => {
    const handleClose = () => setIsOpen(false);
    window.addEventListener("close-support", handleClose);
    return () => window.removeEventListener("close-support", handleClose);
  }, []);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          role: "support",
          content:
            "👋 Hi! I'm DCart's AI Customer Care assistant. I can help you with orders, refunds, shipping, and more. How can I help you today?",
        },
      ]);
    }
  }, [isOpen, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const toggleOpen = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      window.dispatchEvent(new CustomEvent("close-copilot"));
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "support",
          content: data.reply || "I'm sorry, I couldn't process your request.",
          tools: data.toolsUsed,
          mode: data.mode,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "support", content: "⚠️ Something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={toggleOpen}
        className="fixed bottom-6 left-6 z-40 w-12 h-12 rounded-full bg-slate-800 dark:bg-zinc-700 text-white shadow-xl flex items-center justify-center hover:bg-gray-700 dark:hover:bg-gray-600 transition-all hover:scale-110 active:scale-95 duration-300"
        aria-label="Customer Care"
        title="Open Customer Care"
      >
        {isOpen ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <MdHeadset className="w-5 h-5 text-white" />
        )}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-20 left-6 z-40 w-[calc(100vw-2rem)] sm:w-[380px] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-150 dark:border-zinc-800 flex flex-col overflow-hidden max-h-[560px]">
          {/* Header */}
          <div className="px-4 py-3 bg-slate-800 dark:bg-zinc-800 text-white flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-sm font-bold">
              <MdHeadset className="text-white text-base" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold leading-tight">Customer Care</p>
              <p className="text-[10px] text-gray-300 leading-tight">Typically replies instantly</p>
            </div>
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          </div>


          {/* Quick actions */}
          {messages.length <= 1 && (
            <div className="px-3 pt-3 pb-1 flex flex-wrap gap-1.5 shrink-0">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  onClick={() => sendMessage(action.query)}
                  className="text-[10px] px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}

          {/* Messages */}
          <ScrollArea className="flex-1 px-3 py-2 overflow-y-auto">
            <div className="space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "support" && (
                    <div className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-[10px] font-bold mr-2 mt-1 shrink-0">
                      <MdHeadset className="text-white text-xs" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                      msg.role === "user"
                        ? "bg-gray-800 dark:bg-gray-700 text-white rounded-br-sm"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-sm"
                    }`}
                  >
                    {msg.role === "support" ? renderMarkdown(msg.content) : msg.content}
                    {msg.tools && msg.tools.length > 0 && (
                      <div className="mt-1.5 pt-1.5 border-t border-gray-200/50 dark:border-gray-600/50 flex flex-wrap gap-1">
                        {msg.tools.map((t) => (
                          <span
                            key={t}
                            className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-[10px] font-bold mr-2 mt-1 shrink-0">
                    <MdHeadset className="text-white text-xs" />
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="px-3 py-3 border-t border-gray-100 dark:border-gray-700/60 flex items-center gap-2 shrink-0 bg-white dark:bg-gray-900"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your question…"
              disabled={loading}
              className="flex-1 px-3.5 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-full outline-none focus:border-gray-500 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 focus:bg-white dark:focus:bg-gray-800 transition-colors disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="p-2 bg-gray-800 dark:bg-gray-700 text-white rounded-full hover:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-40 transition-colors flex items-center justify-center"
              aria-label="Send message"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>

          {/* Footer */}
          <div className="px-4 py-1.5 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">Orders · Refunds · Shipping · Products</span>
            </div>
            <span className="text-[10px] text-gray-400 dark:text-gray-500">Customer Care</span>
          </div>
        </div>
      )}
    </>
  );
};

export default CustomerSupport;
