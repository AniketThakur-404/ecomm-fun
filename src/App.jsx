// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/auth-context';
import { AdminProvider } from './contexts/admin-auth-context';
import Layout from './components/Layout';
import ScrollToTop from './components/ScrollToTop';
import HomePage from './pages/HomePage';
import ProductDetails from './pages/ProductDetails';
import CartPage from './pages/CartPage';
import AllProductsPage from './pages/AllProductsPage';
import Address from './pages/Address';
import Payment from './pages/Payment';
import OrderDetails from './pages/OrderDetails';
import LegalPage from './pages/LegalPage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import BlogPage from './pages/BlogPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import WishlistPage from './pages/WishlistPage';
import SearchPage from './pages/SearchPage';
import CancelRefundExchange from './pages/CancelRefundExchange';
import CollectionPage from './pages/CollectionPage';
import AdminLayout from './pages/admin/AdminLayout';
import AdminLogin from './pages/admin/AdminLogin';
import AdminProducts from './pages/admin/AdminProducts';
import AdminProductForm from './pages/admin/AdminProductForm';
import AdminCollections from './pages/admin/AdminCollections';
import AdminCollectionForm from './pages/admin/AdminCollectionForm';

export default function App() {
  return (
    <AuthProvider>
      <AdminProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ScrollToTop />
          <Routes>
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="products" replace />} />
              <Route path="products" element={<AdminProducts />} />
              <Route path="products/new" element={<AdminProductForm />} />
              <Route path="products/:id" element={<AdminProductForm />} />
              <Route path="collections" element={<AdminCollections />} />
              <Route path="collections/new" element={<AdminCollectionForm />} />
              <Route path="collections/:id" element={<AdminCollectionForm />} />
            </Route>
            <Route path="/" element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="products" element={<AllProductsPage />} />
              <Route path="collections/:handle" element={<CollectionPage />} />
              <Route path="shoes" element={<AllProductsPage initialCategory="shoes" />} />
              <Route path="shoes/loafers" element={<AllProductsPage initialCategory="loafers" />} />
              <Route path="shoes/boots" element={<AllProductsPage initialCategory="boots" />} />
              <Route path="shoes/sneakers" element={<AllProductsPage initialCategory="sneakers" />} />
              <Route path="shoes/sandals" element={<AllProductsPage initialCategory="sandals" />} />
              <Route path="apparel" element={<Navigate to="/products?category=t-shirts" replace />} />
              <Route path="product/:slug" element={<ProductDetails />} />
              <Route path="cart" element={<CartPage />} />
              <Route path="checkout/address" element={<Address />} />
              <Route path="checkout/payment" element={<Payment />} />
              <Route path="orders" element={<OrderDetails />} />
              <Route path="cancel-refund-exchange" element={<CancelRefundExchange />} />
              <Route path="legal" element={<Navigate to="/legal/privacy-policy" replace />} />
              <Route path="legal/:section" element={<LegalPage />} />
              <Route path="about" element={<AboutPage />} />
              <Route path="contact" element={<ContactPage />} />
              <Route path="blog" element={<BlogPage />} />
              <Route path="faq" element={<ContactPage />} />
              <Route path="login" element={<LoginPage />} />
              <Route path="register" element={<RegisterPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="wishlist" element={<WishlistPage />} />
              <Route path="product" element={<Navigate to="/" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Router>
      </AdminProvider>
    </AuthProvider>
  );
}
