import React from "react";
import Container from "@/components/Container";
import ProductCard from "@/components/ProductCard";
import { searchProducts } from "@/lib/searchService";
import Link from "next/link";
import { CiSearch } from "react-icons/ci";

export const revalidate = 0;

interface SearchPageProps {
  searchParams: {
    q?: string;
  };
}

const SearchPage = async ({ searchParams }: SearchPageProps) => {
  const query = searchParams.q || "";
  const products = await searchProducts(query);

  return (
    <Container className="py-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-lightText/20 pb-5 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-accent">
            {query ? `Search Results for "${query}"` : "All Products"}
          </h1>
          <p className="text-lightText mt-1 text-sm">
            {products.length === 0
              ? "No products found"
              : `Found ${products.length} product${products.length === 1 ? "" : "s"}`}
          </p>
        </div>
        {query && (
          <Link
            href="/search"
            className="text-sm font-semibold text-lightOrange hover:text-darkOrange transition-colors"
          >
            Clear Search
          </Link>
        )}
      </div>

      {products.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {products.map((item) => (
            <ProductCard item={item} key={item._id} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <div className="w-20 h-20 bg-gray-50 border border-gray-100 rounded-full flex items-center justify-center mb-6 text-lightText/70 shadow-inner">
            <CiSearch className="text-4xl" />
          </div>
          <h2 className="text-xl font-bold text-accent mb-2">No matching products</h2>
          <p className="text-lightText max-w-md mb-8">
            We couldn&apos;t find any results for <span className="font-semibold text-darkOrange">&quot;{query}&quot;</span>. 
            Try checking your spelling or using more general terms.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <span className="text-sm text-lightText py-1.5 font-medium">Suggested:</span>
            {["iPhone", "Watch", "MacBook", "iPad"].map((term) => (
              <Link
                key={term}
                href={`/search?q=${term}`}
                className="text-sm bg-gray-100 hover:bg-lightOrange/10 hover:text-lightOrange px-4 py-1.5 rounded-full transition-all duration-200 border border-gray-200"
              >
                {term}
              </Link>
            ))}
          </div>
        </div>
      )}
    </Container>
  );
};

export default SearchPage;
