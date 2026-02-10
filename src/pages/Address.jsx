import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function Address() {
    const navigate = useNavigate();

    const deliveryEstimates = [
        {
            id: 1,
            image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80', // Placeholder
            date: '8 Nov 2025'
        },
        {
            id: 2,
            image: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80', // Placeholder
            date: '10 Nov 2025'
        },
        {
            id: 3,
            image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80', // Placeholder
            date: '11 Nov - 13 Nov'
        }
    ];

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <div className="bg-white px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-1">
                        <ArrowLeft className="w-6 h-6 text-gray-700" />
                    </button>
                    <h1 className="text-lg font-semibold text-gray-800">ADDRESS</h1>
                </div>
                <div className="text-xs font-medium text-gray-500">STEP 2/3</div>
            </div>

            {/* Address Details */}
            <div className="bg-white mt-2 p-4">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                        <h2 className="font-bold text-gray-900">Rik Samanta</h2>
                        <span className="text-xs text-gray-500">(Default)</span>
                        <span className="px-2 py-0.5 border border-teal-500 text-teal-600 text-[10px] font-bold rounded-full">HOME</span>
                    </div>
                    <button className="text-pink-600 font-bold text-sm">Change</button>
                </div>
                <div className="mt-2 text-sm text-gray-600 leading-relaxed">
                    Sarada Majhpara Near Sarada Post Office<br />
                    Sarda<br />
                    Howrah, West Bengal 711413
                </div>
                <div className="mt-3 text-sm font-medium text-gray-800">
                    Mobile: <span className="font-bold">8116782334</span>
                </div>
            </div>

            {/* Delivery Estimates */}
            <div className="mt-4 bg-white">
                <div className="px-4 py-3 border-b border-gray-100">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">DELIVERY ESTIMATES</h3>
                </div>

                <div>
                    {deliveryEstimates.map((item, index) => (
                        <div key={item.id} className={`flex items-center gap-4 p-4 ${index !== deliveryEstimates.length - 1 ? 'border-b border-gray-100 border-dashed' : ''}`}>
                            <img src={item.image} alt="Product" className="w-12 h-16 object-cover rounded-sm" />
                            <div className="text-sm text-gray-700">
                                {item.date.includes('-') ? 'Delivery between' : 'Estimated delivery by'} <span className="font-bold text-gray-900">{item.date}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Footer */}
            <div className="fixed bottom-0 left-0 right-0 bg-white p-4 border-t border-gray-200 z-20">
                <Link to="/checkout/payment">
                    <button className="w-full bg-pink-600 text-white font-bold py-3 rounded-sm uppercase tracking-wide">
                        Continue
                    </button>
                </Link>
            </div>
        </div>
    );
}
