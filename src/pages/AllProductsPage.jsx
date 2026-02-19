import MobilePageHeader from '../components/MobilePageHeader';

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import { useCatalog } from '../contexts/catalog-context';
import { fetchProductsPage, normaliseTokenValue, toProductCard } from '../lib/api';

const normalizeForMatch = (value) => {
  const normalized = normaliseTokenValue(value);
  if (!normalized) return '';
  return normalized.replace(/[^a-z0-9]+/g, ' ').trim();
};

const formatLabel = (value) => {
  if (!value) return '';
  return value
    .toString()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const tokenize = (value) => normalizeForMatch(value).split(' ').filter(Boolean);

const uniqueTokens = (values) => Array.from(new Set(values.filter(Boolean)));

const matchesToken = (source, targetTokens) => {
  if (!source || targetTokens.length === 0) return false;
  const sourceTokens = tokenize(source);
  if (sourceTokens.length === 0) return false;
  if (targetTokens.length === 1) {
    const target = targetTokens[0];
    if (sourceTokens.includes(target)) return true;
    return sourceTokens.some((token) => token.includes(target));
  }
  if (targetTokens.every((token) => sourceTokens.includes(token))) return true;
  const collapsedSource = sourceTokens.join('');
  const collapsedTarget = targetTokens.join('');
  return collapsedSource.includes(collapsedTarget);
};

const productMatchesFilter = (product, filterToken) => {
  if (!filterToken) return true;
  const targetTokens = tokenize(filterToken);
  if (targetTokens.length === 0) return true;

  const tags = Array.isArray(product?.tags) ? product.tags : [];
  const collections = Array.isArray(product?.collections) ? product.collections : [];
  const candidates = [
    product?.productType,
    ...tags,
    ...collections.map((collection) => collection?.handle),
    ...collections.map((collection) => collection?.title),
  ].filter(Boolean);

  if (candidates.some((candidate) => matchesToken(candidate, targetTokens))) return true;

  if (targetTokens.length > 1) {
    const candidateTokens = uniqueTokens(candidates.flatMap((candidate) => tokenize(candidate)));
    if (!candidateTokens.length) return false;
    return targetTokens.every((token) =>
      candidateTokens.some((candidateToken) => candidateToken === token || candidateToken.includes(token)),
    );
  }

  return false;
};

const OCCASION_SYNONYMS = {
  puja: ['puja', 'festive', 'festival'],
  festive: ['festive', 'puja', 'festival'],
};

const buildOccasionTokens = (value) => {
  const normalized = normalizeForMatch(value);
  if (!normalized || normalized === 'all') return [];
  const tokens = tokenize(normalized);
  const base = tokens[0] || normalized;
  const synonyms = OCCASION_SYNONYMS[base] ?? [];
  if (tokens.length <= 1) return uniqueTokens([normalized, ...synonyms]);
  return uniqueTokens([normalized, base, ...synonyms]);
};

const SKINTONE_GROUPS = [
  { id: 'fair', label: 'Fair Skin', tokens: ['fair skin', 'fair'] },
  { id: 'neutral', label: 'Neutral Skin', tokens: ['neutral skin', 'neutral', 'natural skin', 'natural'] },
  { id: 'dark', label: 'Dark Skin', tokens: ['dark skin', 'dark'] },
];

const PAGE_SIZE = 40;

const mergeUniqueProducts = (existing, incoming) => {
  const seen = new Set();
  const merged = [];

  [...existing, ...incoming].forEach((item) => {
    const key = item?.handle || item?.id;
    if (!key) {
      merged.push(item);
      return;
    }
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(item);
  });

  return merged;
};

const sortProducts = (items, sortBy) => {
  const sorted = [...items];
  if (sortBy === 'price_low') {
    sorted.sort((a, b) => (a?.price ?? 0) - (b?.price ?? 0));
  } else if (sortBy === 'price_high') {
    sorted.sort((a, b) => (b?.price ?? 0) - (a?.price ?? 0));
  } else if (sortBy === 'new') {
    sorted.sort((a, b) => String(b?.id || '').localeCompare(String(a?.id || '')));
  }
  return sorted;
};

const AllProductsPage = ({ initialCategory = 'all' }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeCategory = searchParams.get('category') ?? initialCategory;
  const rawSkintone = searchParams.get('skintone');
  const rawOccasion = searchParams.get('occasion');
  const skintoneFilter = normalizeForMatch(searchParams.get('skintone'));
  const occasionFilter = normalizeForMatch(searchParams.get('occasion'));
  const hasOccasionFilter = occasionFilter && occasionFilter !== 'all';

  const normalizedCategory = normalizeForMatch(activeCategory);
  const skintoneFromCategory = SKINTONE_GROUPS.find((group) =>
    group.tokens.some((token) => matchesToken(normalizedCategory, tokenize(token))),
  );
  const isSkintoneCategory = Boolean(skintoneFromCategory);
  const hasExplicitSkintone = skintoneFilter && skintoneFilter !== 'all';
  const hasSkintoneFilter = hasExplicitSkintone || isSkintoneCategory;
  const skintoneGroupFromFilter = hasExplicitSkintone
    ? SKINTONE_GROUPS.find((group) =>
      group.tokens.some((token) => normalizeForMatch(token) === skintoneFilter),
    )
    : null;
  const skintoneTokens = hasExplicitSkintone
    ? (skintoneGroupFromFilter ? skintoneGroupFromFilter.tokens : [skintoneFilter])
    : (skintoneFromCategory ? skintoneFromCategory.tokens : []);
  const occasionTokens = buildOccasionTokens(occasionFilter);

  const isAllMode = activeCategory === 'all' || isSkintoneCategory;
  const { products: catalogProducts, ensureCollectionProducts } = useCatalog();
  const [collectionProducts, setCollectionProducts] = useState([]);
  const [collectionLoading, setCollectionLoading] = useState(false);
  const [pagedProducts, setPagedProducts] = useState([]);
  const [pagedLoading, setPagedLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [catalogTotal, setCatalogTotal] = useState(null);
  const [sortBy, setSortBy] = useState('recommended');

  useEffect(() => {
    if (!isAllMode) return;
    setPagedProducts([]);
    setPage(1);
    setHasMore(true);
    setCatalogTotal(null);
  }, [activeCategory, isAllMode]);

  useEffect(() => {
    if (!isAllMode) return;
    let cancelled = false;

    async function loadPage() {
      setPagedLoading(true);
      try {
        const { items, meta } = await fetchProductsPage({
          limit: PAGE_SIZE,
          page,
        });
        if (cancelled) return;
        setPagedProducts((prev) => {
          const merged = mergeUniqueProducts(prev, items);
          if (meta?.total != null) {
            setCatalogTotal(meta.total);
            setHasMore(merged.length < meta.total);
          } else {
            setHasMore(items.length === PAGE_SIZE);
          }
          return merged;
        });
      } catch (error) {
        console.error('Failed to load products', error);
        if (!cancelled) {
          setHasMore(false);
        }
      } finally {
        if (!cancelled) {
          setPagedLoading(false);
        }
      }
    }

    loadPage();

    return () => {
      cancelled = true;
    };
  }, [isAllMode, page]);

  // Load products based on category (collection handle)
  useEffect(() => {
    if (isAllMode) return;
    let cancelled = false;
    setCollectionLoading(true);

    async function loadCollection() {
      try {
        const collectionProducts = await ensureCollectionProducts(activeCategory);
        if (!cancelled) {
          setCollectionProducts(collectionProducts);
        }
      } catch (e) {
        console.error(`Failed to load collection: ${activeCategory}`, e);
        if (!cancelled) setCollectionProducts([]);
      } finally {
        if (!cancelled) setCollectionLoading(false);
      }
    }

    loadCollection();

    return () => {
      cancelled = true;
    };
  }, [activeCategory, ensureCollectionProducts, isAllMode]);

  useEffect(() => {
    if (!isAllMode || !catalogProducts?.length || pagedProducts.length) return;
    setPagedProducts((prev) => mergeUniqueProducts(prev, catalogProducts));
  }, [catalogProducts, isAllMode, pagedProducts.length]);

  const products = isAllMode ? pagedProducts : collectionProducts;
  const loading = isAllMode ? pagedLoading && pagedProducts.length === 0 : collectionLoading;
  const filteredProducts = useMemo(() => {
    const applySkintone = (hasExplicitSkintone || isSkintoneCategory) && skintoneTokens.length > 0;
    const applyOccasion = occasionTokens.length > 0;
    let filtered = products;
    if (applySkintone || applyOccasion) {
      filtered = products.filter((product) => {
        const matchesSkintone = applySkintone
          ? skintoneTokens.some((token) => productMatchesFilter(product, token))
          : true;
        const matchesOccasion = applyOccasion
          ? occasionTokens.some((token) => productMatchesFilter(product, token))
          : true;
        return matchesSkintone && matchesOccasion;
      });
    }
    return filtered;
  }, [products, hasExplicitSkintone, isSkintoneCategory, skintoneTokens, occasionTokens]);

  const sortedProducts = useMemo(
    () => sortProducts(filteredProducts, sortBy).map(toProductCard).filter(Boolean),
    [filteredProducts, sortBy],
  );

  const shouldGroupBySkintone = hasOccasionFilter && !hasSkintoneFilter && activeCategory === 'all';
  const groupedProducts = useMemo(() => {
    if (!shouldGroupBySkintone) return [];
    return SKINTONE_GROUPS.map((group) => {
      const toneProducts = filteredProducts.filter((product) =>
        group.tokens.some((token) => productMatchesFilter(product, token)),
      );
      return {
        ...group,
        products: sortProducts(toneProducts, sortBy).map(toProductCard).filter(Boolean),
      };
    }).filter((group) => group.products.length > 0);
  }, [filteredProducts, shouldGroupBySkintone, sortBy]);

  const hasActiveFilters =
    Boolean(occasionTokens.length) ||
    hasExplicitSkintone ||
    isSkintoneCategory ||
    activeCategory !== 'all';
  const totalItems = hasActiveFilters ? filteredProducts.length : catalogTotal ?? filteredProducts.length;
  const displaySkintone = skintoneFilter
    ? formatLabel(rawSkintone || skintoneFilter)
    : (skintoneFromCategory?.label || '');
  const displayOccasion = occasionFilter ? formatLabel(rawOccasion || occasionFilter) : '';
  const pageTitle = shouldGroupBySkintone && displayOccasion
    ? displayOccasion
    : (activeCategory === 'all' ? 'All Products' : formatLabel(activeCategory));

  const updateFilter = (key, value) => {
    const prev = new URLSearchParams(searchParams);
    if (!value || value === 'all') {
      prev.delete(key);
    } else {
      prev.set(key, value);
    }
    setSearchParams(prev);
  };

  const clearToneAndOccasionFilters = () => {
    const prev = new URLSearchParams(searchParams);
    prev.delete('skintone');
    prev.delete('occasion');
    setSearchParams(prev);
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-page)]">
      {/* Mobile Header */}
      <MobilePageHeader
        title={pageTitle}
        onSearch={() => document.dispatchEvent(new CustomEvent('open-search'))}
      />

      {/* Breadcrumb / Title Header - Desktop Only */}
      <div className="site-shell hidden flex-col gap-2 py-6 md:flex">
        <div className="text-xs text-gray-500">
          Home / <span className="font-bold text-gray-800 capitalize">{pageTitle}</span>
        </div>
        <h1 className="text-lg font-bold text-gray-800 capitalize">
          {pageTitle} <span className="text-gray-400 font-normal text-sm">- {totalItems} items</span>
        </h1>
      </div>

      <div className="border-y border-[var(--color-border)] bg-[var(--color-bg-surface)] lg:hidden">
        <div className="site-shell grid gap-2 py-3 sm:grid-cols-3">
          <select
            value={rawSkintone || 'all'}
            onChange={(event) => updateFilter('skintone', event.target.value)}
            className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text-main)] focus:border-[var(--color-primary)] focus:outline-none"
          >
            <option value="all">Skin Tone</option>
            <option value="fair">Fair</option>
            <option value="neutral">Neutral</option>
            <option value="dark">Dark</option>
          </select>

          <select
            value={rawOccasion || 'all'}
            onChange={(event) => updateFilter('occasion', event.target.value)}
            className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text-main)] focus:border-[var(--color-primary)] focus:outline-none"
          >
            <option value="all">Occasion</option>
            <option value="date">Date Wear</option>
            <option value="office">Office Wear</option>
            <option value="puja">Puja/Festive</option>
            <option value="party">Party</option>
            <option value="casual">Casual</option>
          </select>

          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text-main)] focus:border-[var(--color-primary)] focus:outline-none"
          >
            <option value="recommended">Recommended</option>
            <option value="new">What's New</option>
            <option value="popularity">Popularity</option>
            <option value="price_low">Price: Low to High</option>
            <option value="price_high">Price: High to Low</option>
          </select>
        </div>
        {(skintoneFilter || occasionFilter) ? (
          <div className="site-shell pb-3">
            <button
              onClick={clearToneAndOccasionFilters}
              className="rounded-full border border-[var(--color-primary)] px-4 py-1.5 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white"
            >
              Reset Filters
            </button>
          </div>
        ) : null}
      </div>

      {/* Filter Bar */}
      <div className="hidden border-y border-[var(--color-border)] bg-[var(--color-bg-surface)] lg:block">
        <div className="site-shell py-3 flex justify-between items-center gap-4">
          {/* Left: Filters */}
          <div className="flex items-center gap-2 md:gap-4 overflow-x-auto no-scrollbar whitespace-nowrap flex-1">

            {/* Skin Tone Filter */}
            <div className="relative group">
              <button className={`flex items-center gap-1 text-sm font-bold px-4 py-2 rounded-full transition-colors whitespace-nowrap ${skintoneFilter ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}>
                {skintoneFilter ? `Skin: ${displaySkintone}` : 'Skin Tone'} <ChevronDown className="w-4 h-4" />
              </button>
              <div className="absolute top-full left-0 mt-1 w-40 bg-white border border-gray-100 shadow-lg py-2 hidden group-hover:block z-40 rounded-lg">
                <button onClick={() => updateFilter('skintone', 'all')} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50">All</button>
                <button onClick={() => updateFilter('skintone', 'fair')} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50">Fair</button>
                <button onClick={() => updateFilter('skintone', 'neutral')} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50">Neutral</button>
                <button onClick={() => updateFilter('skintone', 'dark')} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50">Dark</button>
              </div>
            </div>

            {/* Occasion Filter */}
            <div className="relative group">
              <button className={`flex items-center gap-1 text-sm font-bold px-4 py-2 rounded-full transition-colors whitespace-nowrap ${occasionFilter ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}>
                {occasionFilter ? `Occasion: ${displayOccasion}` : 'Occasion'} <ChevronDown className="w-4 h-4" />
              </button>
              <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-100 shadow-lg py-2 hidden group-hover:block z-40 rounded-lg">
                <button onClick={() => updateFilter('occasion', 'all')} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50">All</button>
                <button onClick={() => updateFilter('occasion', 'date')} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50">Date Wear</button>
                <button onClick={() => updateFilter('occasion', 'office')} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50">Office Wear</button>
                <button onClick={() => updateFilter('occasion', 'puja')} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50">Puja/Festive</button>
                <button onClick={() => updateFilter('occasion', 'party')} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50">Party</button>
                <button onClick={() => updateFilter('occasion', 'casual')} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50">Casual</button>
              </div>
            </div>

            {/* Clear Filters */}
            {(skintoneFilter || occasionFilter) && (
              <button
                onClick={clearToneAndOccasionFilters}
                className="text-xs font-bold text-[var(--color-primary)] hover:underline"
              >
                Reset
              </button>
            )}

          </div>

          {/* Right: Sort - Fixed width/shrink */}
          <div className="flex-shrink-0 flex items-center gap-2 border border-gray-200 px-3 py-2 rounded-sm cursor-pointer hover:border-gray-400 relative group">
            <span className="text-sm text-gray-500 hidden sm:inline">Sort by:</span>
            <span className="text-sm font-bold text-gray-800 capitalize">{sortBy.replace('_', ' ')}</span>
            <ChevronDown className="w-4 h-4 text-gray-500" />

            <div className="absolute top-full right-0 mt-1 w-48 bg-white border border-gray-100 shadow-lg py-2 hidden group-hover:block z-40">
              <button onClick={() => setSortBy('recommended')} className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${sortBy === 'recommended' ? 'font-bold bg-gray-50' : ''}`}>Recommended</button>
              <button onClick={() => setSortBy('new')} className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${sortBy === 'new' ? 'font-bold bg-gray-50' : ''}`}>What's New</button>
              <button onClick={() => setSortBy('popularity')} className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${sortBy === 'popularity' ? 'font-bold bg-gray-50' : ''}`}>Popularity</button>
              <button onClick={() => setSortBy('price_low')} className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${sortBy === 'price_low' ? 'font-bold bg-gray-50' : ''}`}>Price: Low to High</button>
              <button onClick={() => setSortBy('price_high')} className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${sortBy === 'price_high' ? 'font-bold bg-gray-50' : ''}`}>Price: High to Low</button>
            </div>
          </div>
        </div>
      </div>

      {/* Product Grid */}
      <div className="site-shell py-6 md:py-8">
        {loading ? (
          <div className="flex justify-center py-20 text-gray-500">Loading products...</div>
        ) : shouldGroupBySkintone ? (
          groupedProducts.length > 0 ? (
            <div className="space-y-10">
              {groupedProducts.map((group) => (
                <section key={group.id} className="space-y-4">
                  <div className="flex items-end justify-between">
                    <h2 className="text-xl font-bold text-gray-900">{group.label}</h2>
                    <span className="text-sm text-gray-500">{group.products.length} items</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-4 sm:gap-y-8 md:grid-cols-3 lg:grid-cols-5 lg:gap-x-6 lg:gap-y-10">
                    {group.products.map((product, index) => (
                      <ProductCard key={product.handle || product.id || index} item={product} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="col-span-full text-center py-20 text-gray-500">No products found for this occasion.</div>
          )
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-4 sm:gap-y-8 md:grid-cols-3 lg:grid-cols-5 lg:gap-x-6 lg:gap-y-10">
            {sortedProducts.length > 0 ? (
              sortedProducts.map((product, index) => (
                <ProductCard key={product.handle || product.id || index} item={product} />
              ))
            ) : (
              <div className="col-span-full text-center py-20 text-gray-500">No products found in this category.</div>
            )}
          </div>
        )}

        {isAllMode && sortedProducts.length > 0 ? (
          <div className="flex justify-center pt-10">
            {hasMore ? (
              <button
                type="button"
                onClick={() => setPage((prev) => prev + 1)}
                disabled={pagedLoading}
                className="rounded-full border border-gray-300 px-6 py-2 text-sm font-semibold text-gray-700 transition hover:border-gray-900 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pagedLoading ? 'Loading...' : 'Load more'}
              </button>
            ) : (
              <span className="text-sm text-gray-500">You have reached the end.</span>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default AllProductsPage;
