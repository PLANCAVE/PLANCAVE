import { useEffect, useMemo, useState } from 'react';
import { getAdminCustomPlanRequest, getAdminCustomPlanRequests } from '../../api';
import { Eye, FileText, Loader2, RefreshCw, X } from 'lucide-react';

type RequestRow = {
  id: string;
  user_id: number;
  user_email: string;
  full_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  country?: string | null;
  city?: string | null;
  bedrooms?: number | null;
  floors?: number | null;
  budget_min?: number | null;
  budget_max?: number | null;
  style?: string | null;
  land_size?: string | null;
  needs_boq?: boolean | null;
  needs_structural?: boolean | null;
  needs_mep?: boolean | null;
  description?: string | null;
  status?: string | null;
  created_at?: string | null;
};

const formatBool = (v: any) => (v ? 'Yes' : 'No');

export default function CustomPlanRequestsAdmin() {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<RequestRow | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await getAdminCustomPlanRequests();
      setRows(resp.data?.requests || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openDetails = async (id: string) => {
    setDetailsLoading(true);
    try {
      const resp = await getAdminCustomPlanRequest(id);
      setSelected(resp.data?.request || null);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to load request details');
    } finally {
      setDetailsLoading(false);
    }
  };

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  }, [rows]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <FileText className="w-8 h-8 text-teal-700" />
              Custom Plan Requests
            </h1>
            <p className="text-gray-600 mt-2">View all custom plan requests submitted by customers and designers.</p>
          </div>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {error ? (
          <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-800 text-sm">{error}</div>
        ) : null}

        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Submitted</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">User</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Bedrooms</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Floors</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">BOQ</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-700">{r.created_at ? new Date(r.created_at).toLocaleString() : '-'}</td>
                    <td className="py-3 px-4 text-sm text-gray-700">{r.user_email || `User ${r.user_id}`}</td>
                    <td className="py-3 px-4 text-sm text-gray-700">{r.bedrooms ?? '-'}</td>
                    <td className="py-3 px-4 text-sm text-gray-700">{r.floors ?? '-'}</td>
                    <td className="py-3 px-4 text-sm text-gray-700">{formatBool(r.needs_boq)}</td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => openDetails(r.id)}
                        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-50"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {rows.length === 0 ? (
              <div className="text-center py-12 text-gray-600">No custom plan requests yet.</div>
            ) : null}
          </div>
        </div>

        {selected ? (
          <div className="fixed inset-0 z-[80] bg-black/40 p-4 flex items-center justify-center">
            <div className="w-full max-w-3xl rounded-2xl bg-white border border-gray-200 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div className="font-semibold text-gray-900">Request details</div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="p-2 rounded-lg hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {detailsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading…
                  </div>
                ) : null}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-gray-200 p-4">
                    <div className="text-xs font-semibold text-gray-500">User</div>
                    <div className="mt-1 text-sm text-gray-900">{selected.user_email}</div>
                    <div className="mt-3 text-xs font-semibold text-gray-500">Contact</div>
                    <div className="mt-1 text-sm text-gray-900">
                      {selected.full_name || '-'}
                      <br />
                      {selected.contact_email || '-'}
                      <br />
                      {selected.contact_phone || '-'}
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-200 p-4">
                    <div className="text-xs font-semibold text-gray-500">Location</div>
                    <div className="mt-1 text-sm text-gray-900">
                      {selected.city || '-'}{selected.city && selected.country ? ', ' : ''}{selected.country || '-'}
                    </div>
                    <div className="mt-3 text-xs font-semibold text-gray-500">Budget</div>
                    <div className="mt-1 text-sm text-gray-900">
                      {selected.budget_min != null ? `$ ${Number(selected.budget_min).toLocaleString()}` : '-'}
                      {' — '}
                      {selected.budget_max != null ? `$ ${Number(selected.budget_max).toLocaleString()}` : '-'}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                    <div><span className="font-semibold">Bedrooms:</span> {selected.bedrooms ?? '-'}</div>
                    <div><span className="font-semibold">Floors:</span> {selected.floors ?? '-'}</div>
                    <div><span className="font-semibold">Style:</span> {selected.style ?? '-'}</div>
                    <div><span className="font-semibold">Land size:</span> {selected.land_size ?? '-'}</div>
                    <div><span className="font-semibold">BOQ:</span> {formatBool(selected.needs_boq)}</div>
                    <div><span className="font-semibold">Structural:</span> {formatBool(selected.needs_structural)}</div>
                    <div><span className="font-semibold">MEP:</span> {formatBool(selected.needs_mep)}</div>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 p-4">
                  <div className="text-xs font-semibold text-gray-500">Description</div>
                  <div className="mt-2 whitespace-pre-wrap text-sm text-gray-900">
                    {selected.description || '-'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
