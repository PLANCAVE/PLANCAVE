import Link from 'next/link';

const Sidebar = () => {
  return (
    <div className="w-64 bg-white shadow-md h-full p-6">
      <h1 className="text-2xl font-bold mb-6">Admin</h1>
      <nav className="space-y-4">
        <Link href="/admin/dashboard" className="block text-gray-700 hover:text-blue-600">Dashboard</Link>
        <Link href="/admin/products" className="block text-gray-700 hover:text-blue-600">Products</Link>
        <Link href="/admin/orders" className="block text-gray-700 hover:text-blue-600">Orders</Link>
        <Link href="/admin/users" className="block text-gray-700 hover:text-blue-600">Users</Link>
      </nav>
    </div>
  );
};

export default Sidebar;