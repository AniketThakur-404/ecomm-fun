import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { extractSizeOptions, findVariantForSize } from '../lib/api';

const getSizeOptions = (item) => extractSizeOptions(item);

const getSizeAvailability = (item, size) => {
    const variant = findVariantForSize(item, size);
    if (!variant) {
        const fallback = item?.availableForSale ?? true;
        return { inStock: fallback, lowStock: false, quantity: null };
    }
    const qty = Number.isFinite(variant.quantityAvailable)
        ? variant.quantityAvailable
        : null;
    const inStock = Boolean(variant.availableForSale) && (qty == null || qty > 0);
    const lowStock = inStock && qty != null && qty <= 5;
    return { inStock, lowStock, quantity: qty };
};

const SizeSelectionModal = ({ isOpen, onClose, items = [], onConfirm }) => {
    const [selections, setSelections] = useState({});

    useEffect(() => {
        if (isOpen) {
            // Initialize selections for incoming items
            const initial = {};
            items.forEach(item => {
                const sizes = getSizeOptions(item);
                if (sizes.length > 0) {
                    const firstInStock =
                        sizes.find((size) => getSizeAvailability(item, size).inStock) ??
                        sizes[0];
                    initial[item.handle] = firstInStock;
                }
            });
            setSelections(initial);
        }
    }, [isOpen, items]);

    if (!isOpen) return null;

    const handleSelection = (handle, size) => {
        setSelections(prev => ({ ...prev, [handle]: size }));
    };

    const handleConfirm = () => {
        const finalItems = items.map(item => ({
            handle: item.handle,
            size: selections[item.handle] || null,
            quantity: 1
        }));
        onConfirm(finalItems);
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-white rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-gray-900">Select Options</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-6 h-6 text-gray-500" />
                    </button>
                </div>

                <div className="p-4 max-h-[60vh] overflow-y-auto space-y-6">
                    {items.map(item => {
                        const sizes = getSizeOptions(item);
                        const hasSizes = sizes.length > 0;
                        const currentSize = selections[item.handle];
                        const selectedAvailability = currentSize
                            ? getSizeAvailability(item, currentSize)
                            : null;

                        return (
                            <div key={item.handle} className="space-y-2">
                                <p className="font-semibold text-gray-900">{item.title}</p>
                                {hasSizes ? (
                                    <div className="flex flex-wrap gap-2">
                                        {sizes.map(size => {
                                            const availability = getSizeAvailability(item, size);
                                            const isOut = !availability.inStock;
                                            const isSelected = currentSize === size;
                                            return (
                                                <button
                                                    key={size}
                                                    onClick={() => handleSelection(item.handle, size)}
                                                    disabled={isOut}
                                                    className={`min-w-[40px] h-10 px-3 border rounded text-sm font-medium transition-all ${isSelected
                                                        ? 'border-black bg-black text-white'
                                                        : 'border-gray-200 text-gray-700 hover:border-black'
                                                        } ${isOut ? 'bg-gray-50 text-gray-400 cursor-not-allowed hover:border-gray-200' : ''}`}
                                                    title={isOut ? 'Out of stock' : availability.lowStock ? 'Low stock' : 'In stock'}
                                                >
                                                    {size}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500">One Size</p>
                                )}
                                {selectedAvailability?.inStock ? (
                                    selectedAvailability.lowStock ? (
                                        <p className="text-xs text-orange-600">
                                            {Number.isFinite(selectedAvailability.quantity)
                                                ? `Only ${selectedAvailability.quantity} left`
                                                : 'Low stock'}
                                        </p>
                                    ) : null
                                ) : (
                                    <p className="text-xs text-rose-600">Out of stock</p>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50">
                    <button
                        onClick={handleConfirm}
                        className="w-full bg-[#1a1a2e] text-white font-bold text-sm py-4 uppercase tracking-widest hover:bg-gray-900 transition-colors rounded-sm"
                    >
                        Confirm and Add to Cart
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SizeSelectionModal;
