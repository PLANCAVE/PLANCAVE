export default function FAQs() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="inline-flex items-center gap-2 rounded-full border border-teal-200/60 bg-white/70 px-4 py-1 text-xs font-semibold text-teal-800 shadow-sm">
        FAQs
      </div>
      <h1 className="mt-4 text-3xl font-bold text-slate-900">Frequently Asked Questions</h1>
      <p className="mt-2 text-slate-600">
        Common questions about buying ready-made house plans, digital deliverables, and how access works after payment.
      </p>

      <div className="mt-8 space-y-6">
        <section className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-lg hover:shadow-teal-500/10">
          <h2 className="text-lg font-semibold text-slate-900">What do I receive after purchase?</h2>
          <p className="mt-2 text-slate-700">
            You receive the plan package(s) listed on the plan page. Depending on the plan, this may include
            architectural drawings and optional deliverables like BOQ, structural, or MEP documentation.
          </p>
        </section>

        <section className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-lg hover:shadow-cyan-500/10">
          <h2 className="text-lg font-semibold text-slate-900">How do I access my purchased plans?</h2>
          <p className="mt-2 text-slate-700">
            After successful payment, your purchases appear under your account in Purchases. If you paid but don’t see
            access yet, wait a few minutes and then refresh the page.
          </p>
        </section>

        <section className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-lg hover:shadow-amber-500/10">
          <h2 className="text-lg font-semibold text-slate-900">What payment methods do you support?</h2>
          <p className="mt-2 text-slate-700">
            Payment options depend on your region and the enabled payment provider(s). You’ll see the available options
            at checkout.
          </p>
        </section>

        <section className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-lg hover:shadow-rose-500/10">
          <h2 className="text-lg font-semibold text-slate-900">I was charged but I didn’t get access. What should I do?</h2>
          <p className="mt-2 text-slate-700">
            First, confirm you’re logged into the same email you used at checkout. Then check Purchases and refresh.
            If it still doesn’t show, contact support with your email and any payment reference.
          </p>
        </section>

        <section className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg">
          <h2 className="text-lg font-semibold text-slate-900">Do you ship physical copies?</h2>
          <p className="mt-2 text-slate-700">
            Ramanicave sells digital plan packages. Unless stated otherwise on a plan page, we do not ship printed
            documents.
          </p>
        </section>

        <section className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-lg hover:shadow-teal-500/10">
          <h2 className="text-lg font-semibold text-slate-900">Can I request custom changes?</h2>
          <p className="mt-2 text-slate-700">
            Yes. If you need modifications or a fully custom design, contact support and include the plan link and
            your requirements.
          </p>
        </section>

        <section className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-lg hover:shadow-cyan-500/10">
          <h2 className="text-lg font-semibold text-slate-900">Can I buy more than one plan?</h2>
          <p className="mt-2 text-slate-700">
            Yes. You can purchase multiple plan packages. Each plan you buy will appear under Purchases in your account.
          </p>
        </section>

        <section className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-lg hover:shadow-amber-500/10">
          <h2 className="text-lg font-semibold text-slate-900">What is a BOQ?</h2>
          <p className="mt-2 text-slate-700">
            A Bill of Quantities (BOQ) is a materials and cost breakdown used for estimating and procurement. BOQ
            availability depends on the plan.
          </p>
        </section>

        <section className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-lg hover:shadow-rose-500/10">
          <h2 className="text-lg font-semibold text-slate-900">Can I get a refund?</h2>
          <p className="mt-2 text-slate-700">
            Digital goods policies vary by jurisdiction and the nature of the deliverable. If you believe you were
            charged incorrectly or there is a major issue, contact support with your order details.
          </p>
        </section>

        <section className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-lg hover:shadow-teal-500/10">
          <h2 className="text-lg font-semibold text-slate-900">Are plans compliant with my local building code?</h2>
          <p className="mt-2 text-slate-700">
            Codes vary by country, region, and municipality. You should review any plan with a licensed professional
            in your location before construction.
          </p>
        </section>

        <section className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-lg hover:shadow-cyan-500/10">
          <h2 className="text-lg font-semibold text-slate-900">Can I share my plan files with others?</h2>
          <p className="mt-2 text-slate-700">
            Purchases generally grant a non-transferable license for personal/project use. Redistribution, resale, or
            sharing of plan files is not permitted unless explicitly stated.
          </p>
        </section>

        <section className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg">
          <h2 className="text-lg font-semibold text-slate-900">How can I contact support?</h2>
          <p className="mt-2 text-slate-700">
            Email: support@ramanicave.com
            <br />
            Include the plan link, your account email, and a short description of what you need.
          </p>
        </section>
      </div>
    </div>
  );
}
