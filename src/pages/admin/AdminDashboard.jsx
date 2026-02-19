import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminFetchStats, formatMoney } from '../../lib/api';
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

const statusBadge = (status) => {
  const token = String(status || '').toUpperCase();
  if (token === 'FULFILLED') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  if (token === 'PAID') return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
  if (token === 'PENDING') return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  if (token === 'CANCELLED') return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
  return 'bg-slate-700/40 text-slate-200 border-slate-600';
};

const AdminDashboard = () => {
  const { token } = useAdminAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    const loadStats = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await adminFetchStats(token);
        setStats(data);
      } catch (err) {
        setError(err?.message || 'Unable to load dashboard stats.');
      } finally {
        setLoading(false);
      }
    };
    loadStats();
    const interval = setInterval(loadStats, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [token]);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-sm uppercase tracking-[0.35em] text-slate-400">Loading dashboard...</div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
        {error}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Dashboard</p>
          <h2 className="text-2xl font-bold text-white">Overview</h2>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 transition"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {/* Products Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          to="/admin/products"
          className="rounded-xl border border-slate-800 bg-slate-900 p-6 hover:bg-slate-800 transition cursor-pointer"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Total Products</p>
          <p className="mt-2 text-3xl font-bold text-white">{stats.products?.total ?? 0}</p>
          <p className="mt-2 text-xs text-slate-400">
            {stats.products?.active ?? 0} active, {stats.products?.draft ?? 0} draft
          </p>
        </Link>

        <Link
          to="/admin/collections"
          className="rounded-xl border border-slate-800 bg-slate-900 p-6 hover:bg-slate-800 transition cursor-pointer"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Collections</p>
          <p className="mt-2 text-3xl font-bold text-white">{stats.collections?.total ?? 0}</p>
        </Link>

        <Link
          to="/admin/users"
          className="rounded-xl border border-slate-800 bg-slate-900 p-6 hover:bg-slate-800 transition cursor-pointer"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Total Users</p>
          <p className="mt-2 text-3xl font-bold text-white">{stats.users?.total ?? 0}</p>
          <p className="mt-2 text-xs text-slate-400">
            {stats.users?.customers ?? 0} customers, {stats.users?.admins ?? 0} admins
          </p>
        </Link>
      </div>

      {/* Orders & Revenue Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Link
          to="/admin/orders"
          className="rounded-xl border border-slate-800 bg-slate-900 p-6 hover:bg-slate-800 transition cursor-pointer"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Total Orders</p>
          <p className="mt-2 text-3xl font-bold text-white">{stats.orders?.total ?? 0}</p>
        </Link>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Pending</p>
          <p className="mt-2 text-3xl font-bold text-amber-300">{stats.orders?.pending ?? 0}</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Paid</p>
          <p className="mt-2 text-3xl font-bold text-blue-300">{stats.orders?.paid ?? 0}</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Fulfilled</p>
          <p className="mt-2 text-3xl font-bold text-emerald-300">{stats.orders?.fulfilled ?? 0}</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Cancelled</p>
          <p className="mt-2 text-3xl font-bold text-rose-300">{stats.orders?.cancelled ?? 0}</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Revenue</p>
          <p className="mt-2 text-3xl font-bold text-emerald-300">
            {formatMoney(stats.revenue?.total ?? 0, stats.revenue?.currency || 'INR')}
          </p>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Recent Orders</p>
              <h3 className="mt-1 text-lg font-semibold text-white">Latest Activity</h3>
            </div>
            <Link
              to="/admin/orders"
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
            >
              View All
            </Link>
          </div>
        </div>
        <div className="p-6">
          {!stats.orders?.recent?.length ? (
            <p className="text-center text-sm text-slate-400 py-8">No recent orders</p>
          ) : (
            <div className="space-y-3">
              {stats.orders.recent.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 p-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <p className="font-semibold text-slate-100">{order.number || order.id}</p>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusBadge(order.status)}`}
                      >
                        {order.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {order.customer?.name || order.customer?.email || 'Guest'} •{' '}
                      {formatDateTime(order.createdAt)}
                    </p>
                  </div>
                  <div className="ml-4 text-right">
                    <p className="font-semibold text-slate-100">
                      {formatMoney(order.total, order.currency)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Link
          to="/admin/products/new"
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 hover:bg-emerald-500/20 transition text-center"
        >
          <p className="text-sm font-semibold text-emerald-300">Add Product</p>
        </Link>
        <Link
          to="/admin/collections/new"
          className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-6 hover:bg-blue-500/20 transition text-center"
        >
          <p className="text-sm font-semibold text-blue-300">Add Collection</p>
        </Link>
        <Link
          to="/admin/orders"
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 hover:bg-amber-500/20 transition text-center"
        >
          <p className="text-sm font-semibold text-amber-300">Manage Orders</p>
        </Link>
        <Link
          to="/admin/users"
          className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-6 hover:bg-purple-500/20 transition text-center"
        >
          <p className="text-sm font-semibold text-purple-300">Manage Users</p>
        </Link>
        <Link
          to="/admin/reviews"
          className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-6 hover:bg-cyan-500/20 transition text-center"
        >
          <p className="text-sm font-semibold text-cyan-300">Moderate Reviews</p>
        </Link>
      </div>
    </div>
  );
};

export default AdminDashboard;
