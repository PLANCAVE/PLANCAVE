import { useState, useMemo } from 'react';
import { ShoppingBag, ArrowRight, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCustomerData } from '../contexts/CustomerDataContext';
import { useAuth } from '../contexts/AuthContext';

export default function Cart() {
  const { isAuthenticated } = useAuth();
  const { cartItems, loadingCart, removeCartItem } = useCustomerData();
  const [busyId, setBusyId] = useState<string | null>(null);

  const resolveMediaUrl = (path?: string) => {
    if (!path) return '';
    // If it's a full URL (like from Cloudinary), use it directly.
    if (/^https?:\/\//i.test(path)) {
      return path;
    }
    // For local paths, ensure it's a root-relative path.
    const cleanedPath = path.replace(/^\/api(?=\/)/, '');
    return cleanedPath.startsWith('/') ? cleanedPath : `/${cleanedPath}`;
  };

  const totalPrice = useMemo(() => {
    return cartItems.reduce((sum, plan) => {
      const amount = typeof plan.price === 'string' ? Number(plan.price) : plan.price || 0;
      return sum + amount;
    }, 0);
  }, [cartItems]);

  const handleRemove = async (planId: string) => {
    setBusyId(planId);
    try {
      await removeCartItem(planId);
    } finally {
      setBusyId(null);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#2C5F5F] via-[#1e4a4a] to-[#0f2a2a] flex items-center justify-center px-6 py-16 text-white text-center">
        <div className="max-w-xl space-y-6">
          <ShoppingBag className="w-12 h-12 mx-auto text-white/70" />
          <h1 className="text-3xl font-serif tracking-[0.3em]">Sign in to access your cart</h1>
          <p className="text-white/70">
            Your cart is synced to your account so you can review selected plans from any device.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/login" className="btn-primary text-sm tracking-wide">
              Sign In
            </Link>
            <Link to="/register" className="btn-secondary text-sm tracking-wide border-white/40 text-white">
              Create Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loadingCart) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#2C5F5F] via-[#1e4a4a] to-[#0f2a2a]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#2C5F5F] via-[#1e4a4a] to-[#0f2a2a] flex flex-col items-center justify-center px-6 py-16 text-white text-center">
        <div className="max-w-2xl space-y-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full border border-white/30 bg-white/5 mx-auto">
            <ShoppingBag className="w-10 h-10 text-white" />
          </div>
          <div className="space-y-3">
            <p className="tracking-[0.5em] text-xs text-white/60">CART</p>
            <h1 className="text-3xl md:text-4xl font-serif tracking-[0.3em]">Your cart is empty</h1>
            <p className="text-white/70 leading-relaxed">
              Add plans to your cart to compare scope, share with your team, and download the full construction set when
              you're ready.
            </p>
          </div>
          <Link
            to="/plans"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full border border-white/30 text-white/90 tracking-[0.2em] uppercase text-xs hover:bg-white/10 transition"
          >
            Browse Plans <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2C5F5F] via-[#1e4a4a] to-[#0f2a2a] px-6 py-16 text-white">
      <div className="max-w-6xl mx-auto space-y-10">
        <header className="flex flex-col gap-4">
          <p className="tracking-[0.6em] text-xs text-white/60">CART</p>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <h1 className="text-3xl md:text-4xl font-serif tracking-[0.2em]">Plans ready for checkout</h1>
            <Link
              to="/plans"
              className="inline-flex items-center gap-2 text-xs tracking-[0.3em] uppercase border border-white/30 px-4 py-2 rounded-full hover:bg-white/10"
            >
              Add more plans <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <p className="text-white/70 text-sm">{cartItems.length} plan{cartItems.length === 1 ? '' : 's'} in cart</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {cartItems.map((plan) => (
              <div key={plan.id} className="bg-white/5 backdrop-blur-sm rounded-3xl border border-white/10 p-4 md:p-6 flex gap-4">
                <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-2xl overflow-hidden flex-shrink-0 bg-white/10 border border-white/10">
                  <img
                    src={plan.image_url ? resolveMediaUrl(plan.image_url) : '/vite.svg'}
                    alt={plan.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex flex-col flex-1 gap-3">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.4em] text-white/50">{plan.category || plan.project_type}</p>
                      <h2 className="text-xl font-semibold text-white mt-1">{plan.name}</h2>
                    </div>
                    <button
                      onClick={() => handleRemove(plan.id)}
                      disabled={busyId === plan.id}
                      className="p-2 rounded-full border border-white/20 text-white/70 hover:text-white hover:border-white/60 transition"
                      aria-label="Remove from cart"
                    >
                      {busyId === plan.id ? (
                        <span className="w-4 h-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin inline-block" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-sm text-white/70 line-clamp-2">{plan.description}</p>
                  <div className="flex flex-wrap gap-2 text-xs text-white/80">
                    {plan.includes_boq && <span>Includes BOQ</span>}
                    {plan.area && <span>{plan.area} m²</span>}
                    {plan.bedrooms && <span>{plan.bedrooms} Beds</span>}
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-white/60">Price</p>
                      <p className="text-lg font-semibold">$ {Number(plan.price || 0).toLocaleString()}</p>
                    </div>
                    <Link
                      to={`/plans/${plan.id}`}
                      className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] border border-white/30 px-4 py-2 rounded-full hover:bg-white/10"
                    >
                      Review scope <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <aside className="bg-white/5 backdrop-blur-sm rounded-3xl border border-white/10 p-6 flex flex-col gap-4">
            <div>
              <p className="text-xs text-white/60 uppercase tracking-[0.4em]">Summary</p>
              <h2 className="text-2xl font-serif tracking-[0.2em] mt-2">Checkout</h2>
            </div>
            <div className="space-y-3 text-white/80 text-sm">
              <div className="flex justify-between">
                <span>Plans</span>
                <span>{cartItems.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>KSH {totalPrice.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-white">
                <span className="font-semibold">Total</span>
                <span className="font-semibold">KSH {totalPrice.toLocaleString()}</span>
              </div>
            </div>
            <button className="btn-primary w-full uppercase tracking-[0.3em] text-xs py-3 disabled:opacity-50" disabled>
              Checkout coming soon
            </button>
            <p className="text-[11px] text-white/60">
              Payments for plans are processed securely. Once checkout is live you'll receive download links instantly.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
