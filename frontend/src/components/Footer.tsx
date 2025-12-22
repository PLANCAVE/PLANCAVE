import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-gradient-to-b from-white to-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <div className="text-sm font-semibold tracking-[0.25em] text-slate-900">RAMANICAVE</div>
            <p className="mt-3 text-sm text-slate-600 max-w-md">
              Affordable ready-made house plans and custom design support for customers worldwide.
            </p>
            <div className="mt-6 text-sm text-slate-600">
              © {new Date().getFullYear()} Ramanicave. All rights reserved.
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold tracking-wider text-slate-900 uppercase">Explore</div>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <Link className="text-slate-700 hover:text-teal-700" to="/plans">
                Browse Plans
              </Link>
              <Link className="text-slate-700 hover:text-teal-700" to="/custom-plan">
                Request a Custom Plan
              </Link>
              <Link className="text-slate-700 hover:text-teal-700" to="/help">
                Help
              </Link>
              <Link className="text-slate-700 hover:text-teal-700" to="/faqs">
                FAQs
              </Link>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold tracking-wider text-slate-900 uppercase">Legal</div>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <Link className="text-slate-700 hover:text-teal-700" to="/privacy">
                Privacy Policy
              </Link>
              <Link className="text-slate-700 hover:text-teal-700" to="/terms">
                Terms & Conditions
              </Link>
            </div>

            <div className="mt-6 rounded-xl border border-slate-200 bg-white/70 p-3">
              <div className="text-xs font-semibold text-slate-900">Support</div>
              <div className="mt-1 text-sm text-slate-600">admin@ramanicave.com</div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
