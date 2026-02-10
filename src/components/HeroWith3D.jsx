// src/components/HeroWith3D.jsx
import React, { useEffect, useRef, useState } from 'react';
import defaultHeroVideo from '../assets/Coin_in_Nature_Climate_Video.mp4';
import AntigravityLogo from './AntigravityLogo';

const SPLINE_SCENE_URL = 'https://my.spline.design/aethirathgold-Yt10PlgylthzK19E5WCrB74M/';

export default function HeroWith3D({ heroVideoSrc, ctaLabel = 'Select Skintone', onCtaClick }) {
  const videoSource = heroVideoSrc || defaultHeroVideo;
  const sectionRef = useRef(null);
  const [parallaxOffset, setParallaxOffset] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const section = sectionRef.current;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const offset = Math.min(Math.max(-rect.top, 0), window.innerHeight * 1.5);
      setParallaxOffset(offset * 0.18);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative flex w-full flex-col overflow-hidden bg-neutral-900 min-h-[580px] md:h-[88vh] md:min-h-[700px]"
    >
      <video
        className="absolute inset-0 z-10 h-full w-full object-cover"
        src={videoSource}
        autoPlay
        muted
        loop
        playsInline
        style={{ transform: `translateY(${parallaxOffset}px)` }}
      />

      <div className="relative flex-1">
        {/* ANTIGRAVITY 3D LOGO - REMOVED */}
        {/* <div
          className="absolute inset-0 z-20 h-full w-full"
          style={{ transform: `translateY(${parallaxOffset}px)` }}
        >
          <AntigravityLogo stlPath="/evrydae_hollow.stl" />
        </div> */}

        {/* SPLINE 3D MODEL - COMMENTED OUT */}
        {/* <iframe
          title="EVRYDAE 3D Experience"
          src={SPLINE_SCENE_URL}
          frameBorder="0"
          width="100%"
          height="100%"
          allow="autoplay; fullscreen"
          className="absolute inset-0 z-20 h-full w-full"
          style={{ transform: `translateY(${parallaxOffset}px)` }}
        /> */}
      </div>

      <div className="pointer-events-none absolute inset-0 z-30 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-10 border-white/95  backdrop-blur md:h-14"
      />

      <div className="pointer-events-none absolute inset-0 z-40 flex items-end justify-center px-4 pb-8 sm:pb-12 md:pb-16">
        <button
          type="button"
          onClick={onCtaClick}
          className="pointer-events-auto mb-6 rounded-full border border-white/95 px-6 py-3 text-[10px] uppercase tracking-[0.35em] text-white/90 transition hover:bg-white hover:text-neutral-900  sm:px-8 sm:text-[11px]"
        >
          {ctaLabel}
        </button>
      </div>
    </section>
  );
}
