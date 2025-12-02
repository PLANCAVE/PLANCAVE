import { useState, useEffect } from 'react';
import { getAllUsers, updateUser, deleteUser } from '../../api';
import { Users, Edit, Trash2, Check, X } from 'lucide-react';

interface User {
  id: number;
  username: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  role: string;
  created_at: string;
  is_active: boolean;
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editRole, setEditRole] = useState('');
  const [editModalUser, setEditModalUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    username: '',
    role: '',
    is_active: true
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await getAllUsers();
      setUsers(response.data.users || []);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (user: User) => {
    setEditModalUser(user);
    setEditForm({
      first_name: user.first_name || '',
      middle_name: user.middle_name || '',
      last_name: user.last_name || '',
      username: user.username,
      role: user.role,
      is_active: user.is_active
    });
  };

  const handleUpdateUser = async () => {
    if (!editModalUser) return;
    
    try {
      await updateUser(editModalUser.id, editForm);
      setUsers(users.map(u => u.id === editModalUser.id ? { ...u, ...editForm } : u));
      setEditModalUser(null);
      alert('User updated successfully!');
      loadUsers(); // Reload to get fresh data
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to update user');
    }
  };

  const handleUpdateRole = async (userId: number, role: string) => {
    try {
      await updateUser(userId, { role });
      setUsers(users.map(u => u.id === userId ? { ...u, role } : u));
      setEditingId(null);
      alert('User role updated successfully!');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to update user');
    }
  };

  const handleToggleActive = async (userId: number, isActive: boolean) => {
    try {
      await updateUser(userId, { is_active: !isActive });
      setUsers(users.map(u => u.id === userId ? { ...u, is_active: !isActive } : u));
      alert(`User ${!isActive ? 'activated' : 'deactivated'} successfully!`);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to update user');
    }
  };

  const handleDelete = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteUser(userId);
      setUsers(users.filter(u => u.id !== userId));
      alert('User deleted successfully!');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to delete user');
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
            <Users className="w-8 h-8 text-red-600" />
            User Management
          </h1>
          <p className="text-gray-600 mt-2">Manage all platform users - view, edit roles, and delete users</p>
        </div>

        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">ID</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Email</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Role</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Joined</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">{user.id}</td>
                    <td className="py-3 px-4 font-medium">{user.username}</td>
                    <td className="py-3 px-4">
                      {editingId === user.id ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value)}
                            className="input-field py-1 px-2 text-sm"
                          >
                            <option value="customer">Customer</option>
                            <option value="designer">Designer</option>
                            <option value="admin">Admin</option>
                          </select>
                          <button
                            onClick={() => handleUpdateRole(user.id, editRole)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            user.role === 'admin' ? 'bg-red-100 text-red-700' :
                            user.role === 'designer' ? 'bg-purple-100 text-purple-700' :
                            'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {user.role.toUpperCase()}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleToggleActive(user.id, user.is_active)}
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          user.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {user.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(user)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                          title="Edit user details"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded"
                          title="Delete user"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Edit User Modal */}
        {editModalUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-2xl">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Edit className="w-6 h-6" />
                  Edit User Details
                </h2>
                <p className="text-blue-100 mt-1">User ID: {editModalUser.id}</p>
              </div>

              <div className="p-6 space-y-6">
                {/* Name Fields */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={editForm.first_name}
                      onChange={(e) => setEditForm({...editForm, first_name: e.target.value})}
                      className="input-field w-full"
                      placeholder="First name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Middle Name
                    </label>
                    <input
                      type="text"
                      value={editForm.middle_name}
                      onChange={(e) => setEditForm({...editForm, middle_name: e.target.value})}
                      className="input-field w-full"
                      placeholder="Middle name (optional)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={editForm.last_name}
                      onChange={(e) => setEditForm({...editForm, last_name: e.target.value})}
                      className="input-field w-full"
                      placeholder="Last name"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={editForm.username}
                    onChange={(e) => setEditForm({...editForm, username: e.target.value})}
                    className="input-field w-full"
                    placeholder="email@example.com"
                  />
                </div>

                {/* Role */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    User Role
                  </label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({...editForm, role: e.target.value})}
                    className="input-field w-full"
                  >
                    <option value="customer">Customer</option>
                    <option value="designer">Designer</option>
                    <option value="admin">Admin</option>
                  </select>
                  <p className="text-sm text-gray-500 mt-1">
                    {editForm.role === 'admin' && '🛡️ Full platform access'}
                    {editForm.role === 'designer' && '🎨 Can upload and sell plans'}
                    {editForm.role === 'customer' && '🛍️ Can browse and purchase plans'}
                  </p>
                </div>

                {/* Active Status */}
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.is_active}
                      onChange={(e) => setEditForm({...editForm, is_active: e.target.checked})}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Account Active
                    </span>
                  </label>
                  <p className="text-sm text-gray-500 mt-1 ml-6">
                    {editForm.is_active ? '✅ User can log in and use the platform' : '❌ User account is deactivated'}
                  </p>
                </div>

                {/* Account Info */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-700 mb-2">Account Information</h3>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p><span className="font-medium">Created:</span> {new Date(editModalUser.created_at).toLocaleString()}</p>
                    <p><span className="font-medium">Current Email:</span> {editModalUser.username}</p>
                    <p><span className="font-medium">Current Role:</span> {editModalUser.role}</p>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="sticky bottom-0 bg-gray-50 p-6 rounded-b-2xl flex gap-3 border-t">
                <button
                  onClick={handleUpdateUser}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-lg hover:shadow-lg transition-all font-semibold"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => setEditModalUser(null)}
                  className="flex-1 bg-white text-gray-700 px-6 py-3 rounded-lg border-2 border-gray-300 hover:bg-gray-50 transition-all font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
