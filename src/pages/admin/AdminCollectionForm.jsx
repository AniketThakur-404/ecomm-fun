import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  adminCreateCollection,
  adminFetchCollection,
  adminFetchCollections,
  adminFetchProducts,
  adminUpdateCollection,
} from '../../lib/api';
import { useAdminAuth } from '../../contexts/admin-auth-context';

const slugify = (value) =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const SKINTONE_OPTIONS = [
  { value: 'fair', label: 'Fair' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'dark', label: 'Dark' },
];

const OCCASION_OPTIONS = [
  { value: 'date', label: 'Date Wear' },
  { value: 'office', label: 'Office Wear' },
  { value: 'puja', label: 'Puja/Festive' },
  { value: 'party', label: 'Party' },
  { value: 'casual', label: 'Casual' },
];

const isObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));

const normalizeChoiceList = (value, allowedValues) => {
  const allowed = new Set(allowedValues.map((item) => item.value));
  const list = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];
  return Array.from(
    new Set(
      list
        .map((item) => String(item).trim().toLowerCase())
        .filter((item) => allowed.has(item)),
    ),
  );
};

const readFlowConfig = (rules) => {
  const sourceRules = isObject(rules) ? rules : {};
  const flow = isObject(sourceRules.storefrontFlow) ? sourceRules.storefrontFlow : {};
  const flowSkintones = normalizeChoiceList(flow.skintones, SKINTONE_OPTIONS);
  const flowOccasions = normalizeChoiceList(flow.occasions, OCCASION_OPTIONS);
  return {
    rules: sourceRules,
    flowEnabled: flow.enabled !== false && (flowSkintones.length > 0 || flowOccasions.length > 0),
    flowSkintones,
    flowOccasions,
  };
};

const buildRulesPayload = ({ rules, flowEnabled, flowSkintones, flowOccasions }) => {
  const nextRules = isObject(rules) ? { ...rules } : {};
  if (!flowEnabled) {
    delete nextRules.storefrontFlow;
  } else {
    nextRules.storefrontFlow = {
      enabled: true,
      skintones: flowSkintones,
      occasions: flowOccasions,
    };
  }
  return Object.keys(nextRules).length ? nextRules : null;
};

const buildSuggestedHandle = ({ title, parentId, collections }) => {
  const titleSlug = slugify(title || '');
  if (!titleSlug) return '';
  if (!parentId) return titleSlug;

  const parent = Array.isArray(collections)
    ? collections.find((collection) => collection.id === parentId)
    : null;
  const parentSlug = slugify(parent?.handle || parent?.title || '');
  if (!parentSlug) return titleSlug;

  return slugify(`${parentSlug}-${titleSlug}`);
};

