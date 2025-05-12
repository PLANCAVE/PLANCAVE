import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Sidebar from '../../components/admin/Sidebar';
import StatsCard from '../../components/admin/StatsCard';
import Link from 'next/link';
import axios from 'axios';

const Dashboard = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    adminUsers: 0,
    newUsersThisMonth: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'loading') return; // Wait for session to load
    if (!session || session.user.role !== 'admin') {
      router.push('/unauthorized'); // Or redirect to login
    }
  }, [session, status, router]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        
        // Use the correct API endpoint
        // Option 1: Use the Next.js API route
        const res = await axios.get('/api/users');
        
        // Option 2: Use the backend API directly (if CORS is configured)
        // const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/admin/users`, {
        //   headers: {
        //     Authorization: `Bearer ${session.accessToken}`
        //   }
        // });
        
        const users = res.data;

        // Process user data
        const activeUsers = users.filter(user => user.isActive).length;
        const adminUsers = users.filter(user => user.role === 'admin').length;
        
        // Calculate new users this month
        const now = new Date();
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const newUsersThisMonth = users.filter(user => {
          const createdAt = user.createdAt || user.created_at;
          return new Date(createdAt) >= thisMonth;
        }).length;

        setStats({
          totalUsers: users.length,
          activeUsers,
          adminUsers,
          newUsersThisMonth
        });
        
        setError(''); // Clear any previous errors
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
        setError(`Failed to fetch dashboard data: ${err.response?.data?.message || err.message}`);
      } finally {
        setLoading(false);
      }
    };

    if (session?.user?.role === 'admin') {
      fetchStats();
    }
  }, [session]);

  if (status === 'loading' || loading) {
    return <div className="flex justify-center mt-8">Loading dashboard...</div>;
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />

      <div className="flex-1 overflow-auto p-6">
        <h1 className="text-3xl font-bold mb-4">Admin Dashboard</h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <StatsCard title="Total Users" value={stats.totalUsers} icon="users" />
          <StatsCard title="Active Users" value={stats.activeUsers} icon="user-check" />
          <StatsCard title="Admin Users" value={stats.adminUsers} icon="shield" />
          <StatsCard title="New Users This Month" value={stats.newUsersThisMonth} icon="user-plus" />
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Quick Actions</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/admin/users" className="flex items-center p-4 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100">
              <div className="mr-3">{/* icon */}</div>
              <div>
                <h3 className="font-medium">Manage Users</h3>
                <p className="text-sm text-blue-600">View, edit and delete users</p>
              </div>
            </Link>

            <Link href="/admin/users/new" className="flex items-center p-4 bg-green-50 text-green-700 rounded-lg hover:bg-green-100">
              <div className="mr-3">{/* icon */}</div>
              <div>
                <h3 className="font-medium">Create User</h3>
                <p className="text-sm text-green-600">Add a new user to the system</p>
              </div>
            </Link>

            <Link href="/admin/profile" className="flex items-center p-4 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100">
              <div className="mr-3">{/* icon */}</div>
              <div>
                <h3 className="font-medium">Your Profile</h3>
                <p className="text-sm text-purple-600">Edit your profile settings</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;