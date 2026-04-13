import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRoleHomePath, useAuth } from '../context/AuthContext';
import { Button, Input, Card } from '../components/UI';
import { LogIn } from 'lucide-react';
import { motion } from 'motion/react';

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
              Account registration and password reset are not available in the app yet.
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
