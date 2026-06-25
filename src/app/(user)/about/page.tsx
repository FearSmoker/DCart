import Container from "@/components/Container";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About DCart — Reimagining E-Commerce with AI",
  description: "Learn about DCart's mission to build the smartest, most personalized online shopping experience powered by AI and real-time data.",
};

const AboutPage = () => {
  const stats = [
    { label: "Products Listed", value: "10,000+" },
    { label: "Active Sellers", value: "500+" },
    { label: "Happy Customers", value: "1M+" },
    { label: "Cities Served", value: "250+" },
  ];

  const values = [
    {
      icon: "",
      title: "AI-First Shopping",
      desc: "Every recommendation, price adjustment, and product insight is powered by machine learning models trained on real customer data.",
    },
    {
      icon: "",
      title: "Security & Trust",
      desc: "Advanced fraud detection using gradient boosting models protects every transaction. Your money and data are always safe.",
    },
    {
      icon: "",
      title: "Seller Empowerment",
      desc: "We believe in giving independent sellers the tools they need to compete with global giants — fair commissions, real analytics.",
    },
    {
      icon: "",
      title: "Real-Time Everything",
      desc: "Prices, stock levels, recommendations, and forecasts update in real-time so you always see the most accurate information.",
    },
  ];

  return (
    <div>
      {/* hero section */}
      <div className="bg-gradient-to-br from-accent to-zinc-900 text-white py-20 px-4 sm:px-6 md:px-8">
        <div className="w-full text-left">
          <span className="inline-block px-4 py-1.5 bg-white/10 text-orange-400 text-xs font-bold rounded-full uppercase tracking-widest mb-4">
            About DCart
          </span>
          <h1 className="text-4xl md:text-5xl font-black mb-4 leading-tight">
            Reimagining Shopping<br />
            <span className="text-orange-400">with Intelligence</span>
          </h1>
          <p className="text-white/70 max-w-2xl text-lg leading-relaxed">
            DCart is not just another marketplace. We&apos;re building the future of commerce —
            where every recommendation is personal, every price is fair, and every experience is extraordinary.
          </p>
        </div>
      </div>

      <Container className="py-16">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center bg-white border border-gray-100 rounded-2xl p-6 shadow-xs">
              <p className="text-3xl font-black text-accent mb-1">{stat.value}</p>
              <p className="text-sm text-lightText font-semibold">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Mission */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center mb-16">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-orange-500 mb-2 block">Our Mission</span>
            <h2 className="text-2xl md:text-3xl font-black text-accent mb-4 leading-snug">
              Democratizing Smart Shopping for Everyone
            </h2>
            <p className="text-lightText leading-relaxed mb-4">
              We started DCart with a simple belief: great technology should help people make better decisions.
              Whether you&apos;re looking for the perfect gadget, comparing prices across sellers, or discovering
              something new — our AI works tirelessly to make that experience effortless.
            </p>
            <p className="text-lightText leading-relaxed">
              From real-time demand forecasting to fraud detection and personalized recommendations,
              DCart is built on cutting-edge machine learning at every layer.
            </p>
          </div>
          <div className="bg-gradient-to-br from-orange-50 to-amber-50/30 border border-orange-100/50 rounded-3xl p-8 space-y-4">
            {["Real-time AI recommendations", "ML-powered fraud detection", "Dynamic pricing engine", "Demand forecasting", "Visual product search"].map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm font-semibold text-accent">
                <span className="w-5 h-5 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[10px] shrink-0">✓</span>
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* values */}
        <div className="mb-16">
          <h2 className="text-2xl font-black text-accent text-center mb-8">What We Stand For</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {values.map((val) => (
              <div key={val.title} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs hover:shadow-md hover:-translate-y-1 transition-all">
                <span className="text-3xl block mb-3"></span>
                <h3 className="text-sm font-bold text-accent mb-2">{val.title}</h3>
                <p className="text-xs text-lightText leading-relaxed">{val.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center bg-gradient-to-r from-accent to-zinc-800 rounded-3xl p-10 text-white">
          <h2 className="text-2xl font-black mb-3">Ready to experience smarter shopping?</h2>
          <p className="text-white/70 mb-6">Join over a million customers who trust DCart every day.</p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              href="/shop"
              className="px-6 py-3 bg-orange-500 text-white font-bold rounded-2xl hover:bg-orange-400 transition-colors"
            >
              Shop Now
            </Link>
            <Link
              href="/contact"
              className="px-6 py-3 bg-white/10 border border-white/20 text-white font-bold rounded-2xl hover:bg-white/20 transition-colors"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </Container>
    </div>
  );
};

export default AboutPage;
