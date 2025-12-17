import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPlanDetails, generateDownloadLink, downloadPlanFile, adminDownloadPlan, purchasePlan, verifyPurchase, verifyPaystackPayment } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useCustomerData } from '../contexts/CustomerDataContext';
import {
  Building2,
  ArrowLeft,
  FileText,
  Award,
  Image as ImageIcon,
  Maximize2,
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  ShoppingCart,
  CheckCircle,
  AlertCircle,
  Loader2,
  CreditCard,
  Heart,
  Plus,
} from 'lucide-react';

interface PlanFile {
  file_type: string;
  file_path: string;
}

interface StructuralSpec {
  spec_type: string;
  specification: string;
  standard?: string;
}

interface PlanDetailsData {
  id: string;
  name: string;
  project_type: string;
  category?: string;
  description: string;
  package_level: string;
  price: number | string;
  area: number | null;
  plot_size?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  floors: number;
  building_height?: number | null;
  parking_spaces?: number | null;
  disciplines_included?: any;
  includes_boq: boolean;
  building_code?: string;
  certifications?: string[];
  license_type?: string;
  customization_available?: boolean;
  support_duration?: number | null;
  estimated_cost_min?: number | null;
  estimated_cost_max?: number | null;
  project_timeline_ref?: string;
  material_specifications?: string;
  construction_notes?: string;
  image_url?: string;
  sales_count?: number;
  created_at?: string;
  files?: PlanFile[];
  structural_specs?: StructuralSpec[];
  designer_id?: number;
}

