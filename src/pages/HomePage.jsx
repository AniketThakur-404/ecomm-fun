import React, { useEffect, useMemo, useState } from 'react';
import HeroWith3D from '../components/HeroWith3D';
import HeroCarousel from '../components/HeroCarousel';
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
      if (!PRIMARY_HANDLE) {
        setLatestProducts(fallbackLatest);
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
      if (!SECONDARY_HANDLE) {
        setMoreProducts(fallbackMore);
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
      }
    }

    loadSecondary();

    return () => {
      cancelled = true;
    };
  }, [fallbackMore, ensureCollectionProducts]);

  return (
    <div className="home-page">
      {/* Hero Section with Overlay Search */}
      <div className="relative">
        {/* Mobile Search Bar Overlay */}
        <div className="lg:hidden absolute top-4 left-0 w-full z-40 px-4">
          <TypewriterSearch onSearchClick={() => document.dispatchEvent(new CustomEvent('open-search'))} />
        </div>

        <HeroWith3D
          heroVideoSrc={heroVideo}
          ctaLabel="Select Skintone"
          onCtaClick={handleSkintoneScroll}
        />
      </div>

      <div id="skintone-selector" className="site-shell section-gap">
        <SkintoneSelector onSelect={setSelectedSkintone} />
      </div>

      {selectedSkintone && (
        <div id="occasion-selector">
          <OccasionSelector selectedSkintone={selectedSkintone} />
        </div>
      )}

      <div className="site-shell section-gap">
        <ProductGrid
          title="Latest Drop"
          products={latestProducts}
          ctaHref="/products?category=t-shirts"
          ctaLabel="Shop Now"
        />
      </div>



      <div className="site-shell section-gap">
        <VideoBanner />
      </div>

      <div className="site-shell section-gap">
        <ProductGrid
          title="More From ARADHYA"
          products={moreProducts}
          ctaHref="/products"
          ctaLabel="View All"
        />
      </div>
    </div>
  );
}
