import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAllPlans, deletePlan } from '../../api';
import { FileText, Trash2, Eye } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  category: string;
  price: number;
  status: string;
  designer_id: number;
  sales_count: number;
  created_at: string;
}

export default function PlanManagement() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      const response = await getAllPlans();
      setPlans(response.data.plans || []);
    } catch (error) {
      console.error('Failed to load plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (planId: string, planName: string) => {
    if (!confirm(`Are you sure you want to delete "${planName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deletePlan(planId);
      setPlans(plans.filter(p => p.id !== planId));
      alert('Plan deleted successfully!');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to delete plan');
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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <FileText className="w-8 h-8 text-red-600" />
            Plan Management
          </h1>
          <p className="text-gray-600 mt-2">View and manage all architectural plans on the platform</p>
        </div>

        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Plan Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Category</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Price</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Sales</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Designer ID</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => (
                  <tr key={plan.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">{plan.name}</td>
                    <td className="py-3 px-4">
                      <span className="bg-primary-50 text-primary-700 px-2 py-1 rounded text-sm">
                        {plan.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold">KSH {plan.price.toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          plan.status === 'Available' ? 'bg-green-100 text-green-700' :
                          plan.status === 'Draft' ? 'bg-gray-100 text-gray-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {plan.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">{plan.sales_count}</td>
                    <td className="py-3 px-4 text-gray-600">{plan.designer_id}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/plans/${plan.id}`}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                          title="View plan"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <Link
                          to={`/designer/upload?edit=${plan.id}`}
                          className="px-2 py-1 text-xs font-medium text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded"
                          title="Edit plan"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => handleDelete(plan.id, plan.name)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded"
                          title="Delete plan"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {plans.length === 0 && (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No plans found.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
