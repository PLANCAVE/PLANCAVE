import React, { useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';
import { Lock, LogIn, Mail, AlertCircle } from 'lucide-react';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      console.log('Attempting admin login with:', email);
      
      // Direct API call to the admin endpoint
      const response = await axios.post('http://localhost:5000/api/admin/login', {
        email,
        password
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Admin login response:', response.data);
      
      if (response.data && response.data.token) {
        // Store the admin token
        localStorage.setItem('adminToken', response.data.token);
        
        // Redirect to admin dashboard
        router.push('/admin/dashboard');
      } else {
        setError('Invalid response from server');
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Admin login error:', err.response?.data || err);
      setError(err.response?.data?.message || 'Authentication failed. Please check your credentials.');
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800">
      <div className="w-full max-w-md p-8 mx-4 backdrop-blur-lg bg-white rounded-2xl shadow-2xl">
        <div className="mb-8 text-center">
          <div className="relative mb-6">
            <div className="absolute -top-10 -left-10 w-20 h-20 bg-blue-500 rounded-full opacity-20 blur-xl"></div>
            <div className="absolute -top-6 -right-6 w-16 h-16 bg-blue-400 rounded-full opacity-20 blur-lg"></div>
            <h1 className="text-4xl font-bold text-slate-700">
              Admin Login
            </h1>
          </div>
          <p className="text-gray-600">Access administrator dashboard</p>
        </div>
        
        {error && (
          <div className="mb-6 py-3 px-4 bg-red-50 border border-red-200 text-red-600 rounded-md text-sm flex items-start">
            <AlertCircle size={18} className="mr-2 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
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
              type="password"
              placeholder="Admin Password"
              value={password}
              required
              onChange={e => setPassword(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-50 text-gray-800 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300"
            />
          </div>
          
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full flex items-center justify-center py-3 px-4 rounded-lg font-medium transition-all duration-300 ${
              isLoading 
                ? 'bg-gray-400 text-white cursor-not-allowed' 
                : 'bg-slate-700 hover:bg-slate-800 text-white shadow-lg'
            }`}
          >
            {isLoading ? (
              <div className="flex items-center">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Processing...
              </div>
            ) : (
              <div className="flex items-center">
                <span>Admin Sign In</span>
                <LogIn size={18} className="ml-2" />
              </div>
            )}
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <button 
            onClick={() => router.push('/login')}
            className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
          >
            ← Back to regular login
          </button>
        </div>
      </div>
    </div>
  );
}