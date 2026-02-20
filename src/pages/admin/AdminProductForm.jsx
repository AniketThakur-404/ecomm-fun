import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  adminCreateProduct,
  adminUpdateProduct,
  adminFetchCollections,
  adminFetchProducts,
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
  } catch {
    // fall through to comma-separated parsing
  }
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
  } catch {
    // fall through to plain text formatting
  }
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

const RESERVED_CUSTOM_METAFIELD_KEYS = new Set([
  'combo_items',
  'bundle_items',
  'size_chart_image',
  'size_chart_text',
]);

const normalizeToken = (value) => String(value || '').trim().toLowerCase();

const isCustomMetafield = (field, keys) => {
  if (!field) return false;
  if (normalizeToken(field.namespace) !== 'custom') return false;
  return keys.includes(normalizeToken(field.key));
};

const readCustomMetafield = (fields, keys) => {
  const entry = (Array.isArray(fields) ? fields : []).find((field) =>
    isCustomMetafield(field, keys),
  );
  if (!entry) return '';
  if (typeof entry.value === 'string') return entry.value;
  if (entry.value === null || entry.value === undefined) return '';
  try {
    return JSON.stringify(entry.value);
  } catch {
    return String(entry.value);
  }
};

const createUploadId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const AdminProductForm = () => {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const { token } = useAdminAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [collections, setCollections] = useState([]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [pendingUploads, setPendingUploads] = useState([]);
  const [sizeChartUploading, setSizeChartUploading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [bundleProducts, setBundleProducts] = useState([]); // Stores full product objects for UI
  const pendingUploadUrlsRef = useRef(new Map());
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
    sizeChartImageUrl: '',
    sizeChartText: '',
  });

  const optionList = useMemo(() => buildOptionList(form.options), [form.options]);
  const sizeValues = useMemo(() => {
    const sizeOption = form.options.find(
      (option) => normalizeToken(option?.name) === 'size',
    );
    return sizeOption?.values || '';
  }, [form.options]);
  const bundleHandleSignature = useMemo(
    () => bundleProducts.map((item) => item.handle).sort().join(','),
    [bundleProducts],
  );

  useEffect(
    () => () => {
      pendingUploadUrlsRef.current.forEach((previewUrl) => {
        if (previewUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(previewUrl);
        }
      });
      pendingUploadUrlsRef.current.clear();
    },
    [],
  );

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
        const comboFields = rawMetafields.filter((field) =>
          isCustomMetafield(field, ['combo_items', 'bundle_items']),
        );
        const comboValues = comboFields.flatMap((field) => parseHandleList(field?.value));
        const sizeChartImageUrl = readCustomMetafield(rawMetafields, ['size_chart_image']);
        const sizeChartText = readCustomMetafield(rawMetafields, ['size_chart_text']);
        const filteredMetafields = rawMetafields.filter(
          (field) =>
            !(
              normalizeToken(field?.namespace) === 'custom' &&
              RESERVED_CUSTOM_METAFIELD_KEYS.has(normalizeToken(field?.key))
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
          sizeChartImageUrl,
          sizeChartText,
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
    const newHandles = [...handles].sort().join(',');
    if (bundleHandleSignature === newHandles) return;

    adminFetchProducts(token, { handles: handles.join(','), include: 'compact' })
      .then((payload) => {
        const items = payload?.data ?? payload ?? [];
        setBundleProducts(items);
      })
      .catch((err) => console.error('Failed to load bundle details:', err));
  }, [bundleHandleSignature, form.comboItems, token]);

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

  const handleSizeValuesChange = (value) => {
    setForm((prev) => {
      const index = prev.options.findIndex(
        (option) => normalizeToken(option?.name) === 'size',
      );
      if (index === -1) {
        if (!value.trim()) return prev;
        return {
          ...prev,
          options: [...prev.options, { name: 'Size', values: value }],
        };
      }

      return {
        ...prev,
        options: prev.options.map((option, idx) =>
          idx === index ? { ...option, name: 'Size', values: value } : option,
        ),
      };
    });
  };

  const addMediaByUrl = (url, alt = '') => {
    const trimmedUrl = String(url || '').trim();
    if (!trimmedUrl) return;
    setForm((prev) => {
      if (prev.media.some((item) => item.url === trimmedUrl)) return prev;
      return {
        ...prev,
        media: [...prev.media, { url: trimmedUrl, alt, type: 'IMAGE' }],
      };
    });
  };

  const handleAddImage = () => {
    if (!newImageUrl.trim()) return;
    addMediaByUrl(newImageUrl, '');
    setNewImageUrl('');
  };

  const handleRemoveImage = (index) => {
    setForm((prev) => ({
      ...prev,
      media: prev.media.filter((_, idx) => idx !== index),
    }));
  };

  const removePendingUpload = (uploadId) => {
    setPendingUploads((prev) => prev.filter((item) => item.id !== uploadId));
    const previewUrl = pendingUploadUrlsRef.current.get(uploadId);
    if (previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    pendingUploadUrlsRef.current.delete(uploadId);
  };

  const uploadQueuedMediaFile = async (uploadItem) => {
    if (!uploadItem?.file) return;
    setPendingUploads((prev) =>
      prev.map((item) =>
        item.id === uploadItem.id
          ? { ...item, status: 'uploading', error: '' }
          : item,
      ),
    );
    try {
      const result = await uploadImage(token, uploadItem.file);
      if (!result?.url) {
        throw new Error('Upload finished but no image URL was returned.');
      }
      addMediaByUrl(result.url, '');
      removePendingUpload(uploadItem.id);
    } catch (err) {
      setPendingUploads((prev) =>
        prev.map((item) =>
          item.id === uploadItem.id
            ? { ...item, status: 'failed', error: err?.message || 'Upload failed.' }
            : item,
        ),
      );
    }
  };

  const handleUpload = async (event) => {
    const files = Array.from(event.target.files || []).filter(Boolean);
    event.target.value = '';
    if (!files.length) return;
    if (!token) {
      setError('Admin session expired. Please log in again.');
      return;
    }

    const queuedItems = files.map((file) => {
      const id = createUploadId();
      const previewUrl = URL.createObjectURL(file);
      pendingUploadUrlsRef.current.set(id, previewUrl);
      return {
        id,
        file,
        name: file.name,
        previewUrl,
        status: 'uploading',
        error: '',
      };
    });

    setPendingUploads((prev) => [...queuedItems, ...prev]);
    await Promise.all(queuedItems.map((item) => uploadQueuedMediaFile(item)));
  };

  const retryUpload = async (uploadId) => {
    const target = pendingUploads.find((item) => item.id === uploadId);
    if (!target) return;
    await uploadQueuedMediaFile(target);
  };

  const handleSizeChartUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!token) {
      setError('Admin session expired. Please log in again.');
      return;
    }

    setSizeChartUploading(true);
    try {
      const result = await uploadImage(token, file);
      if (!result?.url) {
        throw new Error('Upload finished but no image URL was returned.');
      }
      handleFieldChange('sizeChartImageUrl', result.url);
    } catch (err) {
      setError(err?.message || 'Size chart upload failed.');
    } finally {
      setSizeChartUploading(false);
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

    const hasUploadingItems = pendingUploads.some(
      (item) => item.status === 'uploading',
    );
    if (hasUploadingItems) {
      setError('Please wait for image uploads to finish before saving.');
      setSaving(false);
      return;
    }

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
          normalizeToken(field.namespace) === 'custom' &&
          RESERVED_CUSTOM_METAFIELD_KEYS.has(normalizeToken(field.key))
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

    const sizeChartImageUrl = form.sizeChartImageUrl.trim();
    if (sizeChartImageUrl) {
      metafields.push({
        set: 'PRODUCT',
        namespace: 'custom',
        key: 'size_chart_image',
        type: 'single_line_text_field',
        value: sizeChartImageUrl,
      });
    }

    const sizeChartText = form.sizeChartText.trim();
    if (sizeChartText) {
      metafields.push({
        set: 'PRODUCT',
        namespace: 'custom',
        key: 'size_chart_text',
        type: 'multi_line_text_field',
        value: sizeChartText,
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
      media: form.media
        .filter((media) => String(media?.url || '').trim())
        .map((media) => ({
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
              {collections.length > 0 ? (
                <div className="mt-2 rounded-lg border border-slate-700 bg-slate-950 overflow-hidden">
                  {/* Search filter */}
                  <div className="border-b border-slate-800 px-3 py-2">
                    <input
                      type="text"
                      placeholder="Search collections…"
                      onChange={(e) => {
                        const el = e.target.closest('.rounded-lg')?.querySelector('[data-collection-list]');
                        if (!el) return;
                        const query = e.target.value.toLowerCase();
                        el.querySelectorAll('[data-collection-item]').forEach((item) => {
                          item.style.display = item.dataset.collectionItem.toLowerCase().includes(query) ? '' : 'none';
                        });
                      }}
                      className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
                    />
                  </div>
                  {/* Selected count */}
                  <div className="flex items-center justify-between border-b border-slate-800 px-3 py-1.5">
                    <span className="text-[11px] text-slate-500">
                      {form.collectionIds.length} of {collections.length} selected
                    </span>
                    {form.collectionIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleFieldChange('collectionIds', [])}
                        className="text-[11px] text-rose-400 hover:text-rose-300"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  {/* Collection list */}
                  <div data-collection-list className="max-h-52 overflow-y-auto divide-y divide-slate-800/50">
                    {collections.map((col) => {
                      const isSelected = form.collectionIds.includes(col.id);
                      return (
                        <label
                          key={col.id}
                          data-collection-item={col.title}
                          className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors hover:bg-slate-800/50 ${isSelected ? 'bg-emerald-500/5' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setForm((prev) => ({
                                ...prev,
                                collectionIds: isSelected
                                  ? prev.collectionIds.filter((id) => id !== col.id)
                                  : [...prev.collectionIds, col.id],
                              }));
                            }}
                            className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-400 focus:ring-offset-0 accent-emerald-500"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-white">{col.title}</span>
                            {col.handle && (
                              <span className="ml-2 text-[10px] text-slate-500">/{col.handle}</span>
                            )}
                          </div>
                          {isSelected && (
                            <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500 italic">No collections found. Create collections first.</p>
              )}
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

            <div className="rounded-xl border border-slate-800 bg-slate-900/80 backdrop-blur-xl p-5 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Media Gallery</p>
                    <p className="text-[11px] text-slate-500">Drag to reorder · Click to preview</p>
                  </div>
                </div>
                <label className="group flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/25 px-3 py-1.5 text-xs font-semibold text-emerald-400 cursor-pointer hover:from-emerald-500/20 hover:to-teal-500/20 transition-all duration-300">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:scale-110 transition-transform"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></svg>
                  Upload
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* URL Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newImageUrl}
                  onChange={(event) => setNewImageUrl(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); handleAddImage(); } }}
                  className="flex-1 rounded-lg border border-slate-700/60 bg-slate-950/60 backdrop-blur-sm px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-emerald-400/60 focus:ring-1 focus:ring-emerald-400/20 focus:outline-none transition-all"
                  placeholder="Paste image URL and press Enter"
                />
                <button
                  type="button"
                  onClick={handleAddImage}
                  className="rounded-lg border border-slate-700/60 bg-slate-800/50 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700/50 hover:border-slate-600 transition-all duration-200"
                >
                  Add
                </button>
              </div>

              {/* Image Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {form.media.map((media, index) => (
                  <div
                    key={`media-${media.url}-${index}`}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(index)); e.currentTarget.style.opacity = '0.4'; }}
                    onDragEnd={(e) => { e.currentTarget.style.opacity = '1'; }}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
                      if (isNaN(fromIndex) || fromIndex === index) return;
                      setForm((prev) => {
                        const updated = [...prev.media];
                        const [moved] = updated.splice(fromIndex, 1);
                        updated.splice(index, 0, moved);
                        return { ...prev, media: updated };
                      });
                    }}
                    className="group relative aspect-square rounded-xl border border-slate-700/50 bg-slate-950/50 backdrop-blur-sm overflow-hidden cursor-grab active:cursor-grabbing transition-all duration-300 hover:border-emerald-500/30 hover:shadow-[0_0_20px_rgba(16,185,129,0.08)]"
                    style={index === 0 ? { borderColor: 'rgba(16,185,129,0.35)' } : undefined}
                  >
                    {/* Image */}
                    {media.url ? (
                      <img
                        src={media.url}
                        alt={`Product ${index + 1}`}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-slate-900">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-700"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                      </div>
                    )}

                    {/* Primary Badge */}
                    {index === 0 && (
                      <div className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-md bg-emerald-500/90 backdrop-blur-sm px-2 py-0.5 shadow-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                        <span className="text-[10px] font-bold text-white tracking-wide uppercase">Primary</span>
                      </div>
                    )}

                    {/* Index Badge */}
                    {index !== 0 && (
                      <div className="absolute top-2 left-2 z-10 flex h-5 w-5 items-center justify-center rounded-md bg-slate-900/80 backdrop-blur-sm border border-slate-700/50">
                        <span className="text-[10px] font-semibold text-slate-400">{index + 1}</span>
                      </div>
                    )}

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-slate-950/70 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-300">
                      {/* Expand */}
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, _lightboxIndex: index }))}
                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 border border-white/20 text-white hover:bg-white/20 hover:scale-110 transition-all duration-200"
                        title="Preview"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6" /><path d="M9 21H3v-6" /><path d="M21 3l-7 7" /><path d="M3 21l7-7" /></svg>
                      </button>
                      {/* Remove */}
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/20 border border-rose-500/30 text-rose-300 hover:bg-rose-500/30 hover:scale-110 transition-all duration-200"
                        title="Remove"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                      </button>
                    </div>

                    {/* Drag Handle */}
                    <div className="absolute top-2 right-2 z-10 flex h-5 w-5 items-center justify-center rounded-md bg-slate-900/60 backdrop-blur-sm border border-slate-700/40 opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><circle cx="9" cy="5" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="19" r="1" /><circle cx="15" cy="5" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="19" r="1" /></svg>
                    </div>
                  </div>
                ))}

                {/* Pending Uploads */}
                {pendingUploads.map((item) => (
                  <div
                    key={item.id}
                    className="group relative aspect-square rounded-xl border border-slate-700/50 bg-slate-950/50 overflow-hidden"
                  >
                    {item.previewUrl ? (
                      <img
                        src={item.previewUrl}
                        alt={item.name}
                        className="h-full w-full object-cover opacity-60"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-slate-900">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-700 animate-pulse"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /></svg>
                      </div>
                    )}
                    {/* Upload Status Overlay */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/60 backdrop-blur-[2px]">
                      {item.status === 'failed' ? (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-rose-400 mb-1.5"><circle cx="12" cy="12" r="10" /><line x1="15" x2="9" y1="9" y2="15" /><line x1="9" x2="15" y1="9" y2="15" /></svg>
                          <p className="text-[10px] text-rose-300 font-medium mb-2">Failed</p>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => retryUpload(item.id)}
                              className="rounded-md bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500/30 transition-colors"
                            >
                              Retry
                            </button>
                            <button
                              type="button"
                              onClick={() => removePendingUpload(item.id)}
                              className="rounded-md bg-slate-800/60 border border-slate-700/50 px-2 py-0.5 text-[10px] font-semibold text-slate-400 hover:bg-slate-700/50 transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="h-5 w-5 rounded-full border-2 border-emerald-400/40 border-t-emerald-400 animate-spin mb-1.5" />
                          <p className="text-[10px] text-emerald-300/80 font-medium">Uploading...</p>
                        </>
                      )}
                    </div>
                  </div>
                ))}

                {/* Empty / Add More Drop Zone */}
                {form.media.length === 0 && pendingUploads.length === 0 ? (
                  <label className="col-span-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-700/50 bg-slate-950/30 py-10 cursor-pointer hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all duration-300 group/empty">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800/50 border border-slate-700/40 group-hover/empty:border-emerald-500/30 group-hover/empty:bg-emerald-500/10 transition-all duration-300">
                      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500 group-hover/empty:text-emerald-400 transition-colors"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></svg>
                    </div>
                    <p className="text-xs text-slate-500 group-hover/empty:text-slate-400 transition-colors">Drop images here or <span className="text-emerald-400 font-medium">browse</span></p>
                    <p className="text-[10px] text-slate-600">PNG, JPG, WEBP up to 10 MB</p>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleUpload}
                      className="hidden"
                    />
                  </label>
                ) : null}
              </div>

              {/* Image Count */}
              {form.media.length > 0 && (
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/50">
                  <p className="text-[11px] text-slate-500">
                    {form.media.length} {form.media.length === 1 ? 'image' : 'images'}
                  </p>
                  <p className="text-[10px] text-slate-600">First image is the primary thumbnail</p>
                </div>
              )}
            </div>

            {/* Lightbox Modal */}
            {typeof form._lightboxIndex === 'number' && form.media[form._lightboxIndex] && (
              <div
                className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md"
                onClick={() => setForm((prev) => ({ ...prev, _lightboxIndex: undefined }))}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setForm((prev) => ({ ...prev, _lightboxIndex: undefined }));
                  if (e.key === 'ArrowRight') setForm((prev) => ({ ...prev, _lightboxIndex: Math.min((prev._lightboxIndex ?? 0) + 1, prev.media.length - 1) }));
                  if (e.key === 'ArrowLeft') setForm((prev) => ({ ...prev, _lightboxIndex: Math.max((prev._lightboxIndex ?? 0) - 1, 0) }));
                }}
                tabIndex={-1}
                ref={(el) => el?.focus()}
              >
                <div className="relative max-h-[85vh] max-w-[85vw]" onClick={(e) => e.stopPropagation()}>
                  <img
                    src={form.media[form._lightboxIndex].url}
                    alt={`Product ${form._lightboxIndex + 1}`}
                    className="max-h-[85vh] max-w-[85vw] rounded-2xl object-contain shadow-2xl"
                  />
                  {/* Close Button */}
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, _lightboxIndex: undefined }))}
                    className="absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/90 border border-slate-700 text-white hover:bg-slate-800 transition-colors shadow-lg"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                  {/* Navigation Arrows */}
                  {form._lightboxIndex > 0 && (
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, _lightboxIndex: (prev._lightboxIndex ?? 1) - 1 }))}
                      className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-900/80 border border-slate-700/50 text-white hover:bg-slate-800 transition-all shadow-lg"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                    </button>
                  )}
                  {form._lightboxIndex < form.media.length - 1 && (
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, _lightboxIndex: (prev._lightboxIndex ?? 0) + 1 }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-900/80 border border-slate-700/50 text-white hover:bg-slate-800 transition-all shadow-lg"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                    </button>
                  )}
                  {/* Image Counter */}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 px-3 py-1">
                    <span className="text-xs font-medium text-slate-300">{form._lightboxIndex + 1} / {form.media.length}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-white">Size Guide</p>
                <p className="text-xs text-slate-400">
                  Manage size values and optional size chart details.
                </p>
              </div>

              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Size Values
                </label>
                <input
                  type="text"
                  value={sizeValues}
                  onChange={(event) => handleSizeValuesChange(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-400 focus:outline-none"
                  placeholder="XS, S, M, L, XL"
                />
              </div>

              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Size Chart Image URL
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={form.sizeChartImageUrl}
                    onChange={(event) =>
                      handleFieldChange('sizeChartImageUrl', event.target.value)
                    }
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-400 focus:outline-none"
                    placeholder="https://..."
                  />
                  <label className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 cursor-pointer">
                    {sizeChartUploading ? 'Uploading...' : 'Upload'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleSizeChartUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {form.sizeChartImageUrl ? (
                <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950 p-2">
                  <img
                    src={form.sizeChartImageUrl}
                    alt="Size chart"
                    className="max-h-56 w-full object-contain"
                  />
                </div>
              ) : null}

              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Size Chart Notes
                </label>
                <textarea
                  value={form.sizeChartText}
                  onChange={(event) => handleFieldChange('sizeChartText', event.target.value)}
                  className="mt-2 min-h-[100px] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-400 focus:outline-none"
                  placeholder="Add measurements, fit notes, or instructions."
                />
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
            disabled={saving || loading || pendingUploads.some((item) => item.status === 'uploading')}
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
