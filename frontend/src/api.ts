import axios, { type InternalAxiosRequestConfig } from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000',
  withCredentials: false,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth
// Note: Backend expects 'username' field, but we're using it for email.
// Always normalize to lowercase so login/registration are case-insensitive.
export const login = (email: string, password: string) =>
  api.post('/login', { username: email.toLowerCase(), password });

export const registerCustomer = (email: string, password: string, firstName?: string, middleName?: string, lastName?: string) =>
  api.post('/register/customer', { username: email.toLowerCase(), password, first_name: firstName, middle_name: middleName, last_name: lastName });

export const registerDesigner = (email: string, password: string, firstName?: string, middleName?: string, lastName?: string) =>
  api.post('/register/designer', { username: email.toLowerCase(), password, first_name: firstName, middle_name: middleName, last_name: lastName });

// Plans
export const browsePlans = (params?: Record<string, any>) =>
  // Use trailing slash to avoid HTTP->HTTPS redirect issues in production
  api.get('/plans/', { params });

export const getPlanDetails = (id: string) =>
  api.get(`/plans/${id}/details`);

// Customer
export const purchasePlan = (plan_id: string, payment_method?: string) =>
  api.post('/customer/plans/purchase', { plan_id, payment_method });

export const getMyPurchases = () =>
  api.get('/customer/purchases');

export const getFavorites = () =>
  api.get('/customer/favorites');

export const addFavorite = (plan_id: string) =>
  api.post('/customer/favorites', { plan_id });

export const removeFavorite = (plan_id: string) =>
  api.delete(`/customer/favorites/${plan_id}`);

export const getCustomerDashboard = () =>
  api.get('/customer/dashboard');

// Designer/Creator
export const getAnalyticsOverview = () =>
  api.get('/creator/analytics/overview');

export const getPlanAnalytics = (plan_id: string, days?: number) =>
  api.get(`/creator/analytics/plans/${plan_id}`, { params: { days } });

export const getRevenueAnalytics = (period?: string) =>
  api.get('/creator/analytics/revenue', { params: { period } });

export const getMyPlans = (params?: Record<string, any>) =>
  api.get('/creator/plans', { params });

// Admin
export const getAdminDashboard = () =>
  api.get('/admin/dashboard');

export const getAllUsers = (params?: Record<string, any>) =>
  api.get('/admin/users', { params });

export const updateUser = (userId: number, data: {role?: string; is_active?: boolean}) =>
  api.put(`/admin/users/${userId}`, data);

export const deleteUser = (userId: number) =>
  api.delete(`/admin/users/${userId}`);

export const getAllPlans = (params?: Record<string, any>) =>
  api.get('/admin/plans', { params });

export const updatePlan = (planId: string, data: any) =>
	// If called with FormData (designer edit with files), send as multipart.
	// Otherwise, default to JSON body for admin updates.
	data instanceof FormData
		? api.put(`/plans/${planId}`, data, { headers: { 'Content-Type': 'multipart/form-data' } })
		: api.put(`/admin/plans/${planId}`, data);

export const deletePlan = (planId: string) =>
  api.delete(`/admin/plans/${planId}`);

// Admin Analytics
export const getDesignerAnalytics = () =>
  api.get('/admin/analytics/designers');

export const getCustomerAnalytics = () =>
  api.get('/admin/analytics/customers');

export const getAdminPlanDetails = (planId: string) =>
  api.get(`/admin/analytics/plan-details/${planId}`);

// Teams
export const createTeam = (name: string, description?: string) =>
  api.post('/teams', { name, description });

export const getMyTeams = () =>
  api.get('/teams');

export const getTeamDetails = (team_id: string) =>
  api.get(`/teams/${team_id}`);

export default api;
