import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getCustomerDashboard, getAnalyticsOverview, getAdminDashboard } from '../api';
import { ShoppingBag, Heart, TrendingUp, Users, FileText, DollarSign } from 'lucide-react';

export default function Dashboard() {
  const { user, isAdmin, isDesigner, isCustomer } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

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
      setData(response.data);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
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
            {isCustomer && '🛍️ Customer Dashboard - Your Purchases & Favorites'}
          </p>
        </div>

        {/* Customer Dashboard */}
        {isCustomer && !data && (
          <div className="card text-center py-12">
            <ShoppingBag className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">Welcome, Customer!</h3>
            <p className="text-gray-600 mb-4">
              You haven't made any purchases yet. Browse our amazing architectural plans!
            </p>
            <a href="/plans" className="btn-primary inline-block">
              Browse Plans
            </a>
          </div>
        )}
        
        {isCustomer && data && (
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
                      KSH {(data.purchase_summary?.total_spent || 0).toLocaleString()}
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
            <button className="btn-primary">
              Upload Your First Plan
            </button>
          </div>
        )}
        
        {isDesigner && !isAdmin && data && (
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
        )}

        {/* Admin Dashboard */}
        {isAdmin && data && (
          <div className="space-y-6">
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
