import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ShoppingBag, User, Heart, Menu, X } from 'lucide-react';
import { useCart } from '../contexts/cart-context';
import { useAuth } from '../contexts/auth-context';
import { useWishlist } from '../contexts/wishlist-context';

const Navbar = ({ onSearchClick, onCartClick }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { totalItems } = useCart();
  const { isAuthenticated } = useAuth();
  const { count: wishlistCount } = useWishlist();
  const navigate = useNavigate();

  const navLinks = [
    { label: 'HOME', href: '/' },
    { label: 'SHOP', href: '/products' },
    { label: 'BLOG', href: '/blog' },
    { label: 'PRIVACY POLICY', href: '/legal/privacy-policy' },
    { label: 'CONTACT US', href: '/contact' },
    { label: 'ABOUT US', href: '/about' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-100 font-sans">
      <div className="site-shell h-24 flex items-center gap-4">

        {/* Left: Logo & Mobile Toggle */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <button
            className="lg:hidden p-2 -ml-2 text-gray-700"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>

          <Link to="/" className="flex-shrink-0 block">
            <img
              src="/aradhya-logo.png"
              alt="Aradhya"
              className="h-16 w-auto object-contain"
            />
          </Link>
        </div>

        {/* Center: Desktop Nav */}
        <nav className="hidden lg:flex flex-1 items-center justify-center gap-4 xl:gap-6 min-w-0">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              to={link.href}
              className="text-sm font-bold text-[#282c3f] tracking-wide hover:text-[#ff3f6c] hover:border-b-4 hover:border-[#ff3f6c] py-9 transition-all relative whitespace-nowrap"
            >
              {link.label}
              {link.isNew && (
                <span className="absolute -top-0 -right-2 text-[10px] text-[#ff3f6c] font-bold uppercase">New</span>
              )}
            </Link>
          ))}
        </nav>

        {/* Right: Search & Actions */}
        <div className="flex items-center gap-4 flex-shrink-0">
          {/* Search Bar */}
          <div className="hidden md:flex items-center relative bg-[#f5f5f6] rounded-md w-44 lg:w-48 xl:w-52 2xl:w-56 group focus-within:ring-1 focus-within:ring-gray-200 transition-shadow">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-500" />
            </div>
            <input
              type="text"
              placeholder="Search for items..."
              className="block w-full pl-10 pr-3 py-2.5 bg-transparent text-sm text-gray-700 placeholder-gray-500 focus:outline-none rounded-md"
              onClick={onSearchClick}
            />
          </div>

          {/* Icons */}
          <div className="flex items-center gap-4">
            {/* Mobile Search Icon */}
            <button
              className="md:hidden flex flex-col items-center gap-1 cursor-pointer group"
              onClick={onSearchClick}
              aria-label="Search"
            >
              <Search className="w-5 h-5 text-gray-700 group-hover:text-black" />
            </button>

            <div
              className="flex flex-col items-center gap-1 cursor-pointer group"
              onClick={() => navigate(isAuthenticated ? '/profile' : '/login')}
            >
              <User className="w-5 h-5 text-gray-700 group-hover:text-black" />
              <span className="text-xs font-bold text-gray-700 group-hover:text-black hidden xl:block">Profile</span>
            </div>
            <Link
              to="/wishlist"
              className="flex flex-col items-center gap-1 cursor-pointer group relative"
            >
              <Heart
                className="w-5 h-5 group-hover:text-black"
                fill={wishlistCount > 0 ? 'currentColor' : 'none'}
                color={wishlistCount > 0 ? '#ff3f6c' : '#374151'}
              />
              {wishlistCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#ff3f6c] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {wishlistCount}
                </span>
              )}
              <span className="text-xs font-bold text-gray-700 group-hover:text-black hidden xl:block">Wishlist</span>
            </Link>
            <div
              className="flex flex-col items-center gap-1 cursor-pointer group relative"
              onClick={onCartClick}
            >
              <ShoppingBag className="w-5 h-5 text-gray-700 group-hover:text-black" />
              {totalItems > 0 && (
                <span className="absolute -top-1 right-0 bg-[#ff3f6c] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {totalItems}
                </span>
              )}
              <span className="text-xs font-bold text-gray-700 group-hover:text-black hidden xl:block">Bag</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden absolute top-24 left-0 w-full bg-white border-b border-gray-200 shadow-lg py-4 px-4 flex flex-col gap-4 z-40">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              to={link.href}
              className="text-sm font-bold text-gray-800 py-2 border-b border-gray-100"
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
};

export default Navbar;
