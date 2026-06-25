"use client";

import React, { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import FormattedPrice from "@/components/FormattedPrice";
import Container from "@/components/Container";

import { getProductImageSrc } from "@/lib/utils";

export default function VisualSearchPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchState, setSearchState] = useState("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [searchMode, setSearchMode] = useState("");

  const performVisualSearch = useCallback(async (file: File) => {
    setSearchState("searching");
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/search/visual?limit=12", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setResults(data.results || []);
        setSearchMode(data.mode || "");
        setSearchState("results");
      } else {
        setErrorMsg(data.error || "Visual search failed. Please try again.");
        setSearchState("error");
      }
    } catch {
      setErrorMsg("Could not connect to visual search service.");
      setSearchState("error");
    }
  }, []);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setErrorMsg("Please upload a valid image file (JPEG, PNG, WEBP).");
      setSearchState("error");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg("Image is too large. Max size is 10MB.");
      setSearchState("error");
      return;
    }
    performVisualSearch(file);
  }, [performVisualSearch]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    e.target.value = "";
  };

  const handleReset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setResults([]);
    setSearchState("idle");
    setErrorMsg("");
  };

  return (
    <Container className="py-10 max-w-4xl min-h-[600px] flex flex-col">
      <div className="flex flex-col gap-2 mb-8 text-center">
        <h1 className="text-3xl font-extrabold text-accent dark:text-zinc-150">Visual Search</h1>
        <p className="text-sm text-lightText dark:text-zinc-400">
          Upload or drag an image here to search for visually similar products in our store catalog.
        </p>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-gray-150 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-xl flex-1 flex flex-col">
        {searchState === "idle" && (
          <div className="p-8 flex-1 flex flex-col justify-center">
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all duration-300 ${
                isDragging
                  ? "border-lightOrange bg-lightOrange/5 scale-[1.01]"
                  : "border-gray-200 dark:border-zinc-700 hover:border-lightOrange/50 hover:bg-gray-50/50 dark:hover:bg-zinc-800/30"
              }`}
            >
              <div className="flex flex-col items-center gap-5">
                <div className={`w-20 h-20 rounded-2xl flex items-center justify-center transition-colors ${isDragging ? "bg-lightOrange/10" : "bg-gray-100 dark:bg-zinc-800"}`}>
                  <svg className={`w-10 h-10 transition-colors ${isDragging ? "text-lightOrange" : "text-gray-400 dark:text-zinc-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div>
                  <p className="text-lg font-bold text-accent dark:text-zinc-200">
                    {isDragging ? "Drop your image here!" : "Drag & Drop or Click to Upload"}
                  </p>
                  <p className="text-xs text-lightText dark:text-zinc-400 mt-1.5">
                    Supports JPG, PNG, WEBP — Max 10MB
                  </p>
                </div>
                <span className="px-6 py-2.5 bg-lightOrange hover:bg-darkOrange text-white text-xs font-bold rounded-full transition-colors uppercase tracking-wider shadow-xs">
                  Browse Image
                </span>
              </div>
            </div>

            <div className="mt-8">
              <p className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
                Try searching with images of:
              </p>
              <div className="flex flex-wrap gap-2.5">
                {["Sneakers", "Laptops", "Phones", "Headphones", "Watches"].map((hint) => (
                  <span
                    key={hint}
                    className="px-4 py-2 bg-gray-50 dark:bg-zinc-800 text-accent dark:text-zinc-200 text-xs font-bold rounded-full border border-gray-150 dark:border-zinc-700 cursor-pointer hover:border-lightOrange hover:text-lightOrange transition-all"
                  >
                    {hint}
                  </span>
                ))}
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleInputChange}
              aria-label="Upload image for visual search"
            />
          </div>
        )}

        {searchState === "searching" && (
          <div className="p-8 flex-1 flex flex-col items-center justify-center gap-6">
            {previewUrl && (
              <div className="relative w-48 h-48 rounded-2xl overflow-hidden shadow-lg border-4 border-lightOrange/20">
                <Image
                  src={previewUrl}
                  alt="Search image preview"
                  fill
                  className="object-cover"
                  sizes="192px"
                  unoptimized
                />
              </div>
            )}
            <div className="flex flex-col items-center gap-4">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 border-4 border-lightOrange/20 rounded-full" />
                <div className="absolute inset-0 border-4 border-transparent border-t-lightOrange rounded-full animate-spin" />
                <div className="absolute inset-2 flex items-center justify-center">
                  <svg className="w-6 h-6 text-lightOrange animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-accent dark:text-zinc-200">Analyzing your image...</p>
                <p className="text-xs text-lightText dark:text-zinc-400 mt-1">CLIP vision model is searching our catalog</p>
              </div>
              <div className="flex gap-2 mt-2">
                {["Encoding image", "Searching catalog", "Ranking results"].map((step, i) => (
                  <span
                    key={step}
                    className="px-3 py-1 text-[10px] bg-lightOrange/10 text-lightOrange font-bold rounded-full animate-pulse uppercase tracking-wider"
                    style={{ animationDelay: `${i * 200}ms` }}
                  >
                    {step}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {searchState === "results" && (
          <div className="p-6 flex-1 flex flex-col">
            <div className="flex flex-col sm:flex-row items-center gap-4 mb-6 p-4 bg-gray-50 dark:bg-zinc-800/50 rounded-2xl border border-gray-150 dark:border-zinc-800">
              {previewUrl && (
                <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 border-2 border-lightOrange/20 shadow-xs">
                  <Image
                    src={previewUrl}
                    alt="Your search image"
                    fill
                    className="object-cover"
                    sizes="80px"
                    unoptimized
                  />
                </div>
              )}
              <div className="flex-1 min-w-0 text-center sm:text-left">
                <p className="text-base font-bold text-accent dark:text-zinc-200">Visually similar products</p>
                <p className="text-xs text-lightText dark:text-zinc-400 mt-0.5">Found {results.length} matches in our catalog</p>
                {searchMode === "popularity_fallback" && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-0.5 font-bold uppercase tracking-wider">AI offline — showing popular products instead</p>
                )}
                {(searchMode === "clip_faiss" || searchMode === "clip_cosine") && (
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-500 mt-0.5 font-bold uppercase tracking-wider">CLIP Vision model search active</p>
                )}
              </div>
              <button
                onClick={handleReset}
                className="shrink-0 px-4 py-2 text-xs font-bold text-lightOrange border border-lightOrange/30 rounded-full hover:bg-lightOrange/5 transition-all uppercase tracking-wider"
              >
                New Search
              </button>
            </div>

            {results.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {results.map((product) => {
                  const slug = typeof product.slug === "object" ? product.slug.current : product.slug;
                  return (
                    <div
                      key={product._id}
                      onClick={() => router.push(`/product/${slug}`)}
                      className="group cursor-pointer bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl overflow-hidden hover:border-lightOrange/40 hover:shadow-md transition-all duration-200"
                    >
                      <div className="relative h-40 bg-gray-50 dark:bg-zinc-850">
                        <Image
                          src={getProductImageSrc(product)}
                          alt={product.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                          unoptimized={typeof product.image === "string"}
                        />
                        {product.quantity <= 0 && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <span className="text-white text-[10px] font-bold uppercase tracking-wider">Out of Stock</span>
                          </div>
                        )}
                      </div>
                      <div className="p-3.5">
                        <p className="text-xs font-bold text-accent dark:text-zinc-200 truncate leading-tight">{product.title}</p>
                        <p className="text-[10px] text-lightText dark:text-zinc-400 mt-0.5 truncate">{product.brand}</p>
                        <p className="text-xs font-extrabold text-darkOrange dark:text-lightOrange mt-1">
                          <FormattedPrice amount={product.price} />
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16 flex-1 flex flex-col items-center justify-center">
                <p className="text-sm font-bold text-accent dark:text-zinc-250">No similar products found</p>
                <p className="text-xs text-lightText dark:text-zinc-400 mt-1">Try uploading a different image or format</p>
                <button
                  onClick={handleReset}
                  className="mt-4 px-6 py-2 bg-lightOrange hover:bg-darkOrange text-white text-xs font-bold rounded-full transition-colors uppercase tracking-wider"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        )}

        {searchState === "error" && (
          <div className="p-8 flex-1 flex flex-col items-center justify-center gap-5 text-center">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-500/10 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-lightRed" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-base font-bold text-accent dark:text-zinc-200">Search Failed</p>
              <p className="text-xs text-lightText dark:text-zinc-400 mt-1 max-w-xs">{errorMsg}</p>
            </div>
            <button
              onClick={handleReset}
              className="px-6 py-2.5 bg-lightOrange hover:bg-darkOrange text-white text-xs font-bold rounded-full transition-colors uppercase tracking-wider"
            >
              Try Again
            </button>
          </div>
        )}

        <div className="px-6 py-3 bg-gray-50 dark:bg-zinc-800/40 border-t border-gray-150 dark:border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-lightOrange animate-pulse" />
            <span className="text-[10px] text-lightText dark:text-zinc-450 font-bold uppercase tracking-wider">
              Powered by CLIP + FAISS Vision AI
            </span>
          </div>
          <span className="text-[10px] text-lightText dark:text-zinc-450 font-bold uppercase">
            AI Vision Search
          </span>
        </div>
      </div>
    </Container>
  );
}