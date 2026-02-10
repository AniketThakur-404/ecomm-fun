import React from "react";
import { motion as Motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import ProductCard from "./ProductCard";

const SectionHeader = ({ title, ctaHref, ctaLabel }) => (
  <div className="flex flex-col gap-4 border-t border-neutral-200 py-4 uppercase md:flex-row md:items-center md:justify-between">
    <h2 className="text-xs tracking-[0.35em] text-neutral-600">{title}</h2>
    <Link
      to={ctaHref}
      className="flex items-center gap-2 self-start rounded-full border border-neutral-900 px-5 py-2 text-[10px] tracking-[0.32em] transition hover:bg-neutral-900 hover:text-white sm:self-end md:self-auto"
    >
      {ctaLabel}
      <ChevronRight className="h-3 w-3" />
    </Link>
  </div>
);

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

export default function ProductGrid({ title, products, ctaHref = "/products", ctaLabel = "Discover More" }) {
  return (
    // Keep desktop width capped so the four-up layout keeps similar card widths
    <section className="site-shell section-gap">
      <SectionHeader title={title} ctaHref={ctaHref} ctaLabel={ctaLabel} />

      {/* Four-up on large screens with consistent spacing */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4 md:gap-4">
        {products.map((item, idx) => (
          <Motion.div
            key={item.title + idx}
            variants={cardVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            className="h-full"
          >
            <ProductCard item={item} />
          </Motion.div>
        ))}
      </div>

      <div className="flex justify-center py-5">
        <Link
          to={ctaHref}
          className="rounded-full border border-neutral-900 px-8 py-3 text-[11px] uppercase tracking-[0.3em] transition hover:bg-neutral-900 hover:text-white"
        >
          {ctaLabel}
        </Link>
      </div>
    </section>
  );
}

