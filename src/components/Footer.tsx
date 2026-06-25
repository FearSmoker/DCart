import React from "react";
import Container from "./Container";
import Link from "next/link";

const footerSections = [
  {
    title: "Get to Know Us",
    links: [
      { label: "About DCart", href: "/about" },
      { label: "Careers", href: "/careers" },
      { label: "DCart Blog", href: "/about#blog" },
      { label: "Investor Relations", href: "/about" },
    ],
  },
  {
    title: "Shop & Sell",
    links: [
      { label: "Browse All Products", href: "/shop" },
      { label: "Sell on DCart", href: "/vendor/register" },
      { label: "Become an Affiliate", href: "/careers" },
    ],
  },
  {
    title: "Help & Support",
    links: [
      { label: "Your Account", href: "/dashboard" },
      { label: "Your Orders", href: "/orders" },
      { label: "Shipping & Returns", href: "/policies" },
      { label: "FAQ & Help", href: "/faq" },
      { label: "Contact Us", href: "/contact" },
    ],
  },
  {
    title: "Explore DCart",
    links: [
      { label: "Visual Search", href: "/visual-search" },
      { label: "Wishlist", href: "/wishlist" },
      { label: "Top Deals", href: "/shop" },
      { label: "New Arrivals", href: "/shop" },
    ],
  },
];

const Footer = () => {
  return (
    <footer className="bg-gray-900 text-white mt-10">
      {/* Main Footer */}
      <Container className="py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
        {footerSections.map((section) => (
          <div key={section.title}>
            <h3 className="text-orange-400 text-sm font-bold mb-4">{section.title}</h3>
            <ul className="space-y-2">
              {section.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-gray-400 text-xs hover:text-white transition-colors duration-200 font-medium"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Container>

      {/* Divider */}
      <div className="border-t border-white/10" />

      {/* Bottom Bar */}
      <Container className="py-5 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-white font-black text-lg">DCart</span>
          <span className="text-gray-500 text-xs">
            © {new Date().getFullYear()} DCart, Inc. All rights reserved.
          </span>
        </div>
        <div className="flex items-center gap-5 text-xs text-gray-500">
          <Link href="/policies" className="hover:text-white transition-colors">Privacy Policy</Link>
          <Link href="/policies" className="hover:text-white transition-colors">Terms of Service</Link>
          <Link href="/contact" className="hover:text-white transition-colors">Cookie Preferences</Link>
        </div>
      </Container>
    </footer>
  );
};

export default Footer;
