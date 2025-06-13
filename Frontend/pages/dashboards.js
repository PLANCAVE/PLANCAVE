import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import AdminDashboard from '../components/RoleDashboards/AdminDashboard';
import DesignerDashboard from '../components/RoleDashboards/DesignerDashboard';
import CustomerDashboard from '../components/RoleDashboards/CustomerDashboard';
import LoadingSpinner from '../components/ui/loading';

export default function DashboardPage() {
  const router = useRouter();
  const [role, setRole] = useState(null);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const verifyTokenAndLoadDashboard = async () => {
      try {
        const token = localStorage.getItem('token');

        if (!token) {
          console.log('No token found, redirecting...');
          router.push('/login');
          return;
        }

        // Verify token with backend
        const verifyResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/verify-token`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!verifyResponse.ok) {
          throw new Error('Token verification failed');
        }

        const verifyData = await verifyResponse.json();
        if (!verifyData.valid || !verifyData.user) {
          throw new Error('Invalid token response from server');
        }

        // Normalize role
        const userRole = (verifyData.user.role || verifyData.user.user_type || verifyData.user.userType || '').toLowerCase();
        if (!['admin', 'designer', 'customer'].includes(userRole)) {
          router.push('/unauthorized');
          return;
        }

        setRole(userRole);

        // Fetch dashboard welcome message
        const dashboardRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/dashboard`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!dashboardRes.ok) {
          throw new Error('Failed to fetch dashboard data');
        }

        const dashboardData = await dashboardRes.json();
        setWelcomeMessage(dashboardData.message || '');
      } catch (err) {
        console.error('Dashboard error:', err);
        if (mounted) {
          setError(err.message);
        }
        setTimeout(() => router.push('/login'), 2000);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    verifyTokenAndLoadDashboard();

    return () => {
      mounted = false;
    };
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner fullScreen />
        <p className="mt-4 text-gray-600">Verifying authentication...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="text-lg font-medium text-red-800 mb-2">Authentication Error</h3>
            <p className="text-red-600 mb-4">{error}</p>
            <p className="text-sm text-red-500">Redirecting to login page...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {welcomeMessage && (
  <div className="flex justify-center mb-6">
    <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white px-6 py-4 rounded-lg shadow-lg border-l-4 border-blue-500 max-w-2xl w-full">
      <div className="flex items-center justify-center space-x-3">
        <div className="bg-blue-500 p-2 rounded-full">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold text-blue-300"></h3>
          <p className="text-gray-200 mt-1">{welcomeMessage}</p>
        </div>
      </div>
    </div>
  </div>
)}

      {role === 'admin' && <AdminDashboard role={role} />}
      {role === 'designer' && <DesignerDashboard  role={role} />}
      {role === 'customer' && <CustomerDashboard  role={role}/>}
    </>
  );
}
