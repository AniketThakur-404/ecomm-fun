import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Banknote,
  CreditCard,
  Landmark,
  Smartphone,
  Wallet,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import {
  confirmRazorpayCheckout,
  createOrder,
  createRazorpayOrder,
  formatMoney,
} from '../lib/api';
import { useAuth } from '../contexts/auth-context';
import { useCart } from '../contexts/cart-context';
import {
  clearCheckoutDraft,
  getCheckoutDraft,
  setCheckoutDraft,
} from '../lib/checkout';

const PAYMENT_METHODS = [
  {
    id: 'COD',
    label: 'Cash on Delivery',
    description: 'Pay when the package is delivered.',
    icon: Banknote,
    fee: 10,
  },
  {
    id: 'UPI',
    label: 'UPI',
    description: 'Pay instantly via any UPI app.',
    icon: Smartphone,
    fee: 0,
  },
  {
    id: 'CARD',
    label: 'Credit / Debit Card',
    description: 'Visa, Mastercard, Rupay and more.',
    icon: CreditCard,
    fee: 0,
  },
  {
    id: 'NET_BANKING',
    label: 'Net Banking',
    description: 'Secure transfer from your bank account.',
    icon: Landmark,
    fee: 0,
  },
  {
    id: 'WALLET',
    label: 'Wallets',
    description: 'Paytm, PhonePe, Amazon Pay and others.',
    icon: Wallet,
    fee: 0,
  },
];

const getPaymentMethodMeta = (methodId) =>
  PAYMENT_METHODS.find((item) => item.id === methodId) || PAYMENT_METHODS[0];

const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';
let razorpayScriptPromise = null;

