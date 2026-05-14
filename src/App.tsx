import React from 'react';
import { Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { useAuth, AuthProvider, getRoleHomePath } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { UserRole } from './types';

// Screens
import { LoginScreen, RegisterScreen } from './screens/AuthScreens';
import {
  CartScreen,
  CheckoutScreen,
  CustomerCatalogScreen,
  CustomerCategoriesScreen,
  CustomerHome,
  MedicineDetails,
  OrderDetailsScreen,
  OrderHistoryScreen,
} from './screens/CustomerScreens';
import {
  PharmacistAddMedicineScreen,
  PharmacistDashboard,
  PharmacistEditMedicineScreen,
  PharmacistMedicinesScreen,
  PharmacistOrderDetailsScreen,
  PharmacistOrdersScreen,
} from './screens/PharmacistScreens';
import { AuditLogsScreen } from './screens/AuditLogsScreen';
import {
  AdminDashboard,
  AdminReportsScreen,
  AdminSettingsScreen,
  CategoryManagementScreen,
  MedicineOversightScreen,
  PharmacistManagementScreen,
  UserManagementScreen,
} from './screens/AdminScreens';

// Components
import { CustomerNavbar } from './components/Navigation';
import { Button } from './components/UI';
import { BarChart3, FolderTree, History, LogOut, LayoutDashboard, Package, Settings, ShieldCheck, ShoppingBag, Users } from 'lucide-react';

const AppLoadingScreen: React.FC = () => (
  <div className="h-screen flex items-center justify-center bg-gray-50">
    <div className="text-sm font-medium text-gray-500">Loading...</div>
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: UserRole[] }> = ({ children, allowedRoles }) => {
  const { isAuthenticated, role, isLoading } = useAuth();

  if (isLoading) return <AppLoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (allowedRoles && role && !allowedRoles.includes(role)) return <Navigate to={getRoleHomePath(role)} replace />;

  return <>{children}</>;
};

const CustomerLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-gray-50">
    <CustomerNavbar />
    <main className="max-w-7xl mx-auto">{children}</main>
  </div>
);

const RoutePlaceholder: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <div className="p-6 lg:p-8">
    <div className="max-w-2xl rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Coming Soon</p>
      <h1 className="mt-3 text-2xl font-bold text-gray-900">{title}</h1>
      <p className="mt-3 text-sm leading-6 text-gray-500">{description}</p>
    </div>
  </div>
);

