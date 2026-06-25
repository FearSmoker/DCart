"use client";

import React, { useState } from "react";
import { MdAutoAwesome, MdSend } from "react-icons/md";
import { ProductData } from "../../types";

interface Props {
  product: ProductData;
}

const AskCopilotPrompt = ({ product }: Props) => {
  const [query, setQuery] = useState("");

  const titleLower = product.title.toLowerCase();

  // tailored suggestions based on product type
  const getSuggestions = () => {
    const defaultSuggestions = [
      "Is it under warranty?",
      "What are the main features?",
      "Is it good value for money?",
      "What is the return policy?"
    ];

    if (titleLower.includes("phone") || titleLower.includes("iphone") || titleLower.includes("pixel") || titleLower.includes("galaxy")) {
      return [
        "What is the camera megapixel size?",
        "How long does the battery last?",
        "Does it support 5G connectivity?",
        "Is a charger included in the box?"
      ];
    } else if (titleLower.includes("laptop") || titleLower.includes("macbook") || titleLower.includes("legion") || titleLower.includes("strix")) {
      return [
        "What processor and graphics card does it have?",
        "Can the RAM and storage be upgraded?",
        "How is the thermal/heating performance?",
        "What ports (USB, HDMI) are available?"
      ];
    } else if (titleLower.includes("audio") || titleLower.includes("earbud") || titleLower.includes("headphone") || titleLower.includes("speaker")) {
      return [
        "Does it have active noise cancellation (ANC)?",
        "What is the battery life of the charging case?",
        "Is it waterproof or dustproof?",
        "How heavy is it to wear for long periods?"
      ];
    } else if (titleLower.includes("watch")) {
      return [
        "Does it support GPS and activity tracking?",
        "What is the battery life on a single charge?",
        "Is it compatible with both iOS and Android?",
        "Does it measure blood oxygen and heart rate?"
      ];
    } else if (titleLower.includes("kadai") || titleLower.includes("pan") || titleLower.includes("iron")) {
      return [
        "Can it be used on an induction hob?",
        "What is the diameter and weight?",
        "Is it oven safe?",
        "How do I season and clean this?"
      ];
    } else if (titleLower.includes("shoes") || titleLower.includes("ultraboot") || titleLower.includes("retro")) {
      return [
        "Are these suitable for long-distance running?",
        "Do these run true to size or smaller?",
        "What material is the upper mesh made of?",
        "Is the sole non-slip/Continental rubber?"
      ];
    }

    return defaultSuggestions;
  };

  const handleAsk = (question: string) => {
    if (!question.trim()) return;

    // open copilot and send query contextually...
    const fullQuery = `Regarding the product "${product.title}": ${question.trim()}`;
    window.dispatchEvent(
      new CustomEvent("open-copilot", {
        detail: { query: fullQuery }
      })
    );
    setQuery("");
  };

  return (
    <div className="border border-orange-200/50 bg-gradient-to-br from-orange-50/20 via-white to-gray-50/50 p-5 rounded-3xl mt-4 shadow-xs">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 bg-orange-100/60 rounded-xl text-orange-500 shrink-0">
          <MdAutoAwesome className="text-base animate-pulse" />
        </div>
        <div>
          <h4 className="text-xs font-black text-accent uppercase tracking-wider">Ask Shopping Copilot</h4>
          <p className="text-[10px] text-lightText font-medium">Get instant AI insights about this product specifications and care</p>
        </div>
      </div>

      {/* Suggestion Chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {getSuggestions().map((suggestion, index) => (
          <button
            key={index}
            onClick={() => handleAsk(suggestion)}
            className="px-3.5 py-1.5 text-[10px] bg-white text-gray-700 font-extrabold rounded-full border border-gray-200 hover:border-orange-500/40 hover:bg-orange-50/5 hoverEffect duration-200 text-left shadow-2xs"
          >
            {suggestion}
          </button>
        ))}
      </div>

      {/* Query input box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAsk(query);
        }}
        className="flex items-center gap-2 bg-white border border-gray-200 p-1.5 rounded-full shadow-2xs focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-500/10 hoverEffect duration-200"
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask something else about this item..."
          className="flex-1 px-4 py-2 text-xs outline-none bg-transparent placeholder:text-lightText text-accent font-medium"
        />
        <button
          type="submit"
          disabled={!query.trim()}
          className="p-2.5 bg-accent text-white rounded-full hover:bg-orange-500 disabled:opacity-50 hoverEffect duration-300 flex items-center justify-center text-sm"
          title="Ask Copilot"
        >
          <MdSend />
        </button>
      </form>
    </div>
  );
};

export default AskCopilotPrompt;
