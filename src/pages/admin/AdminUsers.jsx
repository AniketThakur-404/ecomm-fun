import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { adminFetchUsers, adminUpdateUserRole } from '../../lib/api';
import { useAdminAuth } from '../../contexts/admin-auth-context';

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const normalizeToken = (value) => String(value || '').trim().toLowerCase();

const AdminUsers = () => {
  const { token, admin } = useAdminAuth();
  const [users, setUsers] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 50 });
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState('');

  const loadUsers = useCallback(async () => {
    if (!token) {
      setError('Authentication required. Please log in again.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const payload = await adminFetchUsers(token, {
        page: meta.page,
        limit: meta.limit,
        search: query || undefined,
      });
      setUsers(Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : []);
      if (payload?.meta) {
        setMeta((prev) => ({
          ...prev,
          total: Number(payload.meta.total ?? 0),
          page: Number(payload.meta.page ?? prev.page),
          limit: Number(payload.meta.limit ?? prev.limit),
        }));
      }
    } catch (err) {
      const errorMessage = err?.message || err?.payload?.error?.message || 'Unable to load users.';
      if (err?.status === 401 || err?.status === 403) {
        setError('Session expired. Please log in again.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [token, meta.page, meta.limit, query]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const summary = useMemo(() => {
    const totals = users.reduce(
      (acc, user) => {
        const role = normalizeToken(user?.role);
        if (role === 'admin') acc.admin += 1;
        if (role === 'customer') acc.customer += 1;
        if (role === 'vendor') acc.vendor += 1;
        return acc;
      },
      { admin: 0, customer: 0, vendor: 0 },
    );
    return { total: meta.total || users.length, ...totals };
  }, [users, meta.total]);

  const totalPages = useMemo(() => {
    const pages = Math.ceil((meta.total || 0) / (meta.limit || 1));
    return Math.max(1, pages || 1);
  }, [meta.limit, meta.total]);

  const handleSearch = (event) => {
    event.preventDefault();
    setMeta((prev) => ({ ...prev, page: 1 }));
    setQuery(queryInput.trim());
  };

  const handleRoleChange = async (userId, nextRole) => {
    if (!token || !userId || !nextRole) return;
    if (userId === admin?.id && nextRole !== 'ADMIN') {
      setError('You cannot remove your own admin access while signed in.');
      return;
    }

    setError('');
    setUpdatingUserId(userId);
    try {
      const updated = await adminUpdateUserRole(token, userId, nextRole);
      setUsers((prev) =>
        prev.map((item) =>
          item.id === userId
            ? { ...item, role: updated?.role || nextRole }
            : item,
        ),
      );
    } catch (err) {
      setError(err?.message || 'Unable to update user role.');
    } finally {
      setUpdatingUserId('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Users</p>
          <h2 className="text-2xl font-bold text-white">Customer Accounts</h2>
        </div>
        <button
          type="button"
          onClick={loadUsers}
          disabled={loading}
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 transition disabled:opacity-60"
        >
          Refresh
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Total</p>
          <p className="mt-2 text-2xl font-bold text-white">{summary.total}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Admins</p>
          <p className="mt-2 text-2xl font-bold text-emerald-300">{summary.admin}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Customers</p>
          <p className="mt-2 text-2xl font-bold text-slate-100">{summary.customer}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Vendors</p>
          <p className="mt-2 text-2xl font-bold text-cyan-300">{summary.vendor}</p>
        </div>
      </div>

      <form onSubmit={handleSearch} className="flex flex-wrap gap-3">
        <input
          type="text"
          value={queryInput}
          onChange={(event) => setQueryInput(event.target.value)}
          placeholder="Search by name, email, or role"
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

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-800/70 text-slate-300 uppercase tracking-[0.2em] text-xs">
            <tr>
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Email</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">Joined</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" className="px-6 py-10 text-center text-slate-400">
                  Loading users...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-6 py-10 text-center text-slate-400">
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((user) => {
                const isSelf = user.id === admin?.id;
                const roleValue = String(user.role || 'CUSTOMER').toUpperCase();
                const hasUnsupportedRole = !['CUSTOMER', 'ADMIN'].includes(roleValue);
                return (
                  <tr key={user.id} className="border-t border-slate-800">
                    <td className="px-6 py-4 font-semibold text-slate-100">
                      {user.name || 'No name'}
                    </td>
                    <td className="px-6 py-4 text-slate-300">{user.email}</td>
                    <td className="px-6 py-4 text-slate-300">{user.role}</td>
                    <td className="px-6 py-4 text-slate-400">{formatDateTime(user.createdAt)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <select
                          value={roleValue}
                          onChange={(event) =>
                            handleRoleChange(user.id, event.target.value)
                          }
                          disabled={updatingUserId === user.id || isSelf}
                          className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200 disabled:opacity-60"
                        >
                          {hasUnsupportedRole ? (
                            <option value={roleValue}>{roleValue}</option>
                          ) : null}
                          <option value="CUSTOMER">CUSTOMER</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                        {isSelf ? (
                          <span className="text-[11px] text-amber-300">Current session</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setMeta((prev) => ({ ...prev, page: Math.max(prev.page - 1, 1) }))}
          disabled={meta.page <= 1 || loading}
          className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
        >
          Previous
        </button>
        <span className="px-2 text-xs text-slate-400">
          Page {meta.page} of {totalPages} ({meta.total} total)
        </span>
        <button
          type="button"
          onClick={() =>
            setMeta((prev) => ({
              ...prev,
              page: Math.min(prev.page + 1, totalPages),
            }))
          }
          disabled={meta.page >= totalPages || loading}
          className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default AdminUsers;
