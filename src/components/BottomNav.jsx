import React from 'react';
import { Heart, Home, Search, ShoppingBag, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useCart } from '../contexts/cart-context';
import { useWishlist } from '../contexts/wishlist-context';

import { useAuth } from '../contexts/auth-context';

export default function BottomNav({ onSearchClick, onCartClick }) {
    const location = useLocation();
    const { totalItems } = useCart();
    const { count: wishlistCount } = useWishlist();
    const { isAuthenticated } = useAuth();

    const isActive = (path) => location.pathname === path;

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 py-3 px-4 flex items-center justify-between z-50 md:hidden pb-safe">
            <Link to="/" className="flex flex-col items-center justify-center gap-1">
                <Home className={`w-6 h-6 ${isActive('/') ? 'text-black stroke-[2.5px]' : 'text-gray-500 stroke-[1.5px]'}`} fill={isActive('/') ? 'currentColor' : 'none'} />
            </Link>

            <button onClick={onSearchClick} className="flex flex-col items-center justify-center gap-1">
                <Search className="w-6 h-6 text-gray-500 stroke-[1.5px]" />
            </button>

            <Link to="/products" className="flex flex-col items-center justify-center gap-1">
                <span className={`text-xs font-bold tracking-widest ${isActive('/products') ? 'text-black' : 'text-gray-500'}`}>SHOP</span>
            </Link>

            <Link to="/wishlist" className="flex flex-col items-center justify-center gap-1 relative">
                <Heart
                    className={`w-6 h-6 ${isActive('/wishlist') ? 'text-black stroke-[2.5px]' : 'text-gray-500 stroke-[1.5px]'}`}
                    fill={wishlistCount > 0 ? 'currentColor' : 'none'}
                />
                {wishlistCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                        {wishlistCount}
                    </span>
                )}
            </Link>

            <button onClick={onCartClick} className="flex flex-col items-center justify-center gap-1 relative">
                <ShoppingBag className="w-6 h-6 text-gray-500 stroke-[1.5px]" />
                {totalItems > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                        {totalItems}
                    </span>
                )}
            </button>

            <Link to={isAuthenticated ? "/profile" : "/login"} className="flex flex-col items-center justify-center gap-1">
                <User className={`w-6 h-6 ${isActive('/profile') || isActive('/login') ? 'text-black stroke-[2.5px]' : 'text-gray-500 stroke-[1.5px]'}`} fill={isActive('/profile') ? 'currentColor' : 'none'} />
            </Link>
        </div>
    );
}
