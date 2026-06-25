"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ProductData } from "../../types";
import FormattedPrice from "./FormattedPrice";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { ScrollArea } from "./ui/scroll-area";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";

// ─── Context for global compare state ────────────────────────────────────────
interface CompareContextType {
  compareItems: ProductData[];
  addToCompare: (product: ProductData) => void;
  removeFromCompare: (id: string) => void;
  clearCompare: () => void;
  isInCompare: (id: string) => boolean;
  openModal: () => void;
}

const CompareContext = createContext<CompareContextType>({
  compareItems: [],
  addToCompare: () => {},
  removeFromCompare: () => {},
  clearCompare: () => {},
  isInCompare: () => false,
  openModal: () => {},
});

export const useCompare = ()=>useContext(CompareContext);
// ─── Helper ───────────────────────────────────────────────────────────────────
function getProductImageSrc(product: any) {
    try {
        const img = product.image;
        if (typeof img === "string") return img;
        return "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=300&auto=format&fit=crop";
    } catch (e) {
        return "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=300&auto=format&fit=crop";
    }
}
// ─── Main Component ───────────────────────────────────────────────────────────
const ProductComparisonProvider = (param: any) =>{
    const { children } = param;
    const router = useRouter();
    const [compareItems, setCompareItems] = useState<any[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [showTray, setShowTray] = useState(false);
    const [comparison, setComparison] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [comparisonMode, setComparisonMode] = useState("");
    const [error, setError] = useState("");
    useEffect(()=>{
        setShowTray(compareItems.length > 0);
        if (compareItems.length === 0) {
            setShowModal(false);
            setComparison(null);
        }
    }, [
        compareItems
    ]);
    const addToCompare = useCallback((product: any) =>{
        setCompareItems((prev)=>{
            if (prev.find((p)=>p._id === product._id)) return prev;
            if (prev.length >= 4) {
                // Replace oldest
                return [
                    ...prev.slice(1),
                    product
                ];
            }
            return [
                ...prev,
                product
            ];
        });
    }, []);
    const removeFromCompare = useCallback((id: any) =>{
        setCompareItems((prev)=>prev.filter((p)=>p._id !== id));
    }, []);
    const clearCompare = useCallback(()=>{
        setCompareItems([]);
        setComparison(null);
        setShowModal(false);
    }, []);
    const isInCompare = useCallback((id: any) =>compareItems.some((p: any) =>p._id === id), [
        compareItems
    ]);
    const runComparison = useCallback(async () => {
        if (compareItems.length < 2) return;
        setLoading(true);
        setError("");
        setComparison(null);
        try {
            const res = await fetch("/api/agent/compare", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    product_ids: compareItems.map((p: any) => p._id),
                    query: `Compare these ${compareItems.length} products and give a clear recommendation.`
                })
            });
            const data = await res.json();
            if (data.success && data.comparison) {
                setComparison(data.comparison);
                setComparisonMode(data.mode || "");
            } else {
                setError(data.error || "Comparison failed. Please try again.");
            }
        } catch {
            setError("Could not connect to comparison service.");
        } finally {
            setLoading(false);
        }
    }, [compareItems]);

    const openModal = useCallback(() => {
        if (compareItems.length >= 2) {
            setShowModal(true);
            runComparison();
        }
    }, [compareItems, runComparison]);
    const handleProductClick = (product: any) =>{
        const slug = typeof product.slug === "object" ? product.slug.current : product.slug;
        router.push(`/product/${slug}`);
        setShowModal(false);
    };
    const contextValue = {
        compareItems,
        addToCompare,
        removeFromCompare,
        clearCompare,
        isInCompare,
        openModal
    };
    return /*#__PURE__*/ _jsxs(CompareContext.Provider, {
        value: contextValue,
        children: [
            children,
            /*#__PURE__*/ _jsx("div", {
                className: "fixed bottom-0 left-0 right-0 z-40 bg-accent text-white transition-transform duration-300 ".concat(showTray ? "translate-y-0" : "translate-y-full"),
                children: /*#__PURE__*/ _jsxs("div", {
                    className: "w-full px-4 sm:px-6 md:px-8 py-2.5 flex items-center gap-4",
                    children: [
                        /*#__PURE__*/ _jsxs("div", {
                            className: "flex items-center gap-2 shrink-0",
                            children: [
                                /*#__PURE__*/ _jsx("svg", {
                                    className: "w-5 h-5 text-lightOrange",
                                    fill: "none",
                                    stroke: "currentColor",
                                    viewBox: "0 0 24 24",
                                    children: /*#__PURE__*/ _jsx("path", {
                                        strokeLinecap: "round",
                                        strokeLinejoin: "round",
                                        strokeWidth: 2,
                                        d: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                                    })
                                }),
                                /*#__PURE__*/ _jsxs("span", {
                                    className: "text-sm font-bold text-white hidden sm:block",
                                    children: [
                                        "Compare (",
                                        compareItems.length,
                                        "/4)"
                                    ]
                                })
                            ]
                        }),
                        /*#__PURE__*/ _jsxs("div", {
                            className: "flex-1 flex items-center gap-3 overflow-x-auto",
                            children: [
                                compareItems.map((p: any) =>/*#__PURE__*/ _jsxs("div", {
                                        className: "relative flex items-center gap-1.5 bg-white/10 rounded-lg px-2.5 py-1.5 shrink-0",
                                        children: [
                                            /*#__PURE__*/ _jsx("div", {
                                                className: "relative w-7 h-7 rounded overflow-hidden bg-white/10",
                                                children: /*#__PURE__*/ _jsx(Image, {
                                                    src: getProductImageSrc(p),
                                                    alt: p.title,
                                                    fill: true,
                                                    className: "object-cover",
                                                    sizes: "28px",
                                                    unoptimized: typeof p.image === "string"
                                                })
                                            }),
                                            /*#__PURE__*/ _jsx("span", {
                                                className: "text-xs font-medium text-white max-w-[80px] truncate",
                                                children: p.title
                                            }),
                                            /*#__PURE__*/ _jsx("button", {
                                                onClick: ()=>removeFromCompare(p._id),
                                                className: "ml-1 text-white/60 hover:text-white transition-colors",
                                                "aria-label": "Remove ".concat(p.title, " from compare"),
                                                children: /*#__PURE__*/ _jsx("svg", {
                                                    className: "w-3.5 h-3.5",
                                                    fill: "none",
                                                    stroke: "currentColor",
                                                    viewBox: "0 0 24 24",
                                                    children: /*#__PURE__*/ _jsx("path", {
                                                        strokeLinecap: "round",
                                                        strokeLinejoin: "round",
                                                        strokeWidth: 2.5,
                                                        d: "M6 18L18 6M6 6l12 12"
                                                    })
                                                })
                                            })
                                        ]
                                    }, p._id)),
                                Array.from({
                                    length: Math.max(0, 2 - compareItems.length)
                                }).map((_, i)=>/*#__PURE__*/ _jsx("div", {
                                        className: "w-24 h-9 border-2 border-dashed border-white/20 rounded-lg flex items-center justify-center text-white/30 text-xs shrink-0",
                                        children: "+ Add"
                                    }, `empty-${i}`))
                            ]
                        }),
                        /*#__PURE__*/ _jsxs("div", {
                            className: "flex items-center gap-2 shrink-0",
                            children: [
                                compareItems.length >= 2 && /*#__PURE__*/ _jsx("button", {
                                    onClick: ()=>{
                                        setShowModal(true);
                                        runComparison();
                                    },
                                    className: "px-3.5 py-1.5 bg-lightOrange text-white text-sm font-bold rounded-lg hover:bg-darkOrange transition-colors",
                                    children: "Compare Now"
                                }),
                                /*#__PURE__*/ _jsx("button", {
                                    onClick: clearCompare,
                                    className: "px-2.5 py-1.5 text-white/60 hover:text-white text-sm font-medium transition-colors",
                                    children: "Clear"
                                })
                            ]
                        })
                    ]
                })
            }),
            /*#__PURE__*/ _jsx(Dialog, {
                open: showModal,
                onOpenChange: (open: any)=>{
                    if (!open) setShowModal(false);
                },
                children: /*#__PURE__*/ _jsxs(DialogContent, {
                    showCloseButton: false,
                    className: "max-w-5xl p-0 overflow-hidden bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl gap-0 shadow-2xl",
                    children: [
                        /*#__PURE__*/ _jsxs(DialogHeader, {
                            className: "bg-gradient-to-r from-accent to-slate-800 px-5 py-4 flex flex-row items-center justify-between shrink-0 space-y-0",
                            children: [
                                /*#__PURE__*/ _jsxs("div", {
                                    className: "flex items-center gap-3",
                                    children: [
                                        /*#__PURE__*/ _jsx("div", {
                                            className: "w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center",
                                            children: /*#__PURE__*/ _jsx("svg", {
                                                className: "w-5 h-5 text-lightOrange",
                                                fill: "none",
                                                stroke: "currentColor",
                                                viewBox: "0 0 24 24",
                                                children: /*#__PURE__*/ _jsx("path", {
                                                    strokeLinecap: "round",
                                                    strokeLinejoin: "round",
                                                    strokeWidth: 2,
                                                    d: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                                                })
                                            })
                                        }),
                                        /*#__PURE__*/ _jsxs("div", {
                                            children: [
                                                /*#__PURE__*/ _jsx(DialogTitle, {
                                                    className: "text-white font-bold text-base leading-tight",
                                                    children: "AI Product Comparison"
                                                }),
                                                /*#__PURE__*/ _jsx(DialogDescription, {
                                                    className: "text-white/70 text-xs mt-0.5",
                                                    children: (comparison === null || comparison === void 0 ? void 0 : comparison.headline) || `Comparing ${compareItems.length} products...`
                                                })
                                            ]
                                        })
                                    ]
                                }),
                                /*#__PURE__*/ _jsx("button", {
                                    onClick: ()=>setShowModal(false),
                                    className: "w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors",
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
                                loading && /*#__PURE__*/ _jsxs("div", {
                                    className: "flex flex-col items-center justify-center py-16 gap-4",
                                    children: [
                                        /*#__PURE__*/ _jsxs("div", {
                                            className: "relative w-14 h-14",
                                            children: [
                                                /*#__PURE__*/ _jsx("div", {
                                                    className: "absolute inset-0 border-4 border-lightOrange/20 rounded-full"
                                                }),
                                                /*#__PURE__*/ _jsx("div", {
                                                    className: "absolute inset-0 border-4 border-transparent border-t-lightOrange rounded-full animate-spin"
                                                })
                                            ]
                                        }),
                                        /*#__PURE__*/ _jsx("p", {
                                            className: "text-sm font-semibold text-accent",
                                            children: "AI Agent is analyzing products…"
                                        }),
                                        /*#__PURE__*/ _jsx("div", {
                                            className: "flex gap-2 flex-wrap justify-center",
                                            children: [
                                                "fetch_products",
                                                "generate_comparison",
                                                "rank_results"
                                            ].map((t, i)=>/*#__PURE__*/ _jsx("span", {
                                                    className: "px-2.5 py-1 text-[10px] bg-lightOrange/10 text-lightOrange font-medium rounded-full animate-pulse",
                                                    style: {
                                                        animationDelay: `${i * 200}ms`
                                                    },
                                                    children: t
                                                }, t))
                                        })
                                    ]
                                }),
                                error && !loading && /*#__PURE__*/ _jsxs("div", {
                                    className: "p-8 text-center",
                                    children: [
                                        /*#__PURE__*/ _jsx("p", {
                                            className: "text-lightRed font-semibold",
                                            children: error
                                        }),
                                        /*#__PURE__*/ _jsx("button", {
                                            onClick: runComparison,
                                            className: "mt-4 px-5 py-2 bg-lightOrange text-white rounded-full text-sm font-semibold hover:bg-darkOrange transition-colors",
                                            children: "Retry"
                                        })
                                    ]
                                }),
                                comparison && !loading && /*#__PURE__*/ _jsxs("div", {
                                    className: "p-5 space-y-6",
                                    children: [
                                        /*#__PURE__*/ _jsxs("div", {
                                            className: "grid gap-4",
                                            style: {
                                                gridTemplateColumns: `160px repeat(${compareItems.length}, 1fr)`
                                            },
                                            children: [
                                                /*#__PURE__*/ _jsx("div", {}),
                                                compareItems.map((p: any) =>{
                                                    const isRecommended = p._id === comparison.recommended_id;
                                                    return /*#__PURE__*/ _jsxs("div", {
                                                        onClick: ()=>handleProductClick(p),
                                                        className: "relative rounded-xl border-2 p-3 text-center cursor-pointer transition-all duration-200 hover:shadow-md ".concat(isRecommended ? "border-lightOrange bg-lightOrange/5" : "border-gray-100 bg-white hover:border-gray-200"),
                                                        children: [
                                                            isRecommended && /*#__PURE__*/ _jsx("div", {
                                                                className: "absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-lightOrange text-white text-[10px] font-bold rounded-full whitespace-nowrap",
                                                                children: "RECOMMENDED"
                                                            }),
                                                            /*#__PURE__*/ _jsx("div", {
                                                                className: "relative w-16 h-16 mx-auto mb-2 rounded-lg overflow-hidden bg-gray-50",
                                                                children: /*#__PURE__*/ _jsx(Image, {
                                                                    src: getProductImageSrc(p),
                                                                    alt: p.title,
                                                                    fill: true,
                                                                    className: "object-cover",
                                                                    sizes: "64px",
                                                                    unoptimized: typeof p.image === "string"
                                                                })
                                                            }),
                                                            /*#__PURE__*/ _jsx("p", {
                                                                className: "text-xs font-bold text-accent line-clamp-2 leading-tight",
                                                                children: p.title
                                                            }),
                                                            /*#__PURE__*/ _jsx("p", {
                                                                className: "text-[10px] text-lightText mt-0.5",
                                                                children: p.brand
                                                            }),
                                                            /*#__PURE__*/ _jsx("p", {
                                                                className: "text-sm font-bold text-darkOrange mt-1",
                                                                children: /*#__PURE__*/ _jsx(FormattedPrice, {
                                                                    amount: p.price
                                                                })
                                                            }),
                                                            /*#__PURE__*/ _jsx("button", {
                                                                onClick: (e: any)=>{
                                                                    e.stopPropagation();
                                                                    removeFromCompare(p._id);
                                                                },
                                                                className: "absolute top-1.5 right-1.5 w-5 h-5 bg-gray-100 hover:bg-red-50 rounded-full flex items-center justify-center text-gray-400 hover:text-lightRed transition-colors",
                                                                children: /*#__PURE__*/ _jsx("svg", {
                                                                    className: "w-3 h-3",
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
                                                    }, p._id);
                                                })
                                            ]
                                        }),
                                        comparison.features_table.length > 0 && /*#__PURE__*/ _jsxs("div", {
                                            className: "rounded-xl border border-gray-100 overflow-hidden",
                                            children: [
                                                /*#__PURE__*/ _jsx("div", {
                                                    className: "px-4 py-2.5 bg-gray-50 border-b border-gray-100",
                                                    children: /*#__PURE__*/ _jsx("p", {
                                                        className: "text-xs font-bold text-lightText uppercase tracking-wider",
                                                        children: "Feature Comparison"
                                                    })
                                                }),
                                                comparison.features_table.map((row: any, i: any) =>/*#__PURE__*/ _jsxs("div", {
                                                        className: "grid gap-4 px-4 py-2.5 items-center ".concat(i % 2 === 0 ? "bg-white" : "bg-gray-50/50"),
                                                        style: {
                                                            gridTemplateColumns: `160px repeat(${compareItems.length}, 1fr)`
                                                        },
                                                        children: [
                                                            /*#__PURE__*/ _jsx("span", {
                                                                className: "text-xs font-semibold text-lightText",
                                                                children: row.feature
                                                            }),
                                                            compareItems.map((p: any) =>/*#__PURE__*/ {
                                                                let _row_values;
                                                                let _row_values_p_title;
                                                                return _jsx("span", {
                                                                    className: "text-xs font-medium text-accent text-center",
                                                                    children: (_row_values_p_title = (_row_values = row.values) === null || _row_values === void 0 ? void 0 : _row_values[p.title]) !== null && _row_values_p_title !== void 0 ? _row_values_p_title : "—"
                                                                }, p._id);
                                                            })
                                                        ]
                                                    }, row.feature))
                                            ]
                                        }),
                                        Object.keys(comparison.pros_cons).length > 0 && /*#__PURE__*/ _jsxs("div", {
                                            children: [
                                                /*#__PURE__*/ _jsx("p", {
                                                    className: "text-xs font-bold text-lightText uppercase tracking-wider mb-3",
                                                    children: "Pros & Cons"
                                                }),
                                                /*#__PURE__*/ _jsx("div", {
                                                    className: "grid gap-4",
                                                    style: {
                                                        gridTemplateColumns: `repeat(${compareItems.length}, 1fr)`
                                                    },
                                                    children: compareItems.map((p: any) =>{
                                                        const pc = comparison.pros_cons[p.title] || {
                                                            pros: [],
                                                            cons: []
                                                        };
                                                        return /*#__PURE__*/ _jsxs("div", {
                                                            className: "rounded-xl border border-gray-100 p-3.5 bg-white",
                                                            children: [
                                                                /*#__PURE__*/ _jsx("p", {
                                                                    className: "text-xs font-bold text-accent mb-2 truncate",
                                                                    children: p.title
                                                                }),
                                                                pc.pros.length > 0 && /*#__PURE__*/ _jsx("div", {
                                                                    className: "mb-2",
                                                                    children: pc.pros.map((pro: any) =>/*#__PURE__*/ _jsxs("div", {
                                                                            className: "flex items-start gap-1.5 mb-1",
                                                                            children: [
                                                                                /*#__PURE__*/ _jsx("span", {
                                                                                    className: "text-emerald-500 mt-0.5 shrink-0",
                                                                                    children: "✓"
                                                                                }),
                                                                                /*#__PURE__*/ _jsx("span", {
                                                                                    className: "text-[11px] text-gray-700",
                                                                                    children: pro
                                                                                })
                                                                            ]
                                                                        }, pro))
                                                                }),
                                                                pc.cons.length > 0 && /*#__PURE__*/ _jsx("div", {
                                                                    children: pc.cons.map((con: any) =>/*#__PURE__*/ _jsxs("div", {
                                                                            className: "flex items-start gap-1.5 mb-1",
                                                                            children: [
                                                                                /*#__PURE__*/ _jsx("span", {
                                                                                    className: "text-red-400 mt-0.5 shrink-0",
                                                                                    children: "✗"
                                                                                }),
                                                                                /*#__PURE__*/ _jsx("span", {
                                                                                    className: "text-[11px] text-gray-500",
                                                                                    children: con
                                                                                })
                                                                            ]
                                                                        }, con))
                                                                })
                                                            ]
                                                        }, p._id);
                                                    })
                                                })
                                            ]
                                        }),
                                        comparison.recommendation && /*#__PURE__*/ _jsxs("div", {
                                            className: "bg-gradient-to-r from-lightOrange/10 to-darkOrange/5 border border-lightOrange/20 rounded-xl p-4",
                                            children: [
                                                /*#__PURE__*/ _jsxs("div", {
                                                    className: "flex items-center gap-2 mb-2",
                                                    children: [
                                                        /*#__PURE__*/ _jsx("svg", {
                                                            className: "w-4 h-4 text-lightOrange shrink-0",
                                                            fill: "currentColor",
                                                            viewBox: "0 0 20 20",
                                                            children: /*#__PURE__*/ _jsx("path", {
                                                                fillRule: "evenodd",
                                                                d: "M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z",
                                                                clipRule: "evenodd"
                                                            })
                                                        }),
                                                        /*#__PURE__*/ _jsx("p", {
                                                            className: "text-xs font-bold text-lightOrange uppercase tracking-wider",
                                                            children: "AI Recommendation"
                                                        }),
                                                        comparisonMode && /*#__PURE__*/ _jsx("span", {
                                                            className: "ml-auto text-[10px] bg-lightOrange/15 text-lightOrange px-2 py-0.5 rounded-full font-medium",
                                                            children: comparisonMode === "gemini_ai" ? "Gemini AI" : "Local Agent"
                                                        })
                                                    ]
                                                }),
                                                /*#__PURE__*/ _jsx("p", {
                                                    className: "text-sm text-gray-700 leading-relaxed",
                                                    children: comparison.recommendation
                                                })
                                            ]
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
                                            children: "Powered by Gemini AI + Tool Calling — Phase 9"
                                        })
                                    ]
                                }),
                                /*#__PURE__*/ _jsx("button", {
                                    onClick: clearCompare,
                                    className: "text-xs text-lightText dark:text-zinc-400 hover:text-lightRed transition-colors font-medium",
                                    children: "Clear All"
                                })
                            ]
                        })
                    ]
                })
            })
        ]
    });
};
export default ProductComparisonProvider;
