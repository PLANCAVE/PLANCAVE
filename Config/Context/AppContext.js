import { createContext, useReducer, useContext, useEffect } from "react";
import { toast } from "react-toastify";

// Create Context
export const AppContext = createContext();

// Initial state
const initialState = {
  cart: [],
  wishlist: [],
  recentlyViewed: [],
  loading: false,
  error: null
};

// Load state from localStorage
const loadState = () => {
  if (typeof window === 'undefined') {
    return initialState;
  }
  
  try {
    const cartData = localStorage.getItem('cart');
    const wishlistData = localStorage.getItem('wishlist');
    const recentlyViewedData = localStorage.getItem('recentlyViewed');
    
    return {
      ...initialState,
      cart: cartData ? JSON.parse(cartData) : [],
      wishlist: wishlistData ? JSON.parse(wishlistData) : [],
      recentlyViewed: recentlyViewedData ? JSON.parse(recentlyViewedData) : []
    };
  } catch (error) {
    console.error('Error loading state from localStorage:', error);
    return initialState;
  }
};

// Reducer function to manage state updates
const appReducer = (state, action) => {
  switch (action.type) {
    // Cart actions
    case "ADD_TO_CART": {
      // Check if item already exists in cart
      const existingItem = state.cart.find(item => item._id === action.payload._id);
      
      if (existingItem) {
        // If item exists, update quantity
        const updatedCart = state.cart.map(item => 
          item._id === action.payload._id 
            ? { ...item, quantity: (item.quantity || 1) + (action.payload.quantity || 1) }
            : item
        );
        return { ...state, cart: updatedCart };
      } else {
        // Add new item with quantity
        const newItem = { 
          ...action.payload, 
          quantity: action.payload.quantity || 1,
          addedAt: new Date().toISOString()
        };
        return { ...state, cart: [...state.cart, newItem] };
      }
    }
    
    case "UPDATE_CART_ITEM": {
      const updatedCart = state.cart.map(item => 
        item._id === action.payload.id 
          ? { ...item, ...action.payload.data }
          : item
      );
      return { ...state, cart: updatedCart };
    }
    
    case "REMOVE_FROM_CART":
      return { 
        ...state, 
        cart: state.cart.filter((item) => item._id !== action.payload) 
      };
      
    case "CLEAR_CART":
      return { ...state, cart: [] };
    
    // Wishlist actions
    case "ADD_TO_WISHLIST": {
      // Check if item already exists in wishlist
      const existingItem = state.wishlist.find(item => item._id === action.payload._id);
      
      if (existingItem) {
        return state; // Item already in wishlist, no change
      } else {
        return { 
          ...state, 
          wishlist: [...state.wishlist, { 
            ...action.payload, 
            addedAt: new Date().toISOString() 
          }] 
        };
      }
    }
    
    case "REMOVE_FROM_WISHLIST":
      return { 
        ...state, 
        wishlist: state.wishlist.filter((item) => item._id !== action.payload) 
      };
    
    // Recently viewed actions
    case "ADD_TO_RECENTLY_VIEWED": {
      // Remove if already exists (to move it to the front)
      const filteredItems = state.recentlyViewed.filter(
        item => item._id !== action.payload._id
      );
      
      // Add to front of array, limit to 10 items
      const newRecentlyViewed = [
        { ...action.payload, viewedAt: new Date().toISOString() },
        ...filteredItems
      ].slice(0, 10);
      
      return { ...state, recentlyViewed: newRecentlyViewed };
    }
    
    // Loading and error states
    case "SET_LOADING":
      return { ...state, loading: action.payload };
      
    case "SET_ERROR":
      return { ...state, error: action.payload };
      
    case "CLEAR_ERROR":
      return { ...state, error: null };
      
    default:
      return state;
  }
};

// Custom hook for using the AppContext
export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
};

// Context Provider
export const AppProvider = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, loadState());
  
  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('cart', JSON.stringify(state.cart));
      localStorage.setItem('wishlist', JSON.stringify(state.wishlist));
      localStorage.setItem('recentlyViewed', JSON.stringify(state.recentlyViewed));
    }
  }, [state.cart, state.wishlist, state.recentlyViewed]);
  
  // Helper functions for common actions
  const addToCart = (product, quantity = 1) => {
    dispatch({ 
      type: "ADD_TO_CART", 
      payload: { ...product, quantity } 
    });
    toast.success(`${product.name || 'Product'} added to cart!`);
  };
  
  const removeFromCart = (productId) => {
    dispatch({ type: "REMOVE_FROM_CART", payload: productId });
    toast.info("Item removed from cart");
  };
  
  const updateCartItem = (id, data) => {
    dispatch({ 
      type: "UPDATE_CART_ITEM", 
      payload: { id, data } 
    });
  };
  
  const clearCart = () => {
    dispatch({ type: "CLEAR_CART" });
    toast.info("Cart cleared");
  };
  
  const addToWishlist = (product) => {
    dispatch({ type: "ADD_TO_WISHLIST", payload: product });
    toast.success(`${product.name || 'Product'} added to wishlist!`);
  };
  
  const removeFromWishlist = (productId) => {
    dispatch({ type: "REMOVE_FROM_WISHLIST", payload: productId });
    toast.info("Item removed from wishlist");
  };
  
  const viewProduct = (product) => {
    dispatch({ type: "ADD_TO_RECENTLY_VIEWED", payload: product });
  };
  
  // Calculate cart totals
  const cartTotal = state.cart.reduce(
    (total, item) => total + (item.price * (item.quantity || 1)), 
    0
  );
  
  const cartItemsCount = state.cart.reduce(
    (count, item) => count + (item.quantity || 1), 
    0
  );

  return (
    <AppContext.Provider 
      value={{ 
        // State
        cart: state.cart,
        wishlist: state.wishlist,
        recentlyViewed: state.recentlyViewed,
        loading: state.loading,
        error: state.error,
        
        // Calculated values
        cartTotal,
        cartItemsCount,
        
        // Actions
        dispatch,
        addToCart,
        removeFromCart,
        updateCartItem,
        clearCart,
        addToWishlist,
        removeFromWishlist,
        viewProduct
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
