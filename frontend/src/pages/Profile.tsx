import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getMyProfile, updateMyProfile, uploadMyAvatar } from '../api';

export default function Profile() {
  const navigate = useNavigate();
  const { user, refreshUserProfile, logout } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Load profile data
    const loadProfile = async () => {
      try {
        const res = await getMyProfile();
        const data = res.data;
        setFirstName(data.first_name || '');
        setMiddleName(data.middle_name || '');
        setLastName(data.last_name || '');
        setAvatarUrl(data.profile_picture_url || '');
      } catch (err: any) {
        console.error('Failed to load profile:', err);
        // Fallback to auth context data
        if (user) {
          setFirstName(user.first_name || '');
          setMiddleName(user.middle_name || '');
          setLastName(user.last_name || '');
          setAvatarUrl(user.profile_picture_url || '');
        }
      }
    };
    loadProfile();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      // Update profile
      const res = await updateMyProfile({
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
      });
      let data = res.data;

      // Upload avatar if selected
      if (avatarFile) {
        const avatarRes = await uploadMyAvatar(avatarFile);
        data = avatarRes.data;
        setAvatarUrl(data.profile_picture_url || '');
      }

      // Update auth context
      refreshUserProfile(data);
      setMessage('Profile updated successfully!');
    } catch (err: any) {
      setMessage(err?.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const initials = (() => {
    const name = [firstName, lastName].filter(Boolean).join(' ') || user?.email?.split('@')[0] || '';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || '')
      .join('');
  })();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-black">
        <div className="text-center px-8 py-6 rounded-2xl border border-slate-800 bg-slate-900/70 shadow-2xl shadow-black/60">
          <h2 className="text-xl font-semibold mb-1 text-white">Please log in</h2>
          <p className="text-sm text-slate-300">You need to be logged in to view your profile.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b1f1f] via-[#071415] to-black py-10">
      <div className="max-w-5xl mx-auto px-4">
        {/* Header / hero */}
        <div className="relative overflow-hidden rounded-3xl border border-teal-500/30 bg-gradient-to-r from-teal-600/70 via-cyan-600/70 to-emerald-500/70 px-6 sm:px-10 py-6 sm:py-7 mb-8 shadow-2xl shadow-black/40">
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_top,_#ffffff33,transparent_55%)]" />
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] uppercase text-teal-100/80 mb-1">
                Account
              </p>
              <h1 className="text-2xl sm:text-3xl font-semibold text-white drop-shadow-md">
                My Profile
              </h1>
              <p className="mt-1 text-sm text-teal-50/90 max-w-xl">
                Update how you appear across Plancave and manage your session.
              </p>
            </div>
            <div className="flex items-center gap-3 self-stretch sm:self-auto sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={() => navigate('/plans')}
                className="hidden sm:inline-flex items-center justify-center rounded-full border border-white/30 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white/90 hover:bg-white/20 hover:border-white/60 transition-colors"
              >
                Back to browse
              </button>
              <button
                type="button"
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                className="inline-flex items-center justify-center rounded-full border border-red-300/60 bg-red-500/15 px-3.5 py-1.5 text-xs font-semibold text-red-100 hover:bg-red-500/30 hover:border-red-200 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="grid gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.7fr)]">
          {/* Profile overview card */}
          <div className="relative rounded-2xl border border-slate-800 bg-slate-950/70 px-6 py-6 shadow-xl shadow-black/40 flex flex-col gap-5 overflow-hidden">
            <div className="absolute inset-x-0 -top-16 h-32 bg-[radial-gradient(circle_at_top,_#22c1c366,transparent_65%)] opacity-60 pointer-events-none" />
            <div className="relative text-center">
              <div className="relative mx-auto mb-4 h-24 w-24 rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white text-3xl font-semibold ring-4 ring-teal-500/40 shadow-lg shadow-teal-500/40 overflow-hidden">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Profile"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>{initials}</span>
                )}
                <span className="absolute bottom-2 right-2 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-slate-900" />
              </div>
              <h3 className="font-semibold text-slate-50 text-base truncate">{user.email}</h3>
              <p className="mt-0.5 inline-flex items-center justify-center rounded-full bg-teal-500/15 px-3 py-0.5 text-[11px] font-medium uppercase tracking-wide text-teal-200 border border-teal-400/40">
                {user.role}
              </p>
            </div>

            <div className="relative mt-2 border-t border-slate-800 pt-4 text-left text-xs text-slate-300 space-y-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
                  Account overview
                </p>
                <p className="text-slate-400/90">
                  Your name and avatar are shown on plans, dashboards, and team views within Plancave.
                </p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
                <div className="rounded-xl bg-slate-900/70 border border-slate-800 px-3 py-2">
                  <p className="text-slate-400/80">First name</p>
                  <p className="mt-0.5 font-medium text-slate-100 truncate">{firstName || 'Not set'}</p>
                </div>
                <div className="rounded-xl bg-slate-900/70 border border-slate-800 px-3 py-2">
                  <p className="text-slate-400/80">Last name</p>
                  <p className="mt-0.5 font-medium text-slate-100 truncate">{lastName || 'Not set'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-[11px] font-semibold text-red-100 hover:bg-red-500/25 hover:border-red-300 transition-colors"
              >
                Sign out of this device
              </button>
            </div>
          </div>

          {/* Edit form card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-6 py-6 shadow-xl shadow-black/40">
            <form onSubmit={handleSubmit} className="space-y-5">
              {message && (
                <div
                  className={`rounded-xl px-3.5 py-2.5 text-xs font-medium border ${
                    message.includes('success')
                      ? 'bg-emerald-500/10 text-emerald-200 border-emerald-400/50'
                      : 'bg-red-500/10 text-red-200 border-red-400/50'
                  }`}
                >
                  {message}
                </div>
              )}

              <div className="space-y-1.5">
                <h2 className="text-sm font-semibold text-slate-50">Personal details</h2>
                <p className="text-xs text-slate-400">
                  These details help designers and customers recognise you across the platform.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">First name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-400"
                    placeholder="Jane"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Last name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-400"
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Middle name (optional)</label>
                <input
                  type="text"
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-400"
                  placeholder="Middle name"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-300">Profile picture</label>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs font-medium text-slate-100 hover:bg-slate-800/80 transition-colors"
                    onClick={() => {
                      const input = document.getElementById('avatar-input');
                      if (input) {
                        (input as HTMLInputElement).click();
                      }
                    }}
                  >
                    <span className="inline-block h-2 w-2 rounded-full bg-teal-400" />
                    <span>Choose image</span>
                  </button>
                  <input
                    id="avatar-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setAvatarFile(file);
                      if (file) {
                        const url = URL.createObjectURL(file);
                        setAvatarUrl(url);
                      }
                    }}
                  />
                  <p className="text-[11px] text-slate-400">
                    Use a square image for best results. Changes apply when you save.
                  </p>
                </div>
              </div>

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-500/40 hover:from-teal-400 hover:to-cyan-400 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                >
                  {loading ? 'Saving changes…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
