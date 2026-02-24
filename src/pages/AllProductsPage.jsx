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

const toCanonicalSkintone = (value) => {
  const tokens = tokenize(value);
  if (!tokens.length) return '';
  if (tokens.includes('fair')) return 'fair';
  if (tokens.includes('neutral') || tokens.includes('natural')) return 'neutral';
  if (tokens.includes('dark')) return 'dark';
  return tokens[0];
};

const toCanonicalOccasion = (value) => {
  const tokens = tokenize(value);
  if (!tokens.length) return '';
  if (tokens.includes('puja') || tokens.includes('festive') || tokens.includes('festival')) return 'puja';
  if (tokens.includes('office') || tokens.includes('work')) return 'office';
  if (tokens.includes('date')) return 'date';
  if (tokens.includes('party')) return 'party';
  if (tokens.includes('casual')) return 'casual';
  return tokens[0];
};

const normalizeRuleValues = (value, canonicalize) => {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];
  return uniqueTokens(values.map((item) => canonicalize(item)).filter(Boolean));
};

const getStorefrontFlowRule = (collection) => {
  const rules = collection?.rules;
  if (!rules || typeof rules !== 'object' || Array.isArray(rules)) return null;
  const flow = rules.storefrontFlow;
  if (!flow || typeof flow !== 'object' || Array.isArray(flow)) return null;
  if (flow.enabled === false) return null;
  return {
    skintones: normalizeRuleValues(flow.skintones, toCanonicalSkintone),
    occasions: normalizeRuleValues(flow.occasions, toCanonicalOccasion),
  };
};

