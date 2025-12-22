import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getPlanDetails, adminDownloadPlan, designerDownloadPlan, purchasePlan, verifyPurchase, verifyPaystackPayment, trackPlanView } from '../api';
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
  designer_name?: string | null;
  designer_role?: string | null;
  deliverable_prices?: Record<string, number | string> | null;
}

export default function PlanDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
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
  const [purchaseDownloadStatus, setPurchaseDownloadStatus] = useState<'pending_download' | 'downloaded' | null>(null);
  const [lastDownloadedAt, setLastDownloadedAt] = useState<string | null>(null);
  const [purchasedDeliverables, setPurchasedDeliverables] = useState<string[]>([]);
  const [fullPurchase, setFullPurchase] = useState(false);
  const autoVerifyRanRef = useRef(false);
  const selectionTouchedRef = useRef(false);
  const lastPlanIdRef = useRef<string | null>(null);
  const hadPriorPurchasesRef = useRef(false);
  
  // Cart and favorites states
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isAddingToFavorites, setIsAddingToFavorites] = useState(false);
  const [cartSuccess, setCartSuccess] = useState(false);
  const [favoriteSuccess, setFavoriteSuccess] = useState(false);

  const [selectedDeliverables, setSelectedDeliverables] = useState<string[]>([]);

  const isPlanOwnerDesigner = Boolean(
    isDesigner &&
      user &&
      plan?.designer_id !== undefined &&
      plan?.designer_id !== null &&
      Number(plan.designer_id) === Number((user as any).id)
  );

  const isBuyer = Boolean(isAuthenticated && !isAdmin && !isPlanOwnerDesigner);

  const designerLabel = (() => {
    if (!plan) return '';
    if (plan.designer_role === 'admin') return 'Ramanicave LTD';
    return plan.designer_name || '—';
  })();

  const resolveMediaUrl = (path?: string) => {
    if (!path) return '';
    // If it's a full URL (like from Cloudinary), use it directly.
    if (/^https?:\/\//i.test(path)) {
      return path;
    }
    // For local paths, ensure it's a root-relative path.
    // This handles paths from the backend like '/uploads/...' correctly.
    const cleanedPath = path.replace(/^\/api(?=\/)/, '');
    return cleanedPath.startsWith('/') ? cleanedPath : `/${cleanedPath}`;
  };

  // Auto-verify ONLY when Paystack redirects back with ?reference=...
  // Runs once and then cleans up the URL to prevent repeated verifies on refresh.
  useEffect(() => {
    if (!isAuthenticated) return;
    if (autoVerifyRanRef.current) return;

    const params = new URLSearchParams(window.location.search);
    const ref = params.get('reference');
    if (!ref) return;

    autoVerifyRanRef.current = true;

    // Remove reference from URL immediately to avoid re-triggering.
    params.delete('reference');
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`;
    window.history.replaceState({}, document.title, nextUrl);

    handleVerifyPayment(ref);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

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

  useEffect(() => {
    if (!plan) {
      lastPlanIdRef.current = null;
      if (selectedDeliverables.length > 0) {
        selectionTouchedRef.current = false;
        setSelectedDeliverables([]);
      }
      return;
    }

    const planChanged = plan.id !== lastPlanIdRef.current;
    if (planChanged) {
      lastPlanIdRef.current = plan.id;
      selectionTouchedRef.current = false;
    }

    const rawPrices = plan.deliverable_prices;
    if (!rawPrices || typeof rawPrices !== 'object') {
      if (selectedDeliverables.length > 0) {
        selectionTouchedRef.current = false;
        setSelectedDeliverables([]);
      }
      return;
    }

    const deliverableKeyForFileType = (fileType?: string | null): string | null => {
      if (!fileType) return null;
      const ft = String(fileType).toUpperCase();
      if (ft.startsWith('ARCH')) return 'architectural';
      if (ft.startsWith('STRUCT')) return 'structural';
      if (ft.startsWith('MEP')) return 'mep';
      if (ft.startsWith('CIVIL')) return 'civil';
      if (ft.startsWith('FIRE')) return 'fire_safety';
      if (ft.startsWith('INTERIOR')) return 'interior';
      if (ft.startsWith('BOQ')) return 'boq';
      if (ft.startsWith('RENDER')) return 'renders';
      return null;
    };

    const includedDeliverableKeys = new Set(
      (plan.files || [])
        .map((f) => deliverableKeyForFileType((f as any)?.file_type))
        .filter(Boolean) as string[]
    );

    const availableKeys = Object.entries(rawPrices)
      .filter(([, value]) => {
        const numeric = value === '' || value === null || value === undefined ? 0 : Number(value);
        return Number.isFinite(numeric) && numeric > 0;
      })
      .map(([key]) => key);

    const availableIncludedKeys = availableKeys.filter((key) => includedDeliverableKeys.has(key));

    if (availableIncludedKeys.length === 0) {
      if (selectedDeliverables.length > 0) {
        selectionTouchedRef.current = false;
        setSelectedDeliverables([]);
      }
      return;
    }

    if (fullPurchase) {
      if (selectedDeliverables.length > 0) {
        selectionTouchedRef.current = false;
        setSelectedDeliverables([]);
      }
      return;
    }

    const purchasedSet = new Set(purchasedDeliverables);
    const hasPriorPurchases = purchasedSet.size > 0;

    // Fix initial-load race:
    // On first render, purchasedDeliverables is empty so we may auto-select all deliverables.
    // When purchase status loads and we discover the user has prior purchases, we want upgrades
    // to start deselected (unless the user already changed selection manually).
    if (hasPriorPurchases && !hadPriorPurchasesRef.current) {
      hadPriorPurchasesRef.current = true;
      if (!selectionTouchedRef.current) {
        if (selectedDeliverables.length > 0) {
          setSelectedDeliverables([]);
          return;
        }
      }
    } else if (!hasPriorPurchases && hadPriorPurchasesRef.current) {
      hadPriorPurchasesRef.current = false;
    }
    const sanitizedSelection = selectedDeliverables.filter(
      (key) => availableIncludedKeys.includes(key) && !purchasedSet.has(key)
    );

    const remainingKeys = availableIncludedKeys.filter((key) => !purchasedSet.has(key));

    let nextSelection = sanitizedSelection;

    const shouldDefaultSelection =
      planChanged || (!selectionTouchedRef.current && sanitizedSelection.length === 0 && remainingKeys.length > 0);

    if (shouldDefaultSelection) {
      nextSelection = hasPriorPurchases ? [] : remainingKeys;
    }

    const hasSameItems =
      nextSelection.length === selectedDeliverables.length &&
      nextSelection.every((key) => selectedDeliverables.includes(key));

    if (!hasSameItems) {
      selectionTouchedRef.current = false;
      setSelectedDeliverables(nextSelection);
    }
  }, [plan, purchasedDeliverables, fullPurchase, selectedDeliverables]);

  // Check purchase status when plan loads and user is authenticated
  useEffect(() => {
    if (plan && isBuyer) {
      checkPurchaseStatus();
    }
  }, [plan, isBuyer]);

  // Track a view whenever the plan details page is opened.
  // Without this, analytics can show 0 views even when sales/downloads exist.
  useEffect(() => {
    if (!id) return;
    trackPlanView(id, user?.id ?? null).catch(() => {
      // best-effort only
    });
  }, [id]);

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
      const resp = await purchasePlan(
        id,
        'paystack',
        selectedDeliverables.length > 0 ? selectedDeliverables : undefined
      );
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
        navigate('/purchases', { state: { refresh: true } });
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Purchase failed. Please try again.';
      setDownloadError(msg);
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleAdminDownload = async () => {
    if (!id || !plan) return;

    setIsDownloading(true);
    setDownloadError(null);

    try {
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
    } catch (err: any) {
      console.error('Admin download error', err);
      const msg = err?.response?.data?.message || err?.message || 'Admin download failed. Please try again.';
      setDownloadError(String(msg));
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDesignerDownload = async () => {
    if (!id || !plan) {
      setDownloadError('Unable to locate this plan for download.');
      return;
    }

    setIsDownloading(true);
    setDownloadError(null);

    try {
      const response = await designerDownloadPlan(id);
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${plan.name || 'plan'}-technical-files.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Designer download error', err);
      const msg = err?.response?.data?.message || err?.message || 'Failed to download files. Please try again.';
      setDownloadError(String(msg));
    } finally {
      setIsDownloading(false);
    }
  };

  const handleVerifyPayment = async (referenceToVerify?: string) => {
    let ref = referenceToVerify || pendingReference;
    
    // If no reference provided, fetch the latest purchase for this plan
    if (!ref && id) {
      try {
        const resp = await verifyPurchase(id);
        const transactionId = resp.data?.transaction_id as string | undefined;
        if (transactionId) {
          ref = transactionId;
          setPendingReference(transactionId);
        }
      } catch (err) {
        // If we can't get purchase status, continue with error
      }
    }
    
    if (!ref) {
      setDownloadError('No payment reference to verify. Please start a new purchase.');
      return;
    }
    setDownloadError(null);
    setIsPurchasing(true);
    try {
      await verifyPaystackPayment(ref);
      setPurchaseStatus('purchased');
      setPurchaseSuccess(true);
      setPendingReference(null);
      navigate('/purchases', { state: { refresh: true } });
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
      const transactionId = resp.data?.transaction_id as string | undefined;
      const dlStatus = resp.data?.download_status as 'pending_download' | 'downloaded' | undefined;
      const lastDl = resp.data?.last_downloaded_at as string | undefined;
      const purchased = resp.data?.purchased_deliverables as string[] | undefined;
      const isFull = Boolean(resp.data?.full_purchase);
      if (status === 'completed' || status === 'purchased') {
        setPurchaseStatus('purchased');
        setPendingReference(null);
        setPurchaseDownloadStatus(dlStatus || null);
        setLastDownloadedAt(lastDl || null);
        setPurchasedDeliverables(Array.isArray(purchased) ? purchased : []);
        setFullPurchase(isFull);
      } else if (status === 'pending') {
        setPurchaseStatus('processing');
        if (transactionId) {
          setPendingReference(transactionId);
        }
        setPurchaseDownloadStatus(null);
        setLastDownloadedAt(null);
        setPurchasedDeliverables(Array.isArray(purchased) ? purchased : []);
        setFullPurchase(isFull);
      } else {
        setPurchaseStatus('none');
        setPendingReference(null);
        setPurchaseDownloadStatus(null);
        setLastDownloadedAt(null);
        setPurchasedDeliverables([]);
        setFullPurchase(false);
      }
    } catch {
      setPurchaseStatus('none');
      setPendingReference(null);
      setPurchaseDownloadStatus(null);
      setLastDownloadedAt(null);
      setPurchasedDeliverables([]);
      setFullPurchase(false);
    }
  };

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
  const deliverablePrices = plan.deliverable_prices && typeof plan.deliverable_prices === 'object' ? plan.deliverable_prices : null;

  const deliverableKeyForFileType = (fileType?: string | null): string | null => {
    if (!fileType) return null;
    const ft = String(fileType).toUpperCase();
    if (ft.startsWith('ARCH')) return 'architectural';
    if (ft.startsWith('STRUCT')) return 'structural';
    if (ft.startsWith('MEP')) return 'mep';
    if (ft.startsWith('CIVIL')) return 'civil';
    if (ft.startsWith('FIRE')) return 'fire_safety';
    if (ft.startsWith('INTERIOR')) return 'interior';
    if (ft.startsWith('BOQ')) return 'boq';
    if (ft.startsWith('RENDER')) return 'renders';
    return null;
  };

  const includedDeliverableKeys = new Set(
    (plan.files || [])
      .map((f) => deliverableKeyForFileType((f as any)?.file_type))
      .filter(Boolean) as string[]
  );

  const pricedDeliverables = deliverablePrices
    ? Object.entries(deliverablePrices).filter(([, value]) => {
        const n = value === '' || value === null || value === undefined ? 0 : Number(value);
        return Number.isFinite(n) && n > 0;
      })
    : [];
  const freeDeliverables = deliverablePrices
    ? Object.entries(deliverablePrices).filter(([, value]) => {
        const n = value === '' || value === null || value === undefined ? 0 : Number(value);
        return Number.isFinite(n) && n === 0;
      })
    : [];

  const filteredPricedDeliverables = pricedDeliverables.filter(([key]) => includedDeliverableKeys.has(key));
  const filteredFreeDeliverables = freeDeliverables.filter(([key]) => includedDeliverableKeys.has(key));

  const hasAnyDeliverables = Boolean(deliverablePrices && filteredPricedDeliverables.length > 0);
  const remainingDeliverablesCount = (() => {
    if (!hasAnyDeliverables) return 0;
    if (fullPurchase) return 0;
    const purchasedSet = new Set(purchasedDeliverables);
    return filteredPricedDeliverables.reduce((count, [key]) => count + (purchasedSet.has(key) ? 0 : 1), 0);
  })();
  const selectedTotal = (() => {
    if (!deliverablePrices) return priceNumber || 0;
    return selectedDeliverables.reduce((sum, key) => {
      const raw = deliverablePrices[key];
      const n = raw === '' || raw === null || raw === undefined ? 0 : Number(raw);
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);
  })();
  const purchaseDisplayPrice = deliverablePrices ? selectedTotal || 0 : priceNumber || 0;
  const imageUrls = getImageUrls();
  const mainImageUrl = imageUrls[currentImageIndex] || '';
  const structuralSpecs = plan.structural_specs || [];
  const hasStructural = structuralSpecs.length > 0;
  const availableFileTypes = Array.from(
    new Set((plan.files || []).map((f) => f.file_type).filter(Boolean))
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-teal-50/30 p-4 sm:p-6 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="absolute -bottom-28 -left-28 h-96 w-96 rounded-full bg-cyan-400/20 blur-3xl" />
      </div>

      {/* Back + title row */}
      <div className="max-w-7xl mx-auto mb-6 relative">
        <button
          onClick={() => navigate('/plans')}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-950 rounded-full border border-slate-200 bg-white/70 px-4 py-2 shadow-sm transition-all hover:-translate-y-0.5"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to plans
        </button>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-4 tracking-tight">Plan details</h1>
      </div>

      {/* Main layout */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
        {/* Left: image gallery and summary */}
        <div className="lg:col-span-2 space-y-6">
          {/* Gallery */}
          <div className="rounded-2xl border border-slate-200/70 bg-white/80 backdrop-blur shadow-sm p-5 sm:p-6">
            {mainImageUrl ? (
              <div className="relative">
                <img
                  src={mainImageUrl}
                  alt={plan.name}
                  className="w-full h-64 sm:h-80 lg:h-96 object-cover rounded-2xl cursor-pointer shadow-sm"
                  onClick={() => setIsFullscreen(true)}
                />
                {/* Fullscreen button */}
                <button
                  onClick={() => setIsFullscreen(true)}
                  className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-2 bg-black/60 hover:bg-black/80 text-white text-sm rounded-full transition-colors backdrop-blur"
                >
                  <Maximize2 className="w-4 h-4" />
                  <span>Fullscreen</span>
                </button>
              </div>
            ) : (
              <div className="w-full h-96 bg-slate-100 rounded-2xl flex flex-col items-center justify-center text-slate-400">
                <ImageIcon className="w-12 h-12 mb-2" />
                <p>No preview image available</p>
              </div>
            )}

            {isAuthenticated && isAdmin && id ? (
              <div className="mb-6">
                <button
                  type="button"
                  onClick={() => navigate(`/designer/upload?edit=${id}`)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  Edit plan
                </button>
              </div>
            ) : null}

            {imageUrls.length > 1 && (
              <div className="flex gap-2 mt-4 overflow-x-auto">
                {imageUrls.map((url, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleThumbnailClick(idx)}
                    className={`relative h-14 w-20 rounded-xl overflow-hidden border transition-all flex-shrink-0 ${
                      idx === currentImageIndex
                        ? 'border-teal-600 ring-1 ring-teal-500'
                        : 'border-slate-200 hover:border-teal-300'
                    }`}
                  >
                    <img src={url} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200/70 bg-white/80 backdrop-blur shadow-sm p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2 tracking-tight">{plan.name?.trim()}</h2>
                <p className="text-slate-600">
                  {plan.project_type}
                  {plan.category ? ` · ${plan.category}` : ''}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {plan.includes_boq ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                    <FileText className="w-4 h-4" />
                    BOQ Included
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-semibold text-slate-700">
                    <FileText className="w-4 h-4 text-slate-500" />
                    No BOQ
                  </span>
                )}
                {plan.certifications && plan.certifications.length > 0 ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                    <Award className="w-4 h-4" />
                    {plan.certifications.length} Certification{plan.certifications.length > 1 ? 's' : ''}
                  </span>
                ) : null}
              </div>
            </div>

            {isAuthenticated && !isAdmin && purchaseStatus === 'purchased' ? (
              <div className="mb-4">
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                  <CheckCircle className="w-4 h-4" />
                  {fullPurchase ? 'Purchased' : 'Partially Purchased'}
                </span>
              </div>
            ) : null}

            <div className="mt-5 text-sm text-slate-600 mb-6">
              Designer: <span className="font-semibold text-slate-900">{designerLabel}</span>
            </div>

            <div className="mb-6">
              <div className="text-xs font-semibold tracking-[0.25em] text-slate-500 uppercase mb-2">Price</div>
              <div className="text-3xl sm:text-4xl font-bold text-teal-700 mb-2 tracking-tight">
                {deliverablePrices
                  ? `$${Number(selectedTotal || 0).toLocaleString()}`
                  : priceNumber
                    ? `$${Number(priceNumber).toLocaleString()}`
                    : 'Contact for price'}
              </div>
            </div>

            {/* Quick Actions */}
            {isAuthenticated && !isAdmin && (
              <div className="flex items-center gap-2 mb-6">
                <button
                  onClick={handleAddToCart}
                  disabled={isAddingToCart || isInCart}
                  className="p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5"
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
                  className="p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5"
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

            <p className="text-slate-700 leading-relaxed">{plan.description}</p>

            {/* Key metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              {plan.area && (
                <div className="bg-white/70 border border-slate-200 p-3 rounded-xl shadow-sm">
                  <div className="text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase">Area</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">{plan.area} m²</div>
                </div>
              )}
              {plan.bedrooms && (
                <div className="bg-white/70 border border-slate-200 p-3 rounded-xl shadow-sm">
                  <div className="text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase">Bedrooms</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">{plan.bedrooms}</div>
                </div>
              )}
              {plan.bathrooms && (
                <div className="bg-white/70 border border-slate-200 p-3 rounded-xl shadow-sm">
                  <div className="text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase">Bathrooms</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">{plan.bathrooms}</div>
                </div>
              )}
              <div className="bg-white/70 border border-slate-200 p-3 rounded-xl shadow-sm">
                <div className="text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase">Floors</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">{plan.floors}</div>
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

            {!isAdmin && deliverablePrices && (filteredPricedDeliverables.length > 0 || filteredFreeDeliverables.length > 0) && (
              <div className="mt-10">
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-teal-50/40 p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div>
                      <div className="inline-flex items-center gap-2 mb-2">
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600">
                          Optional purchase
                        </span>
                        <span className="text-xs text-slate-500">Select deliverables</span>
                      </div>
                      <div className="text-xl font-semibold text-slate-900 leading-tight">Choose what to buy</div>
                      <div className="text-sm text-slate-600 mt-1 max-w-xl">
                        Select only the disciplines you need. Your total updates as you make changes.
                      </div>
                      {filteredFreeDeliverables.length > 0 ? (
                        <div className="mt-2 text-xs text-slate-600">
                          Free items are included automatically in your download.
                        </div>
                      ) : null}
                      {purchaseStatus === 'purchased' ? (
                        <div className="text-xs text-slate-500 mt-2">
                          {fullPurchase
                            ? 'You already own the full plan.'
                            : remainingDeliverablesCount > 0
                              ? `You already purchased some items. ${remainingDeliverablesCount} more available to buy.`
                              : 'You already purchased all available deliverables.'}
                        </div>
                      ) : null}
                    </div>
                    <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-right">
                      <div className="text-[11px] uppercase tracking-wide text-teal-700">Total</div>
                      <div className="text-xl font-bold text-teal-900">$ {Number(selectedTotal || 0).toLocaleString()}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {filteredFreeDeliverables.map(([key]) => {
                      const label = key.replace(/_/g, ' ');
                      const isActuallyPurchased = purchasedDeliverables.includes(key);
                      const shouldShowAsPurchased = Boolean(fullPurchase || isActuallyPurchased);
                      return (
                        <div
                          key={key}
                          className="relative flex items-start gap-4 rounded-2xl border-2 p-5 transition-all duration-200 overflow-hidden border-slate-200 bg-white"
                        >
                          <div className="absolute inset-0 opacity-5">
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-teal-500"></div>
                          </div>

                          <div className="relative z-10">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          </div>

                          <div className="flex-1 relative z-10 pr-8">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <h4 className="text-base font-semibold text-slate-900 capitalize leading-tight">
                                  {label}
                                </h4>
                                <p className="text-xs text-slate-600 mt-1">
                                  {shouldShowAsPurchased ? 'Purchased (included)' : 'Included for free'}
                                </p>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold text-emerald-700">Free</div>
                                {shouldShowAsPurchased ? (
                                  <div className="text-xs text-emerald-700 font-medium mt-1">✓ Owned</div>
                                ) : (
                                  <div className="text-xs text-emerald-700 font-medium mt-1">✓ Included</div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="absolute top-5 right-5 w-6 h-6 rounded-full bg-emerald-600 text-white shadow-lg z-20">
                            <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        </div>
                      );
                    })}

                    {filteredPricedDeliverables.map(([key, value]) => {
                      const n = value === '' || value === null || value === undefined ? 0 : Number(value);
                      const isPurchased = Boolean(fullPurchase || purchasedDeliverables.includes(key));
                      const checked = isPurchased || selectedDeliverables.includes(key);
                      const label = key.replace(/_/g, ' ');
                      
                      // For partial owners: only purchased items are marked purchased; remaining items are selectable
                      const isActuallyPurchased = purchasedDeliverables.includes(key);
                      const shouldShowAsPurchased = isActuallyPurchased;
                      const shouldBeChecked = isActuallyPurchased || selectedDeliverables.includes(key);
                      
                      // Icon mapping for different deliverable types
                      const getIcon = (deliverableKey: string) => {
                        switch (deliverableKey) {
                          case 'architectural':
                            return (
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                              </div>
                            );
                          case 'renders':
                            return (
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            );
                          case 'structural':
                            return (
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </div>
                            );
                          case 'mep':
                            return (
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                              </div>
                            );
                          case 'civil':
                            return (
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                </svg>
                              </div>
                            );
                          case 'fire_safety':
                            return (
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                                </svg>
                              </div>
                            );
                          case 'interior':
                            return (
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                </svg>
                              </div>
                            );
                          default:
                            return (
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </div>
                            );
                        }
                      };
                      
                      return (
                        <label
                          key={key}
                          className={`group relative flex items-start gap-4 rounded-2xl border-2 p-5 transition-all duration-200 overflow-hidden ${
                            shouldShowAsPurchased
                              ? 'border-emerald-200 bg-emerald-50/50 opacity-90 cursor-not-allowed'
                              : shouldBeChecked
                                ? 'border-teal-400 bg-gradient-to-br from-teal-50 via-white to-blue-50 shadow-lg scale-[1.02] cursor-pointer'
                                : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md hover:scale-[1.01] cursor-pointer'
                          }`}
                        >
                          {/* Decorative background pattern */}
                          <div className={`absolute inset-0 opacity-5 transition-opacity ${
                            checked ? 'opacity-10' : 'opacity-0'
                          }`}>
                            <div className="absolute inset-0 bg-gradient-to-br from-teal-400 to-blue-500"></div>
                            <div className="absolute inset-0" style={{
                              backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.1) 1px, transparent 1px)',
                              backgroundSize: '20px 20px'
                            }}></div>
                          </div>
                          
                          {/* Hidden checkbox */}
                          <input
                            type="checkbox"
                            checked={shouldBeChecked}
                            disabled={shouldShowAsPurchased}
                            onChange={(e) => {
                              if (shouldShowAsPurchased) return;
                              selectionTouchedRef.current = true;
                              setSelectedDeliverables((prev) => {
                                if (e.target.checked) return Array.from(new Set([...prev, key]));
                                return prev.filter((x) => x !== key);
                              });
                            }}
                            className="sr-only"
                          />
                          
                          {/* Icon */}
                          <div className="relative z-10">
                            {getIcon(key)}
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1 relative z-10 pr-8">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <h4 className="text-base font-semibold text-slate-900 capitalize leading-tight">
                                  {label}
                                </h4>
                                <p className="text-xs text-slate-600 mt-1">
                                  {shouldShowAsPurchased ? 'Purchased' : shouldBeChecked ? 'Selected' : 'Add to your plan'}
                                </p>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold text-slate-900">
                                  $ {Number.isFinite(n) ? n.toLocaleString() : '—'}
                                </div>
                                {shouldShowAsPurchased ? (
                                  <div className="text-xs text-emerald-700 font-medium mt-1">✓ Purchased</div>
                                ) : shouldBeChecked ? (
                                  <div className="text-xs text-teal-600 font-medium mt-1">✓ Selected</div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                          
                          {/* Check indicator */}
                          <div className={`absolute top-5 right-5 w-6 h-6 rounded-full transition-all duration-200 z-20 ${
                            shouldShowAsPurchased
                              ? 'bg-emerald-600 text-white shadow-lg'
                              : shouldBeChecked
                                ? 'bg-teal-500 text-white shadow-lg'
                                : 'bg-white border-2 border-slate-300 text-transparent'
                          }`}>
                            {shouldBeChecked && (
                              <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
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
                    Purchase complete — go to Purchases to download
                  </div>
                )}

                {!isAdmin && purchaseStatus === 'purchased' && purchaseDownloadStatus === 'pending_download' ? (
                  <div className="p-3 rounded-2xl border border-teal-300/30 bg-teal-300/10 flex items-center justify-between gap-3 text-sm text-white">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-teal-200" />
                      Paid — pending download
                    </div>
                    <span className="text-[11px] text-teal-100/80">One-time link available</span>
                  </div>
                ) : null}

                {!isAdmin && purchaseStatus === 'purchased' && purchaseDownloadStatus === 'downloaded' ? (
                  <div className="p-3 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-between gap-3 text-sm text-white">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-emerald-300" />
                      Downloaded
                    </div>
                    <span className="text-[11px] text-slate-300">
                      {lastDownloadedAt ? `Last: ${new Date(lastDownloadedAt).toLocaleString()}` : ''}
                    </span>
                  </div>
                ) : null}

                {downloadError && (
                  <div className="p-3 rounded-2xl border border-rose-400/40 bg-rose-400/10 flex items-center gap-2 text-sm text-white">
                    <AlertCircle className="w-5 h-5 text-rose-300" />
                    {downloadError}
                  </div>
                )}

                {isAdmin ? (
                  <button
                    onClick={handleAdminDownload}
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
                ) : isPlanOwnerDesigner ? (
                  <button
                    onClick={handleDesignerDownload}
                    disabled={isDownloading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-teal-400 text-slate-900 font-semibold hover:bg-teal-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Preparing files...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Download your plan files
                      </>
                    )}
                  </button>
                ) : !isAuthenticated ? (
                  <button
                    onClick={() => navigate('/login', { state: { from: location.pathname + location.search } })}
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
                  !fullPurchase && selectedDeliverables.length > 0 ? (
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
                          Upgrade plan · $ {Number(purchaseDisplayPrice).toLocaleString()}
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={() => navigate('/purchases')}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-teal-400 text-slate-900 font-semibold hover:bg-teal-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Go to Purchases to download
                    </button>
                  )
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
                        Purchase plan · $ {Number(purchaseDisplayPrice).toLocaleString()}
                      </>
                    )}
                  </button>
                )}

                <p className="text-[11px] text-slate-400 text-center">
                  {isAdmin ? (
                    "Admin: instant access to every technical file"
                  ) : purchaseStatus === 'purchased' ? (
                    !fullPurchase && selectedDeliverables.length > 0
                      ? "You're upgrading — complete payment to unlock newly selected deliverables."
                      : "Download links are managed in your Purchases page."
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