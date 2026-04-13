import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, LogOut, Package, Search, ShoppingCart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { cn } from '../lib/utils';

export const CustomerNavbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { totalItems } = useCart();

  const navItems = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: Search, label: 'Search', path: '/search' },
    { icon: Package, label: 'Orders', path: '/orders' },
  ];

  const isItemActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    if (path === '/search') return location.pathname === '/search' || location.pathname === '/categories' || location.pathname.startsWith('/category/');
    if (path === '/orders') return location.pathname === '/orders' || location.pathname.startsWith('/orders/');
    return location.pathname === path;
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <>
      {/* Desktop Navbar */}
      <nav className="hidden md:flex sticky top-0 z-50 bg-white border-b border-gray-100 h-16 items-center px-6 justify-between">
        <Link to="/" className="text-2xl font-bold text-blue-600 tracking-tight">
          Saxovat<span className="text-emerald-500">.</span>
        </Link>
        <div className="flex items-center space-x-8">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'text-sm font-medium transition-colors hover:text-blue-600',
                isItemActive(item.path) ? 'text-blue-600' : 'text-gray-500'
              )}
            >
              {item.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm font-medium text-gray-500 transition-colors hover:text-red-500"
          >
            Sign Out
          </button>
          <Link to="/cart" className="relative p-2 text-gray-500 hover:text-blue-600">
            <ShoppingCart className="w-6 h-6" />
            {totalItems > 0 && (
              <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                {totalItems}
              </span>
            )}
          </Link>
        </div>
      </nav>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 h-16 flex items-center justify-around px-2 z-50">
        {navItems.map(item => (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              'flex flex-col items-center space-y-1',
              isItemActive(item.path) ? 'text-blue-600' : 'text-gray-400'
            )}
          >
            <item.icon className="w-6 h-6" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        ))}
        <Link
          to="/cart"
          className={cn(
            'flex flex-col items-center space-y-1 relative',
            location.pathname === '/cart' || location.pathname === '/checkout' ? 'text-blue-600' : 'text-gray-400'
          )}
        >
          <ShoppingCart className="w-6 h-6" />
          <span className="text-[10px] font-medium">Cart</span>
          {totalItems > 0 && (
            <span className="absolute -top-1 right-0 bg-red-500 text-white text-[8px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
              {totalItems}
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="flex flex-col items-center space-y-1 text-gray-400"
        >
          <LogOut className="w-6 h-6" />
          <span className="text-[10px] font-medium">Logout</span>
        </button>
      </nav>
    </>
  );
};
