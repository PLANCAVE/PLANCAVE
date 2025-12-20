import { useEffect, useMemo, useState } from 'react';
import { getAdminPurchases, adminVerifyPaystackPayment, adminConfirmPaystackPayment } from '../../api';
import { Loader2, RefreshCw, Filter, DollarSign, Users, FileText, ShoppingCart, AlertTriangle, CheckCircle } from 'lucide-react';

interface PurchaseRow {
  id: string;
  user_id: number;
  user_email: string;
  plan_id: string;
  plan_name: string;
  amount: number;
  payment_method: string | null;
  payment_status: string | null;
  transaction_id: string | null;
  purchased_at: string | null;
  selected_deliverables?: string[] | null;
  payment_metadata?: any;
  admin_confirmed_at?: string | null;
  admin_confirmed_by?: number | null;
}

interface PurchasesResponse {
  metadata: {
    total: number;
    limit: number;
    offset: number;
    returned: number;
  };
  purchases: PurchaseRow[];
}

const STATUS_OPTIONS = ['all', 'completed', 'pending', 'failed'];
const METHOD_OPTIONS = ['all', 'paystack'];

const normalizeDeliverables = (raw: unknown): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((value) => String(value));
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((value) => String(value));
      }
      if (parsed && typeof parsed === 'object') {
        return Object.entries(parsed)
          .filter(([, enabled]) => Boolean(enabled))
          .map(([key]) => String(key));
      }
    } catch {
      return raw.split(',').map((piece) => piece.trim()).filter(Boolean);
    }
  }
  if (typeof raw === 'object') {
    return Object.entries(raw as Record<string, any>)
      .filter(([, enabled]) => Boolean(enabled))
      .map(([key]) => String(key));
  }
  return [];
};

const formatDeliverableLabel = (value: string) =>
  value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

