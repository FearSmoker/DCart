"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { urlFor } from "@/sanity/lib/image";
import FormattedPrice from "./FormattedPrice";
import AddToCartButton from "./AddToCartButton";
import ProductSpecsAccordions from "./ProductSpecsAccordions";
import AskCopilotPrompt from "./AskCopilotPrompt";
import ProductReviewFeed from "./ProductReviewFeed";
import { addToFavorite, setBuyNowCart, resetBuyNowCart } from "@/redux/dcartSlice";
import {
  MdStar,
  MdFavorite,
  MdFavoriteBorder,
  MdOutlinePayments,
  MdOutlineSettingsBackupRestore,
  MdLocalShipping,
  MdOutlineVerifiedUser,
  MdOutlineCardGiftcard,
  MdCheckCircle,
} from "react-icons/md";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";

const ProductDetailView = (param: any)=>{
    const { product, purchaseInfo } = param as any;
    const { data: session } = useSession();
    // Extract unique colors and models
    const variants = product.variants || [];
    const uniqueColors = Array.from(new Set<string>(variants.map((v: any) => v.color as string)));
    const [selectedColor, setSelectedColor] = useState<string>(uniqueColors[0] || "");
    const [selectedModel, setSelectedModel] = useState<string>("");
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [wishlistLoading, setWishlistLoading] = useState(false);
    const [buyNowLoading, setBuyNowLoading] = useState(false);
    const dispatch = useDispatch();
    const router = useRouter();
    const favorite = useSelector((state: any) =>state.dcart.favorite) || [];
    const isWishlisted = favorite.some((fav: any)=>fav._id === product._id);
    const stockMap = useSelector((state: any) =>state.dcart.stockMap) || {};
    // Lifted reviews and stats states
    const [reviews, setReviews] = useState<any[]>([]);
    const [stats, setStats] = useState({
        total: 0,
        average: 0,
        distribution: {
            5: 0,
            4: 0,
            3: 0,
            2: 0,
            1: 0
        }
    });
    const [reviewsLoading, setReviewsLoading] = useState(true);
    const [showHighlights, setShowHighlights] = useState(false);
    const [vendorInfo, setVendorInfo] = useState<any>(null);
    const [showSellerCard, setShowSellerCard] = useState(false);
    const fetchReviewsAndStats = useCallback(async ()=>{
        try {
            const res = await fetch("/api/reviews?productId=".concat(encodeURIComponent(product._id)));
            const data = await res.json();
            if (data.success) {
                setReviews(data.reviews || []);
                setStats(data.stats || {
                    total: 0,
                    average: 0,
                    distribution: {
                        5: 0,
                        4: 0,
                        3: 0,
                        2: 0,
                        1: 0
                    }
                });
            }
        } catch (err) {
            console.error("Failed to load reviews:", err);
        } finally{
            setReviewsLoading(false);
        }
    }, [
        product._id
    ]);
    useEffect(()=>{
        fetchReviewsAndStats();
    }, [
        fetchReviewsAndStats
    ]);
    useEffect(()=>{
        if (!product.vendorId) {
            setShowHighlights(false);
            return;
        }
        const checkHighlights = async ()=>{
            try {
                const res = await fetch("/api/vendor/highlights?vendor_id=".concat(encodeURIComponent(product.vendorId)));
                const data = await res.json();
                if (data.success && data.created_at) {
                    const createdAtDate = new Date(data.created_at);
                    const oneMonthAgo = new Date();
                    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
                    const isAtLeastOneMonthOld = createdAtDate <= oneMonthAgo;
                    const hasAtLeastFiveOrders = (data.total_orders || 0) >= 5;
                    setShowHighlights(isAtLeastOneMonthOld && hasAtLeastFiveOrders);
                } else {
                    setShowHighlights(false);
                }
            } catch (err) {
                console.error("Failed to check highlights:", err);
                setShowHighlights(false);
            }
        };
        checkHighlights();
    }, [
        product.vendorId
    ]);
    useEffect(() => {
        if (!product.vendorId) return;
        const fetchVendorInfo = async () => {
            try {
                const res = await fetch("/api/vendor/info?vendor_id=" + encodeURIComponent(product.vendorId));
                const data = await res.json();
                if (data.success) {
                    setVendorInfo(data);
                }
            } catch (err) {
                console.error("Failed to fetch vendor info:", err);
            }
        };
        fetchVendorInfo();
    }, [product.vendorId]);

    const getSellerDuration = (createdAtStr: string) => {
        if (!createdAtStr) return "";
        const createdDate = new Date(createdAtStr);
        const now = new Date();
        const diffTime = now.getTime() - createdDate.getTime();
        if (diffTime < 0) return "Just joined";

        const diffYears = now.getFullYear() - createdDate.getFullYear();
        const diffMonths = now.getMonth() - createdDate.getMonth() + (diffYears * 12);

        if (diffMonths >= 12) {
            const years = Math.floor(diffMonths / 12);
            return `${years} year${years > 1 ? "s" : ""}`;
        } else {
            const months = Math.max(1, diffMonths);
            const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            if (days < 30) {
                return "less than a month";
            }
            return `${months} month${months > 1 ? "s" : ""}`;
        }
    };
    // Available models for the currently selected color
    const availableModelsForColor = Array.from(new Set<string>(variants.filter((v: any) =>v.color === selectedColor && v.model).map((v: any) =>v.model as string)));
    // Auto-select first available model when color changes
    useEffect(()=>{
        if (availableModelsForColor.length > 0) {
            setSelectedModel(availableModelsForColor[0]);
        } else {
            setSelectedModel("");
        }
        setActiveImageIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        selectedColor
    ]);
    // Find active variant matching selected color & model
    const activeVariant = variants.find((v: any) =>v.color === selectedColor && (selectedModel ? v.model === selectedModel : true));
    // Derive active price, images, and stock from selection
    const currentPrice = (activeVariant === null || activeVariant === void 0 ? void 0 : activeVariant.price) || product.price;
    const currentRowprice = activeVariant ? currentPrice * 1.2 : product.rowprice;
    const currentQuantity = (activeVariant === null || activeVariant === void 0 ? void 0 : activeVariant.quantity) !== undefined ? activeVariant.quantity : product.quantity;
    const liveStock = stockMap[product._id] !== undefined ? stockMap[product._id] : currentQuantity;
    const isOutOfStock = liveStock <= 0;
    const currentImages = (activeVariant === null || activeVariant === void 0 ? void 0 : activeVariant.images) && activeVariant.images.length > 0 ? activeVariant.images : typeof product.image === "string" ? [
        product.image
    ] : product.image ? [
        product.image
    ] : [
        "/notFound.png"
    ];
    const currentImageToShow = currentImages[activeImageIndex] || currentImages[0];
    const handleAddToWishlist = async ()=>{
        let _session_user;
        if (!(session === null || session === void 0 ? void 0 : (_session_user = session.user) === null || _session_user === void 0 ? void 0 : _session_user.email)) {
            toast.error("Please sign in to manage your wishlist.");
            return;
        }
        const isSeller = (session?.user as any)?.role === "seller";
        if (isSeller) {
            toast.error("Sellers cannot manage wishlists.");
            return;
        }
        const action = isWishlisted ? "remove" : "add";
        // Optimistic Update
        dispatch(addToFavorite(product));
        toast.success(isWishlisted ? "Removed from wishlist" : "Added to wishlist successfully!");
        setWishlistLoading(true);
        try {
            const res = await fetch("/api/wishlist", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    productId: product._id,
                    action
                })
            });
            const data = await res.json();
            if (!data.success) {
                // Revert
                dispatch(addToFavorite(product));
                toast.error(data.message || "Failed to update wishlist.");
            }
        } catch (err) {
            console.error(err);
            // Revert
            dispatch(addToFavorite(product));
            toast.error("Error updating wishlist.");
        } finally{
            setWishlistLoading(false);
        }
    };
    const handleBuyNow = async ()=>{
        let _session_user;
        if (!(session === null || session === void 0 ? void 0 : (_session_user = session.user) === null || _session_user === void 0 ? void 0 : _session_user.email)) {
            toast.error("Please sign in to complete your purchase.");
            router.push("/signin");
            return;
        }
        const isSeller = (session?.user as any)?.role === "seller";
        if (isSeller) {
            toast.error("Sellers are not allowed to make purchases.");
            return;
        }
        if (isOutOfStock) {
            toast.error("This product is temporarily out of stock!");
            return;
        }
        try {
            setBuyNowLoading(true);
            // 1. Set the buyNowCart state in Redux
            dispatch(setBuyNowCart([
                {
                    ...cartItemPayload,
                    quantity: 1
                }
            ]));
            // 2. Redirect to intermediate address selection page
            router.push("/checkout?buyNow=true");
        } catch (err) {
            console.error(err);
            toast.error("An error occurred during checkout.");
            dispatch(resetBuyNowCart());
        } finally{
            setBuyNowLoading(false);
        }
    };
    // Build combined payload representing this specific variant selection to pass to cart
    const cartItemPayload = {
        ...product,
        price: currentPrice,
        rowprice: currentRowprice,
        quantity: currentQuantity,
        image: currentImageToShow,
        title: activeVariant ? `${product.title} (${selectedColor}${selectedModel ? ` - ${selectedModel}` : ""})` : product.title
    };
    return /*#__PURE__*/ _jsxs("div", {
        className: "grid grid-cols-1 lg:grid-cols-12 gap-8 bg-white dark:bg-zinc-900 border border-gray-150 dark:border-zinc-800 p-6 rounded-3xl shadow-xs",
        children: [
            /*#__PURE__*/ _jsxs("div", {
                className: "lg:col-span-5 flex flex-col gap-4",
                children: [
                    /*#__PURE__*/ _jsx("div", {
                        className: "w-full aspect-square relative bg-gray-50 dark:bg-zinc-800 border border-gray-100 dark:border-zinc-850 rounded-2xl overflow-hidden flex items-center justify-center p-4",
                        children: /*#__PURE__*/ _jsx(Image, {
                            src: typeof currentImageToShow === "string" ? currentImageToShow : urlFor(currentImageToShow).url(),
                            alt: product.title,
                            className: "max-h-full max-w-full object-contain rounded-xl",
                            width: 600,
                            height: 600,
                            priority: true
                        })
                    }),
                    currentImages.length > 1 && /*#__PURE__*/ _jsx("div", {
                        className: "flex gap-2.5 overflow-x-auto pb-1.5 scrollbar-thin",
                        children: currentImages.map((img: any, idx: any) =>/*#__PURE__*/ _jsx("button", {
                                onClick: ()=>setActiveImageIndex(idx),
                                className: "w-16 h-16 border rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center p-1 bg-white dark:bg-zinc-800 hover:border-orange-400 dark:hover:border-orange-400 transition-all ".concat(idx === activeImageIndex ? "border-orange-500 ring-2 ring-orange-500/20" : "border-gray-200 dark:border-zinc-700"),
                                children: /*#__PURE__*/ _jsx(Image, {
                                    src: typeof img === "string" ? img : urlFor(img).url(),
                                    alt: "thumbnail-".concat(idx),
                                    width: 80,
                                    height: 80,
                                    className: "max-h-full max-w-full object-contain rounded-lg"
                                })
                            }, idx))
                    })
                ]
            }),
            /*#__PURE__*/ _jsxs("div", {
                className: "lg:col-span-7 flex flex-col gap-5",
                children: [
                    purchaseInfo && /*#__PURE__*/ _jsxs("div", {
                        className: "flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 dark:border-emerald-900/50 rounded-2xl p-4 text-xs text-emerald-800 dark:text-emerald-300 font-medium shadow-3xs",
                        children: [
                            /*#__PURE__*/ _jsx("span", {
                                className: "text-emerald-600 dark:text-emerald-400 text-sm font-bold shrink-0",
                                children: "✓"
                            }),
                            /*#__PURE__*/ _jsxs("span", {
                                children: [
                                    "Already purchased on ",
                                    /*#__PURE__*/ _jsx("strong", {
                                        children: purchaseInfo.date
                                    }),
                                    ".",
                                    " ",
                                    /*#__PURE__*/ _jsx(Link, {
                                        href: "/orders?id=".concat(purchaseInfo.orderId),
                                        className: "text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200 underline font-bold cursor-pointer",
                                        children: "Click here to view"
                                    })
                                ]
                            })
                        ]
                    }),
                    /*#__PURE__*/ _jsxs("div", {
                        children: [
                            /*#__PURE__*/ _jsx("h2", {
                                className: "text-3xl font-extrabold text-accent dark:text-zinc-100",
                                children: product.title
                            }),
                            product.brand && /*#__PURE__*/ _jsxs("div", {
                                className: "flex flex-col gap-2 mt-1.5",
                                children: [
                                    /*#__PURE__*/ _jsxs("p", {
                                        className: "text-xs text-lightText dark:text-zinc-400 font-bold uppercase tracking-wider",
                                        children: [
                                            "Brand: ",
                                            product.brand
                                        ]
                                    }),
                                    showHighlights && /*#__PURE__*/ _jsxs("div", {
                                        className: "space-y-1 bg-emerald-50/20 dark:bg-emerald-950/10 border border-emerald-100/50 dark:border-emerald-900/30 px-3 py-2 rounded-2xl w-fit text-[10px] text-emerald-800 dark:text-emerald-300 font-extrabold flex flex-col gap-0.5 shadow-3xs",
                                        children: [
                                            /*#__PURE__*/ _jsx("span", {
                                                className: "text-[9px] uppercase tracking-wider text-lightText dark:text-zinc-400 font-bold",
                                                children: "Seller Highlights:"
                                            }),
                                            /*#__PURE__*/ _jsxs("div", {
                                                className: "flex items-center gap-1.5",
                                                children: [
                                                    /*#__PURE__*/ _jsx("span", {
                                                        className: "w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0"
                                                    }),
                                                    /*#__PURE__*/ _jsx("span", {
                                                        children: "81% positive ratings from 1K+ customers"
                                                    })
                                                ]
                                            }),
                                            /*#__PURE__*/ _jsxs("div", {
                                                className: "flex items-center gap-1.5",
                                                children: [
                                                    /*#__PURE__*/ _jsx("span", {
                                                        className: "w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0"
                                                    }),
                                                    /*#__PURE__*/ _jsx("span", {
                                                        children: "10K+ recent orders from this brand"
                                                    })
                                                ]
                                            }),
                                            /*#__PURE__*/ _jsxs("div", {
                                                className: "flex items-center gap-1.5",
                                                children: [
                                                    /*#__PURE__*/ _jsx("span", {
                                                        className: "w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0"
                                                    }),
                                                    /*#__PURE__*/ _jsx("span", {
                                                        children: "5+ years on DCart"
                                                    })
                                                ]
                                            })
                                        ]
                                    })
                                ]
                            })
                        ]
                    }),
                    /*#__PURE__*/ _jsxs("div", {
                        className: "flex items-center gap-4 bg-gray-50/50 dark:bg-zinc-800/30 border border-gray-100 dark:border-zinc-800 p-4 rounded-2xl w-fit",
                        children: [
                            /*#__PURE__*/ _jsx("p", {
                                className: "text-sm text-lightText dark:text-zinc-500 line-through",
                                children: /*#__PURE__*/ _jsx(FormattedPrice, {
                                    amount: currentRowprice
                                })
                            }),
                            /*#__PURE__*/ _jsx(FormattedPrice, {
                                amount: currentPrice,
                                className: "text-2xl font-black text-accent dark:text-zinc-100"
                            }),
                            /*#__PURE__*/ _jsxs("p", {
                                className: "text-xs bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 font-bold px-2 py-1 rounded-lg border border-emerald-100 dark:border-emerald-800/50",
                                children: [
                                    "Save ",
                                    /*#__PURE__*/ _jsx(FormattedPrice, {
                                        amount: Math.max(0, currentRowprice - currentPrice)
                                    })
                                ]
                            })
                        ]
                    }),
                    !reviewsLoading && stats.total > 0 ? /*#__PURE__*/ _jsxs("div", {
                        className: "flex items-center gap-2",
                        children: [
                            /*#__PURE__*/ _jsx("div", {
                                className: "flex items-center text-lg",
                                children: Array.from({
                                    length: 5
                                }).map((_, index: any) =>{
                                    const filled = index + 1 <= Math.round(stats.average);
                                    return /*#__PURE__*/ _jsx(MdStar, {
                                        className: filled ? "text-orange-400" : "text-gray-200 dark:text-zinc-700"
                                    }, index);
                                })
                            }),
                            /*#__PURE__*/ _jsxs("span", {
                                className: "text-xs text-lightText dark:text-zinc-400 font-semibold",
                                children: [
                                    "(",
                                    stats.average,
                                    " out of 5 \xb7 ",
                                    stats.total,
                                    " ",
                                    stats.total === 1 ? "global rating" : "global ratings",
                                    ")"
                                ]
                            })
                        ]
                    }) : null,
                    /*#__PURE__*/ _jsxs("div", {
                        className: "space-y-1",
                        children: [
                            /*#__PURE__*/ _jsx("p", {
                                className: "text-xs font-bold text-accent dark:text-zinc-200 uppercase tracking-wide",
                                children: "Description"
                            }),
                            /*#__PURE__*/ _jsx("p", {
                                className: "text-sm text-gray-650 dark:text-zinc-400 leading-relaxed",
                                children: product.description
                            })
                        ]
                    }),
                    uniqueColors.length > 0 && /*#__PURE__*/ _jsxs("div", {
                        className: "space-y-3 pt-2 border-t border-gray-50 dark:border-zinc-800",
                        children: [
                            /*#__PURE__*/ _jsxs("div", {
                                children: [
                                    /*#__PURE__*/ _jsxs("p", {
                                        className: "text-xs font-bold text-accent dark:text-zinc-200 uppercase tracking-wide mb-1.5",
                                        children: [
                                            "Select Color: ",
                                            /*#__PURE__*/ _jsx("span", {
                                                className: "text-orange-500 font-semibold",
                                                children: selectedColor
                                            })
                                        ]
                                    }),
                                    /*#__PURE__*/ _jsx("div", {
                                        className: "flex flex-wrap gap-2",
                                        children: uniqueColors.map((color: any) =>/*#__PURE__*/ _jsx("button", {
                                                onClick: ()=>setSelectedColor(color),
                                                className: "px-3 py-1.5 border text-xs font-bold rounded-xl transition-all ".concat(color === selectedColor ? "border-orange-500 bg-orange-50/50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 font-extrabold" : "border-gray-250 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 text-accent dark:text-zinc-200"),
                                                children: color
                                            }, color))
                                    })
                                ]
                            }),
                            availableModelsForColor.length > 0 && /*#__PURE__*/ _jsxs("div", {
                                children: [
                                    /*#__PURE__*/ _jsxs("p", {
                                        className: "text-xs font-bold text-accent dark:text-zinc-200 uppercase tracking-wide mb-1.5",
                                        children: [
                                            "Select Model / Specification: ",
                                            /*#__PURE__*/ _jsx("span", {
                                                className: "text-orange-500 font-semibold",
                                                children: selectedModel
                                            })
                                        ]
                                    }),
                                    /*#__PURE__*/ _jsx("div", {
                                        className: "flex flex-wrap gap-2",
                                        children: availableModelsForColor.map((model: any) =>/*#__PURE__*/ _jsx("button", {
                                                onClick: ()=>setSelectedModel(model),
                                                className: "px-3 py-1.5 border text-xs font-bold rounded-xl transition-all ".concat(model === selectedModel ? "border-orange-500 bg-orange-50/50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 font-extrabold" : "border-gray-250 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 text-accent dark:text-zinc-200"),
                                                children: model
                                            }, model))
                                    })
                                ]
                            })
                        ]
                    }),
                    (()=>{
                        return /*#__PURE__*/ _jsxs(_Fragment, {
                            children: [
                                /*#__PURE__*/ _jsx("div", {
                                    className: "text-xs font-bold pt-2 border-t border-gray-50 dark:border-zinc-800 mb-3",
                                    children: liveStock > 0 ? liveStock <= 10 ? /*#__PURE__*/ _jsxs("span", {
                                        className: "text-red-500 dark:text-red-400 animate-pulse",
                                        children: [
                                            "Only ",
                                            liveStock,
                                            " left in stock - order soon!"
                                        ]
                                    }) : /*#__PURE__*/ _jsx("span", {
                                        className: "text-emerald-600 dark:text-emerald-400",
                                        children: "✓ In Stock"
                                    }) : /*#__PURE__*/ _jsx("span", {
                                        className: "text-red-655 dark:text-red-400",
                                        children: "✕ Out of Stock"
                                    })
                                }),
                                (!(session === null || session === void 0 ? void 0 : session.user) || (session?.user as any)?.role !== "seller") && /*#__PURE__*/ _jsxs("div", {
                                    className: "flex flex-col gap-3",
                                    children: [
                                        /*#__PURE__*/ _jsxs("div", {
                                            className: "text-xs space-y-1.5 mb-2 border-t border-gray-50 dark:border-zinc-800 pt-3 relative",
                                            children: [
                                                /*#__PURE__*/ _jsxs("div", {
                                                    className: "flex items-center gap-2 text-gray-500 dark:text-zinc-400",
                                                    children: [
                                                        /*#__PURE__*/ _jsx("span", {
                                                            className: "w-20 inline-block font-semibold",
                                                            children: "Ships from"
                                                        }),
                                                        /*#__PURE__*/ _jsx("span", {
                                                            className: "text-accent dark:text-zinc-250 font-bold",
                                                            children: "DCart"
                                                        })
                                                    ]
                                                }),
                                                product.vendorId ? /*#__PURE__*/ _jsxs("div", {
                                                    className: "flex items-center gap-2 text-gray-500 dark:text-zinc-400",
                                                    children: [
                                                        /*#__PURE__*/ _jsx("span", {
                                                            className: "w-20 inline-block font-semibold",
                                                            children: "Sold by"
                                                        }),
                                                        /*#__PURE__*/ _jsx("button", {
                                                            type: "button",
                                                            onClick: () => setShowSellerCard(!showSellerCard),
                                                            className: "text-orange-500 hover:text-orange-600 hover:underline font-bold cursor-pointer transition-colors focus:outline-none",
                                                            children: vendorInfo ? vendorInfo.store_name : "DCart Seller"
                                                        })
                                                    ]
                                                }) : null,
                                                showSellerCard && vendorInfo && /*#__PURE__*/ _jsxs("div", {
                                                    className: "absolute left-0 bottom-full mb-2 z-50 w-72 bg-white dark:bg-zinc-850 border border-gray-150 dark:border-zinc-800 rounded-2xl p-4 shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200",
                                                    children: [
                                                        /*#__PURE__*/ _jsxs("div", {
                                                            className: "flex justify-between items-center mb-2.5",
                                                            children: [
                                                                /*#__PURE__*/ _jsx("h4", {
                                                                    className: "font-black text-sm text-accent dark:text-zinc-100",
                                                                    children: vendorInfo.store_name
                                                                }),
                                                                /*#__PURE__*/ _jsx("button", {
                                                                    type: "button",
                                                                    onClick: () => setShowSellerCard(false),
                                                                    className: "text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800",
                                                                    children: "✕"
                                                                })
                                                            ]
                                                        }),
                                                        /*#__PURE__*/ _jsx("div", {
                                                            className: "space-y-1 text-[11px] text-gray-600 dark:text-zinc-300",
                                                            children: /*#__PURE__*/ _jsxs("p", {
                                                                children: [
                                                                    /*#__PURE__*/ _jsx("span", {
                                                                        className: "font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider block text-[9px] mb-0.5",
                                                                        children: "Registration Duration"
                                                                    }),
                                                                    /*#__PURE__*/ _jsxs("span", {
                                                                        className: "font-semibold text-accent dark:text-zinc-150 text-xs",
                                                                        children: [
                                                                            getSellerDuration(vendorInfo.created_at),
                                                                            " on DCart"
                                                                        ]
                                                                    })
                                                                ]
                                                            })
                                                        })
                                                    ]
                                                })
                                            ]
                                        }),
                                        /*#__PURE__*/ _jsxs("div", {
                                            className: "flex items-center gap-3",
                                            children: [
                                                /*#__PURE__*/ _jsx(AddToCartButton, {
                                                    item: cartItemPayload,
                                                    className: "flex-1 rounded-xl py-3.5"
                                                }),
                                                /*#__PURE__*/ _jsx("button", {
                                                    onClick: handleAddToWishlist,
                                                    disabled: wishlistLoading,
                                                    className: "p-3.5 border rounded-xl duration-300 flex items-center justify-center text-xl disabled:opacity-50 ".concat(isWishlisted ? "bg-red-50 dark:bg-red-950/30 text-red-500 dark:text-red-400 border-red-200 dark:border-red-900/50 hover:bg-red-100/50 dark:hover:bg-red-900/50" : "border-gray-200 dark:border-zinc-700 text-accent dark:text-zinc-200 hover:bg-orange-50/20 dark:hover:bg-zinc-800/50 hover:text-orange-500 hover:border-orange-200 dark:hover:border-orange-850"),
                                                    title: isWishlisted ? "Remove from Wishlist" : "Add to Wishlist",
                                                    children: isWishlisted ? /*#__PURE__*/ _jsx(MdFavorite, {
                                                        className: "text-red-500"
                                                    }) : /*#__PURE__*/ _jsx(MdFavoriteBorder, {})
                                                })
                                            ]
                                        }),
                                        /*#__PURE__*/ _jsx("button", {
                                            onClick: handleBuyNow,
                                            disabled: buyNowLoading || isOutOfStock,
                                            className: "w-full py-3.5 font-semibold tracking-wide flex items-center justify-center gap-1 rounded-xl border border-darkOrange dark:border-lightOrange transition-all duration-300 shadow-sm hover:shadow ".concat(isOutOfStock ? "bg-gray-400 dark:bg-zinc-800 border-gray-400 dark:border-zinc-850 text-white dark:text-zinc-500 cursor-not-allowed" : "bg-darkOrange dark:bg-lightOrange text-white hover:bg-accent dark:hover:bg-zinc-100 dark:hover:text-black hover:border-accent dark:hover:border-zinc-100"),
                                            children: buyNowLoading ? /*#__PURE__*/ _jsxs(_Fragment, {
                                                children: [
                                                    /*#__PURE__*/ _jsx("div", {
                                                        className: "w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"
                                                    }),
                                                    /*#__PURE__*/ _jsx("span", {
                                                        children: "Processing..."
                                                    })
                                                ]
                                            }) : isOutOfStock ? "Out of Stock" : "Buy Now"
                                        })
                                    ]
                                })
                            ]
                        });
                    })(),
                    /*#__PURE__*/ _jsxs("div", {
                        className: "grid grid-cols-5 gap-1.5 py-4 border-t border-b border-gray-100 dark:border-zinc-800 my-2.5 text-center",
                        children: [
                            /*#__PURE__*/ _jsxs("div", {
                                className: "flex flex-col items-center gap-1 justify-center",
                                children: [
                                    /*#__PURE__*/ _jsx("div", {
                                        className: "p-2 bg-orange-50 dark:bg-orange-950/20 text-orange-500 dark:text-orange-400 rounded-full text-base shadow-3xs",
                                        children: /*#__PURE__*/ _jsx(MdOutlinePayments, {})
                                    }),
                                    /*#__PURE__*/ _jsx("span", {
                                        className: "text-[9px] font-black text-accent dark:text-zinc-300 leading-tight",
                                        children: "Pay on Delivery"
                                    })
                                ]
                            }),
                            /*#__PURE__*/ _jsxs("div", {
                                className: "flex flex-col items-center gap-1 justify-center",
                                children: [
                                    /*#__PURE__*/ _jsx("div", {
                                        className: "p-2 bg-orange-50 dark:bg-orange-950/20 text-orange-500 dark:text-orange-400 rounded-full text-base shadow-3xs",
                                        children: /*#__PURE__*/ _jsx(MdOutlineSettingsBackupRestore, {})
                                    }),
                                    /*#__PURE__*/ _jsx("span", {
                                        className: "text-[9px] font-black text-accent dark:text-zinc-300 leading-tight",
                                        children: "10 days Returnable"
                                    })
                                ]
                            }),
                            /*#__PURE__*/ _jsxs("div", {
                                className: "flex flex-col items-center gap-1 justify-center",
                                children: [
                                    /*#__PURE__*/ _jsx("div", {
                                        className: "p-2 bg-orange-50 dark:bg-orange-950/20 text-orange-500 dark:text-orange-400 rounded-full text-base shadow-3xs",
                                        children: /*#__PURE__*/ _jsx(MdLocalShipping, {})
                                    }),
                                    /*#__PURE__*/ _jsx("span", {
                                        className: "text-[9px] font-black text-accent dark:text-zinc-300 leading-tight",
                                        children: "DCart Delivered"
                                    })
                                ]
                            }),
                            /*#__PURE__*/ _jsxs("div", {
                                className: "flex flex-col items-center gap-1 justify-center",
                                children: [
                                    /*#__PURE__*/ _jsx("div", {
                                        className: "p-2 bg-orange-50 dark:bg-orange-950/20 text-orange-500 dark:text-orange-400 rounded-full text-base shadow-3xs",
                                        children: /*#__PURE__*/ _jsx(MdOutlineVerifiedUser, {})
                                    }),
                                    /*#__PURE__*/ _jsx("span", {
                                        className: "text-[9px] font-black text-accent dark:text-zinc-300 leading-tight",
                                        children: "1 Year Warranty"
                                    })
                                ]
                            }),
                            /*#__PURE__*/ _jsxs("div", {
                                className: "flex flex-col items-center gap-1 justify-center",
                                children: [
                                    /*#__PURE__*/ _jsx("div", {
                                        className: "p-2 bg-orange-50 dark:bg-orange-950/20 text-orange-500 dark:text-orange-400 rounded-full text-base shadow-3xs",
                                        children: /*#__PURE__*/ _jsx(MdOutlineCardGiftcard, {})
                                    }),
                                    /*#__PURE__*/ _jsx("span", {
                                        className: "text-[9px] font-black text-accent dark:text-zinc-300 leading-tight",
                                        children: "Free Delivery"
                                    })
                                ]
                            })
                        ]
                    }),
                    /*#__PURE__*/ _jsxs("div", {
                        className: "flex items-start gap-2 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30 p-3.5 rounded-2xl text-[10px] text-emerald-800 dark:text-emerald-300 leading-normal font-medium shadow-3xs my-1",
                        children: [
                            /*#__PURE__*/ _jsx("div", {
                                className: "p-1 bg-emerald-500 text-white rounded-full text-xs shrink-0",
                                children: /*#__PURE__*/ _jsx(MdCheckCircle, {})
                            }),
                            /*#__PURE__*/ _jsxs("div", {
                                children: [
                                    /*#__PURE__*/ _jsx("strong", {
                                        className: "text-emerald-900 dark:text-emerald-250 font-bold block",
                                        children: "Customers usually keep this item"
                                    }),
                                    "This product has fewer returns than average compared to similar products."
                                ]
                            })
                        ]
                    }),
                    /*#__PURE__*/ _jsx("div", {
                        className: "mt-2.5",
                        children: /*#__PURE__*/ _jsx(ProductSpecsAccordions, {
                            product: product
                        })
                    }),
                    /*#__PURE__*/ _jsx(AskCopilotPrompt, {
                        product: product
                    })
                ]
            }),
            /*#__PURE__*/ _jsx("div", {
                className: "col-span-1 lg:col-span-12 mt-6",
                children: /*#__PURE__*/ _jsxs("div", {
                    className: "relative rounded-3xl overflow-hidden h-44 md:h-52 flex items-center justify-center p-6 bg-gradient-to-r from-accent dark:from-zinc-950 to-zinc-900 dark:to-zinc-900 border border-gray-150 dark:border-zinc-800 shadow-xs",
                    children: [
                        /*#__PURE__*/ _jsx("div", {
                            className: "absolute inset-0 bg-cover bg-center opacity-30 mix-blend-overlay",
                            style: {
                                backgroundImage: "url(".concat(typeof currentImageToShow === "string" ? currentImageToShow : urlFor(currentImageToShow).url(), ")")
                            }
                        }),
                        /*#__PURE__*/ _jsxs("div", {
                            className: "relative text-center max-w-lg space-y-2.5",
                            children: [
                                /*#__PURE__*/ _jsx("h3", {
                                    className: "text-lg md:text-xl font-black text-white uppercase tracking-wider",
                                    children: product.title
                                }),
                                /*#__PURE__*/ _jsx("p", {
                                    className: "text-orange-400 text-xs font-bold uppercase tracking-widest",
                                    children: product.brand || "Apple"
                                }),
                                /*#__PURE__*/ _jsx("div", {
                                    className: "w-16 h-0.5 bg-orange-500 mx-auto rounded-full"
                                }),
                                /*#__PURE__*/ _jsx("p", {
                                    className: "text-[10px] md:text-xs text-zinc-300 font-medium line-clamp-2 leading-relaxed",
                                    children: product.description
                                })
                            ]
                        })
                    ]
                })
            }),
            /*#__PURE__*/ _jsx("div", {
                className: "col-span-1 lg:col-span-12 mt-4",
                children: /*#__PURE__*/ _jsx(ProductReviewFeed, {
                    product: product,
                    reviews: reviews,
                    setReviews: setReviews,
                    stats: stats,
                    reviewsLoading: reviewsLoading,
                    fetchReviewsAndStats: fetchReviewsAndStats
                })
            })
        ]
    });
};
export default ProductDetailView;