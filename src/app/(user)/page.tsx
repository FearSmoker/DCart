import Container from "@/components/Container";
import React from "react";
import Banner from "@/components/Banner";
import Facilities from "@/components/Facilities";
import ProductList from "@/components/ProductList";
import RecommendedProducts from "@/components/RecommendedProducts";
import { auth } from "@/auth";
import Link from "next/link";

interface HomeProps {
  searchParams?: {
    page?: string;
  };
}

const Home = async ({ searchParams }: HomeProps) => {
  const session = await auth();
  let showUnapprovedAlert = false;
  if (session?.user?.email) {
    try {
      const { adminDB } = await import("@/firebaseAdmin");
      const userDoc = await adminDB.collection("users").doc(session.user.email).get();
      if (userDoc.exists) {
        const data = userDoc.data();
        if (data?.role === "seller" && data?.sellerStatus !== "approved") {
          showUnapprovedAlert = true;
        }
      }
    } catch (err) {
      console.warn("Failed to check seller status on home page:", err);
    }
  }

  const page = parseInt(searchParams?.page || "1", 10);
  const limit = 8;

  return (
    <Container className="py-10">
      {showUnapprovedAlert && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl shadow-xs text-center">
          <Link
            href="/vendor/register"
            className="text-red-700 hover:text-red-800 font-bold text-sm transition-colors animate-pulse"
          >
            You are unapproved and thus unable to sell. Click here to become an approved seller.
          </Link>
        </div>
      )}
      <Banner />
      <Facilities />
      <ProductList page={page} limit={limit} />
      <RecommendedProducts type="recommended" title="Recommended For You" />
      <RecommendedProducts type="trending" title="Trending Near You" />
    </Container>
  );
};

export default Home;
