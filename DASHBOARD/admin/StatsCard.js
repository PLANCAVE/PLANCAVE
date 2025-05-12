import { User, ShoppingCart, Package, DollarSign } from 'lucide-react';

const iconMap = {
  users: <User className="text-blue-600" />,
  'shopping-cart': <ShoppingCart className="text-green-600" />,
  package: <Package className="text-orange-600" />,
  'dollar-sign': <DollarSign className="text-yellow-600" />,
};

const StatsCard = ({ title, value, icon }) => {
  return (
    <div className="bg-white p-4 rounded shadow flex items-center space-x-4">
      <div className="text-2xl">{iconMap[icon]}</div>
      <div>
        <div className="text-sm text-gray-500">{title}</div>
        <div className="text-lg font-semibold">{value}</div>
      </div>
    </div>
  );
};

export default StatsCard;
