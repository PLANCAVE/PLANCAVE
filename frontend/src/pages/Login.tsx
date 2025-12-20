import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { resendVerificationEmail } from '../api';
import { Building2 } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Show success message from registration
    if (location.state?.message) {
      setSuccess(location.state.message);
      // Clear after 5 seconds
      setTimeout(() => setSuccess(''), 5000);
    }
  }, [location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNeedsVerification(false);
    setLoading(true);

    try {
      await login(email, password);
      navigate('/plans');
    } catch (err: any) {
      // Show detailed error messages
      if (err.response) {
        const status = err.response.status;
        const message = err.response.data?.message;
        
        if (status === 401) {
          setError(message || 'Invalid email or password. Please check your credentials and try again.');
        } else if (status === 404) {
          setError('Account not found. Please check your email or register for a new account.');
        } else if (status === 403) {
          const msg = (message || '').toString();
          if (msg.toLowerCase().includes('verify your email')) {
            setNeedsVerification(true);
            setError(msg || 'Please verify your email before login.');
          } else {
            setError('Your account has been deactivated. Please contact admin@ramanicave.com.');
          }
        } else {
          setError(message || 'Login failed. Please try again later.');
        }
      } else if (err.request) {
        setError('Cannot connect to server. Please check your internet connection.');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email) {
      setError('Please enter your email address first.');
      return;
    }
    setError('');
    setSuccess('');
    setResendLoading(true);
    try {
      const resp = await resendVerificationEmail(email);
      setSuccess(resp.data?.message || 'Verification email sent. Please check your inbox.');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to resend verification email.';
      setError(msg);
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#2C5F5F] via-[#1e4a4a] to-[#0f2a2a] px-4 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
      <div className="absolute top-20 right-20 w-96 h-96 bg-teal-500/20 rounded-full blur-3xl animate-float"></div>
      <div className="absolute bottom-20 left-20 w-80 h-80 bg-cyan-500/20 rounded-full blur-3xl animate-float-delayed"></div>
      
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-xl mb-4 shadow-lg shadow-teal-500/50">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Welcome to Ramanicave</h1>
          <p className="text-gray-300 mt-2">Sign in to your account</p>
        </div>

        <div className="card">
          <h2 className="text-2xl font-bold mb-6 text-center">Sign In</h2>
          
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
              {success}
            </div>
          )}
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                required
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <Link to="/forgot-password" className="text-primary-600 hover:text-primary-700 font-medium">
                Forgot password?
              </Link>
              {needsVerification ? (
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resendLoading}
                  className="text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50"
                >
                  {resendLoading ? 'Sending…' : 'Resend verification'}
                </button>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium">
              Sign up
            </Link>
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-gray-500">
          <Link to="/plans" className="hover:text-gray-700">
            Browse plans without signing in →
          </Link>
        </div>
      </div>
    </div>
  );
}
