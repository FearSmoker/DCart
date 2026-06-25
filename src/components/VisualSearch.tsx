"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";


import React, { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import FormattedPrice from "./FormattedPrice";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

import { getProductImageSrc } from "@/lib/utils";
const VisualSearch = (param: any)=>{
    const { isOpen, onClose } = param;
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [searchState, setSearchState] = useState("idle");
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [results, setResults] = useState<any[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [searchMode, setSearchMode] = useState("");
    // Reset state when modal closes
    useEffect(()=>{
        if (!isOpen) {
            setSearchState("idle");
            setPreviewUrl(null);
            setResults([]);
            setIsDragging(false);
            setErrorMsg("");
        }
    }, [
        isOpen
    ]);
    const performVisualSearch = useCallback(async (file: any)=>{
        setSearchState("searching");
        // Create preview URL
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch("/api/search/visual?limit=6", {
                method: "POST",
                body: formData
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
        } catch (e) {
            setErrorMsg("Could not connect to visual search service.");
            setSearchState("error");
        }
    }, []);
    const handleFileSelect = useCallback((file: any)=>{
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
    }, [
        performVisualSearch
    ]);
    const handleDrop = useCallback((e: any)=>{
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFileSelect(file);
    }, [
        handleFileSelect
    ]);
    const handleDragOver = useCallback((e: any)=>{
        e.preventDefault();
        setIsDragging(true);
    }, []);
    const handleDragLeave = useCallback(()=>{
        setIsDragging(false);
    }, []);
    const handleInputChange = (e: any)=>{
        let _e_target_files;
        const file = (_e_target_files = e.target.files) === null || _e_target_files === void 0 ? void 0 : _e_target_files[0];
        if (file) handleFileSelect(file);
        // Reset input value so same file can be re-uploaded
        e.target.value = "";
    };
    const handleReset = ()=>{
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        setResults([]);
        setSearchState("idle");
        setErrorMsg("");
    };
    return /*#__PURE__*/ _jsx(Dialog, {
        open: isOpen,
        onOpenChange: (open: any)=>{
            if (!open) onClose();
        },
        children: /*#__PURE__*/ _jsxs(DialogContent, {
            showCloseButton: false,
            className: "max-w-2xl p-0 overflow-hidden bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl gap-0 shadow-2xl",
            children: [
                /*#__PURE__*/ _jsxs(DialogHeader, {
                    className: "bg-gradient-to-r from-accent to-slate-700 px-6 py-4 flex flex-row items-center justify-between shrink-0 space-y-0",
                    children: [
                        /*#__PURE__*/ _jsxs("div", {
                            className: "flex items-center gap-3",
                            children: [
                                /*#__PURE__*/ _jsx("div", {
                                    className: "w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center",
                                    children: /*#__PURE__*/ _jsx("svg", {
                                        className: "w-5 h-5 text-white",
                                        fill: "none",
                                        stroke: "currentColor",
                                        viewBox: "0 0 24 24",
                                        children: /*#__PURE__*/ _jsx("path", {
                                            strokeLinecap: "round",
                                            strokeLinejoin: "round",
                                            strokeWidth: 2,
                                            d: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                        })
                                    })
                                }),
                                /*#__PURE__*/ _jsxs("div", {
                                    children: [
                                        /*#__PURE__*/ _jsx(DialogTitle, {
                                            className: "text-white font-bold text-base leading-tight",
                                            children: "Visual Search"
                                        }),
                                        /*#__PURE__*/ _jsx(DialogDescription, {
                                            className: "text-white/70 text-xs mt-0.5",
                                            children: "Upload an image to find similar products"
                                        })
                                    ]
                                })
                            ]
                        }),
                        /*#__PURE__*/ _jsx("button", {
                            onClick: onClose,
                            className: "w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors",
                            "aria-label": "Close visual search",
                            children: /*#__PURE__*/ _jsx("svg", {
                                className: "w-4 h-4",
                                fill: "none",
                                stroke: "currentColor",
                                viewBox: "0 0 24 24",
                                children: /*#__PURE__*/ _jsx("path", {
                                    strokeLinecap: "round",
                                    strokeLinejoin: "round",
                                    strokeWidth: 2,
                                    d: "M6 18L18 6M6 6l12 12"
                                })
                            })
                        })
                    ]
                }),
                /*#__PURE__*/ _jsxs(ScrollArea, {
                    className: "max-h-[75vh] flex-1",
                    children: [
                        searchState === "idle" && /*#__PURE__*/ _jsxs("div", {
                            className: "p-6",
                            children: [
                                /*#__PURE__*/ _jsx("div", {
                                    onDrop: handleDrop,
                                    onDragOver: handleDragOver,
                                    onDragLeave: handleDragLeave,
                                    onClick: ()=>{
                                        let _fileInputRef_current;
                                        return (_fileInputRef_current = fileInputRef.current) === null || _fileInputRef_current === void 0 ? void 0 : _fileInputRef_current.click();
                                    },
                                    className: "border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 ".concat(isDragging ? "border-lightOrange bg-lightOrange/5 scale-[1.01]" : "border-gray-200 hover:border-lightOrange/50 hover:bg-gray-50"),
                                    children: /*#__PURE__*/ _jsxs("div", {
                                        className: "flex flex-col items-center gap-4",
                                        children: [
                                            /*#__PURE__*/ _jsx("div", {
                                                className: "w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ".concat(isDragging ? "bg-lightOrange/10" : "bg-gray-100"),
                                                children: /*#__PURE__*/ _jsx("svg", {
                                                    className: "w-8 h-8 transition-colors ".concat(isDragging ? "text-lightOrange" : "text-gray-400"),
                                                    fill: "none",
                                                    stroke: "currentColor",
                                                    viewBox: "0 0 24 24",
                                                    children: /*#__PURE__*/ _jsx("path", {
                                                        strokeLinecap: "round",
                                                        strokeLinejoin: "round",
                                                        strokeWidth: 1.5,
                                                        d: "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                                                    })
                                                })
                                            }),
                                            /*#__PURE__*/ _jsxs("div", {
                                                children: [
                                                    /*#__PURE__*/ _jsx("p", {
                                                        className: "text-base font-semibold text-accent",
                                                        children: isDragging ? "Drop your image here!" : "Drag & Drop or Click to Upload"
                                                    }),
                                                    /*#__PURE__*/ _jsx("p", {
                                                        className: "text-sm text-lightText mt-1",
                                                        children: "Supports JPG, PNG, WEBP — Max 10MB"
                                                    })
                                                ]
                                            }),
                                            /*#__PURE__*/ _jsx("span", {
                                                className: "px-4 py-2 bg-lightOrange text-white text-sm font-semibold rounded-full hover:bg-darkOrange transition-colors",
                                                children: "Browse Image"
                                            })
                                        ]
                                    })
                                }),
                                /*#__PURE__*/ _jsxs("div", {
                                    className: "mt-5",
                                    children: [
                                        /*#__PURE__*/ _jsx("p", {
                                            className: "text-xs font-semibold text-lightText uppercase tracking-wider mb-3",
                                            children: "Try searching with images of:"
                                        }),
                                        /*#__PURE__*/ _jsx("div", {
                                            className: "flex flex-wrap gap-2",
                                            children: [
                                                "Sneakers",
                                                "Laptops",
                                                "Phones",
                                                "Headphones",
                                                "Watches"
                                            ].map((hint)=>/*#__PURE__*/ _jsx("span", {
                                                    className: "px-3 py-1.5 bg-bgLight text-accent text-xs font-medium rounded-full border border-gray-200",
                                                    children: hint
                                                }, hint))
                                        })
                                    ]
                                }),
                                /*#__PURE__*/ _jsx("input", {
                                    ref: fileInputRef,
                                    type: "file",
                                    accept: "image/*",
                                    className: "hidden",
                                    onChange: handleInputChange,
                                    "aria-label": "Upload image for visual search"
                                })
                            ]
                        }),
                        searchState === "searching" && /*#__PURE__*/ _jsxs("div", {
                            className: "p-6 flex flex-col items-center gap-6",
                            children: [
                                previewUrl && /*#__PURE__*/ _jsx("div", {
                                    className: "relative w-40 h-40 rounded-2xl overflow-hidden shadow-lg border-4 border-lightOrange/20",
                                    children: /*#__PURE__*/ _jsx(Image, {
                                        src: previewUrl,
                                        alt: "Search image preview",
                                        fill: true,
                                        className: "object-cover",
                                        sizes: "160px",
                                        unoptimized: true
                                    })
                                }),
                                /*#__PURE__*/ _jsxs("div", {
                                    className: "flex flex-col items-center gap-3",
                                    children: [
                                        /*#__PURE__*/ _jsxs("div", {
                                            className: "relative w-16 h-16",
                                            children: [
                                                /*#__PURE__*/ _jsx("div", {
                                                    className: "absolute inset-0 border-4 border-lightOrange/20 rounded-full"
                                                }),
                                                /*#__PURE__*/ _jsx("div", {
                                                    className: "absolute inset-0 border-4 border-transparent border-t-lightOrange rounded-full animate-spin"
                                                }),
                                                /*#__PURE__*/ _jsx("div", {
                                                    className: "absolute inset-2 flex items-center justify-center",
                                                    children: /*#__PURE__*/ _jsx("svg", {
                                                        className: "w-6 h-6 text-lightOrange animate-pulse",
                                                        fill: "none",
                                                        stroke: "currentColor",
                                                        viewBox: "0 0 24 24",
                                                        children: /*#__PURE__*/ _jsx("path", {
                                                            strokeLinecap: "round",
                                                            strokeLinejoin: "round",
                                                            strokeWidth: 2,
                                                            d: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                                                        })
                                                    })
                                                })
                                            ]
                                        }),
                                        /*#__PURE__*/ _jsxs("div", {
                                            className: "text-center",
                                            children: [
                                                /*#__PURE__*/ _jsx("p", {
                                                    className: "text-sm font-semibold text-accent",
                                                    children: "Analyzing your image..."
                                                }),
                                                /*#__PURE__*/ _jsx("p", {
                                                    className: "text-xs text-lightText mt-1",
                                                    children: "CLIP vision model is finding similar products"
                                                })
                                            ]
                                        }),
                                        /*#__PURE__*/ _jsx("div", {
                                            className: "flex gap-1.5 mt-1",
                                            children: [
                                                "Encoding image",
                                                "Searching catalog",
                                                "Ranking results"
                                            ].map((step, i)=>/*#__PURE__*/ _jsx("span", {
                                                    className: "px-2.5 py-1 text-[10px] bg-lightOrange/10 text-lightOrange font-medium rounded-full animate-pulse",
                                                    style: {
                                                        animationDelay: `${i * 200}ms`
                                                    },
                                                    children: step
                                                }, step))
                                        })
                                    ]
                                })
                            ]
                        }),
                        searchState === "results" && /*#__PURE__*/ _jsxs("div", {
                            className: "p-5",
                            children: [
                                /*#__PURE__*/ _jsxs("div", {
                                    className: "flex items-center gap-4 mb-5 p-3 bg-gray-50 rounded-xl border border-gray-100",
                                    children: [
                                        previewUrl && /*#__PURE__*/ _jsx("div", {
                                            className: "relative w-16 h-16 rounded-xl overflow-hidden shrink-0 border-2 border-lightOrange/20",
                                            children: /*#__PURE__*/ _jsx(Image, {
                                                src: previewUrl,
                                                alt: "Your search image",
                                                fill: true,
                                                className: "object-cover",
                                                sizes: "64px",
                                                unoptimized: true
                                            })
                                        }),
                                        /*#__PURE__*/ _jsxs("div", {
                                            className: "flex-1 min-w-0",
                                            children: [
                                                /*#__PURE__*/ _jsx("p", {
                                                    className: "text-sm font-semibold text-accent",
                                                    children: "Visually similar products"
                                                }),
                                                /*#__PURE__*/ _jsxs("p", {
                                                    className: "text-xs text-lightText mt-0.5",
                                                    children: [
                                                        "Found ",
                                                        results.length,
                                                        " matches"
                                                    ]
                                                }),
                                                searchMode === "popularity_fallback" && /*#__PURE__*/ _jsx("p", {
                                                    className: "text-[10px] text-amber-600 mt-0.5 font-medium",
                                                    children: "AI offline — showing popular products instead"
                                                }),
                                                (searchMode === "clip_faiss" || searchMode === "clip_cosine") && /*#__PURE__*/ _jsxs("p", {
                                                    className: "text-[10px] text-emerald-600 mt-0.5 font-medium",
                                                    children: [
                                                        "CLIP vision model",
                                                        searchMode === "clip_faiss" ? " + FAISS" : "",
                                                        " search"
                                                    ]
                                                })
                                            ]
                                        }),
                                        /*#__PURE__*/ _jsx("button", {
                                            onClick: handleReset,
                                            className: "shrink-0 px-3 py-1.5 text-xs font-semibold text-lightOrange border border-lightOrange/30 rounded-full hover:bg-lightOrange/5 transition-colors",
                                            children: "New Search"
                                        })
                                    ]
                                }),
                                results.length > 0 ? /*#__PURE__*/ _jsx("div", {
                                    className: "grid grid-cols-2 sm:grid-cols-3 gap-3",
                                    children: results.map((product)=>/*#__PURE__*/ _jsxs("div", {
                                            onClick: ()=>{
                                                const slug = typeof product.slug === "object" ? product.slug.current : product.slug;
                                                router.push("/product/".concat(slug));
                                                onClose();
                                            },
                                            className: "group cursor-pointer bg-white border border-gray-100 rounded-xl overflow-hidden hover:border-lightOrange/40 hover:shadow-md transition-all duration-200",
                                            children: [
                                                /*#__PURE__*/ _jsxs("div", {
                                                    className: "relative h-32 bg-gray-50",
                                                    children: [
                                                        /*#__PURE__*/ _jsx(Image, {
                                                            src: getProductImageSrc(product),
                                                            alt: product.title,
                                                            fill: true,
                                                            className: "object-cover group-hover:scale-105 transition-transform duration-300",
                                                            sizes: "(max-width: 640px) 50vw, 33vw",
                                                            unoptimized: typeof product.image === "string"
                                                        }),
                                                        product.quantity <= 0 && /*#__PURE__*/ _jsx("div", {
                                                            className: "absolute inset-0 bg-black/50 flex items-center justify-center",
                                                            children: /*#__PURE__*/ _jsx("span", {
                                                                className: "text-white text-[10px] font-bold uppercase tracking-wider",
                                                                children: "Out of Stock"
                                                            })
                                                        })
                                                    ]
                                                }),
                                                /*#__PURE__*/ _jsxs("div", {
                                                    className: "p-2.5",
                                                    children: [
                                                        /*#__PURE__*/ _jsx("p", {
                                                            className: "text-xs font-semibold text-accent truncate leading-tight",
                                                            children: product.title
                                                        }),
                                                        /*#__PURE__*/ _jsx("p", {
                                                            className: "text-[10px] text-lightText mt-0.5 truncate",
                                                            children: product.brand
                                                        }),
                                                        /*#__PURE__*/ _jsx("p", {
                                                            className: "text-xs font-bold text-darkOrange mt-1",
                                                            children: /*#__PURE__*/ _jsx(FormattedPrice, {
                                                                amount: product.price
                                                            })
                                                        })
                                                    ]
                                                })
                                            ]
                                        }, product._id))
                                }) : /*#__PURE__*/ _jsxs("div", {
                                    className: "text-center py-10",
                                    children: [
                                        /*#__PURE__*/ _jsx("p", {
                                            className: "text-sm font-semibold text-accent",
                                            children: "No similar products found"
                                        }),
                                        /*#__PURE__*/ _jsx("p", {
                                            className: "text-xs text-lightText mt-1",
                                            children: "Try uploading a different image"
                                        }),
                                        /*#__PURE__*/ _jsx("button", {
                                            onClick: handleReset,
                                            className: "mt-4 px-4 py-2 bg-lightOrange text-white text-sm font-semibold rounded-full hover:bg-darkOrange transition-colors",
                                            children: "Try Again"
                                        })
                                    ]
                                })
                            ]
                        }),
                        searchState === "error" && /*#__PURE__*/ _jsxs("div", {
                            className: "p-6 flex flex-col items-center gap-4 text-center",
                            children: [
                                /*#__PURE__*/ _jsx("div", {
                                    className: "w-14 h-14 bg-red-50 rounded-full flex items-center justify-center",
                                    children: /*#__PURE__*/ _jsx("svg", {
                                        className: "w-7 h-7 text-lightRed",
                                        fill: "none",
                                        stroke: "currentColor",
                                        viewBox: "0 0 24 24",
                                        children: /*#__PURE__*/ _jsx("path", {
                                            strokeLinecap: "round",
                                            strokeLinejoin: "round",
                                            strokeWidth: 2,
                                            d: "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                        })
                                    })
                                }),
                                /*#__PURE__*/ _jsxs("div", {
                                    children: [
                                        /*#__PURE__*/ _jsx("p", {
                                            className: "text-sm font-semibold text-accent",
                                            children: "Search Failed"
                                        }),
                                        /*#__PURE__*/ _jsx("p", {
                                            className: "text-xs text-lightText mt-1 max-w-xs",
                                            children: errorMsg
                                        })
                                    ]
                                }),
                                /*#__PURE__*/ _jsx("button", {
                                    onClick: handleReset,
                                    className: "px-5 py-2 bg-lightOrange text-white text-sm font-semibold rounded-full hover:bg-darkOrange transition-colors",
                                    children: "Try Again"
                                })
                            ]
                        })
                    ]
                }),
                /*#__PURE__*/ _jsxs("div", {
                    className: "px-5 py-3 bg-gray-50 dark:bg-zinc-850 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between shrink-0",
                    children: [
                        /*#__PURE__*/ _jsxs("div", {
                            className: "flex items-center gap-1.5",
                            children: [
                                /*#__PURE__*/ _jsx("div", {
                                    className: "w-1.5 h-1.5 rounded-full bg-lightOrange animate-pulse"
                                }),
                                /*#__PURE__*/ _jsx("span", {
                                    className: "text-[10px] text-lightText dark:text-zinc-400 font-medium",
                                    children: "Powered by CLIP + FAISS Vision AI"
                                })
                            ]
                        }),
                        /*#__PURE__*/ _jsx("span", {
                            className: "text-[10px] text-lightText dark:text-zinc-400",
                            children: "AI Vision Search"
                        })
                    ]
                })
            ]
        })
    });
};
export default VisualSearch;
