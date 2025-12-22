export default function PrivacyPolicy() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="inline-flex items-center gap-2 rounded-full border border-teal-200/60 bg-white/70 px-4 py-1 text-xs font-semibold text-teal-800 shadow-sm">
        Legal
      </div>
      <h1 className="mt-4 text-3xl font-bold text-slate-900">Privacy Policy</h1>
      <p className="mt-2 text-slate-600">
        This Privacy Policy explains how Ramanicave collects, uses, and protects personal information globally.
      </p>

      <div className="mt-8 space-y-6 text-slate-700">
        <section className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-lg hover:shadow-teal-500/10">
          <h2 className="text-lg font-semibold text-slate-900">Information we collect</h2>
          <p className="mt-2">
            We may collect account details (such as name, email), purchase and billing metadata, and usage data
            (such as pages viewed and device information). Payment processing is handled by payment providers; we do
            not store full card details.
          </p>
        </section>

        <section className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-lg hover:shadow-cyan-500/10">
          <h2 className="text-lg font-semibold text-slate-900">How we use information</h2>
          <p className="mt-2">
            We use information to provide and improve the service, process purchases, prevent fraud, comply with
            legal obligations, and communicate with you about your account.
          </p>
        </section>

        <section className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-lg hover:shadow-amber-500/10">
          <h2 className="text-lg font-semibold text-slate-900">Cookies and analytics</h2>
          <p className="mt-2">
            We may use cookies or similar technologies to keep you signed in, remember preferences, and understand how
            the website is used. You can control cookies through your browser settings.
          </p>
        </section>

        <section className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-lg hover:shadow-rose-500/10">
          <h2 className="text-lg font-semibold text-slate-900">Data sharing</h2>
          <p className="mt-2">
            We may share information with vendors that help run the platform (hosting, analytics, payment providers)
            and where required by law. We do not sell personal information.
          </p>
        </section>

        <section className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg">
          <h2 className="text-lg font-semibold text-slate-900">Data retention</h2>
          <p className="mt-2">
            We retain data as long as needed to provide the service, comply with legal requirements, resolve
            disputes, and enforce agreements.
          </p>
        </section>

        <section className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-lg hover:shadow-teal-500/10">
          <h2 className="text-lg font-semibold text-slate-900">Security</h2>
          <p className="mt-2">
            We use reasonable safeguards to protect your information. No method of transmission or storage is 100%
            secure, so we cannot guarantee absolute security.
          </p>
        </section>

        <section className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-lg hover:shadow-cyan-500/10">
          <h2 className="text-lg font-semibold text-slate-900">Your rights</h2>
          <p className="mt-2">
            Depending on your location, you may have rights to access, correct, delete, or restrict processing of
            your personal information. Contact support to request assistance.
          </p>
        </section>

        <section className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-lg hover:shadow-amber-500/10">
          <h2 className="text-lg font-semibold text-slate-900">International users</h2>
          <p className="mt-2">
            Ramanicave may process and store information in countries other than where you live. We take steps to
            protect your data in accordance with this Policy.
          </p>
        </section>

        <section className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg">
          <h2 className="text-lg font-semibold text-slate-900">Contact</h2>
          <p className="mt-2">
            Email: support@ramanicave.com
          </p>
        </section>
      </div>
    </div>
  );
}
