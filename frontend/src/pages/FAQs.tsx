export default function FAQs() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-3xl font-bold text-slate-900">FAQs</h1>
      <p className="mt-2 text-slate-600">
        Common questions about buying ready-made house plans and digital deliverables.
      </p>

      <div className="mt-8 space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">What do I receive after purchase?</h2>
          <p className="mt-2 text-slate-700">
            You receive the plan package(s) listed on the plan page. Depending on the plan, this may include
            architectural drawings and optional deliverables like BOQ, structural, or MEP documentation.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Do you ship physical copies?</h2>
          <p className="mt-2 text-slate-700">
            Ramanicave sells digital plan packages. Unless stated otherwise on a plan page, we do not ship printed
            documents.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Can I request custom changes?</h2>
          <p className="mt-2 text-slate-700">
            Yes. If you need modifications or a fully custom design, contact support and include the plan link and
            your requirements.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">What is a BOQ?</h2>
          <p className="mt-2 text-slate-700">
            A Bill of Quantities (BOQ) is a materials and cost breakdown used for estimating and procurement. BOQ
            availability depends on the plan.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Are plans compliant with my local building code?</h2>
          <p className="mt-2 text-slate-700">
            Codes vary by country, region, and municipality. You should review any plan with a licensed professional
            in your location before construction.
          </p>
        </section>
      </div>
    </div>
  );
}
