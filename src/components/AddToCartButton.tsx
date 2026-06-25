"use client";

import { twMerge } from "tailwind-merge";
import SmallLoader from "./SmallLoader";
import { useDispatch, useSelector } from "react-redux";
import { useState } from "react";
import toast from "react-hot-toast";
import { addToCart } from "@/redux/dcartSlice";
import { ProductData } from "../../types";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Props {
  className?: string;
  item: ProductData;
}

const AddToCartButton = ({ className, item }: Props) => {
  const { data: session } = useSession();
  const isSeller = session?.user && (session.user as { role?: string }).role === "seller";

  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  const router = useRouter();

  const cart = useSelector(
    (state: { dcart: { cart: ProductData[] } }) => state.dcart.cart
  ) || [];
  const isInCart = cart.some((cartItem) => cartItem._id === item?._id);

  const stockMap = useSelector(
    (state: { dcart: { stockMap: Record<string, number> } }) => state.dcart.stockMap
  ) || {};
  const currentStock =
    stockMap[item?._id] !== undefined ? stockMap[item?._id] : item?.quantity;

  const isOutOfStock = currentStock !== undefined && currentStock <= 0;

  const handleAddToCart = () => {
    if (isOutOfStock) {
      toast.error("This product is temporarily out of stock!");
      return;
    }

    try {
      setLoading(true);
      dispatch(addToCart(item));
      toast.success(`${item?.title.substring(12, 0)} added successfully!`);
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("An unexpected error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isInCart) {
      router.push("/cart");
    } else {
      handleAddToCart();
    }
  };

  if (isSeller) return null;

  return (
    <button
      onClick={handleClick}
      disabled={(!isInCart && isOutOfStock) || loading}
      className={twMerge(
        "bg-accent text-white dark:bg-zinc-100 dark:text-black w-full py-2 border border-px border-accent dark:border-zinc-100 hover:bg-darkOrange hover:border-darkOrange dark:hover:bg-lightOrange dark:hover:border-lightOrange dark:hover:text-white hoverEffect font-semibold tracking-wide flex items-center justify-center gap-1",
        !isInCart && isOutOfStock && "bg-gray-400 border-gray-400 hover:bg-gray-400 hover:border-gray-400 dark:bg-zinc-800 dark:text-zinc-500 dark:border-zinc-800 dark:hover:bg-zinc-800 dark:hover:border-zinc-800 cursor-not-allowed",
        className
      )}
    >
      {isInCart ? "Go to Cart" : isOutOfStock ? "Out of Stock" : "Add to cart"} {loading && <SmallLoader />}
    </button>
  );
};

export default AddToCartButton;
