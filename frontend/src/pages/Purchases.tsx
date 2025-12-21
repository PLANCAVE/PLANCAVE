import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Download, Copy, ExternalLink, RefreshCw, CreditCard } from 'lucide-react';
import { generatePurchaseDownloadLink, getMyPurchases, retryPaystackPayment } from '../api';
import api from '../api';

type PurchaseRow = {
  id: string;
  order_id?: string | null;
  plan_id: string;
  plan_name: string;
  category?: string | null;
  image_url?: string | null;
  designer_name?: string | null;
  amount?: number | string | null;
  payment_status?: string | null;
  transaction_id?: string | null;
  selected_deliverables?: string[];
  download_status?: 'not_generated' | 'pending_download' | 'downloaded' | null;
  last_downloaded_at?: string | null;
};

const resolveMediaUrl = (path?: string) => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const cleanedPath = path.replace(/^\/api(?=\/)/, '');
  return cleanedPath.startsWith('/') ? cleanedPath : `/${cleanedPath}`;
};

export default function Purchases() {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [busyPurchaseId, setBusyPurchaseId] = useState<string | null>(null);
  const [tokenByPurchaseId, setTokenByPurchaseId] = useState<Record<string, string>>({});
  const [copiedPurchaseId, setCopiedPurchaseId] = useState<string | null>(null);

  const apiBase = useMemo(() => {
    const base = (api.defaults.baseURL || '').replace(/\/+$/, '');
    return base || '/api';
  }, []);

  const loadPurchases = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await getMyPurchases();
      const list: PurchaseRow[] = resp.data?.purchases || [];
      setPurchases(list);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load purchases');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPurchases();
  }, []);

  useEffect(() => {
    const shouldRefresh = Boolean((location.state as any)?.refresh);
    if (!shouldRefresh) return;
    loadPurchases();
    // Clear the refresh flag so back/forward navigation doesn't keep reloading.
    window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  const handleGenerate = async (purchaseId: string, downloadStatus?: PurchaseRow['download_status']) => {
    if (downloadStatus === 'downloaded') {
      return;
    }
    setBusyPurchaseId(purchaseId);
    setCopiedPurchaseId(null);
    try {
      const resp = await generatePurchaseDownloadLink(purchaseId);
      const token = resp.data?.download_token;
      if (token) {
        setTokenByPurchaseId((prev: Record<string, string>) => ({ ...prev, [purchaseId]: token }));
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to generate download link');
    } finally {
      setBusyPurchaseId(null);
    }
  };

  const buildDownloadUrl = (token: string) => {
    const safeBase = apiBase.startsWith('http') ? apiBase : `${window.location.origin}${apiBase.startsWith('/') ? '' : '/'}${apiBase}`;
    return `${safeBase}/customer/plans/download/${token}`;
  };

  const handleCopy = async (purchaseId: string) => {
    const token = tokenByPurchaseId[purchaseId];
    if (!token) return;

    const url = buildDownloadUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedPurchaseId(purchaseId);
      setTimeout(() => setCopiedPurchaseId(null), 2000);
    } catch {
      setError('Failed to copy link. Please copy it manually.');
    }
  };

  const handleCompletePayment = async (purchase: PurchaseRow) => {
    if (!purchase.id) return;
    if (!purchase.plan_id) {
      setError('Unknown plan for this purchase');
      return;
    }

    // Only show spinner/disable if still pending
    const willDisable = (purchase.payment_status || '').toLowerCase() !== 'completed';
    if (willDisable) {
      setBusyPurchaseId(purchase.id);
    }
    setError(null);
    try {
      const resp = await retryPaystackPayment(purchase.id);
      const authUrl = resp.data?.authorization_url;
      if (authUrl) {
        window.open(authUrl, '_blank', 'noopener');
      }
      // After reinitialization, refresh purchases to get latest reference and status
      await loadPurchases();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to reinitialize payment';
      setError(msg);
    } finally {
      if (willDisable) {
        setBusyPurchaseId(null);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-teal-50/20 py-8">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mt-2">Purchased Plans</h1>
          </div>
          <button
            type="button"
            onClick={loadPurchases}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {error ? (
          <div className="mb-6 p-4 rounded-lg border border-red-200 bg-red-50 text-red-800">{error}</div>
        ) : null}

        {purchases.length === 0 ? (
          <div className="card text-center py-12">
            <h3 className="text-xl font-bold text-gray-900 mb-2">No purchases yet</h3>
            <p className="text-gray-600 mb-4">Browse plans and purchase to unlock downloads.</p>
            <Link to="/plans" className="btn-primary inline-block">Browse Plans</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {purchases.map((p) => {
              const token = tokenByPurchaseId[p.id];
              const canDownload = p.payment_status === 'completed';
              const url = token ? buildDownloadUrl(token) : '';
              const downloadStatus = p.download_status || null;
              const lastDownloadedAt = p.last_downloaded_at ? new Date(p.last_downloaded_at).toLocaleString() : null;

              return (
                <div key={p.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="flex gap-4 p-4">
                    <div className="w-24 h-20 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
                      {p.image_url ? (
                        <img src={resolveMediaUrl(p.image_url)} alt={p.plan_name} className="w-full h-full object-cover" />
                      ) : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs uppercase tracking-[0.25em] text-gray-500">{p.category || 'Plan'}</p>
                      <h2 className="text-lg font-semibold text-gray-900 truncate">{p.plan_name}</h2>
                      <p className="text-sm text-gray-600 truncate">Designer: {p.designer_name || '—'}</p>
                      <div className="flex items-center justify-between mt-3">
                        <div>
                          <p className="text-xs text-gray-500">Status</p>
                          <p className={`text-sm font-semibold ${canDownload ? 'text-green-700' : 'text-amber-700'}`}>{p.payment_status}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Amount</p>
                          <p className="text-sm font-semibold">{Number(p.amount || 0).toLocaleString()}</p>
                        </div>
                      </div>
                      {downloadStatus ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                              downloadStatus === 'downloaded'
                                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                : downloadStatus === 'pending_download'
                                  ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                  : 'bg-gray-100 text-gray-600 border border-gray-200'
                            }`}
                          >
                            {downloadStatus === 'downloaded'
                              ? 'Downloaded'
                              : downloadStatus === 'pending_download'
                                ? 'Download pending'
                                : 'Download link not generated'}
                          </span>
                          {lastDownloadedAt ? (
                            <span className="text-xs text-gray-500">Last download: {lastDownloadedAt}</span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="border-t border-gray-100 p-4 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {!canDownload && p.plan_id && (
                        <button
                          type="button"
                          onClick={() => handleCompletePayment(p)}
                          disabled={busyPurchaseId === p.id}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                        >
                          <CreditCard className="w-4 h-4" />
                          Complete Payment
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleGenerate(p.id, downloadStatus)}
                        disabled={!canDownload || busyPurchaseId === p.id || downloadStatus === 'downloaded'}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white disabled:opacity-50"
                      >
                        <Download className="w-4 h-4" />
                        {busyPurchaseId === p.id ? 'Generating…' : 'Generate Download Link'}
                      </button>

                      {token ? (
                        <a
                          href={url}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50"
                        >
                          <ExternalLink className="w-4 h-4" /> Open Download
                        </a>
                      ) : null}
                    </div>

                    {token ? (
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                        <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Copyable link</p>
                        <div className="flex items-center gap-2 mt-2">
                          <input
                            readOnly
                            value={url}
                            className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700"
                          />
                          <button
                            type="button"
                            onClick={() => handleCopy(p.id)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
                          >
                            <Copy className="w-4 h-4" />
                            {copiedPurchaseId === p.id ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          {downloadStatus === 'downloaded'
                            ? 'Download completed. Contact support if you need help accessing your files.'
                            : 'This link expires automatically after first use.'}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
