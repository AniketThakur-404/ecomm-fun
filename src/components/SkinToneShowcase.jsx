import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from './ProductCard';
import { useCatalog } from '../contexts/catalog-context';

/* 1. Import Skin Tone Images (from SkintoneSelector.jsx) */
import fairImg from '@/assets/images/skintone-fair.png';
import neutralImg from '@/assets/images/skintone-neutral.png';
import darkImg from '@/assets/images/skintone-dark.png';

/* 2. Define Occasion Data (from OccasionSelector.jsx) */
const getOccasionImage = (file) => `${import.meta.env?.BASE_URL ?? '/'}images/${file}`;

const OCCASIONS = [
    {
        id: 'date',
        title: 'Date Wear',
        tag: 'Date Wear',
        image: getOccasionImage('occasion-date.jpg'),
    },
    {
        id: 'party', // Changed 'puja' to 'party' based on usual request, but checking OccasionSelector it was 'puja'. Let's stick to OccasionSelector's data: Date, Puja, Office.
        // Wait, OccasionSelector had: Date, Puja, Office.
        // Let's match OccasionSelector exactly to ensure images exist.
        id: 'puja',
        title: 'Puja Wear',
        tag: 'Puja Wear',
        image: getOccasionImage('occasion-puja.jpg'),
    },
    {
        id: 'office',
        title: 'Office Wear',
        tag: 'Office Wear',
        image: getOccasionImage('occasion-office.jpg'),
    },
];

/* 3. Define Skin Tone Groups (matching AllProductsPage logic) */
const SKINTONES = [
    {
        id: 'fair',
        label: 'Fair Skin',
        image: fairImg,
        tokens: ['fair skin', 'fair'],
    },
    {
        id: 'neutral',
        label: 'Neutral Skin',
        image: neutralImg,
        tokens: ['neutral skin', 'neutral', 'natural skin', 'natural'],
    },
    {
        id: 'dark',
        label: 'Dark Skin',
        image: darkImg,
        tokens: ['dark skin', 'dark'],
    },
];

/* Helper: Filter Logic (Reused from AllProductsPage roughly) */
const tokenize = (str) => str?.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean) || [];

const productMatches = (product, filterTokens) => {
    if (!product || !filterTokens?.length) return false;
    const productTags = (product.tags || []).map(t => t.toLowerCase());
    const productType = product.productType?.toLowerCase() || '';

    // Check if ANY filter token is present in tags or productType
    return filterTokens.some(token =>
        productTags.includes(token) ||
        productTags.some(t => t.includes(token)) ||
        productType.includes(token)
    );
};

export default function SkinToneShowcase() {
    const { products } = useCatalog();

    // Memoize the nested structure: Skin -> Occasion -> Matched Product
    const showcaseData = useMemo(() => {
        if (!products?.length) return SKINTONES.map(s => ({ ...s, occasions: OCCASIONS.map(o => ({ ...o, product: null })) }));

        return SKINTONES.map((skin) => {
            const skinOccasions = OCCASIONS.map((occasion) => {
                // Find a product that matches BOTH Skin Tone AND Occasion
                const matchedProduct = products.find((p) =>
                    productMatches(p, skin.tokens) &&
                    productMatches(p, [occasion.tag.toLowerCase(), occasion.id])
                );
                return {
                    ...occasion,
                    product: matchedProduct || null,
                };
            });

            return {
                ...skin,
                occasions: skinOccasions,
            };
        });
    }, [products]);

    return (
        <section className="site-shell py-10 space-y-16">
            <div className="text-center space-y-2">
                <h2 className="text-3xl md:text-4xl font-bold text-slate-900 uppercase tracking-widest">
                    Shop By Skin Tone
                </h2>
                <p className="text-slate-500 max-w-2xl mx-auto">
                    Discover the perfect shades and styles curated specifically for your skin tone and occasion.
                </p>
            </div>

            {showcaseData.map((skin) => (
                <div key={skin.id} className="space-y-8 border-b border-gray-100 pb-12 last:border-0 last:pb-0">
                    {/* Skin Tone Banner / Header */}
                    <div className="relative group overflow-hidden rounded-2xl">
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors z-10" />
                        <img
                            src={skin.image}
                            alt={skin.label}
                            className="w-full h-48 md:h-64 object-cover object-center transition-transform duration-700 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 z-20 flex items-center justify-center">
                            <Link
                                to={`/products?skintone=${skin.id}`}
                                className="bg-white/90 backdrop-blur-sm px-8 py-3 rounded-full text-lg font-bold hover:bg-white transition-colors shadow-lg"
                            >
                                {skin.label} Collection
                            </Link>
                        </div>
                    </div>

                    {/* Occasion Grid for this Skin Tone */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {skin.occasions.map((occasion) => (
                            <div key={occasion.id} className="space-y-4">
                                {/* Occasion Header */}
                                <div className="flex items-center gap-3">
                                    <div className="h-px bg-gray-200 flex-1" />
                                    <h3 className="font-semibold text-gray-900 uppercase tracking-wider text-sm">
                                        {occasion.title}
                                    </h3>
                                    <div className="h-px bg-gray-200 flex-1" />
                                </div>

                                {/* 1. Occasion Banner Link */}
                                <Link
                                    to={`/products?skintone=${skin.id}&occasion=${encodeURIComponent(occasion.tag)}`}
                                    className="block group relative overflow-hidden rounded-xl aspect-[16/9] shadow-sm hover:shadow-md transition-shadow"
                                >
                                    <img
                                        src={occasion.image}
                                        alt={`${skin.label} - ${occasion.title}`}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="text-white font-medium text-sm">Browse {occasion.title} &rarr;</span>
                                    </div>
                                </Link>

                                {/* 2. Featured Product for this Combo */}
                                {occasion.product ? (
                                    <div className="transform transition-transform hover:-translate-y-1">
                                        <ProductCard item={occasion.product} />
                                    </div>
                                ) : (
                                    <div className="border border-dashed border-gray-200 rounded-xl p-6 text-center text-gray-400 text-sm h-[300px] flex items-center justify-center">
                                        No product in this category yet
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </section>
    );
}
