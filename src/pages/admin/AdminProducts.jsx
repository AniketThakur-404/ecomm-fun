import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  adminDeleteProduct,
  adminExportProductsCsv,
  adminFetchProducts,
  adminImportProductsCsv,
  formatMoney,
} from '../../lib/api';
import { useAdminAuth } from '../../contexts/admin-auth-context';

const AdminProducts = () => {
  const { token } = useAdminAuth();
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState({ done: 0, total: 0 });
  const [importSummary, setImportSummary] = useState(null);
  const [deleteSummary, setDeleteSummary] = useState(null);

  const loadProducts = async (searchValue = '') => {
    setLoading(true);
    setError('');
    try {
      const payload = await adminFetchProducts(token, {
        search: searchValue || undefined,
        limit: 100,
      });
      const items = payload?.data ?? payload ?? [];
      setProducts(items);
    } catch (err) {
      setError(err?.message || 'Unable to load products.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    loadProducts();
  }, [token]);

  const handleSearch = (event) => {
    event.preventDefault();
    loadProducts(query.trim());
  };

  const handleDelete = async (productId) => {
    if (!productId) return;
    const confirmDelete = window.confirm('Delete this product? This cannot be undone.');
    if (!confirmDelete) return;
    try {
      await adminDeleteProduct(token, productId);
      await loadProducts(query.trim());
    } catch (err) {
      setError(err?.message || 'Unable to delete product.');
    }
  };

  const fetchAllProductIds = async () => {
    const ids = [];
    const seen = new Set();
    let page = 1;
    const limit = 200;

    while (true) {
      const payload = await adminFetchProducts(token, {
        limit,
        page,
        include: 'compact',
      });
      const items = payload?.data ?? payload ?? [];
      items.forEach((item) => {
        if (!item?.id || seen.has(item.id)) return;
        seen.add(item.id);
        ids.push(item.id);
      });

      const total = Number(payload?.meta?.total);
      if (!items.length) break;
      if (Number.isFinite(total) && ids.length >= total) break;
      if (items.length < limit) break;
      page += 1;
    }

    return ids;
  };

  const handleDeleteAll = async () => {
    if (!token || deletingAll) return;
    const firstConfirm = window.confirm(
      'Delete ALL products from catalog? This cannot be undone.',
    );
    if (!firstConfirm) return;

    setError('');
    setDeleteSummary(null);
    setDeletingAll(true);
    setDeleteProgress({ done: 0, total: 0 });

    try {
      const ids = await fetchAllProductIds();
      if (!ids.length) {
        setDeleteSummary({ deleted: 0, failed: 0, total: 0 });
        return;
      }

      const secondConfirm = window.confirm(
        `You are about to delete ${ids.length} products. Continue?`,
      );
      if (!secondConfirm) return;

      let deleted = 0;
      let failed = 0;
      setDeleteProgress({ done: 0, total: ids.length });

      for (let index = 0; index < ids.length; index += 1) {
        const id = ids[index];
        try {
          await adminDeleteProduct(token, id);
          deleted += 1;
        } catch (err) {
          failed += 1;
          console.error('Delete failed for product', id, err);
        } finally {
          setDeleteProgress({ done: index + 1, total: ids.length });
        }
      }

      setDeleteSummary({ deleted, failed, total: ids.length });
      await loadProducts(query.trim());
    } catch (err) {
      setError(err?.message || 'Unable to delete all products.');
    } finally {
      setDeletingAll(false);
      setDeleteProgress({ done: 0, total: 0 });
    }
  };

  const handleExport = async () => {
    if (!token) return;
    setExporting(true);
    try {
      const csv = await adminExportProductsCsv(token);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'products-export.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err?.message || 'Unable to export CSV.');
    } finally {
      setExporting(false);
    }
  };

  const handleImportCsv = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !token) return;
    setImporting(true);
    setError('');
    setImportSummary(null);
    setDeleteSummary(null);
    try {
      const text = await file.text();
      const summary = await adminImportProductsCsv(token, text);
      setImportSummary(summary);
      await loadProducts(query.trim());
    } catch (err) {
      setError(err?.message || 'CSV import failed.');
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  const getMinPrice = (product) => {
    const prices = Array.isArray(product?.variants)
      ? product.variants.map((variant) => Number(variant?.price || 0))
      : [];
    const min = prices.length ? Math.min(...prices) : 0;
    return formatMoney(min, undefined);
  };

  const getImageCount = (product) => {
    const counted = Number(product?._count?.media);
    if (Number.isFinite(counted) && counted >= 0) return counted;
    return Array.isArray(product?.media) ? product.media.length : 0;
  };

  const getPreviewImage = (product) => {
    if (!Array.isArray(product?.media)) return '';
    const image =
      product.media.find((media) => media?.type === 'IMAGE' && media?.url) ||
      product.media.find((media) => media?.url);
    return image?.url || '';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Products</p>
          <h2 className="text-2xl font-bold text-white">Catalog Management</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || deletingAll}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 transition disabled:opacity-60"
          >
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
          <label
            className={`rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition ${
              deletingAll ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-slate-800'
            }`}
          >
            {importing ? 'Importing...' : 'Import CSV'}
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleImportCsv}
              className="hidden"
              disabled={deletingAll}
            />
          </label>
          <button
            type="button"
            onClick={handleDeleteAll}
            disabled={deletingAll || loading}
            className="rounded-lg border border-rose-500/40 px-4 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-500/10 transition disabled:opacity-60"
          >
            {deletingAll
              ? `Deleting... ${deleteProgress.done}/${deleteProgress.total || '?'}`
              : 'Delete All Products'}
          </button>
          <Link
            to="/admin/products/new"
            className="rounded-lg bg-emerald-400 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-300 transition"
          >
            Add Product
          </Link>
        </div>
      </div>

      <form onSubmit={handleSearch} className="flex flex-wrap gap-3">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by title, handle, or tag"
          className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 transition"
        >
          Search
        </button>
      </form>

      {error ? (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {importSummary ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          Imported: {importSummary.created ?? 0} created, {importSummary.updated ?? 0} updated,
          {importSummary.failed ?? 0} failed.
        </div>
      ) : null}

      {deleteSummary ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Deleted: {deleteSummary.deleted ?? 0}/{deleteSummary.total ?? 0}.
          {deleteSummary.failed ? ` Failed: ${deleteSummary.failed}.` : ''}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-800/70 text-slate-300 uppercase tracking-[0.2em] text-xs">
            <tr>
              <th className="px-6 py-4">Product</th>
              <th className="px-6 py-4">Images</th>
              <th className="px-6 py-4">Handle</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Price</th>
              <th className="px-6 py-4">Collections</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" className="px-6 py-10 text-center text-slate-400">
                  Loading products...
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-10 text-center text-slate-400">
                  No products found.
                </td>
              </tr>
            ) : (
              products.map((product) => {
                const previewImage = getPreviewImage(product);
                const imageCount = getImageCount(product);
                return (
                  <tr key={product.id} className="border-t border-slate-800">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-100">{product.title}</div>
                      <div className="text-xs text-slate-400">{product.vendor || 'Vendor'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
                          {previewImage ? (
                            <img
                              src={previewImage}
                              alt={product.title || 'Product image'}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-500">
                              No Img
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-slate-300">
                          {imageCount} uploaded
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-300">{product.handle}</td>
                    <td className="px-6 py-4 text-slate-300">{product.status}</td>
                    <td className="px-6 py-4 text-slate-200">{getMinPrice(product)}</td>
                    <td className="px-6 py-4 text-slate-300">
                      {Array.isArray(product.collections) && product.collections.length
                        ? product.collections.map((collection) => collection.title).join(', ')
                        : 'Unassigned'}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <Link
                        to={`/admin/products/${product.id}`}
                        className="inline-flex items-center rounded-lg border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(product.id)}
                        className="inline-flex items-center rounded-lg border border-rose-500/40 px-3 py-1 text-xs font-semibold text-rose-200 hover:bg-rose-500/10"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminProducts;
