import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getMyProfile, updateMyProfile, uploadMyAvatar } from '../api';
import { User as UserIcon, Image as ImageIcon } from 'lucide-react';

interface ProfileForm {
  first_name: string;
  middle_name: string;
  last_name: string;
}

export default function Profile() {
  const { user, refreshUserProfile } = useAuth();
  const [form, setForm] = useState<ProfileForm>({
    first_name: '',
    middle_name: '',
    last_name: '',
  });
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    // First, show whatever we already have in AuthContext so the page doesn't feel empty
    if (user) {
      setForm({
        first_name: user.first_name || '',
        middle_name: user.middle_name || '',
        last_name: user.last_name || '',
      });
      setAvatarUrl(user.profile_picture_url || '');
    }

    setLoading(false);

    // Then, refresh from backend in the background
    const load = async () => {
      try {
        setProfileLoading(true);
        const res = await getMyProfile();
        const data = res.data;
        setForm({
          first_name: data.first_name || '',
          middle_name: data.middle_name || '',
          last_name: data.last_name || '',
        });
        setAvatarUrl(data.profile_picture_url || '');
        refreshUserProfile({
          first_name: data.first_name,
          middle_name: data.middle_name,
          last_name: data.last_name,
          profile_picture_url: data.profile_picture_url,
        });
      } catch (err: any) {
        const status = err?.response?.status;
        // If token is rejected for /me we silently skip instead of showing a big error banner
        if (status !== 401) {
          setError(err?.response?.data?.message || 'Failed to load profile');
        }
      } finally {
        setProfileLoading(false);
      }
    };

    load();
  }, [refreshUserProfile, user]);

  const handleChange = (field: keyof ProfileForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      // First update text fields
      const res = await updateMyProfile(form);
      let data = res.data;

      // Then upload avatar file if provided
      if (avatarFile) {
        const avatarRes = await uploadMyAvatar(avatarFile);
        data = avatarRes.data;
        setAvatarUrl(data.profile_picture_url || '');
      }

      refreshUserProfile({
        first_name: data.first_name,
        middle_name: data.middle_name,
        last_name: data.last_name,
        profile_picture_url: data.profile_picture_url,
      });
      setSuccess('Profile updated successfully');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const initials = (() => {
    if (!user) return '';
    const parts = [form.first_name, form.last_name].filter(Boolean);
    const base = parts.length ? parts.join(' ') : (user.email?.split('@')[0] || user.email);
    return base
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(p => p[0]?.toUpperCase() || '')
      .join('');
  })();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="card flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse" />
          <div className="space-y-2">
            <div className="h-2 w-32 bg-slate-200 rounded-full animate-pulse" />
            <div className="h-2 w-48 bg-slate-100 rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <div className="mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center text-white">
            <UserIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">My profile</h1>
            <p className="text-sm text-slate-500">View and update your personal details.</p>
            {profileLoading && (
              <p className="text-xs text-slate-400 mt-0.5">Refreshing profile5e</p>
            )}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)]">
          <form onSubmit={handleSubmit} className="card space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-md text-sm">
                {success}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Email</label>
              <input
                type="email"
                value={user?.email || ''}
                readOnly
                className="input-field bg-slate-100 cursor-not-allowed text-slate-500"
              />
              <p className="mt-1 text-[11px] text-slate-400">Email is your login and cannot be changed.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">First name</label>
                <input
                  type="text"
                  value={form.first_name}
                  onChange={e => handleChange('first_name', e.target.value)}
                  className="input-field"
                  placeholder="Jane"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Last name</label>
                <input
                  type="text"
                  value={form.last_name}
                  onChange={e => handleChange('last_name', e.target.value)}
                  className="input-field"
                  placeholder="Doe"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Middle name (optional)</label>
              <input
                type="text"
                value={form.middle_name}
                onChange={e => handleChange('middle_name', e.target.value)}
                className="input-field"
                placeholder="Optional"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Profile picture</label>
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 cursor-pointer hover:bg-slate-50">
                  <ImageIcon className="w-4 h-4 text-slate-500" />
                  <span>Choose image</span>
                  <input
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
                </label>
                {avatarUrl && (
                  <span className="text-xs text-slate-500 truncate max-w-[160px]">
                    Preview updated
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Use a square image for best results. Changes are saved when you click "Save changes".
              </p>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving changes...' : 'Save changes'}
            </button>
          </form>

          <div className="card flex flex-col items-center justify-center gap-3 text-center">
            <div className="relative w-24 h-24 rounded-full bg-teal-600 flex items-center justify-center text-white text-2xl font-semibold overflow-hidden ring-4 ring-teal-200/80 mb-2">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={user?.email}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{initials}</span>
              )}
              <span className="absolute bottom-1 right-1 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">{user?.email}</p>
              <p className="text-xs text-slate-500">{user?.role}</p>
            </div>
            <p className="mt-3 text-xs text-slate-500 max-w-xs">
              Your profile details are used across the marketplace, including your avatar and name shown on plans and dashboards.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
