"use client";

import Container from "@/components/Container";
import React, { useState } from "react";

const faqs = [
  {
    category: "Orders & Delivery",
    icon: "",
    items: [
      {
        q: "How do I track my order?",
        a: "Go to My Orders from your Dashboard or the Orders link in the header. Each order shows its current status and estimated delivery date.",
      },
      {
        q: "What is the standard delivery time?",
        a: "Standard delivery takes 3-5 business days. Express delivery (available in select cities) takes 1-2 business days. Same-day delivery is available in Bangalore, Mumbai, Delhi, and Hyderabad.",
      },
      {
        q: "Can I change my delivery address after placing an order?",
        a: "Address changes can be made within 2 hours of placing an order. Contact our support team immediately via the chat widget or email support@dcart.in.",
      },
      {
        q: "Do you offer free delivery?",
        a: "Yes! All orders above ₹499 qualify for free standard delivery. Orders below this amount have a flat ₹49 shipping fee.",
      },
    ],
  },
  {
    category: "Returns & Refunds",
    icon: "",
    items: [
      {
        q: "What is DCart's return policy?",
        a: "Most products are eligible for a 10-day return window from the date of delivery. Electronics must be in original packaging with all accessories. Clothing must be unworn with tags attached.",
      },
      {
        q: "How long do refunds take?",
        a: "Refunds are processed within 5-7 business days after the returned product is received and inspected. For UPI/wallet payments, refunds arrive within 1-2 business days.",
      },
      {
        q: "Which products are non-returnable?",
        a: "Perishable goods, digital products (software licenses, gift cards), and personal hygiene products are non-returnable. Refer to individual product pages for specific return eligibility.",
      },
    ],
  },
  {
    category: "Payments & Security",
    icon: "",
    items: [
      {
        q: "What payment methods does DCart accept?",
        a: "We accept all major credit/debit cards, UPI (PhonePe, GPay, Paytm), net banking, EMI, and Pay on Delivery for eligible orders.",
      },
      {
        q: "Is my payment information secure?",
        a: "Absolutely. DCart uses industry-standard SSL encryption and our fraud detection system monitors every transaction for suspicious activity. We never store raw card data.",
      },
      {
        q: "Can I pay in installments (EMI)?",
        a: "Yes! EMI options are available on orders above ₹3,000. Select EMI at checkout. 0% EMI is available on select products from participating banks.",
      },
    ],
  },
  {
    category: "Account & Profile",
    icon: "",
    items: [
      {
        q: "How do I become a seller on DCart?",
        a: "Click 'Sell on DCart' on the sign-up page and register as a seller. Our team reviews applications within 24-48 hours and you'll receive an approval email once verified.",
      },
      {
        q: "Can I have both a buyer and seller account?",
        a: "No, accounts are either buyer or seller accounts. This helps us maintain the integrity of the marketplace and provide role-specific features to each type of user.",
      },
      {
        q: "How do I delete my account?",
        a: "Contact our support team at support@dcart.in with your registered email. Account deletion is processed within 7 business days and all your data will be permanently removed.",
      },
    ],
  },
];

const FAQPage = () => {
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  const toggle = (key: string) => {
    setOpenItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div>
      <div className="bg-gradient-to-br from-accent to-zinc-900 text-white py-20 px-4 sm:px-6 md:px-8">
        <div className="w-full text-left">
          <span className="inline-block px-4 py-1.5 bg-white/10 text-orange-400 text-xs font-bold rounded-full uppercase tracking-widest mb-4">
            Support
          </span>
          <h1 className="text-4xl md:text-5xl font-black mb-4">
            Frequently Asked <span className="text-orange-400">Questions</span>
          </h1>
          <p className="text-white/70 max-w-xl">
            Find answers to the most common questions. Can&apos;t find what you need? Contact our support team.
          </p>
        </div>
      </div>

      <Container className="py-16">
        <div className="space-y-10">
          {faqs.map((section) => (
            <div key={section.category}>
              <div className="flex items-center gap-3 mb-5 pb-3 border-b border-gray-100">
                <span className="text-2xl"></span>
                <h2 className="text-lg font-black text-accent">{section.category}</h2>
              </div>
              <div className="space-y-3">
                {section.items.map((item, idx) => {
                  const key = `${section.category}-${idx}`;
                  const isOpen = openItems[key];
                  return (
                    <div
                      key={key}
                      className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-xs transition-all"
                    >
                      <button
                        onClick={() => toggle(key)}
                        className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
                      >
                        <span className="text-sm font-bold text-accent pr-4">{item.q}</span>
                        <span className={`text-lg text-lightText transition-transform duration-300 shrink-0 ${isOpen ? "rotate-45" : ""}`}>
                          +
                        </span>
                      </button>
                      {isOpen && (
                        <div className="px-5 pb-5 border-t border-gray-50">
                          <p className="text-sm text-lightText leading-relaxed pt-4">{item.a}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Contact CTA */}
        <div className="mt-12 text-center bg-orange-50 border border-orange-100 rounded-3xl p-8">
          <h3 className="text-lg font-bold text-accent mb-2">Still need help?</h3>
          <p className="text-lightText text-sm mb-4">
            Our support team is available Monday–Saturday, 9 AM – 8 PM IST.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <a
              href="/contact"
              className="px-5 py-2.5 bg-accent text-white font-bold rounded-xl hover:bg-orange-600 transition-colors text-sm"
            >
              Contact Us
            </a>
            <a
              href="mailto:support@dcart.in"
              className="px-5 py-2.5 bg-white border border-gray-200 text-accent font-bold rounded-xl hover:bg-gray-50 transition-colors text-sm"
            >
              Email Support
            </a>
          </div>
        </div>
      </Container>
    </div>
  );
};

export default FAQPage;
