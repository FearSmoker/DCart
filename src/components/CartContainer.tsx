"use client";
import Image from "next/image";
import React, { useEffect, useState } from "react";
import emptyCart from "@/assets/emptyCart.png";
import { useDispatch, useSelector } from "react-redux";
import { StoreState } from "../../types";
import toast from "react-hot-toast";
import { resetCart, resetBuyNowCart } from "@/redux/dcartSlice";
import FormattedPrice from "./FormattedPrice";
import { motion } from "framer-motion";
import Link from "next/link";
import CartItem from "./CartItem";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const CartContainer = () => {
  const [totalAmt, setTotalAmt] = useState(0);
  const { cart } = useSelector((state: StoreState) => state?.dcart);
  const dispatch = useDispatch();
  const { data: session } = useSession();
  const router = useRouter();
  
  const isSeller = session?.user && (session.user as { role?: string }).role === "seller";

  const handleReset = () => {
    const confirmed = window.confirm("Are you sure to reset your Cart?");
    if (confirmed) {
      dispatch(resetCart());
      toast.success("Cart reset successfully!");
    }
  };

  useEffect(() => {
    let price = 0;
    cart.map((item) => {
      price += item?.price * item?.quantity;
      return price;
    });
    setTotalAmt(price);
  }, [cart]);

  const handleProceedToCheckout = () => {
    dispatch(resetBuyNowCart());
    router.push("/checkout");
  };

  if (isSeller) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h1 className="text-xl font-bold uppercase mb-4 text-accent">Access Denied</h1>
        <p className="text-sm text-lightText max-w-[500px]">
          Sellers are not permitted to purchase products or manage a shopping cart. Please use a consumer account to shop.
        </p>
        <Link
          href="/"
          className="bg-lightOrange text-white hover:bg-darkOrange hoverEffect px-8 py-3 rounded-lg font-semibold mt-6"
        >
          Return to Home
        </Link>
      </div>
    );
  }

  return (
    <div>
      {cart?.length > 0 ? (
        <div className="pb-20 bg-white dark:bg-zinc-900 text-black dark:text-zinc-100">
          <div className="w-full h-20 bg-[#f5f7f7] dark:bg-zinc-850 text-primeColor dark:text-zinc-200 hidden lg:grid grid-cols-5 place-content-center px-6 text-lg font-semibold border-b dark:border-zinc-850">
            <h2 className="col-span-2">Product</h2>
            <h2>Price</h2>
            <h2>Quantity</h2>
            <h2>Sub Total</h2>
          </div>
          <div className="mt-5">
            {cart.map((item) => (
              <div key={item?._id}>
                <CartItem item={item} cart={cart} />
              </div>
            ))}
          </div>
          <button
            onClick={handleReset}
            className="py-2 px-10 bg-red-500 text-white font-semibold uppercase mb-4 hover:bg-red-700 duration-300 rounded"
          >
            Reset cart
          </button>
          <div className="flex flex-col md:flex-row justify-between border border-gray-250 dark:border-zinc-800 p-4 items-center gap-2 md:gap-0 bg-white dark:bg-zinc-900 rounded-xl">
            <div className="flex items-center gap-4">
              <input
                type="text"
                placeholder="Coupon Number"
                className="w-44 lg:w-52 h-8 px-4 border bg-transparent text-primeColor dark:text-zinc-100 text-sm outline-none border-gray-400 dark:border-zinc-700 rounded-lg"
              />
              <p className="text-lg font-semibold">Apply Coupon</p>
            </div>
            <p className="cursor-pointer hover:text-darkOrange transition-colors">Update Cart</p>
          </div>
          <div className="max-w-7xl gap-4 flex justify-end mt-6">
            <div className="w-96 flex flex-col gap-4">
              <h1 className="text-2xl font-semibold text-right text-accent dark:text-zinc-100">Cart totals</h1>
              <div className="rounded-xl overflow-hidden border border-gray-400 dark:border-zinc-800">
                <p className="flex items-center justify-between border-b border-gray-400 dark:border-zinc-800 py-2.5 text-lg px-4 font-medium bg-gray-50/50 dark:bg-zinc-800/10">
                  Subtotal <FormattedPrice amount={totalAmt} />
                </p>
                <p className="flex items-center justify-between border-b border-gray-400 dark:border-zinc-800 py-2.5 text-lg px-4 font-medium bg-gray-50/50 dark:bg-zinc-800/10">
                  Shipping Charge
                  <span className="font-semibold tracking-wide">
                    <FormattedPrice amount={0} />
                  </span>
                </p>
                <p className="flex items-center justify-between py-2.5 text-lg px-4 font-semibold bg-gray-50/80 dark:bg-zinc-800/30">
                  Total
                  <span className="font-bold tracking-wide text-lg text-darkOrange dark:text-lightOrange">
                    <FormattedPrice amount={totalAmt} />
                  </span>
                </p>
              </div>
              <div className="flex justify-end flex-col text-center">
                <button
                  onClick={handleProceedToCheckout}
                  disabled={!session?.user}
                  className="bg-lightOrange text-white hover:bg-darkOrange hoverEffect px-8 py-3 rounded-lg font-semibold disabled:bg-lightOrange/50 dark:disabled:bg-zinc-850 dark:disabled:text-zinc-550 disabled:cursor-not-allowed"
                >
                  Proceed to Checkout
                </button>
                {!session?.user && (
                  <Link
                    href={"/signin"}
                    className="text-sm font-medium text-darkOrange dark:text-lightOrange mt-2"
                  >
                    Please sign in to Checkout
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col md:flex-row justify-center items-center gap-4 py-32 bg-white dark:bg-zinc-900"
        >
          <div>
            <Image
              src={emptyCart}
              alt="emptyCart"
              className="w-80 rounded-lg p-4 mx-auto dark:opacity-80"
            />
          </div>
          <div className="max-w-[500px] p-6 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 flex flex-col gap-4 items-center rounded-2xl shadow-lg">
            <h1 className="text-xl font-bold uppercase text-accent dark:text-zinc-100">
              Your Cart feels lonely.
            </h1>
            <p className="text-sm text-center text-zinc-650 dark:text-zinc-400 px-4 -mt-2">
              Your Shopping cart lives to serve. Give it purpose - fill it with
              books, electronics, videos, etc. and make it happy.
            </p>
            <Link
              href={"/"}
              className="bg-lightOrange text-white hover:bg-darkOrange hoverEffect px-8 py-3 rounded-lg font-semibold"
            >
              Continue Shopping
            </Link>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default CartContainer;