export default function PlanDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, isDesigner, user } = useAuth();
  const { favorites, addFavorite, removeFavorite, cartItems, addCartItem } = useCustomerData();
  const [plan, setPlan] = useState<PlanDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Purchase and download states
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [purchaseStatus, setPurchaseStatus] = useState<'none' | 'purchased' | 'processing'>('none');
  const [pendingReference, setPendingReference] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);
  
  // Cart and favorites states
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isAddingToFavorites, setIsAddingToFavorites] = useState(false);
  const [cartSuccess, setCartSuccess] = useState(false);
  const [favoriteSuccess, setFavoriteSuccess] = useState(false);

  const resolveMediaUrl = (path?: string) => {
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) {
      try {
        const url = new URL(path);
        return url.pathname.replace(/^\/api(?=\/)/, '');
      } catch {
        return path;
      }
    }
    if (path.startsWith('/api/')) return path.replace(/^\/api/, '');
    return path.startsWith('/') ? path : `/${path}`;
  };

  // Helper functions to check cart and favorites status
  const isInCart = cartItems.some(item => item.id === id);
  const isInFavorites = favorites.some(item => item.id === id);

  // Cart and favorites handlers
  const handleAddToCart = async () => {
    if (!id || !isAuthenticated) {
      navigate('/login');
      return;
    }

    setIsAddingToCart(true);
    setCartSuccess(false);
    setDownloadError(null);

    try {
      await addCartItem(id);
      setCartSuccess(true);
      setTimeout(() => setCartSuccess(false), 3000);
    } catch (err: any) {
      setDownloadError('Failed to add to cart. Please try again.');
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!id || !isAuthenticated) {
      navigate('/login');
      return;
    }

    setIsAddingToFavorites(true);
    setFavoriteSuccess(false);
    setDownloadError(null);

    try {
      if (isInFavorites) {
        await removeFavorite(id);
      } else {
        await addFavorite(id);
      }
      setFavoriteSuccess(true);
      setTimeout(() => setFavoriteSuccess(false), 3000);
    } catch (err: any) {
      setDownloadError('Failed to update favorites. Please try again.');
    } finally {
      setIsAddingToFavorites(false);
    }
  };

  useEffect(() => {
    const loadPlan = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const response = await getPlanDetails(id);
        setPlan(response.data);
        setCurrentImageIndex(0);
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Failed to load plan details');
      } finally {
        setLoading(false);
      }
    };

    loadPlan();
  }, [id]);

  // Check purchase status when plan loads and user is authenticated
  useEffect(() => {
    if (plan && isAuthenticated) {
      checkPurchaseStatus();
    }
  }, [plan, isAuthenticated]);

  // Handle keyboard navigation in fullscreen
  useEffect(() => {
    if (!isFullscreen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false);
      } else if (e.key === 'ArrowLeft') {
        handlePrevImage();
      } else if (e.key === 'ArrowRight') {
        handleNextImage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, currentImageIndex]);

  const handlePrevImage = () => {
    if (!plan) return;
    const imageUrls = getImageUrls();
    setCurrentImageIndex((prev) => (prev === 0 ? imageUrls.length - 1 : prev - 1));
  };

  const handleNextImage = () => {
    if (!plan) return;
    const imageUrls = getImageUrls();
    setCurrentImageIndex((prev) => (prev === imageUrls.length - 1 ? 0 : prev + 1));
  };

  const handleThumbnailClick = (idx: number) => {
    setCurrentImageIndex(idx);
    setIsFullscreen(true);
  };

  // Purchase and download handlers
  const handlePurchase = async () => {
    if (!id || !isAuthenticated) {
      navigate('/login');
      return;
    }

    setIsPurchasing(true);
    setDownloadError(null);
    setPurchaseSuccess(false);

    try {
      const resp = await purchasePlan(id, 'paystack');
      const { authorization_url, reference, status } = resp.data || {};

      if (authorization_url && reference) {
        setPendingReference(reference);
        setPurchaseStatus('processing');
        window.open(authorization_url, '_blank', 'noopener');
      } else if (status === 'pending') {
        setPurchaseStatus('processing');
      } else {
        setPurchaseStatus('purchased');
        setPurchaseSuccess(true);
        setTimeout(() => handleDownload(), 500);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Purchase failed. Please try again.';
      setDownloadError(msg);
    } finally {
      setIsPurchasing(false);
    }
  };

  const isPlanOwnerDesigner = Boolean(isDesigner && user && plan?.designer_id === user.id);

  const handleDownload = async () => {
    if (!id || !plan) return;

    setIsDownloading(true);
    setDownloadError(null);

    try {
      if (isAdmin) {
        const response = await adminDownloadPlan(id);
        const blob = new Blob([response.data], { type: 'application/zip' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${plan.name || 'plan'}-technical-files.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else if (isPlanOwnerDesigner) {
        // Designers downloading their own plans: fetch stored files directly
        if (plan.files && plan.files.length > 0) {
          for (const file of plan.files) {
            const fileUrl = resolveMediaUrl(file.file_path);
            const response = await fetch(fileUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${plan.name || 'plan'}-${file.file_path.split('/').pop()}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }
      } else {
        // Customer download - generate one-time link and receive zipped package
        const linkResponse = await generateDownloadLink(id);
        const { download_token } = linkResponse.data;

        const response = await downloadPlanFile(download_token);
        const blob = new Blob([response.data], { type: 'application/zip' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${plan.name || 'plan'}-technical-files.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (err: any) {
      console.error('Download error', err);
      setDownloadError('Download failed. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleVerifyPayment = async (referenceToVerify?: string) => {
    const ref = referenceToVerify || pendingReference;
    if (!ref) {
      setDownloadError('No payment reference to verify.');
      return;
    }
    setDownloadError(null);
    setIsPurchasing(true);
    try {
      await verifyPaystackPayment(ref);
      setPurchaseStatus('purchased');
      setPurchaseSuccess(true);
      setPendingReference(null);
      setTimeout(() => handleDownload(), 500);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Payment not completed yet. Please retry after Paystack confirms.';
      setDownloadError(msg);
    } finally {
      setIsPurchasing(false);
    }
  };

  const checkPurchaseStatus = async () => {
    if (!id || !isAuthenticated) return;
    try {
      const resp = await verifyPurchase(id);
      const status = resp.data?.status;
      if (status === 'completed' || status === 'purchased') {
        setPurchaseStatus('purchased');
      } else if (status === 'pending') {
        setPurchaseStatus('processing');
      } else {
        setPurchaseStatus('none');
      }
    } catch {
      setPurchaseStatus('none');
    }
  };

  // Auto-verify if a Paystack reference is present in URL (callback flow)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('reference');
    if (ref && isAuthenticated) {
      handleVerifyPayment(ref);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const getImageUrls = (): string[] => {
    if (!plan) return [];
    
    const imageUrls: string[] = [];
    const makeUrl = (path: string | undefined) => {
      if (!path) return '';
      return resolveMediaUrl(path);
    };

    if (plan.image_url) {
      const url = makeUrl(plan.image_url);
      if (url) imageUrls.push(url);
    }

    if (plan.files && plan.files.length > 0) {
      const imageTypes = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
      for (const file of plan.files) {
        const ext = file.file_type?.toLowerCase();
        if (imageTypes.includes(ext)) {
          const url = makeUrl(file.file_path);
          if (url && !imageUrls.includes(url)) {
            imageUrls.push(url);
          }
        }
      }
    }

    return imageUrls;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading plan details...</div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Plan not available</h2>
        <p className="text-gray-600 mb-6">{error || 'We could not find this plan. It may have been removed.'}</p>
        <button
          onClick={() => navigate('/plans')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Browse
        </button>
      </div>
    );
  }

  const priceNumber = typeof plan.price === 'string' ? Number(plan.price) : plan.price;
  const imageUrls = getImageUrls();
  const mainImageUrl = imageUrls[currentImageIndex] || '';
  const structuralSpecs = plan.structural_specs || [];
  const hasStructural = structuralSpecs.length > 0;
  const availableFileTypes = Array.from(
    new Set((plan.files || []).map((f) => f.file_type).filter(Boolean))
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Back + title row */}
      <div className="max-w-7xl mx-auto mb-6">
        <button
          onClick={() => navigate('/plans')}
          className="inline-flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to plans
        </button>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Plan details</h1>
      </div>

      {/* Main layout */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: image gallery and summary */}
        <div className="lg:col-span-2 space-y-6">
          {/* Gallery */}
          <div className="bg-white rounded-lg shadow p-6">
            {mainImageUrl ? (
              <div className="relative">
                <img
                  src={mainImageUrl}
                  alt={plan.name}
                  className="w-full h-64 sm:h-80 lg:h-96 object-cover rounded-lg cursor-pointer"
                  onClick={() => setIsFullscreen(true)}
                />
                {/* Fullscreen button */}
                <button
                  onClick={() => setIsFullscreen(true)}
                  className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-2 bg-black/60 hover:bg-black/80 text-white text-sm rounded-full transition-colors"
                >
                  <Maximize2 className="w-4 h-4" />
                  <span>Fullscreen</span>
                </button>
              </div>
            ) : (
              <div className="w-full h-96 bg-gray-100 rounded-lg flex flex-col items-center justify-center text-gray-400">
                <ImageIcon className="w-12 h-12 mb-2" />
                <p>No preview image available</p>
              </div>
            )}

            {imageUrls.length > 1 && (
              <div className="flex gap-2 mt-4 overflow-x-auto">
                {imageUrls.map((url, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleThumbnailClick(idx)}
                    className={`relative h-14 w-20 rounded-md overflow-hidden border transition-all flex-shrink-0 ${
                      idx === currentImageIndex
                        ? 'border-teal-600 ring-1 ring-teal-500'
                        : 'border-gray-200 hover:border-teal-400'
                    }`}
                  >
                    <img src={url} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">{plan.name?.trim()}</h2>
            <p className="text-gray-600 mb-4">
              {plan.project_type}
              {plan.category ? ` · ${plan.category}` : ''}
            </p>

            <div className="mb-6">
              <div className="text-sm text-gray-600 mb-1">Price</div>
              <div className="text-3xl font-bold text-teal-600 mb-2">
                {priceNumber ? `$${priceNumber.toLocaleString()}` : 'Contact for price'}
              </div>
              <div className="inline-block px-3 py-1 bg-teal-100 text-teal-800 text-xs font-medium rounded-full">
                {plan.package_level?.toUpperCase()}
              </div>
            </div>

            {/* Quick Actions */}
            {isAuthenticated && !isAdmin && (
              <div className="flex items-center gap-2 mb-6">
                <button
                  onClick={handleAddToCart}
                  disabled={isAddingToCart || isInCart}
                  className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title={isInCart ? "In Cart" : "Add to Cart"}
                >
                  {isAddingToCart ? (
                    <Loader2 className="w-5 h-5 animate-spin text-gray-600" />
                  ) : isInCart ? (
                    <ShoppingCart className="w-5 h-5 text-teal-600" />
                  ) : (
                    <Plus className="w-5 h-5 text-gray-600" />
                  )}
                </button>

                <button
                  onClick={handleToggleFavorite}
                  disabled={isAddingToFavorites}
                  className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title={isInFavorites ? "Remove from Favorites" : "Add to Favorites"}
                >
                  {isAddingToFavorites ? (
                    <Loader2 className="w-5 h-5 animate-spin text-gray-600" />
                  ) : (
                    <Heart className={`w-5 h-5 ${isInFavorites ? 'fill-current text-pink-600' : 'text-gray-600'}`} />
                  )}
                </button>

                {cartSuccess && (
                  <div className="text-xs text-green-600 font-medium">Added to cart</div>
                )}
                {favoriteSuccess && (
                  <div className="text-xs text-pink-600 font-medium">
                    {isInFavorites ? 'Favorited' : 'Removed'}
                  </div>
                )}
              </div>
            )}

            <p className="text-gray-700 leading-relaxed">{plan.description}</p>

            {/* Key metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              {plan.area && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-600">Area</div>
                  <div className="text-lg font-semibold text-gray-900">{plan.area} m²</div>
                </div>
              )}
              {plan.bedrooms && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-600">Bedrooms</div>
                  <div className="text-lg font-semibold text-gray-900">{plan.bedrooms}</div>
                </div>
              )}
              {plan.bathrooms && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-600">Bathrooms</div>
                  <div className="text-lg font-semibold text-gray-900">{plan.bathrooms}</div>
                </div>
              )}
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">Floors</div>
                <div className="text-lg font-semibold text-gray-900">{plan.floors}</div>
              </div>
            </div>

            {/* Disciplines */}
            {plan.disciplines_included && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Included disciplines</h3>
                <div className="flex flex-wrap gap-2">
                  {plan.disciplines_included.architectural && (
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">Architectural</span>
                  )}
                  {plan.disciplines_included.structural && (
                    <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full">Structural</span>
                  )}
                  {plan.disciplines_included.mep &&
                    (plan.disciplines_included.mep.electrical ||
                      plan.disciplines_included.mep.plumbing ||
                      plan.disciplines_included.mep.mechanical) && (
                      <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full">MEP</span>
                    )}
                  {plan.disciplines_included.civil && (
                    <span className="px-3 py-1 bg-orange-100 text-orange-800 text-sm rounded-full">Civil</span>
                  )}
                  {plan.disciplines_included.fire_safety && (
                    <span className="px-3 py-1 bg-red-100 text-red-800 text-sm rounded-full">Fire & Safety</span>
                  )}
                  {plan.disciplines_included.interior && (
                    <span className="px-3 py-1 bg-pink-100 text-pink-800 text-sm rounded-full">Interior</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: meta & technical overview */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-teal-600" />
              Overview
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Type:</span>
                <span className="font-medium text-gray-900">{plan.project_type}</span>
              </div>
              {plan.building_code && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Code:</span>
                  <span className="font-medium text-gray-900">{plan.building_code}</span>
                </div>
              )}
              {plan.license_type && (
                <div className="flex justify-between">
                  <span className="text-gray-600">License:</span>
                  <span className="font-medium text-gray-900">{plan.license_type.replace('_', ' ')}</span>
                </div>
              )}
              {typeof plan.customization_available === 'boolean' && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Customization:</span>
                  <span className="font-medium text-gray-900">
                    {plan.customization_available ? 'Available' : 'Not available'}
                  </span>
                </div>
              )}
              {plan.support_duration !== undefined && plan.support_duration !== null && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Support:</span>
                  <span className="font-medium text-gray-900">{plan.support_duration} months</span>
                </div>
              )}
              {plan.estimated_cost_min && plan.estimated_cost_max && (
                <div className="pt-3 border-t">
                  <div className="text-gray-600 mb-1">Estimated build cost:</div>
                  <div className="font-medium text-gray-900">
                    $ {plan.estimated_cost_min.toLocaleString()} - ${plan.estimated_cost_max.toLocaleString()}
                  </div>
                </div>
              )}
              {plan.sales_count !== undefined && (
                <div className="pt-3 border-t text-center text-gray-600">
                  {plan.sales_count} sale{(plan.sales_count || 0) === 1 ? '' : 's'} so far
                </div>
              )}
            </div>
          </div>

          {(hasStructural || availableFileTypes.length > 0) && (
            <section className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-900 text-white p-6 shadow-[0_25px_60px_-40px_rgba(15,23,42,0.9)]">
              <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-800 text-teal-300">
                    <FileText className="w-5 h-5" />
                  </span>
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Technical bundle</p>
                    <h3 className="text-2xl font-semibold">Technical contents</h3>
                  </div>
                </div>
                <span className="px-4 py-1 rounded-full text-xs uppercase tracking-wide bg-white/5 border border-white/10 text-teal-200">
                  Secure delivery
                </span>
              </header>

              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-3">What's included</div>
                  <ul className="space-y-2 text-sm text-white/90">
                    {hasStructural && (
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-300" />
                        Structural specs ({structuralSpecs.length})
                      </li>
                    )}
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-300" />
                      Permit-ready PDFs & CAD sets
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />
                      BOQ + schedules + notes
                    </li>
                  </ul>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-3">Delivery</div>
                  <ul className="space-y-2 text-sm text-white/90">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                      One-time secure link post-purchase
                    </li>
                  </ul>
                </div>
              </div>

              <div className="space-y-3">
                {purchaseSuccess && (
                  <div className="p-3 rounded-2xl border border-emerald-400/40 bg-emerald-400/10 flex items-center gap-2 text-sm text-white">
                    <CheckCircle className="w-5 h-5 text-emerald-300" />
                    Purchase complete — download starting
                  </div>
                )}

                {downloadError && (
                  <div className="p-3 rounded-2xl border border-rose-400/40 bg-rose-400/10 flex items-center gap-2 text-sm text-white">
                    <AlertCircle className="w-5 h-5 text-rose-300" />
                    {downloadError}
                  </div>
                )}

                {isAdmin ? (
                  <button
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-teal-400 text-slate-900 font-semibold hover:bg-teal-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Downloading...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Download Technical Files (Admin)
                      </>
                    )}
                  </button>
                ) : !isAuthenticated ? (
                  <button
                    onClick={() => navigate('/login')}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-white/20 text-white/80 hover:text-white"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Login to purchase
                  </button>
                ) : purchaseStatus === 'processing' ? (
                  <div className="space-y-2">
                    <button
                      onClick={() => handleVerifyPayment()}
                      disabled={isPurchasing}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-amber-400 text-slate-900 font-semibold hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isPurchasing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Verifying payment...
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4" />
                          I have paid — verify payment
                        </>
                      )}
                    </button>
                    <p className="text-[11px] text-amber-100 text-center">
                      Complete Paystack payment in the opened tab, then click “Verify payment”.
                    </p>
                  </div>
                ) : purchaseStatus === 'purchased' ? (
                  <button
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-teal-400 text-slate-900 font-semibold hover:bg-teal-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating link...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Download technical files
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handlePurchase}
                    disabled={isPurchasing}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-500 font-semibold text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isPurchasing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4" />
                        Purchase plan · $ {Number(plan.price).toLocaleString()}
                      </>
                    )}
                  </button>
                )}

                <p className="text-[11px] text-slate-400 text-center">
                  {isAdmin ? (
                    "Admin: instant access to every technical file"
                  ) : purchaseStatus === 'purchased' ? (
                    "One-time download link issued and revoked after use"
                  ) : (
                    "Secure checkout • access delivered instantly after payment"
                  )}
                </p>
              </div>
            </section>
          )}

          {plan.certifications && plan.certifications.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-teal-600" />
                Certifications
              </h3>
              <ul className="space-y-2">
                {plan.certifications.map((c, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-teal-600 mt-1">✓</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(plan.project_timeline_ref || plan.material_specifications || plan.construction_notes) && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Construction notes</h3>
              <div className="space-y-3 text-sm text-gray-700">
                {plan.project_timeline_ref && (
                  <div>
                    <div className="font-medium text-gray-900 mb-1">Typical timeline</div>
                    <div>{plan.project_timeline_ref}</div>
                  </div>
                )}
                {plan.material_specifications && (
                  <div>
                    <div className="font-medium text-gray-900 mb-1">Materials</div>
                    <div>{plan.material_specifications}</div>
                  </div>
                )}
                {plan.construction_notes && (
                  <div>
                    <div className="font-medium text-gray-900 mb-1">Notes</div>
                    <div>{plan.construction_notes}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {plan.includes_boq && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">BOQ & documents</h3>
              <p className="text-sm text-gray-700">
                This plan includes a Bill of Quantities and technical documents. Download and document access will be
                wired here after purchase.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen overlay */}
      {isFullscreen && imageUrls.length > 0 && (
        <div
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center"
          onClick={() => setIsFullscreen(false)}
        >
          {/* Close button */}
          <button
            onClick={() => setIsFullscreen(false)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-10"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Previous button */}
          {imageUrls.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrevImage();
              }}
              className="absolute left-4 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-10"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
          )}

          {/* Image */}
          <img
            src={imageUrls[currentImageIndex]}
            alt={`${plan.name} - Image ${currentImageIndex + 1}`}
            className="max-w-[90vw] max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Next button */}
          {imageUrls.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNextImage();
              }}
              className="absolute right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-10"
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          )}

          {/* Image counter */}
          {imageUrls.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/60 text-white text-sm rounded-full">
              {currentImageIndex + 1} / {imageUrls.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}