import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  adminDeleteCollection,
  adminFetchCollections,
} from '../../lib/api';
import { useAdminAuth } from '../../contexts/admin-auth-context';

const AdminCollections = () => {
  const { token } = useAdminAuth();
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadCollections = async () => {
    setLoading(true);
    setError('');
    try {
      const items = await adminFetchCollections(token, { limit: 200 });
      setCollections(Array.isArray(items) ? items : []);
    } catch (err) {
      setError(err?.message || 'Unable to load collections.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    loadCollections();
  }, [token]);

  const handleDelete = async (collectionId) => {
    if (!collectionId) return;
    const confirmDelete = window.confirm('Delete this collection?');
    if (!confirmDelete) return;
    try {
      await adminDeleteCollection(token, collectionId);
      await loadCollections();
    } catch (err) {
      setError(err?.message || 'Unable to delete collection.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Collections</p>
          <h2 className="text-2xl font-bold text-white">Collection Management</h2>
        </div>
        <Link
          to="/admin/collections/new"
          className="rounded-lg bg-emerald-400 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-300 transition"
        >
          Add Collection
        </Link>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-800/70 text-slate-300 uppercase tracking-[0.2em] text-xs">
            <tr>
              <th className="px-6 py-4">Title</th>
              <th className="px-6 py-4">Handle</th>
              <th className="px-6 py-4">Parent</th>
              <th className="px-6 py-4">Products</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" className="px-6 py-10 text-center text-slate-400">
                  Loading collections...
                </td>
              </tr>
            ) : collections.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-6 py-10 text-center text-slate-400">
                  No collections found.
                </td>
              </tr>
            ) : (
              collections.map((collection) => (
                <tr key={collection.id} className="border-t border-slate-800">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-100">{collection.title}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-300">{collection.handle}</td>
                  <td className="px-6 py-4 text-slate-300">
                    {collection.parent?.title || '—'}
                  </td>
                  <td className="px-6 py-4 text-slate-300">
                    {collection._count?.products ?? 0}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <Link
                      to={`/admin/collections/${collection.id}`}
                      className="inline-flex items-center rounded-lg border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(collection.id)}
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

export default AdminCollections;
