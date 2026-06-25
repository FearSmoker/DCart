"use client";

import Container from "@/components/Container";
import ProductCard from "@/components/ProductCard";
import React, { useEffect, useState, useMemo } from "react";
import { ProductData } from "../../../../types";
import { MdOutlineGridView, MdViewList, MdSort } from "react-icons/md";
import { CiSearch } from "react-icons/ci";
import Image from "next/image";

const CATEGORIES = [
  { label: "All", value: "all", icon: "" },
  { label: "Phones", value: "phones", icon: "" },
  { label: "Laptops", value: "laptops", icon: "" },
  { label: "Audio", value: "audio", icon: "" },
  { label: "Smartwatches", value: "smartwatches", icon: "" },
  { label: "Cameras", value: "cameras", icon: "" },
  { label: "Sports", value: "sports", icon: "" },
  { label: "Streetwear", value: "streetwear", icon: "" },
  { label: "Accessories", value: "accessories", icon: "" },
];

const SORT_OPTIONS = [
  { label: "Featured", value: "featured" },
  { label: "Price: Low to High", value: "price_asc" },
  { label: "Price: High to Low", value: "price_desc" },
  { label: "Top Rated", value: "rating" },
  { label: "Newest First", value: "newest" },
];

const ShopPage = () => {
  const [products, setProducts] = useState<ProductData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState("featured");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 250000]);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        // try to fetch all products via...
        const res = await fetch("/api/search?q=");
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.products && data.products.length > 0) {
            setProducts(data.products);
            setLoading(false);
            return;
          }
        }
      } catch { /* fall through */ }

      // fallback: use recommendations trending endpoint (returns...
      try {
        const res = await fetch("/api/recommendations?type=trending");
        const data = await res.json();
        if (data.success && data.products) {
          setProducts(data.products);
        }
      } catch (err) {
        console.error("Failed to load products:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // compute max price for slider
  const maxPrice = useMemo(() => {
    if (products.length === 0) return 250000;
    return Math.ceil(Math.max(...products.map((p) => p.price)) / 1000) * 1000;
  }, [products]);

  // filter and sort
  const displayedProducts = useMemo(() => {
    let filtered = [...products];

    // category filter
    if (selectedCategory !== "all") {
      filtered = filtered.filter((p) => {
        const cats = (p.category || []).map((c) => c.name.toLowerCase());
        return cats.some((c) => c.includes(selectedCategory.toLowerCase()));
      });
    }

    // search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          (p.brand || "").toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q)
      );
    }

    // price range
    filtered = filtered.filter(
      (p) => p.price >= priceRange[0] && p.price <= priceRange[1]
    );

    // sort
    switch (sortBy) {
      case "price_asc":
        filtered.sort((a, b) => a.price - b.price);
        break;
      case "price_desc":
        filtered.sort((a, b) => b.price - a.price);
        break;
      case "rating":
        filtered.sort((a, b) => (b.ratings || 0) - (a.ratings || 0));
        break;
      case "newest":
        filtered.sort((a, b) =>
          new Date(b._createdAt).getTime() - new Date(a._createdAt).getTime()
        );
        break;
      default:
        break;
    }

    return filtered;
  }, [products, selectedCategory, sortBy, searchQuery, priceRange]);

  if (loading) {
    return (
      <Container className="py-10">
        <div className="space-y-6">
          <div className="h-8 w-48 bg-gray-100 rounded-xl animate-pulse" />
          <div className="flex gap-3 overflow-x-auto">
            {CATEGORIES.map((c) => (
              <div key={c.value} className="h-10 w-28 bg-gray-100 rounded-xl animate-pulse flex-shrink-0" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-72 bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-10">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-accent">Shop All Products</h1>
        <p className="text-lightText text-sm mt-1">
          Discover our curated collection of premium products
        </p>
      </div>

      {/* category tabs */}
      <div className="flex gap-2.5 overflow-x-auto pb-2 mb-6 scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setSelectedCategory(cat.value)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold whitespace-nowrap transition-all duration-200 flex-shrink-0 border ${
              selectedCategory === cat.value
                ? "bg-accent text-white border-accent shadow-sm"
                : "bg-white text-accent border-gray-100 hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            <span>{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Controls Row */}
      <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-gray-50/60 border border-gray-100 rounded-2xl">
        {/* Search */}
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 flex-1 min-w-[200px] max-w-xs focus-within:ring-1 focus-within:ring-orange-400 transition-all">
          <CiSearch className="text-lightText text-base shrink-0" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 text-sm bg-transparent outline-none text-accent placeholder:text-lightText"
          />
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <MdSort className="text-lightText text-lg" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-sm bg-white border border-gray-200 rounded-xl px-3 py-2 text-accent focus:outline-none focus:ring-1 focus:ring-orange-400"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* View Mode */}
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === "grid" ? "bg-accent text-white" : "text-lightText hover:bg-gray-100"
            }`}
            title="Grid View"
          >
            <MdOutlineGridView className="text-base" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === "list" ? "bg-accent text-white" : "text-lightText hover:bg-gray-100"
            }`}
            title="List View"
          >
            <MdViewList className="text-base" />
          </button>
        </div>

        {/* Results count */}
        <p className="text-sm font-semibold text-lightText ml-auto">
          {displayedProducts.length}{" "}
          {displayedProducts.length === 1 ? "product" : "products"} found
        </p>
      </div>

      {/* Price Range Quick Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { label: "Under ₹5K", min: 0, max: 5000 },
          { label: "₹5K–₹20K", min: 5000, max: 20000 },
          { label: "₹20K–₹50K", min: 20000, max: 50000 },
          { label: "₹50K–₹1L", min: 50000, max: 100000 },
          { label: "Above ₹1L", min: 100000, max: 250000 },
          { label: "All Prices", min: 0, max: maxPrice },
        ].map((range) => {
          const isActive = priceRange[0] === range.min && priceRange[1] === range.max;
          return (
            <button
              key={range.label}
              onClick={() => setPriceRange([range.min, range.max])}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                isActive
                  ? "bg-orange-500/10 border-orange-400 text-orange-600"
                  : "bg-white border-gray-200 text-lightText hover:border-gray-300"
              }`}
            >
              {range.label}
            </button>
          );
        })}
      </div>

      {/* Product Grid */}
      {displayedProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4 shadow-inner">
            <CiSearch className="text-3xl text-lightText" />
          </div>
          <h2 className="text-xl font-bold text-accent mb-2">No products found</h2>
          <p className="text-lightText text-sm max-w-sm">
            Try adjusting your filters or search terms to find what you&apos;re looking for.
          </p>
          <button
            onClick={() => {
              setSelectedCategory("all");
              setSearchQuery("");
              setSortBy("featured");
              setPriceRange([0, maxPrice]);
            }}
            className="mt-4 px-4 py-2 bg-accent text-white text-sm font-bold rounded-xl hover:bg-orange-600 transition-colors"
          >
            Clear All Filters
          </button>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {displayedProducts.map((item) => (
            <ProductCard item={item} key={item._id} />
          ))}
        </div>
      ) : (
        /* List view */
        <div className="space-y-3">
          {displayedProducts.map((item) => {
            const imageUrl =
              typeof item.image === "string"
                ? item.image
                : "/notFound.png";
            const discount = item.rowprice && item.rowprice > item.price
              ? Math.round(((item.rowprice - item.price) / item.rowprice) * 100)
              : 0;

            return (
              <a
                key={item._id}
                href={`/product/${item.slug?.current || item._id}`}
                className="flex gap-5 bg-white border border-gray-100 rounded-2xl p-4 shadow-xs hover:shadow-md hover:scale-[1.01] hover:-translate-y-0.5 transition-all group"
              >
                <div className="w-24 h-24 bg-gray-50 rounded-xl flex items-center justify-center p-2 flex-shrink-0">
                  <Image
                    src={imageUrl}
                    alt={item.title}
                    width={96}
                    height={96}
                    className="max-h-full max-w-full object-contain transition-transform"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase text-lightText tracking-wider mb-0.5">
                    {item.brand}
                  </p>
                  <h3 className="text-sm font-bold text-accent line-clamp-1 group-hover:text-darkOrange transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-xs text-lightText line-clamp-2 mt-1 leading-relaxed">
                    {item.description}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-base font-black text-accent">
                      ₹{item.price.toLocaleString("en-IN")}
                    </span>
                    {item.rowprice && item.rowprice > item.price && (
                      <span className="text-xs text-lightText line-through">
                        ₹{item.rowprice.toLocaleString("en-IN")}
                      </span>
                    )}
                    {discount > 0 && (
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        -{discount}% OFF
                      </span>
                    )}
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </Container>
  );
};

export default ShopPage;
