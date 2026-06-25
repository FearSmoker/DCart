"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Container from "@/components/Container";
import Title from "@/components/Title";
import Loader from "@/components/Loader";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { HiPhone, HiLockClosed, HiLocationMarker, HiPlus, HiTrash, HiCheck, HiPencil } from "react-icons/hi";

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

interface UserProfile {
  email: string;
  name: string;
  phone: string | null;
  role: string;
  addresses: Address[];
  provider: string;
}

export default function ProfilePage() {
  const { data: session, status, update: updateSession } = useSession();
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingProfile, setUpdatingProfile] = useState(false);

  // profile forms
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingPhone, setIsEditingPhone] = useState(false);

  // password modal
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // address form
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addrName, setAddrName] = useState("");
  const [addrContact, setAddrContact] = useState("");
  const [addrStreet, setAddrStreet] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrState, setAddrState] = useState("");
  const [addrZip, setAddrZip] = useState("");
  const [addrLabel, setAddrLabel] = useState<"Home" | "Office" | "Others">("Home");
  const [addrIsPrimary, setAddrIsPrimary] = useState(false);
  const [addingAddress, setAddingAddress] = useState(false);

  // auth check
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/signin");
    }
  }, [status, router]);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/profile");
      const data = await res.json();
      if (data.success) {
        setProfile(data.user);
        setName(data.user.name || "");
        setPhone(data.user.phone || "");
      } else {
        toast.error("Failed to load profile details.");
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred loading profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.user?.email) {
      fetchProfile();
    }
  }, [session, fetchProfile]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name cannot be empty");
      return;
    }

    setUpdatingProfile(true);
    const loadingToast = toast.loading("Updating profile...");

    try {
      const res = await fetch("/api/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone: phone || null }),
      });
      const data = await res.json();

      if (res.ok) {
        toast.success("Profile updated successfully!", { id: loadingToast });
        await updateSession(); // refresh nextauth session client-side
        await fetchProfile(); // reload from firestore
        setIsEditingName(false);
        setIsEditingPhone(false);
      } else {
        toast.error(data.error || "Failed to update profile.", { id: loadingToast });
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred.", { id: loadingToast });
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all password fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters.");
      return;
    }

    setChangingPassword(true);
    const loadingToast = toast.loading("Changing password...");

    try {
      const res = await fetch("/api/profile/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const data = await res.json();

      if (res.ok) {
        toast.success("Password changed successfully!", { id: loadingToast });
        setIsPasswordModalOpen(false);
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error(data.error || "Failed to change password.", { id: loadingToast });
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred.", { id: loadingToast });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addrName.trim() || !addrContact.trim() || !addrStreet.trim() || !addrCity.trim() || !addrState.trim() || !addrZip.trim()) {
      toast.error("Please fill in all address fields.");
      return;
    }

    setAddingAddress(true);
    const loadingToast = toast.loading("Saving address...");

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
        toast.success("Address saved successfully!", { id: loadingToast });
        setShowAddressForm(false);
        // clear form
        setAddrName("");
        setAddrContact("");
        setAddrStreet("");
        setAddrCity("");
        setAddrState("");
        setAddrZip("");
        setAddrLabel("Home");
        setAddrIsPrimary(false);
        // refresh address lists
        await fetchProfile();
      } else {
        toast.error(data.error || "Failed to save address.", { id: loadingToast });
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred.", { id: loadingToast });
    } finally {
      setAddingAddress(false);
    }
  };

  const handleSetPrimaryAddress = async (addressId: string) => {
    const loadingToast = toast.loading("Setting primary address...");
    try {
      const res = await fetch("/api/profile/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "setPrimary",
          addressId,
        }),
      });
      if (res.ok) {
        toast.success("Primary address updated!", { id: loadingToast });
        await fetchProfile();
      } else {
        toast.error("Failed to update primary address.", { id: loadingToast });
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred.", { id: loadingToast });
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    const confirmed = window.confirm("Are you sure you want to delete this address?");
    if (!confirmed) return;

    const loadingToast = toast.loading("Deleting address...");
    try {
      const res = await fetch("/api/profile/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          addressId,
        }),
      });
      if (res.ok) {
        toast.success("Address deleted!", { id: loadingToast });
        await fetchProfile();
      } else {
        toast.error("Failed to delete address.", { id: loadingToast });
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred.", { id: loadingToast });
    }
  };

  if (status === "loading" || loading) {
    return <Loader title="Loading your account..." />;
  }

  if (!profile) return null;

  // phone number immutability flag
  const isPhoneImmutable = !!(profile.phone && profile.phone.trim() !== "");

  return (
    <Container className="py-10 text-black dark:text-zinc-100">
      {/* upper header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-gray-100 dark:border-zinc-800 pb-8 mb-8">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-2xl shadow-md uppercase">
            {profile.name ? profile.name.charAt(0) : "A"}
          </div>
          <div>
            <Title className="text-2xl font-extrabold text-accent dark:text-zinc-150">
              {profile.name}
            </Title>
            <p className="text-sm text-lightText dark:text-zinc-400 font-semibold">{profile.email}</p>
            <span className="inline-block mt-1 text-[10px] font-bold uppercase bg-orange-500/10 text-orange-500 dark:text-lightOrange px-2.5 py-0.5 rounded-full border border-orange-500/20">
              {profile.role} Account
            </span>
          </div>
        </div>
        <button
          onClick={() => router.push("/dashboard")}
          className="px-5 py-2.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-bold text-xs rounded-xl transition-all"
        >
          &larr; Back to Dashboard
        </button>
      </div>

      <div className={`grid grid-cols-1 ${profile.role !== "seller" ? "lg:grid-cols-2 w-full" : "max-w-2xl mx-auto w-full"} gap-8`}>
        {/* Profile Card & Password settings */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-accent dark:text-zinc-100 mb-5 border-b border-gray-50 dark:border-zinc-800 pb-3">
              Account Settings
            </h3>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wide">
                    Full Name
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsEditingName(!isEditingName)}
                    className="text-xs text-orange-500 hover:text-orange-600 font-bold flex items-center gap-1.5 transition-all"
                  >
                    {isEditingName ? (
                      <span className="flex items-center gap-1">Done</span>
                    ) : (
                      <span className="flex items-center gap-1"><HiPencil className="text-sm" /> Edit</span>
                    )}
                  </button>
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full px-4 py-3 border rounded-2xl text-xs font-semibold focus:outline-none transition-all ${
                    isEditingName
                      ? "bg-white dark:bg-zinc-800 border-orange-500 text-black dark:text-white"
                      : "bg-slate-100 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 disabled:opacity-100 cursor-not-allowed"
                  }`}
                  disabled={!isEditingName}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wide">
                  Email Address
                </label>
                <input
                  type="email"
                  value={profile.email}
                  className="w-full px-4 py-3 bg-slate-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-2xl text-xs text-slate-800 dark:text-zinc-200 disabled:opacity-100 cursor-not-allowed font-semibold"
                  disabled
                />
                <p className="text-[10px] text-lightText dark:text-zinc-500 -mt-0.5">Email address cannot be changed.</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wide">
                    Phone Number
                  </label>
                  {!isPhoneImmutable && (
                    <button
                      type="button"
                      onClick={() => setIsEditingPhone(!isEditingPhone)}
                      className="text-xs text-orange-500 hover:text-orange-600 font-bold flex items-center gap-1.5 transition-all"
                    >
                      {isEditingPhone ? (
                        <span className="flex items-center gap-1">Done</span>
                      ) : (
                        <span className="flex items-center gap-1"><HiPencil className="text-sm" /> Edit</span>
                      )}
                    </button>
                  )}
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={`w-full px-4 py-3 border rounded-2xl text-xs font-semibold focus:outline-none transition-all ${
                    !isPhoneImmutable && isEditingPhone
                      ? "bg-white dark:bg-zinc-800 border-orange-500 text-black dark:text-white"
                      : "bg-slate-100 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 disabled:opacity-100 cursor-not-allowed"
                  }`}
                  disabled={isPhoneImmutable || !isEditingPhone}
                  placeholder="Enter phone number"
                />
                {isPhoneImmutable ? (
                  <p className="text-[10px] text-amber-600 dark:text-amber-500 -mt-0.5 font-medium">Phone number cannot be modified once set.</p>
                ) : (
                  <p className="text-[10px] text-lightText dark:text-zinc-500 -mt-0.5">Set a primary phone number for deliveries.</p>
                )}
              </div>

              <button
                type="submit"
                disabled={updatingProfile}
                className="w-full bg-accent dark:bg-zinc-100 dark:text-black dark:hover:bg-white text-white font-bold py-3 px-4 rounded-2xl hover:bg-accent/90 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed text-xs uppercase tracking-wider shadow-xs mt-2"
              >
                {updatingProfile ? "Saving changes..." : "Save Settings"}
              </button>
            </form>
          </div>

          {/* Change Password Block */}
          {profile.provider === "credentials" && (
            <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
              <h4 className="font-bold text-sm text-accent dark:text-zinc-200 mb-2">Security & Credentials</h4>
              <p className="text-xs text-lightText dark:text-zinc-400 mb-4">
                Update your login password regularly to keep your DCart account secure.
              </p>
              <button
                onClick={() => setIsPasswordModalOpen(true)}
                className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 text-red-650 dark:text-red-400 font-bold rounded-2xl transition-all duration-200 text-xs flex items-center justify-center gap-1.5"
              >
                <HiLockClosed className="text-base" /> Change Account Password
              </button>
            </div>
          )}
        </div>

        {/* Address Book Card */}
        {profile.role !== "seller" && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-50 dark:border-zinc-800 pb-3 mb-5">
                <h3 className="text-lg font-bold text-accent dark:text-zinc-100 flex items-center gap-2">
                  <HiLocationMarker className="text-orange-500" /> Saved Addresses
                </h3>
                {!showAddressForm && (
                  <button
                    onClick={() => setShowAddressForm(true)}
                    className="px-3.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1 shadow-xs"
                  >
                    <HiPlus className="text-sm" /> Add Address
                  </button>
                )}
              </div>

              {/* Address Form Card */}
              {showAddressForm && (
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
                          placeholder="e.g. John Doe"
                          className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-gray-250 dark:border-zinc-700 rounded-xl text-xs text-accent dark:text-zinc-100 focus:outline-none focus:border-orange-500 font-semibold"
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase">Contact Number</label>
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
                      <div className="flex flex-col gap-1 col-span-1">
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
                      <div className="flex flex-col gap-1 col-span-1">
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
                      <div className="flex flex-col gap-1 col-span-1">
                        <label className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase">Zip Code</label>
                        <input
                          type="text"
                          value={addrZip}
                          onChange={(e) => setAddrZip(e.target.value)}
                          placeholder="110001"
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
                          id="primary-addr"
                          checked={addrIsPrimary}
                          onChange={(e) => setAddrIsPrimary(e.target.checked)}
                          className="w-4 h-4 text-orange-500 accent-orange-500 bg-white border border-gray-300 rounded focus:ring-orange-500 cursor-pointer"
                        />
                        <label htmlFor="primary-addr" className="text-xs font-semibold text-accent dark:text-zinc-200 cursor-pointer select-none">
                          Set as primary address
                        </label>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 border-t border-gray-150 dark:border-zinc-800 pt-4 mt-2">
                      <button
                        type="button"
                        onClick={() => setShowAddressForm(false)}
                        className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={addingAddress}
                        className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
                      >
                        {addingAddress ? "Saving..." : "Save Address"}
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}

              {/* Address List */}
              {profile.addresses.length === 0 ? (
                <div className="text-center py-10 text-lightText dark:text-zinc-400">
                  <span className="text-4xl block mb-2">📍</span>
                  <p className="font-semibold text-sm text-accent dark:text-zinc-200">No Saved Addresses</p>
                  <p className="text-xs mt-1">You haven&apos;t added any addresses yet. Add one to checkout faster.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {profile.addresses.map((address) => (
                    <div
                      key={address.id}
                      className={`border rounded-2xl p-5 shadow-xs relative transition-all duration-300 ${
                        address.isPrimary
                          ? "border-orange-500/40 bg-orange-50/10 dark:bg-zinc-800/10"
                          : "border-gray-100 dark:border-zinc-800 hover:border-gray-250 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900"
                      }`}
                    >
                      {/* Label tags */}
                      <div className="flex items-center gap-1.5 mb-3">
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 uppercase tracking-wide">
                          {address.label}
                        </span>
                        {address.isPrimary ? (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-orange-500/10 text-orange-500 dark:text-lightOrange border border-orange-500/20 uppercase tracking-wide">
                            Primary
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-50 dark:bg-zinc-900 text-lightText dark:text-zinc-500 uppercase tracking-wide border border-transparent">
                            Secondary
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-accent dark:text-zinc-200 space-y-1">
                        <p className="font-bold text-sm">{address.name}</p>
                        <p className="text-lightText dark:text-zinc-400">{address.street}</p>
                        <p className="text-lightText dark:text-zinc-400">{address.city}, {address.state} - {address.zipCode}</p>
                        <p className="flex items-center gap-1 text-[11px] text-lightText dark:text-zinc-400 mt-2 font-medium">
                          <HiPhone className="text-zinc-400" /> Phone: {address.contactNo}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-between mt-5 pt-3 border-t border-gray-50 dark:border-zinc-855">
                        {!address.isPrimary ? (
                          <button
                            onClick={() => handleSetPrimaryAddress(address.id)}
                            className="text-[10px] font-bold text-orange-500 hover:text-orange-600 dark:text-lightOrange dark:hover:text-orange-400 transition-colors uppercase tracking-wider"
                          >
                            Set as Primary
                          </button>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-450 uppercase tracking-wider flex items-center gap-0.5">
                            <HiCheck className="text-xs" /> Primary Address
                          </span>
                        )}
                        <button
                          onClick={() => handleDeleteAddress(address.id)}
                          className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors p-1 rounded hover:bg-red-500/5"
                          title="Delete address"
                        >
                          <HiTrash className="text-base" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Password Overlay Modal Card */}
      <AnimatePresence>
        {isPasswordModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPasswordModalOpen(false)}
              className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
            />
            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="bg-white dark:bg-zinc-900 border border-gray-150 dark:border-zinc-850 rounded-3xl p-6 shadow-2xl max-w-md w-full relative z-10"
            >
              <h3 className="text-lg font-bold text-accent dark:text-zinc-100 flex items-center gap-2 border-b border-gray-50 dark:border-zinc-850 pb-3 mb-5">
                <HiLockClosed className="text-red-500" /> Change Password
              </h3>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wide">
                    Old Password
                  </label>
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 bg-slate-50/50 dark:bg-zinc-800/40 border border-gray-250 dark:border-zinc-750 rounded-2xl text-xs text-accent dark:text-zinc-100 focus:outline-none focus:border-red-500 transition-all font-semibold"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wide">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="•••••••• (min 6 characters)"
                    className="w-full px-4 py-3 bg-slate-50/50 dark:bg-zinc-800/40 border border-gray-250 dark:border-zinc-750 rounded-2xl text-xs text-accent dark:text-zinc-100 focus:outline-none focus:border-red-500 transition-all font-semibold"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wide">
                    Re-enter New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 bg-slate-50/50 dark:bg-zinc-800/40 border border-gray-250 dark:border-zinc-750 rounded-2xl text-xs text-accent dark:text-zinc-100 focus:outline-none focus:border-red-500 transition-all font-semibold"
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-gray-50 dark:border-zinc-850 pt-4 mt-2">
                  <button
                    type="button"
                    onClick={() => setIsPasswordModalOpen(false)}
                    className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors uppercase tracking-wider"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={changingPassword}
                    className="bg-accent dark:bg-zinc-100 dark:text-black dark:hover:bg-white text-white font-bold py-3 px-6 rounded-2xl hover:bg-accent/90 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed text-xs uppercase tracking-wider shadow-xs"
                  >
                    {changingPassword ? "Updating..." : "Submit"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Container>
  );
}
