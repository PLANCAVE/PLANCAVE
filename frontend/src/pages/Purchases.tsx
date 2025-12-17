import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { generateDownloadLink, getMyPurchases } from '../api';
import api from '../api';

type PurchaseRow = {
  id: string;
  plan_id: string;
  plan_name: string;
  category?: string | null;
  image_url?: string | null;
  designer_name?: string | null;
  amount?: number | string | null;
  payment_status?: string | null;
};

const resolveMediaUrl = (path?: string) => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const cleanedPath = path.replace(/^\/api(?=\/)/, '');
  return cleanedPath.startsWith('/') ? cleanedPath : `/${cleanedPath}`;
};

export default function Purchases() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const [tokenByPlanId, setTokenByPlanId] = useState<Record<string, string>>({});
  const [copiedPlanId, setCopiedPlanId] = useState<string | null>(null);

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

  const handleGenerate = async (planId: string) => {
    setBusyPlanId(planId);
    setCopiedPlanId(null);
    try {
      const resp = await generateDownloadLink(planId);
      const token = resp.data?.download_token;
      if (token) {
        setTokenByPlanId((prev: Record<string, string>) => ({ ...prev, [planId]: token }));
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to generate download link');
    } finally {
      setBusyPlanId(null);
    }
  };

  const buildDownloadUrl = (token: string) => {
    const safeBase = apiBase.startsWith('http') ? apiBase : `${window.location.origin}${apiBase.startsWith('/') ? '' : '/'}${apiBase}`;
    return `${safeBase}/customer/plans/download/${token}`;
  };

  const handleCopy = async (planId: string) => {
    const token = tokenByPlanId[planId];
    if (!token) return;

    const url = buildDownloadUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedPlanId(planId);
      setTimeout(() => setCopiedPlanId(null), 2000);
    } catch {
      setError('Failed to copy link. Please copy it manually.');
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
              const planId = p.plan_id;
              const token = tokenByPlanId[planId];
              const canDownload = p.payment_status === 'completed';
              const url = token ? buildDownloadUrl(token) : '';

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
                    </div>
                  </div>

                  <div className="border-t border-gray-100 p-4 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleGenerate(planId)}
                        disabled={!canDownload || busyPlanId === planId}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white disabled:opacity-50"
                      >
                        <Download className="w-4 h-4" />
                        {busyPlanId === planId ? 'Generating…' : 'Generate Download Link'}
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
                            onClick={() => handleCopy(planId)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
                          >
                            <Copy className="w-4 h-4" />
                            {copiedPlanId === planId ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">This link expires automatically. Generate a new one anytime.</p>
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
