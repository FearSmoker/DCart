"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { resetBuyNowCart } from "@/redux/dcartSlice";
import Loader from "@/components/Loader";

export default function CancelPage() {
  const router = useRouter();
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(resetBuyNowCart());
    router.replace("/orders?payment=failed");
  }, [router, dispatch]);

  return <Loader title="Redirecting to your orders..." className="min-h-[60vh]" />;
}
