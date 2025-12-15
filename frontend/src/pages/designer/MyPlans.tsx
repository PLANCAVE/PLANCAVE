import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyPlans } from '../../api';
import { FileText, Upload, Eye, DollarSign } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  category: string;
  price: number;
  status: string;
  sales_count: number;
  views: number;
  created_at: string;
}

export default function MyPlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadMyPlans();
  }, []);

  const loadMyPlans = async () => {
    try {
      const response = await getMyPlans();
      setPlans(response.data.plans || []);
    } catch (error) {
      console.error('Failed to load plans:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <FileText className="w-8 h-8 text-purple-600" />
              My Plans
            </h1>
            <p className="text-gray-600 mt-2">Manage your uploaded architectural plans</p>
          </div>
          <button
            onClick={() => navigate('/designer/upload')}
            className="btn-primary flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Upload New Plan
          </button>
        </div>

        {plans.length === 0 ? (
          <div className="card text-center py-12">
            <FileText className="w-16 h-16 text-purple-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">No plans yet</h3>
            <p className="text-gray-600 mb-6">Start uploading your architectural plans to sell</p>
            <button
              onClick={() => navigate('/designer/upload')}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Upload Your First Plan
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div key={plan.id} className="card hover:shadow-lg transition-shadow">
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-sm">
                    {plan.category}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Price:</span>
                    <span className="font-semibold">$ {plan.price.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      Views:
                    </span>
                    <span className="font-semibold">{plan.views || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      Sales:
                    </span>
                    <span className="font-semibold">{plan.sales_count || 0}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200 flex items-center justify-between gap-2">
                  <div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        plan.status === 'Available' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {plan.status}
                    </span>
                    <span className="text-xs text-gray-500 ml-2">
                      {new Date(plan.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <button
                    onClick={() => navigate(`/designer/upload?edit=${plan.id}`)}
                    className="text-xs font-medium text-purple-600 hover:text-purple-800 hover:underline"
                  >
                    Edit plan
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
