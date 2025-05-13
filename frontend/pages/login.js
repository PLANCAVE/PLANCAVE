import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, LogIn, Mail, Lock, AlertCircle, LogOut } from 'lucide-react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import axios from 'axios'; // Make sure axios is installed

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false); // Track if trying to login as admin
  const router = useRouter();
  const { data: session, status } = useSession();

  // Handle sign out if signout query parameter is present
  useEffect(() => {
    if (router.query.signout && status === 'authenticated') {
      handleSignOut();
    }
  }, [router.query.signout, status]);

  // Check for admin login parameter
  useEffect(() => {
    if (router.query.admin) {
      setIsAdmin(true);
    }
  }, [router.query.admin]);

  // Check for error in URL (from NextAuth)
  useEffect(() => {
    if (router.query.error) {
      setError(
        router.query.error === 'CredentialsSignin' 
          ? 'Invalid email or password' 
          : router.query.error
      );
    }
  }, [router.query.error]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      // If admin login is requested, use the admin API endpoint
      if (isAdmin) {
        try {
          console.log('Attempting admin login with:', email);
          
          // Direct API call to admin login endpoint
          const response = await axios.post('http://localhost:5000/api/admin/login', {
            email,
            password,
          });
          
          // Handle successful admin login
          if (response.data && response.data.token) {
            // Store the admin token in localStorage or cookies
            localStorage.setItem('adminToken', response.data.token);
            
            // Redirect to admin dashboard
            router.push('/admin/dashboard');
            return;
          }
        } catch (adminError) {
          console.error('Admin login error:', adminError.response?.data || adminError);
          setError(adminError.response?.data?.message || 'Admin authentication failed');
          setIsLoading(false);
          return;
        }
      }
      
      // Regular NextAuth login for non-admin users
      console.log('Attempting to sign in with:', email);
      
      const result = await signIn('credentials', {
        redirect: false,
        email,
        password,
      });
      
      console.log('Sign in result:', result);
      
      if (result.error) {
        setError(result.error);
        setIsLoading(false);
        return;
      }
      
      // Redirect to home page or the callbackUrl
      router.push(router.query.callbackUrl || '/');
      
    } catch (err) {
      console.error('Sign in error:', err);
      setError('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      // Clear admin token if it exists
      localStorage.removeItem('adminToken');
      
      await signOut({ redirect: false });
      // Clear the signout parameter from the URL
      router.replace('/login', undefined, { shallow: true });
      setIsLoading(false);
    } catch (error) {
      console.error('Sign out error:', error);
      setIsLoading(false);
    }
  };

  // If still checking authentication status, show loading
  if (status === 'loading') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-blue-900 via-blue-700 to-blue-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-white">Loading...</p>
        </div>
      </div>
    );
  }

  // If user is authenticated and not trying to sign out, show sign out option
  if (status === 'authenticated' && !router.query.signout) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-blue-900 via-blue-700 to-blue-900">
        <div className="w-full max-w-md p-8 mx-4 backdrop-blur-lg bg-white rounded-2xl shadow-2xl">
          <div className="mb-8 text-center">
            <div className="relative mb-6">
              <div className="absolute -top-10 -left-10 w-20 h-20 bg-blue-500 rounded-full opacity-20 blur-xl"></div>
              <div className="absolute -top-6 -right-6 w-16 h-16 bg-blue-400 rounded-full opacity-20 blur-lg"></div>
              <h1 className="text-4xl font-bold text-blue-700">
                Hello, {session.user.name || session.user.email}
              </h1>
            </div>
            <p className="text-gray-600">You are already signed in</p>
          </div>
          
          <div className="flex flex-col space-y-4">
            <button
              onClick={() => router.push('/')}
              className="w-full py-3 px-4 bg-blue-100 text-blue-700 rounded-lg font-medium hover:bg-blue-200 transition-all duration-300"
            >
              Go to Home
            </button>
            
            {session.user.role === 'admin' && (
              <button
                onClick={() => router.push('/admin/dashboard')}
                className="w-full py-3 px-4 bg-blue-100 text-blue-700 rounded-lg font-medium hover:bg-blue-200 transition-all duration-300"
              >
                Admin Dashboard
              </button>
            )}
            
            <button
              onClick={handleSignOut}
              disabled={isLoading}
              className="w-full flex items-center justify-center py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all duration-300"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Processing...
                </div>
              ) : (
                <div className="flex items-center">
                  <span>Sign Out</span>
                  <LogOut size={18} className="ml-2" />
                </div>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-blue-900 via-blue-700 to-blue-900">
      <div className="w-full max-w-md p-8 mx-4 backdrop-blur-lg bg-white rounded-2xl shadow-2xl">
        <div className="mb-8 text-center">
          <div className="relative mb-6">
            <div className="absolute -top-10 -left-10 w-20 h-20 bg-blue-500 rounded-full opacity-20 blur-xl"></div>
            <div className="absolute -top-6 -right-6 w-16 h-16 bg-blue-400 rounded-full opacity-20 blur-lg"></div>
            <h1 className="text-4xl font-bold text-blue-700">
              {isAdmin ? "Admin Sign In" : "Sign In"}
            </h1>
          </div>
          <p className="text-gray-600">
            {isAdmin ? "Access administrator panel" : "Access your account"}
          </p>
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
              placeholder="Email"
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
          
          {!isAdmin && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center">
                <input
                  id="remember"
                  type="checkbox"
                  className="w-4 h-4 rounded border-gray-300 bg-gray-50 focus:ring-blue-500 text-blue-600"
                />
                <label htmlFor="remember" className="ml-2 text-gray-600">
                  Remember me
                </label>
              </div>
              <Link href="/forgot-password" className="text-blue-600 hover:text-blue-800 transition-colors">
                Forgot password?
              </Link>
            </div>
          )}
          
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
                <span>{isAdmin ? "Admin Sign In" : "Sign In"}</span>
                <LogIn size={18} className="ml-2" />
              </div>
            )}
          </button>
        </form>
        
        {!isAdmin && (
          <div className="mt-8 text-center">
            <p className="text-gray-600">
              Don't have an account?{" "}
              <Link href="/register" className="text-blue-600 hover:text-blue-800 transition-colors font-medium">
                Sign up
              </Link>
            </p>
            
            <div className="mt-4">
              <button 
                onClick={() => {
                  router.push('/login?admin=true', undefined, { shallow: true });
                  setIsAdmin(true);
                }}
                className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
              >
                Admin Login
              </button>
            </div>
            
            <div className="mt-6 flex justify-center space-x-4">
              {/* Social login buttons */}
              <button className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors border border-gray-200">
                <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </button>
              <button className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors border border-gray-200">
                <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.372 0 0 5.373 0 12s5.372 12 12 12 12-5.373 12-12S18.628 0 12 0zm6.066 9.645c.183 4.04-2.83 8.544-8.164 8.544-1.622 0-3.131-.476-4.402-1.291 1.524.18 3.045-.244 4.252-1.189-1.256-.023-2.317-.854-2.684-1.995.451.086.895.061 1.298-.049-1.381-.278-2.335-1.522-2.304-2.853.388.215.83.344 1.301.359-1.279-.855-1.641-2.544-.889-3.835 1.416 1.738 3.533 2.881 5.92 3.001-.419-1.796.944-3.527 2.799-3.527.825 0 1.572.349 2.096.907.654-.128 1.27-.368 1.824-.697-.215.671-.67 1.233-1.263 1.589.581-.07 1.135-.224 1.649-.453-.384.578-.87 1.084-1.433 1.489z" />
                </svg>
              </button>
              <button className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors border border-gray-200">
                <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-2.141 16.596H7.166V9.536h2.693v7.06zm-1.367-8.04c-.936 0-1.692-.76-1.692-1.696s.756-1.695 1.692-1.695 1.692.758 1.692 1.695-.756 1.696-1.692 1.696zm12.285 8.04h-2.694v-3.607c0-2.255-2.686-2.074-2.686 0v3.607h-2.693V9.536h2.693v1.603c1.18-2.186 5.38-2.35 5.38 2.094v3.363z" />
                </svg>
              </button>
            </div>
          </div>
        )}
        
        {isAdmin && (
          <div className="mt-6 text-center">
            <button 
              onClick={() => {
                router.push('/login', undefined, { shallow: true });
                setIsAdmin(false);
              }}
              className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
            >
              ← Back to regular login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}