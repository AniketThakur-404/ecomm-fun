import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  adminCreateCollection,
  adminFetchCollection,
  adminFetchCollections,
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

const AdminCollectionForm = () => {
  const { id } = useParams();
  const isNew = id === 'new';
  const { token } = useAdminAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [collections, setCollections] = useState([]);
  const [form, setForm] = useState({
    title: '',
    handle: '',
    descriptionHtml: '',
    imageUrl: '',
    parentId: '',
    type: 'MANUAL',
  });

  useEffect(() => {
    if (!token) return;
    adminFetchCollections(token, { limit: 200 })
      .then((items) => setCollections(Array.isArray(items) ? items : []))
      .catch(() => setCollections([]));
  }, [token]);

  useEffect(() => {
    if (isNew || !id || !token) return;
    setLoading(true);
    adminFetchCollection(token, id)
      .then((collection) => {
        if (!collection) return;
        setForm({
          title: collection.title || '',
          handle: collection.handle || '',
          descriptionHtml: collection.descriptionHtml || '',
          imageUrl: collection.imageUrl || '',
          parentId: collection.parentId || '',
          type: collection.type || 'MANUAL',
        });
      })
      .catch((err) => setError(err?.message || 'Unable to load collection.'))
      .finally(() => setLoading(false));
  }, [id, isNew, token]);

  const handleFieldChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSaving(true);

    const payload = {
      title: form.title.trim(),
      handle: form.handle.trim() || slugify(form.title),
      descriptionHtml: form.descriptionHtml.trim() || undefined,
      imageUrl: form.imageUrl.trim() || undefined,
      parentId: form.parentId || null,
      type: form.type || 'MANUAL',
    };

    try {
      if (isNew) {
        await adminCreateCollection(token, payload);
      } else {
        await adminUpdateCollection(token, id, payload);
      }
      navigate('/admin/collections');
    } catch (err) {
      setError(err?.message || 'Unable to save collection.');
    } finally {
      setSaving(false);
    }
  };

  const parentOptions = collections.filter((collection) => collection.id !== id);

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
                onChange={(event) => handleFieldChange('handle', event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:border-emerald-400 focus:outline-none"
                placeholder="auto-generated if left blank"
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Parent</label>
              <select
                value={form.parentId}
                onChange={(event) => handleFieldChange('parentId', event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:border-emerald-400 focus:outline-none"
              >
                <option value="">No parent</option>
                {parentOptions.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.title}
                  </option>
                ))}
              </select>
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
          </div>
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
