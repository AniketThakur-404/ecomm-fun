import React, { useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronRight, Percent, Wallet, CreditCard, Banknote } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function Payment() {
    const navigate = useNavigate();
    const [selectedPayment, setSelectedPayment] = useState('cod');

    const paymentOptions = [
        { id: 'upi', label: 'UPI (Pay via any App)', icon: 'UPI' },
        { id: 'card', label: 'Credit/Debit Card', offer: '5 Offers', icon: 'CARD' },
        { id: 'paylater', label: 'Pay Later', icon: 'CLOCK' },
        { id: 'wallets', label: 'Wallets', offer: '1 Offer', icon: 'WALLET' },
        { id: 'emi', label: 'EMI', offer: '1 Offer', icon: 'EMI' },
        { id: 'netbanking', label: 'Net Banking', icon: 'BANK' },
    ];

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <div className="bg-white px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-1">
                        <ArrowLeft className="w-6 h-6 text-gray-700" />
                    </button>
                    <h1 className="text-lg font-semibold text-gray-800">PAYMENT</h1>
                </div>
                <div className="text-xs font-medium text-gray-500">STEP 3/3</div>
            </div>

            {/* Bank Offer */}
            <div className="bg-white mt-2 p-4">
                <div className="flex items-center gap-3 mb-2">
                    <Percent className="w-5 h-5 text-gray-800" />
                    <h2 className="font-bold text-gray-800 text-sm">Bank Offer</h2>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed pl-8">
                    10% Instant Discount on PNB Credit Card on a min spend of ₹3,000.TCA
                </p>
                <button className="text-pink-600 font-bold text-xs mt-2 pl-8 flex items-center">
                    Show More <ChevronDown className="w-4 h-4" />
                </button>
            </div>

            {/* Recommended Payment Options */}
            <div className="mt-4">
                <h3 className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">RECOMMENDED PAYMENT OPTIONS</h3>

                <div className="bg-white p-4">
                    <div className="flex items-start gap-3" onClick={() => setSelectedPayment('cod')}>
                        <div className="mt-1">
                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${selectedPayment === 'cod' ? 'border-pink-600' : 'border-gray-400'}`}>
                                {selectedPayment === 'cod' && <div className="w-3 h-3 bg-pink-600 rounded-full" />}
                            </div>
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between items-center">
                                <h4 className="font-bold text-gray-900 text-sm">Cash on Delivery (Cash/UPI)</h4>
                                <div className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center">
                                    <Banknote className="w-4 h-4 text-gray-600" />
                                </div>
                            </div>
                            <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                                For this option, there is a fee of ₹ 10. You can Pay online to avoid this.
                            </p>

                            <Link to="/orders">
                                <button className="w-full bg-pink-600 text-white font-bold py-3 rounded-sm uppercase tracking-wide mt-4">
                                    Place Order
                                </button>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* Online Payment Options */}
            <div className="mt-4">
                <h3 className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">ONLINE PAYMENT OPTIONS</h3>

                <div className="bg-white">
                    {paymentOptions.map((option) => (
                        <div
                            key={option.id}
                            className={`flex items-center justify-between p-4 border-b border-gray-100 last:border-0 ${selectedPayment === option.id ? 'bg-pink-50' : ''}`}
                            onClick={() => setSelectedPayment(option.id)}
                        >
                            <div className="flex items-center gap-4">
                                {/* Icons would be better with specific SVGs, using generic placeholders for now */}
                                {option.id === 'upi' && <span className="font-bold text-[10px] border border-gray-300 px-1 rounded">UPI</span>}
                                {option.id === 'card' && <CreditCard className="w-5 h-5 text-gray-600" />}
                                {option.id === 'paylater' && <Banknote className="w-5 h-5 text-gray-600" />}
                                {option.id === 'wallets' && <Wallet className="w-5 h-5 text-gray-600" />}
                                {option.id === 'emi' && <span className="font-bold text-[10px] border border-gray-300 px-1 rounded">EMI</span>}
                                {option.id === 'netbanking' && <span className="font-bold text-[10px] border border-gray-300 px-1 rounded">NB</span>}

                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-800">{option.label}</span>
                                    {option.offer && <span className="text-xs text-teal-600 font-bold">{option.offer}</span>}
                                </div>
                            </div>
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Footer Placeholder for spacing */}
            <div className="h-10"></div>
        </div>
    );
}
