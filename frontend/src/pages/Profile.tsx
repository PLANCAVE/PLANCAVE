import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getMyProfile, updateMyProfile, uploadMyAvatar } from '../api';
import { User as UserIcon, Image as ImageIcon } from 'lucide-react';

export default function Profile() {
  const { user, refreshUserProfile } = useAuth();
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
        last_name: lastName
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
      .map(p => p[0]?.toUpperCase() || '')
      .join('');
  })();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Please log in</h2>
          <p className="text-gray-600">You need to be logged in to view your profile.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
          <p className="text-slate-600">Update your personal information</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Profile Card */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="text-center">
              <div className="relative w-20 h-20 rounded-full bg-teal-600 flex items-center justify-center text-white text-xl font-semibold mx-auto mb-4 overflow-hidden">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
              <h3 className="font-semibold text-slate-900">{user.email}</h3>
              <p className="text-sm text-slate-500 capitalize">{user.role}</p>
            </div>
          </div>

          {/* Edit Form */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {message && (
                <div className={`p-3 rounded text-sm ${message.includes('success') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {message}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Enter first name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Middle Name (optional)</label>
                <input
                  type="text"
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Enter middle name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Enter last name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Profile Picture</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setAvatarFile(file);
                    if (file) {
                      const url = URL.createObjectURL(file);
                      setAvatarUrl(url);
                    }
                  }}
                  className="w-full"
                />
                <p className="text-xs text-slate-500 mt-1">Upload a new profile picture (optional)</p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-teal-600 text-white py-2 px-4 rounded-md hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