const loadRazorpayScript = () => {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (razorpayScriptPromise) return razorpayScriptPromise;

  razorpayScriptPromise = new Promise((resolve) => {
    const existing = document.querySelector(`script[src="${RAZORPAY_SCRIPT_URL}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(Boolean(window.Razorpay)));
      existing.addEventListener('error', () => resolve(false));
      return;
    }

    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

  return razorpayScriptPromise;
};

export default function Payment() {
  const navigate = useNavigate();
  const { removeItem } = useCart();
  const { isAuthenticated, getAuthToken, refreshCustomer } = useAuth();

  const [draft, setDraft] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState('COD');
  const [placingOrder, setPlacingOrder] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const currentDraft = getCheckoutDraft();
    if (!currentDraft?.items?.length) {
      navigate('/cart', { replace: true });
      return;
    }
    if (!currentDraft?.shipping) {
      navigate('/checkout/address', { replace: true });
      return;
    }

    setDraft(currentDraft);
    setSelectedPayment(currentDraft.paymentMethod || 'COD');
  }, [navigate]);

  useEffect(() => {
    if (!draft) return;
    const nextDraft = { ...draft, paymentMethod: selectedPayment };
    setDraft(nextDraft);
    setCheckoutDraft(nextDraft);
  }, [selectedPayment]);

  const itemCount = useMemo(
    () => (draft?.items || []).reduce((sum, item) => sum + Number(item?.quantity || 0), 0),
    [draft?.items],
  );

  const currency = draft?.totals?.currency || 'INR';
  const subtotal = Number(draft?.totals?.subtotal ?? 0);
  const shippingFee = Number(draft?.totals?.shippingFee ?? 0);
  const selectedMethodMeta = getPaymentMethodMeta(selectedPayment);
  const paymentFee = Number(selectedMethodMeta?.fee || 0);
  const finalTotal = subtotal + shippingFee + paymentFee;

  const orderItems = useMemo(
    () =>
      (draft?.items || []).map((item) => ({
        id: item.id || undefined,
        sku: item.sku || undefined,
        name: item.name || item.slug || 'Product',
        price: Number(item.price || 0),
        currency: item.currency || currency,
        quantity: Number(item.quantity || 1),
      })),
    [currency, draft?.items],
  );

  const handlePlaceOrder = async () => {
    if (!draft?.items?.length || placingOrder) {
      setError('Please select items to checkout.');
      return;
    }
    setError('');

    if (!isAuthenticated) {
      navigate('/login?redirect=/checkout/payment');
      return;
    }

    const token = typeof getAuthToken === 'function' ? getAuthToken() : null;
    if (!token) {
      setError('Session expired. Please log in again.');
      navigate('/login?redirect=/checkout/payment');
      return;
    }

    // Validate order data
    if (!draft.shipping?.fullName || !draft.shipping?.address) {
      setError('Shipping address is incomplete. Please go back and complete your address.');
      return;
    }

    if (finalTotal <= 0) {
      setError('Order total is invalid. Please refresh and try again.');
      return;
    }

    try {
      setPlacingOrder(true);
      const payload = {
        paymentMethod: selectedPayment,
        totals: {
          subtotal,
          shippingFee,
          total: finalTotal,
          currency,
        },
        shipping: draft.shipping,
        items: orderItems,
      };

      let createdOrder = null;
      if (selectedPayment === 'COD') {
        createdOrder = await createOrder(token, payload);
      } else {
        const scriptReady = await loadRazorpayScript();
        if (!scriptReady || !window.Razorpay) {
          throw new Error('Unable to load Razorpay checkout. Please try again.');
        }

        const razorpayOrderPayload = await createRazorpayOrder(token, {
          amount: Math.round(finalTotal * 100),
          currency,
          receipt: `rcpt_${Date.now()}`,
          notes: {
            customerEmail: draft?.shipping?.email || '',
            customerPhone: draft?.shipping?.phone || '',
          },
        });

        createdOrder = await new Promise((resolve, reject) => {
          const options = {
            key: razorpayOrderPayload?.keyId,
            amount: razorpayOrderPayload?.order?.amount,
            currency: razorpayOrderPayload?.order?.currency || currency,
            name: 'Aradhya',
            description: `Order payment (${selectedPayment})`,
            order_id: razorpayOrderPayload?.order?.id,
            prefill: {
              name: draft?.shipping?.fullName || '',
              email: draft?.shipping?.email || '',
              contact: draft?.shipping?.phone || '',
            },
            notes: {
              checkoutMethod: selectedPayment,
            },
            theme: {
              color: '#000000',
            },
            modal: {
              ondismiss: () => reject(new Error('Payment cancelled.')),
            },
            handler: async (response) => {
              try {
                const confirmedOrder = await confirmRazorpayCheckout(token, {
                  payment: {
                    razorpayOrderId: response?.razorpay_order_id,
                    razorpayPaymentId: response?.razorpay_payment_id,
                    razorpaySignature: response?.razorpay_signature,
                  },
                  order: payload,
                });
                resolve(confirmedOrder);
              } catch (verificationErr) {
                reject(verificationErr);
              }
            },
          };

          const razorpay = new window.Razorpay(options);
          razorpay.on('payment.failed', (event) => {
            const reason =
              event?.error?.description ||
              event?.error?.reason ||
              event?.error?.code ||
              'Payment failed.';
            reject(new Error(reason));
          });
          razorpay.open();
        });
      }

      (draft.items || []).forEach((item) => {
        removeItem(item.slug, item.size ?? null);
      });
      clearCheckoutDraft();

      if (typeof refreshCustomer === 'function') {
        await refreshCustomer();
      }

      navigate(`/orders/${createdOrder?.id || createdOrder?.number}`, {
        replace: true,
        state: {
          justPlaced: true,
          orderNumber: createdOrder?.number || null,
          order: createdOrder,
        },
      });
    } catch (err) {
      console.error('Order placement error:', err);
      const errorMessage =
        err?.message ||
        err?.payload?.error?.message ||
        'Unable to place order right now. Please try again or contact support.';
      
      if (err?.status === 401 || err?.status === 403) {
        setError('Session expired. Please log in again.');
        setTimeout(() => {
          navigate('/login?redirect=/checkout/payment');
        }, 2000);
      } else if (err?.status === 400) {
        setError('Invalid order data. Please refresh and try again.');
      } else if (err?.status === 500) {
        setError('Server error. Please try again in a moment.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setPlacingOrder(false);
    }
  };

  if (!draft) return null;

  return (
    <div className="min-h-screen bg-[#f7f7fa] pb-24">
      <div className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => navigate(-1)} className="rounded p-1 text-gray-700 hover:bg-gray-100">
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h1 className="text-lg font-bold tracking-wide text-[var(--color-text-main)]">PAYMENT</h1>
          </div>
          <span className="text-xs font-semibold text-gray-500">STEP 3/3</span>
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-4">
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-[var(--color-text-main)]">Deliver to</p>
          <p className="text-sm font-semibold text-gray-900">{draft.shipping?.fullName}</p>
          <p className="text-sm text-gray-600">{draft.shipping?.address}</p>
          <p className="text-sm text-gray-600">
            {draft.shipping?.city} {draft.shipping?.postalCode}
          </p>
          <p className="mt-1 text-sm text-gray-600">{draft.shipping?.phone}</p>
          <Link
            to="/checkout/address"
            className="mt-3 inline-flex text-xs font-semibold text-black hover:underline"
          >
            Change address
          </Link>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500">Select payment method</p>
          </div>
          <div className="divide-y divide-gray-100">
            {PAYMENT_METHODS.map((method) => {
              const isSelected = selectedPayment === method.id;
              const Icon = method.icon;
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => setSelectedPayment(method.id)}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left transition ${
                    isSelected ? '' : 'hover:bg-gray-50'
                  }`}
                  style={isSelected ? { backgroundColor: 'rgba(17, 24, 39, 0.08)' } : undefined}
                >
                  <span
                    className={`mt-1 h-5 w-5 rounded-full border-2 ${
                      isSelected ? 'border-black' : 'border-gray-300'
                    }`}
                  >
                    <span
                      className={`mx-auto mt-[3px] block h-2.5 w-2.5 rounded-full ${
                        isSelected ? 'bg-black' : 'bg-transparent'
                      }`}
                    />
                  </span>
                  <Icon className="mt-0.5 h-4 w-4 text-gray-600" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900">{method.label}</p>
                      {method.fee > 0 ? (
                        <span className="text-xs font-semibold text-gray-700">
                          +{formatMoney(method.fee, currency)}
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-emerald-600">No extra fee</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{method.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-[var(--color-text-main)]">Order Summary</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-700">
              <span>Subtotal ({itemCount} items)</span>
              <span>{formatMoney(subtotal, currency)}</span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>Shipping</span>
              <span>{shippingFee > 0 ? formatMoney(shippingFee, currency) : 'Free'}</span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>{selectedMethodMeta.label} fee</span>
              <span>{paymentFee > 0 ? formatMoney(paymentFee, currency) : formatMoney(0, currency)}</span>
            </div>
            <div className="border-t border-gray-200 pt-2">
              <div className="flex justify-between text-base font-bold text-[var(--color-text-main)]">
                <span>Total</span>
                <span>{formatMoney(finalTotal, currency)}</span>
              </div>
            </div>
          </div>
        </section>

        {!isAuthenticated ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
            <span className="font-bold">⚠</span>
            <div>
              <p className="font-semibold">Login Required</p>
              <p className="text-xs mt-1">Please login to place this order.</p>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 flex items-start gap-2">
            <span className="font-bold">✕</span>
            <div className="flex-1">
              <p className="font-semibold">Error</p>
              <p className="text-xs mt-1">{error}</p>
            </div>
          </div>
        ) : null}

        {placingOrder && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span>Processing your order...</span>
          </div>
        )}
      </div>

      <div className="fixed bottom-[60px] md:bottom-0 left-0 right-0 z-30 border-t border-gray-200 bg-white px-4 py-3 shadow-[0_-4px_10px_rgba(0,0,0,0.04)]">
        <button
          type="button"
          onClick={handlePlaceOrder}
          disabled={placingOrder}
          className="w-full rounded-sm bg-black py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-gray-900 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
        >
          {placingOrder ? 'Placing Order...' : `Place Order • ${formatMoney(finalTotal, currency)}`}
        </button>
      </div>
    </div>
  );
}
