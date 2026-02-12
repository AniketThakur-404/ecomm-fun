import MobilePageHeader from '../components/MobilePageHeader';
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import { useCatalog } from '../contexts/catalog-context';
import { normaliseTokenValue, toProductCard, fetchCollectionByHandle } from '../lib/api';

const normalizeForMatch = (value) => {
    const normalized = normaliseTokenValue(value);
    if (!normalized) return '';
    return normalized.replace(/[^a-z0-9]+/g, ' ').trim();
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

const CollectionPage = () => {
    const { handle } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const skintoneFilter = normalizeForMatch(searchParams.get('skintone'));

    const { ensureCollectionProducts } = useCatalog();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [collectionInfo, setCollectionInfo] = useState(null);
    const [sortBy, setSortBy] = useState('recommended');

    useEffect(() => {
        let cancelled = false;
        setLoading(true);

        async function loadCollection() {
            try {
                // LOG 1: Request Init
                console.log(`%c[API] Fetching collection: ${handle}`, 'color: #00d1ff; font-weight: bold');
                
                const result = await fetchCollectionByHandle(handle);
                
                // LOG 2: Primary API Response
                console.log('%c[API] Success (fetchCollectionByHandle):', 'color: #4caf50; font-weight: bold', result);

                if (!cancelled) {
                    if (result) {
                        setCollectionInfo({
                            title: result.title,
                            description: result.description,
                            image: result.image
                        });
                        setProducts(result.products || []);
                    } else {
                        // LOG 3: Fallback warning
                        console.warn(`%c[API] No result for "${handle}". Triggering ensureCollectionProducts...`, 'color: #ff9800');
                        
                        const cols = await ensureCollectionProducts(handle);
                        
                        // LOG 4: Fallback Response
                        console.log('%c[API] Fallback Result:', 'color: #ff9800; font-weight: bold', cols);
                        
                        setProducts(cols || []);
                        setCollectionInfo({ title: handle.replace(/-/g, ' '), description: '' });
                    }
                }
            } catch (e) {
                console.error(`%c[API] Error loading collection: ${handle}`, 'color: #f44336; font-weight: bold', e);
                if (!cancelled) setProducts([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        if (handle) {
            loadCollection();
        }

        return () => { cancelled = true; };
    }, [handle, ensureCollectionProducts]);

    const sortedProducts = useMemo(() => {
        const applySkintone = skintoneFilter && skintoneFilter !== 'all';
        let filtered = products;

        // LOG 5: Data transformation tracking
        if (products.length > 0) {
            console.log(`%c[Logic] Processing ${products.length} products. Skintone: ${skintoneFilter || 'none'}, Sort: ${sortBy}`, 'color: #9c27b0');
        }

        if (applySkintone) {
            filtered = products.filter((product) => productMatchesFilter(product, skintoneFilter));
        }

        let sorted = [...filtered];
        if (sortBy === 'price_low') {
            sorted.sort((a, b) => (a?.price ?? 0) - (b?.price ?? 0));
        } else if (sortBy === 'price_high') {
            sorted.sort((a, b) => (b?.price ?? 0) - (a?.price ?? 0));
        } else if (sortBy === 'new') {
            sorted.sort((a, b) => String(b?.id || '').localeCompare(String(a?.id || '')));
        }
        
        const finalResults = sorted.map(toProductCard).filter(Boolean);
        
        // LOG 6: Final count
        if (products.length > 0) {
            console.log(`%c[Logic] Final products to display: ${finalResults.length}`, 'color: #9c27b0; font-weight: bold');
        }

        return finalResults;
    }, [products, sortBy, skintoneFilter]);

    const updateFilter = (key, value) => {
        const prev = new URLSearchParams(searchParams);
        if (!value || value === 'all') {
            prev.delete(key);
        } else {
            prev.set(key, value);
        }
        setSearchParams(prev);
    };

    return (
        <div className="bg-white min-h-screen">
            <MobilePageHeader
                title={collectionInfo?.title || handle}
                onSearch={() => document.dispatchEvent(new CustomEvent('open-search'))}
            />

            <div className="site-shell pt-6 pb-4">
                <div className="text-xs text-gray-500 mb-2">
                    Home / Collections / <span className="font-bold text-gray-800 capitalize">{collectionInfo?.title || handle}</span>
                </div>

                <div className="flex flex-col md:flex-row gap-6 items-end md:items-center justify-between mb-6">
                    <div>
                        <h1 className="text-3xl font-extrabold text-gray-900 capitalize mb-2">
                            {collectionInfo?.title || handle}
                        </h1>
                        {collectionInfo?.description && (
                            <p className="text-gray-600 max-w-2xl">{collectionInfo.description}</p>
                        )}
                    </div>
                    <span className="text-gray-500 text-sm font-medium whitespace-nowrap">
                        {sortedProducts.length} items
                    </span>
                </div>
            </div>

            <div className="border-t border-b border-gray-200 bg-white sticky top-16 z-30">
                <div className="site-shell py-3 flex justify-between items-center gap-4">
                    <div className="flex items-center gap-2 md:gap-4 overflow-x-auto no-scrollbar whitespace-nowrap flex-1">
                        <div className="relative group">
                            <button className={`flex items-center gap-1 text-sm font-bold px-4 py-2 rounded-full transition-colors whitespace-nowrap ${skintoneFilter ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-100'
                                }`}>
                                {skintoneFilter ? `Skin: ${skintoneFilter}` : 'Skin Tone'} <ChevronDown className="w-4 h-4" />
                            </button>
                            <div className="absolute top-full left-0 mt-1 w-40 bg-white border border-gray-100 shadow-lg py-2 hidden group-hover:block z-40 rounded-lg">
                                <button onClick={() => updateFilter('skintone', 'all')} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50">All</button>
                                <button onClick={() => updateFilter('skintone', 'fair')} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50">Fair</button>
                                <button onClick={() => updateFilter('skintone', 'neutral')} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50">Neutral</button>
                                <button onClick={() => updateFilter('skintone', 'dark')} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50">Dark</button>
                            </div>
                        </div>

                        {skintoneFilter && (
                            <button
                                onClick={() => setSearchParams(new URLSearchParams())}
                                className="text-xs text-red-600 font-bold hover:underline"
                            >
                                Reset
                            </button>
                        )}
                    </div>

                    <div className="flex-shrink-0 flex items-center gap-2 border border-gray-200 px-3 py-2 rounded-sm cursor-pointer hover:border-gray-400 relative group">
                        <span className="text-sm text-gray-500 hidden sm:inline">Sort by:</span>
                        <span className="text-sm font-bold text-gray-800 capitalize">{sortBy.replace('_', ' ')}</span>
                        <ChevronDown className="w-4 h-4 text-gray-500" />

                        <div className="absolute top-full right-0 mt-1 w-48 bg-white border border-gray-100 shadow-lg py-2 hidden group-hover:block z-40">
                            <button onClick={() => setSortBy('recommended')} className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${sortBy === 'recommended' ? 'font-bold bg-gray-50' : ''}`}>Recommended</button>
                            <button onClick={() => setSortBy('new')} className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${sortBy === 'new' ? 'font-bold bg-gray-50' : ''}`}>What's New</button>
                            <button onClick={() => setSortBy('price_low')} className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${sortBy === 'price_low' ? 'font-bold bg-gray-50' : ''}`}>Price: Low to High</button>
                            <button onClick={() => setSortBy('price_high')} className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${sortBy === 'price_high' ? 'font-bold bg-gray-50' : ''}`}>Price: High to Low</button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="site-shell py-8">
                {loading ? (
                    <div className="flex justify-center py-20 text-gray-500">Loading collection...</div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-10">
                        {sortedProducts.length > 0 ? (
                            sortedProducts.map((product, index) => (
                                <ProductCard key={product.handle || product.id || index} item={product} />
                            ))
                        ) : (
                            <div className="col-span-full text-center py-20 text-gray-500">
                                <p className="text-lg font-medium text-gray-900 mb-2">No products found</p>
                                <p>Try clearing filters or check back later.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CollectionPage;