import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { adminFetchOrders, adminUpdateOrder, formatMoney } from '../../lib/api';
import { useAdminAuth } from '../../contexts/admin-auth-context';

const ORDER_STEPS = ['PENDING', 'PAID', 'FULFILLED'];

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

const toLabel = (status) => {
  const token = String(status || '').toUpperCase();
  if (token === 'FULFILLED') return 'Delivered';
  if (token === 'PAID') return 'Paid';
  if (token === 'PENDING') return 'Pending';
  if (token === 'CANCELLED') return 'Cancelled';
  return token || 'Unknown';
};

const trackingSteps = (order) => {
  const statusToken = String(order?.status || '').toUpperCase();
  const current = ORDER_STEPS.indexOf(statusToken);
  const placedAt = formatDateTime(order?.createdAt);
  const updatedAt = formatDateTime(order?.updatedAt);

  if (statusToken === 'CANCELLED') {
    return [
      {
        key: 'PENDING',
        title: 'Order Placed',
        done: true,
        current: false,
        date: placedAt,
      },
      {
        key: 'CANCELLED',
        title: 'Cancelled',
        done: true,
        current: true,
        date: updatedAt,
      },
    ];
  }

  return [
    {
      key: 'PENDING',
      title: 'Order Placed',
      done: true,
      current: current <= 0,
      date: placedAt,
    },
    {
      key: 'PAID',
      title: 'Payment Confirmed',
      done: current >= 1,
      current: current === 1,
      date: current >= 1 ? updatedAt : '-',
    },
    {
      key: 'FULFILLED',
      title: 'Delivered',
      done: current >= 2,
      current: current === 2,
      date: current >= 2 ? updatedAt : '-',
    },
  ];
};

