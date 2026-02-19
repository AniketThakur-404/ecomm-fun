import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useWishlist } from '../contexts/wishlist-context';
import { useNotifications } from './NotificationProvider';

const formatAmount = (amount, currency = 'INR') => {
  const value = Number(amount);
  if (!Number.isFinite(value)) return '';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
};

const ProductCard = ({ item }) => {
  const {
    handle,
    title,
    featuredImage,
    price,
    compareAtPrice,
    vendor,
    img,
    badge,
  } = item || {};

  const { toggleItem, isWishlisted } = useWishlist();
  const { notify } = useNotifications();

  const inWishlist = useMemo(() => isWishlisted(handle), [isWishlisted, handle]);

  const handleWishlistClick = (event) => {
    event.preventDefault();
    if (!handle) return;
    const nextStateIsAdded = !inWishlist;
    toggleItem(handle, item);
    notify({
      title: 'Wishlist',
      message: nextStateIsAdded ? 'Saved to your wishlist.' : 'Removed from wishlist.',
    });
  };

  const imageUrl = img || featuredImage?.url;
  const imageAlt = featuredImage?.altText || title || 'Product image';
  const currencyCode =
    price?.currencyCode ||
    price?.currency ||
    compareAtPrice?.currencyCode ||
    compareAtPrice?.currency ||
    'INR';

  const displayPrice =
    typeof price === 'string'
      ? price
      : price?.amount != null
        ? formatAmount(price.amount, currencyCode)
        : '';

  const displayComparePrice =
    typeof compareAtPrice === 'string'
      ? compareAtPrice
      : compareAtPrice?.amount != null
        ? formatAmount(compareAtPrice.amount, currencyCode)
        : null;

  let discount = 0;
  if (compareAtPrice?.amount && price?.amount) {
    discount = Math.round(((compareAtPrice.amount - price.amount) / compareAtPrice.amount) * 100);
  }

  return (
    <div className="group relative cursor-pointer bg-white transition-shadow duration-300 hover:shadow-lg">
      {handle ? (
        <Link to={`/product/${handle}`} className="relative block overflow-hidden">
          <div className="aspect-[3/4] w-full bg-gray-100">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={imageAlt}
                className="h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gray-50 text-gray-300">
                No Image
              </div>
            )}
          </div>

          <button
            className="absolute bottom-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md opacity-0 transition-opacity duration-200 hover:bg-pink-50 group-hover:opacity-100"
            onClick={handleWishlistClick}
            aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
          >
            <Heart
              className="h-4 w-4"
              fill={inWishlist ? 'currentColor' : 'none'}
              color={inWishlist ? '#ff3f6c' : '#374151'}
            />
          </button>

          <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded bg-white/90 px-1.5 py-0.5 shadow-sm opacity-80">
            <span className="text-[10px] font-bold">4.2</span>
            <span className="text-[10px] text-teal-500">*</span>
            <span className="ml-1 border-l border-gray-300 pl-1 text-[10px] text-gray-400">1.2k</span>
          </div>

          {badge && (
            <div className="absolute left-2 top-2 bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              {badge}
            </div>
          )}
        </Link>
      ) : (
        <div className="relative block overflow-hidden">
          <div className="flex aspect-[3/4] w-full items-center justify-center bg-gray-100 text-gray-400">
            Product Unavailable
          </div>
        </div>
      )}

      <div className="p-3">
        <h3 className="mb-0.5 truncate text-sm font-bold text-[#282c3f]">{vendor || 'Brand'}</h3>
        <p className="mb-2 truncate text-xs font-normal text-[#535766]">{title || 'Product'}</p>

        <div className="flex items-center gap-2 text-sm">
          <span className="font-bold text-[#282c3f]">{displayPrice}</span>
          {displayComparePrice && (
            <>
              <span className="text-xs text-[#7e818c] line-through decoration-gray-400">
                {displayComparePrice}
              </span>
              <span className="text-xs font-normal text-[#ff905a]">
                {discount > 0 ? `(${discount}% OFF)` : ''}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
