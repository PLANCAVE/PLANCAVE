// components/AccessDenied.js
export default function AccessDenied() {
  return (
    <div className="min-h-screen flex justify-center items-center">
      <div className="bg-white p-6 rounded-lg shadow-md text-center">
        <h1 className="text-xl font-bold text-red-500">Access Denied</h1>
        <p className="text-gray-600">You must be an admin to access this page.</p>
      </div>
    </div>
  );
}