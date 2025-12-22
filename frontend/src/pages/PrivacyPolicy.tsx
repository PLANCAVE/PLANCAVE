export default function PrivacyPolicy() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-3xl font-bold text-slate-900">Privacy Policy</h1>
      <p className="mt-2 text-slate-600">
        This Privacy Policy explains how Ramanicave collects, uses, and protects personal information globally.
      </p>

      <div className="mt-8 space-y-6 text-slate-700">
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Information we collect</h2>
          <p className="mt-2">
            We may collect account details (such as name, email), purchase and billing metadata, and usage data
            (such as pages viewed and device information). Payment processing is handled by payment providers; we do
            not store full card details.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">How we use information</h2>
          <p className="mt-2">
            We use information to provide and improve the service, process purchases, prevent fraud, comply with
            legal obligations, and communicate with you about your account.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Data sharing</h2>
          <p className="mt-2">
            We may share information with vendors that help run the platform (hosting, analytics, payment providers)
            and where required by law. We do not sell personal information.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Data retention</h2>
          <p className="mt-2">
            We retain data as long as needed to provide the service, comply with legal requirements, resolve
            disputes, and enforce agreements.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Your rights</h2>
          <p className="mt-2">
            Depending on your location, you may have rights to access, correct, delete, or restrict processing of
            your personal information. Contact support to request assistance.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Contact</h2>
          <p className="mt-2">
            Email: support@ramanicave.com
          </p>
        </section>
      </div>
    </div>
  );
}
