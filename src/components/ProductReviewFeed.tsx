"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";


import React, { useEffect, useState } from "react";
import { MdStar, MdAutoAwesome, MdThumbUp, MdPhotoLibrary } from "react-icons/md";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import Image from "next/image";
import { useRouter } from "next/navigation";

const ProductReviewFeed = (param: any) =>{
    const { product, reviews, setReviews, stats, reviewsLoading, fetchReviewsAndStats } = param;
    const { data: session } = useSession();
    const [aiAnalysis, setAiAnalysis] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [votedReviews, setVotedReviews] = useState<Record<string, any>>({});
    const router = useRouter();
    // Review form states
    const [formMode, setFormMode] = useState("none");
    const [rating, setRating] = useState(5);
    const [hoverRating, setHoverRating] = useState(0);
    const [comment, setComment] = useState("");
    const [reviewTitle, setReviewTitle] = useState("");
    const [reviewImage, setReviewImage] = useState("");
    const [uploadingImage, setUploadingImage] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const fetchAIAnalysis = async ()=>{
        try {
            const res = await fetch("/api/reviews/analyze?productId=".concat(encodeURIComponent(product._id)));
            const data = await res.json();
            if (data.success && data.analysis) {
                setAiAnalysis(data.analysis);
            }
        } catch (err) {
            console.error("Failed to load AI review analysis:", err);
        }
    };
    useEffect(()=>{
        const loadAll = async ()=>{
            setLoading(true);
            await fetchAIAnalysis();
            setLoading(false);
        };
        loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        product._id
    ]);
    const handleReviewImageUpload = async (file: any) =>{
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            toast.error("Please upload an image file.");
            return;
        }
        setUploadingImage(true);
        setUploadProgress(0.1);
        try {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", "/api/upload");
            xhr.upload.onprogress = (event: any)=>{
                if (event.lengthComputable) {
                    const progress = event.loaded / event.total * 100;
                    setUploadProgress(progress);
                }
            };
            xhr.onload = ()=>{
                setUploadingImage(false);
                if (xhr.status === 200) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        if (response.success && response.url) {
                            setReviewImage(response.url);
                            toast.success("Image uploaded successfully!");
                        } else {
                            toast.error(response.error || "Image upload failed.");
                        }
                    } catch (e) {
                        toast.error("Failed to parse upload response.");
                    }
                } else {
                    toast.error(`Upload failed with status: ${xhr.status}`);
                }
            };
            xhr.onerror = ()=>{
                setUploadingImage(false);
                toast.error("Network error during image upload.");
            };
            const formData = new FormData();
            formData.append("file", file);
            xhr.send(formData);
        } catch (e) {
            setUploadingImage(false);
            toast.error("Error starting image upload.");
        }
    };
    const handleReviewSubmit = async (e: any) =>{
        let _session_user;
        e.preventDefault();
        if (!(session === null || session === void 0 ? void 0 : (_session_user = session.user) === null || _session_user === void 0 ? void 0 : _session_user.email)) {
            toast.error("Please sign in to submit feedback.");
            return;
        }
        if (formMode === "review" && !comment.trim()) {
            toast.error("Please enter your comments.");
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch("/api/addreview", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    productId: product._id,
                    email: session?.user?.email,
                    rating,
                    comment: formMode === "review" ? comment.trim() : "",
                    title: formMode === "review" ? reviewTitle.trim() : "",
                    images: formMode === "review" && reviewImage ? [
                        reviewImage
                    ] : []
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(formMode === "review" ? "Review submitted successfully!" : "Rating submitted successfully!");
                setComment("");
                setReviewTitle("");
                setReviewImage("");
                setRating(5);
                setFormMode("none");
                await fetchReviewsAndStats();
                await fetchAIAnalysis();
                router.refresh();
            } else {
                toast.error(data.message || "Failed to submit review.");
            }
        } catch (err) {
            console.error(err);
            toast.error("Error submitting review.");
        } finally{
            setSubmitting(false);
        }
    };
    const handleHelpfulVote = async (reviewId: any)=>{
        if (votedReviews[reviewId]) {
            toast.success("You already voted this review as helpful!");
            return;
        }
        try {
            const res = await fetch("/api/reviews", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    productId: product._id,
                    reviewId
                })
            });
            const data = await res.json();
            if (data.success) {
                setVotedReviews((prev)=>({
                        ...prev,
                        [reviewId]: true
                    }));
                setReviews((prevReviews: any)=>prevReviews.map((r: any) =>r.reviewId === reviewId ? {
                            ...r,
                            helpfulCount: (r.helpfulCount || 0) + 1
                        } : r));
                toast.success("Thank you for your feedback!");
            }
        } catch (err) {
            console.error("Failed to vote helpful:", err);
            toast.error("Failed to register vote.");
        }
    };
    // Convert email address to clean capitalized username
    const formatUserEmail = (email: any) =>{
        if (!email || email === "customer@example.com") return "Verified Customer";
        const namePart = email.split("@")[0];
        const cleaned = namePart.replace(/[._\-0-9]/g, " ").trim();
        if (!cleaned) return "Verified Customer";
        return cleaned.split(" ").map((w: any) =>w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    };
    // Generate dynamic AI summaries based on extracted aspects
    const generateAISummary = ()=>{
        if (!aiAnalysis) return "";
        const { sentiment, pros, cons } = aiAnalysis;
        const isPos = sentiment.toLowerCase() === "positive";
        let summary = "Customers generally find the ".concat(product.title, " to be of ");
        if (isPos) {
            summary += "excellent quality and consider it great value for money. ";
        } else {
            summary += "average quality, with a mix of satisfied and critical reviews. ";
        }
        if (pros.length > 0) {
            summary += "They particularly praise features such as the **".concat(pros.slice(0, 3).join(", "), "** of the product as major strengths. ");
        }
        if (cons.length > 0) {
            summary += "However, some customers point out considerations regarding **".concat(cons.slice(0, 2).join(", "), "** as potential areas of concern. ");
        }
        return summary;
    };
    // Setup review images
    const getReviewImages = ()=>{
        const list: string[] = [];
        // Add images uploaded by users in reviews
        reviews.forEach((r: any) =>{
            if (r.images && r.images.length > 0) {
                list.push(...r.images);
            }
        });
        // Filter out empties and duplicates
        return Array.from(new Set(list.filter(Boolean) as any));
    };
    const reviewImages = getReviewImages();
    if (reviewsLoading || loading) {
        return /*#__PURE__*/ _jsxs("div", {
            className: "mt-8 p-6 bg-white border border-gray-150 rounded-3xl animate-pulse space-y-4",
            children: [
                /*#__PURE__*/ _jsx("div", {
                    className: "h-6 w-48 bg-gray-200 rounded"
                }),
                /*#__PURE__*/ _jsx("div", {
                    className: "h-40 bg-gray-100 rounded-2xl"
                })
            ]
        });
    }
    return /*#__PURE__*/ _jsx("div", {
        className: "mt-8 border-t border-gray-150 pt-8 text-left",
        children: /*#__PURE__*/ _jsxs("div", {
            className: "grid grid-cols-1 lg:grid-cols-12 gap-8",
            children: [
                /*#__PURE__*/ _jsxs("div", {
                    className: "lg:col-span-4 flex flex-col gap-6",
                    children: [
                        /*#__PURE__*/ _jsxs("div", {
                            children: [
                                /*#__PURE__*/ _jsx("h3", {
                                    className: "text-lg font-black text-accent mb-2",
                                    children: "Customer Reviews"
                                }),
                                /*#__PURE__*/ _jsxs("div", {
                                    className: "flex items-center gap-2.5 mb-2",
                                    children: [
                                        /*#__PURE__*/ _jsx("div", {
                                            className: "flex items-center text-orange-400 text-xl",
                                            children: Array.from({
                                                length: 5
                                            }).map((_, index: any) =>{
                                                const ratingVal = Math.round(stats.average);
                                                return /*#__PURE__*/ _jsx(MdStar, {
                                                    className: index < ratingVal ? "text-orange-400" : "text-gray-200"
                                                }, index);
                                            })
                                        }),
                                        /*#__PURE__*/ _jsxs("span", {
                                            className: "text-sm font-black text-accent",
                                            children: [
                                                stats.average,
                                                " out of 5"
                                            ]
                                        })
                                    ]
                                }),
                                /*#__PURE__*/ _jsxs("p", {
                                    className: "text-[10px] text-lightText font-semibold",
                                    children: [
                                        stats.total,
                                        " global ratings"
                                    ]
                                })
                            ]
                        }),
                        /*#__PURE__*/ _jsx("div", {
                            className: "space-y-2 bg-gray-50/50 p-4 rounded-2xl border border-gray-100",
                            children: [
                                5,
                                4,
                                3,
                                2,
                                1
                            ].map((star: any) =>{
                                const pct = stats.distribution[star] || 0;
                                return /*#__PURE__*/ _jsxs("div", {
                                    className: "flex items-center gap-3 text-xs text-accent font-bold",
                                    children: [
                                        /*#__PURE__*/ _jsxs("button", {
                                            className: "w-10 hover:text-orange-500 text-left shrink-0",
                                            children: [
                                                star,
                                                " star"
                                            ]
                                        }),
                                        /*#__PURE__*/ _jsx("div", {
                                            className: "flex-1 h-3 bg-gray-200 rounded-full overflow-hidden",
                                            children: /*#__PURE__*/ _jsx("div", {
                                                className: "h-full bg-orange-400 rounded-full transition-all duration-500",
                                                style: {
                                                    width: "".concat(pct, "%")
                                                }
                                            })
                                        }),
                                        /*#__PURE__*/ _jsxs("span", {
                                            className: "w-8 text-right font-black shrink-0",
                                            children: [
                                                pct,
                                                "%"
                                            ]
                                        })
                                    ]
                                }, star);
                            })
                        }),
                        (!(session === null || session === void 0 ? void 0 : session.user) || (session?.user as any)?.role !== "seller") && /*#__PURE__*/ _jsxs("div", {
                            className: "bg-white border border-gray-150 p-5 rounded-3xl shadow-2xs",
                            children: [
                                /*#__PURE__*/ _jsx("h4", {
                                    className: "text-xs font-black text-accent uppercase tracking-wider mb-1",
                                    children: "Share your feedback"
                                }),
                                /*#__PURE__*/ _jsx("p", {
                                    className: "text-[10px] text-lightText font-semibold mb-4",
                                    children: "Rate the product or write a full review"
                                }),
                                formMode === "none" ? /*#__PURE__*/ _jsxs("div", {
                                    className: "flex flex-col gap-2.5",
                                    children: [
                                        /*#__PURE__*/ _jsx("button", {
                                            onClick: ()=>setFormMode("rating"),
                                            className: "w-full py-2.5 bg-gray-50 border border-gray-255 hover:bg-gray-105 hover:border-gray-355 text-xs font-bold text-accent rounded-full transition-all duration-200 shadow-3xs",
                                            children: "Quick Rate Product"
                                        }),
                                        /*#__PURE__*/ _jsx("button", {
                                            onClick: ()=>setFormMode("review"),
                                            className: "w-full py-2.5 bg-lightOrange text-white hover:bg-darkOrange text-xs font-bold rounded-full transition-all duration-200 shadow-3xs",
                                            children: "Write a Full Review"
                                        })
                                    ]
                                }) : /*#__PURE__*/ _jsxs("form", {
                                    onSubmit: handleReviewSubmit,
                                    className: "flex flex-col gap-3",
                                    children: [
                                        /*#__PURE__*/ _jsxs("div", {
                                            className: "flex items-center gap-2",
                                            children: [
                                                /*#__PURE__*/ _jsx("span", {
                                                    className: "text-[10px] font-black uppercase text-accent",
                                                    children: "Rating:"
                                                }),
                                                /*#__PURE__*/ _jsx("div", {
                                                    className: "flex items-center text-lg",
                                                    children: [
                                                        1,
                                                        2,
                                                        3,
                                                        4,
                                                        5
                                                    ].map((star: any) =>/*#__PURE__*/ _jsx("button", {
                                                            type: "button",
                                                            onClick: ()=>setRating(star),
                                                            onMouseEnter: ()=>setHoverRating(star),
                                                            onMouseLeave: ()=>setHoverRating(0),
                                                            className: "hover:scale-110 duration-100 focus:outline-none",
                                                            children: /*#__PURE__*/ _jsx(MdStar, {
                                                                className: star <= (hoverRating || rating) ? "text-orange-400" : "text-gray-255"
                                                            })
                                                        }, star))
                                                })
                                            ]
                                        }),
                                        formMode === "review" && /*#__PURE__*/ _jsxs("div", {
                                            className: "flex flex-col gap-3",
                                            children: [
                                                /*#__PURE__*/ _jsx("input", {
                                                    type: "text",
                                                    placeholder: "Title of your review (e.g. Highly recommend!)",
                                                    value: reviewTitle,
                                                    onChange: (e: any)=>setReviewTitle(e.target.value),
                                                    className: "w-full px-3 py-2 text-xs outline-none border border-gray-200 rounded-xl focus:border-orange-400 bg-white text-accent font-semibold placeholder:text-lightText",
                                                    required: true
                                                }),
                                                /*#__PURE__*/ _jsx("textarea", {
                                                    placeholder: "Write about your actual usage experience, packaging, build quality...",
                                                    value: comment,
                                                    onChange: (e: any)=>setComment(e.target.value),
                                                    className: "w-full min-h-[90px] p-3 text-xs outline-none border border-gray-200 rounded-2xl focus:border-orange-400 bg-white text-accent font-medium leading-relaxed placeholder:text-lightText",
                                                    rows: 3,
                                                    required: true
                                                }),
                                                /*#__PURE__*/ _jsxs("div", {
                                                    className: "space-y-1.5 text-left",
                                                    children: [
                                                        /*#__PURE__*/ _jsx("span", {
                                                            className: "text-[9px] font-bold uppercase text-accent",
                                                            children: "Add a photo (optional)"
                                                        }),
                                                        uploadingImage ? /*#__PURE__*/ _jsxs("div", {
                                                            className: "border border-gray-200 p-3.5 rounded-xl text-center bg-gray-50 flex flex-col items-center justify-center min-h-[60px]",
                                                            children: [
                                                                /*#__PURE__*/ _jsx("div", {
                                                                    className: "w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mb-1"
                                                                }),
                                                                /*#__PURE__*/ _jsxs("span", {
                                                                    className: "text-[9px] font-bold text-accent",
                                                                    children: [
                                                                        "Uploading ",
                                                                        Math.round(uploadProgress),
                                                                        "%"
                                                                    ]
                                                                })
                                                            ]
                                                        }) : reviewImage ? /*#__PURE__*/ _jsxs("div", {
                                                            className: "flex items-center gap-2 bg-white border border-gray-150 p-2 rounded-xl shadow-3xs",
                                                            children: [
                                                                /*#__PURE__*/ _jsx(Image, {
                                                                    src: reviewImage,
                                                                    alt: "Review preview",
                                                                    width: 44,
                                                                    height: 44,
                                                                    className: "rounded-lg object-cover border border-gray-100"
                                                                }),
                                                                /*#__PURE__*/ _jsxs("div", {
                                                                    className: "flex-1 min-w-0",
                                                                    children: [
                                                                        /*#__PURE__*/ _jsx("p", {
                                                                            className: "text-[9px] text-lightText truncate font-mono",
                                                                            children: reviewImage
                                                                        }),
                                                                        /*#__PURE__*/ _jsx("button", {
                                                                            type: "button",
                                                                            onClick: ()=>setReviewImage(""),
                                                                            className: "text-[9px] text-orange-500 hover:text-orange-700 font-bold block",
                                                                            children: "Remove Photo"
                                                                        })
                                                                    ]
                                                                })
                                                            ]
                                                        }) : /*#__PURE__*/ _jsxs("div", {
                                                            className: "relative border border-dashed border-gray-200 hover:border-orange-350 transition-colors rounded-xl p-3 text-center bg-white flex flex-col items-center justify-center gap-1 cursor-pointer min-h-[60px]",
                                                            children: [
                                                                /*#__PURE__*/ _jsx("input", {
                                                                    type: "file",
                                                                    accept: "image/*",
                                                                    onChange: (e: any)=>{
                                                                        let _e_target_files;
                                                                        return handleReviewImageUpload(((_e_target_files = e.target.files) === null || _e_target_files === void 0 ? void 0 : _e_target_files[0]) || null);
                                                                    },
                                                                    className: "absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                                                }),
                                                                /*#__PURE__*/ _jsx("span", {
                                                                    className: "text-[9px] font-bold text-accent",
                                                                    children: "\uD83D\uDCE4 Upload Photo"
                                                                })
                                                            ]
                                                        })
                                                    ]
                                                })
                                            ]
                                        }),
                                        /*#__PURE__*/ _jsxs("div", {
                                            className: "flex gap-2 pt-1",
                                            children: [
                                                /*#__PURE__*/ _jsx("button", {
                                                    type: "submit",
                                                    disabled: submitting || uploadingImage,
                                                    className: "flex-1 py-2 bg-accent hover:bg-orange-500 text-white font-bold rounded-xl hoverEffect duration-300 disabled:opacity-50 text-[10px] uppercase tracking-wider",
                                                    children: submitting ? "Submitting..." : formMode === "review" ? "Submit Review" : "Submit Rating"
                                                }),
                                                /*#__PURE__*/ _jsx("button", {
                                                    type: "button",
                                                    onClick: ()=>{
                                                        setFormMode("none");
                                                        setComment("");
                                                        setReviewTitle("");
                                                        setReviewImage("");
                                                    },
                                                    className: "px-4 py-2 border border-gray-200 text-accent font-bold rounded-xl hover:bg-gray-50 hoverEffect duration-300 text-[10px] uppercase tracking-wider",
                                                    children: "Cancel"
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
                    className: "lg:col-span-8 flex flex-col gap-6",
                    children: [
                        aiAnalysis && /*#__PURE__*/ _jsxs("div", {
                            className: "border border-orange-200/40 bg-gradient-to-br from-orange-50/10 to-transparent p-5 rounded-3xl shadow-3xs",
                            children: [
                                /*#__PURE__*/ _jsxs("div", {
                                    className: "flex items-center gap-2 mb-3",
                                    children: [
                                        /*#__PURE__*/ _jsx(MdAutoAwesome, {
                                            className: "text-orange-500 text-lg animate-pulse"
                                        }),
                                        /*#__PURE__*/ _jsx("h4", {
                                            className: "text-xs font-black text-accent uppercase tracking-wider",
                                            children: "Customers Say"
                                        })
                                    ]
                                }),
                                /*#__PURE__*/ _jsx("p", {
                                    className: "text-[10px] text-lightText font-semibold italic mb-3",
                                    children: "Generated from the text of customer reviews"
                                }),
                                /*#__PURE__*/ _jsx("div", {
                                    className: "text-xs text-gray-700 leading-relaxed font-medium mb-4",
                                    dangerouslySetInnerHTML: {
                                        __html: generateAISummary().replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-accent">$1</strong>')
                                    }
                                }),
                                /*#__PURE__*/ _jsxs("div", {
                                    className: "space-y-2",
                                    children: [
                                        /*#__PURE__*/ _jsx("span", {
                                            className: "text-[10px] font-black uppercase text-lightText tracking-wider",
                                            children: "Select to learn more:"
                                        }),
                                        /*#__PURE__*/ _jsxs("div", {
                                            className: "flex flex-wrap gap-2",
                                            children: [
                                                aiAnalysis.pros.map((pro: any) =>/*#__PURE__*/ _jsxs("button", {
                                                        onClick: ()=>{
                                                            window.dispatchEvent(new CustomEvent("open-copilot", {
                                                                detail: {
                                                                    query: "Tell me about the ".concat(pro, " of ").concat(product.title, " based on customer reviews.")
                                                                }
                                                            }));
                                                        },
                                                        className: "px-3 py-1.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-xl border border-emerald-100/60 hover:bg-emerald-100/40 hoverEffect duration-200 flex items-center gap-1 shadow-2xs",
                                                        children: [
                                                            /*#__PURE__*/ _jsx("span", {
                                                                className: "w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0"
                                                            }),
                                                            /*#__PURE__*/ _jsx("span", {
                                                                children: pro
                                                            })
                                                        ]
                                                    }, pro)),
                                                aiAnalysis.cons.map((con: any) =>/*#__PURE__*/ _jsxs("button", {
                                                        onClick: ()=>{
                                                            window.dispatchEvent(new CustomEvent("open-copilot", {
                                                                detail: {
                                                                    query: "What do reviews say about the ".concat(con, " of ").concat(product.title, "?")
                                                                }
                                                            }));
                                                        },
                                                        className: "px-3 py-1.5 bg-rose-50 text-rose-700 text-[10px] font-bold rounded-xl border border-rose-100/60 hover:bg-rose-100/40 hoverEffect duration-200 flex items-center gap-1 shadow-2xs",
                                                        children: [
                                                            /*#__PURE__*/ _jsx("span", {
                                                                className: "w-1.5 h-1.5 bg-rose-500 rounded-full shrink-0"
                                                            }),
                                                            /*#__PURE__*/ _jsx("span", {
                                                                children: con
                                                            })
                                                        ]
                                                    }, con))
                                            ]
                                        })
                                    ]
                                })
                            ]
                        }),
                        reviewImages.length > 0 && /*#__PURE__*/ _jsxs("div", {
                            className: "space-y-3",
                            children: [
                                /*#__PURE__*/ _jsx("div", {
                                    className: "flex justify-between items-center",
                                    children: /*#__PURE__*/ _jsxs("h4", {
                                        className: "text-xs font-black text-accent uppercase tracking-wider flex items-center gap-1",
                                        children: [
                                            /*#__PURE__*/ _jsx(MdPhotoLibrary, {
                                                className: "text-sm text-gray-500"
                                            }),
                                            /*#__PURE__*/ _jsx("span", {
                                                children: "Reviews with images"
                                            })
                                        ]
                                    })
                                }),
                                /*#__PURE__*/ _jsx("div", {
                                    className: "relative group",
                                    children: /*#__PURE__*/ _jsx("div", {
                                        className: "flex gap-3 overflow-x-auto pb-2 scrollbar-none scroll-smooth",
                                        children: reviewImages.map((img, idx: any) =>/*#__PURE__*/ _jsx("div", {
                                                className: "w-28 h-28 border border-gray-150 rounded-2xl overflow-hidden bg-gray-50 flex-shrink-0 flex items-center justify-center p-1.5 shadow-2xs cursor-pointer hover:border-orange-400 hover:scale-98 hoverEffect duration-300",
                                                children: /*#__PURE__*/ _jsx(Image, {
                                                    src: img,
                                                    alt: "Review Upload ".concat(idx),
                                                    width: 120,
                                                    height: 120,
                                                    className: "max-h-full max-w-full object-contain rounded-xl"
                                                })
                                            }, idx))
                                    })
                                })
                            ]
                        }),
                        /*#__PURE__*/ _jsxs("div", {
                            className: "space-y-4",
                            children: [
                                /*#__PURE__*/ _jsx("h4", {
                                    className: "text-xs font-black text-accent uppercase tracking-wider border-b border-gray-100 pb-2",
                                    children: "Top reviews from verified users"
                                }),
                                reviews.length === 0 ? /*#__PURE__*/ _jsx("p", {
                                    className: "text-xs text-lightText italic py-4",
                                    children: "No customer reviews yet. Be the first to review this product!"
                                }) : /*#__PURE__*/ _jsx("div", {
                                    className: "space-y-5 divide-y divide-gray-100",
                                    children: reviews.map((rev: any) =>{
                                        let _session_user;
                                        const hasVoted = votedReviews[rev.reviewId];
                                        return /*#__PURE__*/ _jsxs("div", {
                                            className: "pt-4 first:pt-0 flex flex-col gap-2.5",
                                            children: [
                                                /*#__PURE__*/ _jsxs("div", {
                                                    className: "flex items-center gap-2",
                                                    children: [
                                                        /*#__PURE__*/ _jsx("div", {
                                                            className: "w-7 h-7 bg-accent text-white font-bold rounded-full flex items-center justify-center text-[10px] shadow-2xs uppercase",
                                                            children: formatUserEmail(rev.email).charAt(0)
                                                        }),
                                                        /*#__PURE__*/ _jsx("span", {
                                                            className: "text-xs font-black text-accent",
                                                            children: formatUserEmail(rev.email)
                                                        })
                                                    ]
                                                }),
                                                /*#__PURE__*/ _jsxs("div", {
                                                    className: "flex items-center gap-2",
                                                    children: [
                                                        /*#__PURE__*/ _jsx("div", {
                                                            className: "flex text-orange-400 text-sm",
                                                            children: Array.from({
                                                                length: 5
                                                            }).map((_, index: any) =>/*#__PURE__*/ _jsx(MdStar, {
                                                                    className: index < rev.rating ? "text-orange-400" : "text-gray-205"
                                                                }, index))
                                                        }),
                                                        /*#__PURE__*/ _jsx("span", {
                                                            className: "text-xs font-black text-accent",
                                                            children: rev.title || (rev.rating === 5 ? "Highly Recommended!" : rev.rating >= 4 ? "Good Quality" : "Satisfactory")
                                                        })
                                                    ]
                                                }),
                                                /*#__PURE__*/ _jsxs("div", {
                                                    className: "flex flex-wrap items-center gap-2 text-[10px] text-lightText font-semibold",
                                                    children: [
                                                        /*#__PURE__*/ _jsxs("span", {
                                                            children: [
                                                                "Reviewed on ",
                                                                new Date(rev.timestamp).toLocaleDateString("en-IN", {
                                                                    day: "numeric",
                                                                    month: "long",
                                                                    year: "numeric"
                                                                })
                                                            ]
                                                        }),
                                                        rev.verifiedPurchase && /*#__PURE__*/ _jsxs(_Fragment, {
                                                            children: [
                                                                /*#__PURE__*/ _jsx("span", {
                                                                    className: "w-1.5 h-1.5 bg-gray-300 rounded-full"
                                                                }),
                                                                /*#__PURE__*/ _jsx("span", {
                                                                    className: "text-orange-600 font-bold bg-orange-50 px-1.5 py-0.5 rounded-md border border-orange-100/30",
                                                                    children: "Verified Purchase"
                                                                })
                                                            ]
                                                        })
                                                    ]
                                                }),
                                                rev.comment ? /*#__PURE__*/ _jsx("p", {
                                                    className: "text-xs text-gray-700 leading-relaxed font-medium font-sans",
                                                    children: rev.comment
                                                }) : /*#__PURE__*/ _jsx("p", {
                                                    className: "text-xs text-lightText italic font-medium font-sans",
                                                    children: "Rating only (no review description left)."
                                                }),
                                                rev.images && rev.images.length > 0 && /*#__PURE__*/ _jsx("div", {
                                                    className: "flex gap-2 flex-wrap mt-1",
                                                    children: rev.images.map((imgUrl: any, imgIdx: any) =>/*#__PURE__*/ _jsx("div", {
                                                            className: "w-16 h-16 border border-gray-150 rounded-xl overflow-hidden bg-gray-50 flex items-center justify-center p-1 shadow-3xs hover:border-orange-400 hover:scale-98 hoverEffect duration-300",
                                                            children: /*#__PURE__*/ _jsx(Image, {
                                                                src: imgUrl,
                                                                alt: "Review upload ".concat(imgIdx),
                                                                width: 64,
                                                                height: 64,
                                                                className: "max-h-full max-w-full object-contain rounded-lg"
                                                            })
                                                        }, imgIdx))
                                                }),
                                                /*#__PURE__*/ _jsxs("div", {
                                                    className: "flex items-center gap-4 mt-1",
                                                    children: [
                                                        (session === null || session === void 0 ? void 0 : (_session_user = session.user) === null || _session_user === void 0 ? void 0 : _session_user.email) !== rev.email && /*#__PURE__*/ _jsxs("button", {
                                                            onClick: ()=>handleHelpfulVote(rev.reviewId),
                                                            disabled: hasVoted,
                                                            className: "flex items-center gap-1.5 px-3 py-1.5 border rounded-full text-[10px] font-bold shadow-3xs transition-all hoverEffect duration-300 ".concat(hasVoted ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-white border-gray-250 text-accent hover:bg-gray-50 hover:border-gray-400"),
                                                            children: [
                                                                /*#__PURE__*/ _jsx(MdThumbUp, {
                                                                    className: "text-[10px]"
                                                                }),
                                                                /*#__PURE__*/ _jsx("span", {
                                                                    children: hasVoted ? "Helpful ✓" : "Helpful"
                                                                })
                                                            ]
                                                        }),
                                                        rev.helpfulCount && rev.helpfulCount > 0 || hasVoted ? /*#__PURE__*/ _jsxs("span", {
                                                            className: "text-[10px] text-lightText font-bold",
                                                            children: [
                                                                (rev.helpfulCount || 0) + (hasVoted ? 1 : 0),
                                                                " ",
                                                                (rev.helpfulCount || 0) === 1 ? "person" : "people",
                                                                " found this helpful"
                                                            ]
                                                        }) : null
                                                    ]
                                                })
                                            ]
                                        }, rev.reviewId);
                                    })
                                })
                            ]
                        })
                    ]
                })
            ]
        })
    });
};

export default ProductReviewFeed;
