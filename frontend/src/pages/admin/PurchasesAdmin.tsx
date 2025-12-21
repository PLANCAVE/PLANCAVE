import { useEffect, useMemo, useState } from 'react';
import { getAdminPurchases, adminVerifyPaystackPayment, adminConfirmPaystackPayment } from '../../api';
import { Loader2, RefreshCw, Filter, DollarSign, Users, FileText, ShoppingCart, AlertTriangle, CheckCircle, Eye, X } from 'lucide-react';

interface PurchaseRow {
  id: string;
  order_id?: string | null;
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
  purchase_type?: 'full' | 'partial' | null;
  full_purchase?: boolean | null;
  payment_metadata?: any;
  admin_confirmed_at?: string | null;
  admin_confirmed_by?: number | null;
  download_tokens_generated?: number;
  download_tokens_used?: number;
  download_status?: 'not_generated' | 'pending_download' | 'downloaded' | null;
  last_downloaded_at?: string | null;
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

const formatMetadata = (raw: unknown): string | null => {
  if (!raw) return null;

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        return JSON.stringify(parsed, null, 2);
      }
    } catch {
      return trimmed;
    }
    return trimmed;
  }

  if (typeof raw === 'object') {
    try {
      return JSON.stringify(raw, null, 2);
    } catch {
      return String(raw);
    }
  }

  return String(raw);
};

const extractPaystackRefs = (raw: unknown): { refs: string[]; last: string | null } => {
  let meta: any = raw;
  if (!meta) return { refs: [], last: null };
  if (typeof meta === 'string') {
    try {
      meta = JSON.parse(meta);
    } catch {
      meta = null;
    }
  }
  if (!meta || typeof meta !== 'object') return { refs: [], last: null };

  const refsRaw = (meta as any).paystack_references;
  const lastRaw = (meta as any).paystack_last_reference;
  const refs = Array.isArray(refsRaw)
    ? refsRaw.map((x: any) => String(x)).filter(Boolean)
    : [];
  const last = lastRaw ? String(lastRaw) : null;

  const uniq = Array.from(new Set(refs));
  return { refs: uniq, last };
};

const getPreferredReference = (purchase: PurchaseRow): string | null => {
  const refs = extractPaystackRefs(purchase.payment_metadata);
  return refs.last || purchase.transaction_id || (refs.refs[0] ?? null);
};

