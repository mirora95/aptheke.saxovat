import React, { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { OrderDetailsScreen } from '../src/screens/CustomerScreens';
import { authService, orderService } from '../src/services';
import { AUTH_SESSION_STORAGE_KEY, REFRESH_TOKEN_STORAGE_KEY } from '../src/services/authSession';
import { OrderStatus, PaymentStatus, UserRole, type AuthSession, type Order } from '../src/types';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const rootElement = document.getElementById('root');
const resultsElement = document.getElementById('results');
if (!rootElement || !resultsElement) throw new Error('Missing browser test containers');
const root = createRoot(rootElement);
const results: { name: string; passed: boolean; error?: string }[] = [];
const session: AuthSession = {
  user: { id: 'synthetic-customer', fullName: 'Synthetic customer', email: 'customer@example.test',
    phone: '000', role: UserRole.CUSTOMER, isActive: true, createdAt: '2026-01-01' },
  tokens: { accessToken: 'synthetic-browser-test-token', tokenType: 'Bearer' },
};
const order = (id: string, customerId = session.user.id): Order => ({
  id, customerId, orderNumber: `TEST-${id}`, orderStatus: OrderStatus.PENDING,
  paymentStatus: PaymentStatus.UNPAID, paymentMethod: 'Cash', deliveryType: 'Pickup',
  orderItems: [], subtotal: 10, deliveryFee: 0, discountAmount: 0, totalAmount: 10,
  createdAt: '2026-01-01', updatedAt: '2026-01-01',
});
const originalRestore = authService.restoreSession;
const originalGet = orderService.getOrderById;
const storedValues = [AUTH_SESSION_STORAGE_KEY, REFRESH_TOKEN_STORAGE_KEY].map(key => [key, localStorage.getItem(key)] as const);
let requests: { id: string; resolve: (value: Order | undefined) => void; reject: (error: Error) => void }[] = [];
let navigate: ReturnType<typeof useNavigate>;
const NavigationProbe = () => { navigate = useNavigate(); return null; };
const AuthGate = ({ children }: { children: React.ReactNode }) => useAuth().isLoading ? null : children;
const text = () => rootElement.textContent ?? '';
const expect = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
const settle = async (callback: () => void) => { await act(() => Promise.resolve(callback())); };
const move = async (id: string) => { await settle(() => navigate(`/orders/${id}`)); };
const finish = async (id: string, outcome: 'success' | 'failure' | 'missing' | 'foreign' = 'success') => {
  const pending = requests.filter(request => request.id === id);
  expect(pending.length > 0, `No request for ${id}`);
  await settle(() => pending.forEach(request => outcome === 'failure'
    ? request.reject(new Error(`${id} request failed`))
    : request.resolve(outcome === 'missing' ? undefined : order(id, outcome === 'foreign' ? 'another-synthetic-customer' : session.user.id))));
};
const run = async (name: string, strict: boolean, check: () => Promise<void>) => {
  try {
    await settle(() => root.render(null));
    requests = [];
    const routes = <Routes><Route path="/orders/:id" element={<OrderDetailsScreen />} /></Routes>;
    const app = <AuthProvider><AuthGate><MemoryRouter initialEntries={['/orders/older']}>
      <NavigationProbe />{routes}
    </MemoryRouter></AuthGate></AuthProvider>;
    await settle(() => root.render(strict ? <StrictMode>{app}</StrictMode> : app));
    expect(text().includes('Loading order...'), 'Initial loading state missing');
    await check();
    results.push({ name, passed: true });
  } catch (error) {
    results.push({ name, passed: false, error: String(error) });
  }
};

try {
  authService.restoreSession = () => Promise.resolve(session);
  orderService.getOrderById = id => new Promise((resolve, reject) => { requests.push({ id, resolve, reject }); });
  for (const strict of [false, true]) {
    const mode = strict ? 'StrictMode' : 'normal';
    for (const outcome of ['success', 'failure'] as const) {
      await run(`${mode}: late old ${outcome} cannot replace current order`, strict, async () => {
        await move('newer');
        await finish('newer');
        expect(text().includes('TEST-newer'), 'Current order missing');
        await finish('older', outcome);
        expect(text().includes('TEST-newer') && !text().includes('TEST-older') && !text().includes('request failed'), 'Old request replaced current order');
      });
      await run(`${mode}: old ${outcome} cannot finish current loading`, strict, async () => {
        await move('newer');
        await finish('older', outcome);
        expect(text().includes('Loading order...'), 'Old request cleared current loading');
        await finish('newer');
        expect(text().includes('TEST-newer'), 'Current request did not finish normally');
      });
    }
    await run(`${mode}: changing a loaded order hides old details while loading`, strict, async () => {
      await finish('older');
      expect(text().includes('TEST-older'), 'Initial order missing');
      await move('newer');
      expect(text().includes('Loading order...') && !text().includes('TEST-older'), 'Previous order remains visible at new route');
      await finish('newer');
      expect(text().includes('TEST-newer'), 'New order missing');
    });
    await run(`${mode}: current failure survives a late old success`, strict, async () => {
      await move('newer');
      await finish('newer', 'failure');
      await finish('older');
      expect(text().includes('newer request failed') && !text().includes('TEST-older'), 'Old response changed current error');
    });
    await run(`${mode}: missing current order survives a late old success`, strict, async () => {
      await move('newer');
      await finish('newer', 'missing');
      await finish('older');
      expect(text().includes('Order not found') && !text().includes('TEST-older'), 'Old response replaced current not-found state');
    });
    await run(`${mode}: another customer's order stays hidden`, strict, async () => {
      await finish('older', 'foreign');
      expect(text().includes('Order not found') && !text().includes('TEST-older'), 'Foreign order details became visible');
    });
    await run(`${mode}: navigation recovers from a current failure`, strict, async () => {
      await finish('older', 'failure');
      expect(text().includes('older request failed'), 'Initial error missing');
      await move('newer');
      expect(text().includes('Loading order...') && !text().includes('request failed'), 'Error was not reset for new route');
      await finish('newer');
      expect(text().includes('TEST-newer'), 'Recovery order missing');
    });
  }
} finally {
  await settle(() => root.unmount());
  authService.restoreSession = originalRestore;
  orderService.getOrderById = originalGet;
  storedValues.forEach(([key, value]) => value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value));
}
resultsElement.textContent = JSON.stringify({ passed: results.filter(result => result.passed).length,
  failed: results.filter(result => !result.passed).length, results }, null, 2);
