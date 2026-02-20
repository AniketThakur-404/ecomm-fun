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
    if (!token) {
      setError('Authentication required. Please log in again.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const items = await adminFetchCollections(token, { limit: 200 });
      setCollections(Array.isArray(items) ? items : []);
    } catch (err) {
      const errorMessage = err?.message || err?.payload?.error?.message || 'Unable to load collections.';
      if (err?.status === 401 || err?.status === 403) {
        setError('Session expired. Please log in again.');
      } else {
        setError(errorMessage);
      }
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
              (() => {
                // Group: parents first, then children under their parent
                const parents = collections.filter((c) => !c.parentId);
                const childMap = {};
                collections.forEach((c) => {
                  if (c.parentId) {
                    if (!childMap[c.parentId]) childMap[c.parentId] = [];
                    childMap[c.parentId].push(c);
                  }
                });
                const ordered = [];
                parents.forEach((p) => {
                  ordered.push({ ...p, _isParent: true });
                  (childMap[p.id] || []).forEach((child) =>
                    ordered.push({ ...child, _isChild: true }),
                  );
                });
                // Add any orphaned children (parentId set but parent not in list)
                collections.forEach((c) => {
                  if (c.parentId && !parents.find((p) => p.id === c.parentId)) {
                    if (!ordered.find((o) => o.id === c.id)) {
                      ordered.push({ ...c, _isChild: true });
                    }
                  }
                });

                return ordered.map((collection) => (
                  <tr key={collection.id} className="border-t border-slate-800">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {collection._isChild && (
                          <span className="text-slate-600 text-xs">└─</span>
                        )}
                        <div>
                          <div className="font-semibold text-slate-100">
                            {collection.title}
                          </div>
                          {collection._isParent && childMap[collection.id]?.length > 0 && (
                            <span className="text-[10px] text-emerald-400/70">
                              {childMap[collection.id].length} sub-collection{childMap[collection.id].length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
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
                ));
              })()
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminCollections;
