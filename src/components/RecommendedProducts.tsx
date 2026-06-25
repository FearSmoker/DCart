"use client";
import React, { useState, useEffect } from "react";
import { ProductData } from "../../types";
import ProductCard from "./ProductCard";
import Loader from "./Loader";
import { useSession } from "next-auth/react";

interface RecommendedProductsProps {
  type: "recommended" | "also-bought" | "trending";
  productId?: string;
  title: string;
}

const RecommendedProducts = ({ type, productId, title }: RecommendedProductsProps) => {
  const { data: session } = useSession();
  const [products, setProducts] = useState<ProductData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecommendations = async () => {
      setLoading(true);
      try {
        const emailParam = session?.user?.email ? `&email=${encodeURIComponent(session.user.email)}` : "";
        const productParam = productId ? `&productId=${encodeURIComponent(productId)}` : "";
        const res = await fetch(`/api/recommendations?type=${type}${emailParam}${productParam}`);
        const data = await res.json();
        if (data.success && data.products) {
          setProducts(data.products);
        }
      } catch (err) {
        console.error("Failed to load recommendations:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [type, productId, session?.user?.email]);

  if (loading) {
    return (
      <div className="py-10">
        <h2 className="text-2xl font-bold text-accent mb-6">{title}</h2>
        <Loader title="Generating recommendations..." />
      </div>
    );
  }

  if (products.length === 0) {
    return null;
  }

  return (
    <div className="py-10 text-left">
      <h2 className="text-2xl font-bold text-accent mb-6">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {products.map((item) => (
          <ProductCard item={item} key={item._id} />
        ))}
      </div>
    </div>
  );
};

export default RecommendedProducts;
