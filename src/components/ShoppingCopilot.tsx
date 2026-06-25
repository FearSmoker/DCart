"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { MdChat, MdClose, MdSend, MdSmartToy, MdPerson, MdAutoAwesome, MdRefresh } from "react-icons/md";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTION_CHIPS = [
  {
    label: "🎮 Gaming laptops under ₹80k",
    query: "Suggest gaming laptops under ₹80,000"
  },
  {
    label: "📱 Compare top phones",
    query: "Compare the best smartphones in your store"
  },
  {
    label: "📸 Best for photography",
    query: "Best phone for photography in your catalog"
  },
  {
    label: "💻 Budget laptops",
    query: "Show me the most affordable laptops available"
  },
  {
    label: "🎧 Headphones & audio",
    query: "What headphones or audio products do you have?"
  },
  {
    label: "🔌 Accessories",
    query: "Show me popular accessories available"
  }
];

const ShoppingCopilot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I'm your **DCart Shopping Copilot** 🤖\n\nI can help you find products, compare specs, and discover the best deals from our store!\n\n**Try asking me:**\n* *Suggest a smartphone under ₹25,000*\n* *Compare iPhone and Samsung*\n* *Best laptop for students*"
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef(messages);
  const loadingRef = useRef(loading);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesRef.current = messages;
    loadingRef.current = loading;
  }, [messages, loading]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const handleSend = useCallback(async (textToSend: string) => {
    if (!textToSend.trim() || loadingRef.current) return;
    const userMsg = textToSend.trim();
    setInput("");
    setMessages((prev) => [
      ...prev,
      { role: "user", content: userMsg }
    ]);
    setLoading(true);

    try {
      const res = await fetch("/api/copilot/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: userMsg,
          history: messagesRef.current.slice(1)
        })
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.success && data.response ? data.response : "I apologize, but I encountered an error. Please try again!"
        }
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I'm unable to connect right now. Please try again shortly."
        }
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handle = (e: Event) => {
      const ev = e as CustomEvent;
      setIsOpen(true);
      if (ev.detail?.query) handleSend(ev.detail.query);
    };
    window.addEventListener("open-copilot", handle);
    return () => window.removeEventListener("open-copilot", handle);
  }, [handleSend]);

  const handleReset = () => setMessages([
    {
      role: "assistant",
      content: "Hi! I'm your **DCart Shopping Copilot** 🤖\n\nHow can I help you shop today?"
    }
  ]);

  const parseInline = (text: string) => text
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-lightOrange">$1</strong>')
    .replace(/^\* (.*)/gm, '<li class="ml-4 list-disc text-xs leading-relaxed">$1</li>')
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="text-lightOrange hover:underline font-semibold">$1</a>')
    .replace(/\n/g, "<br />");

  const renderMarkdown = (text: string) => {
    let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    if (html.includes("|")) {
      const lines = html.split("\n");
      let inTable = false;
      let tableHtml = '<div class="overflow-x-auto my-2"><table class="min-w-full text-xs border border-gray-200 dark:border-gray-700 rounded">';
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith("|") && line.endsWith("|")) {
          if (!inTable) {
            inTable = true;
            tableHtml += "<thead>";
          }
          const cells = line.split("|").slice(1, -1);
          if (cells.every((c) => c.trim().match(/^:?-+:?$/))) {
            tableHtml += "</thead><tbody>";
            continue;
          }
          tableHtml += '<tr class="border-b border-gray-100 dark:border-gray-700">';
          for (const cell of cells) {
            const tag = tableHtml.includes("<tbody>") ? "td" : "th";
            tableHtml += `<${tag} class="${tag === "th" ? "px-2 py-1.5 bg-gray-50 dark:bg-gray-800 font-bold text-left" : "px-2 py-1.5 text-left"}">${parseInline(cell.trim())}</${tag}>`;
          }
          tableHtml += "</tr>";
        } else {
          if (inTable) {
            inTable = false;
            tableHtml += "</tbody></table></div>";
            lines[i] = tableHtml + "\n" + lines[i];
            tableHtml = '<div class="overflow-x-auto my-2"><table class="min-w-full text-xs border border-gray-200 dark:border-gray-700 rounded">';
          }
        }
      }
      if (inTable) {
        tableHtml += "</tbody></table></div>";
        html = lines.join("\n") + "\n" + tableHtml;
      } else {
        html = lines.join("\n");
      }
    }
    return (
      <div dangerouslySetInnerHTML={{ __html: parseInline(html) }} />
    );
  };

  // Close when customer support opens
  useEffect(() => {
    const handleClose = () => setIsOpen(false);
    window.addEventListener("close-copilot", handleClose);
    return () => window.removeEventListener("close-copilot", handleClose);
  }, []);

  const toggleOpen = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      window.dispatchEvent(new CustomEvent("close-support"));
    }
  };

  return (
    <>
      <button
        onClick={toggleOpen}
        className="fixed bottom-6 right-6 w-12 h-12 bg-lightOrange text-white rounded-full shadow-lg hover:bg-darkOrange hover:scale-110 active:scale-95 transition-all duration-300 z-40 flex items-center justify-center text-xl"
        title="Open AI Shopping Copilot"
        aria-label="Open DCart Shopping Copilot"
      >
        {isOpen ? <MdClose /> : <MdChat />}
      </button>
      <div
        className={`fixed bottom-20 right-4 sm:right-6 w-[calc(100vw-2rem)] sm:w-[420px] max-h-[550px] sm:max-h-[600px] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-250 dark:border-gray-700/60 z-40 flex flex-col overflow-hidden transition-all duration-300 ease-out origin-bottom-right ${isOpen ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"}`}
        style={{ maxHeight: "calc(100vh - 120px)" }}
      >
        <div className="px-4 py-3 bg-gradient-to-r from-accent to-accent/90 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-white/15 rounded-xl flex items-center justify-center shrink-0">

              <MdAutoAwesome className="text-lightOrange text-base animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-sm leading-tight">AI Shopping Copilot</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                <p className="text-white/65 text-[10px]">Powered by Gemini AI</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleReset}
              className="p-1.5 hover:bg-white/15 rounded-full transition-colors"
              title="Clear chat"
              aria-label="Clear chat"
            >
              <MdRefresh className="text-base" />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 hover:bg-white/15 rounded-full transition-colors"
              aria-label="Close copilot"
            >
              <MdClose className="text-base" />
            </button>
          </div>
        </div>
        <ScrollArea className="flex-1 p-3.5 bg-gray-50/50 dark:bg-gray-900/50 min-h-0">
          <div className="space-y-3.5">
            {messages.map((msg, idx) => {
              const isBot = msg.role === "assistant";
              return (
                <div
                  key={idx}
                  className={`flex gap-2.5 ${isBot ? "items-start" : "items-end flex-row-reverse"} max-w-[88%] ${isBot ? "" : "ml-auto"}`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0 ${isBot ? "bg-lightOrange" : "bg-accent"}`}>
                    {isBot ? <MdSmartToy className="text-xs" /> : <MdPerson className="text-xs" />}
                  </div>
                  <div className={`px-3 py-2.5 rounded-2xl text-xs leading-relaxed shadow-sm ${isBot ? "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-100 dark:border-gray-700 rounded-tl-none" : "bg-accent text-white rounded-tr-none"}`}>
                    {renderMarkdown(msg.content)}
                  </div>
                </div>
              );
            })}
            {loading && (
              <div className="flex gap-2.5 items-start max-w-[88%]">
                <div className="w-7 h-7 rounded-full flex items-center justify-center bg-lightOrange text-white shrink-0 animate-pulse">
                  <MdSmartToy className="text-xs" />
                </div>
                <div className="px-3.5 py-2.5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-tl-none shadow-sm flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-lightOrange rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-lightOrange rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-lightOrange rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
        <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-700/60 bg-white dark:bg-gray-900 flex gap-1.5 overflow-x-auto scrollbar-thin shrink-0">
          {SUGGESTION_CHIPS.map((chip) => (
            <button
              key={chip.label}
              onClick={() => handleSend(chip.query)}
              disabled={loading}
              className="shrink-0 px-2.5 py-1 text-[10px] bg-gray-50 dark:bg-gray-800 text-accent dark:text-gray-200 font-semibold rounded-full border border-gray-200 dark:border-gray-700 hover:border-lightOrange/50 hover:bg-lightOrange/5 transition-colors whitespace-nowrap disabled:opacity-50"
            >
              {chip.label}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
          className="p-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700/60 flex gap-2 items-center shrink-0"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Shopping Copilot…"
            disabled={loading}
            className="flex-1 px-3.5 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-full outline-none focus:border-lightOrange bg-gray-50 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 focus:bg-white dark:focus:bg-gray-800 transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-2 bg-accent dark:bg-lightOrange text-white rounded-full hover:bg-lightOrange disabled:opacity-40 transition-colors flex items-center justify-center"
            aria-label="Send"
          >
            <MdSend className="text-sm" />
          </button>
        </form>
      </div>
    </>
  );
};

export default ShoppingCopilot;