const AdminLayout: React.FC<{ children: React.ReactNode; title: string }> = ({ children, title }) => {
  const { logout, role } = useAuth();
  const navigate = useNavigate();
  const isPharmacist = role === UserRole.PHARMACIST;

  const menuItems = isPharmacist
    ? [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
        { icon: Package, label: 'Medicines', path: '/pharmacist/medicines' },
        { icon: ShoppingBag, label: 'Orders', path: '/pharmacist/orders' },
      ]
    : [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
        { icon: ShieldCheck, label: 'Pharmacists', path: '/admin/pharmacists' },
        { icon: Users, label: 'Users', path: '/admin/users' },
        { icon: FolderTree, label: 'Categories', path: '/admin/categories' },
        { icon: Package, label: 'Medicines', path: '/admin/medicines' },
        { icon: History, label: 'Audit Logs', path: '/admin/audit-logs' },
        { icon: BarChart3, label: 'Reports', path: '/admin/reports' },
        { icon: Settings, label: 'Settings', path: '/admin/settings' },
      ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-100 hidden lg:flex flex-col sticky top-0 h-screen">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-blue-600 tracking-tight">Saxovat Admin</h1>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          {menuItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className="flex items-center space-x-3 px-4 py-3 text-gray-600 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-colors font-medium"
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-100">
          <Button
            variant="ghost"
            className="w-full justify-start text-red-500 hover:bg-red-50 hover:text-red-600"
            onClick={() => {
              logout();
              navigate('/login', { replace: true });
            }}
          >
            <LogOut size={20} className="mr-3" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 lg:px-8 sticky top-0 z-40">
          <h2 className="text-lg font-bold text-gray-800">{title}</h2>
          <div className="flex items-center space-x-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-gray-800">Admin User</p>
              <p className="text-xs text-gray-500 capitalize">{role?.toLowerCase()}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
              A
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { role, isAuthenticated, isLoading } = useAuth();
  const roleHomePath = getRoleHomePath(role);

  if (isLoading) {
    return <AppLoadingScreen />;
  }

  return (
    <Routes>
      <Route path="/register" element={isAuthenticated ? <Navigate to={roleHomePath} replace /> : <RegisterScreen />} />
      <Route path="/login" element={isAuthenticated ? <Navigate to={roleHomePath} replace /> : <LoginScreen />} />

      {/* Customer Routes */}
      {role === UserRole.CUSTOMER && (
        <Route
          path="/*"
          element={
            <ProtectedRoute allowedRoles={[UserRole.CUSTOMER]}>
              <CustomerLayout>
                <Routes>
                  <Route path="/" element={<CustomerHome />} />
                  <Route path="/search" element={<CustomerCatalogScreen />} />
                  <Route path="/categories" element={<CustomerCategoriesScreen />} />
                  <Route path="/category/:id" element={<CustomerCategoriesScreen />} />
                  <Route path="/medicine/:id" element={<MedicineDetails />} />
                  <Route path="/cart" element={<CartScreen />} />
                  <Route path="/checkout" element={<CheckoutScreen />} />
                  <Route path="/orders" element={<OrderHistoryScreen />} />
                  <Route path="/orders/:id" element={<OrderDetailsScreen />} />
                  <Route path="/profile" element={<Navigate to="/orders" replace />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </CustomerLayout>
            </ProtectedRoute>
          }
        />
      )}

      {/* Pharmacist Routes */}
      {role === UserRole.PHARMACIST && (
        <Route
          path="/*"
          element={
            <ProtectedRoute allowedRoles={[UserRole.PHARMACIST]}>
              <AdminLayout title="Pharmacist Panel">
                <Routes>
                  <Route path="/" element={<PharmacistDashboard />} />
                  <Route path="/pharmacist/medicines" element={<PharmacistMedicinesScreen />} />
                  <Route path="/pharmacist/medicines/add" element={<PharmacistAddMedicineScreen />} />
                  <Route path="/pharmacist/medicines/:id/edit" element={<PharmacistEditMedicineScreen />} />
                  <Route path="/pharmacist/orders" element={<PharmacistOrdersScreen />} />
                  <Route path="/pharmacist/orders/:id" element={<PharmacistOrderDetailsScreen />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </AdminLayout>
            </ProtectedRoute>
          }
        />
      )}

      {/* SuperAdmin Routes */}
      {role === UserRole.SUPERADMIN && (
        <Route
          path="/*"
          element={
            <ProtectedRoute allowedRoles={[UserRole.SUPERADMIN]}>
              <AdminLayout title="System Administration">
                <Routes>
                  <Route path="/" element={<AdminDashboard />} />
                  <Route path="/admin/pharmacists" element={<PharmacistManagementScreen />} />
                  <Route path="/admin/users" element={<UserManagementScreen />} />
                  <Route path="/admin/categories" element={<CategoryManagementScreen />} />
                  <Route path="/admin/medicines" element={<MedicineOversightScreen />} />
                  <Route path="/admin/audit-logs" element={<AuditLogsScreen />} />
                  <Route path="/admin/reports" element={<AdminReportsScreen />} />
                  <Route path="/admin/settings" element={<AdminSettingsScreen />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </AdminLayout>
            </ProtectedRoute>
          }
        />
      )}

      {/* Default Fallback */}
      <Route path="*" element={<Navigate to={isAuthenticated ? roleHomePath : '/login'} replace />} />
    </Routes>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <AppContent />
      </CartProvider>
    </AuthProvider>
  );
}