export default function PurchasesAdmin() {
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [metadata, setMetadata] = useState<PurchasesResponse['metadata'] | null>(null);
  const [verifyingPayment, setVerifyingPayment] = useState<string | null>(null);
  const [confirmingPayment, setConfirmingPayment] = useState<string | null>(null);
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseRow | null>(null);
  const [selectedPaystackReference, setSelectedPaystackReference] = useState<string | null>(null);

  const totalRevenue = useMemo(() => {
    return purchases.reduce((sum, row) => {
      if (row.payment_status === 'completed') {
        return sum + (Number(row.amount) || 0);
      }
      return sum;
    }, 0);
  }, [purchases]);

  useEffect(() => {
    loadPurchases({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, methodFilter]);

  useEffect(() => {
    if (!selectedPurchase) return;

    const refs = extractPaystackRefs(selectedPurchase.payment_metadata);
    setSelectedPaystackReference(refs.last || selectedPurchase.transaction_id || null);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedPurchase(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedPurchase]);

  const loadPurchases = async ({ reset }: { reset?: boolean } = {}) => {
    if (reset) {
      setLoading(true);
      setError(null);
      setSuccess(null);
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
      const normalized = (payload.purchases || []).map((row: any) => {
        const amount = Number(row.amount ?? 0);
        const downloadTokensGenerated = Number(row.download_tokens_generated ?? 0);
        const downloadTokensUsed = Number(row.download_tokens_used ?? 0);
        const downloadStatus = (row.download_status ?? null) as PurchaseRow['download_status'];
        const lastDownloadedAt = row.last_downloaded_at ?? null;

        return {
          ...row,
          amount,
          selected_deliverables: normalizeDeliverables(row.selected_deliverables),
          download_tokens_generated: downloadTokensGenerated,
          download_tokens_used: downloadTokensUsed,
          download_status: downloadStatus,
          last_downloaded_at: lastDownloadedAt,
        } as PurchaseRow;
      });
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
      const resp = await adminVerifyPaystackPayment(reference);
      if (resp?.status !== 200) {
        setError(resp?.data?.message || 'Payment not completed yet.');
        setSuccess(null);
        return;
      }
      // Refresh purchases list to show updated status
      await loadPurchases({ reset: true });
      setError(null);
      setSuccess(resp?.data?.message || 'Payment verification completed.');
      // If modal is open, refresh its purchase data by re-selecting to trigger a prop update
      if (selectedPurchase) {
        const updated = purchases.find(p => p.id === selectedPurchase.id);
        if (updated) setSelectedPurchase(updated);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to complete payment verification';
      setError(msg);
      setSuccess(null);
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
      const resp = await adminConfirmPaystackPayment(reference);
      if (resp?.status !== 200) {
        setError(resp?.data?.message || 'Payment not completed yet.');
        setSuccess(null);
        return;
      }
      // Refresh purchases list to show admin confirmed status
      await loadPurchases({ reset: true });
      setError(null);
      setSuccess(resp?.data?.message || 'Payment marked as admin confirmed.');
      // If modal is open, refresh its purchase data by re-selecting to trigger a prop update
      if (selectedPurchase) {
        const updated = purchases.find(p => p.id === selectedPurchase.id);
        if (updated) setSelectedPurchase(updated);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to confirm payment';
      setError(msg);
      setSuccess(null);
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

        {success ? (
          <div className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-100">
            {success}
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
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Deliverables</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Purchased</th>
                  <th className="px-4 py-3">Download Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {purchases.map((purchase) => (
                  <tr
                    key={purchase.id}
                    onClick={() => setSelectedPurchase(purchase)}
                    className="border-b border-white/10 last:border-b-0 cursor-pointer transition-colors hover:bg-white/10"
                  >
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-white">{purchase.user_email}</span>
                        <span className="text-xs text-white/60">User #{purchase.user_id}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-white">{purchase.plan_name}</span>
                        <span className="text-xs text-white/60">{purchase.plan_id}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border ${
                        purchase.purchase_type === 'full'
                          ? 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30'
                          : purchase.purchase_type === 'partial'
                            ? 'bg-amber-500/15 text-amber-100 border-amber-400/30'
                            : 'bg-white/10 text-white/70 border-white/15'
                      }`}>
                        {purchase.purchase_type === 'full'
                          ? 'Full'
                          : purchase.purchase_type === 'partial'
                            ? 'Partial'
                            : '—'}
                      </span>
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
                        <span className="text-white/70 text-xs">
                          {purchase.purchase_type === 'full' || purchase.full_purchase ? 'Full plan' : '—'}
                        </span>
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
                      <div className="flex flex-col">
                        <span className="text-white/80">{purchase.order_id || '—'}</span>
                        <span className="text-white/40">{purchase.transaction_id || '—'}</span>
                        {(() => {
                          const { refs, last } = extractPaystackRefs(purchase.payment_metadata);
                          const toShow = refs.length ? refs : (last ? [last] : []);
                          if (!toShow.length) return null;
                          return (
                            <span className="text-white/30 mt-1">
                              refs: {toShow.slice(0, 2).join(', ')}{toShow.length > 2 ? '…' : ''}
                            </span>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-white/70">
                      {purchase.purchased_at ? new Date(purchase.purchased_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {purchase.download_status ? (
                        <div className="flex flex-col gap-1">
                          <span
                            className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ${
                              purchase.download_status === 'downloaded'
                                ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30'
                                : purchase.download_status === 'pending_download'
                                  ? 'bg-amber-500/20 text-amber-100 border border-amber-400/30'
                                  : 'bg-white/10 text-white/70 border border-white/15'
                            }`}
                          >
                            {purchase.download_status === 'downloaded'
                              ? 'Downloaded'
                              : purchase.download_status === 'pending_download'
                                ? 'Download pending'
                                : 'Not generated'}
                          </span>
                          <div className="text-[11px] text-white/60">
                            <span>{purchase.download_tokens_used ?? 0} used</span>
                            <span className="mx-1">/</span>
                            <span>{purchase.download_tokens_generated ?? 0} generated</span>
                          </div>
                          {purchase.last_downloaded_at ? (
                            <div className="text-[11px] text-white/60">
                              Last: {new Date(purchase.last_downloaded_at).toLocaleString()}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-white/40 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-2">
                        {purchase.payment_status === 'pending' && getPreferredReference(purchase) ? (
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              const ref = getPreferredReference(purchase);
                              if (ref) handleCompletePayment(ref);
                            }}
                            disabled={verifyingPayment === getPreferredReference(purchase)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 disabled:opacity-50 text-white text-xs font-medium transition-colors"
                          >
                            {verifyingPayment === getPreferredReference(purchase) ? (
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
                        ) : purchase.payment_status === 'completed' && getPreferredReference(purchase) && !purchase.admin_confirmed_at ? (
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              const ref = getPreferredReference(purchase);
                              if (ref) handleConfirmPayment(ref);
                            }}
                            disabled={confirmingPayment === getPreferredReference(purchase)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 text-white text-xs font-medium transition-colors"
                          >
                            {confirmingPayment === getPreferredReference(purchase) ? (
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
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedPurchase(purchase);
                          }}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/15 bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors"
                        >
                          <Eye className="w-3 h-3" />
                          View details
                        </button>
                      </div>
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

      {selectedPurchase ? (
        <PurchaseDetailModal
          purchase={selectedPurchase}
          selectedReference={selectedPaystackReference}
          onSelectReference={setSelectedPaystackReference}
          onVerifyReference={(ref) => handleCompletePayment(ref)}
          onConfirmReference={(ref) => handleConfirmPayment(ref)}
          verifyingReference={verifyingPayment}
          confirmingReference={confirmingPayment}
          errorMessage={error}
          successMessage={success}
          onClose={() => setSelectedPurchase(null)}
        />
      ) : null}
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

function PurchaseDetailModal({
  purchase,
  selectedReference,
  onSelectReference,
  onVerifyReference,
  onConfirmReference,
  verifyingReference,
  confirmingReference,
  errorMessage,
  successMessage,
  onClose,
}: {
  purchase: PurchaseRow;
  selectedReference: string | null;
  onSelectReference: (ref: string | null) => void;
  onVerifyReference: (ref: string) => void;
  onConfirmReference: (ref: string) => void;
  verifyingReference: string | null;
  confirmingReference: string | null;
  errorMessage: string | null;
  successMessage: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const formatDate = (value?: string | null) => {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  };

  const metadataDisplay = formatMetadata(purchase.payment_metadata);
  const paystackRefs = extractPaystackRefs(purchase.payment_metadata);
  const deliverables = purchase.selected_deliverables || [];
  const availableRefs = (() => {
    const base = [paystackRefs.last, ...paystackRefs.refs, purchase.transaction_id]
      .filter(Boolean)
      .map((x) => String(x));
    return Array.from(new Set(base));
  })();

  const activeRef = selectedReference || getPreferredReference(purchase);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      onClick={handleOverlayClick}
    >
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
      <div className="relative w-full max-w-3xl mx-4 bg-slate-950 border border-white/10 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-white/10 p-6 text-white">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-white/60">Purchase Details</p>
            <h2 className="mt-2 text-2xl font-semibold text-white flex flex-wrap items-center gap-3">
              {purchase.plan_name}
              <span className="text-sm text-white/50 font-normal">#{purchase.plan_id}</span>
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white p-2 transition-colors"
            aria-label="Close purchase details"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-6 space-y-6 text-white/90 text-sm overflow-y-auto">
          {errorMessage ? (
            <div className="p-4 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-200">
              {errorMessage}
            </div>
          ) : null}

          {successMessage ? (
            <div className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-100">
              {successMessage}
            </div>
          ) : null}

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-white/60">Buyer</p>
              <p className="text-base font-semibold text-white">{purchase.user_email}</p>
              <p className="text-xs text-white/60">User ID: {purchase.user_id}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-white/60">Payment</p>
              <p className="text-base font-semibold text-emerald-300">KSH {Number(purchase.amount || 0).toLocaleString()}</p>
              <div className="flex items-center gap-2 text-xs text-white/70">
                <StatusDot status={purchase.payment_status ?? null} />
                <span>{purchase.payment_status ?? 'unknown'}</span>
              </div>
              <p className="text-xs text-white/60">Method: {purchase.payment_method ?? '—'}</p>
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-white/60">Timeline</p>
              <p className="text-xs text-white/60">Purchased: {formatDate(purchase.purchased_at)}</p>
              <p className="text-xs text-white/60">Admin Confirmed: {formatDate(purchase.admin_confirmed_at)}</p>
              <p className="text-xs text-white/60">Last Download: {formatDate(purchase.last_downloaded_at)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-white/60">Transaction</p>
              <p className="text-xs text-white/60">Order ID: {purchase.order_id ?? '—'}</p>
              <p className="text-xs text-white/60">Reference: {purchase.transaction_id ?? '—'}</p>
              {paystackRefs.last ? (
                <p className="text-xs text-white/60">Last Paystack Ref: {paystackRefs.last}</p>
              ) : null}
              {availableRefs.length ? (
                <div className="text-xs text-white/60">
                  <div>Paystack References (click to select):</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {availableRefs.map((ref) => {
                      const isActive = Boolean(activeRef && ref === activeRef);
                      return (
                        <button
                          key={ref}
                          type="button"
                          onClick={() => onSelectReference(ref)}
                          className={
                            'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] transition-colors ' +
                            (isActive
                              ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100'
                              : 'border-white/10 bg-white/10 text-white/70 hover:bg-white/15')
                          }
                        >
                          {ref}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!activeRef || verifyingReference === activeRef}
                      onClick={() => {
                        if (activeRef) onVerifyReference(activeRef);
                      }}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 disabled:opacity-50 text-white text-xs font-medium transition-colors"
                    >
                      {verifyingReference === activeRef ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Verifying...
                        </>
                      ) : purchase.payment_status === 'completed' ? (
                        <>
                          <CheckCircle className="w-3 h-3" />
                          Verified
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-3 h-3" />
                          Verify Selected Ref
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={!activeRef || confirmingReference === activeRef || Boolean(purchase.admin_confirmed_at)}
                      onClick={() => {
                        if (activeRef) onConfirmReference(activeRef);
                      }}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 text-white text-xs font-medium transition-colors"
                    >
                      {confirmingReference === activeRef ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Confirming...
                        </>
                      ) : purchase.admin_confirmed_at ? (
                        <>
                          <CheckCircle className="w-3 h-3" />
                          Admin Completed
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-3 h-3" />
                          Mark Admin Confirmed
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : null}
              <p className="text-xs text-white/60">Tokens Generated: {purchase.download_tokens_generated ?? 0}</p>
              <p className="text-xs text-white/60">Tokens Used: {purchase.download_tokens_used ?? 0}</p>
              <p className="text-xs text-white/60">Download Status: {purchase.download_status ?? 'unknown'}</p>
              <p className="text-xs text-white/60">
                Purchase Type: {purchase.purchase_type ? purchase.purchase_type.toUpperCase() : (purchase.full_purchase ? 'FULL' : '—')}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-white/60">Selected Deliverables</p>
            {deliverables.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {deliverables.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-xs font-medium text-white"
                  >
                    {formatDeliverableLabel(item)}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-white/50">
                {purchase.purchase_type === 'full' || purchase.full_purchase ? 'Full plan purchase (all deliverables).' : 'No deliverables were selected.'}
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-white/60">Payment Metadata</p>
            {metadataDisplay ? (
              <pre className="mt-3 max-h-64 overflow-auto rounded-xl bg-black/40 p-4 text-xs leading-relaxed text-emerald-100">
                {metadataDisplay}
              </pre>
            ) : (
              <p className="mt-2 text-xs text-white/50">No payment metadata recorded.</p>
            )}
          </section>
        </div>

        <footer className="border-t border-white/10 p-4 flex justify-end bg-slate-950/95">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition-colors"
          >
            <X className="w-4 h-4" />
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
