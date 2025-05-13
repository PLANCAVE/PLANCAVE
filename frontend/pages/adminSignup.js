import React, { useState } from 'react';
import { Eye, EyeOff, UserPlus, Mail, Lock, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/router';

export default function AdminSignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/admin/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Signup failed');
        setIsLoading(false);
        return;
      }

      setSuccess('Admin account created! You can now log in.');
      setIsLoading(false);
      setTimeout(() => {
        router.push('/adminLogin');
      }, 1500);
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-blue-900 via-blue-700 to-blue-900">
      <div className="w-full max-w-md p-8 mx-4 backdrop-blur-lg bg-white rounded-2xl shadow-2xl">
        <div className="mb-8 text-center">
          <div className="relative mb-6">
            <div className="absolute -top-10 -left-10 w-20 h-20 bg-blue-500 rounded-full opacity-20 blur-xl"></div>
            <div className="absolute -top-6 -right-6 w-16 h-16 bg-blue-400 rounded-full opacity-20 blur-lg"></div>
            <h1 className="text-4xl font-bold text-blue-700">
              Admin Sign Up
            </h1>
          </div>
          <p className="text-gray-600">Create a new admin account</p>
        </div>

        {error && (
          <div className="mb-6 py-3 px-4 bg-red-50 border border-red-200 text-red-600 rounded-md text-sm flex items-start">
            <AlertCircle size={18} className="mr-2 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mb-6 py-3 px-4 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm flex items-start">
            <UserPlus size={18} className="mr-2 mt-0.5 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
              <UserPlus size={18} />
            </div>
            <input
              type="text"
              placeholder="Name"
              value={name}
              required
              onChange={e => setName(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-50 text-gray-800 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300"
            />
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
              <Mail size={18} />
            </div>
            <input
              type="email"
              placeholder="Admin Email"
              value={email}
              required
              onChange={e => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-50 text-gray-800 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300"
            />
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
              <Lock size={18} />
            </div>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              required
              onChange={e => setPassword(e.target.value)}
              className="w-full pl-10 pr-12 py-3 bg-gray-50 text-gray-800 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full flex items-center justify-center py-3 px-4 rounded-lg font-medium transition-all duration-300 ${
              isLoading 
                ? 'bg-gray-400 text-white cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-blue-500/25'
            }`}
          >
            {isLoading ? (
              <div className="flex items-center">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Processing...
              </div>
            ) : (
              <div className="flex items-center">
                <span>Sign Up</span>
                <UserPlus size={18} className="ml-2" />
              </div>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}