const AdminOrders = () => {
  const { token } = useAdminAuth();
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState(null);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20 });
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingOrderId, setUpdatingOrderId] = useState('');
  const [savingTrackingOrderId, setSavingTrackingOrderId] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState('');
  const [trackingDrafts, setTrackingDrafts] = useState({});

  const loadOrders = useCallback(async () => {
    if (!token) {
      setError('Authentication required. Please log in again.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const payload = await adminFetchOrders(token, {
        page: meta.page,
        limit: meta.limit,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        search: query || undefined,
      });
      const data = payload?.data ?? {};
      setOrders(Array.isArray(data.items) ? data.items : []);
      setSummary(data.summary || null);
      setMeta((prev) => ({
        ...prev,
        total: Number(payload?.meta?.total ?? 0),
        page: Number(payload?.meta?.page ?? prev.page),
        limit: Number(payload?.meta?.limit ?? prev.limit),
      }));
    } catch (err) {
      const errorMessage = err?.message || err?.payload?.error?.message || 'Unable to load orders.';
      if (err?.status === 401 || err?.status === 403) {
        setError('Session expired. Please log in again.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [meta.page, meta.limit, query, statusFilter, token]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const totalPages = useMemo(() => {
    const pages = Math.ceil((meta.total || 0) / (meta.limit || 1));
    return Math.max(1, pages || 1);
  }, [meta.limit, meta.total]);

  const handleSearch = (event) => {
    event.preventDefault();
    setMeta((prev) => ({ ...prev, page: 1 }));
    setQuery(queryInput.trim());
  };

  const handleStatusFilter = (value) => {
    setStatusFilter(value);
    setMeta((prev) => ({ ...prev, page: 1 }));
  };

  const handleStatusChange = async (order, nextStatus) => {
    if (!token || !order?.id || !nextStatus || nextStatus === order.status) return;
    setError('');
    setUpdatingOrderId(order.id);
    try {
      const updated = await adminUpdateOrder(token, order.id, { status: nextStatus });
      setOrders((prev) =>
        prev.map((item) =>
          item.id === order.id
            ? {
              ...item,
              ...updated,
              customer: item.customer,
            }
            : item,
        ),
      );
      if (statusFilter !== 'ALL' && nextStatus !== statusFilter) {
        setOrders((prev) => prev.filter((item) => item.id !== order.id));
      }
      await loadOrders();
    } catch (err) {
      setError(err?.message || 'Unable to update order.');
    } finally {
      setUpdatingOrderId('');
    }
  };

  const getTrackingDraft = (order) => {
    const existing = trackingDrafts[order?.id];
    if (existing) return existing;
    const shipping = order?.shipping || {};
    return {
      trackingNumber: String(
        shipping?.trackingNumber || shipping?.awbCode || shipping?.awb || '',
      ).trim(),
      courierName: String(shipping?.courierName || '').trim(),
      trackingUrl: String(shipping?.trackingUrl || '').trim(),
      shiprocketOrderId: String(shipping?.shiprocketOrderId || '').trim(),
      estimatedDelivery: String(shipping?.estimatedDelivery || '').trim(),
    };
  };

  const updateTrackingField = (order, field, value) => {
    if (!order?.id) return;
    const baseline = getTrackingDraft(order);
    setTrackingDrafts((prev) => ({
      ...prev,
      [order.id]: {
        ...baseline,
        [field]: value,
      },
    }));
  };

  const handleSaveTracking = async (order) => {
    if (!token || !order?.id) return;
    const draft = getTrackingDraft(order);
    setError('');
    setSavingTrackingOrderId(order.id);
    try {
      const updated = await adminUpdateOrder(token, order.id, {
        shipping: {
          trackingNumber: draft.trackingNumber || undefined,
          awbCode: draft.trackingNumber || undefined,
          courierName: draft.courierName || undefined,
          trackingUrl: draft.trackingUrl || undefined,
          shiprocketOrderId: draft.shiprocketOrderId || undefined,
          estimatedDelivery: draft.estimatedDelivery || undefined,
        },
      });
      setOrders((prev) =>
        prev.map((item) =>
          item.id === order.id
            ? {
              ...item,
              ...updated,
              customer: item.customer,
            }
            : item,
        ),
      );
    } catch (err) {
      setError(err?.message || 'Unable to save tracking details.');
    } finally {
      setSavingTrackingOrderId('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Orders</p>
          <h2 className="text-2xl font-bold text-white">Order Tracking Dashboard</h2>
        </div>
        <button
          type="button"
          onClick={loadOrders}
          disabled={loading}
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 transition disabled:opacity-60"
        >
          Refresh
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Filtered</p>
          <p className="mt-2 text-2xl font-bold text-white">{meta.total || 0}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">All Orders</p>
          <p className="mt-2 text-2xl font-bold text-slate-100">{summary?.total ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Pending</p>
          <p className="mt-2 text-2xl font-bold text-amber-300">{summary?.pending ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Paid</p>
          <p className="mt-2 text-2xl font-bold text-blue-300">{summary?.paid ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Fulfilled</p>
          <p className="mt-2 text-2xl font-bold text-emerald-300">{summary?.fulfilled ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Cancelled</p>
          <p className="mt-2 text-2xl font-bold text-rose-300">{summary?.cancelled ?? 0}</p>
        </div>
      </div>

      <form onSubmit={handleSearch} className="flex flex-wrap gap-3">
        <input
          type="text"
          value={queryInput}
          onChange={(event) => setQueryInput(event.target.value)}
          placeholder="Search by order number, customer name, or email"
          className="min-w-[260px] flex-1 rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
        />
        <select
          value={statusFilter}
          onChange={(event) => handleStatusFilter(event.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-200"
        >
          <option value="ALL">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="PAID">Paid</option>
          <option value="FULFILLED">Fulfilled</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
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
              <th className="px-6 py-4">Order</th>
              <th className="px-6 py-4">Customer</th>
              <th className="px-6 py-4">Placed</th>
              <th className="px-6 py-4">Total</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="px-6 py-10 text-center text-slate-400">
                  Loading orders...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-10 text-center text-slate-400">
                  No orders found.
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const shipping = order?.shipping || {};
                const customerName = order?.customer?.name || shipping?.fullName || 'Guest';
                const customerEmail = order?.customer?.email || shipping?.email || '-';
                const currency = order?.totals?.currency || 'INR';
                const total = Number(order?.totals?.total ?? 0);
                const steps = trackingSteps(order);
                const isExpanded = expandedOrderId === order.id;
                const trackingDraft = getTrackingDraft(order);

                return (
                  <React.Fragment key={order.id}>
                    <tr className="border-t border-slate-800">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-100">
                          {order?.number || order?.id}
                        </p>
                        <p className="text-xs text-slate-400">
                          {(Array.isArray(order?.items) ? order.items.length : 0)} line item(s)
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-slate-200">{customerName}</p>
                        <p className="text-xs text-slate-400">{customerEmail}</p>
                      </td>
                      <td className="px-6 py-4 text-slate-300">
                        {formatDateTime(order?.createdAt)}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-100">
                        {formatMoney(total, currency)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusBadge(order?.status)}`}
                          >
                            {toLabel(order?.status)}
                          </span>
                          <select
                            value={String(order?.status || 'PENDING').toUpperCase()}
                            onChange={(event) => handleStatusChange(order, event.target.value)}
                            disabled={updatingOrderId === order.id}
                            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200 disabled:opacity-60"
                          >
                            <option value="PENDING">PENDING</option>
                            <option value="PAID">PAID</option>
                            <option value="FULFILLED">FULFILLED</option>
                            <option value="CANCELLED">CANCELLED</option>
                          </select>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedOrderId((prev) => (prev === order.id ? '' : order.id))
                          }
                          className="rounded-lg border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                        >
                          {isExpanded ? 'Hide tracking' : 'Track order'}
                        </button>
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr className="border-t border-slate-800/70 bg-slate-950/60">
                        <td colSpan="6" className="px-6 py-5">
                          <div className="grid gap-5 lg:grid-cols-2">
                            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                                Tracking Timeline
                              </p>
                              <div className="mt-4 space-y-3">
                                {steps.map((step) => (
                                  <div key={step.key} className="flex items-center gap-3">
                                    <span
                                      className={`h-2.5 w-2.5 rounded-full ${
                                        step.done
                                          ? 'bg-emerald-300'
                                          : step.current
                                            ? 'bg-amber-300'
                                            : 'bg-slate-600'
                                      }`}
                                    />
                                    <div className="min-w-0">
                                      <p className="text-sm font-semibold text-slate-100">
                                        {step.title}
                                      </p>
                                      <p className="text-xs text-slate-400">{step.date}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                                Shipping Details
                              </p>
                              <div className="mt-4 space-y-1 text-sm text-slate-200">
                                <p>{shipping?.fullName || '-'}</p>
                                <p className="text-slate-300">{shipping?.email || '-'}</p>
                                <p className="text-slate-300">{shipping?.phone || '-'}</p>
                                <p className="text-slate-300">
                                  {[shipping?.address, shipping?.city, shipping?.postalCode]
                                    .filter(Boolean)
                                    .join(', ') || '-'}
                                </p>
                                <p className="pt-2 text-xs text-slate-500">
                                  Last update: {formatDateTime(order?.updatedAt)}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                                Tracking Configuration
                              </p>
                              <button
                                type="button"
                                onClick={() => handleSaveTracking(order)}
                                disabled={savingTrackingOrderId === order.id}
                                className="rounded border border-emerald-500/40 px-3 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-60"
                              >
                                {savingTrackingOrderId === order.id
                                  ? 'Saving...'
                                  : 'Save Tracking'}
                              </button>
                            </div>

                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                              <input
                                type="text"
                                value={trackingDraft.trackingNumber}
                                onChange={(event) =>
                                  updateTrackingField(order, 'trackingNumber', event.target.value)
                                }
                                placeholder="Tracking / AWB number"
                                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus:border-emerald-400 focus:outline-none"
                              />
                              <input
                                type="text"
                                value={trackingDraft.courierName}
                                onChange={(event) =>
                                  updateTrackingField(order, 'courierName', event.target.value)
                                }
                                placeholder="Courier name"
                                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus:border-emerald-400 focus:outline-none"
                              />
                              <input
                                type="text"
                                value={trackingDraft.shiprocketOrderId}
                                onChange={(event) =>
                                  updateTrackingField(order, 'shiprocketOrderId', event.target.value)
                                }
                                placeholder="Shiprocket order ID (optional)"
                                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus:border-emerald-400 focus:outline-none"
                              />
                              <input
                                type="text"
                                value={trackingDraft.estimatedDelivery}
                                onChange={(event) =>
                                  updateTrackingField(order, 'estimatedDelivery', event.target.value)
                                }
                                placeholder="Estimated delivery (e.g. 22 Feb 2026)"
                                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus:border-emerald-400 focus:outline-none"
                              />
                              <input
                                type="text"
                                value={trackingDraft.trackingUrl}
                                onChange={(event) =>
                                  updateTrackingField(order, 'trackingUrl', event.target.value)
                                }
                                placeholder="Tracking URL (optional)"
                                className="md:col-span-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus:border-emerald-400 focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950 p-4">
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                              Items
                            </p>
                            <div className="mt-3 space-y-2">
                              {(Array.isArray(order?.items) ? order.items : []).map((item, idx) => (
                                <div
                                  key={`${order.id}-${idx}`}
                                  className="flex items-center justify-between text-sm"
                                >
                                  <p className="min-w-0 flex-1 truncate text-slate-200">
                                    {item?.name || 'Item'} x{item?.quantity || 1}
                                  </p>
                                  <p className="font-semibold text-slate-100">
                                    {formatMoney(
                                      Number(item?.price || 0) * Number(item?.quantity || 1),
                                      item?.currency || currency,
                                    )}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
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
          Page {meta.page} of {totalPages}
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

export default AdminOrders;
