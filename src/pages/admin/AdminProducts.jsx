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
  const [importSummary, setImportSummary] = useState(null);

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
            disabled={exporting}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 transition disabled:opacity-60"
          >
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
          <label className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 transition cursor-pointer">
            {importing ? 'Importing...' : 'Import CSV'}
            <input type="file" accept=".csv,text/csv" onChange={handleImportCsv} className="hidden" />
          </label>
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

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-800/70 text-slate-300 uppercase tracking-[0.2em] text-xs">
            <tr>
              <th className="px-6 py-4">Product</th>
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
                <td colSpan="6" className="px-6 py-10 text-center text-slate-400">
                  Loading products...
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-10 text-center text-slate-400">
                  No products found.
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr key={product.id} className="border-t border-slate-800">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-100">{product.title}</div>
                    <div className="text-xs text-slate-400">{product.vendor || 'Vendor'}</div>
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminProducts;