const productMatchesStorefrontFlow = (product, { skintone = '', occasion = '' } = {}) => {
  const collections = Array.isArray(product?.collections) ? product.collections : [];
  if (!collections.length) return false;

  return collections.some((collection) => {
    const flow = getStorefrontFlowRule(collection);
    if (!flow) return false;
    const matchesSkintone =
      !skintone || flow.skintones.length === 0 || flow.skintones.includes(skintone);
    const matchesOccasion =
      !occasion || flow.occasions.length === 0 || flow.occasions.includes(occasion);
    return matchesSkintone && matchesOccasion;
  });
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
  const selectedSkintoneKey = hasExplicitSkintone
    ? toCanonicalSkintone(skintoneGroupFromFilter?.id || rawSkintone || skintoneFilter)
    : (isSkintoneCategory ? toCanonicalSkintone(skintoneFromCategory?.id || activeCategory) : '');
  const selectedOccasionKey = hasOccasionFilter
    ? toCanonicalOccasion(rawOccasion || occasionFilter)
    : '';

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
  const useFlowRuleFiltering = useMemo(() => {
    const shouldFilterByFlow = hasSkintoneFilter || (hasOccasionFilter && activeCategory === 'all');
    if (!shouldFilterByFlow) return false;
    return products.some((product) =>
      (product?.collections || []).some((collection) => Boolean(getStorefrontFlowRule(collection))),
    );
  }, [products, hasSkintoneFilter, hasOccasionFilter, activeCategory]);

  const filteredProducts = useMemo(() => {
    const applySkintone = (hasExplicitSkintone || isSkintoneCategory) && skintoneTokens.length > 0;
    const applyOccasion = occasionTokens.length > 0;
    if (!(applySkintone || applyOccasion)) return products;

    if (useFlowRuleFiltering) {
      return products.filter((product) =>
        productMatchesStorefrontFlow(product, {
          skintone: applySkintone ? selectedSkintoneKey : '',
          occasion: applyOccasion ? selectedOccasionKey : '',
        }),
      );
    }

    return products.filter((product) => {
      const matchesSkintone = applySkintone
        ? skintoneTokens.some((token) => productMatchesFilter(product, token))
        : true;
      const matchesOccasion = applyOccasion
        ? occasionTokens.some((token) => productMatchesFilter(product, token))
        : true;
      return matchesSkintone && matchesOccasion;
    });
  }, [
    products,
    hasExplicitSkintone,
    isSkintoneCategory,
    skintoneTokens,
    occasionTokens,
    useFlowRuleFiltering,
    selectedSkintoneKey,
    selectedOccasionKey,
  ]);

  const sortedProducts = useMemo(
    () => sortProducts(filteredProducts, sortBy).map(toProductCard).filter(Boolean),
    [filteredProducts, sortBy],
  );

  const shouldGroupBySkintone = hasOccasionFilter && !hasSkintoneFilter && activeCategory === 'all';
  const groupedProducts = useMemo(() => {
    if (!shouldGroupBySkintone) return [];
    return SKINTONE_GROUPS.map((group) => {
      const toneProducts = filteredProducts.filter((product) =>
        useFlowRuleFiltering
          ? productMatchesStorefrontFlow(product, {
            skintone: group.id,
            occasion: selectedOccasionKey,
          })
          : group.tokens.some((token) => productMatchesFilter(product, token)),
      );
      return {
        ...group,
        products: sortProducts(toneProducts, sortBy).map(toProductCard).filter(Boolean),
      };
    }).filter((group) => group.products.length > 0);
  }, [filteredProducts, shouldGroupBySkintone, sortBy, useFlowRuleFiltering, selectedOccasionKey]);

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

      {/* Mobile Filter Bar */}
      <div className="border-b border-gray-100 bg-white lg:hidden sticky top-14 z-30">
        <div className="site-shell py-3 overflow-x-auto no-scrollbar flex items-center gap-2">

          <div className="relative flex-shrink-0">
            <select
              value={rawSkintone || 'all'}
              onChange={(event) => updateFilter('skintone', event.target.value)}
              className={`appearance-none rounded-full border px-4 py-1.5 text-xs font-bold transition-colors focus:outline-none pr-8 ${skintoneFilter ? 'bg-black text-white border-black' : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-black'
                }`}
            >
              <option value="all">Skin Tone</option>
              <option value="fair">Fair</option>
              <option value="neutral">Neutral</option>
              <option value="dark">Dark</option>
            </select>
            <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none ${skintoneFilter ? 'text-white' : 'text-gray-500'}`} />
          </div>

          <div className="relative flex-shrink-0">
            <select
              value={rawOccasion || 'all'}
              onChange={(event) => updateFilter('occasion', event.target.value)}
              className={`appearance-none rounded-full border px-4 py-1.5 text-xs font-bold transition-colors focus:outline-none pr-8 ${occasionFilter ? 'bg-black text-white border-black' : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-black'
                }`}
            >
              <option value="all">Occasion</option>
              <option value="date">Date Wear</option>
              <option value="office">Office Wear</option>
              <option value="puja">Puja/Festive</option>
              <option value="party">Party</option>
              <option value="casual">Casual</option>
            </select>
            <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none ${occasionFilter ? 'text-white' : 'text-gray-500'}`} />
          </div>

          <div className="relative flex-shrink-0">
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className="appearance-none rounded-full border border-gray-200 bg-white px-4 py-1.5 text-xs font-bold text-gray-800 transition-colors focus:outline-none focus:border-black hover:border-black pr-8"
            >
              <option value="recommended">Best</option>
              <option value="new">Newest</option>
              <option value="popularity">Popular</option>
              <option value="price_low">Price: Low</option>
              <option value="price_high">Price: High</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none text-gray-500" />
          </div>

          {(skintoneFilter || occasionFilter) ? (
            <button
              onClick={clearToneAndOccasionFilters}
              className="flex-shrink-0 text-[11px] font-bold text-gray-500 hover:text-black hover:underline px-2"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="hidden border-y border-[var(--color-border)] bg-[var(--color-bg-surface)] lg:block">
        <div className="site-shell py-3 flex justify-between items-center gap-4">
          {/* Left: Filters */}
          <div className="flex items-center gap-4 overflow-x-visible flex-1">

            {/* Skin Tone Filter */}
            <div className="relative group/filter">
              <button className={`flex items-center gap-1 text-sm font-bold px-4 py-2 rounded-full transition-colors whitespace-nowrap ${skintoneFilter ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}>
                {skintoneFilter ? `Skin: ${displaySkintone}` : 'Skin Tone'} <ChevronDown className="w-4 h-4" />
              </button>
              <div className="absolute top-full left-0 pt-2 hidden group-hover/filter:block z-50">
                <div className="w-48 bg-white border border-gray-100 shadow-xl py-2 rounded-xl overflow-hidden">
                  <button onClick={() => updateFilter('skintone', 'all')} className="block w-full text-left px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-black">All Skin Tones</button>
                  <button onClick={() => updateFilter('skintone', 'fair')} className="block w-full text-left px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-black">Fair</button>
                  <button onClick={() => updateFilter('skintone', 'neutral')} className="block w-full text-left px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-black">Neutral</button>
                  <button onClick={() => updateFilter('skintone', 'dark')} className="block w-full text-left px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-black">Dark</button>
                </div>
              </div>
            </div>

            {/* Occasion Filter */}
            <div className="relative group/filter">
              <button className={`flex items-center gap-1 text-sm font-bold px-4 py-2 rounded-full transition-colors whitespace-nowrap ${occasionFilter ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}>
                {occasionFilter ? `Occasion: ${displayOccasion}` : 'Occasion'} <ChevronDown className="w-4 h-4" />
              </button>
              <div className="absolute top-full left-0 pt-2 hidden group-hover/filter:block z-50">
                <div className="w-48 bg-white border border-gray-100 shadow-xl py-2 rounded-xl overflow-hidden">
                  <button onClick={() => updateFilter('occasion', 'all')} className="block w-full text-left px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-black">All Occasions</button>
                  <button onClick={() => updateFilter('occasion', 'date')} className="block w-full text-left px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-black">Date Wear</button>
                  <button onClick={() => updateFilter('occasion', 'office')} className="block w-full text-left px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-black">Office Wear</button>
                  <button onClick={() => updateFilter('occasion', 'puja')} className="block w-full text-left px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-black">Puja/Festive</button>
                  <button onClick={() => updateFilter('occasion', 'party')} className="block w-full text-left px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-black">Party</button>
                  <button onClick={() => updateFilter('occasion', 'casual')} className="block w-full text-left px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-black">Casual</button>
                </div>
              </div>
            </div>

            {/* Clear Filters */}
            {(skintoneFilter || occasionFilter) && (
              <button
                onClick={clearToneAndOccasionFilters}
                className="text-xs font-bold text-gray-500 hover:text-black hover:underline px-2"
              >
                Reset
              </button>
            )}

          </div>

          {/* Right: Sort */}
          <div className="flex-shrink-0 relative group/sort">
            <button className="flex items-center gap-2 border border-gray-200 px-4 py-2 rounded-full hover:border-black transition-colors bg-white z-10 relative">
              <span className="text-sm font-bold text-gray-800 capitalize">Sort: {sortBy.replace('_', ' ')}</span>
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </button>

            <div className="absolute top-full right-0 pt-2 hidden group-hover/sort:block z-50">
              <div className="w-56 bg-white border border-gray-100 shadow-xl py-2 rounded-xl overflow-hidden">
                <button onClick={() => setSortBy('recommended')} className={`block w-full text-left px-5 py-2.5 text-sm font-medium hover:bg-gray-50 ${sortBy === 'recommended' ? 'text-black font-bold bg-gray-50' : 'text-gray-700'}`}>Recommended</button>
                <button onClick={() => setSortBy('new')} className={`block w-full text-left px-5 py-2.5 text-sm font-medium hover:bg-gray-50 ${sortBy === 'new' ? 'text-black font-bold bg-gray-50' : 'text-gray-700'}`}>What's New</button>
                <button onClick={() => setSortBy('popularity')} className={`block w-full text-left px-5 py-2.5 text-sm font-medium hover:bg-gray-50 ${sortBy === 'popularity' ? 'text-black font-bold bg-gray-50' : 'text-gray-700'}`}>Popularity</button>
                <button onClick={() => setSortBy('price_low')} className={`block w-full text-left px-5 py-2.5 text-sm font-medium hover:bg-gray-50 ${sortBy === 'price_low' ? 'text-black font-bold bg-gray-50' : 'text-gray-700'}`}>Price: Low to High</button>
                <button onClick={() => setSortBy('price_high')} className={`block w-full text-left px-5 py-2.5 text-sm font-medium hover:bg-gray-50 ${sortBy === 'price_high' ? 'text-black font-bold bg-gray-50' : 'text-gray-700'}`}>Price: High to Low</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Product Grid */}
      <div className="site-shell py-6 lg:py-8 mb-20 md:mb-0">
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
