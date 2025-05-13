// admin/orders/index.js
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';

const OrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await axios.get('/api/admin/orders');
        setOrders(res.data);
      } catch (err) {
        setError('Failed to fetch orders');
        console.error(err);
      }
    };

    fetchOrders();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Order Management</h1>
      {error && <p className="text-red-600">{error}</p>}
      <table className="min-w-full border">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-3 border">Order ID</th>
            <th className="p-3 border">User</th>
            <th className="p-3 border">Total</th>
            <th className="p-3 border">Status</th>
            <th className="p-3 border">Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.map(order => (
            <tr key={order._id} className="border-t">
              <td className="p-3 border">{order._id}</td>
              <td className="p-3 border">{order.user?.email}</td>
              <td className="p-3 border">USD {order.total.toLocaleString()}</td>
              <td className="p-3 border capitalize">{order.status}</td>
              <td className="p-3 border">
                <Link href={`/admin/orders/${order._id}`} className="text-blue-600 hover:underline">
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default OrdersPage;
