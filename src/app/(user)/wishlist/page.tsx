"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import Container from "@/components/Container";
import FormattedPrice from "@/components/FormattedPrice";
import AddToCartButton from "@/components/AddToCartButton";
import Loader from "@/components/Loader";
import { MdFavoriteBorder, MdOutlineShoppingBag, MdDelete } from "react-icons/md";
import { MdStar } from "react-icons/md";
import toast from "react-hot-toast";
import { ProductData } from "../../../../types";
import { useDispatch, useSelector } from "react-redux";
import { addToFavorite, setFavorites } from "@/redux/dcartSlice";
import AccessDenied from "@/components/AccessDenied";

const WishlistPage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const dispatch = useDispatch();
  const items = useSelector(
    (state: { dcart: { favorite: ProductData[] } }) => state.dcart.favorite
  ) || [];
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  const fetchWishlist = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/wishlist");
      const data = await res.json();
      if (data.success) {
        dispatch(setFavorites(data.items || []));
      }
    } catch (err) {
      console.error("Failed to load wishlist:", err);
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      router.push("/signin");
      return;
    }
    if (session?.user && (session.user as { role?: string }).role === "seller") {
      setLoading(false);
      return;
    }
    fetchWishlist();
  }, [status, fetchWishlist, router, session]);

  const handleRemove = async (productId: string) => {
    const product = items.find((p) => p._id === productId);
    if (!product) return;

    setRemoving(productId);

    // optimistic update
    dispatch(addToFavorite(product));
    toast.success("Removed from wishlist");

    try {
      const res = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, action: "remove" }),
      });
      const data = await res.json();
      if (!data.success) {
        // revert
        dispatch(addToFavorite(product));
        toast.error(data.message || "Failed to remove item");
      }
    } catch (err) {
      console.error(err);
      // revert
      dispatch(addToFavorite(product));
      toast.error("Failed to remove item");
    } finally {
      setRemoving(null);
    }
  };

  if (status === "loading" || (loading && !session)) {
    return (
      <Container className="py-16">
        <Loader title="Loading your wishlist..." />
      </Container>
    );
  }

  const isSeller = session?.user && (session.user as { role?: string }).role === "seller";
  if (isSeller) {
    return (
      <Container className="py-10">
        <AccessDenied message="Sellers are not permitted to manage a wishlist or purchase products." />
      </Container>
    );
  }

  if (loading) {
    return (
      <Container className="py-16">
        <Loader title="Loading your wishlist..." />
      </Container>
    );
  }

  return (
    <Container className="py-10">
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-8 border-b border-gray-100 dark:border-zinc-800 pb-6">
        <div className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-2xl">
          <MdFavoriteBorder className="text-2xl text-orange-500" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-accent dark:text-zinc-100">My Wishlist</h1>
          <p className="text-sm text-lightText dark:text-zinc-400 mt-0.5">
            {items.length === 0
              ? "Your wishlist is empty"
              : `${items.length} item${items.length === 1 ? "" : "s"} saved`}
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
          <div className="w-24 h-24 bg-orange-50 dark:bg-orange-950/20 rounded-full flex items-center justify-center mb-6 shadow-inner">
            <MdFavoriteBorder className="text-4xl text-orange-300 dark:text-orange-400" />
          </div>
          <h2 className="text-xl font-bold text-accent dark:text-zinc-100 mb-2">Your wishlist is empty</h2>
          <p className="text-lightText dark:text-zinc-400 max-w-sm mb-8 text-sm leading-relaxed">
            Browse our catalog and click the heart icon on any product to save it here for later.
          </p>
          <Link
            href="/shop"
            className="flex items-center gap-2 px-6 py-3 bg-accent dark:bg-zinc-100 text-white dark:text-black font-bold rounded-2xl hover:bg-orange-600 dark:hover:bg-lightOrange transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-0.5"
          >
            <MdOutlineShoppingBag className="text-lg" />
            Start Shopping
          </Link>
        </div>
      ) : (
        <>
          {/* Action Bar */}
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm font-semibold text-lightText dark:text-zinc-400">
              {items.length} saved item{items.length !== 1 ? "s" : ""}
            </p>
            <Link
              href="/shop"
              className="text-sm font-bold text-darkOrange hover:text-lightOrange transition-colors flex items-center gap-1"
            >
              <MdOutlineShoppingBag className="text-base" />
              Continue Shopping
            </Link>
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {items.map((product) => {
              const imageUrl =
                typeof product.image === "string"
                   ? product.image
                   : Array.isArray(product.image) && product.image.length > 0
                     ? typeof product.image[0] === "string"
                       ? product.image[0]
                       : "/notFound.png"
                     : "/notFound.png";

              const discount = product.rowprice && product.rowprice > product.price
                ? Math.round(((product.rowprice - product.price) / product.rowprice) * 100)
                : 0;

              return (
                <div
                  key={product._id}
                  className="group bg-white dark:bg-zinc-900 border border-gray-150/80 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs hover:shadow-md hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300 flex flex-col"
                >
                  {/* Image */}
                  <Link href={`/product/${product.slug?.current || product._id}`} className="relative block">
                    <div className="aspect-square bg-gray-50 dark:bg-zinc-850 flex items-center justify-center p-4 overflow-hidden">
                      <Image
                        src={imageUrl}
                        alt={product.title}
                        width={300}
                        height={300}
                        className="max-h-full max-w-full object-contain transition-transform duration-500"
                      />
                    </div>
                    {discount > 0 && (
                      <span className="absolute top-3 left-3 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                        -{discount}% OFF
                      </span>
                    )}
                  </Link>

                  {/* Content */}
                  <div className="p-4 flex flex-col gap-2 flex-1 bg-white dark:bg-zinc-900">
                    <Link href={`/product/${product.slug?.current || product._id}`}>
                      <h3 className="text-sm font-bold text-accent dark:text-zinc-100 line-clamp-2 leading-snug hover:text-darkOrange dark:hover:text-lightOrange transition-colors">
                        {product.title}
                      </h3>
                    </Link>

                    {product.brand && (
                      <p className="text-[10px] font-bold uppercase text-lightText dark:text-zinc-400 tracking-wider">
                        {product.brand}
                      </p>
                    )}

                    {/* Stars */}
                    {product.ratings && (
                      <div className="flex items-center gap-1">
                        <div className="flex text-orange-400 text-xs">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <MdStar
                              key={i}
                              className={i < Math.floor(product.ratings || 5) ? "text-orange-400" : "text-gray-200 dark:text-zinc-700"}
                            />
                          ))}
                        </div>
                        <span className="text-[10px] text-lightText dark:text-zinc-400 font-medium">({product.ratings})</span>
                      </div>
                    )}

                    {/* Price */}
                    <div className="flex items-baseline gap-2 mt-auto">
                      <FormattedPrice amount={product.price} className="text-base font-black text-accent dark:text-zinc-100" />
                      {product.rowprice && product.rowprice > product.price && (
                        <FormattedPrice amount={product.rowprice} className="text-xs text-lightText dark:text-zinc-500 line-through" />
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 mt-2">
                      <AddToCartButton item={product} className="flex-1 rounded-xl py-2.5 text-xs" />
                      <button
                        onClick={() => handleRemove(product._id)}
                        disabled={removing === product._id}
                        className="p-2.5 border border-red-100 dark:border-red-950 bg-red-50 dark:bg-red-950/20 text-red-500 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/50 transition-all duration-200 disabled:opacity-50 flex-shrink-0"
                        title="Remove from wishlist"
                      >
                        {removing === product._id ? (
                          <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <MdDelete className="text-base" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Container>
  );
};

export default WishlistPage;
