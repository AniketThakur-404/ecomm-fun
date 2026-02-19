import React, { useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle, Package, ArrowRight, Home } from 'lucide-react';
import { formatMoney } from '../lib/api';

const OrderConfirmation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const orderNumber = location.state?.orderNumber || location.state?.order?.number || '';

  useEffect(() => {
    // Redirect to order detail if order ID is available
    if (location.state?.order?.id) {
      const timer = setTimeout(() => {
        navigate(`/orders/${location.state.order.id}`, { replace: true });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [location.state, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-gray-50 flex items-center justify-center px-4 py-16">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-200 p-8 md:p-12 text-center">
          <div className="mx-auto w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-12 h-12 text-emerald-600" />
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            Order Confirmed!
          </h1>
          {orderNumber ? (
            <p className="text-lg text-gray-600 mb-2">
              Your order <span className="font-semibold text-gray-900">#{orderNumber}</span> has been placed successfully.
            </p>
          ) : (
            <p className="text-lg text-gray-600 mb-2">
              Your order has been placed successfully.
            </p>
          )}

          <p className="text-sm text-gray-500 mb-8">
            You'll receive a confirmation email shortly with order details and tracking information.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {location.state?.order?.id ? (
              <Link
                to={`/orders/${location.state.order.id}`}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-black text-white font-semibold hover:bg-gray-900 transition"
              >
                <Package className="w-5 h-5" />
                View Order Details
              </Link>
            ) : (
              <Link
                to="/orders"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-black text-white font-semibold hover:bg-gray-900 transition"
              >
                <Package className="w-5 h-5" />
                View My Orders
              </Link>
            )}
            <Link
              to="/products"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition"
            >
              <Home className="w-5 h-5" />
              Continue Shopping
            </Link>
          </div>

          <div className="mt-8 pt-8 border-t border-gray-200">
            <p className="text-sm text-gray-600 mb-4">What's next?</p>
            <div className="grid sm:grid-cols-3 gap-4 text-left">
              <div className="p-4 rounded-lg bg-gray-50">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Step 1
                </p>
                <p className="text-sm font-semibold text-gray-900">Order Processing</p>
                <p className="text-xs text-gray-600 mt-1">
                  We're preparing your order for shipment.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-gray-50">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Step 2
                </p>
                <p className="text-sm font-semibold text-gray-900">Shipping</p>
                <p className="text-xs text-gray-600 mt-1">
                  Your order will be shipped within 1-2 business days.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-gray-50">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Step 3
                </p>
                <p className="text-sm font-semibold text-gray-900">Delivery</p>
                <p className="text-xs text-gray-600 mt-1">
                  Track your order to see real-time updates.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderConfirmation;
