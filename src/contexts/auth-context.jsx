/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchMyOrders, fetchProfile, signIn, signUp } from '../lib/api';

const AuthContext = createContext(null);

const TOKEN_KEY = 'customer_auth_token';

export function AuthProvider({ children }) {
  const [customer, setCustomer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const getStoredToken = useCallback(() => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }, []);

  const storeToken = useCallback((accessToken) => {
    try {
      localStorage.setItem(TOKEN_KEY, accessToken);
    } catch (e) {
      console.warn('Failed to store auth token', e);
    }
  }, []);

  const clearToken = useCallback(() => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch (e) {
      console.warn('Failed to clear auth token', e);
    }
  }, []);

  const fetchCustomer = useCallback(
    async (token) => {
      if (!token) {
        setCustomer(null);
        setOrders([]);
        setLoading(false);
        return null;
      }

      try {
        const profile = await fetchProfile(token);
        const orderData = await fetchMyOrders(token).catch(() => []);
        setCustomer(profile ?? null);
        setOrders(orderData ?? []);
        setLoading(false);
        return profile;
      } catch (e) {
        console.error('Failed to fetch customer profile', e);
        clearToken();
        setCustomer(null);
        setOrders([]);
        setLoading(false);
        return null;
      }
    },
    [clearToken],
  );

  useEffect(() => {
    const token = getStoredToken();
    if (token) {
      fetchCustomer(token);
    } else {
      setLoading(false);
    }
  }, [getStoredToken, fetchCustomer]);

  const login = useCallback(
    async (email, password) => {
      setError(null);
      setLoading(true);
      try {
        const normalizedEmail = String(email ?? '').trim();
        const result = await signIn({ email: normalizedEmail, password });
        const token = result?.token;

        if (!token) {
          setError('Login failed. Please try again.');
          setLoading(false);
          return { success: false, error: 'Login failed' };
        }

        storeToken(token);
        const customerData = await fetchCustomer(token);
        if (!customerData) {
          const msg = 'Unable to load your account details. Please try again.';
          setError(msg);
          return { success: false, error: msg };
        }
        return { success: true };
      } catch (e) {
        const msg = e?.message || 'Login failed';
        setError(msg);
        setLoading(false);
        return { success: false, error: msg };
      }
    },
    [storeToken, fetchCustomer],
  );

  const register = useCallback(async ({ email, password, firstName, lastName }) => {
    setError(null);
    setLoading(true);
    try {
      const normalizedEmail = String(email ?? '').trim();
      const fullName = `${firstName ?? ''} ${lastName ?? ''}`.trim();
      await signUp({ email: normalizedEmail, password, name: fullName || undefined });
      setLoading(false);
      return { success: true };
    } catch (e) {
      const msg = e?.message || 'Registration failed';
      setError(msg);
      setLoading(false);
      return { success: false, error: msg };
    }
  }, []);

  const logout = useCallback(async () => {
    clearToken();
    setCustomer(null);
    setOrders([]);
    setError(null);
  }, [clearToken]);

  const value = {
    customer,
    orders,
    isAuthenticated: !!customer,
    loading,
    error,
    login,
    register,
    logout,
    refreshCustomer: () => fetchCustomer(getStoredToken()),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
