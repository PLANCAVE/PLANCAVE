export default function Help() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/60 bg-white/70 px-4 py-1 text-xs font-semibold text-cyan-800 shadow-sm">
        Help Center
      </div>
      <h1 className="mt-4 text-3xl font-bold text-slate-900">Help</h1>
      <p className="mt-2 text-slate-600">
        Need help finding a plan, purchasing, or accessing your account? Here are the most common solutions.
      </p>

      <div className="mt-8 space-y-6">
        <section className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-lg hover:shadow-cyan-500/10">
          <h2 className="text-lg font-semibold text-slate-900">Finding the right plan</h2>
          <p className="mt-2 text-slate-700">
            Use Browse Plans to filter by bedrooms, floors, and whether BOQ is included. You can also ask Ramani AI
            for recommendations.
          </p>
        </section>

        <section className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-lg hover:shadow-teal-500/10">
          <h2 className="text-lg font-semibold text-slate-900">Purchases and access</h2>
          <p className="mt-2 text-slate-700">
            Purchased plans are available in your account under Purchases. For security, we do not provide direct
            downloads through chat assistants.
          </p>
        </section>

        <section className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-lg hover:shadow-amber-500/10">
          <h2 className="text-lg font-semibold text-slate-900">Payment issues</h2>
          <p className="mt-2 text-slate-700">
            If checkout fails or you get redirected unexpectedly, try again after refreshing the page. If you were
            charged but don’t see access yet, check Purchases and confirm you’re logged into the correct account.
          </p>
        </section>

        <section className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-lg hover:shadow-rose-500/10">
          <h2 className="text-lg font-semibold text-slate-900">Account and profile</h2>
          <p className="mt-2 text-slate-700">
            Keep your email updated and use a strong password. If you can’t sign in, use Forgot Password to reset.
            If you changed emails, contact support so we can help verify your identity.
          </p>
        </section>

        <section className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg">
          <h2 className="text-lg font-semibold text-slate-900">Custom plan requests</h2>
          <p className="mt-2 text-slate-700">
            For custom work, provide your preferred style, plot size, number of bedrooms, floors, and any special
            requirements (e.g., rooftop terrace, rental unit, accessibility).
          </p>
        </section>

        <section className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-lg hover:shadow-amber-500/10">
          <h2 className="text-lg font-semibold text-slate-900">Refunds</h2>
          <p className="mt-2 text-slate-700">
            Digital goods policies vary by jurisdiction. If you believe you were charged incorrectly or have a major
            issue, contact support with your order details.
          </p>
        </section>

        <section className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-lg hover:shadow-teal-500/10">
          <h2 className="text-lg font-semibold text-slate-900">Contact</h2>
          <p className="mt-2 text-slate-700">
            Email: support@ramanicave.com
            <br />
            Include your account email, plan link (if applicable), and a short description of the issue.
          </p>
        </section>
      </div>
    </div>
  );
}
