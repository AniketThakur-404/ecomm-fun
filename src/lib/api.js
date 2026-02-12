const resolveApiBase = () => {
  if (import.meta.env.VITE_API_BASE_URL) return import.meta.env.VITE_API_BASE_URL;
  if (import.meta.env.PROD && typeof window !== 'undefined') return window.location.origin;
  return 'http://localhost:5000';
};

const API_BASE = resolveApiBase().replace(/\/+$/, '');
const API_URL = `${API_BASE}/api`;

const DEFAULT_LOCALE = import.meta.env.VITE_LOCALE || 'en-IN';
const DEFAULT_CURRENCY = import.meta.env.VITE_CURRENCY || 'INR';

const buildQuery = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry !== undefined && entry !== null && entry !== '') {
          query.append(key, entry);
        }
      });
      return;
    }
    query.append(key, value);
  });
  const search = query.toString();
  return search ? `?${search}` : '';
};

const parseResponse = async (response) => {
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const message =
      payload?.error?.message ||
      payload?.message ||
      `Request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
};

const unwrap = (payload) => {
  if (!payload || typeof payload !== 'object') return payload;
  if (Object.prototype.hasOwnProperty.call(payload, 'data')) {
    return payload.data;
  }
  return payload;
};

const detectPayloadKind = (value) => {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  if (typeof value === 'string') {
    const snippet = value.trim().slice(0, 64).toLowerCase();
    if (snippet.startsWith('<!doctype') || snippet.startsWith('<html')) {
      return 'html';
    }
    return 'text';
  }
  return typeof value;
};

const extractArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value.items)) return value.items;
  if (Array.isArray(value.products)) return value.products;
  if (Array.isArray(value.collections)) return value.collections;
  if (Array.isArray(value.results)) return value.results;
  return null;
};

const extractList = (payload, label) => {
  const unwrapped = unwrap(payload);
  const primary = extractArray(unwrapped);
  if (primary) return primary;

  const fallback = extractArray(payload);
  if (fallback) return fallback;

  if (unwrapped === null || unwrapped === undefined) return [];

  const kind = detectPayloadKind(unwrapped);
  if (kind === 'html') {
    throw new Error(
      `Unexpected HTML while loading ${label}. Check your Vercel API routing for /api/*.`,
    );
  }

  throw new Error(`Unexpected response format while loading ${label}.`);
};

const inflightRequests = new Map();
const responseCache = new Map();
const RESPONSE_CACHE_TTL = 60_000;

const request = async (path, { method = 'GET', headers = {}, body } = {}) => {
  const url = path.startsWith('http') ? path : `${API_URL}${path}`;
  const options = { method, headers: { ...headers } };

  if (body !== undefined) {
    if (body instanceof FormData) {
      options.body = body;
    } else {
      options.headers['Content-Type'] = 'application/json';
      options.body = typeof body === 'string' ? body : JSON.stringify(body);
    }
  }

  const methodUpper = String(method || 'GET').toUpperCase();
  const cacheKey =
    methodUpper === 'GET' && body === undefined
      ? `${url}|auth:${options.headers.Authorization || ''}`
      : null;

  if (cacheKey && !options.headers.Authorization) {
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.payload;
    }
    if (cached) responseCache.delete(cacheKey);
  }

  if (cacheKey && inflightRequests.has(cacheKey)) {
    return inflightRequests.get(cacheKey);
  }

  const pending = fetch(url, options)
    .then(parseResponse)
    .then((payload) => {
      if (cacheKey && !options.headers.Authorization) {
        responseCache.set(cacheKey, {
          payload: Promise.resolve(payload),
          expiresAt: Date.now() + RESPONSE_CACHE_TTL,
        });
      }
      return payload;
    })
    .finally(() => {
      if (cacheKey) inflightRequests.delete(cacheKey);
    });

  if (cacheKey) inflightRequests.set(cacheKey, pending);
  return pending;
};

const requestWithAuth = (path, token, options = {}) => {
  const headers = { ...(options.headers || {}) };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return request(path, { ...options, headers });
};

const toNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || value === '') return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const normalizeStringArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

export const normaliseTokenValue = (value) =>
  value?.toString().trim().toLowerCase() ?? '';

const SIZE_OPTION_TOKENS = [
  'size',
  'waist',
  'inseam',
  'length',
  'shoe',
  'foot',
];

export const isSizeOptionName = (name) => {
  const token = normaliseTokenValue(name);
  if (!token) return false;
  return SIZE_OPTION_TOKENS.some((part) => token.includes(part));
};

const normalizeImage = (image, fallbackAlt = '') => {
  if (!image?.url) return null;
  return {
    url: image.url,
    alt: image.alt || image.altText || fallbackAlt || '',
  };
};

const normalizeCollection = (collection) => {
  if (!collection) return null;
  const image = collection.imageUrl
    ? { url: collection.imageUrl, alt: collection.title }
    : null;
  return {
    id: collection.id,
    handle: collection.handle,
    title: collection.title,
    description: collection.descriptionHtml || '',
    image,
    parentId: collection.parentId ?? null,
    count: collection._count?.products ?? null,
  };
};

const buildPriceRange = (prices, currencyCode) => {
  if (!prices.length) {
    return {
      minVariantPrice: { amount: 0, currencyCode },
      maxVariantPrice: { amount: 0, currencyCode },
    };
  }
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return {
    minVariantPrice: { amount: min, currencyCode },
    maxVariantPrice: { amount: max, currencyCode },
  };
};

const deriveComboHandles = (product) => {
  const metafields = Array.isArray(product?.metafields) ? product.metafields : [];
  const bundleFields = metafields.filter(
    (field) =>
      field?.namespace === 'custom' &&
      (field?.key === 'combo_items' || field?.key === 'bundle_items'),
  );
  if (!bundleFields.length) return [];

  const collected = [];
  bundleFields.forEach((field) => {
    const value = field?.value;
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach((item) => collected.push(String(item)));
      return;
    }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          parsed.forEach((item) => collected.push(String(item)));
          return;
        }
      } catch {
        normalizeStringArray(value.replace(/\|/g, ',')).forEach((item) =>
          collected.push(item),
        );
        return;
      }
      normalizeStringArray(value.replace(/\|/g, ',')).forEach((item) =>
        collected.push(item),
      );
    }
  });

  return Array.from(new Set(collected.map((item) => item.trim()).filter(Boolean)));
};

const mapProduct = (product) => {
  if (!product) return null;

  const mediaItems = Array.isArray(product.media) ? product.media : [];
  const images = mediaItems
    .filter((media) => !media.type || media.type === 'IMAGE')
    .map((img) => normalizeImage({ url: img.url, alt: img.alt }, product.title))
    .filter(Boolean);

  const featuredImage = images[0] ?? null;
  const tags = normalizeStringArray(product.tags);
  const currencyCode = DEFAULT_CURRENCY;

  const options = Array.isArray(product.options)
    ? product.options.map((option) => ({
      name: option.name,
      values: option.values ?? [],
    }))
    : [];

  const variants = Array.isArray(product.variants)
    ? product.variants.map((variant) => {
      const hasInventoryLevels = Object.prototype.hasOwnProperty.call(
        variant || {},
        'inventoryLevels',
      );
      const inventoryLevels = hasInventoryLevels && Array.isArray(variant.inventoryLevels)
        ? variant.inventoryLevels
        : [];
      const quantityAvailable = hasInventoryLevels
        ? inventoryLevels.reduce(
          (sum, level) => sum + (Number(level.available) || 0),
          0,
        )
        : null;
      const availableForSale =
        variant.trackInventory === false
          ? true
          : hasInventoryLevels
            ? quantityAvailable > 0
            : true;

      const selectedOptions = variant.optionValues
        ? Object.entries(variant.optionValues).map(([name, value]) => ({
          name,
          value,
        }))
        : [];

      const compareAtPrice = variant.compareAtPrice
        ? {
          amount: toNumber(variant.compareAtPrice, 0),
          currencyCode,
        }
        : null;

      return {
        id: variant.id,
        title: variant.title,
        availableForSale,
        sku: variant.sku ?? null,
        quantityAvailable,
        price: toNumber(variant.price, 0),
        currencyCode,
        compareAtPrice,
        selectedOptions,
      };
    })
    : [];

  const prices = variants
    .map((variant) => toNumber(variant.price, 0))
    .filter((value) => Number.isFinite(value));

  const price = prices.length ? Math.min(...prices) : 0;
  const priceRange = buildPriceRange(prices, currencyCode);

  const collections = Array.isArray(product.collections)
    ? product.collections.map(normalizeCollection).filter(Boolean)
    : [];

  const publishedReviews = Array.isArray(product.reviews) ? product.reviews : [];
  const reviewsList = publishedReviews.map((review) => ({
    author: review.user?.name || review.user?.email || 'Customer',
    rating: review.rating,
    title: review.title,
    comment: review.comment,
    date: review.createdAt,
  }));

  const reviewCount =
    product.reviewCount ??
    product._count?.reviews ??
    (Array.isArray(reviewsList) ? reviewsList.length : 0);
  const averageRating = product.averageRating ?? null;

  const reviewsJson =
    reviewsList && reviewsList.length
      ? JSON.stringify({ reviews: reviewsList, averageRating, reviewCount })
      : averageRating != null || reviewCount
        ? JSON.stringify({ averageRating, reviewCount })
        : null;

  const optionValues = {};
  options.forEach((option) => {
    if (!option?.name) return;
    optionValues[option.name.toLowerCase()] = option.values ?? [];
  });

  const totalInventory = variants.reduce(
    (sum, variant) => sum + (Number.isFinite(variant.quantityAvailable) ? variant.quantityAvailable : 0),
    0,
  );

  return {
    id: product.id,
    handle: product.handle,
    title: product.title,
    vendor: product.vendor || '',
    productType: product.productType || '',
    description: product.descriptionHtml || '',
    descriptionHtml: product.descriptionHtml || '',
    tags,
    featuredImage,
    images,
    price,
    currencyCode,
    priceRange,
    variants,
    options,
    optionValues,
    collections,
    metafields: product.metafields || [],
    reviewsJson,
    comboItems: [],
    seo: null,
    availableForSale: variants.length
      ? variants.some((variant) => variant.availableForSale)
      : true,
    totalInventory,
  };
};

export function formatMoney(
  amount,
  currencyCode = DEFAULT_CURRENCY,
  locale = DEFAULT_LOCALE,
) {
  const value = toNumber(amount, 0);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode || DEFAULT_CURRENCY,
      currencyDisplay: 'symbol',
      minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    }).format(value);
  } catch {
    return `${currencyCode || DEFAULT_CURRENCY} ${value.toFixed(2)}`;
  }
}


export const extractOptionValues = (product, optionName) => {
  if (!product?.options?.length) return [];
  const target = optionName?.toLowerCase();
  const option = product.options.find(
    (opt) => opt?.name?.toLowerCase() === target,
  );
  return option?.values ?? [];
};

export const extractSizeOptions = (product) => {
  if (!product?.options?.length) return [];
  const exact = extractOptionValues(product, 'Size');
  if (exact.length) return exact;
  const match = product.options.find((opt) => isSizeOptionName(opt?.name));
  return match?.values ?? [];
};

export function findVariantForSize(product, size) {
  const variants = product?.variants ?? [];
  if (!variants.length) return null;

  if (!size) {
    return variants[0] ?? null;
  }

  const target = normaliseTokenValue(size);

  const matchByOption = variants.find((variant) =>
    variant.selectedOptions?.some(
      (option) =>
        isSizeOptionName(option?.name) &&
        normaliseTokenValue(option?.value) === target,
    ),
  );

  if (matchByOption) return matchByOption;

  return (
    variants.find((variant) => {
      const title = normaliseTokenValue(variant?.title);
      if (title && title === target) return true;
      const tokens =
        variant?.title
          ?.toLowerCase()
          ?.split('/')
          ?.map((token) => token.trim()) ?? [];
      return tokens.includes(target);
    }) ?? variants[0]
  );
}

export const getProductImageUrl = (product) =>
  product?.featuredImage?.url ?? product?.images?.[0]?.url ?? '';

export function toProductCard(product) {
  if (!product) return null;
  const image =
    product.featuredImage?.url ?? product.images?.[0]?.url ?? undefined;
  const secondaryImage =
    product.images?.find((img) => img?.url && img.url !== image)?.url ?? null;
  const currency = product.currencyCode || DEFAULT_CURRENCY;
  return {
    title: product.title,
    handle: product.handle,
    vendor: product.vendor,
    price: formatMoney(product.price, currency),
    img: image,
    hoverImg: secondaryImage,
    badge: product.tags?.includes('new') ? 'New' : undefined,
    href: `/product/${product.handle}`,
  };
}

export const fetchAllProducts = async (limit = 100, page = 1) => {
  const payload = await request(`/products${buildQuery({ limit, page, include: 'compact', skipCount: 'true' })}`);
  const items = extractList(payload, 'products');
  return items.map(mapProduct).filter(Boolean);
};

export const fetchProductsPage = async ({
  limit = 40,
  page = 1,
  search,
  category,
  handles,
} = {}) => {
  const payload = await request(
    `/products${buildQuery({ limit, page, search, category, handles, include: 'compact' })}`,
  );
  const items = extractList(payload, 'products');
  const unwrapped = unwrap(payload);
  const meta =
    payload?.meta ??
    payload?.data?.meta ??
    (unwrapped && typeof unwrapped === 'object' ? unwrapped.meta : null) ??
    null;
  return {
    items: items.map(mapProduct).filter(Boolean),
    meta,
  };
};

export const fetchCollections = async (limit = 8) => {
  const payload = await request(`/collections${buildQuery({ limit })}`);
  const items = extractList(payload, 'collections');
  return items.map(normalizeCollection).filter(Boolean);
};

export const fetchCollectionByHandle = async (handle, limit = 24) => {
  if (!handle) return null;
  const payload = await request(
    `/collections/slug/${encodeURIComponent(handle)}${buildQuery({ include: 'compact' })}`,
  );
  const collection = normalizeCollection(unwrap(payload));
  const products = await fetchProductsFromCollection(handle, limit);
  return {
    ...collection,
    products,
  };
};

export const fetchProductsFromCollection = async (handle, limit = 12) => {
  if (!handle) return [];
  const payload = await request(
    `/products${buildQuery({ category: handle, limit, include: 'compact' })}`,
  );
  const items = extractList(payload, `products for collection "${handle}"`);
  return items.map(mapProduct).filter(Boolean);
};

export const searchProducts = async (query, limit = 20) => {
  if (!query) return [];
  const payload = await request(
    `/products${buildQuery({ search: query, limit, include: 'compact' })}`,
  );
  const items = extractList(payload, 'search results');
  return items.map(mapProduct).filter(Boolean);
};

const fetchProductsByHandles = async (handles) => {
  if (!handles?.length) return [];
  const payload = await request(
    `/products${buildQuery({
      handles: handles.join(','),
      limit: handles.length,
      include: 'compact',
    })}`,
  );
  const items = extractList(payload, 'products by handle');
  return items.map(mapProduct).filter(Boolean);
};

export const fetchProductByHandle = async (handle) => {
  if (!handle) return null;
  const payload = await request(`/products/${encodeURIComponent(handle)}`);
  const raw = unwrap(payload);
  if (!raw) return null;
  const mapped = mapProduct(raw);

  const comboHandles = deriveComboHandles(raw);
  if (comboHandles.length) {
    const comboProducts = await fetchProductsByHandles(comboHandles);
    mapped.comboItems = comboProducts;
  }

  return mapped;
};

export const fetchProductRaw = async (id) => {
  if (!id) return null;
  const payload = await request(`/products/${encodeURIComponent(id)}`);
  return unwrap(payload);
};

export const signUp = async ({ email, password, name }) => {
  const payload = await request('/users/signup', {
    method: 'POST',
    body: { email, password, name },
  });
  return unwrap(payload);
};

export const signIn = async ({ email, password }) => {
  const payload = await request('/users/signin', {
    method: 'POST',
    body: { email, password },
  });
  return unwrap(payload);
};

export const fetchProfile = async (token) => {
  const payload = await requestWithAuth('/users/me', token);
  return unwrap(payload);
};

export const fetchMyOrders = async (token) => {
  const payload = await requestWithAuth('/orders/my', token);
  return unwrap(payload) || [];
};

export const trackOrder = async ({ orderId, email, phone }) => {
  const payload = await request('/orders/track', {
    method: 'POST',
    body: { orderId, email, phone },
  });
  return unwrap(payload);
};

export const adminLogin = async ({ email, password }) => {
  const payload = await request('/admin/login', {
    method: 'POST',
    body: { email, password },
  });
  return unwrap(payload);
};

export const adminFetchProducts = async (token, params = {}) => {
  const finalParams = { include: 'compact', ...params };
  const payload = await requestWithAuth(
    `/admin/products${buildQuery(finalParams)}`,
    token,
  );
  return payload;
};

export const adminCreateProduct = async (token, data) =>
  unwrap(
    await requestWithAuth('/admin/products', token, {
      method: 'POST',
      body: data,
    }),
  );

export const adminUpdateProduct = async (token, id, data) =>
  unwrap(
    await requestWithAuth(`/admin/products/${encodeURIComponent(id)}`, token, {
      method: 'PUT',
      body: data,
    }),
  );

export const adminDeleteProduct = async (token, id) =>
  requestWithAuth(`/admin/products/${encodeURIComponent(id)}`, token, {
    method: 'DELETE',
  });

export const adminExportProductsCsv = async (token) =>
  requestWithAuth('/admin/products/export', token, { method: 'GET' });

export const adminImportProductsCsv = async (token, csvText) =>
  unwrap(
    await requestWithAuth('/admin/products/import-csv', token, {
      method: 'POST',
      body: { csv: csvText },
    }),
  );

export const adminFetchCollections = async (token, params = {}) =>
  unwrap(await requestWithAuth(`/collections${buildQuery(params)}`, token));

export const adminFetchCollection = async (token, id) =>
  unwrap(
    await requestWithAuth(
      `/collections/${encodeURIComponent(id)}${buildQuery({ include: 'detail' })}`,
      token,
    ),
  );

export const adminCreateCollection = async (token, data) =>
  unwrap(
    await requestWithAuth('/collections', token, {
      method: 'POST',
      body: data,
    }),
  );

export const adminUpdateCollection = async (token, id, data) =>
  unwrap(
    await requestWithAuth(`/collections/${encodeURIComponent(id)}`, token, {
      method: 'PUT',
      body: data,
    }),
  );

export const adminDeleteCollection = async (token, id) =>
  requestWithAuth(`/collections/${encodeURIComponent(id)}`, token, {
    method: 'DELETE',
  });

export const uploadImage = async (token, file) => {
  const formData = new FormData();
  formData.append('image', file);
  const payload = await requestWithAuth('/uploads', token, {
    method: 'POST',
    body: formData,
  });
  return unwrap(payload);
};
