import React, { useEffect, useMemo, useState } from 'react';
import HeroWith3D from '../components/HeroWith3D';
import SkintoneSelector from '../components/SkintoneSelector';
import OccasionSelector from '../components/OccasionSelector';
import ProductGrid from '../components/ProductGrid';
import VideoBanner from '../components/VideoBanner';
import TypewriterSearch from '../components/TypewriterSearch';
import { useCatalog } from '../contexts/catalog-context';
import { toProductCard } from '../lib/api';
import heroVideo from '../assets/Coin_in_Nature_Climate_Video.mp4';

const PRIMARY_HANDLE = import.meta.env.VITE_HOME_PRIMARY_COLLECTION ?? null;
const SECONDARY_HANDLE = import.meta.env.VITE_HOME_SECONDARY_COLLECTION ?? null;

export default function HomePage() {
  const { products: catalogProducts, ensureCollectionProducts } = useCatalog();
  const [latestProducts, setLatestProducts] = useState([]);
  const [moreProducts, setMoreProducts] = useState([]);
  const [latestLoading, setLatestLoading] = useState(true);
  const [moreLoading, setMoreLoading] = useState(true);
  const [selectedSkintone, setSelectedSkintone] = useState(null);

  const handleSkintoneScroll = () => {
    document.getElementById('skintone-selector')?.scrollIntoView({ behavior: 'smooth' });
  };

  // Scroll to occasion selector when skintone is selected
  useEffect(() => {
    if (selectedSkintone) {
      document.getElementById('occasion-selector')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedSkintone]);

  const fallbackLatest = useMemo(() => {
    if (!catalogProducts?.length) return [];
    return catalogProducts
      .slice(0, 4)
      .map((product) => toProductCard(product))
      .filter(Boolean);
  }, [catalogProducts]);

  const fallbackMore = useMemo(() => {
    if (!catalogProducts?.length) return [];
    return catalogProducts
      .slice(4, 8)
      .map((product) => toProductCard(product))
      .filter(Boolean);
  }, [catalogProducts]);

  useEffect(() => {
    let cancelled = false;

    async function loadPrimary() {
      const _t0 = performance.now();
      console.log('%c[HomePage] ⏳ Loading "Latest Drop" section...', 'color:#ec4899;font-weight:bold');
      setLatestLoading(true);
      if (!PRIMARY_HANDLE) {
        setLatestProducts(fallbackLatest);
        setLatestLoading(false);
        return;
      }
      try {
        const products = await ensureCollectionProducts(PRIMARY_HANDLE, { limit: 4 });
        if (cancelled) return;
        if (products?.length) {
          setLatestProducts(products.map((item) => toProductCard(item)).filter(Boolean));
        } else {
          setLatestProducts(fallbackLatest);
        }
      } catch (error) {
        console.warn(`Failed to load collection "${PRIMARY_HANDLE}"`, error);
        if (!cancelled) {
          setLatestProducts(fallbackLatest);
        }
      } finally {
        if (!cancelled) {
          const _dur = (performance.now() - _t0).toFixed(0);
          console.log(`%c[HomePage] ✅ "Latest Drop" ready in ${_dur}ms`, _dur > 2000 ? 'color:#ef4444;font-weight:bold' : 'color:#22c55e;font-weight:bold');
          setLatestLoading(false);
        }
      }
    }

    loadPrimary();

    return () => {
      cancelled = true;
    };
  }, [fallbackLatest, ensureCollectionProducts]);

  useEffect(() => {
    let cancelled = false;

    async function loadSecondary() {
      const _t0 = performance.now();
      console.log('%c[HomePage] ⏳ Loading "More From ARADHYA" section...', 'color:#ec4899;font-weight:bold');
      setMoreLoading(true);
      if (!SECONDARY_HANDLE) {
        setMoreProducts(fallbackMore);
        setMoreLoading(false);
        return;
      }
      try {
        const products = await ensureCollectionProducts(SECONDARY_HANDLE, { limit: 4 });
        if (cancelled) return;
        if (products?.length) {
          setMoreProducts(products.map((item) => toProductCard(item)).filter(Boolean));
        } else {
          setMoreProducts(fallbackMore);
        }
      } catch (error) {
        console.warn(`Failed to load collection "${SECONDARY_HANDLE}"`, error);
        if (!cancelled) {
          setMoreProducts(fallbackMore);
        }
      } finally {
        if (!cancelled) {
          const _dur = (performance.now() - _t0).toFixed(0);
          console.log(`%c[HomePage] ✅ "More From ARADHYA" ready in ${_dur}ms`, _dur > 2000 ? 'color:#ef4444;font-weight:bold' : 'color:#22c55e;font-weight:bold');
          setMoreLoading(false);
        }
      }
    }

    loadSecondary();

    return () => {
      cancelled = true;
    };
  }, [fallbackMore, ensureCollectionProducts]);

  return (
    <div className="home-page">
      <div className="relative">
        <div className="absolute left-0 top-3 z-40 w-full px-4 lg:hidden">
          <TypewriterSearch onSearchClick={() => document.dispatchEvent(new CustomEvent('open-search'))} />
        </div>

        <HeroWith3D
          heroVideoSrc={heroVideo}
          ctaLabel="Select Skintone"
          onCtaClick={handleSkintoneScroll}
        />
      </div>

      <div id="skintone-selector" className="site-shell pb-4 pt-6 md:pb-6 md:pt-8">
        <SkintoneSelector onSelect={setSelectedSkintone} />
      </div>

      {selectedSkintone && (
        <div id="occasion-selector">
          <OccasionSelector selectedSkintone={selectedSkintone} />
        </div>
      )}

      <ProductGrid
        title="Latest Drop"
        products={latestProducts}
        ctaHref="/products?category=t-shirts"
        ctaLabel="Shop Now"
        loading={latestLoading}
      />

      <VideoBanner />

      <ProductGrid
        title="More From ARADHYA"
        products={moreProducts}
        ctaHref="/products"
        ctaLabel="View All"
        loading={moreLoading}
      />
    </div>
  );
}
