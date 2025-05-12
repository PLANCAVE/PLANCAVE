const ProductCard = ({ title, price, id, imageUrl }) => {
    return (
      <div className="bg-white rounded shadow overflow-hidden">
        <img src={imageUrl} alt={title} className="w-full h-48 object-cover" />
        <div className="p-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-gray-600">USD {price.toLocaleString()}</p>
        </div>
      </div>
    );
  };
  
  export default ProductCard;