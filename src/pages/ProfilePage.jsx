import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/auth-context';
import { formatMoney } from '../lib/api';
import {
    User,
    Package,
    MapPin,
    LogOut,
    Loader2,
    Mail,
    Truck,
    BadgeCheck,
    AlertCircle,
    ArrowUpRight,
} from 'lucide-react';

const toneClasses = {
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    info: 'bg-blue-50 text-blue-700 border border-blue-200',
    warning: 'bg-amber-50 text-amber-800 border border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border border-rose-200',
    muted: 'bg-gray-100 text-gray-700 border border-gray-200',
};

const formatStatusLabel = (status, fallback = 'Processing') => {
    if (!status) return fallback;
    return status
        .toString()
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());
};

const ProfilePage = () => {
    const { customer, orders, isAuthenticated, loading, logout } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!loading && !isAuthenticated) {
            navigate('/login');
        }
    }, [loading, isAuthenticated, navigate]);

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    if (loading) {
        return (
            <div className="min-h-screen pt-32 pb-16 site-shell flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
        );
    }

    if (!customer) {
        return null;
    }

    const displayName = customer.name || customer.email || 'Guest';

    const currencyHint = orders[0]?.totals?.currency;

    const pendingCount = orders.filter((order) => order.status === 'PENDING').length;
    const inTransit = orders.filter((order) => order.status === 'PAID').length;
    const delivered = orders.filter((order) => order.status === 'FULFILLED').length;

    const stats = [
        { label: 'Total orders', value: orders.length },
        { label: 'Processing', value: pendingCount },
        { label: 'In transit', value: inTransit },
        { label: 'Delivered', value: delivered },
    ];

    const getFulfillmentBadge = (status) => {
        const normalized = (status || '').toUpperCase();
        if (normalized === 'FULFILLED') return { label: 'Delivered', tone: 'success', Icon: BadgeCheck };
        if (normalized === 'PAID') return { label: 'In transit', tone: 'info', Icon: Truck };
        if (normalized === 'PENDING') return { label: 'Processing', tone: 'muted', Icon: Truck };
        if (normalized === 'CANCELLED' || normalized === 'CANCELED') {
            return { label: 'Cancelled', tone: 'danger', Icon: AlertCircle };
        }
        return { label: formatStatusLabel(status, 'Processing'), tone: 'muted', Icon: Truck };
    };

    const formatDate = (date) => {
        if (!date) return '';
        const parsed = new Date(date);
        if (Number.isNaN(parsed.getTime())) return '';
        return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const renderOrderCard = (order) => {
        const items = Array.isArray(order.items) ? order.items : [];
        const itemCount = items.reduce((sum, item) => sum + Number(item?.quantity ?? 0), 0);
        const fulfillment = getFulfillmentBadge(order.status);
        const orderTotal = formatMoney(
            order?.totals?.total ?? 0,
            order?.totals?.currency ?? currencyHint
        );
        const processedDate = formatDate(order.createdAt);
        const trackHref = null;

        const normalizedStatus = (order.status || '').toUpperCase();
        const isDelivered = normalizedStatus === 'FULFILLED';
        const isCancelled = normalizedStatus === 'CANCELLED' || normalizedStatus === 'CANCELED';
        const primaryAction = isDelivered ? 'Return' : 'Cancel';
        const secondaryAction = isDelivered ? 'Exchange' : 'Replace';
        const actionHref = '/cancel-refund-exchange';

        return (
            <div key={order.id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${toneClasses[fulfillment.tone] || toneClasses.muted}`}>
                            {fulfillment.Icon ? <fulfillment.Icon className="w-5 h-5" /> : null}
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-900">{fulfillment.label}</p>
                            {processedDate ? (
                                <p className="text-xs text-gray-500">{isDelivered ? 'Delivered on ' : 'Placed on '}{processedDate}</p>
                            ) : null}
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-xs uppercase tracking-wide text-gray-500">Order #{order.number || order.id}</p>
                        <p className="text-lg font-extrabold text-gray-900">{orderTotal}</p>
                        <p className="text-xs text-gray-500">{itemCount} item{itemCount === 1 ? '' : 's'}</p>
                    </div>
                </div>

                <div className="py-4 space-y-3">
                    {items.slice(0, 3).map((item, idx) => (
                        <div key={`${order.id}-item-${idx}`} className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-md bg-gray-100 flex items-center justify-center text-gray-400 text-xs font-semibold">
                                {item.name?.slice(0, 2)?.toUpperCase() || '-'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                                <p className="text-xs text-gray-500">
                                    Qty x{item.quantity}
                                </p>
                            </div>
                        </div>
                    ))}
                    {items.length > 3 ? (
                        <p className="text-xs text-gray-500">+{items.length - 3} more item{items.length - 3 === 1 ? '' : 's'}</p>
                    ) : null}
                </div>


                <div className="pt-3 border-t border-gray-100 flex flex-col gap-3">
                    <div className="flex flex-wrap gap-2">
                        {!isCancelled ? (
                            <Link
                                to={actionHref}
                                className="flex-1 px-4 py-2 rounded-full text-xs font-semibold border border-gray-300 text-gray-700 hover:border-gray-900 hover:text-gray-900 transition-colors text-center"
                            >
                                {primaryAction}
                            </Link>
                        ) : null}
                        {!isCancelled ? (
                            <Link
                                to={actionHref}
                                className="flex-1 px-4 py-2 rounded-full text-xs font-semibold border border-gray-300 text-gray-700 hover:border-gray-900 hover:text-gray-900 transition-colors text-center"
                            >
                                {secondaryAction}
                            </Link>
                        ) : null}
                        {trackHref ? (
                            <a
                                href={trackHref}
                                target="_blank"
                                rel="noreferrer"
                                className="flex-1 px-4 py-2 rounded-full text-xs font-semibold border border-gray-300 text-gray-700 hover:border-gray-900 hover:text-gray-900 transition-colors text-center"
                            >
                                Track
                            </a>
                        ) : (
                            <span className="flex-1 px-4 py-2 rounded-full text-xs font-semibold border border-gray-200 text-gray-400 text-center cursor-not-allowed">
                                Track
                            </span>
                        )}
                    </div>
                    {isCancelled ? (
                        <p className="text-xs text-gray-500">This order was cancelled.</p>
                    ) : null}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="site-shell pt-24 pb-14 space-y-8">
                <div className="relative overflow-hidden rounded-2xl border border-pink-100 bg-gradient-to-r from-pink-50 via-orange-50 to-amber-50 p-6 shadow-sm">
                    <div className="absolute inset-0 bg-white/40 pointer-events-none" aria-hidden="true"></div>
                    <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex items-start gap-4">
                            <div className="w-16 h-16 rounded-full bg-white/80 border border-pink-100 flex items-center justify-center text-pink-600 shadow-sm">
                                <User className="w-8 h-8" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-pink-700">Welcome back</p>
                                <h1 className="text-3xl font-extrabold text-gray-900">
                                    {displayName}
                                </h1>
                                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700 mt-1">
                                    <span className="inline-flex items-center gap-2">
                                        <Mail className="w-4 h-4 text-pink-600" /> {customer.email}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Link
                                to="/checkout/address"
                                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-white/80 border border-pink-200 text-pink-700 hover:bg-white transition-colors"
                            >
                                <MapPin className="w-4 h-4" />
                                Manage addresses
                            </Link>
                            <button
                                onClick={handleLogout}
                                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-black text-white hover:bg-gray-900 transition-colors"
                            >
                                <LogOut className="w-4 h-4" />
                                Sign out
                            </button>
                        </div>
                    </div>

                    <div className="relative mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {stats.map((stat) => (
                            <div
                                key={stat.label}
                                className="rounded-xl bg-white/80 border border-white/70 px-4 py-3 shadow-sm backdrop-blur-sm"
                            >
                                <p className="text-xs uppercase tracking-wide text-gray-500">{stat.label}</p>
                                <p className="text-xl font-extrabold text-gray-900">{stat.value}</p>
                                {stat.helper ? <p className="text-xs text-gray-500">{stat.helper}</p> : null}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="space-y-4">
                        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-4">
                                <User className="w-4 h-4 text-pink-600" />
                                <p className="text-sm font-semibold text-gray-900">Profile & contact</p>
                            </div>
                            <div className="space-y-3 text-sm text-gray-700">
                                <div className="flex items-start gap-3">
                                    <Mail className="w-4 h-4 text-gray-500 mt-0.5" />
                                    <div>
                                        <p className="font-semibold text-gray-900">Email</p>
                                        <p>{customer.email}</p>
                                    </div>
                                </div>
                                <div className="text-sm text-gray-600 bg-gray-50 border border-dashed border-gray-200 rounded-lg p-3">
                                    Add a shipping address during checkout to speed up delivery updates.
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                            <p className="text-sm font-semibold text-gray-900 mb-2">Need help?</p>
                            <p className="text-sm text-gray-600 mb-4">
                                Track deliveries, raise returns, or chat with support directly from your order detail page.
                            </p>
                            <div className="flex gap-2">
                                <Link
                                    to="/contact"
                                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-gray-900 text-white hover:bg-black transition-colors"
                                >
                                    Contact support
                                </Link>
                                <Link
                                    to="/legal/return-policy"
                                    className="inline-flex items-center justify-center px-4 py-2 rounded-full text-sm font-semibold border border-gray-200 text-gray-800 hover:bg-gray-50 transition-colors"
                                >
                                    Return policy
                                </Link>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-2 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <Package className="w-5 h-5 text-pink-600" />
                                <div>
                                    <p className="text-lg font-extrabold text-gray-900">Orders & returns</p>
                                    <p className="text-sm text-gray-600">Live status for deliveries, returns, and refunds.</p>
                                </div>
                            </div>
                            <Link
                                to="/products"
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border border-gray-200 text-gray-800 hover:bg-gray-50 transition-colors"
                            >
                                Continue shopping
                                <ArrowUpRight className="w-4 h-4" />
                            </Link>
                        </div>

                        {orders.length === 0 ? (
                            <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-sm">
                                <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-pink-50 text-pink-600 flex items-center justify-center">
                                    <Package className="w-6 h-6" />
                                </div>
                                <p className="text-lg font-semibold text-gray-900">No orders yet</p>
                                <p className="text-sm text-gray-600 mb-6">When you shop, your orders, returns, and refunds will show up here.</p>
                                <Link
                                    to="/products"
                                    className="inline-flex items-center gap-2 px-5 py-3 rounded-full text-sm font-semibold bg-black text-white hover:bg-gray-900 transition-colors"
                                >
                                    Start shopping
                                    <ArrowUpRight className="w-4 h-4" />
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {orders.map((order) => renderOrderCard(order))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;
