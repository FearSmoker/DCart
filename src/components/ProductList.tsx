import { getProductsData } from "@/lib/getData";
import React from "react";
import { ProductData } from "../../types";
import ProductCard from "./ProductCard";
import Link from "next/link";

export const revalidate = 0;

interface ProductListProps {
  page?: number;
  limit?: number;
}

const ProductList = async ({ page = 1, limit = 8 }: ProductListProps) => {
  const allProducts: ProductData[] = await getProductsData();

  if (!allProducts || allProducts.length === 0) {
    return (
      <div className="w-full min-h-[400px] flex flex-col items-center justify-center py-16 px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-accent mb-2">No Products Available</h3>
          <p className="text-sm text-lightText leading-relaxed">
            We&apos;re currently curating our product catalog. Please check back shortly — new arrivals are on their way.
          </p>
        </div>
      </div>
    );
  }

  const total = allProducts.length;
  const totalPages = Math.ceil(total / limit);
  const activePage = Math.max(1, Math.min(page, totalPages));
  const products = allProducts.slice((activePage - 1) * limit, activePage * limit);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {products?.map((item) => <ProductCard item={item} key={item?._id} />)}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-6">
          <Link
            href={`/?page=${activePage - 1}`}
            className={`px-4 py-2 border rounded-xl font-bold text-xs transition-all ${
              activePage <= 1
                ? "pointer-events-none opacity-50 bg-gray-100 border-gray-200 text-gray-400"
                : "border-gray-200 bg-white hover:bg-slate-50 text-accent hover:border-slate-350"
            }`}
          >
            ← Previous
          </Link>

          {Array.from({ length: totalPages }).map((_, idx) => {
            const pNum = idx + 1;
            const isActive = pNum === activePage;
            return (
              <Link
                key={pNum}
                href={`/?page=${pNum}`}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                  isActive
                    ? "bg-lightOrange text-white border-lightOrange shadow-sm"
                    : "border-gray-200 bg-white text-accent hover:bg-slate-50 hover:border-slate-350"
                }`}
              >
                {pNum}
              </Link>
            );
          })}

          <Link
            href={`/?page=${activePage + 1}`}
            className={`px-4 py-2 border rounded-xl font-bold text-xs transition-all ${
              activePage >= totalPages
                ? "pointer-events-none opacity-50 bg-gray-100 border-gray-200 text-gray-400"
                : "border-gray-200 bg-white hover:bg-slate-50 text-accent hover:border-slate-350"
            }`}
          >
            Next →
          </Link>
        </div>
      )}
    </div>
  );
};

export default ProductList;

