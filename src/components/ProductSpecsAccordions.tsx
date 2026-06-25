"use client";

import React, { useState } from "react";
import { MdExpandMore, MdExpandLess, MdInfoOutline, MdCheckCircleOutline } from "react-icons/md";
import { ProductData } from "../../types";

interface Props {
  product: ProductData & {
    customFields?: Record<string, string>;
    material?: string | null;
    modelInfo?: string | null;
  };
}

const ProductSpecsAccordions = ({ product }: Props) => {
  const [openSection, setOpenSection] = useState<string | null>("item-details");

  const toggleSection = (sectionId: string) => {
    setOpenSection(openSection === sectionId ? null : sectionId);
  };

  const titleLower = product.title.toLowerCase();
  const brandName = product.brand || "Verified Brand";

  // care instructions based on product type
  const getCareInstructions = () => {
    if (titleLower.includes("phone") || titleLower.includes("laptop") || titleLower.includes("camera") || titleLower.includes("watch") || titleLower.includes("earbud") || titleLower.includes("headphone") || titleLower.includes("speaker")) {
      return [
        "Avoid exposure to extreme temperatures, direct sunlight, and moisture.",
        "Use a dry, soft microfiber cloth to clean screen and surfaces.",
        "Do not use harsh chemical solvents or abrasive cleaning pads.",
        "Charge using the original charger or certified power adapters only.",
        "Keep away from magnets or strong magnetic fields."
      ];
    } else if (titleLower.includes("shirt") || titleLower.includes("jacket") || titleLower.includes("hoodie") || titleLower.includes("shoe") || titleLower.includes("pant") || titleLower.includes("jeans")) {
      return [
        "Machine wash cold with similar colors on a gentle cycle.",
        "Tumble dry low or hang dry in the shade to maintain shape and color.",
        "Do not bleach or dry clean unless explicitly labeled.",
        "Iron on low heat settings if necessary; avoid ironing prints or logos."
      ];
    } else if (titleLower.includes("kadai") || titleLower.includes("pan") || titleLower.includes("cook") || titleLower.includes("iron")) {
      return [
        "Hand wash only; avoid using dishwashers or steel wool scrubbers.",
        "Dry completely immediately after washing to prevent rust.",
        "Apply a thin layer of vegetable oil (seasoning) after each dry.",
        "Store in a dry, well-ventilated cabinet."
      ];
    } else {
      return [
        "Handle with care; avoid drop impacts and high drops.",
        "Wipe clean with a damp cloth and dry immediately.",
        "Store in a cool, dry place away from direct sunlight.",
        "Keep out of reach of small children if it contains small components."
      ];
    }
  };

  // sizing measurements based on product type
  const getMeasurements = () => {
    if (titleLower.includes("phone") || titleLower.includes("iphone") || titleLower.includes("pixel")) {
      return {
        Dimensions: "147.5 x 71.5 x 7.85 mm",
        Weight: "206 grams",
        "Display Size": "6.1 inches (diagonal)",
        "Form Factor": "Compact Smartphone"
      };
    } else if (titleLower.includes("laptop") || titleLower.includes("macbook")) {
      return {
        Dimensions: "31.26 x 22.12 x 1.55 cm",
        Weight: "1.61 kg",
        "Screen Size": "14.2 inches (diagonal)",
        "Form Factor": "Ultraportable Notebook"
      };
    } else if (titleLower.includes("watch")) {
      return {
        Dimensions: "46 x 39 x 9.7 mm",
        Weight: "36.4 grams (without strap)",
        "Strap Width": "22 mm",
        "Display Size": "1.96 inches"
      };
    } else if (titleLower.includes("jacket") || titleLower.includes("shirt") || titleLower.includes("hoodie")) {
      return {
        Size: "Standard fit (fits true to size)",
        Chest: "40 - 42 inches (Medium size reference)",
        Length: "28.5 inches",
        Sleeve: "34 inches"
      };
    } else if (titleLower.includes("shoe") || titleLower.includes("ultraboot")) {
      return {
        Size: "Standard UK/US Sizes available",
        Heel: "32 mm drop height",
        Weight: "295 grams (single shoe, size 8 UK)",
        Width: "Medium / D fit"
      };
    } else {
      return {
        Dimensions: "Standard product dimensions apply",
        Weight: "Refer to package shipping weight",
        Sizing: "Unified standard size"
      };
    }
  };

  // what is in the box based...
  const getInTheBox = () => {
    if (titleLower.includes("phone") || titleLower.includes("iphone") || titleLower.includes("pixel")) {
      return [
        `1 x ${product.title}`,
        "1 x USB-C to USB-C Charge Cable",
        "1 x SIM Ejector tool",
        "1 x Quick Start Guide",
        "1 x Manufacturer Warranty Documentation"
      ];
    } else if (titleLower.includes("laptop") || titleLower.includes("macbook")) {
      return [
        `1 x ${product.title}`,
        "1 x Power Adapter (charging brick)",
        "1 x USB-C charging cable",
        "1 x Safety & Warranty booklet",
        "1 x Quick setup manual"
      ];
    } else if (titleLower.includes("earbud") || titleLower.includes("airpods") || titleLower.includes("headphone")) {
      return [
        `1 x ${product.title}`,
        "1 x Smart Charging Case",
        "3 x Pairs of silicone ear tips (S, M, L sizes)",
        "1 x USB-C to Lightning / USB-C charging cable",
        "1 x User manual & safety leaflet"
      ];
    } else if (titleLower.includes("watch")) {
      return [
        `1 x ${product.title}`,
        "1 x Silicone Sport Band / Strap",
        "1 x Magnetic USB-C Fast Charger cable",
        "1 x User booklet"
      ];
    } else if (titleLower.includes("kadai") || titleLower.includes("pan") || titleLower.includes("cook")) {
      return [
        `1 x Premium ${product.title}`,
        "1 x Recipe booklet & seasoning guide",
        "1 x Care instruction slip"
      ];
    } else {
      return [
        `1 x ${product.title}`,
        "1 x Quick user setup guide",
        "1 x Warranty card"
      ];
    }
  };

  const sections = [
    {
      id: "item-details",
      title: "Item Details",
      icon: <MdInfoOutline className="text-lg text-orange-500" />,
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-xs bg-gray-50/50 dark:bg-zinc-950/20 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800">
          <div className="flex justify-between items-center w-full border-b border-gray-100 dark:border-zinc-800/80 pb-2">
            <span className="text-lightText font-semibold">Brand</span>
            <span className="font-extrabold text-accent dark:text-zinc-150">{brandName}</span>
          </div>
          {product.material && (
            <div className="flex justify-between items-center w-full border-b border-gray-100 dark:border-zinc-800/80 pb-2">
              <span className="text-lightText font-semibold">Material</span>
              <span className="font-extrabold text-accent dark:text-zinc-150">{product.material}</span>
            </div>
          )}
          {product.modelInfo && (
            <div className="flex justify-between items-center w-full border-b border-gray-100 dark:border-zinc-800/80 pb-2">
              <span className="text-lightText font-semibold">Model Specs</span>
              <span className="font-extrabold text-accent dark:text-zinc-150">{product.modelInfo}</span>
            </div>
          )}
          {product.customFields &&
            Object.entries(product.customFields).map(([k, v]) => (
              <div key={k} className="flex justify-between items-center w-full border-b border-gray-100 dark:border-zinc-800/80 pb-2">
                <span className="text-lightText font-semibold capitalize">{k}</span>
                <span className="font-extrabold text-accent dark:text-zinc-150">{v}</span>
              </div>
            ))}
          {(!product.material && !product.modelInfo && (!product.customFields || Object.keys(product.customFields).length === 0)) && (
            <p className="text-lightText italic col-span-2">Standard product specifications apply.</p>
          )}
        </div>
      )
    },
    {
      id: "materials-care",
      title: "Materials & Care",
      icon: <MdCheckCircleOutline className="text-lg text-emerald-500" />,
      content: (
        <ul className="space-y-2 text-xs bg-gray-50/50 p-4 rounded-2xl border border-gray-100 list-disc list-inside text-gray-650 leading-relaxed pl-3">
          {(product.materialsCare && product.materialsCare.length > 0
            ? product.materialsCare
            : getCareInstructions()
          ).map((inst, index) => (
            <li key={index} className="marker:text-orange-500">{inst}</li>
          ))}
        </ul>
      )
    },
    {
      id: "features-specs",
      title: "Features & Specs",
      icon: <MdInfoOutline className="text-lg text-indigo-500" />,
      content: (
        <div className="space-y-3 bg-gray-50/50 p-4 rounded-2xl border border-gray-100 text-xs text-gray-650 leading-relaxed">
          <p className="font-semibold text-accent mb-1.5">About this item:</p>
          <ul className="space-y-2.5 list-disc list-inside pl-1">
            {(product.featuresSpecs && product.featuresSpecs.length > 0
              ? product.featuresSpecs
              : [
                  "Premium Build: Sourced directly from verified distributors.",
                  "Rigorous Quality Checks: Every batch is inspected for structural durability.",
                  "Eco-Conscious Packaging: Dispatched in sustainable, shock-absorbent boxes.",
                  "High Utility: Designed to provide top reliability and optimal operation in class."
                ]
            ).map((feat, index) => {
              const parts = typeof feat === "string" ? feat.split(":") : [feat];
              if (parts.length > 1) {
                return (
                  <li key={index} className="marker:text-indigo-500">
                    <strong className="text-accent font-bold">{parts[0].trim()}:</strong>
                    {" "}{parts.slice(1).join(":").trim()}
                  </li>
                );
              }
              return (
                <li key={index} className="marker:text-indigo-500">{feat}</li>
              );
            })}
          </ul>
        </div>
      )
    },
    {
      id: "measurements",
      title: "Measurements & Dimensions",
      icon: <MdInfoOutline className="text-lg text-rose-500" />,
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
          {product.measurements && product.measurements.length > 0 ? (
            product.measurements.map((m, index) => {
              const parts = typeof m === "string" ? m.split(":") : [m];
              if (parts.length > 1) {
                return (
                  <div key={index} className="flex justify-between border-b border-gray-100 pb-2">
                    <span className="text-lightText font-semibold">{parts[0].trim()}</span>
                    <span className="font-extrabold text-accent">{parts.slice(1).join(":").trim()}</span>
                  </div>
                );
              }
              return (
                <div key={index} className="flex justify-between border-b border-gray-100 pb-2 col-span-2">
                  <span className="text-lightText font-semibold">{m}</span>
                </div>
              );
            })
          ) : (
            Object.entries(getMeasurements()).map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-lightText font-semibold">{k}</span>
                <span className="font-extrabold text-accent">{v}</span>
              </div>
            ))
          )}
        </div>
      )
    },
    {
      id: "in-the-box",
      title: "What is in the box?",
      icon: <MdCheckCircleOutline className="text-lg text-amber-500" />,
      content: (
        <ul className="space-y-2 text-xs bg-gray-50/50 p-4 rounded-2xl border border-gray-100 list-inside text-gray-650 font-medium">
          {(product.inTheBox && product.inTheBox.length > 0
            ? product.inTheBox
            : getInTheBox()
          ).map((item, index) => (
            <li key={index} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )
    }
  ];

  return (
    <div className="space-y-3.5 mt-2">
      {sections.map((section) => {
        const isOpen = openSection === section.id;
        return (
          <div
            key={section.id}
            className="border border-gray-150 rounded-2xl overflow-hidden bg-white shadow-xs hover:border-gray-300 duration-300 hover:shadow-sm"
          >
            {/* Header */}
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full flex items-center justify-between p-4 text-left font-bold text-accent hover:bg-gray-50/50 transition-colors focus:outline-none"
            >
              <div className="flex items-center gap-2.5">
                {section.icon}
                <span className="text-xs font-black uppercase tracking-wider">{section.title}</span>
              </div>
              <div className="text-xl text-gray-400">
                {isOpen ? <MdExpandLess /> : <MdExpandMore />}
              </div>
            </button>

            {/* Collapsible Content */}
            <div
              className={`transition-all duration-300 ease-in-out overflow-hidden ${
                isOpen ? "max-h-[500px] border-t border-gray-50 opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              <div className="p-4 bg-white">{section.content}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ProductSpecsAccordions;
