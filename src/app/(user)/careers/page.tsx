import Container from "@/components/Container";
import type { Metadata } from "next";


export const metadata: Metadata = {
  title: "Careers — Join DCart",
  description: "Build the future of AI-powered commerce. Explore career opportunities at DCart across engineering, data science, design, and more.",
};

const CareersPage = () => {
  const openings = [
    { role: "Senior ML Engineer — Recommendations", dept: "Engineering", location: "Bangalore / Remote", type: "Full-time" },
    { role: "Full Stack Engineer (Next.js + Go)", dept: "Engineering", location: "Bangalore / Remote", type: "Full-time" },
    { role: "Data Scientist — Fraud & Risk", dept: "Data Science", location: "Remote", type: "Full-time" },
    { role: "Product Manager — Seller Platform", dept: "Product", location: "Bangalore", type: "Full-time" },
    { role: "UI/UX Designer — Mobile & Web", dept: "Design", location: "Remote", type: "Full-time" },
    { role: "DevOps / Platform Engineer", dept: "Infrastructure", location: "Remote", type: "Full-time" },
  ];

  const perks = [
    { icon: "", title: "Competitive Pay", desc: "Top-of-market salaries with equity participation" },
    { icon: "", title: "Remote-First", desc: "Work from anywhere in India, fully supported" },
    { icon: "", title: "Learning Budget", desc: "₹50,000/year for courses, conferences, and books" },
    { icon: "", title: "Health Insurance", desc: "Comprehensive family health coverage" },
    { icon: "", title: "Latest Hardware", desc: "MacBook Pro + monitor setup for all engineers" },
    { icon: "", title: "Flexible PTO", desc: "Unlimited vacation with a 15-day minimum" },
  ];

  return (
    <div>
      {/* hero */}
      <div className="bg-gradient-to-br from-accent to-zinc-900 text-white py-20 px-4 sm:px-6 md:px-8">
        <div className="w-full text-left">
          <span className="inline-block px-4 py-1.5 bg-white/10 text-orange-400 text-xs font-bold rounded-full uppercase tracking-widest mb-4">
            Careers at DCart
          </span>
          <h1 className="text-4xl md:text-5xl font-black mb-4">
            Build the Future of <span className="text-orange-400">Commerce</span>
          </h1>
          <p className="text-white/70 max-w-2xl text-lg">
            We&apos;re a team of engineers, designers, and data scientists who believe AI can transform
            how people shop. Come build it with us.
          </p>
        </div>
      </div>

      <Container className="py-16">
        {/* Perks */}
        <div className="mb-16">
          <h2 className="text-2xl font-black text-accent text-center mb-2">Why DCart?</h2>
          <p className="text-lightText text-center mb-8 text-sm">We take care of our people so they can do their best work.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {perks.map((perk) => (
              <div key={perk.title} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs hover:shadow-md transition-shadow">
                <span className="text-2xl block mb-3"></span>
                <h3 className="text-sm font-bold text-accent mb-1">{perk.title}</h3>
                <p className="text-xs text-lightText">{perk.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Open Roles */}
        <div>
          <h2 className="text-2xl font-black text-accent mb-2">Open Positions</h2>
          <p className="text-lightText mb-6 text-sm">We&apos;re growing fast and always looking for exceptional people.</p>
          <div className="space-y-3">
            {openings.map((job) => (
              <div
                key={job.role}
                className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-gray-100 rounded-2xl p-5 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all group"
              >
                <div>
                  <h3 className="text-sm font-bold text-accent group-hover:text-darkOrange transition-colors">
                    {job.role}
                  </h3>
                  <div className="flex flex-wrap items-center gap-3 mt-1.5">
                    <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100">
                      {job.dept}
                    </span>
                    <span className="text-[10px] text-lightText font-medium">Location: {job.location}</span>
                    <span className="text-[10px] text-lightText font-medium">Type: {job.type}</span>
                  </div>
                </div>
                <a
                  href={`mailto:careers@dcart.in?subject=Application: ${encodeURIComponent(job.role)}`}
                  className="px-4 py-2 bg-accent text-white text-xs font-bold rounded-xl hover:bg-orange-600 transition-colors flex-shrink-0 text-center"
                >
                  Apply Now →
                </a>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 text-center p-8 bg-gray-50 border border-gray-100 rounded-3xl">
          <h3 className="text-lg font-bold text-accent mb-2">Don&apos;t see a role that fits?</h3>
          <p className="text-lightText text-sm mb-4">
            We&apos;re always interested in exceptional talent. Send us your resume and we&apos;ll keep you in mind.
          </p>
          <a
            href="mailto:careers@dcart.in"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-white font-bold rounded-xl hover:bg-orange-600 transition-colors text-sm"
          >
            Send a General Application
          </a>
        </div>
      </Container>
    </div>
  );
};

export default CareersPage;
