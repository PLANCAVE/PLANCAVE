import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api, { getCustomerDashboard, getAnalyticsOverview, getAdminDashboard } from '../api';
import { ShoppingBag, Heart, TrendingUp, Users, FileText, DollarSign } from 'lucide-react';

export default function Dashboard() {
  const { user, isAdmin, isDesigner, isCustomer } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [migrationStatus, setMigrationStatus] = useState<'idle' | 'running' | 'success' | 'error'>("idle");
  const [migrationMessage, setMigrationMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    loadDashboard();
  }, [user, isAdmin, isDesigner, isCustomer]);

  const loadDashboard = async () => {
    try {
      let response;
      if (isAdmin) {
        response = await getAdminDashboard();
      } else if (isDesigner) {
        response = await getAnalyticsOverview();
      } else {
        response = await getCustomerDashboard();
      }
      console.log('Dashboard data received:', response.data);
      setData(response.data);
      setError(null);
    } catch (error: any) {
      console.error('Failed to load dashboard:', error);
      setError(error?.response?.data?.message || error?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const runMigrationsFromAdmin = async () => {
    if (!isAdmin) return;
    try {
      setMigrationStatus('running');
      setMigrationMessage(null);
      const response = await api.post('/admin/run-migrations');
      const details = (response.data?.details || []).join(' \n');
      setMigrationStatus('success');
      setMigrationMessage(details || 'Migrations completed successfully');
      // Reload dashboard data after successful migrations
      setLoading(true);
      await loadDashboard();
    } catch (err: any) {
      setMigrationStatus('error');
      const msg = err?.response?.data?.message || err?.message || 'Failed to run migrations';
      const extra = err?.response?.data?.error || '';
      setMigrationMessage(extra ? `${msg}: ${extra}` : msg);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-lg w-full bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Dashboard unavailable</h2>
          <p className="text-sm text-gray-700 mb-4">{error}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              loadDashboard();
            }}
            className="px-4 py-2 rounded bg-gray-900 text-white hover:bg-gray-800"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-teal-50/20 py-8">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome back, {user?.email}!
            </h1>
            {user?.role && (
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                user.role === 'admin' ? 'bg-red-100 text-red-700' :
                user.role === 'designer' ? 'bg-purple-100 text-purple-700' :
                'bg-blue-100 text-blue-700'
              }`}>
                {user.role.toUpperCase()}
              </span>
            )}
          </div>
          <p className="text-gray-600 mt-1">
            {isAdmin && '🛡️ Admin Dashboard - Platform Overview'}
            {isDesigner && !isAdmin && '🎨 Designer Dashboard - Your Analytics & Sales'}
            {isCustomer && !isAdmin && !isDesigner && '🛍️ Customer Dashboard - Your Purchases & Favorites'}
          </p>
        </div>

        {/* Admin Migration Button - Always visible for admin */}
        {isAdmin && (
          <div className="mb-6 bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900">Database Setup Required</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Click this button once to set up all database tables and fix dashboard errors.
                </p>
              </div>
              <button
                type="button"
                onClick={runMigrationsFromAdmin}
                disabled={migrationStatus === 'running'}
                className={`px-6 py-3 rounded-lg font-semibold transition-all whitespace-nowrap ${
                  migrationStatus === 'running'
                    ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-red-600 to-orange-600 text-white hover:from-red-700 hover:to-orange-700 shadow-lg'
                }`}
              >
                {migrationStatus === 'running' ? 'Running...' : '🔧 Run DB Migrations'}
              </button>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
            <p className="font-semibold">Error loading dashboard</p>
            <p className="text-sm mt-1">{error}</p>
            <p className="text-xs mt-2 text-red-600">
              💡 If you see a 422 error, run the DB Migrations button above first.
            </p>
            <button 
              onClick={loadDashboard}
              className="mt-3 text-sm bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        )}

        {/* Admin Migration Status */}
        {isAdmin && migrationStatus !== 'idle' && (
          <div
            className={`mb-6 px-6 py-4 rounded-lg border text-sm ${
              migrationStatus === 'running'
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : migrationStatus === 'success'
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            <p className="font-semibold">
              {migrationStatus === 'running'
                ? 'Running database migrations...'
                : migrationStatus === 'success'
                ? 'Migrations completed'
                : 'Migration failed'}
            </p>
            {migrationMessage && (
              <pre className="mt-2 whitespace-pre-wrap text-xs bg-white/70 rounded p-2 max-h-60 overflow-auto">
                {migrationMessage}
              </pre>
            )}
          </div>
        )}

        {/* Customer Dashboard */}
        {isCustomer && !isAdmin && !data && (
          <div className="card text-center py-12">
            <ShoppingBag className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">Welcome, Customer!</h3>
            <p className="text-gray-600 mb-4">
              You haven't made any purchases yet. Browse our amazing architectural plans!
            </p>
            <Link to="/plans" className="btn-primary inline-block">
              Browse Plans
            </Link>
          </div>
        )}
        
        {isCustomer && !isAdmin && data && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Purchases</p>
                    <p className="text-2xl font-bold mt-1">
                      {data.purchase_summary?.total_purchases || 0}
                    </p>
                  </div>
                  <ShoppingBag className="w-8 h-8 text-primary-600" />
                </div>
              </div>

              <div className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Spent</p>
                    <p className="text-2xl font-bold mt-1">
                      $ {(data.purchase_summary?.total_spent || 0).toLocaleString()}
                    </p>
                  </div>
                  <DollarSign className="w-8 h-8 text-green-600" />
                </div>
              </div>

              <div className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Favorites</p>
                    <p className="text-2xl font-bold mt-1">
                      {data.favorites_count || 0}
                    </p>
                  </div>
                  <Heart className="w-8 h-8 text-red-600" />
                </div>
              </div>
            </div>

            {data.recent_purchases && data.recent_purchases.length > 0 && (
              <div className="card">
                <h2 className="text-xl font-bold mb-4">Recent Purchases</h2>
                <div className="space-y-3">
                  {data.recent_purchases.map((purchase: any) => (
                    <div key={purchase.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <div>
                        <p className="font-medium">{purchase.plan_name}</p>
                        <p className="text-sm text-gray-600">{purchase.category}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">KSH {purchase.amount.toLocaleString()}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(purchase.purchased_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Designer Dashboard */}
        {isDesigner && !isAdmin && !data && (
          <div className="card text-center py-12">
            <FileText className="w-16 h-16 text-purple-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">Welcome, Designer!</h3>
            <p className="text-gray-600 mb-4">
              Start uploading your architectural plans and track your sales & analytics here.
            </p>
            <div className="flex gap-4 justify-center">
              <Link to="/designer/upload" className="btn-primary">
                Upload Your First Plan
              </Link>
              <Link to="/designer/my-plans" className="btn-secondary">
                View My Plans
              </Link>
            </div>
          </div>
        )}
        
        {isDesigner && !isAdmin && data && (
          <>
            <div className="mb-6 flex gap-4">
              <Link to="/designer/upload" className="btn-primary">
                Upload New Plan
              </Link>
              <Link to="/designer/my-plans" className="btn-secondary">
                My Plans
              </Link>
            </div>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Plans</p>
                    <p className="text-2xl font-bold mt-1">{data.total_plans || 0}</p>
                  </div>
                  <FileText className="w-8 h-8 text-primary-600" />
                </div>
              </div>

              <div className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Sales</p>
                    <p className="text-2xl font-bold mt-1">{data.total_sales || 0}</p>
                  </div>
                  <ShoppingBag className="w-8 h-8 text-green-600" />
                </div>
              </div>

              <div className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Revenue</p>
                    <p className="text-2xl font-bold mt-1">
                      KSH {(data.total_revenue || 0).toLocaleString()}
                    </p>
                  </div>
                  <DollarSign className="w-8 h-8 text-yellow-600" />
                </div>
              </div>

              <div className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Views</p>
                    <p className="text-2xl font-bold mt-1">{data.total_views || 0}</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-purple-600" />
                </div>
              </div>
            </div>

            {data.top_plans && data.top_plans.length > 0 && (
              <div className="card">
                <h2 className="text-xl font-bold mb-4">Top Performing Plans</h2>
                <div className="space-y-3">
                  {data.top_plans.map((plan: any) => (
                    <div key={plan.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <div>
                        <p className="font-medium">{plan.name}</p>
                        <p className="text-sm text-gray-600">{plan.views} views • {plan.downloads} downloads</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{plan.sales_count} sales</p>
                        <p className="text-sm text-gray-600">KSH {plan.price.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          </>
        )}

        {/* Admin Dashboard Empty State */}
        {isAdmin && !data && !error && (
          <div className="card text-center py-12">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">Welcome, Admin!</h3>
            <p className="text-gray-600 mb-4">
              Platform is initializing. Dashboard data will appear once users and plans are added.
            </p>
            <div className="flex gap-4 justify-center">
              <Link to="/designer/upload" className="btn-primary">
                Upload First Plan
              </Link>
              <Link to="/admin/users" className="btn-secondary">
                Manage Users
              </Link>
            </div>
          </div>
        )}

        {/* Admin Dashboard */}
        {isAdmin && data && (
          <div className="space-y-6">
            <div className="mb-6 flex flex-wrap gap-4 items-center">
              <Link to="/admin/users" className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white px-6 py-3 rounded-lg hover:shadow-lg hover:shadow-teal-500/50 transition-all font-semibold">
                Manage Users
              </Link>
              <Link to="/admin/plans" className="bg-gradient-to-r from-emerald-600 to-green-600 text-white px-6 py-3 rounded-lg hover:shadow-lg hover:shadow-emerald-500/50 transition-all font-semibold">
                Manage Plans
              </Link>
              <Link to="/designer/upload" className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-lg hover:shadow-lg hover:shadow-purple-500/50 transition-all font-semibold">
                Upload Plan
              </Link>
              <Link to="/admin/analytics" className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-lg hover:shadow-lg hover:shadow-blue-500/50 transition-all font-semibold">
                View Analytics
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Users</p>
                    <p className="text-2xl font-bold mt-1">{data.user_stats?.total_users || 0}</p>
                  </div>
                  <Users className="w-8 h-8 text-primary-600" />
                </div>
              </div>

              <div className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Plans</p>
                    <p className="text-2xl font-bold mt-1">{data.plan_stats?.total_plans || 0}</p>
                  </div>
                  <FileText className="w-8 h-8 text-green-600" />
                </div>
              </div>

              <div className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Revenue</p>
                    <p className="text-2xl font-bold mt-1">
                      KSH {(data.revenue_stats?.total_revenue || 0).toLocaleString()}
                    </p>
                  </div>
                  <DollarSign className="w-8 h-8 text-yellow-600" />
                </div>
              </div>

              <div className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Active Users</p>
                    <p className="text-2xl font-bold mt-1">{data.user_stats?.active_users || 0}</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-purple-600" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="card">
                <h2 className="text-xl font-bold mb-4">User Breakdown</h2>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Customers</span>
                    <span className="font-semibold">{data.user_stats?.customers || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Designers</span>
                    <span className="font-semibold">{data.user_stats?.designers || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Admins</span>
                    <span className="font-semibold">{data.user_stats?.admins || 0}</span>
                  </div>
                </div>
              </div>

              <div className="card">
                <h2 className="text-xl font-bold mb-4">Plan Stats</h2>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Available</span>
                    <span className="font-semibold">{data.plan_stats?.available_plans || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Draft</span>
                    <span className="font-semibold">{data.plan_stats?.draft_plans || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Sales</span>
                    <span className="font-semibold">{data.plan_stats?.total_sales || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
