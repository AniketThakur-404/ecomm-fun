import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  Share2,
  ShoppingBag,
  Truck,
  Home,
  Search,
  User,
  Menu,
} from 'lucide-react';
import PincodeChecker from '../components/PincodeChecker';
import MobilePageHeader from '../components/MobilePageHeader';
import FrequentlyBoughtTogether from '../components/FrequentlyBoughtTogether';
import ProductGrid from '../components/ProductGrid';
import SizeSelectionModal from '../components/SizeSelectionModal';
import { useCatalog } from '../contexts/catalog-context';
import { useCart } from '../contexts/cart-context';
import { useWishlist } from '../contexts/wishlist-context';
import { useNotifications } from '../components/NotificationProvider';
import { useAuth } from '../contexts/auth-context';
import {
  extractOptionValues,
  extractSizeOptions,
  fetchProductByHandle,
  fetchProductsFromCollection,
  fetchAllProducts,
  findVariantForSize,
  formatMoney,
  getProductImageUrl,
  isSizeOptionName,
  toProductCard,
  normaliseTokenValue,
  searchProducts,
} from '../lib/api';

const AccordionItem = ({ title, isOpen, onClick, children }) => (
  <div className="border-b border-gray-200">
    <button
      onClick={onClick}
      className="w-full flex justify-between items-center py-4 text-left"
    >
      <span className="text-sm font-bold text-gray-900 uppercase tracking-wider">
        {title}
      </span>
      <span className="text-gray-500 text-sm">{isOpen ? '-' : '+'}</span>
    </button>
    {isOpen && <div className="pb-4 text-sm text-gray-700">{children}</div>}
  </div>
);

const parseReviewPayload = (raw) => {
  if (!raw) return { items: [], summary: null };
  try {
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.reviews)
        ? parsed.reviews
        : Array.isArray(parsed?.items)
          ? parsed.items
          : [];
    const average =
      parsed?.averageRating ??
      parsed?.avgRating ??
      parsed?.ratingAverage ??
      parsed?.rating ??
      parsed?.average ??
      null;
    const count =
      parsed?.reviewCount ??
      parsed?.count ??
      parsed?.totalReviews ??
      parsed?.total ??
      (items.length ? items.length : null);
    return {
      items,
      summary: average != null || count != null ? { average, count } : null,
    };
  } catch {
    return { items: [], summary: null };
  }
};