const AdminCollectionForm = () => {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const { token } = useAdminAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [collections, setCollections] = useState([]);
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [handleTouched, setHandleTouched] = useState(false);
  const [form, setForm] = useState({
    title: '',
    handle: '',
    descriptionHtml: '',
    imageUrl: '',
    parentId: '',
    type: 'MANUAL',
    rules: {},
    flowEnabled: false,
    flowSkintones: [],
    flowOccasions: [],
  });

  useEffect(() => {
    if (!token) return;
    adminFetchCollections(token, { limit: 200 })
      .then((items) => setCollections(Array.isArray(items) ? items : []))
      .catch(() => setCollections([]));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    const loadAllProducts = async () => {
      setProductsLoading(true);
      try {
        const allProducts = [];
        const seen = new Set();
        let page = 1;
        const limit = 200;

        while (true) {
          const payload = await adminFetchProducts(token, { page, limit, include: 'compact' });
          const items = Array.isArray(payload?.data)
            ? payload.data
            : (Array.isArray(payload) ? payload : []);

          items.forEach((item) => {
            if (!item?.id || seen.has(item.id)) return;
            seen.add(item.id);
            allProducts.push(item);
          });

          const total = Number(payload?.meta?.total);
          if (!items.length) break;
          if (Number.isFinite(total) && allProducts.length >= total) break;
          if (items.length < limit) break;
          page += 1;
        }

        if (!cancelled) {
          setProducts(allProducts);
        }
      } catch {
        if (!cancelled) {
          setProducts([]);
        }
      } finally {
        if (!cancelled) {
          setProductsLoading(false);
        }
      }
    };

    loadAllProducts();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (isNew || !id || !token) {
      setSelectedProductIds([]);
      setHandleTouched(false);
      return;
    }
    setLoading(true);
    adminFetchCollection(token, id)
      .then((collection) => {
        if (!collection) return;
        const flowConfig = readFlowConfig(collection.rules);
        const assignedProducts = Array.isArray(collection.products) ? collection.products : [];
        setForm({
          title: collection.title || '',
          handle: collection.handle || '',
          descriptionHtml: collection.descriptionHtml || '',
          imageUrl: collection.imageUrl || '',
          parentId: collection.parentId || '',
          type: collection.type || 'MANUAL',
          rules: flowConfig.rules,
          flowEnabled: flowConfig.flowEnabled,
          flowSkintones: flowConfig.flowSkintones,
          flowOccasions: flowConfig.flowOccasions,
        });
        setHandleTouched(Boolean(collection.handle));
        setSelectedProductIds(
          assignedProducts
            .map((product) => product?.id)
            .filter(Boolean),
        );
      })
      .catch((err) => setError(err?.message || 'Unable to load collection.'))
      .finally(() => setLoading(false));
  }, [id, isNew, token]);

  useEffect(() => {
    if (!isNew || handleTouched) return;
    const suggested = buildSuggestedHandle({
      title: form.title,
      parentId: form.parentId,
      collections,
    });
    setForm((prev) => {
      if (prev.handle === suggested) return prev;
      return { ...prev, handle: suggested };
    });
  }, [isNew, handleTouched, form.title, form.parentId, collections]);

  const handleFieldChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleChoice = (field, value) => {
    setForm((prev) => {
      const selected = Array.isArray(prev[field]) ? prev[field] : [];
      return {
        ...prev,
        [field]: selected.includes(value)
          ? selected.filter((entry) => entry !== value)
          : [...selected, value],
      };
    });
  };

  const toggleProductSelection = (productId) => {
    if (!productId) return;
    setSelectedProductIds((prev) =>
      prev.includes(productId)
        ? prev.filter((idValue) => idValue !== productId)
        : [...prev, productId],
    );
  };

  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    if (!query) return products;
    return products.filter((product) =>
      [product?.title, product?.handle, product?.vendor]
        .map((value) => String(value || '').toLowerCase())
        .some((value) => value.includes(query)),
    );
  }, [products, productSearch]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSaving(true);

    const suggestedHandle = buildSuggestedHandle({
      title: form.title,
      parentId: form.parentId,
      collections,
    });

    const payload = {
      title: form.title.trim(),
      handle: form.handle.trim() || suggestedHandle,
      descriptionHtml: form.descriptionHtml.trim() || undefined,
      imageUrl: form.imageUrl.trim() || undefined,
      parentId: form.parentId || null,
      type: form.type || 'MANUAL',
      rules: buildRulesPayload(form),
      productIds: selectedProductIds,
    };

    try {
      if (isNew) {
        await adminCreateCollection(token, payload);
      } else {
        await adminUpdateCollection(token, id, payload);
      }
      navigate('/admin/collections');
    } catch (err) {
      const message = err?.message || 'Unable to save collection.';
      if (err?.status === 409 && /handle/i.test(message)) {
        const fallback = buildSuggestedHandle({
          title: form.title,
          parentId: form.parentId,
          collections,
        });
        setError(
          fallback
            ? `Collection handle already exists. Try "${fallback}" or set a custom unique handle.`
            : 'Collection handle already exists. Set a custom unique handle.',
        );
      } else {
        setError(message);
      }
    } finally {
      setSaving(false);
    }
  };

  const parentOptions = collections.filter((collection) => collection.id !== id);
  const visibleProductIds = filteredProducts.map((product) => product.id).filter(Boolean);
  const allVisibleSelected =
    visibleProductIds.length > 0 && visibleProductIds.every((productId) => selectedProductIds.includes(productId));
  const getProductPreviewImage = (product) => {
    if (!product) return '';
    if (Array.isArray(product.media)) {
      const image =
        product.media.find((item) => item?.type === 'IMAGE' && item?.url) ||
        product.media.find((item) => item?.url);
      if (image?.url) return image.url;
    }
    if (product.featuredImage?.url) return product.featuredImage.url;
    if (product.image?.url) return product.image.url;
    if (typeof product.imageUrl === 'string') return product.imageUrl;
    return '';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            {isNew ? 'Create Collection' : 'Edit Collection'}
          </p>
          <h2 className="text-2xl font-bold text-white">
            {isNew ? 'Build a new collection' : form.title || 'Collection detail'}
          </h2>
        </div>
        <Link
          to="/admin/collections"
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 transition"
        >
          Back to collections
        </Link>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(event) => handleFieldChange('title', event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:border-emerald-400 focus:outline-none"
                placeholder="Collection title"
                required
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Handle</label>
              <input
                type="text"
                value={form.handle}
                onChange={(event) => {
                  const value = event.target.value;
                  handleFieldChange('handle', value);
                  setHandleTouched(value.trim().length > 0);
                }}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:border-emerald-400 focus:outline-none"
                placeholder="auto-generated from parent + title if left blank"
              />
              <p className="mt-1 text-[10px] text-slate-500">
                Sub-collections auto-use parent handle prefix so each handle stays unique.
              </p>
            </div>

            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Parent</label>
              <select
                value={form.parentId}
                onChange={(event) => handleFieldChange('parentId', event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:border-emerald-400 focus:outline-none"
              >
                <option value="">No parent (top-level collection)</option>
                {parentOptions
                  .filter((c) => !c.parentId)
                  .map((collection) => (
                    <option key={collection.id} value={collection.id}>
                      {collection.title}
                    </option>
                  ))}
              </select>
              <p className="mt-1 text-[10px] text-slate-500">
                Set a parent to make this a sub-collection (e.g. "Fair Skin" under "Skin Tone").
              </p>
            </div>

            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Type</label>
              <select
                value={form.type}
                onChange={(event) => handleFieldChange('type', event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:border-emerald-400 focus:outline-none"
              >
                <option value="MANUAL">Manual</option>
                <option value="AUTOMATED">Automated</option>
              </select>
            </div>

            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Image URL</label>
              <input
                type="text"
                value={form.imageUrl}
                onChange={(event) => handleFieldChange('imageUrl', event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:border-emerald-400 focus:outline-none"
                placeholder="https://"
              />
            </div>

            {/* Show sub-collections when editing a parent */}
            {!isNew && (() => {
              const children = collections.filter((c) => c.parentId === id);
              if (!children.length) return null;
              return (
                <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3 space-y-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Sub-Collections ({children.length})
                  </p>
                  <div className="space-y-1">
                    {children.map((child) => (
                      <Link
                        key={child.id}
                        to={`/admin/collections/${child.id}`}
                        className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition"
                      >
                        <span className="text-slate-600 text-xs">└─</span>
                        {child.title}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Description</label>
              <textarea
                value={form.descriptionHtml}
                onChange={(event) => handleFieldChange('descriptionHtml', event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:border-emerald-400 focus:outline-none min-h-[160px]"
                placeholder="Collection description"
              />
            </div>

            <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Storefront Flow</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Control where this collection appears in Skin Tone + Occasion browsing.
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={form.flowEnabled}
                    onChange={(event) => handleFieldChange('flowEnabled', event.target.checked)}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-emerald-400 focus:ring-emerald-400"
                  />
                  Enable
                </label>
              </div>

              {form.flowEnabled ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400 mb-2">Skintones</p>
                    <div className="flex flex-wrap gap-2">
                      {SKINTONE_OPTIONS.map((option) => {
                        const checked = form.flowSkintones.includes(option.value);
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => toggleChoice('flowSkintones', option.value)}
                            className={`rounded-full border px-3 py-1 text-xs transition ${
                              checked
                                ? 'border-emerald-400 bg-emerald-400/10 text-emerald-300'
                                : 'border-slate-700 text-slate-300 hover:border-slate-500'
                            }`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400 mb-2">Occasions</p>
                    <div className="flex flex-wrap gap-2">
                      {OCCASION_OPTIONS.map((option) => {
                        const checked = form.flowOccasions.includes(option.value);
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => toggleChoice('flowOccasions', option.value)}
                            className={`rounded-full border px-3 py-1 text-xs transition ${
                              checked
                                ? 'border-emerald-400 bg-emerald-400/10 text-emerald-300'
                                : 'border-slate-700 text-slate-300 hover:border-slate-500'
                            }`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Collection Products</p>
              <p className="text-xs text-slate-500 mt-1">
                Select products to include in this collection.
              </p>
            </div>
            <span className="text-xs text-emerald-300">{selectedProductIds.length} selected</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={productSearch}
              onChange={(event) => setProductSearch(event.target.value)}
              placeholder="Search products by title, handle, vendor..."
              className="min-w-[240px] flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={() =>
                setSelectedProductIds((prev) =>
                  Array.from(new Set([...prev, ...visibleProductIds])),
                )
              }
              className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
            >
              Select Visible
            </button>
            <button
              type="button"
              onClick={() => setSelectedProductIds((prev) => prev.filter((idValue) => !visibleProductIds.includes(idValue)))}
              className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
            >
              Unselect Visible
            </button>
            <button
              type="button"
              onClick={() => setSelectedProductIds([])}
              className="rounded-lg border border-rose-500/40 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/10"
            >
              Clear All
            </button>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950 max-h-80 overflow-y-auto">
            {productsLoading ? (
              <div className="px-4 py-8 text-center text-xs text-slate-400">Loading products...</div>
            ) : filteredProducts.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-slate-400">No products found.</div>
            ) : (
              <div className="divide-y divide-slate-800">
                {filteredProducts.map((product) => {
                  const selected = selectedProductIds.includes(product.id);
                  const previewImage = getProductPreviewImage(product);
                  return (
                    <label
                      key={product.id}
                      className={`w-full text-left px-4 py-3 flex items-center gap-3 transition ${
                        selected ? 'bg-emerald-500/10' : 'hover:bg-slate-900'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleProductSelection(product.id)}
                        className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-emerald-400 focus:ring-emerald-400"
                      />
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
                        {previewImage ? (
                          <img
                            src={previewImage}
                            alt={product.title || 'Product image'}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-500">
                            No Img
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">{product.title || 'Untitled product'}</p>
                        <p className="text-xs text-slate-400 truncate">{product.handle || 'no-handle'}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {!allVisibleSelected && visibleProductIds.length > 0 ? (
            <p className="text-[11px] text-slate-500">
              Showing {visibleProductIds.length} products from your catalog.
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/admin/collections')}
            className="rounded-lg border border-slate-700 px-5 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || loading}
            className="rounded-lg bg-emerald-400 px-6 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-300 transition disabled:opacity-60"
          >
            {saving ? 'Saving...' : isNew ? 'Create Collection' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminCollectionForm;
