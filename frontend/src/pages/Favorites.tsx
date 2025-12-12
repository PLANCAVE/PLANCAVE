import { Heart } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Favorites() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f2a2a] via-[#1e4a4a] to-[#2C5F5F] flex flex-col items-center justify-center px-6 py-16 text-white text-center">
      <div className="max-w-2xl space-y-8">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full border border-white/30 bg-white/5 mx-auto">
          <Heart className="w-10 h-10 text-white" />
        </div>
        <div className="space-y-3">
          <p className="tracking-[0.5em] text-xs text-white/60">FAVORITES</p>
          <h1 className="text-3xl md:text-4xl font-serif tracking-[0.3em]">Nothing saved yet</h1>
          <p className="text-white/70 leading-relaxed">
            Save the plans you love to access them quickly across all your devices. Browse our curated
            catalog and tap the heart icon to build your personal shortlist.
          </p>
        </div>
        <Link
          to="/plans"
          className="inline-flex items-center justify-center px-6 py-3 rounded-full border border-white/30 text-white/90 tracking-[0.2em] uppercase text-xs hover:bg-white/10 transition"
        >
          Browse Plans
        </Link>
      </div>
    </div>
  );
}
