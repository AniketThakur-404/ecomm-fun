import React from 'react';

const BlogPage = () => {
    return (
        <div className="pt-24 pb-16 min-h-screen site-shell text-center">
            <h1 className="text-4xl font-extrabold mb-4">Our Blog</h1>
            <p className="text-gray-600 mb-12">Latest updates, fashion tips and news from Aradhya.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="border border-gray-100 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                        <div className="h-48 bg-gray-100 flex items-center justify-center text-gray-400">
                            Blog Image {i}
                        </div>
                        <div className="p-4 text-left">
                            <span className="text-xs font-bold text-blue-600">FASHION</span>
                            <h3 className="font-bold text-lg mt-1 mb-2">Summer Trends 2025</h3>
                            <p className="text-sm text-gray-500 line-clamp-2">Discover the latest styles hitting the streets this summer season...</p>
                            <button className="text-sm font-bold mt-4 underline">Read More</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default BlogPage;
