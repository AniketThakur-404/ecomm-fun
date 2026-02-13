import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  adminCreateProduct,
  adminUpdateProduct,
  adminFetchCollections,
  fetchProductRaw,
  uploadImage,
} from '../../lib/api';
import { useAdminAuth } from '../../contexts/admin-auth-context';
import ProductPicker from '../../components/admin/ProductPicker';

const slugify = (value) =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const normalizeStringArray = (value) => {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const parseHandleList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  const raw = String(value).trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean);
    }
  } catch { }
  return normalizeStringArray(raw.replace(/\|/g, ','));
};

const formatHandleList = (value) => {
  if (!value) return '';
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean).join(', ');
  }
  const raw = String(value).trim();
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean).join(', ');
    }
  } catch { }
  return raw;
};

const buildOptionList = (options) =>
  options
    .map((option) => ({
      name: option.name.trim(),
      values: option.values
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    }))
    .filter((option) => option.name && option.values.length);

const cartesian = (arrays) =>
  arrays.reduce(
    (acc, list) => acc.flatMap((prev) => list.map((value) => [...prev, value])),
    [[]],
  );

const AdminProductForm = () => {
  const { id } = useParams();
  const isNew = id === 'new';
  const { token } = useAdminAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [collections, setCollections] = useState([]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [bundleProducts, setBundleProducts] = useState([]); // Stores full product objects for UI
  const [form, setForm] = useState({
    title: '',
    handle: '',
    status: 'DRAFT',
    vendor: '',
    productType: '',
    apparelType: '',
    category: '',
    descriptionHtml: '',
    tags: '',
    collectionIds: [],
    media: [],
    options: [],
    variants: [],
    metafields: [],
    comboItems: '',
  });

  const optionList = useMemo(() => buildOptionList(form.options), [form.options]);
  useEffect(() => {
    if (!token) return;
    adminFetchCollections(token, { limit: 200 })
      .then((items) => setCollections(Array.isArray(items) ? items : []))
      .catch(() => setCollections([]));
  }, [token]);

  useEffect(() => {
    if (isNew || !id) return;
    setLoading(true);
    fetchProductRaw(id)
      .then((product) => {
        if (!product) return;
        const rawMetafields = Array.isArray(product.metafields) ? product.metafields : [];
        const comboFields = rawMetafields.filter(
          (field) =>
            field?.namespace === 'custom' &&
            (field?.key === 'combo_items' || field?.key === 'bundle_items'),
        );
        const comboValues = comboFields.flatMap((field) => parseHandleList(field?.value));
        const filteredMetafields = rawMetafields.filter(
          (field) =>
            !(
              field?.namespace === 'custom' &&
              (field?.key === 'combo_items' || field?.key === 'bundle_items')
            ),
        );
        setForm({
          title: product.title || '',
          handle: product.handle || '',
          status: product.status || 'DRAFT',
          vendor: product.vendor || '',
          productType: product.productType || '',
          apparelType: product.apparelType || '',
          category: product.category || '',
          descriptionHtml: product.descriptionHtml || '',
          tags: Array.isArray(product.tags) ? product.tags.join(', ') : '',
          collectionIds: Array.isArray(product.collections)
            ? product.collections.map((collection) => collection.id)
            : [],
          media: Array.isArray(product.media)
            ? product.media.map((media) => ({
              url: media.url,
              alt: media.alt || '',
              type: media.type || 'IMAGE',
            }))
            : [],
          options: Array.isArray(product.options)
            ? product.options.map((option) => ({
              name: option.name || '',
              values: Array.isArray(option.values) ? option.values.join(', ') : '',
            }))
            : [],
          variants: Array.isArray(product.variants)
            ? product.variants.map((variant) => ({
              id: variant.id,
              optionValues: variant.optionValues || {},
              sku: variant.sku || '',
              price: variant.price ?? '',
              compareAtPrice: variant.compareAtPrice ?? '',
              inventory: Array.isArray(variant.inventoryLevels)
                ? variant.inventoryLevels.reduce(
                  (sum, level) => sum + (Number(level.available) || 0),
                  0,
                )
                : 0,
              barcode: variant.barcode || '',
              trackInventory: variant.trackInventory ?? true,
              taxable: variant.taxable ?? true,
              inventoryPolicy: variant.inventoryPolicy || 'DENY',
            }))
            : [],
          metafields: Array.isArray(filteredMetafields)
            ? filteredMetafields.map((field) => ({
              set: field.set || 'PRODUCT',
              namespace: field.namespace || '',
              key: field.key || '',
              type: field.type || 'single_line_text_field',
              value: typeof field.value === 'string' ? field.value : JSON.stringify(field.value),
            }))
            : [],
          comboItems: formatHandleList(comboValues),
        });
      })
      .catch((err) => setError(err?.message || 'Unable to load product.'))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  // Load bundle product details when form.comboItems changes (initial load)
  useEffect(() => {
    if (!form.comboItems || !token) {
      if (!form.comboItems) setBundleProducts([]);
      return;
    }
    const handles = parseHandleList(form.comboItems);
    // Avoid re-fetching if we already have these exact products
    const currentHandles = bundleProducts.map((p) => p.handle).sort().join(',');
    const newHandles = handles.sort().join(',');
    if (currentHandles === newHandles) return;

    adminFetchProducts(token, { handles: handles.join(','), include: 'compact' })
      .then((payload) => {
        const items = payload?.data ?? payload ?? [];
        setBundleProducts(items);
      })
      .catch((err) => console.error('Failed to load bundle details:', err));
  }, [form.comboItems, token]);

  const handlePickerSelect = (selectedHandles) => {
    // 1. Update form value (comma-separated string)
    const newValue = selectedHandles.join(', ');
    handleFieldChange('comboItems', newValue);

    // 2. Fetch details for any NEW handles we don't have yet
    // (Existing ones we can keep to avoid flicker, or just re-fetch all for simplicity)
    // For simplicity and correctness, let the useEffect above handle the fetching
    // based on the updated form value.
  };

  const handleRemoveBundleItem = (handleToRemove) => {
    const currentHandles = parseHandleList(form.comboItems);
    const newHandles = currentHandles.filter((h) => h !== handleToRemove);
    handleFieldChange('comboItems', newHandles.join(', '));
  };

  const handleFieldChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddImage = () => {
    if (!newImageUrl.trim()) return;
    setForm((prev) => ({
      ...prev,
      media: [...prev.media, { url: newImageUrl.trim(), alt: '', type: 'IMAGE' }],
    }));
    setNewImageUrl('');
  };

  const handleRemoveImage = (index) => {
    setForm((prev) => ({
      ...prev,
      media: prev.media.filter((_, idx) => idx !== index),
    }));
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const result = await uploadImage(token, file);
      if (result?.url) {
        setForm((prev) => ({
          ...prev,
          media: [...prev.media, { url: result.url, alt: '', type: 'IMAGE' }],
        }));
      }
    } catch (err) {
      setError(err?.message || 'Image upload failed.');
    }
  };
  const addOption = () => {
    setForm((prev) => ({
      ...prev,
      options: [...prev.options, { name: '', values: '' }],
    }));
  };

  const updateOption = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((option, idx) =>
        idx === index ? { ...option, [field]: value } : option,
      ),
    }));
  };

  const removeOption = (index) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options.filter((_, idx) => idx !== index),
    }));
  };

  const addPresetOption = (name, values) => {
    setForm((prev) => {
      const index = prev.options.findIndex(
        (option) => option.name.toLowerCase() === name.toLowerCase(),
      );
      if (index === -1) {
        return {
          ...prev,
          options: [...prev.options, { name, values }],
        };
      }
      const existingValues = normalizeStringArray(prev.options[index].values || '');
      const merged = Array.from(new Set([...existingValues, ...normalizeStringArray(values)])).join(', ');
      return {
        ...prev,
        options: prev.options.map((option, idx) =>
          idx === index ? { ...option, values: merged } : option,
        ),
      };
    });
  };

  const generateVariants = () => {
    if (!optionList.length) {
      setError('Add at least one option with values to generate variants.');
      return;
    }
    const names = optionList.map((option) => option.name);
    const combos = cartesian(optionList.map((option) => option.values));
    const existing = new Map(
      form.variants.map((variant) => [
        names.map((name) => variant.optionValues?.[name] || '').join('|'),
        variant,
      ]),
    );

    const nextVariants = combos.map((combo) => {
      const optionValues = {};
      names.forEach((name, index) => {
        optionValues[name] = combo[index];
      });
      const key = combo.join('|');
      const prev = existing.get(key);
      return (
        prev || {
          optionValues,
          sku: '',
          price: '',
          compareAtPrice: '',
          inventory: 0,
          barcode: '',
          trackInventory: true,
          taxable: true,
          inventoryPolicy: 'DENY',
        }
      );
    });

    setForm((prev) => ({ ...prev, variants: nextVariants }));
  };

  const addVariant = () => {
    setForm((prev) => ({
      ...prev,
      variants: [
        ...prev.variants,
        {
          optionValues: {},
          sku: '',
          price: '',
          compareAtPrice: '',
          inventory: 0,
          barcode: '',
          trackInventory: true,
          taxable: true,
          inventoryPolicy: 'DENY',
        },
      ],
    }));
  };

  const updateVariant = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((variant, idx) =>
        idx === index ? { ...variant, [field]: value } : variant,
      ),
    }));
  };

  const updateVariantOption = (index, name, value) => {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((variant, idx) => {
        if (idx !== index) return variant;
        return {
          ...variant,
          optionValues: { ...(variant.optionValues || {}), [name]: value },
        };
      }),
    }));
  };

  const removeVariant = (index) => {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, idx) => idx !== index),
    }));
  };

  const addMetafield = () => {
    setForm((prev) => ({
      ...prev,
      metafields: [
        ...prev.metafields,
        { set: 'PRODUCT', namespace: '', key: '', type: 'single_line_text_field', value: '' },
      ],
    }));
  };

  const updateMetafield = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      metafields: prev.metafields.map((meta, idx) =>
        idx === index ? { ...meta, [field]: value } : meta,
      ),
    }));
  };

  const removeMetafield = (index) => {
    setForm((prev) => ({
      ...prev,
      metafields: prev.metafields.filter((_, idx) => idx !== index),
    }));
  };
  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSaving(true);

    let metafields = form.metafields
      .filter((meta) => meta.namespace.trim() && meta.key.trim())
      .map((meta) => {
        let value = meta.value;
        if (typeof value === 'string') {
          const trimmed = value.trim();
          if (
            (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
            (trimmed.startsWith('[') && trimmed.endsWith(']'))
          ) {
            try {
              value = JSON.parse(trimmed);
            } catch {
              value = trimmed;
            }
          } else {
            value = trimmed;
          }
        }
        return {
          set: meta.set || 'PRODUCT',
          namespace: meta.namespace.trim(),
          key: meta.key.trim(),
          type: meta.type.trim() || 'single_line_text_field',
          value,
        };
      });

    metafields = metafields.filter(
      (field) =>
        !(
          field.namespace === 'custom' &&
          (field.key === 'combo_items' || field.key === 'bundle_items')
        ),
    );

    const comboHandles = parseHandleList(form.comboItems);
    if (comboHandles.length) {
      ['combo_items', 'bundle_items'].forEach((key) => {
        metafields.push({
          set: 'PRODUCT',
          namespace: 'custom',
          key,
          type: 'list.single_line_text_field',
          value: comboHandles,
        });
      });
    }

    const payload = {
      title: form.title.trim(),
      handle: form.handle.trim() || slugify(form.title),
      status: form.status,
      vendor: form.vendor.trim() || undefined,
      productType: form.productType.trim() || undefined,
      apparelType: form.apparelType || undefined,
      category: form.category.trim() || undefined,
      descriptionHtml: form.descriptionHtml.trim() || undefined,
      tags: normalizeStringArray(form.tags),
      collections: form.collectionIds,
      media: form.media.map((media) => ({
        url: media.url,
        alt: media.alt || undefined,
        type: media.type || 'IMAGE',
      })),
      options: form.options.length ? optionList : [],
      variants: form.variants.map((variant) => ({
        optionValues: variant.optionValues || undefined,
        sku: variant.sku.trim() || undefined,
        price: variant.price === '' ? undefined : Number(variant.price),
        compareAtPrice:
          variant.compareAtPrice === '' ? undefined : Number(variant.compareAtPrice),
        barcode: variant.barcode.trim() || undefined,
        taxable: variant.taxable,
        trackInventory: variant.trackInventory,
        inventoryPolicy: variant.inventoryPolicy || 'DENY',
        inventory: {
          available: Number(variant.inventory) || 0,
        },
      })),
      metafields,
    };

    try {
      if (isNew) {
        await adminCreateProduct(token, payload);
      } else {
        await adminUpdateProduct(token, id, payload);
      }
      navigate('/admin/products');
    } catch (err) {
      setError(err?.message || 'Unable to save product.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            {isNew ? 'Create Product' : 'Edit Product'}
          </p>
          <h2 className="text-2xl font-bold text-white">
            {isNew ? 'Build a new listing' : form.title || 'Product detail'}
          </h2>
        </div>
        <Link
          to="/admin/products"
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 transition"
        >
          Back to products
        </Link>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(event) => handleFieldChange('title', event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:border-emerald-400 focus:outline-none"
                placeholder="Product title"
                required
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Handle</label>
              <input
                type="text"
                value={form.handle}
                onChange={(event) => handleFieldChange('handle', event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:border-emerald-400 focus:outline-none"
                placeholder="auto-generated if left blank"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Status</label>
                <select
                  value={form.status}
                  onChange={(event) => handleFieldChange('status', event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:border-emerald-400 focus:outline-none"
                >
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE">Active</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Vendor</label>
                <input
                  type="text"
                  value={form.vendor}
                  onChange={(event) => handleFieldChange('vendor', event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:border-emerald-400 focus:outline-none"
                  placeholder="Brand / vendor"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Product Type</label>
                <input
                  type="text"
                  value={form.productType}
                  onChange={(event) => handleFieldChange('productType', event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:border-emerald-400 focus:outline-none"
                  placeholder="T-shirt, Jeans, Sneakers"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Apparel Type</label>
                <select
                  value={form.apparelType}
                  onChange={(event) => handleFieldChange('apparelType', event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:border-emerald-400 focus:outline-none"
                >
                  <option value="">Select</option>
                  <option value="TOP">Top</option>
                  <option value="BOTTOM">Bottom</option>
                  <option value="SHOES">Shoes</option>
                  <option value="ACCESSORY">Accessory</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Category</label>
              <input
                type="text"
                value={form.category}
                onChange={(event) => handleFieldChange('category', event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:border-emerald-400 focus:outline-none"
                placeholder="Optional taxonomy path"
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Tags</label>
              <input
                type="text"
                value={form.tags}
                onChange={(event) => handleFieldChange('tags', event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:border-emerald-400 focus:outline-none"
                placeholder="comma-separated"
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Collections</label>
              <select
                multiple
                value={form.collectionIds}
                onChange={(event) =>
                  handleFieldChange(
                    'collectionIds',
                    Array.from(event.target.selectedOptions).map((option) => option.value),
                  )
                }
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:border-emerald-400 focus:outline-none"
              >
                {collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">Bundle / Combo Items</p>
                  <p className="text-xs text-slate-400">
                    Select products to display as a bundle with this item.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPicker(true)}
                  className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20"
                >
                  Browse Products
                </button>
              </div>

              {/* Visual List of Selected Bundle Items */}
              <div className="space-y-2">
                {bundleProducts.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No bundle items selected.</p>
                ) : (
                  bundleProducts.map((prod) => (
                    <div
                      key={prod.handle}
                      className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950 p-2"
                    >
                      <div className="h-8 w-8 shrink-0 overflow-hidden rounded bg-slate-800">
                        {prod.media?.[0]?.url ? (
                          <img
                            src={prod.media[0].url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-500">
                            Img
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-xs font-medium text-slate-200">
                          {prod.title}
                        </p>
                        <p className="truncate text-[10px] text-slate-500">{prod.handle}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveBundleItem(prod.handle)}
                        className="p-1 text-slate-500 hover:text-rose-400"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Hidden input to maintain compatibility with existing submit logic */}
              <input type="hidden" name="comboItems" value={form.comboItems} />
            </div>
          </div>

          {/* Product Picker Modal */}
          <ProductPicker
            isOpen={showPicker}
            onClose={() => setShowPicker(false)}
            selectedHandles={bundleProducts.map((p) => p.handle)}
            onSelect={handlePickerSelect}
          />

          <div className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Description</label>
              <textarea
                value={form.descriptionHtml}
                onChange={(event) => handleFieldChange('descriptionHtml', event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:border-emerald-400 focus:outline-none min-h-[140px]"
                placeholder="Product description"
              />
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">Media</p>
                <label className="text-xs text-emerald-300 cursor-pointer">
                  Upload
                  <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
                </label>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newImageUrl}
                  onChange={(event) => setNewImageUrl(event.target.value)}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-400 focus:outline-none"
                  placeholder="Paste image URL"
                />
                <button
                  type="button"
                  onClick={handleAddImage}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                >
                  Add
                </button>
              </div>
              <div className="grid gap-2">
                {form.media.map((media, index) => (
                  <div key={`${media.url}-${index}`} className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-slate-800 overflow-hidden">
                      {media.url ? (
                        <img src={media.url} alt="Product" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <p className="flex-1 text-xs text-slate-300 truncate">{media.url}</p>
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      className="text-xs text-rose-300 hover:text-rose-200"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {form.media.length === 0 ? (
                  <p className="text-xs text-slate-500">No media added yet.</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Options</p>
              <p className="text-xs text-slate-400">Define size, color, or other variant options.</p>
            </div>
            <button
              type="button"
              onClick={addOption}
              className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
            >
              Add option
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => addPresetOption('Size', 'XS, S, M, L, XL')}
              className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
            >
              Add Size Option
            </button>
            <button
              type="button"
              onClick={() => addPresetOption('Color', 'Black, Brown, Navy')}
              className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
            >
              Add Color Option
            </button>
          </div>
          {form.options.length === 0 ? (
            <p className="text-xs text-slate-500">No options yet.</p>
          ) : (
            <div className="space-y-3">
              {form.options.map((option, index) => (
                <div key={`option-${index}`} className="grid gap-2 md:grid-cols-5">
                  <input
                    type="text"
                    value={option.name}
                    onChange={(event) => updateOption(index, 'name', event.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-400 focus:outline-none"
                    placeholder="Option name"
                  />
                  <input
                    type="text"
                    value={option.values}
                    onChange={(event) => updateOption(index, 'values', event.target.value)}
                    className="md:col-span-3 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-400 focus:outline-none"
                    placeholder="Values (comma-separated)"
                  />
                  <button
                    type="button"
                    onClick={() => removeOption(index)}
                    className="rounded-lg border border-rose-500/40 px-3 py-2 text-xs text-rose-200 hover:bg-rose-500/10"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={generateVariants}
              className="rounded-lg bg-emerald-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-300 transition"
            >
              Generate variants
            </button>
            <button
              type="button"
              onClick={addVariant}
              className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition"
            >
              Add custom variant
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Variants</p>
              <p className="text-xs text-slate-400">Prices, SKUs, and inventory per variant.</p>
            </div>
          </div>
          {form.variants.length === 0 ? (
            <p className="text-xs text-slate-500">No variants yet.</p>
          ) : (
            <div className="space-y-4">
              {form.variants.map((variant, index) => (
                <div key={`variant-${index}`} className="rounded-xl border border-slate-800 p-4 space-y-3">
                  {optionList.length ? (
                    <div className="grid gap-2 md:grid-cols-3">
                      {optionList.map((option) => (
                        <input
                          key={`${option.name}-${index}`}
                          type="text"
                          value={variant.optionValues?.[option.name] || ''}
                          onChange={(event) =>
                            updateVariantOption(index, option.name, event.target.value)
                          }
                          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-400 focus:outline-none"
                          placeholder={option.name}
                        />
                      ))}
                    </div>
                  ) : null}
                  <div className="grid gap-2 md:grid-cols-5">
                    <input
                      type="text"
                      value={variant.sku}
                      onChange={(event) => updateVariant(index, 'sku', event.target.value)}
                      className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-400 focus:outline-none"
                      placeholder="SKU"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={variant.price}
                      onChange={(event) => updateVariant(index, 'price', event.target.value)}
                      className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-400 focus:outline-none"
                      placeholder="Price"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={variant.compareAtPrice}
                      onChange={(event) => updateVariant(index, 'compareAtPrice', event.target.value)}
                      className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-400 focus:outline-none"
                      placeholder="Compare at"
                    />
                    <input
                      type="number"
                      value={variant.inventory}
                      onChange={(event) => updateVariant(index, 'inventory', event.target.value)}
                      className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-400 focus:outline-none"
                      placeholder="Inventory"
                    />
                    <input
                      type="text"
                      value={variant.barcode}
                      onChange={(event) => updateVariant(index, 'barcode', event.target.value)}
                      className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-400 focus:outline-none"
                      placeholder="Barcode"
                    />
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-slate-300">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={variant.taxable}
                        onChange={(event) => updateVariant(index, 'taxable', event.target.checked)}
                      />
                      Taxable
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={variant.trackInventory}
                        onChange={(event) =>
                          updateVariant(index, 'trackInventory', event.target.checked)
                        }
                      />
                      Track inventory
                    </label>
                    <label className="flex items-center gap-2">
                      <select
                        value={variant.inventoryPolicy}
                        onChange={(event) =>
                          updateVariant(index, 'inventoryPolicy', event.target.value)
                        }
                        className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                      >
                        <option value="DENY">Deny oversell</option>
                        <option value="CONTINUE">Continue selling</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => removeVariant(index)}
                      className="text-xs text-rose-300 hover:text-rose-200"
                    >
                      Remove variant
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Metafields</p>
              <p className="text-xs text-slate-400">Add size charts, materials, or custom data.</p>
            </div>
            <button
              type="button"
              onClick={addMetafield}
              className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
            >
              Add metafield
            </button>
          </div>
          {form.metafields.length === 0 ? (
            <p className="text-xs text-slate-500">No metafields yet.</p>
          ) : (
            <div className="space-y-3">
              {form.metafields.map((meta, index) => (
                <div key={`meta-${index}`} className="grid gap-2 md:grid-cols-6">
                  <select
                    value={meta.set}
                    onChange={(event) => updateMetafield(index, 'set', event.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  >
                    <option value="PRODUCT">Product</option>
                    <option value="CATEGORY">Category</option>
                  </select>
                  <input
                    type="text"
                    value={meta.namespace}
                    onChange={(event) => updateMetafield(index, 'namespace', event.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-400 focus:outline-none"
                    placeholder="namespace"
                  />
                  <input
                    type="text"
                    value={meta.key}
                    onChange={(event) => updateMetafield(index, 'key', event.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-400 focus:outline-none"
                    placeholder="key"
                  />
                  <input
                    type="text"
                    value={meta.type}
                    onChange={(event) => updateMetafield(index, 'type', event.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-400 focus:outline-none"
                    placeholder="type"
                  />
                  <input
                    type="text"
                    value={meta.value}
                    onChange={(event) => updateMetafield(index, 'value', event.target.value)}
                    className="md:col-span-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-400 focus:outline-none"
                    placeholder="value"
                  />
                  <button
                    type="button"
                    onClick={() => removeMetafield(index)}
                    className="rounded-lg border border-rose-500/40 px-3 py-2 text-xs text-rose-200 hover:bg-rose-500/10"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/admin/products')}
            className="rounded-lg border border-slate-700 px-5 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || loading}
            className="rounded-lg bg-emerald-400 px-6 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-300 transition disabled:opacity-60"
          >
            {saving ? 'Saving...' : isNew ? 'Create Product' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminProductForm;
