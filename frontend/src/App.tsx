import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Header from './components/Header';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import BrowsePlans from './pages/BrowsePlans';
import Dashboard from './pages/Dashboard';
import UserManagement from './pages/admin/UserManagement';
import PlanManagement from './pages/admin/PlanManagement';
import Analytics from './pages/admin/Analytics';
import UploadPlan from './pages/designer/UploadPlan';
import MyPlans from './pages/designer/MyPlans';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (!isAdmin) return <Navigate to="/dashboard" />;
  return <>{children}</>;
}

function DesignerRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isDesigner } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (!isDesigner) return <Navigate to="/dashboard" />;
  return <>{children}</>;
}

function AppContent() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/plans" element={<BrowsePlans />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          {/* Admin Routes */}
          <Route
            path="/admin/users"
            element={
              <AdminRoute>
                <UserManagement />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/plans"
            element={
              <AdminRoute>
                <PlanManagement />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/analytics"
            element={
              <AdminRoute>
                <Analytics />
              </AdminRoute>
            }
          />
          {/* Designer Routes */}
          <Route
            path="/designer/upload"
            element={
              <DesignerRoute>
                <UploadPlan />
              </DesignerRoute>
            }
          />
          <Route
            path="/designer/my-plans"
            element={
              <DesignerRoute>
                <MyPlans />
              </DesignerRoute>
            }
          />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
