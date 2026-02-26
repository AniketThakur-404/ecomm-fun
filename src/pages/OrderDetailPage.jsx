import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  Package,
  Truck,
  CheckCircle,
  Clock,
  ArrowLeft,
  MapPin,
  Phone,
  Mail,
  Calendar,
} from 'lucide-react';
import { useAuth } from '../contexts/auth-context';
import { formatMoney } from '../lib/api';
import { useNotifications } from '../components/NotificationProvider';

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

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

const statusMeta = (status) => {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'FULFILLED') {
    return {
      label: 'Delivered',
      tone: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      Icon: CheckCircle,
      description: 'Your order has been delivered successfully.',
    };
  }
  if (normalized === 'PAID') {
    return {
      label: 'Paid',
      tone: 'text-blue-700 bg-blue-50 border-blue-200',
      Icon: Truck,
      description: 'Payment confirmed. Your order is being processed.',
    };
  }
  if (normalized === 'PENDING') {
    return {
      label: 'Pending',
      tone: 'text-amber-700 bg-amber-50 border-amber-200',
      Icon: Clock,
      description: 'Your order is being processed.',
    };
  }
  if (normalized === 'CANCELLED') {
    return {
      label: 'Cancelled',
      tone: 'text-rose-700 bg-rose-50 border-rose-200',
      Icon: Package,
      description: 'This order has been cancelled.',
    };
  }
  return {
    label: normalized || 'Unknown',
    tone: 'text-gray-700 bg-gray-100 border-gray-200',
    Icon: Package,
    description: 'Order status unknown.',
  };
};

const OrderDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { orders, isAuthenticated, loading: authLoading } = useAuth();
  const { notify } = useNotifications();
  const [order, setOrder] = useState(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login?redirect=/orders');
      return;
    }
  }, [isAuthenticated, authLoading, navigate]);

  useEffect(() => {
    if (location.state?.justPlaced && order) {
      notify({
        title: 'Order Confirmed!',
        message: `Your order ${order.number || order.id} has been placed successfully.`,
      });
    }
  }, [location.state, order, notify]);

  useEffect(() => {
    if (!id || !orders.length) return;
    const found = orders.find((o) => o.id === id || o.number === id);
    setOrder(found || null);
  }, [id, orders]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading order...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 px-4">
        <Package className="w-16 h-16 text-gray-400" />
        <p className="text-lg font-semibold text-gray-900">Order not found</p>
        <p className="text-sm text-gray-600">We couldn't find this order in your account.</p>
        <div className="flex gap-3">
          <Link
            to="/orders"
            className="px-4 py-2 rounded-full text-sm font-semibold bg-black text-white hover:bg-gray-900"
          >
            View All Orders
          </Link>
          <Link
            to="/products"
            className="px-4 py-2 rounded-full text-sm font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  const meta = statusMeta(order.status);
  const Icon = meta.Icon;
  const items = Array.isArray(order.items) ? order.items : [];
  const currency = order.totals?.currency || 'INR';
  const subtotal = Number(order.totals?.subtotal ?? 0);
  const shippingFee = Number(order.totals?.shippingFee ?? 0);
  const paymentFee = Number(order.totals?.paymentFee ?? 0);
  const discountAmount = Number(order.totals?.discountAmount ?? 0);
  const discountCode = String(order.totals?.discountCode || '').trim();
  const total = Number(order.totals?.total ?? 0);
  const shipping = order.shipping || {};

  const statusToken = String(order.status || '').toUpperCase();
  const timeline =
    statusToken === 'CANCELLED'
      ? [
          {
            status: 'Order Placed',
            date: formatDateTime(order.createdAt),
            completed: true,
            current: false,
          },
          {
            status: 'Order Cancelled',
            date: formatDateTime(order.updatedAt),
            completed: true,
            current: true,
          },
        ]
      : [
          {
            status: 'Order Placed',
            date: formatDateTime(order.createdAt),
            completed: true,
            current: order.status === 'PENDING',
          },
          {
            status: 'Payment Confirmed',
            date: order.status !== 'PENDING' ? formatDateTime(order.updatedAt) : '-',
            completed: order.status !== 'PENDING',
            current: order.status === 'PAID',
          },
          {
            status: 'Delivered',
            date: order.status === 'FULFILLED' ? formatDateTime(order.updatedAt) : '-',
            completed: order.status === 'FULFILLED',
            current: order.status === 'FULFILLED',
          },
        ];

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Order Details</h1>
              <p className="text-sm text-gray-500">Order #{order.number || order.id}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        {/* Status Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center border-2 ${meta.tone}`}
              >
                <Icon className="w-7 h-7" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  Order Status
                </p>
                <h2 className="text-2xl font-bold text-gray-900 mt-1">{meta.label}</h2>
                <p className="text-sm text-gray-600 mt-1">{meta.description}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Placed on</p>
              <p className="text-sm font-semibold text-gray-900">{formatDate(order.createdAt)}</p>
            </div>
          </div>

          {/* Timeline */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Order Timeline
            </p>
            <div className="relative pl-8">
              <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gray-200"></div>
              <div className="space-y-6">
                {timeline.map((step, index) => (
                  <div key={index} className="relative flex items-start gap-4">
                    <div
                      className={`relative z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        step.completed
                          ? 'bg-emerald-500 border-emerald-500'
                          : step.current
                            ? 'bg-blue-500 border-blue-500'
                            : 'bg-white border-gray-300'
                      }`}
                    >
                      {step.completed && <CheckCircle className="w-4 h-4 text-white" />}
                    </div>
                    <div className="flex-1">
                      <p
                        className={`font-semibold ${
                          step.completed || step.current ? 'text-gray-900' : 'text-gray-400'
                        }`}
                      >
                        {step.status}
                      </p>
                      <p className="text-sm text-gray-500">{step.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Items & Summary */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Items */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Order Items</h3>
              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={`${order.id}-${index}`} className="flex items-center gap-4 pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                    <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-xs font-semibold flex-shrink-0">
                      {item.name?.slice(0, 2)?.toUpperCase() || 'IT'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{item.name || 'Item'}</p>
                      <p className="text-sm text-gray-500">
                        Qty: {item.quantity || 1}
                        {item.sku ? ` • SKU: ${item.sku}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">
                        {formatMoney(
                          Number(item.price || 0) * Number(item.quantity || 1),
                          item.currency || currency,
                        )}
                      </p>
                      {item.price ? (
                        <p className="text-sm text-gray-500">
                          {formatMoney(Number(item.price || 0), item.currency || currency)} each
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Shipping Address */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-5 h-5 text-gray-600" />
                <h3 className="text-lg font-bold text-gray-900">Shipping Address</h3>
              </div>
              <div className="space-y-2 text-sm text-gray-700">
                <p className="font-semibold text-gray-900">{shipping.fullName || 'N/A'}</p>
                <p>{shipping.address || '-'}</p>
                <p>
                  {shipping.city || ''} {shipping.postalCode || ''}
                </p>
                {shipping.phone ? (
                  <div className="flex items-center gap-2 mt-3">
                    <Phone className="w-4 h-4 text-gray-500" />
                    <span>{shipping.phone}</span>
                  </div>
                ) : null}
                {shipping.email ? (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-500" />
                    <span>{shipping.email}</span>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Tracking Info */}
            {shipping.trackingNumber || shipping.courierName ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Truck className="w-5 h-5 text-gray-600" />
                  <h3 className="text-lg font-bold text-gray-900">Tracking Information</h3>
                </div>
                <div className="space-y-2 text-sm">
                  {shipping.trackingNumber ? (
                    <div>
                      <p className="text-gray-500">Tracking Number</p>
                      <p className="font-semibold text-gray-900">{shipping.trackingNumber}</p>
                    </div>
                  ) : null}
                  {shipping.courierName ? (
                    <div>
                      <p className="text-gray-500">Courier</p>
                      <p className="font-semibold text-gray-900">{shipping.courierName}</p>
                    </div>
                  ) : null}
                  {shipping.estimatedDelivery ? (
                    <div>
                      <p className="text-gray-500">Estimated Delivery</p>
                      <p className="font-semibold text-gray-900">{shipping.estimatedDelivery}</p>
                    </div>
                  ) : null}
                  {shipping.trackingUrl ? (
                    <a
                      href={shipping.trackingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-full text-sm font-semibold bg-black text-white hover:bg-gray-900"
                    >
                      Track Package
                      <ArrowLeft className="w-4 h-4 rotate-180" />
                    </a>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm sticky top-24">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Order Summary</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-gray-700">
                  <span>Subtotal</span>
                  <span>{formatMoney(subtotal, currency)}</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>Shipping</span>
                  <span>{shippingFee > 0 ? formatMoney(shippingFee, currency) : 'Free'}</span>
                </div>
                {paymentFee > 0 ? (
                  <div className="flex justify-between text-gray-700">
                    <span>Payment Fee</span>
                    <span>{formatMoney(paymentFee, currency)}</span>
                  </div>
                ) : null}
                {discountAmount > 0 ? (
                  <div className="flex justify-between text-emerald-700">
                    <span>Discount{discountCode ? ` (${discountCode})` : ''}</span>
                    <span>-{formatMoney(discountAmount, currency)}</span>
                  </div>
                ) : null}
                {order.paymentMethod ? (
                  <div className="flex justify-between text-gray-700">
                    <span>Payment Method</span>
                    <span className="font-semibold">{order.paymentMethod}</span>
                  </div>
                ) : null}
                <div className="border-t border-gray-200 pt-3">
                  <div className="flex justify-between text-base font-bold text-gray-900">
                    <span>Total</span>
                    <span>{formatMoney(total, currency)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {statusToken !== 'CANCELLED' ? (
                  <Link
                    to={`/cancel-refund-exchange?orderId=${encodeURIComponent(order.id)}`}
                    className="block w-full px-4 py-3 rounded-lg text-sm font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50 text-center transition"
                  >
                    Return / Exchange
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetailPage;
