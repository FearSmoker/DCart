import Container from "@/components/Container";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shipping & Return Policies — DCart",
  description: "Learn about DCart's shipping rates, delivery timelines, return policy, refund process, and other important policies.",
};

const PoliciesPage = () => {
  return (
    <div>
      <div className="bg-gradient-to-br from-accent to-zinc-900 text-white py-20 px-4 sm:px-6 md:px-8">
        <div className="w-full text-left">
          <span className="inline-block px-4 py-1.5 bg-white/10 text-orange-400 text-xs font-bold rounded-full uppercase tracking-widest mb-4">
            Policies
          </span>
          <h1 className="text-4xl md:text-5xl font-black mb-4">
            Shipping & <span className="text-orange-400">Return Policies</span>
          </h1>
          <p className="text-white/70 max-w-xl">
            Transparent policies designed to make your shopping experience worry-free.
          </p>
        </div>
      </div>

      <Container className="py-16">
        <div className="space-y-10">

          {/* Quick Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { icon: "", title: "Free Shipping", desc: "On all orders above ₹499" },
              { icon: "", title: "10-Day Returns", desc: "No questions asked on eligible items" },
              { icon: "", title: "Quick Refunds", desc: "Processed within 5-7 business days" },
            ].map((item) => (
              <div key={item.title} className="bg-white border border-gray-100 rounded-2xl p-5 text-center shadow-xs">
                <span className="text-3xl block mb-2"></span>
                <h3 className="text-sm font-bold text-accent mb-1">{item.title}</h3>
                <p className="text-xs text-lightText">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Shipping Policy */}
          <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-xs">
            <h2 className="text-xl font-black text-accent mb-6 flex items-center gap-2">
              Shipping Policy
            </h2>
            <div className="space-y-5 text-sm text-lightText leading-relaxed">
              <div>
                <h3 className="font-bold text-accent mb-2">Delivery Timeframes</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 font-bold text-accent text-[10px] uppercase tracking-wide">
                        <th className="py-2 pr-4">Delivery Type</th>
                        <th className="py-2 pr-4">Timeframe</th>
                        <th className="py-2 pr-4">Cost</th>
                        <th className="py-2">Availability</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {[
                        ["Standard Delivery", "3–5 Business Days", "Free above ₹499 / ₹49", "All India"],
                        ["Express Delivery", "1–2 Business Days", "₹99", "Select cities"],
                        ["Same-Day Delivery", "By 8 PM", "₹149", "Bangalore, Mumbai, Delhi, Hyderabad"],
                        ["Next-Day Delivery", "Next business day", "₹79", "Major metro cities"],
                      ].map(([type, time, cost, avail]) => (
                        <tr key={type} className="text-lightText">
                          <td className="py-2.5 pr-4 font-semibold text-accent">{type}</td>
                          <td className="py-2.5 pr-4">{time}</td>
                          <td className="py-2.5 pr-4">{cost}</td>
                          <td className="py-2.5">{avail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-accent mb-2">Order Processing</h3>
                <p>Orders placed before 2 PM IST on business days are processed the same day. Orders placed after 2 PM or on weekends/holidays are processed the next business day.</p>
              </div>

              <div>
                <h3 className="font-bold text-accent mb-2">Tracking Your Order</h3>
                <p>Once your order is dispatched, you&apos;ll receive an email and SMS with a tracking link. You can also track orders from your Dashboard → My Orders section at any time.</p>
              </div>
            </div>
          </div>

          {/* Return Policy */}
          <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-xs">
            <h2 className="text-xl font-black text-accent mb-6 flex items-center gap-2">
              Return & Refund Policy
            </h2>
            <div className="space-y-5 text-sm text-lightText leading-relaxed">
              <div>
                <h3 className="font-bold text-accent mb-2">Return Window</h3>
                <p>
                  Most products are eligible for return within <strong className="text-accent">10 days</strong> of delivery. 
                  The return window starts from the day the product is delivered to you.
                </p>
              </div>

              <div>
                <h3 className="font-bold text-accent mb-2">Eligible Items for Return</h3>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Unused, undamaged products in original packaging</li>
                  <li>Electronics with all original accessories and manuals</li>
                  <li>Clothing with tags still attached (unworn)</li>
                  <li>Products with manufacturing defects or damage at delivery</li>
                </ul>
              </div>

              <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
                <h3 className="font-bold text-red-700 mb-2">Non-Returnable Items</h3>
                <ul className="space-y-1 list-disc list-inside text-red-600 text-xs">
                  <li>Perishable goods (food, flowers, etc.)</li>
                  <li>Digital products and software licenses</li>
                  <li>Personal hygiene and health products (once opened)</li>
                  <li>Customized or personalized items</li>
                  <li>Hazardous materials</li>
                </ul>
              </div>

              <div>
                <h3 className="font-bold text-accent mb-2">Refund Process</h3>
                <ol className="space-y-2 list-decimal list-inside">
                  <li>Initiate return from My Orders → Select Order → Request Return</li>
                  <li>Our logistics partner picks up the item within 48-72 hours</li>
                  <li>Item is inspected at our warehouse (1-2 days)</li>
                  <li>Refund is processed within 5-7 business days</li>
                  <li>Amount credited to original payment method</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Privacy Policy Link */}
          <div className="bg-blue-50/50 border border-blue-100 rounded-3xl p-8 text-center">
            <h3 className="text-base font-bold text-accent mb-2">Have more questions about our policies?</h3>
            <p className="text-lightText text-sm mb-4">
              Check our detailed Privacy Policy and Terms of Service, or reach out to our support team.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <a href="/contact" className="px-5 py-2.5 bg-accent text-white font-bold rounded-xl hover:bg-orange-600 transition-colors text-sm">
                Contact Support
              </a>
              <a href="/faq" className="px-5 py-2.5 bg-white border border-gray-200 text-accent font-bold rounded-xl hover:bg-gray-50 transition-colors text-sm">
                View FAQ
              </a>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
};

export default PoliciesPage;
