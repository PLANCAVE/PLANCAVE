import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDesignerAnalytics, getCustomerAnalytics } from '../../api';
import { Users, DollarSign, TrendingUp, ShoppingCart, FileText, Receipt } from 'lucide-react';

interface Designer {
  designer_id: number;
  designer_email: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  total_plans: number;
  total_sales: number;
  total_revenue: number;
  avg_plan_price: number;
  joined_date: string;
}

interface Customer {
  customer_id: number;
  customer_email: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  total_purchases: number;
  total_spent: number;
  plans_liked: number;
  joined_date: string;
  last_purchase_date: string;
}

export default function Analytics() {
  const [designers, setDesigners] = useState<Designer[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'designers' | 'customers'>('designers');
  const navigate = useNavigate();

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const [designerRes, customerRes] = await Promise.all([
        getDesignerAnalytics(),
        getCustomerAnalytics()
      ]);
      console.log('Designer Response:', designerRes.data);
      console.log('Customer Response:', customerRes.data);
      setDesigners(designerRes.data.designers || []);
      setCustomers(customerRes.data.customers || []);
      console.log('Designers set:', designerRes.data.designers);
      console.log('Customers set:', customerRes.data.customers);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalDesignerRevenue = designers.reduce((sum, d) => sum + parseFloat(d.total_revenue as any), 0);
  const totalCustomerSpending = customers.reduce((sum, c) => sum + parseFloat(c.total_spent as any), 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-teal-50/30 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3 mb-2">
            <TrendingUp className="w-8 h-8 text-teal-600" />
            Platform Analytics
          </h1>
          <p className="text-gray-600">Complete overview of designers and customers</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="card bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Designers</p>
                <p className="text-3xl font-bold text-purple-600">{designers.length}</p>
              </div>
              <Users className="w-10 h-10 text-purple-400" />
            </div>
          </div>

          <div className="card bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Designer Revenue</p>
                <p className="text-3xl font-bold text-emerald-600">$ {totalDesignerRevenue.toLocaleString()}</p>
              </div>
              <DollarSign className="w-10 h-10 text-emerald-400" />
            </div>
          </div>

          <div className="card bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Customers</p>
                <p className="text-3xl font-bold text-blue-600">{customers.length}</p>
              </div>
              <ShoppingCart className="w-10 h-10 text-blue-400" />
            </div>
          </div>

          <div className="card bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Customer Spending</p>
                <p className="text-3xl font-bold text-orange-600">KSH {totalCustomerSpending.toLocaleString()}</p>
              </div>
              <TrendingUp className="w-10 h-10 text-orange-400" />
            </div>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setView('designers')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              view === 'designers'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Designer Analytics
          </button>
          <button
            onClick={() => setView('customers')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              view === 'customers'
                ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Customer Analytics
          </button>
          <button
            onClick={() => navigate('/admin/purchases')}
            className="px-6 py-3 rounded-lg font-semibold bg-white text-gray-700 hover:bg-gray-100 transition-all flex items-center gap-2"
          >
            <Receipt className="w-5 h-5" />
            Purchase Details
          </button>
        </div>

        {/* Designer Table */}
        {view === 'designers' && (
          <div className="card">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <FileText className="w-6 h-6 text-purple-600" />
              Designer Revenue & Sales
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold">Designer</th>
                    <th className="text-left py-3 px-4 font-semibold">Plans</th>
                    <th className="text-left py-3 px-4 font-semibold">Sales</th>
                    <th className="text-left py-3 px-4 font-semibold">Revenue</th>
                    <th className="text-left py-3 px-4 font-semibold">Avg Price</th>
                    <th className="text-left py-3 px-4 font-semibold">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {designers.map((designer) => (
                    <tr key={designer.designer_id} className="border-b border-gray-100 hover:bg-purple-50">
                      <td className="py-3 px-4 font-medium">{designer.designer_email}</td>
                      <td className="py-3 px-4">{designer.total_plans}</td>
                      <td className="py-3 px-4">{designer.total_sales}</td>
                      <td className="py-3 px-4 font-bold text-emerald-600">
                        KSH {parseFloat(designer.total_revenue as any).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">KSH {parseFloat(designer.avg_plan_price as any).toLocaleString()}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {new Date(designer.joined_date).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Customer Table */}
        {view === 'customers' && (
          <div className="card">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <ShoppingCart className="w-6 h-6 text-blue-600" />
              Customer Purchase History
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold">Customer</th>
                    <th className="text-left py-3 px-4 font-semibold">Purchases</th>
                    <th className="text-left py-3 px-4 font-semibold">Total Spent</th>
                    <th className="text-left py-3 px-4 font-semibold">Likes</th>
                    <th className="text-left py-3 px-4 font-semibold">Last Purchase</th>
                    <th className="text-left py-3 px-4 font-semibold">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr key={customer.customer_id} className="border-b border-gray-100 hover:bg-blue-50">
                      <td className="py-3 px-4 font-medium">{customer.customer_email}</td>
                      <td className="py-3 px-4">{customer.total_purchases}</td>
                      <td className="py-3 px-4 font-bold text-blue-600">
                        KSH {parseFloat(customer.total_spent as any).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">{customer.plans_liked}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {customer.last_purchase_date ? new Date(customer.last_purchase_date).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {new Date(customer.joined_date).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
