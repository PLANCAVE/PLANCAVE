import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CustomerDataProvider } from './contexts/CustomerDataContext';
import Header from './components/Header';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import BrowsePlans from './pages/BrowsePlans';
import PlanDetailsPage from './pages/PlanDetailsPage';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Favorites from './pages/Favorites';
import Cart from './pages/Cart';
import Purchases from './pages/Purchases';
import PaystackCallback from './pages/PaystackCallback';
import UserManagement from './pages/admin/UserManagement';
import PlanManagement from './pages/admin/PlanManagement';
import Analytics from './pages/admin/Analytics';
import PurchasesAdmin from './pages/admin/PurchasesAdmin';
import AdminPlanView from './pages/admin/AdminPlanView';
import UploadPlan from './pages/designer/UploadPlan';
import MyPlans from './pages/designer/MyPlans';
import AIAssistantWidget from './components/AIAssistantWidget';

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

function CreatorRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isDesigner, isAdmin } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (!isDesigner && !isAdmin) return <Navigate to="/dashboard" />;
  return <>{children}</>;
}

function AppContent() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <AIAssistantWidget />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/plans" element={<BrowsePlans />} />
          <Route path="/plans/:id" element={<PlanDetailsPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/favorites"
            element={
              <ProtectedRoute>
                <Favorites />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cart"
            element={
              <ProtectedRoute>
                <Cart />
              </ProtectedRoute>
            }
          />
          <Route path="/paystack/callback" element={<PaystackCallback />} />
          <Route
            path="/purchases"
            element={
              <ProtectedRoute>
                <Purchases />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
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
            path="/admin/plans/:id/view"
            element={
              <AdminRoute>
                <AdminPlanView />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/purchases"
            element={
              <AdminRoute>
                <PurchasesAdmin />
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
              <CreatorRoute>
                <UploadPlan />
              </CreatorRoute>
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
      <CustomerDataProvider>
        <AppContent />
      </CustomerDataProvider>
    </AuthProvider>
  );
}

export default App;
