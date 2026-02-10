import React, { useState } from 'react';
import { Package, RefreshCw, XCircle, ChevronRight, AlertCircle, Upload, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const CancelRefundExchange = () => {
    const [step, setStep] = useState(1);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [actionType, setActionType] = useState(''); // 'cancel', 'return', 'exchange'
    const [selectedItems, setSelectedItems] = useState([]);
    const [reason, setReason] = useState('');
    const [comments, setComments] = useState('');
    const [images, setImages] = useState([]);
    const [bankDetails, setBankDetails] = useState({
        accountName: '',
        accountNumber: '',
        ifsc: '',
        bankName: ''
    });

    // Mock Orders Data
    const orders = [
        {
            id: 'ORD-8374',
            date: 'Jan 15, 2026',
            status: 'Delivered',
            canReturn: true,
            canCancel: false,
            items: [
                {
                    id: 1,
                    name: 'Classic White Linen Shirt',
                    image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=100&q=80',
                    size: 'M',
                    price: 1499,
                    color: 'White'
                }
            ]
        },
        {
            id: 'ORD-9921',
            date: 'Jan 20, 2026',
            status: 'Processing',
            canReturn: false,
            canCancel: true,
            items: [
                {
                    id: 2,
                    name: 'Navy Blue Chinos',
                    image: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&w=100&q=80',
                    size: '32',
                    price: 1899,
                    color: 'Navy'
                }
            ]
        }
    ];

    const reasons = [
        "Size doesn't fit",
        "Quality not as expected",
        "Wrong item received",
        "Defective/Damaged item",
        "Don't like the style/color",
        "Other"
    ];

    const handleOrderSelect = (order) => {
        setSelectedOrder(order);
        setStep(2);
    };

    const handleActionSelect = (type) => {
        setActionType(type);
        setStep(3);
    };

    const toggleItemSelection = (itemId) => {
        if (selectedItems.includes(itemId)) {
            setSelectedItems(selectedItems.filter(id => id !== itemId));
        } else {
            setSelectedItems([...selectedItems, itemId]);
        }
    };

    const handleImageUpload = (e) => {
        // Mock image upload
        if (e.target.files && e.target.files[0]) {
            setImages([...images, URL.createObjectURL(e.target.files[0])]);
        }
    };

    const handleSubmit = () => {
        setStep(5); // Success screen
    };

    const renderStep1_SelectOrder = () => (
        <div className="space-y-4">
            <h2 className="text-xl font-bold mb-4">Select Order</h2>
            {orders.map(order => (
                <div key={order.id} className="border border-gray-200 rounded-lg p-4 hover:border-black transition-colors cursor-pointer" onClick={() => handleOrderSelect(order)}>
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <p className="font-bold">Order #{order.id}</p>
                            <p className="text-sm text-gray-500">Ordered on {order.date}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${order.status === 'Delivered' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                            {order.status}
                        </span>
                    </div>
                    <div className="space-y-2">
                        {order.items.map(item => (
                            <div key={item.id} className="flex gap-3">
                                <img src={item.image} alt={item.name} className="w-12 h-12 object-cover rounded bg-gray-100" />
                                <div>
                                    <p className="text-sm font-medium">{item.name}</p>
                                    <p className="text-xs text-gray-500">Size: {item.size} • Color: {item.color}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );

    const renderStep2_SelectAction = () => (
        <div className="space-y-4">
            <button onClick={() => setStep(1)} className="text-sm text-gray-500 mb-2">← Back to orders</button>
            <h2 className="text-xl font-bold mb-4">What would you like to do?</h2>

            {selectedOrder.canCancel && (
                <button
                    onClick={() => handleActionSelect('cancel')}
                    className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-red-500 hover:bg-red-50 transition-all text-left"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-600">
                            <XCircle className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900">Cancel Order</h3>
                            <p className="text-sm text-gray-500">Cancel unfulfilled items</p>
                        </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
            )}

            {selectedOrder.canReturn && (
                <>
                    <button
                        onClick={() => handleActionSelect('return')}
                        className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-black hover:bg-gray-50 transition-all text-left"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-900">
                                <RefreshCw className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900">Return</h3>
                                <p className="text-sm text-gray-500">Return items for refund</p>
                            </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                    </button>

                    <button
                        onClick={() => handleActionSelect('exchange')}
                        className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-black hover:bg-gray-50 transition-all text-left"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-900">
                                <RefreshCw className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900">Exchange</h3>
                                <p className="text-sm text-gray-500">Exchange for different size</p>
                            </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                    </button>
                </>
            )}
        </div>
    );

    const renderStep3_Details = () => (
        <div className="space-y-6">
            <button onClick={() => setStep(2)} className="text-sm text-gray-500">← Back</button>

            <div>
                <h2 className="text-xl font-bold mb-4">Select Items to {actionType === 'cancel' ? 'Cancel' : 'Return/Exchange'}</h2>
                <div className="space-y-3">
                    {selectedOrder.items.map(item => (
                        <div
                            key={item.id}
                            onClick={() => toggleItemSelection(item.id)}
                            className={`flex gap-3 p-3 border rounded-lg cursor-pointer ${selectedItems.includes(item.id) ? 'border-black bg-gray-50' : 'border-gray-200'
                                }`}
                        >
                            <div className={`w-5 h-5 mt-1 rounded border flex items-center justify-center ${selectedItems.includes(item.id) ? 'bg-black border-black' : 'border-gray-300'
                                }`}>
                                {selectedItems.includes(item.id) && <CheckCircle className="w-3 h-3 text-white" />}
                            </div>
                            <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded bg-gray-100" />
                            <div>
                                <p className="font-medium">{item.name}</p>
                                <p className="text-sm text-gray-500">Size: {item.size} • ₹{item.price}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div>
                <h3 className="font-bold mb-2">Reason</h3>
                <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none"
                >
                    <option value="">Select a reason</option>
                    {reasons.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
            </div>

            <div>
                <h3 className="font-bold mb-2">Comments</h3>
                <textarea
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder="Provide more details..."
                    className="w-full p-3 border border-gray-300 rounded-lg h-24 focus:ring-2 focus:ring-black focus:border-black outline-none resize-none"
                />
            </div>

            {actionType !== 'cancel' && (
                <div>
                    <h3 className="font-bold mb-2">Upload Images</h3>
                    <div className="flex gap-3 flex-wrap">
                        {images.map((img, i) => (
                            <img key={i} src={img} alt="Upload" className="w-20 h-20 object-cover rounded-lg border" />
                        ))}
                        <label className="w-20 h-20 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                            <Upload className="w-5 h-5 text-gray-400" />
                            <span className="text-[10px] text-gray-500 mt-1">Add Photo</span>
                            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                        </label>
                    </div>
                </div>
            )}

            <button
                disabled={selectedItems.length === 0 || !reason}
                onClick={() => actionType === 'return' ? setStep(4) : handleSubmit()}
                className="w-full bg-black text-white py-3 rounded-lg font-bold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {actionType === 'return' ? 'Next: Refund Details' : 'Submit Request'}
            </button>
        </div>
    );

    const renderStep4_BankDetails = () => (
        <div className="space-y-6">
            <button onClick={() => setStep(3)} className="text-sm text-gray-500">← Back</button>
            <h2 className="text-xl font-bold">Refund Method</h2>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                <p className="text-sm text-yellow-800">
                    For verification purposes, please provide your bank account details. Refunds are processed within 5-7 working days after quality check.
                </p>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Account Holder Name</label>
                    <input
                        type="text"
                        value={bankDetails.accountName}
                        onChange={(e) => setBankDetails({ ...bankDetails, accountName: e.target.value })}
                        className="w-full p-2.5 border border-gray-300 rounded-lg"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Account Number</label>
                    <input
                        type="text"
                        value={bankDetails.accountNumber}
                        onChange={(e) => setBankDetails({ ...bankDetails, accountNumber: e.target.value })}
                        className="w-full p-2.5 border border-gray-300 rounded-lg"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">IFSC Code</label>
                    <input
                        type="text"
                        value={bankDetails.ifsc}
                        onChange={(e) => setBankDetails({ ...bankDetails, ifsc: e.target.value })}
                        className="w-full p-2.5 border border-gray-300 rounded-lg uppercase"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Bank Name</label>
                    <input
                        type="text"
                        value={bankDetails.bankName}
                        onChange={(e) => setBankDetails({ ...bankDetails, bankName: e.target.value })}
                        className="w-full p-2.5 border border-gray-300 rounded-lg"
                    />
                </div>
            </div>

            <button
                onClick={handleSubmit}
                className="w-full bg-black text-white py-3 rounded-lg font-bold hover:bg-gray-800"
            >
                Submit Return Request
            </button>
        </div>
    );

    const renderStep5_Success = () => (
        <div className="text-center py-12">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Request Submitted!</h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
                Your {actionType} request has been submitted successfully. You will receive an email confirmation shortly with tracking details.
            </p>
            <div className="space-y-3">
                <p className="font-mono bg-gray-100 inline-block px-4 py-2 rounded text-sm">
                    Request ID: REQ-{Math.floor(Math.random() * 10000)}
                </p>
                <br />
                <Link to="/" className="inline-block mt-4 text-black font-bold underline hover:no-underline">
                    Back to Home
                </Link>
            </div>
        </div>
    );

    return (
        <div className="pt-24 pb-16 min-h-screen site-shell bg-gray-50">
            <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8">
                {step === 1 && renderStep1_SelectOrder()}
                {step === 2 && renderStep2_SelectAction()}
                {step === 3 && renderStep3_Details()}
                {step === 4 && renderStep4_BankDetails()}
                {step === 5 && renderStep5_Success()}
            </div>
        </div>
    );
};

export default CancelRefundExchange;
