"use client";

import Container from "@/components/Container";
import React, { useState } from "react";
import toast from "react-hot-toast";
import { MdEmail, MdPhone, MdLocationOn, MdSend } from "react-icons/md";

const ContactPage = () => {
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
    category: "general",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setSubmitting(true);
    // simulate submission
    await new Promise((r) => setTimeout(r, 1200));
    toast.success("Message sent! We'll respond within 24 hours.");
    setForm({ name: "", email: "", subject: "", message: "", category: "general" });
    setSubmitting(false);
  };

  const contactInfo = [
    { icon: <MdEmail className="text-xl" />, label: "Email", value: "support@dcart.in", href: "mailto:support@dcart.in" },
    { icon: <MdPhone className="text-xl" />, label: "Phone", value: "+91 1800-DCA-RT", href: "tel:+911800DCART" },
    { icon: <MdLocationOn className="text-xl" />, label: "Address", value: "Koramangala, Bangalore 560034", href: "#" },
  ];

  return (
    <div>
      <div className="bg-gradient-to-br from-accent to-zinc-900 text-white py-20 px-4 sm:px-6 md:px-8">
        <div className="w-full text-left">
          <span className="inline-block px-4 py-1.5 bg-white/10 text-orange-400 text-xs font-bold rounded-full uppercase tracking-widest mb-4">
            Get in Touch
          </span>
          <h1 className="text-4xl md:text-5xl font-black mb-4">
            We&apos;re Here to <span className="text-orange-400">Help</span>
          </h1>
          <p className="text-white/70 max-w-xl">
            Have a question, feedback, or need support? Our team typically responds within 24 hours.
          </p>
        </div>
      </div>

      <Container className="py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Contact Info */}
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black text-accent mb-1">Contact Information</h2>
              <p className="text-lightText text-sm">Reach us through any of these channels.</p>
            </div>
            {contactInfo.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="flex items-center gap-4 p-4 bg-white border border-gray-100 rounded-2xl shadow-xs hover:shadow-md transition-all hover:-translate-y-0.5 group"
              >
                <div className="p-3 bg-orange-50 text-orange-500 rounded-xl group-hover:bg-orange-100 transition-colors">
                  {item.icon}
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-lightText tracking-wider">{item.label}</p>
                  <p className="text-sm font-bold text-accent">{item.value}</p>
                </div>
              </a>
            ))}

            <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-accent mb-2">Support Hours</h3>
              <div className="space-y-1 text-xs text-lightText font-medium">
                <div className="flex justify-between">
                  <span>Monday – Friday</span>
                  <span className="font-bold text-accent">9 AM – 8 PM</span>
                </div>
                <div className="flex justify-between">
                  <span>Saturday</span>
                  <span className="font-bold text-accent">10 AM – 6 PM</span>
                </div>
                <div className="flex justify-between">
                  <span>Sunday</span>
                  <span className="text-lightText">Closed</span>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2 bg-white border border-gray-100 rounded-3xl p-8 shadow-xs">
            <h2 className="text-xl font-black text-accent mb-6">Send us a Message</h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-accent uppercase">Your Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Aryan Saxena"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-accent focus:outline-none focus:ring-1 focus:ring-orange-400 transition"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-accent uppercase">Email Address *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="you@example.com"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-accent focus:outline-none focus:ring-1 focus:ring-orange-400 transition"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-accent uppercase">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-accent focus:outline-none focus:ring-1 focus:ring-orange-400"
                >
                  <option value="general">General Inquiry</option>
                  <option value="order">Order Issues</option>
                  <option value="return">Returns & Refunds</option>
                  <option value="seller">Seller Support</option>
                  <option value="technical">Technical Support</option>
                  <option value="feedback">Feedback & Suggestions</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-accent uppercase">Subject</label>
                <input
                  type="text"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="How can we help you?"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-accent focus:outline-none focus:ring-1 focus:ring-orange-400 transition"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-accent uppercase">Message *</label>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Describe your issue or question in detail..."
                  rows={5}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-accent focus:outline-none focus:ring-1 focus:ring-orange-400 transition min-h-[120px] resize-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="flex items-center justify-center gap-2 w-full py-3.5 bg-accent text-white font-bold rounded-2xl hover:bg-orange-600 transition-all disabled:opacity-60 shadow-sm hover:shadow-md"
              >
                {submitting ? (
                  <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <MdSend className="text-lg" />
                    Send Message
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </Container>
    </div>
  );
};

export default ContactPage;
