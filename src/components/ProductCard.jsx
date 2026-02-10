import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useWishlist } from '../contexts/wishlist-context';
import { useNotifications } from './NotificationProvider';

const ProductCard = ({ item }) => {
  const {
    handle,
    title,
    featuredImage,
    price,
    compareAtPrice,
    vendor,
    img, // From toProductCard
    badge, // From toProductCard
  } = item || {};

  const { toggleItem, isWishlisted } = useWishlist();
  const { notify } = useNotifications();

  const inWishlist = useMemo(() => isWishlisted(handle), [isWishlisted, handle]);

  const handleWishlistClick = (e) => {
    e.preventDefault();
    if (!handle) return;
    const nextStateIsAdded = !inWishlist;
    toggleItem(handle, item);
    notify({
      title: 'Wishlist',
      message: nextStateIsAdded ? 'Saved to your wishlist.' : 'Removed from wishlist.',
    });
  };

  // Handle image source: prioritize 'img' (flat string) then 'featuredImage.url' (nested object)
  const imageUrl = img || featuredImage?.url;
  const imageAlt = featuredImage?.altText || title || 'Product image';

  // Handle price display: 'price' can be a string (formatted) or object (amount/currency)
  const displayPrice =
    typeof price === 'string'
      ? price
      : price?.amount != null
        ? `ƒ,1${price.amount}`
        : '';

  // Handle compare price
  const displayComparePrice =
    typeof compareAtPrice === 'string'
      ? compareAtPrice
      : compareAtPrice?.amount
        ? `ƒ,1${compareAtPrice.amount}`
        : null;

  // Calculate discount if numeric values are available
  let discount = 0;
  if (compareAtPrice?.amount && price?.amount) {
    discount = Math.round(((compareAtPrice.amount - price.amount) / compareAtPrice.amount) * 100);
  }

  return (
    <div className="group relative bg-white hover:shadow-lg transition-shadow duration-300 cursor-pointer">
      {handle ? (
        <Link to={`/product/${handle}`} className="block relative overflow-hidden">
          {/* Image */}
          <div className="aspect-[3/4] w-full bg-gray-100">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={imageAlt}
                className="h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-gray-300 bg-gray-50">
                No Image
              </div>
            )}
          </div>

          {/* Wishlist Button (Visible on Hover) */}
          <button
            className="absolute bottom-4 right-4 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-pink-50"
            onClick={handleWishlistClick}
            aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
          >
            <Heart
              className="w-4 h-4"
              fill={inWishlist ? 'currentColor' : 'none'}
              color={inWishlist ? '#ff3f6c' : '#374151'}
            />
          </button>

          {/* Rating Badge (Static for now) */}
          <div className="absolute bottom-2 left-2 bg-white/90 px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm opacity-80">
            <span className="text-[10px] font-bold">4.2</span>
            <span className="text-[10px] text-teal-500">ƒ~.</span>
            <span className="text-[10px] text-gray-400 border-l border-gray-300 pl-1 ml-1">1.2k</span>
          </div>

          {/* New Badge */}
          {badge && (
            <div className="absolute top-2 left-2 bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 uppercase tracking-wide">
              {badge}
            </div>
          )}
        </Link>
      ) : (
        <div className="block relative overflow-hidden">
          <div className="aspect-[3/4] w-full bg-gray-100 flex items-center justify-center text-gray-400">
            Product Unavailable
          </div>
        </div>
      )}

      {/* Details */}
      <div className="p-3">
        <h3 className="text-sm font-bold text-[#282c3f] truncate mb-0.5">{vendor || 'Brand'}</h3>
        <p className="text-xs text-[#535766] truncate mb-2 font-normal">{title || 'Product'}</p>

        <div className="flex items-center gap-2 text-sm">
          <span className="font-bold text-[#282c3f]">{displayPrice}</span>
          {displayComparePrice && (
            <>
              <span className="text-xs text-[#7e818c] line-through decoration-gray-400">
                {displayComparePrice}
              </span>
              <span className="text-xs text-[#ff905a] font-normal">
                ({discount > 0 ? `${discount}% OFF` : ''})
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
