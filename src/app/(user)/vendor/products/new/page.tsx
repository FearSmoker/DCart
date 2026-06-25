"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Link from "next/link";
import Image from "next/image";
import Loader from "@/components/Loader";
import AccessDenied from "@/components/AccessDenied";
import Container from "@/components/Container";

interface VariantForm {
  color: string;
  model: string;
  price: string;
  quantity: string;
  images: string[];
}

interface CustomFieldForm {
  key: string;
  value: string;
}

export default function NewProductPage() {
  const { data: session, status: authStatus, update } = useSession();
  const router = useRouter();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isApprovedSeller, setIsApprovedSeller] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("electronics");
  const [type, setType] = useState("");
  const [brand, setBrand] = useState("Generic");

  const [material, setMaterial] = useState("");
  const [modelInfo, setModelInfo] = useState("");
  const [materialsCare, setMaterialsCare] = useState<string[]>(["", "", "", ""]);
  const [featuresSpecs, setFeaturesSpecs] = useState<string[]>(["", "", "", ""]);
  const [measurements, setMeasurements] = useState<string[]>(["", "", "", ""]);
  const [inTheBox, setInTheBox] = useState<string[]>([""]);

  const [customFields, setCustomFields] = useState<CustomFieldForm[]>([]);
  const [variants, setVariants] = useState<VariantForm[]>([
    { color: "Black", model: "", price: "", quantity: "10", images: [""] }
  ]);

  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  useEffect(() => {
    if (authStatus === "loading") return;
    if (!session) {
      setCheckingAuth(false);
      return;
    }

    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/profile");
        const data = await res.json();
        if (data.success && data.user) {
          const freshRole = data.user.role;
          const freshStatus = data.user.sellerStatus;
          const freshVendorId = data.user.vendorId;

          if (freshRole === "seller" && freshStatus === "approved") {
            setIsApprovedSeller(true);
            setCheckingAuth(false);

            const sessionUser = session?.user as { role?: string; sellerStatus?: string; vendorId?: string } | undefined;
            if (
              sessionUser?.role !== freshRole ||
              sessionUser?.sellerStatus !== freshStatus ||
              sessionUser?.vendorId !== freshVendorId
            ) {
              update();
            }
          } else {
            setIsApprovedSeller(false);
            setCheckingAuth(false);
          }
        } else {
          setIsApprovedSeller(false);
          setCheckingAuth(false);
        }
      } catch (err) {
        console.error("Checking auth error:", err);
        setIsApprovedSeller(false);
        setCheckingAuth(false);
      }
    }
    checkAuth();
  }, [session, authStatus, update]);

  // Dynamic field helpers
  const handleAddCustomField = () => {
    setCustomFields([...customFields, { key: "", value: "" }]);
  };

  const handleRemoveCustomField = (index: number) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
  };

  const handleCustomFieldChange = (index: number, key: "key" | "value", val: string) => {
    const updated = [...customFields];
    updated[index][key] = val;
    setCustomFields(updated);
  };

  // Variant helpers
  const handleAddVariant = () => {
    setVariants([...variants, { color: "", model: "", price: "", quantity: "1", images: [""] }]);
  };

  const handleRemoveVariant = (index: number) => {
    if (variants.length === 1) {
      toast.error("At least one product variant is required.");
      return;
    }
    setVariants(variants.filter((_, i) => i !== index));
  };

  const handleVariantChange = (vIndex: number, field: keyof VariantForm, val: any) => {
    const updated = [...variants];
    (updated[vIndex] as any)[field] = val;
    setVariants(updated);
  };

  const updateVariantImage = (vIndex: number, imgIndex: number, val: string) => {
    const updated = [...variants];
    const imgs = [...updated[vIndex].images];
    imgs[imgIndex] = val;
    updated[vIndex].images = imgs;
    setVariants(updated);
  };

  const handleAddVariantImage = (vIndex: number) => {
    const updated = [...variants];
    updated[vIndex].images = [...updated[vIndex].images, ""];
    setVariants(updated);
  };

  const handleRemoveVariantImage = (vIndex: number, imgIndex: number) => {
    const updated = [...variants];
    if (updated[vIndex].images.length === 1) {
      updated[vIndex].images = [""];
    } else {
      updated[vIndex].images = updated[vIndex].images.filter((_, i) => i !== imgIndex);
    }
    setVariants(updated);
  };

  const handleImageUpload = (variantIndex: number, imageIndex: number, file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file.");
      return;
    }
    const key = `${variantIndex}-${imageIndex}`;
    setUploadProgress((prev) => ({ ...prev, [key]: 0 }));

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload", true);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        setUploadProgress((prev) => ({ ...prev, [key]: percent }));
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.success && res.url) {
            updateVariantImage(variantIndex, imageIndex, res.url);
            toast.success("Image uploaded successfully!");
          } else {
            toast.error(res.error || "Upload failed");
          }
        } catch {
          toast.error("Upload response error");
        }
      } else {
        toast.error("Upload server error");
      }
      setUploadProgress((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    };

    xhr.onerror = () => {
      toast.error("Upload network error");
      setUploadProgress((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    };

    const formData = new FormData();
    formData.append("file", file);
    xhr.send(formData);
  };

  // AI Generator
  const handleAutoGenerateAI = async () => {
    if (!title || !description) {
      toast.error("Please enter a title and description first to generate metadata.");
      return;
    }
    setGenerating(true);
    const loadingToast = toast.loading("Generating structured details using Gemini AI...");
    try {
      const res = await fetch("/api/ai/generate-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, category, description }),
      });
      const result = await res.json();
      if (result.success && result.data) {
        const { brand: aiBrand, material: aiMaterial, materialsCare: aiCare, featuresSpecs: aiSpecs, measurements: aiMeasures, inTheBox: aiBox } = result.data;
        if (aiBrand) setBrand(aiBrand);
        if (aiMaterial !== undefined) setMaterial(aiMaterial || "");
        if (aiCare && Array.isArray(aiCare)) setMaterialsCare(aiCare.slice(0, 4));
        if (aiSpecs && Array.isArray(aiSpecs)) setFeaturesSpecs(aiSpecs.slice(0, 4));
        if (aiMeasures && Array.isArray(aiMeasures)) setMeasurements(aiMeasures.slice(0, 4));
        if (aiBox && Array.isArray(aiBox)) setInTheBox(aiBox);
        toast.success("AI generated metadata details populated successfully!");
      } else {
        toast.error(result.error || "Failed to generate details.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to connect to AI service.");
    } finally {
      setGenerating(false);
      toast.dismiss(loadingToast);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || !price || !type) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setSubmitting(true);
    const loadingToast = toast.loading("Submitting new product...");

    const formattedCustomFields: Record<string, string> = {};
    customFields.forEach((cf) => {
      if (cf.key.trim()) {
        formattedCustomFields[cf.key.trim()] = cf.value;
      }
    });

    const payload = {
      title,
      description,
      price: parseFloat(price),
      category,
      type,
      brand,
      material: material || null,
      modelInfo: modelInfo || null,
      materialsCare: materialsCare.filter((c) => c.trim()),
      featuresSpecs: featuresSpecs.filter((s) => s.trim()),
      measurements: measurements.filter((m) => m.trim()),
      inTheBox: inTheBox.filter((b) => b.trim()),
      customFields: formattedCustomFields,
      variants: variants.map((v) => ({
        color: v.color,
        model: v.model || "",
        price: v.price ? parseFloat(v.price) : parseFloat(price),
        quantity: parseInt(v.quantity, 10) || 0,
        images: v.images.filter((img) => img.trim()),
      })),
    };

    try {
      const res = await fetch("/api/vendor/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (result.success) {
        toast.success("Product listed successfully!");
        router.push("/vendor/dashboard");
      } else {
        toast.error(result.error || "Failed to list product.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error connecting to server.");
    } finally {
      toast.dismiss(loadingToast);
      setSubmitting(false);
    }
  };

  if (authStatus === "loading" || checkingAuth) {
    return <Loader title="Checking Authorization..." className="min-h-screen" />;
  }

  if (!session?.user) {
    return (
      <Container className="py-20 min-h-screen bg-gray-50 flex items-center justify-center">
        <AccessDenied
          message="Access is denied to view the page. Sign in first."
          buttonText="Sign In"
          buttonHref={`/signin?callbackUrl=${encodeURIComponent("/vendor/products/new")}`}
        />
      </Container>
    );
  }

  if (!isApprovedSeller) {
    return (
      <Container className="py-20 min-h-screen bg-gray-50 flex items-center justify-center">
        <AccessDenied message="You do not have the authority to access this page. Only approved sellers can list new products." />
      </Container>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 md:px-8">
      <div className="w-full space-y-6">
        {/* Header navigation bar */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-5">
          <div>
            <h1 className="text-2xl font-black text-accent tracking-tight">Create Product</h1>
            <p className="text-xs text-lightText font-semibold mt-1">List a new product to your vendor storefront.</p>
          </div>
          <Link href="/vendor/dashboard" className="px-4 py-2 border border-gray-250 hover:bg-slate-50 text-accent font-bold text-xs rounded-xl transition-all duration-200 uppercase tracking-wider">
            Back to Dashboard
          </Link>
        </div>

        {/* Wizard Form */}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Columns: Primary Inputs */}
          <div className="lg:col-span-2 space-y-6">
            {/* Card 1: Basic Information */}
            <div className="bg-white border border-gray-150 rounded-2xl p-6 shadow-xs space-y-5">
              <h2 className="text-sm font-bold text-accent border-b border-gray-50 pb-2">Basic Info</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-accent uppercase tracking-wider mb-2">Product Title *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Premium Leather Jacket"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs text-accent focus:outline-none focus:ring-1 focus:ring-orange-400"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-accent uppercase tracking-wider mb-2">Category *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs text-accent focus:outline-none focus:ring-1 focus:ring-orange-400"
                  >
                    <option value="electronics">Electronics</option>
                    <option value="fashion">Fashion</option>
                    <option value="beauty">Beauty & Cosmetics</option>
                    <option value="home">Home & Living</option>
                    <option value="streetwear">Streetwear</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-accent uppercase tracking-wider mb-2">Description *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide details about the product..."
                  rows={4}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs text-accent focus:outline-none focus:ring-1 focus:ring-orange-400 resize-none"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-accent uppercase tracking-wider mb-2">Base Price (INR) *</label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="e.g. 2999"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs text-accent focus:outline-none focus:ring-1 focus:ring-orange-400"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-accent uppercase tracking-wider mb-2">Brand</label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="e.g. Levi's"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs text-accent focus:outline-none focus:ring-1 focus:ring-orange-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-accent uppercase tracking-wider mb-2">Type / Model Tag *</label>
                  <input
                    type="text"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    placeholder="e.g. Clothing, Phone"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs text-accent focus:outline-none focus:ring-1 focus:ring-orange-400"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Card 2: Variants Selection */}
            <div className="bg-white border border-gray-150 rounded-2xl p-6 shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-gray-55 pb-2">
                <h2 className="text-sm font-bold text-accent">Product Variants</h2>
                <button
                  type="button"
                  onClick={handleAddVariant}
                  className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-lightOrange text-xs font-bold rounded-lg transition-colors duration-150"
                >
                  + Add Variant
                </button>
              </div>

              <div className="space-y-6">
                {variants.map((variant, vIdx) => (
                  <div key={vIdx} className="border border-gray-100 rounded-xl p-4 bg-slate-50 relative space-y-4">
                    <button
                      type="button"
                      onClick={() => handleRemoveVariant(vIdx)}
                      className="absolute top-3 right-3 text-red-400 hover:text-red-600 font-bold text-xs"
                    >
                      Delete
                    </button>

                    <h3 className="text-xs font-bold text-accent uppercase tracking-wider">Variant #{vIdx + 1}</h3>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-lightText uppercase tracking-wider mb-1">Color *</label>
                        <input
                          type="text"
                          value={variant.color}
                          onChange={(e) => handleVariantChange(vIdx, "color", e.target.value)}
                          placeholder="e.g. Red, Blue"
                          className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-accent focus:outline-none focus:ring-1 focus:ring-orange-400"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-lightText uppercase tracking-wider mb-1">Model Spec (Optional)</label>
                        <input
                          type="text"
                          value={variant.model}
                          onChange={(e) => handleVariantChange(vIdx, "model", e.target.value)}
                          placeholder="e.g. 128GB"
                          className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-accent focus:outline-none focus:ring-1 focus:ring-orange-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-lightText uppercase tracking-wider mb-1">Price (Optional)</label>
                        <input
                          type="number"
                          value={variant.price}
                          onChange={(e) => handleVariantChange(vIdx, "price", e.target.value)}
                          placeholder="Uses base price"
                          className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-accent focus:outline-none focus:ring-1 focus:ring-orange-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-lightText uppercase tracking-wider mb-1">Stock Quantity *</label>
                        <input
                          type="number"
                          value={variant.quantity}
                          onChange={(e) => handleVariantChange(vIdx, "quantity", e.target.value)}
                          placeholder="10"
                          className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-accent focus:outline-none focus:ring-1 focus:ring-orange-400"
                          required
                        />
                      </div>
                    </div>

                    {/* Variant Images upload section */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-[10px] font-bold text-lightText uppercase tracking-wider">Images</label>
                        <button
                          type="button"
                          onClick={() => handleAddVariantImage(vIdx)}
                          className="text-[10px] text-lightOrange hover:text-darkOrange font-bold"
                        >
                          + Add Image Slot
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {variant.images.map((imgUrl, imgIdx) => {
                          const uploadKey = `${vIdx}-${imgIdx}`;
                          const isUploading = uploadProgress[uploadKey] !== undefined;

                          return (
                            <div key={imgIdx} className="relative border border-gray-200 rounded-xl p-3 bg-white shadow-xs">
                              {imgUrl ? (
                                <div className="flex items-center gap-4">
                                  <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-gray-150 bg-gray-50 flex-shrink-0">
                                    <Image
                                      src={imgUrl}
                                      alt="Uploaded preview"
                                      fill
                                      className="object-cover"
                                      sizes="64px"
                                      unoptimized
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1.5">
                                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full w-max">
                                      Uploaded ✓
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveVariantImage(vIdx, imgIdx)}
                                      className="text-xs text-red-500 hover:text-red-700 font-semibold text-left transition-colors"
                                    >
                                      Remove Image
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between gap-3">
                                  <label className="flex-1 cursor-pointer flex flex-col items-center justify-center border border-dashed border-gray-300 hover:border-orange-400 bg-gray-50 hover:bg-orange-50/20 py-4 px-3 rounded-xl transition-all duration-150">
                                    {isUploading ? (
                                      <div className="text-center space-y-1">
                                        <span className="text-[10px] font-black text-lightOrange animate-pulse">
                                          Uploading ({uploadProgress[uploadKey]}%)
                                        </span>
                                        <div className="w-24 h-1 bg-gray-200 rounded-full overflow-hidden mx-auto">
                                          <div className="h-full bg-lightOrange transition-all duration-200" style={{ width: `${uploadProgress[uploadKey]}%` }} />
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="text-center">
                                        <span className="text-[10px] font-bold text-accent">Browse image file</span>
                                        <p className="text-[9px] text-lightText mt-0.5">JPEG, PNG, WEBP</p>
                                      </div>
                                    )}
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleImageUpload(vIdx, imgIdx, file);
                                      }}
                                      className="hidden"
                                      disabled={isUploading}
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveVariantImage(vIdx, imgIdx)}
                                    className="text-gray-400 hover:text-red-500 text-sm px-1.5 transition-colors"
                                    title="Remove slot"
                                  >
                                    ✖
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: AI integration and Dynamic Specs */}
          <div className="space-y-6">
            {/* Card 3: AI Metadata Generator */}
            <div className="bg-gradient-to-br from-orange-50 to-orange-100/30 border border-orange-200/55 rounded-2xl p-5 shadow-xs space-y-4">
              <div>
                <h3 className="text-sm font-bold text-accent flex items-center gap-1.5">
                  <span className="text-lg">✨</span> AI Content Assistant
                </h3>
                <p className="text-[11px] text-lightText mt-1">Generate product specifications, care lists, measurements and in-the-box items dynamically using Gemini AI.</p>
              </div>

              <button
                type="button"
                onClick={handleAutoGenerateAI}
                disabled={generating || submitting}
                className="w-full py-3 bg-lightOrange hover:bg-darkOrange disabled:bg-slate-200 text-white font-bold text-xs rounded-xl shadow-md transition-all duration-200 uppercase tracking-wider transform active:scale-95"
              >
                {generating ? "Generating..." : "Auto-Generate Details"}
              </button>
            </div>

            {/* Card 4: Dynamic Specifications */}
            <div className="bg-white border border-gray-150 rounded-2xl p-6 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-accent border-b border-gray-50 pb-2">Dynamic Specifications</h2>

              <div>
                <label className="block text-xs font-bold text-accent uppercase tracking-wider mb-2">Model Info Tag (Optional)</label>
                <input
                  type="text"
                  value={modelInfo}
                  onChange={(e) => setModelInfo(e.target.value)}
                  placeholder='e.g. Model is 6-1 and wearing size M'
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-accent uppercase tracking-wider mb-2">Streetwear Material</label>
                <input
                  type="text"
                  value={material}
                  onChange={(e) => setMaterial(e.target.value)}
                  placeholder="e.g. 100% Street-cotton"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-accent focus:outline-none"
                />
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-bold text-accent uppercase tracking-wider">Features & Specs (exactly 4)</label>
                {featuresSpecs.map((spec, idx) => (
                  <input
                    key={idx}
                    type="text"
                    value={spec}
                    onChange={(e) => {
                      const updated = [...featuresSpecs];
                      updated[idx] = e.target.value;
                      setFeaturesSpecs(updated);
                    }}
                    placeholder={`Spec ${idx + 1}`}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-xs text-accent focus:outline-none"
                  />
                ))}
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-bold text-accent uppercase tracking-wider">Materials & Care (exactly 4)</label>
                {materialsCare.map((care, idx) => (
                  <input
                    key={idx}
                    type="text"
                    value={care}
                    onChange={(e) => {
                      const updated = [...materialsCare];
                      updated[idx] = e.target.value;
                      setMaterialsCare(updated);
                    }}
                    placeholder={`Care ${idx + 1}`}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-xs text-accent focus:outline-none"
                  />
                ))}
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-bold text-accent uppercase tracking-wider">Measurements (exactly 4)</label>
                {measurements.map((measure, idx) => (
                  <input
                    key={idx}
                    type="text"
                    value={measure}
                    onChange={(e) => {
                      const updated = [...measurements];
                      updated[idx] = e.target.value;
                      setMeasurements(updated);
                    }}
                    placeholder={`Measurement ${idx + 1}`}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-xs text-accent focus:outline-none"
                  />
                ))}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-accent uppercase tracking-wider">In the Box</label>
                  <button
                    type="button"
                    onClick={() => setInTheBox([...inTheBox, ""])}
                    className="text-[10px] text-lightOrange font-bold"
                  >
                    + Add Item
                  </button>
                </div>
                {inTheBox.map((boxItem, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      value={boxItem}
                      onChange={(e) => {
                        const updated = [...inTheBox];
                        updated[idx] = e.target.value;
                        setInTheBox(updated);
                      }}
                      placeholder={`Packaging Item ${idx + 1}`}
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-xs text-accent focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setInTheBox(inTheBox.filter((_, i) => i !== idx))}
                      className="text-red-500 text-xs px-2"
                    >
                      ✖
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Card 5: Custom Fields */}
            <div className="bg-white border border-gray-150 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-gray-50 pb-2">
                <h2 className="text-sm font-bold text-accent">Custom Specs</h2>
                <button
                  type="button"
                  onClick={handleAddCustomField}
                  className="px-2.5 py-1 bg-slate-55 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg transition-colors duration-155"
                >
                  + Add Pair
                </button>
              </div>

              {customFields.length === 0 ? (
                <p className="text-xs text-lightText italic">No additional custom fields added yet.</p>
              ) : (
                <div className="space-y-2">
                  {customFields.map((cf, idx) => (
                    <div key={idx} className="flex gap-3 items-center">
                      <input
                        type="text"
                        value={cf.key}
                        onChange={(e) => handleCustomFieldChange(idx, "key", e.target.value)}
                        placeholder="Spec Label (e.g. Warranty)"
                        className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-xs text-accent focus:outline-none focus:ring-1 focus:ring-orange-400"
                        required
                      />
                      <input
                        type="text"
                        value={cf.value}
                        onChange={(e) => handleCustomFieldChange(idx, "value", e.target.value)}
                        placeholder="Spec Value (e.g. 2 Years)"
                        className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-xs text-accent focus:outline-none focus:ring-1 focus:ring-orange-400"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomField(idx)}
                        className="text-red-500 hover:text-red-700 font-bold text-xs"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Form Submit button */}
            <button
              type="submit"
              disabled={submitting || generating}
              className="w-full py-4 bg-accent hover:bg-slate-900 text-white font-bold text-sm rounded-2xl shadow-lg transition-all duration-200 uppercase tracking-wider transform hover:-translate-y-0.5 active:translate-y-0 disabled:bg-slate-200"
            >
              {submitting ? "Listing Product..." : "List Product Now"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}