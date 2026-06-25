"use client";
import React from "react";
import { ProductData } from "../../types";
import Link from "next/link";
import Image from "next/image";

import { urlFor } from "@/sanity/lib/image";
import { MdStar, MdFavorite, MdFavoriteBorder } from "react-icons/md";
import FormattedPrice from "./FormattedPrice";
import AddToCartButton from "./AddToCartButton";
import { useCompare } from "./ProductComparison";
import DynamicPriceBadge from "./DynamicPriceBadge";
import { useDispatch, useSelector } from "react-redux";
import { useSession } from "next-auth/react";
import { addToFavorite, setFavorites } from "@/redux/dcartSlice";
import toast from "react-hot-toast";

const ProductCard = ({ item }: { item: ProductData }) => {
  const { addToCompare, removeFromCompare, isInCompare } = useCompare();
  const inCompare = isInCompare(item._id);

  const { data: session } = useSession();
  const isSeller = session?.user && (session.user as { role?: string }).role === "seller";
  const dispatch = useDispatch();
  const favorite = useSelector(
    (state: { dcart: { favorite: ProductData[] } }) => state.dcart.favorite
  ) || [];

  const isWishlisted = favorite.some((fav) => fav._id === item._id);

  const handleCompareToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (inCompare) {
      removeFromCompare(item._id);
    } else {
      addToCompare(item);
    }
  };

  const handleWishlistToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!session?.user?.email) {
      toast.error("Please sign in to manage your wishlist.");
      return;
    }

    if (isSeller) {
      toast.error("Sellers cannot manage wishlists.");
      return;
    }

    const action = isWishlisted ? "remove" : "add";

    // optimistic redux update
    dispatch(addToFavorite(item));
    toast.success(isWishlisted ? "Removed from wishlist" : "Added to wishlist successfully!");

    try {
      const res = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: item._id, action }),
      });
      const data = await res.json();
      if (!data.success) {
        // revert on failure
        dispatch(addToFavorite(item));
        toast.error(data.message || "Failed to update wishlist.");
      } else {
        // sync redux with redis after wishlist update
        try {
          const syncRes = await fetch("/api/wishlist");
          const syncData = await syncRes.json();
          if (syncData.success) {
            dispatch(setFavorites(syncData.items || []));
          }
        } catch { /* non-critical sync — optimistic state still valid */ }
      }
    } catch (err) {
      console.error(err);
      // revert on failure
      dispatch(addToFavorite(item));
      toast.error("Error updating wishlist.");
    }
  };  return (
    <div
      key={item?._id}
      className="border border-gray-150/80 dark:border-zinc-800 rounded-[24px] relative group overflow-hidden bg-white dark:bg-zinc-900 shadow-xs hover:shadow-[0_15px_30px_rgba(0,0,0,0.05)] dark:hover:shadow-[0_15px_30px_rgba(0,0,0,0.25)] hover:scale-[1.02] hoverEffect duration-300 flex flex-col h-full"
    >
      <Link
        href={`/product/${typeof item?.slug === "string" ? item.slug : item?.slug?.current}`}
        className="block flex-1 flex flex-col cursor-pointer"
        aria-label={`View details of ${item?.title}`}
      >
        <div className="overflow-hidden relative w-full h-72 bg-[#f7f7f7] dark:bg-zinc-955/30 flex items-center justify-center">
          <Image
            src={typeof item?.image === "string" ? item.image : (item?.image ? urlFor(item.image)?.url() : "/notFound.png")}
            alt={item?.title || "Product"}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-contain p-6"
          />
        </div>
        <div className="px-6 flex flex-col items-center gap-2 pb-20 pt-4 flex-1">
          {item?.ratings > 0 && item?.ratingCount && item.ratingCount > 0 ? (
            <div className="text-base flex items-center gap-1.5">
              <div className="flex">
                {Array?.from({ length: 5 })?.map((_, index) => {
                  const filled = index + 1 <= Math.floor(item?.ratings);
                  const halfFilled =
                    index + 1 > Math.floor(item?.ratings) &&
                    index < Math.ceil(item?.ratings);

                  return (
                    <MdStar
                      key={index}
                      className={`${
                        filled
                          ? "text-[#fa8900]"
                          : halfFilled
                            ? "text-[#f7ca00]"
                            : "text-lightText dark:text-zinc-600"
                      }`}
                    />
                  );
                })}
              </div>
              <span className="text-[10px] text-lightText dark:text-zinc-400 font-bold">
                ({item.ratingCount})
              </span>
            </div>
          ) : null}
          <p className="uppercase text-[10px] tracking-wider font-extrabold text-lightOrange">
            {item?.brand}
          </p>
          <h2 className="text-sm font-bold text-accent dark:text-zinc-150 line-clamp-1">
            {item?.title}
          </h2>
          <p className="text-center text-xs line-clamp-2 text-zinc-400 dark:text-zinc-505">{item?.description}</p>
          <div className="flex items-center gap-3 mt-1 mb-2">
            <p className="text-xs text-lightText dark:text-zinc-505 line-through">
              <FormattedPrice amount={item?.rowprice} />
            </p>
            <p className="text-sm text-darkOrange dark:text-lightOrange font-bold">
              <FormattedPrice amount={item?.price} />
            </p>
          </div>
        </div>
      </Link>

      {/* Floating Badges & Action Buttons (overlay style) */}
      <div className="absolute top-3 left-3 z-30">
        <DynamicPriceBadge productId={item._id} basePrice={item.price} />
      </div>

      {/* Compare toggle button */}
      <button
        onClick={handleCompareToggle}
        title={inCompare ? "Remove from comparison" : "Add to comparison"}
        aria-label={inCompare ? "Remove from comparison" : "Add to comparison"}
        className={`absolute top-3 right-3 p-1.5 rounded-full text-xs font-semibold flex items-center justify-center shadow-xs transition-all duration-200 z-30 ${
          inCompare
            ? "bg-lightOrange text-white"
            : "bg-white/95 dark:bg-zinc-800/95 text-accent dark:text-zinc-200 hover:bg-lightOrange dark:hover:bg-lightOrange hover:text-white dark:hover:text-white"
        }`}
      >
        <div className="relative">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="absolute -top-1 -right-1.5 text-[8px] font-black leading-none text-current">+</span>
        </div>
      </button>

      {/* Wishlist toggle button */}
      {(!session?.user || (session.user as { role?: string }).role !== "seller") && (
        <button
          onClick={handleWishlistToggle}
          title={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
          className={`absolute top-11 right-3 p-1.5 transition-all duration-200 z-30 hover:scale-110 active:scale-90 ${
            isWishlisted
              ? "text-red-500"
              : "text-zinc-400 hover:text-red-500 dark:text-zinc-505 dark:hover:text-red-500"
          }`}
        >
          {isWishlisted ? (
            <MdFavorite className="w-5.5 h-5.5 text-red-500" />
          ) : (
            <MdFavoriteBorder className="w-5.5 h-5.5" />
          )}
        </button>
      )}

      {/* Add To Cart button (overlay style at bottom) */}
      {!isSeller && (
        <div className="absolute bottom-5 left-6 right-6 z-30">
          <AddToCartButton item={item} className="w-full rounded-full py-2 border-0 shadow-xs hover:shadow-sm text-xs font-bold" />
        </div>
      )}
    </div>
  );
};

export default ProductCard;
