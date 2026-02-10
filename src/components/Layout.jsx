// src/components/Layout.jsx
import React, { useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import CatalogProvider from '../contexts/catalog-context';
import CartProvider from '../contexts/cart-context';
import WishlistProvider from '../contexts/wishlist-context';
import NotificationProvider from './NotificationProvider';
import SearchOverlay from './SearchOverlay';
import CartDrawer from './CartDrawer';
import BottomNav from './BottomNav';

const marqueeItems = [
  'THE HOUSE OF ARADHYA',
  'NEW ARRIVALS WEEKLY',
  'EXPRESS SHIPPING',
  'PREMIUM QUALITY',
  'PAN INDIA DELIVERY',
];

const TopAnnouncement = () => (
  <div
    className="relative h-6 w-full overflow-hidden bg-neutral-900 text-white"
    role="marquee"
    aria-label="Site announcements vertical marquee"
  >
    <div className="marquee-vertical group h-full text-[10px] uppercase tracking-[0.35em]">
      <div className="marquee-vertical__group">
        {marqueeItems.map((item, idx) => (
          <span className="marquee-vertical__item" key={item || idx}>
            {item}
          </span>
        ))}
      </div>

      <div aria-hidden className="marquee-vertical__group">
        {marqueeItems.map((item, idx) => (
          <span className="marquee-vertical__item" key={`${item || idx}-duplicate`}>
            {item}
          </span>
        ))}
      </div>
    </div>
  </div>
);

const Layout = () => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  React.useEffect(() => {
    const handleOpenSearch = () => setSearchOpen(true);
    document.addEventListener('open-search', handleOpenSearch);
    return () => document.removeEventListener('open-search', handleOpenSearch);
  }, []);

  const outletContext = useMemo(
    () => ({
      openCartDrawer: () => setCartOpen(true),
      closeCartDrawer: () => setCartOpen(false),
    }),
    [],
  );

  return (
    <CatalogProvider>
      <WishlistProvider>
        <CartProvider>
          <NotificationProvider>
            <div className="bg-white text-neutral-900 min-h-screen flex flex-col">
              <div className="sticky top-0 z-50 hidden lg:block">
                <Navbar
                  onSearchClick={() => setSearchOpen(true)}
                  onCartClick={() => setCartOpen(true)}
                />
              </div>

              <main className="flex-grow">
                <Outlet context={outletContext} />
              </main>

              <Footer />

              <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
              <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
              <BottomNav onSearchClick={() => setSearchOpen(true)} onCartClick={() => setCartOpen(true)} />
            </div>
          </NotificationProvider>
        </CartProvider>
      </WishlistProvider>
    </CatalogProvider>
  );
};

export default Layout;
