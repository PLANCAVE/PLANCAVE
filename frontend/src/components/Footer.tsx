import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Footer() {
  const { isAuthenticated } = useAuth();

  return (
    <footer className="border-t border-teal-900/20 bg-gradient-to-b from-slate-950 via-[#0b1f22] to-[#050f11] text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <div className="text-sm font-semibold tracking-[0.25em] text-white">RAMANICAVE</div>
            <p className="mt-3 text-sm text-slate-300 max-w-md">
              Affordable ready-made house plans and custom design support for customers worldwide.
            </p>
            <div className="mt-6 text-sm text-slate-400">
              © {new Date().getFullYear()} Ramanicave. All rights reserved.
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold tracking-wider text-white/90 uppercase">Explore</div>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <Link className="text-slate-300 hover:text-teal-200 hover:-translate-y-0.5 transition-all duration-200" to="/plans">
                Browse Plans
              </Link>
              {isAuthenticated ? (
                <Link className="text-slate-300 hover:text-teal-200 hover:-translate-y-0.5 transition-all duration-200" to="/custom-plan">
                  Custom Plan Request
                </Link>
              ) : null}
              <Link className="text-slate-300 hover:text-teal-200 hover:-translate-y-0.5 transition-all duration-200" to="/help">
                Help
              </Link>
              <Link className="text-slate-300 hover:text-teal-200 hover:-translate-y-0.5 transition-all duration-200" to="/faqs">
                FAQs
              </Link>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold tracking-wider text-white/90 uppercase">Legal</div>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <Link className="text-slate-300 hover:text-teal-200 hover:-translate-y-0.5 transition-all duration-200" to="/privacy">
                Privacy Policy
              </Link>
              <Link className="text-slate-300 hover:text-teal-200 hover:-translate-y-0.5 transition-all duration-200" to="/terms">
                Terms & Conditions
              </Link>
            </div>

            <div className="mt-6 rounded-xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-3 shadow-sm hover:shadow-lg hover:shadow-teal-900/20 transition-all duration-200">
              <div className="text-xs font-semibold text-white">Support</div>
              <div className="mt-1 text-sm text-slate-200">admin@ramanicave.com</div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
