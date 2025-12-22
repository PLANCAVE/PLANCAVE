export default function Help() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-3xl font-bold text-slate-900">Help</h1>
      <p className="mt-2 text-slate-600">
        Need help with finding a plan, purchasing, or accessing your account? Start here.
      </p>

      <div className="mt-8 space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Finding the right plan</h2>
          <p className="mt-2 text-slate-700">
            Use Browse Plans to filter by bedrooms, floors, and whether BOQ is included. You can also ask Ramani AI
            for recommendations.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Purchases and access</h2>
          <p className="mt-2 text-slate-700">
            Purchased plans are available in your account under Purchases. For security, we do not provide direct
            downloads through chat assistants.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Refunds</h2>
          <p className="mt-2 text-slate-700">
            Digital goods policies vary by jurisdiction. If you believe you were charged incorrectly or have a major
            issue, contact support with your order details.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Contact</h2>
          <p className="mt-2 text-slate-700">
            Email: support@ramanicave.com
            <br />
            Include your plan link and a short description of the issue.
          </p>
        </section>
      </div>
    </div>
  );
}
