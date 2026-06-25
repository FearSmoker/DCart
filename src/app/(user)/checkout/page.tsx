"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { StoreState, ProductData } from "@/types";
import Container from "@/components/Container";
import Loader from "@/components/Loader";
import FormattedPrice from "@/components/FormattedPrice";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { HiLocationMarker, HiPhone, HiPlus, HiArrowRight, HiShoppingBag, HiCheck, HiArrowLeft } from "react-icons/hi";
import AccessDenied from "@/components/AccessDenied";

interface Address {
  id: string;
  name: string;
  contactNo: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  label: "Home" | "Office" | "Others";
  isPrimary: boolean;
}

export default function CheckoutPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  // active items check
  const isBuyNow = searchParams?.get("buyNow") === "true";
  const { cart, buyNowCart } = useSelector((state: StoreState) => state?.dcart);
  const checkoutItems: ProductData[] = isBuyNow && buyNowCart && buyNowCart.length > 0 ? buyNowCart : cart;

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // address form state
  const [showForm, setShowForm] = useState(false);
  const [addrName, setAddrName] = useState("");
  const [addrContact, setAddrContact] = useState("");
  const [addrStreet, setAddrStreet] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrState, setAddrState] = useState("");
  const [addrZip, setAddrZip] = useState("");
  const [addrLabel, setAddrLabel] = useState<"Home" | "Office" | "Others">("Home");
  const [addrIsPrimary, setAddrIsPrimary] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/signin");
    }
  }, [status, router]);

  const loadAddresses = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/profile");
      const data = await res.json();
      if (data.success && data.user) {
        const userAddresses: Address[] = data.user.addresses || [];
        setAddresses(userAddresses);
        
        // auto-select primary address, fallback to first...
        const primary = userAddresses.find((addr) => addr.isPrimary);
        if (primary) {
          setSelectedAddress(primary);
        } else if (userAddresses.length > 0) {
          setSelectedAddress(userAddresses[0]);
        } else {
          setSelectedAddress(null);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load shipping addresses.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.user) {
      loadAddresses();
    }
  }, [session, loadAddresses]);

  // total calculation
  const subtotal = checkoutItems.reduce((acc, item) => acc + item.price * (item.quantity || 1), 0);
  const shipping = 0; // free shipping
  const total = subtotal + shipping;

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addrName.trim() || !addrContact.trim() || !addrStreet.trim() || !addrCity.trim() || !addrState.trim() || !addrZip.trim()) {
      toast.error("All address fields are required.");
      return;
    }

    setSavingAddress(true);
    const loadingToast = toast.loading("Adding address...");

    try {
      const res = await fetch("/api/profile/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          address: {
            name: addrName,
            contactNo: addrContact,
            street: addrStreet,
            city: addrCity,
            state: addrState,
            zipCode: addrZip,
            label: addrLabel,
            isPrimary: addrIsPrimary,
          },
        }),
      });
      const data = await res.json();

      if (res.ok) {
        toast.success("Address added successfully!", { id: loadingToast });
        setShowForm(false);
        // clear
        setAddrName("");
        setAddrContact("");
        setAddrStreet("");
        setAddrCity("");
        setAddrState("");
        setAddrZip("");
        setAddrLabel("Home");
        setAddrIsPrimary(false);
        
        // reload
        await loadAddresses();
      } else {
        toast.error(data.error || "Failed to add address.", { id: loadingToast });
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred.", { id: loadingToast });
    } finally {
      setSavingAddress(false);
    }
  };

  const handleProceedToPayment = async () => {
    if (!selectedAddress) {
      toast.error("Please select or add a shipping address to proceed.");
      return;
    }

    setCheckoutLoading(true);
    const loadingToast = toast.loading("Initiating secure payment session...");

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: checkoutItems,
          email: session?.user?.email,
          isBuyNow,
          address: selectedAddress,
        }),
      });

      const data = await response.json();

      if (response.ok && data.url) {
        toast.success("Redirecting to checkout...", { id: loadingToast });
        window.location.href = data.url;
      } else {
        toast.error(data.error || "Failed to initiate payment checkout.", { id: loadingToast });
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred starting checkout.", { id: loadingToast });
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return <Loader title="Preparing checkout details..." />;
  }

  const isSeller = session?.user && (session.user as { role?: string }).role === "seller";
  if (isSeller) {
    return (
      <Container className="py-10">
        <AccessDenied message="Sellers are not permitted to proceed to checkout or purchase products." />
      </Container>
    );
  }

  if (checkoutItems.length === 0) {
    return (
      <Container className="py-24 text-center">
        <span className="text-6xl mb-4 block">🛒</span>
        <h2 className="text-xl font-bold text-accent mb-2">Checkout is empty</h2>
        <p className="text-sm text-lightText mb-6">No products were found in your active checkout cart.</p>
        <button
          onClick={() => router.push("/")}
          className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm"
        >
          Continue Shopping
        </button>
      </Container>
    );
  }

  return (
    <Container className="py-10 text-black dark:text-zinc-100">
      {/* upper header */}
      <div className="flex items-center gap-2 mb-6 text-xs text-lightText dark:text-zinc-400 font-bold uppercase tracking-wider">
        <button onClick={() => router.back()} className="hover:text-accent dark:hover:text-zinc-200 transition-colors flex items-center gap-1">
          <HiArrowLeft className="text-sm" /> Return
        </button>
        <span>•</span>
        <span>Cart</span>
        <span>&rarr;</span>
        <span className="text-orange-500 dark:text-lightOrange font-black">Address &amp; Checkout</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* left column: address selection */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-3xl p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-gray-50 dark:border-zinc-850 pb-4 mb-6">
              <h2 className="text-lg font-bold text-accent dark:text-zinc-100 flex items-center gap-2">
                <HiLocationMarker className="text-orange-500" /> Select Shipping Address
              </h2>
              {!showForm && (
                <button
                  onClick={() => setShowForm(true)}
                  className="px-3.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1 shadow-xs"
                >
                  <HiPlus /> Add Address
                </button>
              )}
            </div>

            {/* in-place address form */}
            {showForm && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-5 bg-slate-50/50 dark:bg-zinc-850/40 border border-gray-150 dark:border-zinc-800 rounded-2xl"
              >
                <h4 className="font-bold text-xs text-accent dark:text-zinc-200 uppercase tracking-wide mb-4">New Shipping Address</h4>
                <form onSubmit={handleAddAddress} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase">Recipient Name</label>
                      <input
                        type="text"
                        value={addrName}
                        onChange={(e) => setAddrName(e.target.value)}
                        placeholder="e.g. Jane Doe"
                        className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-gray-250 dark:border-zinc-700 rounded-xl text-xs text-accent dark:text-zinc-100 focus:outline-none focus:border-orange-500 font-semibold"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase">Contact Phone</label>
                      <input
                        type="tel"
                        value={addrContact}
                        onChange={(e) => setAddrContact(e.target.value)}
                        placeholder="e.g. +91 98765 43210"
                        className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-gray-250 dark:border-zinc-700 rounded-xl text-xs text-accent dark:text-zinc-100 focus:outline-none focus:border-orange-500 font-semibold"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase">Street Address</label>
                    <input
                      type="text"
                      value={addrStreet}
                      onChange={(e) => setAddrStreet(e.target.value)}
                      placeholder="e.g. Flat 302, 12th Main Road"
                      className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-gray-250 dark:border-zinc-700 rounded-xl text-xs text-accent dark:text-zinc-100 focus:outline-none focus:border-orange-500 font-semibold"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase">City</label>
                      <input
                        type="text"
                        value={addrCity}
                        onChange={(e) => setAddrCity(e.target.value)}
                        placeholder="City"
                        className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-gray-250 dark:border-zinc-700 rounded-xl text-xs text-accent dark:text-zinc-100 focus:outline-none focus:border-orange-500 font-semibold"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase">State</label>
                      <input
                        type="text"
                        value={addrState}
                        onChange={(e) => setAddrState(e.target.value)}
                        placeholder="State"
                        className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-gray-250 dark:border-zinc-700 rounded-xl text-xs text-accent dark:text-zinc-100 focus:outline-none focus:border-orange-500 font-semibold"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase">Zip Code</label>
                      <input
                        type="text"
                        value={addrZip}
                        onChange={(e) => setAddrZip(e.target.value)}
                        placeholder="Zip code"
                        className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-gray-250 dark:border-zinc-700 rounded-xl text-xs text-accent dark:text-zinc-100 focus:outline-none focus:border-orange-500 font-semibold"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase">Label tag</span>
                      <div className="flex bg-white dark:bg-zinc-800 border dark:border-zinc-700 p-0.5 rounded-lg gap-0.5">
                        {(["Home", "Office", "Others"] as const).map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => setAddrLabel(tag)}
                            className={`px-3 py-1 text-xs font-semibold rounded ${
                              addrLabel === tag
                                ? "bg-orange-500 text-white"
                                : "text-lightText dark:text-zinc-450 hover:bg-slate-100 dark:hover:bg-zinc-750"
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="primary-addr-checkout"
                        checked={addrIsPrimary}
                        onChange={(e) => setAddrIsPrimary(e.target.checked)}
                        className="w-4 h-4 text-orange-500 accent-orange-500 bg-white border border-gray-300 rounded focus:ring-orange-500 cursor-pointer"
                      />
                      <label htmlFor="primary-addr-checkout" className="text-xs font-semibold text-accent dark:text-zinc-200 cursor-pointer select-none">
                        Set as primary address
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 border-t border-gray-150 dark:border-zinc-800 pt-4 mt-2">
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingAddress}
                      className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
                    >
                      {savingAddress ? "Saving..." : "Add & Select Address"}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* address selection grid */}
            {addresses.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-gray-250 dark:border-zinc-800 rounded-3xl p-6">
                <span className="text-4xl block mb-2">📍</span>
                <p className="font-semibold text-sm text-accent dark:text-zinc-200">No Shipping Address Saved</p>
                <p className="text-xs text-lightText dark:text-zinc-400 mt-1 mb-4">Please add a shipping address above to complete your checkout purchase.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {addresses.map((address) => (
                  <div
                    key={address.id}
                    onClick={() => setSelectedAddress(address)}
                    className={`border rounded-2xl p-5 shadow-xs relative transition-all duration-300 cursor-pointer ${
                      selectedAddress?.id === address.id
                        ? "border-orange-500 bg-orange-50/5 dark:bg-zinc-800/10 shadow-md ring-1 ring-orange-500"
                        : "border-gray-100 dark:border-zinc-800 hover:border-gray-250 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-[9px] font-bold uppercase tracking-wide">
                          {address.label}
                        </span>
                        {address.isPrimary && (
                          <span className="px-2 py-0.5 rounded bg-orange-500/10 text-orange-500 dark:text-lightOrange border border-orange-500/20 text-[9px] font-bold uppercase tracking-wide">
                            Primary
                          </span>
                        )}
                      </div>
                      {selectedAddress?.id === address.id && (
                        <div className="w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs">
                          <HiCheck />
                        </div>
                      )}
                    </div>

                    <div className="text-xs text-accent dark:text-zinc-200 space-y-1">
                      <p className="font-bold text-sm">{address.name}</p>
                      <p className="text-lightText dark:text-zinc-400">{address.street}</p>
                      <p className="text-lightText dark:text-zinc-400">{address.city}, {address.state} - {address.zipCode}</p>
                      <p className="text-[11px] text-lightText dark:text-zinc-400 mt-2 font-medium flex items-center gap-1">
                        <HiPhone className="text-zinc-400" /> {address.contactNo}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Order Summary & Pay */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-3xl p-6 shadow-sm sticky top-24">
            <h3 className="text-base font-bold text-accent dark:text-zinc-100 mb-4 pb-2 border-b border-gray-50 dark:border-zinc-850 flex items-center gap-2">
              <HiShoppingBag className="text-orange-500" /> Order Summary
            </h3>

            {/* Items list summary */}
            <div className="max-h-[160px] overflow-y-auto divide-y divide-gray-50 dark:divide-zinc-850 mb-6 pr-1">
              {checkoutItems.map((item) => (
                <div key={item._id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="truncate font-semibold text-accent dark:text-zinc-200 flex-1">
                    {item.title}
                    <span className="text-lightText dark:text-zinc-400 font-normal ml-1">× {item.quantity || 1}</span>
                  </div>
                  <div className="font-bold text-right text-accent dark:text-zinc-150 shrink-0">
                    <FormattedPrice amount={item.price * (item.quantity || 1)} />
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="space-y-2.5 border-t border-gray-50 dark:border-zinc-850 pt-4 mb-6">
              <div className="flex items-center justify-between text-xs text-lightText dark:text-zinc-400 font-semibold">
                <span>Subtotal</span>
                <FormattedPrice amount={subtotal} />
              </div>
              <div className="flex items-center justify-between text-xs text-lightText dark:text-zinc-400 font-semibold">
                <span>Shipping Charge</span>
                <span className="text-emerald-600 dark:text-emerald-400 uppercase tracking-wider text-[10px] font-extrabold bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-500/10">Free</span>
              </div>
              <div className="flex items-center justify-between text-base font-bold text-accent dark:text-zinc-100 border-t border-gray-50 dark:border-zinc-850 pt-3">
                <span>Total</span>
                <span className="text-darkOrange dark:text-lightOrange font-black text-lg">
                  <FormattedPrice amount={total} />
                </span>
              </div>
            </div>

            {/* Delivery address preview */}
            <div className="bg-slate-50/50 dark:bg-zinc-850/40 border border-gray-150 dark:border-zinc-800 rounded-2xl p-4 mb-6">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400 mb-2">Shipping Details</h4>
              {selectedAddress ? (
                <div className="text-[11px] text-accent dark:text-zinc-200 space-y-0.5">
                  <p className="font-bold">{selectedAddress.name} ({selectedAddress.label})</p>
                  <p className="truncate text-lightText dark:text-zinc-400">{selectedAddress.street}</p>
                  <p className="text-lightText dark:text-zinc-400">{selectedAddress.city}, {selectedAddress.state}</p>
                  <p className="text-lightText dark:text-zinc-450 font-medium">Phone: {selectedAddress.contactNo}</p>
                </div>
              ) : (
                <p className="text-xs text-red-500 font-bold">No address selected.</p>
              )}
            </div>

            <button
              onClick={handleProceedToPayment}
              disabled={checkoutLoading || !selectedAddress}
              className="w-full bg-lightOrange text-white hover:bg-darkOrange dark:bg-orange-500 dark:hover:bg-orange-600 font-bold py-3.5 px-4 rounded-2xl transition-all duration-200 disabled:opacity-65 disabled:cursor-not-allowed text-xs uppercase tracking-wider shadow-xs flex items-center justify-center gap-1.5"
            >
              {checkoutLoading ? "Redirecting..." : (
                <>
                  Proceed to Payment <HiArrowRight className="text-sm" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Container>
  );
}
