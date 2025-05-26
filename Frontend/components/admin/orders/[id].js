// admin/orders/[id].js
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';

const OrderDetail = () => {
  const router = useRouter();
  const { id } = router.query;
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    const fetchOrder = async () => {
      try {
        const res = await axios.get(`/api/admin/orders/${id}`);
        setOrder(res.data);
      } catch (err) {
        setError('Failed to fetch order details');
        console.error(err);
      }
    };
    fetchOrder();
  }, [id]);

  if (error) return <p className="p-6 text-red-600">{error}</p>;
  if (!order) return <p className="p-6">Loading...</p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Order #{order._id}</h1>
      <p><strong>User:</strong> {order.user?.email}</p>
      <p><strong>Status:</strong> {order.status}</p>
      <p><strong>Total:</strong> USD {order.total.toLocaleString()}</p>

      <h2 className="text-xl mt-6 mb-2 font-semibold">Items</h2>
      <ul className="list-disc pl-6">
        {order.items.map((item, idx) => (
          <li key={idx}>
            {item.name} - {item.quantity} × USD {item.price}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default OrderDetail;
