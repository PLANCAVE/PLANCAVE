import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerCustomer, registerDesigner } from '../api';
import { Building2 } from 'lucide-react';

export default function Register() {
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'customer' | 'designer'>('customer');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!firstName || !lastName) {
      setError('Please enter your first name and last name');
      return;
    }

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please check both password fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long for security.');
      return;
    }

    setLoading(true);

    try {
      const userData = { email, password, first_name: firstName, middle_name: middleName, last_name: lastName };
      if (role === 'customer') {
        await registerCustomer(userData.email, userData.password, userData.first_name, userData.middle_name, userData.last_name);
      } else {
        await registerDesigner(userData.email, userData.password, userData.first_name, userData.middle_name, userData.last_name);
      }
      navigate('/login', { state: { message: 'Registration successful! Please login with your credentials.' } });
    } catch (err: any) {
      // Show detailed error messages
      if (err.response) {
        const status = err.response.status;
        const message = err.response.data?.message;
        
        if (status === 409) {
          setError(message || 'This email is already registered. Please use a different email or try logging in.');
        } else if (status === 400) {
          setError(message || 'Invalid registration data. Please check all fields and try again.');
        } else {
          setError(message || 'Registration failed. Please try again later.');
        }
      } else if (err.request) {
        setError('Cannot connect to server. Please check your internet connection and try again.');
      } else {
        setError('An unexpected error occurred during registration. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#2C5F5F] via-[#1e4a4a] to-[#0f2a2a] px-4 py-8 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
      <div className="absolute top-20 right-20 w-96 h-96 bg-teal-500/20 rounded-full blur-3xl animate-float"></div>
      <div className="absolute bottom-20 left-20 w-80 h-80 bg-cyan-500/20 rounded-full blur-3xl animate-float-delayed"></div>
      
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-xl mb-4 shadow-lg shadow-teal-500/50">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Join The Plancave</h1>
          <p className="text-gray-300 mt-2">Start buying or selling plans today</p>
        </div>

        <div className="card">
          <h2 className="text-2xl font-bold mb-6 text-center">Sign Up</h2>
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                I want to:
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole('customer')}
                  className={`py-3 px-4 rounded-lg border-2 transition-all ${
                    role === 'customer'
                      ? 'border-primary-600 bg-primary-50 text-primary-700 font-semibold'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  Buy Plans
                </button>
                <button
                  type="button"
                  onClick={() => setRole('designer')}
                  className={`py-3 px-4 rounded-lg border-2 transition-all ${
                    role === 'designer'
                      ? 'border-primary-600 bg-primary-50 text-primary-700 font-semibold'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  Sell Plans
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Middle Name
                </label>
                <input
                  type="text"
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                  className="input-field"
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="input-field"
                  required
                />
              </div>
            </div>

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
                minLength={6}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-field"
                required
              />
              {confirmPassword && password && (
                <p className={`text-sm mt-1 ${password === confirmPassword ? 'text-green-600' : 'text-red-600'}`}>
                  {password === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
