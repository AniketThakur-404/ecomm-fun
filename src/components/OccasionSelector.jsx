import React from 'react';
import { Link } from 'react-router-dom';

const image = (file) => `${import.meta.env?.BASE_URL ?? '/'}images/${file}`;

const occasions = [
    {
        id: 'date',
        title: 'Date Wear',
        tag: 'Date Wear',
        image: image('occasion-date.jpg'),
    },
    {
        id: 'puja',
        title: 'Puja Wear',
        tag: 'Puja Wear',
        image: image('occasion-puja.jpg'),
    },
    {
        id: 'office',
        title: 'Office Wear',
        tag: 'Office Wear',
        image: image('occasion-office.jpg'),
    }
];

export default function OccasionSelector({ selectedSkintone }) {
    // If no skintone is selected, we can either hide this component (handled by parent) 
    // or show default links. The user wants it to show ONLY when skintone is chosen.

    return (
        <section className="site-shell py-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h2 className="text-2xl md:text-3xl font-bold text-[#001f3f] mb-8">
                Select your occasion
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                {occasions.map((occasion) => (
                    <Link
                        key={occasion.id}
                        to={`/products?category=${selectedSkintone || 'all'}&occasion=${encodeURIComponent(occasion.tag)}`}
                        className="group block overflow-hidden rounded-2xl border border-white/40 shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                        aria-label={occasion.title}
                    >
                        <img
                            src={occasion.image}
                            alt={occasion.title}
                            className="block w-full h-auto transition-transform duration-700 group-hover:scale-[1.02]"
                            loading="lazy"
                        />
                    </Link>
                ))}
            </div>
        </section>
    );
}