export default function PurchasesAdmin() {
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [metadata, setMetadata] = useState<PurchasesResponse['metadata'] | null>(null);
  const [verifyingPayment, setVerifyingPayment] = useState<string | null>(null);
  const [confirmingPayment, setConfirmingPayment] = useState<string | null>(null);

  const totalRevenue = useMemo(() => {
    return purchases.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  }, [purchases]);

  useEffect(() => {
    loadPurchases({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, methodFilter]);

  const loadPurchases = async ({ reset }: { reset?: boolean } = {}) => {
    if (reset) {
      setLoading(true);
      setError(null);
    } else {
      setFetchingMore(true);
    }

    try {
      const params: Record<string, any> = {
        limit: 50,
        offset: reset ? 0 : purchases.length,
      };
      if (statusFilter !== 'all') params.payment_status = statusFilter;
      if (methodFilter !== 'all') params.payment_method = methodFilter;

      const resp = await getAdminPurchases(params);
      const payload: PurchasesResponse = resp.data;
      const normalized = (payload.purchases || []).map((row: any) => ({
        ...row,
        selected_deliverables: normalizeDeliverables(row.selected_deliverables),
      })) as PurchaseRow[];
      setMetadata(payload.metadata);
      setPurchases((prev) => (reset ? normalized : [...prev, ...normalized]));
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load purchases');
    } finally {
      setLoading(false);
      setFetchingMore(false);
    }
  };

  const hasMore = metadata ? metadata.offset + metadata.returned < metadata.total : false;

  const handleCompletePayment = async (reference: string) => {
    if (!reference) {
      setError('No transaction reference available for this purchase');
      return;
    }
    setVerifyingPayment(reference);
    try {
      await adminVerifyPaystackPayment(reference);
      // Refresh purchases list to show updated status
      await loadPurchases({ reset: true });
      setError(null);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to complete payment verification';
      setError(msg);
    } finally {
      setVerifyingPayment(null);
    }
  };

  const handleConfirmPayment = async (reference: string) => {
    if (!reference) {
      setError('No transaction reference available for this purchase');
      return;
    }
    setConfirmingPayment(reference);
    try {
      await adminConfirmPaystackPayment(reference);
      // Refresh purchases list to show admin confirmed status
      await loadPurchases({ reset: true });
      setError(null);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to confirm payment';
      setError(msg);
    } finally {
      setConfirmingPayment(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950">
        <Loader2 className="w-12 h-12 animate-spin text-teal-300" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-10 space-y-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-teal-300">Admin</p>
            <h1 className="mt-2 text-3xl font-bold text-white flex items-center gap-3">
              <FileText className="w-8 h-8 text-teal-400" />
              Purchases Overview
            </h1>
            <p className="text-sm text-slate-300 mt-1">
              Monitor every purchase, payment status, and outstanding downloads across the platform.
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadPurchases({ reset: true })}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </header>

        {error ? (
          <div className="p-4 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-200">
            {error}
          </div>
        ) : null}

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/60">Total purchases</p>
                <p className="text-3xl font-bold mt-2">{metadata?.total ?? purchases.length}</p>
              </div>
              <ShoppingCart className="w-10 h-10 text-white/70" />
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/70">Gross revenue</p>
                <p className="text-3xl font-bold mt-2">KSH {totalRevenue.toLocaleString()}</p>
              </div>
              <DollarSign className="w-10 h-10 text-emerald-300" />
            </div>
          </div>
          <div className="rounded-2xl border border-sky-400/30 bg-sky-500/10 p-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/70">Unique buyers</p>
                <p className="text-3xl font-bold mt-2">{new Set(purchases.map((p) => p.user_id)).size}</p>
              </div>
              <Users className="w-10 h-10 text-sky-300" />
            </div>
          </div>
          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/70">Pending payments</p>
                <p className="text-3xl font-bold mt-2">
                  {purchases.filter((p) => p.payment_status !== 'completed').length}
                </p>
              </div>
              <AlertTriangle className="w-10 h-10 text-amber-300" />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3 text-white/80">
              <Filter className="w-5 h-5" />
              <span className="text-sm uppercase tracking-[0.3em]">Filters</span>
            </div>
            <div className="flex flex-wrap gap-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm backdrop-blur-md"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option === 'all' ? 'All statuses' : option}
                  </option>
                ))}
              </select>
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm backdrop-blur-md"
              >
                {METHOD_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option === 'all' ? 'All methods' : option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/5">
            <table className="min-w-full divide-y divide-white/10 text-left text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-[0.25em] text-white/70">
                <tr>
                  <th className="px-4 py-3">Buyer</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Deliverables</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Purchased</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {purchases.map((purchase) => (
                  <tr key={purchase.id} className="hover:bg-white/10">
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-semibold text-white">{purchase.user_email}</span>
                        <span className="text-xs text-white/60">#{purchase.user_id}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-white">{purchase.plan_name}</span>
                        <span className="text-xs text-white/60">{purchase.plan_id}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {purchase.selected_deliverables && purchase.selected_deliverables.length ? (
                        <div className="flex flex-wrap gap-2">
                          {purchase.selected_deliverables.map((item) => (
                            <span
                              key={item}
                              className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white/80 border border-white/15"
                            >
                              {formatDeliverableLabel(item)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-white/40">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-emerald-300">
                      KSH {Number(purchase.amount || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 capitalize text-white/80">
                      {purchase.payment_method || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ${
                          purchase.payment_status === 'completed'
                            ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30'
                            : 'bg-amber-500/20 text-amber-100 border border-amber-400/30'
                        }`}
                      >
                        <StatusDot status={purchase.payment_status} />
                        {purchase.payment_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-white/70">
                      {purchase.transaction_id || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-white/70">
                      {purchase.purchased_at ? new Date(purchase.purchased_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {purchase.payment_status === 'pending' && purchase.transaction_id ? (
                        <button
                          onClick={() => handleCompletePayment(purchase.transaction_id!)}
                          disabled={verifyingPayment === purchase.transaction_id}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 disabled:opacity-50 text-white text-xs font-medium transition-colors"
                        >
                          {verifyingPayment === purchase.transaction_id ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Verifying...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-3 h-3" />
                              Complete Payment
                            </>
                          )}
                        </button>
                      ) : purchase.payment_status === 'completed' && purchase.transaction_id && !purchase.admin_confirmed_at ? (
                        <button
                          onClick={() => handleConfirmPayment(purchase.transaction_id!)}
                          disabled={confirmingPayment === purchase.transaction_id}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 text-white text-xs font-medium transition-colors"
                        >
                          {confirmingPayment === purchase.transaction_id ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Confirming...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-3 h-3" />
                              Confirm Payment
                            </>
                          )}
                        </button>
                      ) : purchase.admin_confirmed_at ? (
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-100 text-green-800 text-xs font-medium">
                          <CheckCircle className="w-3 h-3" />
                          Confirmed
                        </span>
                      ) : (
                        <span className="text-white/40 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hasMore ? (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => loadPurchases({ reset: false })}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10"
                disabled={fetchingMore}
              >
                {fetchingMore ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading more
                  </>
                ) : (
                  'Load more'
                )}
              </button>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string | null }) {
  if (!status) return null;
  
  const colors = {
    completed: 'bg-green-500',
    pending: 'bg-amber-500',
    failed: 'bg-red-500',
    refunded: 'bg-gray-500',
  };
  const color = colors[status as keyof typeof colors] || 'bg-gray-400';
  return <div className={`w-2 h-2 rounded-full ${color}`} />;
}
