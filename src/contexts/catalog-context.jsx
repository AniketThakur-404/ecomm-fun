// src/contexts/catalog-context.jsx
/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  fetchAllProducts,
  fetchCollectionByHandle,
  fetchCollections,
  formatMoney,
  toProductCard,
} from '../lib/api';

const CatalogContext = createContext(undefined);

const initialState = {
  status: 'idle',
  loading: false,
  error: null,
  products: [],
  productByHandle: {},
  productCards: [],
  collections: [],
};

const DEFAULT_PRODUCT_LIMIT = Number(import.meta.env.VITE_CATALOG_LIMIT) || 36;

export const CatalogProvider = ({ children, productLimit = DEFAULT_PRODUCT_LIMIT }) => {
  const [state, setState] = useState(initialState);
  const [collectionCache, setCollectionCache] = useState({});

  useEffect(() => {
    let cancelled = false;

    async function loadCatalogue() {
      console.log('Initializing CatalogContext...');
      setState((prev) => ({
        ...prev,
        status: prev.status === 'ready' ? prev.status : 'loading',
        loading: true,
        error: null,
      }));

      try {
        const [productsResult, collectionsResult] = await Promise.allSettled([
          fetchAllProducts(productLimit),
          fetchCollections(16),
        ]);

        if (cancelled) return;

        const productsData =
          productsResult.status === 'fulfilled' && Array.isArray(productsResult.value)
            ? productsResult.value
            : [];
        const collectionsData =
          collectionsResult.status === 'fulfilled' && Array.isArray(collectionsResult.value)
            ? collectionsResult.value
            : [];

        const errors = [productsResult, collectionsResult]
          .filter((result) => result.status === 'rejected')
          .map((result) => result.reason);

        if (errors.length) {
          console.error('Partial catalogue load failure', errors);
        }

        const productByHandle = {};
        productsData.forEach((product) => {
          if (product?.handle) {
            productByHandle[product.handle] = product;
          }
        });

        const productCards = productsData
          .map(toProductCard)
          .filter(Boolean);

        console.log('Catalog loaded:', { products: productsData.length, collections: collectionsData.length });
        setState({
          status: productsData.length || collectionsData.length ? 'ready' : 'error',
          loading: false,
          error: errors[0] ?? null,
          products: productsData,
          productByHandle,
          productCards,
          collections: collectionsData.filter(Boolean),
        });
      } catch (error) {
        console.error('Failed to load catalogue', error);
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          status: prev.products.length ? 'ready' : 'error',
          loading: false,
          error,
        }));
      }
    }

    loadCatalogue();

    return () => {
      cancelled = true;
    };
  }, [productLimit]);

  const getProduct = useCallback(
    (handle) => {
      if (!handle) return null;
      return state.productByHandle[handle] ?? null;
    },
    [state.productByHandle],
  );

  const ensureCollectionProducts = useCallback(
    async (handle, { limit = 24 } = {}) => {
      if (!handle) return [];
      if (collectionCache[handle]) {
        return collectionCache[handle];
      }
      const collection = await fetchCollectionByHandle(handle, limit);
      const products = collection?.products ?? [];
      setCollectionCache((prev) => ({
        ...prev,
        [handle]: products,
      }));
      return products;
    },
    [collectionCache],
  );

  const value = useMemo(
    () => ({
      ...state,
      loading: state.loading || state.status === 'loading',
      getProduct,
      getProductCard: (handle) => {
        const product = getProduct(handle);
        return product ? toProductCard(product) : null;
      },
      ensureCollectionProducts,
      collectionCache,
      formatMoney,
    }),
    [state, getProduct, ensureCollectionProducts, collectionCache],
  );

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
};

export const useCatalog = () => {
  const context = useContext(CatalogContext);
  if (!context) {
    throw new Error('useCatalog must be used within a CatalogProvider');
  }
  return context;
};

export default CatalogProvider;
