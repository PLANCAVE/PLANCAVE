import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="text-sm text-slate-600">
            © {new Date().getFullYear()} Ramanicave. All rights reserved.
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Link className="text-slate-700 hover:text-teal-700" to="/faqs">
              FAQs
            </Link>
            <Link className="text-slate-700 hover:text-teal-700" to="/help">
              Help
            </Link>
            <Link className="text-slate-700 hover:text-teal-700" to="/privacy">
              Privacy Policy
            </Link>
            <Link className="text-slate-700 hover:text-teal-700" to="/terms">
              Terms & Conditions
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
