"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CiSearch } from "react-icons/ci";
import { IoMdClose } from "react-icons/io";
import Image from "next/image";
import { urlFor } from "@/sanity/lib/image";
import { ProductData } from "../../types";
import FormattedPrice from "./FormattedPrice";

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
  interface SpeechRecognition extends EventTarget {
    lang: string;
    interimResults: boolean;
    maxAlternatives: number;
    continuous: boolean;
    start(): void;
    stop(): void;
    abort(): void;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onend: (() => void) | null;
    onstart: (() => void) | null;
    onaudiostart: (() => void) | null;
  }
  interface SpeechRecognitionEvent extends Event {
    readonly resultIndex: number;
    readonly results: SpeechRecognitionResultList;
  }
  interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
  }
  interface SpeechRecognitionResult {
    readonly isFinal: boolean;
    readonly length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
  }
  interface SpeechRecognitionAlternative {
    readonly transcript: string;
    readonly confidence: number;
  }
  interface SpeechRecognitionErrorEvent extends Event {
    readonly error: string;
    readonly message: string;
  }
}

type VoiceState = "idle" | "listening" | "processing" | "error";

const SILENCE_TIMEOUT_MS = 2000;
const MAX_LISTEN_MS = 15000;

const SearchInput = () => {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<ProductData[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [voiceError, setVoiceError] = useState("");
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptRef = useRef("");
  const voiceStateRef = useRef<VoiceState>("idle");
  const hasResultRef = useRef(false);
  const intentionalStopRef = useRef(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setVoiceSupported(
        "SpeechRecognition" in window || "webkitSpeechRecognition" in window
      );
    }
  }, []);

  useEffect(() => {
    if (!search.trim()) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setLoading(true);
      setShowDropdown(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(search)}&limit=5`);
        const data = await res.json();
        if (data.success && data.products) {
          setSuggestions(data.products);
          setActiveIndex(-1);
        } else {
          setSuggestions([]);
        }
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(delayDebounce);
  }, [search]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    };
  }, []);

  const handleSearchSubmit = () => {
    if (search.trim()) {
      router.push(`/search?q=${encodeURIComponent(search.trim())}`);
      setShowDropdown(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        const selected = suggestions[activeIndex];
        router.push(`/product/${selected.slug.current}`);
        setSearch("");
        setShowDropdown(false);
      } else {
        handleSearchSubmit();
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  const clearAllTimers = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
  }, []);

  const setStateAndRef = useCallback((state: VoiceState) => {
    setVoiceState(state);
    voiceStateRef.current = state;
  }, []);

  const navigateWithTranscript = useCallback(() => {
    const text = transcriptRef.current.trim();
    if (text) {
      setStateAndRef("processing");
      setTimeout(() => {
        router.push(`/search?q=${encodeURIComponent(text)}&source=voice`);
        setShowDropdown(false);
        setStateAndRef("idle");
      }, 400);
    } else {
      setStateAndRef("idle");
    }
  }, [router, setStateAndRef]);

  const stopVoiceRecognition = useCallback(() => {
    clearAllTimers();
    intentionalStopRef.current = true;
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    navigateWithTranscript();
  }, [clearAllTimers, navigateWithTranscript]);

  const startVoiceRecognition = useCallback(() => {
    if (!voiceSupported) {
      setVoiceError("Voice search is not supported in your browser.");
      setStateAndRef("error");
      setTimeout(() => setStateAndRef("idle"), 3000);
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    clearAllTimers();

    try {
      const SpeechRecognitionAPI =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognitionAPI();

      recognition.lang = "en-IN";
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.continuous = false;

      recognitionRef.current = recognition;
      transcriptRef.current = "";
      hasResultRef.current = false;
      intentionalStopRef.current = false;
      startedRef.current = false;
      setSearch("");
      setVoiceError("");
      setStateAndRef("listening");

      maxTimerRef.current = setTimeout(() => {
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
      }, MAX_LISTEN_MS);

      recognition.onstart = () => {
        startedRef.current = true;
        setStateAndRef("listening");
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        hasResultRef.current = true;

        let finalTranscript = "";
        let interimTranscript = "";

        for (let i = 0; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const combined = (finalTranscript + interimTranscript).trim();
        setSearch(combined);
        transcriptRef.current = combined;

        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }

        if (finalTranscript.trim()) {
          silenceTimerRef.current = setTimeout(() => {
            if (recognitionRef.current && voiceStateRef.current === "listening") {
              recognitionRef.current.stop();
            }
          }, SILENCE_TIMEOUT_MS);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        clearAllTimers();

        if (event.error === "aborted") {
          return;
        }

        if (event.error === "no-speech") {
          setVoiceError("No speech detected. Try again.");
        } else if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setVoiceError("Microphone blocked. Click the lock icon in address bar → allow mic → reload.");
        } else if (event.error === "network") {
          setVoiceError("Network error. Check your connection.");
        } else if (event.error === "audio-capture") {
          setVoiceError("No microphone found. Check your mic is connected.");
        } else {
          setVoiceError("Voice error. Please try again.");
        }

        setStateAndRef("error");
        setTimeout(() => {
          setStateAndRef("idle");
          setVoiceError("");
        }, 4000);
      };

      recognition.onend = () => {
        clearAllTimers();
        recognitionRef.current = null;

        if (intentionalStopRef.current) {
          return;
        }

        if (voiceStateRef.current === "error") {
          return;
        }

        if (!startedRef.current) {
          setVoiceError("Microphone access denied. Click the lock icon in address bar → allow mic → reload the page.");
          setStateAndRef("error");
          setTimeout(() => {
            setStateAndRef("idle");
            setVoiceError("");
          }, 5000);
          return;
        }

        navigateWithTranscript();
      };

      recognition.start();
    } catch {
      setVoiceError("Could not start voice recognition.");
      setStateAndRef("error");
      setTimeout(() => {
        setStateAndRef("idle");
        setVoiceError("");
      }, 3000);
    }
  }, [voiceSupported, clearAllTimers, setStateAndRef, navigateWithTranscript]);

  const handleVoiceButtonClick = useCallback(() => {
    if (voiceState === "listening") {
      stopVoiceRecognition();
    } else if (voiceState === "idle" || voiceState === "error") {
      startVoiceRecognition();
    }
  }, [voiceState, startVoiceRecognition, stopVoiceRecognition]);

  const getVoiceButtonTitle = () => {
    if (!voiceSupported) return "Voice search not supported in this browser";
    switch (voiceState) {
      case "listening":
        return "Click to stop listening";
      case "processing":
        return "Processing…";
      case "error":
        return voiceError || "Voice search error";
      default:
        return "Search by voice";
    }
  };

  const getVoiceButtonColor = () => {
    switch (voiceState) {
      case "listening":
        return "text-lightRed";
      case "processing":
        return "text-lightOrange animate-pulse";
      case "error":
        return "text-gray-300";
      default:
        return voiceSupported
          ? "text-lightText/60 hover:text-lightOrange"
          : "text-gray-300 cursor-not-allowed";
    }
  };

  return (
    <>
      {voiceState === "listening" && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-accent text-white px-5 py-3 rounded-full shadow-2xl animate-fade-in">
          <div className="relative flex items-center justify-center w-6 h-6">
            <span className="absolute inline-flex h-full w-full rounded-full bg-lightRed opacity-75 animate-ping" />
            <span className="relative inline-flex w-3 h-3 rounded-full bg-lightRed" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">Listening…</p>
            <p className="text-[11px] text-white/70 leading-tight">
              {search ? `"${search}"` : "Speak now"}
            </p>
          </div>
          <button
            className="ml-2 px-3 py-1 text-xs bg-white/15 rounded-full hover:bg-white/25 transition-colors font-semibold"
            onClick={stopVoiceRecognition}
          >
            Stop
          </button>
        </div>
      )}

      {voiceState === "error" && voiceError && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-red-600 text-white px-4 py-2.5 rounded-full shadow-xl pointer-events-none text-xs font-medium">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {voiceError}
        </div>
      )}

      <div
        ref={dropdownRef}
        className="relative w-full hidden md:inline-flex flex-1 h-12 text-base items-center gap-2 justify-between"
      >
        <div className="relative w-full h-full flex items-center">
          <CiSearch className="text-lg absolute left-3 text-lightOrange" />

          <input
            type="text"
            placeholder={
              voiceState === "listening"
                ? "Listening…"
                : "Search products..."
            }
            className={`w-full h-full outline-none bg-transparent placeholder:text-lightText border-[1px] rounded-sm pl-9 pr-48 hover:border-lightOrange/50 focus:border-lightOrange/80 hoverEffect transition-colors ${
              voiceState === "listening"
                ? "border-lightRed/60 placeholder:text-lightRed/70"
                : "border-accent/30"
            }`}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (search.trim()) setShowDropdown(true);
            }}
            value={search}
          />

          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-3">
            {search && (
              <IoMdClose
                className="text-accent/50 hover:text-lightRed hoverEffect cursor-pointer text-lg shrink-0"
                onClick={() => {
                  setSearch("");
                  setSuggestions([]);
                  setShowDropdown(false);
                }}
              />
            )}

            <button
              onClick={() => router.push("/visual-search")}
              title="Search by image"
              aria-label="Redirect to visual search"
              className="text-lightText/60 hover:text-lightOrange transition-colors duration-200 shrink-0"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>

            <button
              onClick={handleVoiceButtonClick}
              disabled={!voiceSupported || voiceState === "processing"}
              title={getVoiceButtonTitle()}
              aria-label={getVoiceButtonTitle()}
              className={`transition-all duration-200 shrink-0 ${getVoiceButtonColor()} ${
                voiceState === "listening" ? "scale-110" : ""
              }`}
            >
              {voiceState === "listening" ? (
                <svg className="w-5 h-5 text-lightRed" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
                </svg>
              )}
            </button>

            <button
              onClick={handleSearchSubmit}
              className="bg-lightOrange text-white px-3 py-1.5 text-xs sm:text-sm hover:bg-darkOrange hoverEffect font-medium rounded-sm shrink-0"
            >
              Search
            </button>
          </div>
        </div>

        {showDropdown && (
          <div className="absolute top-14 left-0 right-0 bg-white/90 backdrop-blur-md border border-gray-200/50 shadow-2xl rounded-md overflow-hidden z-50 transition-all duration-300 max-h-[380px] overflow-y-auto">
            {loading ? (
              <div className="p-4 flex flex-col gap-2">
                <div className="h-6 bg-gray-200/50 animate-pulse rounded w-1/3"></div>
                <div className="h-12 bg-gray-200/50 animate-pulse rounded w-full"></div>
                <div className="h-12 bg-gray-200/50 animate-pulse rounded w-full"></div>
              </div>
            ) : suggestions.length > 0 ? (
              <div className="py-2">
                <div className="px-4 py-1 text-xs font-semibold text-lightText/80 tracking-wider border-b border-gray-100/50 mb-1">
                  PRODUCT SUGGESTIONS
                </div>
                {suggestions.map((item, index) => (
                  <div
                    key={item._id}
                    onClick={() => {
                      router.push(`/product/${item.slug.current}`);
                      setSearch("");
                      setShowDropdown(false);
                    }}
                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hoverEffect border-b border-gray-100/30 last:border-0 ${
                      index === activeIndex
                        ? "bg-lightOrange/10 text-lightOrange"
                        : "hover:bg-gray-50/80 text-accent"
                    }`}
                  >
                    <div className="relative w-10 h-10 rounded-md overflow-hidden bg-gray-50 flex-shrink-0 border border-gray-100">
                      <Image
                        src={urlFor(item.image).url()}
                        alt={item.title}
                        fill
                        sizes="40px"
                        className="object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate leading-tight">
                        {item.title}
                      </p>
                      <p className="text-xs text-lightText font-medium mt-0.5">
                        by {item.brand}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-darkOrange">
                        <FormattedPrice amount={item.price} />
                      </p>
                      {item.quantity <= 0 && (
                        <p className="text-[10px] text-lightRed font-semibold mt-0.5 uppercase tracking-wider">
                          Out of Stock
                        </p>
                      )}
                    </div>
                  </div>
                ))}

                <button
                  onClick={() => {
                    setShowDropdown(false);
                    router.push("/visual-search");
                  }}
                  className="w-full px-4 py-2.5 flex items-center gap-2 text-xs text-lightText/70 hover:bg-gray-50/80 hover:text-lightOrange transition-colors border-t border-gray-100/50"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Search by image instead
                </button>
              </div>
            ) : (
              <div className="p-6 text-center text-lightText">
                No products found matching{" "}
                <span className="font-semibold text-accent">
                  &quot;{search}&quot;
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default SearchInput;
