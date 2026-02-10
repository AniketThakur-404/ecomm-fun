import React from 'react';
import { Search, User, ShoppingBag, Filter, ChevronRight, RefreshCw, Box, ArrowRight } from 'lucide-react';

export default function OrderDetails() {
    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <div className="bg-white px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-3">
                    <button className="p-1">
                        {/* Hamburger Menu Icon Placeholder */}
                        <div className="space-y-1">
                            <div className="w-5 h-0.5 bg-gray-600"></div>
                            <div className="w-5 h-0.5 bg-gray-600"></div>
                            <div className="w-5 h-0.5 bg-gray-600"></div>
                        </div>
                    </button>
                    {/* Myntra Logo Placeholder */}
                    <img src="/aradhya-logo.png" alt="Aradhya" className="h-8 w-auto" />
                </div>
                <div className="flex items-center gap-4 text-gray-600">
                    <Search className="w-6 h-6" />
                    <User className="w-6 h-6" />
                    <ShoppingBag className="w-6 h-6" />
                </div>
            </div>

            {/* Insider Banner */}
            <div className="bg-gradient-to-r from-blue-50 to-pink-50 p-3 flex justify-between items-center">
                <div>
                    <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide">ARADHYA INSIDER</h3>
                    <p className="text-[10px] text-gray-600">Earn 10 supercoins for every ₹ 100 purchase</p>
                </div>
                <button className="bg-pink-500 text-white text-xs font-bold px-4 py-2 rounded shadow-sm">
                    Enroll Now
                </button>
            </div>

            {/* Search and Filter */}
            <div className="bg-white p-3 flex gap-3">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search in orders"
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-400"
                    />
                </div>
                <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded font-bold text-gray-700 text-sm">
                    <Filter className="w-4 h-4" /> FILTER
                </button>
            </div>

            {/* Promo Banner */}
            <div className="mx-3 mt-3 bg-white p-3 rounded-lg shadow-sm flex items-center justify-between border border-gray-100">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-600 font-bold text-xs">₹</div>
                    <div>
                        <p className="text-sm text-gray-800">Earn up to <span className="font-bold text-green-600">₹5000 Aradhya Cash*</span></p>
                        <p className="text-xs text-gray-500">Write a review or add images!</p>
                    </div>
                </div>
                <div className="w-6 h-6 bg-pink-500 rounded-full flex items-center justify-center text-white">
                    <ChevronRight className="w-4 h-4" />
                </div>
            </div>

            {/* Order Item 1 */}
            <div className="bg-white mt-3 p-4">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-teal-700 rounded-full flex items-center justify-center">
                        <Box className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-teal-700 text-sm">Confirmed</h3>
                        <p className="text-xs text-gray-500">Arriving by Thu, 4 Dec</p>
                    </div>
                </div>

                <div className="bg-gray-50 p-3 rounded-lg flex gap-3">
                    <img src="https://images.unsplash.com/photo-1596755094514-f87e34085b2c?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80" alt="Shoes" className="w-16 h-16 object-cover rounded" />
                    <div className="flex-1">
                        <h4 className="font-bold text-gray-900 text-sm">Puma</h4>
                        <p className="text-xs text-gray-600">Carina Slim Perf Women Sneakers</p>
                        <p className="text-xs text-gray-500 mt-1">Size: 7</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>

                <div className="flex gap-3 mt-3">
                    <button className="flex-1 py-2 border border-gray-300 rounded text-sm font-bold text-gray-700">Cancel</button>
                    <button className="flex-1 py-2 border border-gray-300 rounded text-sm font-bold text-gray-700">Replace</button>
                </div>

                <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                        <RefreshCw className="w-4 h-4" />
                        <span>Replacement is available</span>
                        <span className="bg-pink-500 text-white px-1 rounded text-[10px] font-bold">NEW</span>
                    </div>
                    <button className="text-pink-600 font-bold text-xs">Know More</button>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs text-gray-500">Bought this for</span>
                    <div className="flex gap-2">
                        <button className="px-3 py-1 border border-gray-200 rounded-full text-xs font-bold text-gray-700">Rik</button>
                        <button className="px-3 py-1 border border-gray-200 rounded-full text-xs font-bold text-gray-700">Add Profile</button>
                    </div>
                </div>
            </div>

            {/* Order Item 2 */}
            <div className="bg-white mt-3 p-4">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center">
                        <RefreshCw className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900 text-sm">Refund Credited</h3>
                        <p className="text-xs text-gray-500 leading-tight">
                            Your refund of <span className="font-bold text-gray-900">₹480.00</span> for the return has been processed successfully on Mon, 8 Sep. <span className="text-pink-600 font-bold">View Refund details</span>
                        </p>
                    </div>
                </div>

                <div className="bg-gray-50 p-3 rounded-lg flex gap-3">
                    <img src="https://images.unsplash.com/photo-1599643478518-17488fbbcd75?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80" alt="Necklace" className="w-16 h-16 object-cover rounded" />
                    <div className="flex-1">
                        <h4 className="font-bold text-gray-900 text-sm">LITCHI</h4>
                        <p className="text-xs text-gray-600">Silver-Toned Stainless Steel Necklace</p>
                        <p className="text-xs text-gray-500 mt-1">Size: Onesize</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
            </div>
        </div>
    );
}