const pickReviewField = (review, keys) => {
  if (!review || typeof review !== 'object') return '';
  for (const key of keys) {
    const value = review[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return '';
};

const formatReviewDate = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const ProductDetails = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const outletContext = useOutletContext() || {};
  const openCartDrawer = outletContext?.openCartDrawer ?? (() => { });

  const { getProduct } = useCatalog();
  const { addItem } = useCart();
  const { isWishlisted, toggleItem } = useWishlist();
  const { notify } = useNotifications();
  const { isAuthenticated } = useAuth();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [images, setImages] = useState([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedColor, setSelectedColor] = useState(null);
  const [openAccordion, setOpenAccordion] = useState('details');
  const [pincode, setPincode] = useState('');
  const [selectedComboItems, setSelectedComboItems] = useState(new Set());
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [recommendedProducts, setRecommendedProducts] = useState([]);
  const [selectedFbtItems, setSelectedFbtItems] = useState(new Set());
  const [showSizeModal, setShowSizeModal] = useState(false);
  const productHandle = product?.handle || '';
  const reviewData = useMemo(
    () => parseReviewPayload(product?.reviewsJson),
    [product?.reviewsJson],
  );
  const reviewItems = reviewData.items ?? [];
  const reviewSummary = reviewData.summary;
  const reviewSummaryText = useMemo(() => {
    if (!reviewSummary) return '';
    const averageValue = reviewSummary.average;
    const countValue = reviewSummary.count;
    const averageNumber = Number(averageValue);
    const averageLabel = Number.isFinite(averageNumber)
      ? averageNumber.toFixed(1)
      : averageValue != null
        ? String(averageValue)
        : '';
    const countLabel = countValue != null ? String(countValue) : '';
    if (averageLabel && countLabel) {
      return `Average rating: ${averageLabel}/5 (${countLabel} reviews)`;
    }
    if (averageLabel) return `Average rating: ${averageLabel}/5`;
    if (countLabel) return `${countLabel} reviews`;
    return '';
  }, [reviewSummary]);

  const inWishlist = useMemo(
    () => (productHandle ? isWishlisted(productHandle) : false),
    [isWishlisted, productHandle],
  );

  const handleToggleWishlist = () => {
    if (!productHandle) return;
    const nextStateIsAdded = !inWishlist;
    toggleItem(productHandle, toProductCard(product));
    notify({
      title: 'Wishlist',
      message: nextStateIsAdded ? 'Saved to your wishlist.' : 'Removed from wishlist.',
    });
  };

  const handleShare = async () => {
    if (!productHandle) return;
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/product/${productHandle}`
        : `/product/${productHandle}`;
    const shareData = {
      title: product?.title || 'Check this out',
      text: product?.vendor ? `${product.vendor} - ${product.title}` : product?.title,
      url,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        notify({ title: 'Share', message: 'Shared successfully.' });
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }

      notify({ title: 'Link copied', message: 'Product link copied to clipboard.' });
    } catch (err) {
      console.error('Share failed', err);
      notify({
        title: 'Share failed',
        message: 'Unable to share right now. Try copying the link manually.',
      });
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (!slug) return;

    async function loadProduct() {
      setLoading(true);
      setError(null);

      const local = getProduct(slug);
      if (local && !cancelled) {
        setProduct(local);
        setLoading(false);
      }

      try {
        const fetched = await fetchProductByHandle(slug);
        if (!cancelled) {
          if (fetched) {
            setProduct(fetched);
            setLoading(false);
          } else {
            if (!local) setError('Product not found');
          }
        }
      } catch (err) {
        console.error(`Failed to load product "${slug}"`, err);
        if (!cancelled && !local) setError('Product unavailable right now.');
      } finally {
        if (!cancelled && !local) setLoading(false);
      }
    }

    loadProduct();
    return () => {
      cancelled = true;
    };
  }, [slug, getProduct]);

  useEffect(() => {
    if (!product) return;
    const media = [];
    const hero = getProductImageUrl(product);
    if (hero) media.push({ url: hero, alt: product.title });
    (product.images || []).forEach((img) => {
      if (img?.url && !media.find((m) => m.url === img.url)) {
        media.push(img);
      }
    });
    setImages(media);
    setActiveImageIndex(0);
  }, [product]);

  const sizeOptions = useMemo(() => extractSizeOptions(product), [product]);
  const colorOptions = useMemo(() => {
    const primary = extractOptionValues(product, 'Color');
    const alt = extractOptionValues(product, 'Colour');
    const metaColors = Array.isArray(product?.metafields)
      ? product.metafields
        .filter((m) => {
          const key = normaliseTokenValue(m?.key);
          const ns = normaliseTokenValue(m?.namespace);
          return (
            (key === 'color' || key === 'colour') &&
            ['custom', 'details', 'info', 'global', 'theme'].includes(ns)
          );
        })
        .map((m) => m?.value)
        .filter(Boolean)
      : [];
    const merged = [...primary, ...alt, ...metaColors].filter(Boolean);
    return Array.from(new Set(merged));
  }, [product]);
  const hasSizes = sizeOptions.length > 0;
  const hasColors = colorOptions.length > 0;
  const comboItems = useMemo(() => product?.comboItems ?? [], [product]);
  const hasComboItems = comboItems.length > 0;
  const selectedComboList = useMemo(
    () => comboItems.filter((item) => selectedComboItems.has(item.handle)),
    [comboItems, selectedComboItems],
  );
  const comboSelectionLabel = hasComboItems
    ? `${selectedComboList.length}/${comboItems.length} selected`
    : '';

  const selectedVariant = useMemo(() => {
    if (!product) return null;
    const variants = product.variants || [];
    const targetSize = normaliseTokenValue(selectedSize);
    const targetColor = normaliseTokenValue(selectedColor);

    const matchOption = (variant, matcher) =>
      variant?.selectedOptions?.some((opt) => matcher(opt)) ?? false;

    const matchByBoth = variants.find((variant) => {
      const sizeMatch =
        !targetSize ||
        matchOption(
          variant,
          (opt) =>
            isSizeOptionName(opt?.name) &&
            normaliseTokenValue(opt?.value) === targetSize,
        );
      const colorMatch =
        !targetColor ||
        matchOption(
          variant,
          (opt) => {
            const name = normaliseTokenValue(opt?.name);
            return (
              (name.includes('color') || name.includes('colour')) &&
              normaliseTokenValue(opt?.value) === targetColor
            );
          },
        );
      return sizeMatch && colorMatch;
    });

    return matchByBoth || findVariantForSize(product, selectedSize);
  }, [product, selectedSize, selectedColor]);

  const getVariantForOptions = useMemo(() => {
    return (item, { size, color }) => {
      if (!item?.variants?.length) return null;
      const targetSize = normaliseTokenValue(size);
      const targetColor = normaliseTokenValue(color);
      const matches = item.variants.find((variant) => {
      const sizeMatch =
        !targetSize ||
        variant?.selectedOptions?.some(
          (opt) =>
            isSizeOptionName(opt?.name) &&
            normaliseTokenValue(opt?.value) === targetSize,
        );
        const colorMatch =
          !targetColor ||
          variant?.selectedOptions?.some((opt) => {
            const name = normaliseTokenValue(opt?.name);
            return (
              (name.includes('color') || name.includes('colour')) &&
              normaliseTokenValue(opt?.value) === targetColor
            );
          });
        return sizeMatch && colorMatch;
      });
      return matches || null;
    };
  }, []);

  const getAvailability = useMemo(() => {
    return (item, { size, color }) => {
      const variant = getVariantForOptions(item, { size, color });
      if (!variant) {
        const fallback = item?.availableForSale ?? true;
        return { inStock: fallback, lowStock: false, quantity: null };
      }
      const qty = Number.isFinite(variant.quantityAvailable)
        ? variant.quantityAvailable
        : null;
      const inStock = Boolean(variant.availableForSale) && (qty == null || qty > 0);
      const lowStock = inStock && qty != null && qty <= 5;
      return { inStock, lowStock, quantity: qty };
    };
  }, [getVariantForOptions]);

  const price = useMemo(() => {
    if (!product) return '';
    const amount =
      selectedVariant?.price ??
      product.price ??
      product.priceRange?.minVariantPrice?.amount ??
      0;
    const currency =
      selectedVariant?.currencyCode ??
      product.currencyCode ??
      product.priceRange?.minVariantPrice?.currencyCode;
    return formatMoney(amount, currency);
  }, [product, selectedVariant]);

  useEffect(() => {
    if (!product) return;

    const firstVariant = product.variants?.[0];
    const variantSize =
      firstVariant?.selectedOptions?.find((opt) =>
        isSizeOptionName(opt?.name),
      )?.value;
    const variantColor =
      firstVariant?.selectedOptions?.find((opt) => {
        const name = normaliseTokenValue(opt?.name);
        return name.includes('color') || name.includes('colour');
      })?.value;

    if (hasSizes && !selectedSize && sizeOptions.length) {
      const firstAvailable =
        sizeOptions.find((size) =>
          getAvailability(product, { size, color: selectedColor }).inStock,
        ) ?? sizeOptions[0];
      setSelectedSize(variantSize || firstAvailable);
    }
    if (hasColors && !selectedColor && colorOptions.length) {
      setSelectedColor(variantColor || colorOptions[0]);
    }
  }, [
    product,
    hasSizes,
    sizeOptions,
    selectedSize,
    hasColors,
    colorOptions,
    selectedColor,
    getAvailability,
  ]);

  const sizeAvailability = useMemo(() => {
    if (!product || !hasSizes) return {};
    return sizeOptions.reduce((acc, size) => {
      acc[size] = getAvailability(product, { size, color: selectedColor });
      return acc;
    }, {});
  }, [product, hasSizes, sizeOptions, selectedColor, getAvailability]);

  const toggleAccordion = (key) =>
    setOpenAccordion((current) => (current === key ? null : key));

  const nextImage = () =>
    setActiveImageIndex((idx) => (idx + 1) % Math.max(images.length, 1));
  const prevImage = () =>
    setActiveImageIndex((idx) =>
      images.length ? (idx - 1 + images.length) % images.length : 0,
    );

  const handleAddToCart = () => {
    if (!product?.handle) return;

    if (hasSizes) {
      const availability = sizeAvailability[selectedSize];
      if (availability && !availability.inStock) {
        notify({
          title: 'Out of stock',
          message: 'Selected size is not available. Please choose another size.',
        });
        return;
      }
    }

    if (hasComboItems) {
      if (selectedComboList.length === 0) {
        notify({
          title: 'Select items',
          message: 'Choose at least one item from this combo.',
        });
        return;
      }
      setShowSizeModal(true);
      return;
    }

    // If FBT items are selected, we MUST ask for their sizes first
    if (selectedFbtItems.size > 0) {
      setShowSizeModal(true);
      return;
    }

    // Otherwise, just add main product and go to cart
    addItem(product.handle, { size: selectedSize, quantity: 1 });
    navigate('/cart');
  };

  const handleConfirmSizes = (itemsWithSizes) => {
    if (hasComboItems) {
      itemsWithSizes.forEach(({ handle, size, quantity }) => {
        addItem(handle, { size, quantity: quantity ?? 1 });
      });
    } else {
      // 1. Add Main Product
      addItem(product.handle, { size: selectedSize, quantity: 1 });

      // 2. Add FBT Items
      itemsWithSizes.forEach(({ handle, size }) => {
        addItem(handle, { size, quantity: 1 });
      });
    }

    // 3. Close & Redirect
    setShowSizeModal(false);
    navigate('/cart');
  };

  useEffect(() => {
    if (!hasComboItems) {
      setSelectedComboItems(new Set());
      return;
    }
    const next = new Set(
      comboItems.map((item) => item?.handle).filter(Boolean),
    );
    setSelectedComboItems(next);
  }, [comboItems, hasComboItems]);

  // Fetch related products for "Frequently Bought Together"
  // Fetch related products for "Frequently Bought Together"
  useEffect(() => {
    let cancelled = false;

    // Helper to check if product is a combo
    const isComboProduct = (item) => {
      const title = String(item?.title || '').toLowerCase();
      const tags = Array.isArray(item?.tags) ? item.tags.map(t => String(t).toLowerCase()) : [];
      return title.includes('combo') || title.includes('combination') || tags.some(tag => tag.includes('combo')) || tags.some(tag => tag.includes('combination'));
    };

    // Helper to check category
    const isAllowedCategory = (item) => {
      const type = String(item?.productType || item?.type || '').toLowerCase();
      const title = String(item?.title || '').toLowerCase();
      // Also check tags just in case
      const tags = Array.isArray(item?.tags) ? item.tags.map(t => String(t).toLowerCase()) : [];

      const allowed = ['casual shirt', 'pant', 't-shirt', 'shirt', 'jeans', 'trousers', 'tshirt', 'tee', 'polo', 'shoe', 'sneaker', 'footwear', 'combo', 'combination', 'set'];

      return allowed.some(cat =>
        type.includes(cat) ||
        title.includes(cat) ||
        tags.some(t => t.includes(cat))
      );
    };

    const getCategory = (item) => {
      const text = (String(item?.productType || '') + ' ' + String(item?.title || '') + ' ' + (item?.tags || []).join(' ')).toLowerCase();
      if (text.includes('combo') || text.includes('combination')) return 'combo';
      if (text.includes('pant') || text.includes('trouser') || text.includes('jeans')) return 'bottom';
      if (text.includes('shirt') || text.includes('t-shirt') || text.includes('tee') || text.includes('polo') || text.includes('top')) return 'top';
      if (text.includes('shoe') || text.includes('sneaker') || text.includes('footwear')) return 'shoe';
      return 'other';
    };

    async function loadRelated() {
      if (!product) return;
      if (hasComboItems) {
        setRelatedProducts([]);
        return;
      }

      // START FBT RESTRICTION CHANGE
      // Only load FBT if the current product is a "Combo" or "Full Product"
      // Assuming "full products" maps to the combo concept or explicit override.
      if (!isComboProduct(product)) {
        setRelatedProducts([]);
        return;
      }
      // END FBT RESTRICTION CHANGE

      const currentCat = getCategory(product);

      // Define limits: "Under like this combo" -> likely means 1 bottom, 1 shoe, 1 other top?
      // User said: "if single tshirt then show pants and shirt and shoes"
      // So targeting: Bottoms, Shoes, and other Tops (maybe layering).

      // 1. Check if CURRENT product is in allowed category
      if (!isAllowedCategory(product)) {
        setRelatedProducts([]);
        return;
      }

      let related = [];

      try {
        // Fetch more products for better random pool
        const allProducts = await fetchAllProducts(60);

        // Helper to shuffle array
        const shuffle = (array) => array.sort(() => 0.5 - Math.random());

        // Candidates: Exclude current, exclude combos (from being recommended), ensure available
        const candidates = allProducts.filter((item) =>
          item?.handle &&
          item.handle !== product.handle &&
          !isComboProduct(item)
        );

        // Bucket candidates
        const buckets = {
          top: [],
          bottom: [],
          shoe: [],
          other: []
        };

        candidates.forEach(item => {
          buckets[getCategory(item)].push(item);
        });

        // Determine priority of categories to pick from
        let priorityCats = [];
        if (currentCat === 'top') {
          // T-shirt -> suggest Pants, Shoes
          priorityCats = ['bottom', 'shoe', 'top', 'other'];
        } else if (currentCat === 'bottom') {
          // Pant -> suggest Tops, Shoes
          priorityCats = ['top', 'shoe', 'bottom', 'other'];
        } else if (currentCat === 'shoe') {
          // Shoes -> suggest Tops, Bottoms
          priorityCats = ['top', 'bottom', 'shoe', 'other'];
        } else if (currentCat === 'combo') {
          // Combo -> suggest Shoes first, then others
          priorityCats = ['shoe', 'top', 'bottom', 'other'];
        } else {
          // Other -> suggest mix
          priorityCats = ['top', 'bottom', 'shoe', 'other'];
        }

        const selection = [];
        const seenHandles = new Set();

        // 1. Try to pick one unique product from each priority category
        priorityCats.forEach(cat => {
          if (selection.length >= 3) return;
          const pool = shuffle(buckets[cat]);
          const item = pool.find(p => !seenHandles.has(p.handle));
          if (item) {
            selection.push(item);
            seenHandles.add(item.handle);
          }
        });

        // 2. If still need items, fill with randoms from any allowed complementary category
        if (selection.length < 3) {
          const leftovers = shuffle(candidates.filter(p => !seenHandles.has(p.handle)));
          for (const item of leftovers) {
            if (selection.length >= 3) break;
            selection.push(item);
            seenHandles.add(item.handle);
          }
        }

        // 3. Sort the final selection: Top -> Bottom -> Shoe -> Other
        const sortOrder = ['top', 'bottom', 'shoe', 'other'];
        selection.sort((a, b) => {
          const catA = getCategory(a);
          const catB = getCategory(b);
          return sortOrder.indexOf(catA) - sortOrder.indexOf(catB);
        });

        related = selection;

        // Pre-select first item if available
        if (!cancelled && related.length > 0) {
          setSelectedFbtItems(new Set([related[0].handle]));
        }

      } catch (err) {
        console.warn('Failed to load products for Frequently Bought Together', err);
      }

      if (!cancelled && related.length) {
        setRelatedProducts(related);
      }
    }
    loadRelated();
    return () => {
      cancelled = true;
    };
  }, [product, hasComboItems]);

  // Fetch "You Might Also Like" products (Same Collection or Category)
  useEffect(() => {
    let cancelled = false;
    async function loadRecommended() {
      if (!product) return;

      try {
        let recs = [];
        // 1. Try Primary Collection
        const primaryCollection = product.collections?.[0]?.handle;
        if (primaryCollection) {
          const items = await fetchProductsFromCollection(primaryCollection, 10);
          recs = items;
        }

        // 2. Fallback to Search by Type if no collection or few results
        if ((!recs || recs.length < 4) && product.productType) {
          const typeRecs = await searchProducts(product.productType, 10);
          recs = [...recs, ...typeRecs];
        }

        // 3. Fallback to generic "Latest" if still nothing (using fetchAllProducts)
        if (!recs || recs.length < 4) {
          const all = await fetchAllProducts(12);
          recs = [...recs, ...all];
        }

        if (cancelled) return;

        // Filter out current product and duplicates
        const unique = [];
        const seen = new Set();
        seen.add(product.handle); // Exclude current

        recs.forEach(item => {
          if (item?.handle && !seen.has(item.handle)) {
            unique.push(item);
            seen.add(item.handle);
          }
        });

        // Limit to 4 for desktop, 4 for mobile (or 8?)
        // Let's show 4-8.
        setRecommendedProducts(unique.slice(0, 8).map(toProductCard));

      } catch (e) {
        console.warn('Failed to load recommended products', e);
      }
    }
    loadRecommended();
    return () => { cancelled = true; };
  }, [product]);

  // Fetch "You Might Also Like" products (Same Collection or Category)
  useEffect(() => {
    let cancelled = false;
    async function loadRecommended() {
      if (!product) return;

      try {
        let recs = [];
        // 1. Try Primary Collection
        const primaryCollection = product.collections?.[0]?.handle;
        if (primaryCollection) {
          const items = await fetchProductsFromCollection(primaryCollection, 10);
          recs = items;
        }

        // 2. Fallback to Search by Type if no collection or few results
        if ((!recs || recs.length < 4) && product.productType) {
          const typeRecs = await searchProducts(product.productType, 10);
          recs = [...recs, ...typeRecs];
        }

        // 3. Fallback to generic "Latest" if still nothing (using fetchAllProducts)
        if (!recs || recs.length < 4) {
          const all = await fetchAllProducts(12);
          recs = [...recs, ...all];
        }

        if (cancelled) return;

        // Filter out current product and duplicates
        const unique = [];
        const seen = new Set();
        seen.add(product.handle); // Exclude current

        recs.forEach(item => {
          if (item?.handle && !seen.has(item.handle)) {
            unique.push(item);
            seen.add(item.handle);
          }
        });

        // Limit to 4 for desktop, 4 for mobile (or 8?)
        // Let's show 4-8.
        setRecommendedProducts(unique.slice(0, 8).map(toProductCard));

      } catch (e) {
        console.warn('Failed to load recommended products', e);
      }
    }
    loadRecommended();
    return () => { cancelled = true; };
  }, [product]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading product...</div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <p className="text-gray-700">{error || 'Product not found.'}</p>
        <button
          onClick={() => navigate('/products')}
          className="px-4 py-2 text-sm font-bold border border-gray-900 uppercase tracking-[0.18em]"
        >
          Back to products
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen pb-40">

      {/* Mobile Top Section: Image, Overlay Header */}
      <div className="lg:hidden relative w-full bg-white mb-4">
        {/* Overlay Header */}
        <div className="absolute top-0 left-0 right-0 z-20 p-4 flex justify-between items-start pointer-events-none">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center pointer-events-auto"
          >
            <ChevronLeft className="w-8 h-8 text-black" />
          </button>
          <div className="flex flex-col gap-4 pointer-events-auto">
            <button onClick={openCartDrawer} className="w-10 h-10 flex items-center justify-center relative">
              <ShoppingBag className="w-6 h-6 text-black" />
              {outletContext?.cartItemCount > 0 && (
                <span className="absolute top-0 right-0 bg-red-600 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full">
                  {outletContext.cartItemCount}
                </span>
              )}
            </button>
            <button
              className="w-10 h-10 flex items-center justify-center"
              onClick={handleToggleWishlist}
              aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <Heart
                className="w-6 h-6"
                fill={inWishlist ? 'currentColor' : 'none'}
                color={inWishlist ? '#ff3f6c' : '#111827'}
              />
            </button>
            <button
              className="w-10 h-10 flex items-center justify-center"
              onClick={handleShare}
              aria-label="Share this product"
            >
              <Share2 className="w-6 h-6 text-black" />
            </button>
          </div>
        </div>

        {/* Mobile Image Carousel - Auto Height for full view */}
        <div className="relative w-full overflow-hidden min-h-[400px]">
          {images.length > 0 ? (
            <img
              src={images[activeImageIndex]?.url}
              alt={product.title}
              className="w-full h-auto object-cover"
            />
          ) : (
            <div className="w-full aspect-[3/4] flex items-center justify-center text-gray-200 bg-gray-50">
              No Image
            </div>
          )}

          {/* Navigation Zones */}
          {images.length > 1 && (
            <>
              <div
                className="absolute top-0 left-0 w-1/3 h-full z-10"
                onClick={(e) => { e.stopPropagation(); prevImage(); }}
              />
              <div
                className="absolute top-0 right-0 w-1/3 h-full z-10"
                onClick={(e) => { e.stopPropagation(); nextImage(); }}
              />
            </>
          )}

          {/* Dots */}
          {images.length > 1 && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-20 pointer-events-none">
              {images.map((_, idx) => (
                <div
                  key={idx}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${idx === activeImageIndex ? 'bg-black w-3' : 'bg-black/20'
                    }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="hidden lg:block">
        <MobilePageHeader
          title={product?.title}
          onSearch={() => document.dispatchEvent(new CustomEvent('open-search'))}
        />
      </div>

      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">
          <div className="hidden lg:flex lg:w-[62%] gap-5 lg:min-h-[70vh] lg:max-h-[85vh] h-auto lg:sticky lg:top-24">
            <div className="hidden lg:flex flex-col gap-4 w-24 overflow-y-auto no-scrollbar py-1">
              {images.map((img, idx) => (
                <button
                  key={img.url || idx}
                  onClick={() => setActiveImageIndex(idx)}
                  className={`w-full aspect-[3/4] border transition-all ${activeImageIndex === idx
                    ? 'border-black opacity-100'
                    : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                >
                  <img
                    src={img.url}
                    alt={img.alt || product.title}
                    className="w-full h-full object-contain bg-white"
                  />
                </button>
              ))}
            </div>

            <div className="flex-1 relative bg-gray-50 h-full overflow-hidden group rounded">
              {images.length ? (
                <img
                  src={images[activeImageIndex]?.url}
                  alt={product.title}
                  className="w-full h-full object-contain object-center bg-white"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  No image
                </div>
              )}

              {images.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}

              <div className="absolute top-4 right-4 flex flex-col gap-3">
                <button
                  className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm hover:scale-105 transition-transform"
                  onClick={handleToggleWishlist}
                  aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
                >
                  <Heart
                    className="w-5 h-5"
                    fill={inWishlist ? 'currentColor' : 'none'}
                    color={inWishlist ? '#ff3f6c' : '#374151'}
                  />
                </button>
                <button
                  className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm hover:scale-105 transition-transform"
                  onClick={handleShare}
                  aria-label="Share this product"
                >
                  <Share2 className="w-5 h-5 text-gray-700" />
                </button>
              </div>
            </div>
          </div>

          <div className="lg:w-[38%] pt-2 lg:pl-2">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-gray-500">Aradhya</p>
                <h1 className="text-xl md:text-2xl font-semibold text-gray-900">
                  {product.title}
                </h1>
              </div>
              <span className="text-xl font-bold text-gray-900">{price}</span>
            </div>

            {hasColors && (
              <div className="mb-3 text-sm text-gray-700">
                <span className="font-semibold">Color: </span>
                <span>{selectedColor || colorOptions[0]}</span>
              </div>
            )}

            {hasColors && (
              <div className="mb-8">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                    Colors
                  </span>
                  <span className="text-xs text-gray-500">
                    {colorOptions.length} option{colorOptions.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {colorOptions.map((color) => {
                    const active = selectedColor === color;
                    return (
                      <button
                        key={color}
                        onClick={() => setSelectedColor(color)}
                        className={`flex items-center gap-2 px-3 h-10 border text-sm font-medium transition-all ${active
                          ? 'border-black bg-black text-white'
                          : 'border-gray-300 text-gray-900 hover:border-black'
                          }`}
                      >
                        <span
                          className="w-4 h-4 rounded-full border border-gray-200"
                          style={{ backgroundColor: color.toLowerCase() }}
                          aria-hidden
                        />
                        {color}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {hasSizes && (
              <div className="mb-8">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                    Sizes
                  </span>
                  <button className="text-xs font-medium text-gray-500 underline hover:text-black">
                    SIZE CHART
                  </button>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {sizeOptions.map((size) => {
                    const availability = sizeAvailability[size];
                    const isOut = availability ? !availability.inStock : false;
                    const isSelected = selectedSize === size;
                    return (
                      <button
                        key={size}
                        onClick={() => setSelectedSize(size)}
                        disabled={isOut}
                        className={`min-w-[48px] h-10 px-2 border flex items-center justify-center text-sm font-medium transition-all ${isSelected
                          ? 'border-black bg-black text-white'
                          : 'border-gray-300 text-gray-900 hover:border-black'
                          } ${isOut ? 'bg-gray-50 text-gray-400 cursor-not-allowed hover:border-gray-300' : ''}`}
                        title={isOut ? 'Out of stock' : availability?.lowStock ? 'Low stock' : 'In stock'}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
                {selectedSize && !sizeAvailability[selectedSize]?.inStock ? (
                  <p className="mt-3 text-xs text-rose-600">Out of stock</p>
                ) : selectedSize && sizeAvailability[selectedSize]?.lowStock ? (
                  <p className="mt-3 text-xs text-orange-600">
                    {Number.isFinite(sizeAvailability[selectedSize]?.quantity)
                      ? `Only ${sizeAvailability[selectedSize].quantity} left`
                      : 'Low stock'}
                  </p>
                ) : null}
                <p className="text-xs text-orange-600 mt-3 flex items-center gap-1">
                  <Truck className="w-3 h-3" /> FREE 1-2 day delivery on 5k+
                  pincodes
                </p>
              </div>
            )}

            {/* Desktop Add to Bag - Hidden on Mobile, rendered as sticky footer instead */}
            <button
              onClick={handleAddToCart}
              className="hidden lg:block w-full bg-black text-white font-bold text-sm py-4 uppercase tracking-widest hover:bg-gray-900 transition-colors mb-6"
            >
              Add to Bag
            </button>



            {hasComboItems && (
              <FrequentlyBoughtTogether
                title="Choose items in this combo"
                subtitle={comboSelectionLabel}
                products={comboItems}
                selectedHandles={selectedComboItems}
                onSelectionChange={setSelectedComboItems}
              />
            )}

            {/* Frequently Bought Together Section (Moved Below Combo) */}
            {relatedProducts.length > 0 && !hasComboItems && (
              <FrequentlyBoughtTogether
                products={relatedProducts}
                selectedHandles={selectedFbtItems}
                onSelectionChange={setSelectedFbtItems}
              />
            )}






            <SizeSelectionModal
              isOpen={showSizeModal}
              onClose={() => setShowSizeModal(false)}
              items={
                hasComboItems
                  ? selectedComboList
                  : relatedProducts.filter((p) => selectedFbtItems.has(p.handle))
              }
              onConfirm={handleConfirmSizes}
            />

            <div className="border-t border-gray-200">
              <AccordionItem
                title="Details"
                isOpen={openAccordion === 'details'}
                onClick={() => toggleAccordion('details')}
              >
                <div
                  dangerouslySetInnerHTML={{
                    __html: product.descriptionHtml || product.description,
                  }}
                />
              </AccordionItem>

              <AccordionItem
                title="Delivery"
                isOpen={openAccordion === 'delivery'}
                onClick={() => toggleAccordion('delivery')}
              >
                <PincodeChecker />
              </AccordionItem>

              <AccordionItem
                title="Returns"
                isOpen={openAccordion === 'returns'}
                onClick={() => toggleAccordion('returns')}
              >
                <p>
                  Easy 14 days returns and exchanges. Return Policies may vary
                  based on products and promotions.
                </p>
              </AccordionItem>

              <AccordionItem
                title="Review"
                isOpen={openAccordion === 'reviews'}
                onClick={() => toggleAccordion('reviews')}
              >
                {reviewSummaryText ? (
                  <p className="mb-3 text-sm text-gray-600">{reviewSummaryText}</p>
                ) : null}
                {reviewItems.length ? (
                  <div className="space-y-3">
                    {reviewItems.slice(0, 3).map((review, index) => {
                      const reviewObject =
                        review && typeof review === 'object' ? review : { body: review };
                      const author =
                        pickReviewField(reviewObject, ['author', 'name', 'reviewer', 'customer', 'user']) ||
                        'Anonymous';
                      const body = pickReviewField(reviewObject, [
                        'body',
                        'text',
                        'content',
                        'review',
                        'comment',
                        'message',
                      ]);
                      const ratingValue = pickReviewField(reviewObject, [
                        'rating',
                        'stars',
                        'score',
                        'value',
                      ]);
                      const ratingNumber = Number(ratingValue);
                      const ratingLabel = ratingValue
                        ? Number.isFinite(ratingNumber)
                          ? `Rating: ${ratingNumber}/5`
                          : `Rating: ${ratingValue}`
                        : '';
                      const rawDate = pickReviewField(reviewObject, [
                        'created_at',
                        'createdAt',
                        'date',
                        'created',
                      ]);
                      const formattedDate = formatReviewDate(rawDate);

                      return (
                        <div key={`review-${index}`} className="rounded-lg border border-gray-200 p-3">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                            <span className="font-semibold text-gray-700">{author}</span>
                            {ratingLabel ? <span>{ratingLabel}</span> : null}
                            {formattedDate ? <span>{formattedDate}</span> : null}
                          </div>
                          {body ? <p className="mt-2 text-sm text-gray-700">{body}</p> : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">No reviews yet.</p>
                )}
              </AccordionItem>
            </div>
          </div>
        </div>
      </div>

      {/* You Might Also Like Section - Moved Outside */}
      {recommendedProducts.length > 0 && (
        <div className="mb-8">
          <ProductGrid
            title="You Might Also Like"
            products={recommendedProducts}
            ctaHref={`/collections/${product?.collections?.[0]?.handle || 'all'}`}
            ctaLabel="View Collection"
          />
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden flex flex-col shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] bg-white">
        {/* Button Wrapper: Added px-4 (side spacing) and vertical padding */}
        <div className="px-4 pt-4 pb-2">
          <button
            onClick={handleAddToCart}
            className="w-full bg-black text-white h-12 flex items-center justify-center"
          >
            <span
              className="font-bold text-lg uppercase tracking-wider relative"
              style={{
                // textShadow: '-2px -1px 0 #00ffff, 2px 1px 0 #ff0000',
                letterSpacing: '0.05em'
              }}
            >
              Add to Bag
            </span>
          </button>
        </div>

        {/* Bottom Menu Navigation */}
        <div className="bg-white h-14 w-full flex items-center justify-between px-6 pb-2">
          {/* Home */}
          <Link to="/" className="flex flex-col items-center justify-center w-12 h-full text-gray-900">
            <Home className="w-6 h-6 stroke-[1.5]" />
          </Link>

          {/* Search */}
          <button
            onClick={() => document.dispatchEvent(new CustomEvent('open-search'))}
            className="flex flex-col items-center justify-center w-12 h-full text-gray-900"
          >
            <div className="relative">
              <Search className="w-6 h-6 stroke-[1.5]" />
            </div>
          </button>

          {/* Shop Text */}
          <Link to="/products" className="flex flex-col items-center justify-center w-12 h-full">
            <span className="text-sm font-normal tracking-wide text-gray-900">SHOP</span>
          </Link>

          {/* Bag with Heart Badge */}
          <button
            onClick={openCartDrawer}
            className="flex flex-col items-center justify-center w-12 h-full text-gray-900 relative"
          >
            <div className="relative">
              <ShoppingBag className="w-6 h-6 stroke-[1.5]" />
              <div className="absolute -bottom-1 -right-1 bg-white border border-gray-900 rounded-full w-4 h-4 flex items-center justify-center">
                <Heart className="w-2.5 h-2.5 fill-black text-black" />
              </div>
            </div>
          </button>

          {/* Profile */}
          <Link to={isAuthenticated ? "/profile" : "/login"} className="flex flex-col items-center justify-center w-12 h-full text-gray-900">
            <User className="w-6 h-6 stroke-[1.5]" />
          </Link>
        </div>
      </div>

    </div>
  );
};

export default ProductDetails;
