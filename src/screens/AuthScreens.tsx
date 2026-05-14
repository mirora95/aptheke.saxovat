import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getRoleHomePath, useAuth } from '../context/AuthContext';
import { Button, Input, Card } from '../components/UI';
import { LogIn } from 'lucide-react';
import { motion } from 'motion/react';
import { apiClient } from '../services/apiClient';
import { writeStoredAuthSession } from '../services/authSession';
import type { LoginResponse } from '../types';

export const RegisterScreen: React.FC = () => {
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.fullName.trim() || !form.email.trim() || !form.phone.trim() || !form.password.trim()) {
      setError('All fields are required');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post<LoginResponse>('/auth/register', {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
      });
      const session = {
        user: response.session.user,
        tokens: response.session.tokens,
      };
      writeStoredAuthSession(session);
      window.location.reload();
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-blue-600 tracking-tight">Saxovat</h1>
          <p className="text-gray-500 mt-2">Create your account</p>
        </div>
        <Card className="p-8">
          <h2 className="text-xl font-semibold mb-6">Register</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Full Name" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} placeholder="Your full name" required />
            <Input label="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="name@example.com" required />
            <Input label="Phone" type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+998901234567" required />
            <Input label="Password" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="At least 6 characters" required />
            <Input label="Confirm Password" type="password" value={form.confirmPassword} onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))} placeholder="Repeat password" required />
            {error ? <p className="text-sm text-red-500">{error}</p> : null}
            <Button type="submit" className="w-full" isLoading={loading}>Create Account</Button>
          </form>
          <div className="mt-6 border-t border-gray-100 pt-4 text-center">
            <p className="text-sm text-gray-500">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-600 font-medium hover:underline">Sign In</Link>
            </p>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('customer@example.com');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const loggedInSession = await login(email, password);
      navigate(getRoleHomePath(loggedInSession.user.role), { replace: true });
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const applyMockCredentials = (nextEmail: string) => {
    setEmail(nextEmail);
    setPassword('password');
    setError('');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-blue-600 tracking-tight">Saxovat</h1>
          <p className="text-gray-500 mt-2">Your trusted online pharmacy</p>
        </div>

        <Card className="p-8">
          <h2 className="text-xl font-semibold mb-6">Welcome Back</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              required
            />
            {error ? <p className="text-sm text-red-500">{error}</p> : null}
            <Button type="submit" className="w-full" isLoading={loading}>
              <LogIn className="w-4 h-4 mr-2" />
              Sign In
            </Button>
          </form>

          <div className="mt-6 border-t border-gray-100 pt-4 text-center">
            <p className="text-sm text-gray-500">
              Don't have an account?{' '}
              <Link to="/register" className="text-blue-600 font-medium hover:underline">Register here</Link>
            </p>
          </div>
        </Card>

        <div className="mt-8 grid grid-cols-3 gap-2">
          <Button variant="outline" size="sm" onClick={() => applyMockCredentials('customer@example.com')} className="text-[10px]">
            Customer
          </Button>
          <Button variant="outline" size="sm" onClick={() => applyMockCredentials('pharmacist@example.com')} className="text-[10px]">
            Pharmacist
          </Button>
          <Button variant="outline" size="sm" onClick={() => applyMockCredentials('admin@example.com')} className="text-[10px]">
            Admin
          </Button>
        </div>
      </motion.div>
    </div>
  );
};
