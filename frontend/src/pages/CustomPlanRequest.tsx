import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { submitCustomPlanRequest } from '../api';
import { ArrowRight, CheckCircle2, FileText, Loader2 } from 'lucide-react';

export default function CustomPlanRequest() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');

  const [budgetMin, setBudgetMin] = useState<string>('');
  const [budgetMax, setBudgetMax] = useState<string>('');
  const [bedrooms, setBedrooms] = useState<string>('');
  const [floors, setFloors] = useState<string>('');

  const [style, setStyle] = useState('Modern');
  const [landSize, setLandSize] = useState('');

  const [needsBoq, setNeedsBoq] = useState(true);
  const [needsStructural, setNeedsStructural] = useState(false);
  const [needsMep, setNeedsMep] = useState(false);

  const [description, setDescription] = useState('');

  const canSubmit = useMemo(() => {
    return Boolean(description.trim()) && Boolean(fullName.trim() || email.trim());
  }, [description, fullName, email]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 bg-gradient-to-b from-slate-50 via-white to-teal-50/30 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-teal-400/20 blur-3xl" />
          <div className="absolute -bottom-28 -left-28 h-96 w-96 rounded-full bg-cyan-400/20 blur-3xl" />
        </div>

        <div className="max-w-lg w-full rounded-2xl border border-slate-200/70 bg-white/80 backdrop-blur p-6 shadow-sm relative">
          <h1 className="text-2xl font-semibold text-slate-900">Request a Custom Plan</h1>
          <p className="mt-2 text-slate-600">
            Please sign in first so we can save your request and update you.
          </p>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 px-4 py-3 text-white font-semibold hover:from-teal-700 hover:to-cyan-700 w-full"
          >
            Sign in
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || loading) return;

    setError(null);
    setLoading(true);

    try {
      await submitCustomPlanRequest({
        full_name: fullName || null,
        contact_email: email || null,
        contact_phone: phone || null,
        country: country || null,
        city: city || null,
        budget_min: budgetMin ? Number(budgetMin) : null,
        budget_max: budgetMax ? Number(budgetMax) : null,
        bedrooms: bedrooms ? Number(bedrooms) : null,
        floors: floors ? Number(floors) : null,
        style: style || null,
        land_size: landSize || null,
        needs_boq: Boolean(needsBoq),
        needs_structural: Boolean(needsStructural),
        needs_mep: Boolean(needsMep),
        description: description,
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-b from-slate-50 via-white to-teal-50/30 py-10 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="absolute -bottom-28 -left-28 h-96 w-96 rounded-full bg-cyan-400/20 blur-3xl" />
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-200/60 bg-white/70 px-4 py-2 text-xs font-semibold text-teal-800 shadow-sm">
            <FileText className="w-4 h-4" />
            Custom Plan Request
          </div>
          <h1 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
            Tell us what you want to build
          </h1>
          <p className="mt-2 text-slate-600 max-w-2xl">
            Share your requirements and our team will review and respond. This is a global service—local building codes vary,
            so we may ask for location details to guide the design.
          </p>
        </div>

        {success ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-700" />
              <div>
                <h2 className="text-lg font-semibold text-emerald-900">Request submitted</h2>
                <p className="mt-1 text-emerald-800 text-sm">
                  We received your custom plan request. Our team will review it and contact you.
                </p>
                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => navigate('/plans')}
                    className="rounded-xl bg-white border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100"
                  >
                    Browse plans
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSuccess(false);
                      setDescription('');
                    }}
                    className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                  >
                    Submit another request
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-2xl border border-slate-200/70 bg-white/80 backdrop-blur shadow-sm">
              <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-t-2xl">
                <h2 className="text-lg font-semibold text-slate-900">Project details</h2>
                <p className="mt-1 text-sm text-white/80">The more detail you provide, the better our proposal.</p>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <label className="text-sm font-semibold text-slate-800">Description *</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={6}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-300"
                    placeholder="Example: Modern 3-bedroom, single storey, open-plan kitchen, master ensuite, budget under $500, must include BOQ..."
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-800">Bedrooms</label>
                    <input
                      value={bedrooms}
                      onChange={(e) => setBedrooms(e.target.value)}
                      inputMode="numeric"
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-300"
                      placeholder="e.g. 3"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-800">Floors</label>
                    <input
                      value={floors}
                      onChange={(e) => setFloors(e.target.value)}
                      inputMode="numeric"
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-300"
                      placeholder="e.g. 1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-800">Budget min</label>
                    <input
                      value={budgetMin}
                      onChange={(e) => setBudgetMin(e.target.value)}
                      inputMode="decimal"
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-300"
                      placeholder="e.g. 300"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-800">Budget max</label>
                    <input
                      value={budgetMax}
                      onChange={(e) => setBudgetMax(e.target.value)}
                      inputMode="decimal"
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-300"
                      placeholder="e.g. 500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-800">Style</label>
                    <select
                      value={style}
                      onChange={(e) => setStyle(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-300"
                    >
                      <option>Modern</option>
                      <option>Minimal</option>
                      <option>Classic</option>
                      <option>Contemporary</option>
                      <option>Tropical</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-800">Land size (optional)</label>
                    <input
                      value={landSize}
                      onChange={(e) => setLandSize(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-300"
                      placeholder="e.g. 50ft x 100ft"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-teal-50/40 p-4">
                  <div className="text-sm font-semibold text-slate-800">Deliverables</div>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={needsBoq} onChange={(e) => setNeedsBoq(e.target.checked)} />
                      BOQ
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={needsStructural} onChange={(e) => setNeedsStructural(e.target.checked)} />
                      Structural
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={needsMep} onChange={(e) => setNeedsMep(e.target.checked)} />
                      MEP
                    </label>
                  </div>
                </div>

                {error ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                    {error}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/70 bg-white/80 backdrop-blur shadow-sm h-fit">
              <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-t-2xl">
                <h2 className="text-lg font-semibold text-slate-900">Contact</h2>
                <p className="mt-1 text-sm text-white/80">So we can reach you about pricing and timelines.</p>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-sm font-semibold text-slate-800">Full name</label>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-300"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-800">Email</label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-300"
                    placeholder="you@email.com"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-800">Phone / WhatsApp (optional)</label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-300"
                    placeholder="+1 555 000 000"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-semibold text-slate-800">Country</label>
                    <input
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-300"
                      placeholder="Country"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-800">City</label>
                    <input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-300"
                      placeholder="City"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!canSubmit || loading}
                  className={`mt-2 w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-white font-semibold shadow-sm transition-all ${
                    !canSubmit || loading
                      ? 'bg-slate-300 cursor-not-allowed'
                      : 'bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700'
                  }`}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Submit request
                </button>

                <p className="text-xs text-slate-500">
                  By submitting, you agree to our Terms and acknowledge our Privacy Policy.
                </p>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
