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

const ProductCardSkeleton = () => (
  <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
    <div className="aspect-[3/4] w-full animate-pulse bg-neutral-200" />
    <div className="space-y-2 p-3">
      <div className="h-3 w-2/3 animate-pulse rounded bg-neutral-200" />
      <div className="h-3 w-1/2 animate-pulse rounded bg-neutral-200" />
      <div className="h-3 w-1/3 animate-pulse rounded bg-neutral-200" />
    </div>
  </div>
);

export default function ProductGrid({
  title,
  products = [],
  ctaHref = "/products",
  ctaLabel = "Discover More",
  loading = false,
}) {
  const hasProducts = Array.isArray(products) && products.length > 0;
  const showSkeleton = loading && !hasProducts;
  const skeletonItems = Array.from({ length: 4 }, (_, idx) => idx);

  return (
    // Keep desktop width capped so the four-up layout keeps similar card widths
    <section className="site-shell section-gap">
      <SectionHeader title={title} ctaHref={ctaHref} ctaLabel={ctaLabel} />

      {/* Four-up on large screens with consistent spacing */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4 md:gap-4">
        {showSkeleton
          ? skeletonItems.map((item) => <ProductCardSkeleton key={`skeleton-${item}`} />)
          : products.map((item, idx) => (
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

      {!loading && !hasProducts ? (
        <p className="py-5 text-center text-sm text-neutral-500">Products will appear here shortly.</p>
      ) : null}

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

