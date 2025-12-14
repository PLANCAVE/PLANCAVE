import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import {
  getFavorites,
  addFavorite as addFavoriteApi,
  removeFavorite as removeFavoriteApi,
  getCartItems,
  addCartItem as addCartItemApi,
  removeCartItem as removeCartItemApi,
} from '../api';
import { useAuth } from './AuthContext';

export type PlanListItem = {
  id: string;
  name: string;
  description?: string;
  price?: number | string;
  image_url?: string;
  category?: string;
  project_type?: string;
  package_level?: string;
  includes_boq?: boolean;
  bedrooms?: number;
  bathrooms?: number;
  area?: number;
  added_at?: string;
};

interface CustomerDataContextValue {
  favorites: PlanListItem[];
  cartItems: PlanListItem[];
  loadingFavorites: boolean;
  loadingCart: boolean;
  favoriteIds: Set<string>;
  cartIds: Set<string>;
  refreshFavorites: () => Promise<void>;
  refreshCart: () => Promise<void>;
  addFavorite: (planId: string) => Promise<void>;
  removeFavorite: (planId: string) => Promise<void>;
  toggleFavorite: (planId: string) => Promise<void>;
  addCartItem: (planId: string) => Promise<void>;
  removeCartItem: (planId: string) => Promise<void>;
  toggleCartItem: (planId: string) => Promise<void>;
}

const CustomerDataContext = createContext<CustomerDataContextValue | undefined>(undefined);

export function CustomerDataProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, token } = useAuth() as { isAuthenticated: boolean; token: string | null };
  const [favorites, setFavorites] = useState<PlanListItem[]>([]);
  const [cartItems, setCartItems] = useState<PlanListItem[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  const [loadingCart, setLoadingCart] = useState(false);

  const clearData = useCallback(() => {
    setFavorites([]);
    setCartItems([]);
  }, []);

  const refreshFavorites = useCallback(async () => {
    if (!isAuthenticated || !token) {
      clearData();
      return;
    }
    setLoadingFavorites(true);
    try {
      const response = await getFavorites();
      setFavorites(response.data || []);
    } catch (error: any) {
      const status = error?.response?.status;
      if (status !== 401) {
        console.error('Failed to load favorites', error);
      } else {
        setFavorites([]);
      }
    } finally {
      setLoadingFavorites(false);
    }
  }, [isAuthenticated, token, clearData]);

  const refreshCart = useCallback(async () => {
    if (!isAuthenticated || !token) {
      clearData();
      return;
    }
    setLoadingCart(true);
    try {
      const response = await getCartItems();
      setCartItems(response.data || []);
    } catch (error: any) {
      const status = error?.response?.status;
      if (status !== 401) {
        console.error('Failed to load cart items', error);
      } else {
        setCartItems([]);
      }
    } finally {
      setLoadingCart(false);
    }
  }, [isAuthenticated, token, clearData]);

  useEffect(() => {
    if (isAuthenticated && token) {
      refreshFavorites();
      refreshCart();
    } else {
      clearData();
    }
  }, [isAuthenticated, token, refreshFavorites, refreshCart, clearData]);

  const addFavoriteHandler = useCallback(
    async (planId: string) => {
      if (!isAuthenticated) return;
      await addFavoriteApi(planId);
      await refreshFavorites();
    },
    [isAuthenticated, refreshFavorites]
  );

  const removeFavoriteHandler = useCallback(
    async (planId: string) => {
      if (!isAuthenticated) return;
      await removeFavoriteApi(planId);
      await refreshFavorites();
    },
    [isAuthenticated, refreshFavorites]
  );

  const toggleFavorite = useCallback(
    async (planId: string) => {
      if (!isAuthenticated) return;
      const exists = favorites.some((fav) => fav.id === planId);
      if (exists) {
        await removeFavoriteHandler(planId);
      } else {
        await addFavoriteHandler(planId);
      }
    },
    [favorites, addFavoriteHandler, removeFavoriteHandler, isAuthenticated]
  );

  const addCartItemHandler = useCallback(
    async (planId: string) => {
      if (!isAuthenticated) return;
      await addCartItemApi(planId);
      await refreshCart();
    },
    [isAuthenticated, refreshCart]
  );

  const removeCartItemHandler = useCallback(
    async (planId: string) => {
      if (!isAuthenticated) return;
      await removeCartItemApi(planId);
      await refreshCart();
    },
    [isAuthenticated, refreshCart]
  );

  const toggleCartItem = useCallback(
    async (planId: string) => {
      if (!isAuthenticated) return;
      const exists = cartItems.some((item) => item.id === planId);
      if (exists) {
        await removeCartItemHandler(planId);
      } else {
        await addCartItemHandler(planId);
      }
    },
    [cartItems, addCartItemHandler, removeCartItemHandler, isAuthenticated]
  );

  const favoriteIds = useMemo(() => new Set(favorites.map((fav) => fav.id)), [favorites]);
  const cartIds = useMemo(() => new Set(cartItems.map((item) => item.id)), [cartItems]);

  const value: CustomerDataContextValue = {
    favorites,
    cartItems,
    loadingFavorites,
    loadingCart,
    favoriteIds,
    cartIds,
    refreshFavorites,
    refreshCart,
    addFavorite: addFavoriteHandler,
    removeFavorite: removeFavoriteHandler,
    toggleFavorite,
    addCartItem: addCartItemHandler,
    removeCartItem: removeCartItemHandler,
    toggleCartItem,
  };

  return <CustomerDataContext.Provider value={value}>{children}</CustomerDataContext.Provider>;
}

export function useCustomerData() {
  const context = useContext(CustomerDataContext);
  if (!context) {
    throw new Error('useCustomerData must be used within CustomerDataProvider');
  }
  return context;
}
