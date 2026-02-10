import React from 'react';
import fairImg from '@/assets/images/skintone-fair.png';
import neutralImg from '@/assets/images/skintone-neutral.png';
import darkImg from '@/assets/images/skintone-dark.png';

const skintones = [
  {
    id: 'fair-skin',
    label: 'FAIR SKINTONE',
    image: fairImg,
  },
  {
    id: 'neutral-skin',
    label: 'NEUTRAL SKINTONE',
    image: neutralImg,
  },
  {
    id: 'dark-skin',
    label: 'DARK SKINTONE',
    image: darkImg,
  },
];

export default function SkintoneSelector({ onSelect }) {
  return (
    <section className="py-10 bg-white">
      <div className="max-w-7xl mx-auto px-4 space-y-6">
        <h2 className="text-center text-2xl md:text-4xl font-semibold tracking-[0.15em] uppercase text-slate-900">
          Select Your Skintone & Get Perfect Combination
        </h2>

        <div className="grid gap-4 md:grid-cols-3">
          {skintones.map((tone) => (
            <button
              key={tone.id}
              type="button"
              onClick={() => onSelect?.(tone.id)}
              className="block w-full"
            >
              <img
                src={tone.image}
                alt={tone.label}
                className="block w-full h-auto"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
