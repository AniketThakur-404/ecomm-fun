import React from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Instagram, MessageCircle, Truck, CreditCard, RotateCcw, Headphones, ArrowUp } from 'lucide-react';

const Footer = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-black text-[#f7f4ef] pt-16 pb-4 font-sans relative">
      <div className="site-shell">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-16">

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-bold mb-6">Quick Links</h3>
            <ul className="flex flex-col gap-3 text-sm text-[#d8d6cd]">
              <li><Link to="/" className="hover:text-white transition-colors">Home</Link></li>
              <li><Link to="/contact" className="hover:text-white transition-colors">Contact Us</Link></li>
              <li><Link to="/products" className="hover:text-white transition-colors">Shop</Link></li>
              <li><Link to="/contact" className="hover:text-white transition-colors">Our Location</Link></li>
              <li><Link to="/faq" className="hover:text-white transition-colors">Help Center</Link></li>
            </ul>
          </div>

          {/* Policies */}
          <div>
            <h3 className="text-lg font-bold mb-6">Policies</h3>
            <ul className="flex flex-col gap-3 text-sm text-[#d8d6cd]">
              <li><Link to="/legal/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link to="/legal/money-back-policy" className="hover:text-white transition-colors">Refund Policy</Link></li>
              <li><Link to="/legal/terms-of-use" className="hover:text-white transition-colors">Shipping Policy</Link></li>
              <li><Link to="/legal/money-back-policy" className="hover:text-white transition-colors">Return & Exchange Policy</Link></li>
            </ul>
          </div>

          {/* Follow Us */}
          <div>
            <h3 className="text-lg font-bold mb-6">Follow Us</h3>
            <div className="flex gap-4">
              <a href="#" className="w-10 h-10 bg-gradient-to-tr from-yellow-500 via-red-500 to-purple-500 rounded-lg flex items-center justify-center text-white hover:opacity-90 transition-opacity">
                <Instagram className="w-6 h-6" />
              </a>
              <a href="#" className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white hover:opacity-90 transition-opacity">
                <Facebook className="w-6 h-6" />
              </a>
              <a href="#" className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center text-white hover:opacity-90 transition-opacity">
                <MessageCircle className="w-6 h-6" />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Service Bar */}
        <div className="border-t border-gray-800 pt-8 flex flex-wrap justify-center md:justify-between items-center gap-6 text-xs md:text-sm text-[#d8d6cd]">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-orange-400" />
            <span>Fast, Free Shipping — All over India</span>
          </div>
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-400" />
            <span>COD Available — No Additional Cost</span>
          </div>
          <div className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-blue-500" />
            <span>7-Day Free Returns — All shipping methods</span>
          </div>
          <div className="flex items-center gap-2">
            <Headphones className="w-5 h-5 text-pink-500" />
            <span>Expert Customer Service — Chat or Call Us</span>
          </div>
        </div>
      </div>

      {/* Scroll to top button - Absolute positioned like in design ?? Or fixed? Design shows it on right. */}
      <button
        onClick={scrollToTop}
        className="absolute right-8 bottom-20 md:bottom-12 w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center text-[#f7f4ef] hover:bg-gray-700 transition-colors"
        aria-label="Scroll to top"
      >
        <ArrowUp className="w-5 h-5" />
      </button>
    </footer>
  );
};

export default Footer;
