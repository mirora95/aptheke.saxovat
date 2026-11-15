import React, { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { CartProvider, useCart } from '../src/context/CartContext';
import { CheckoutScreen, CartScreen } from '../src/screens/CustomerScreens';
import { authService, medicineService, orderService } from '../src/services';
import { AUTH_SESSION_STORAGE_KEY, REFRESH_TOKEN_STORAGE_KEY } from '../src/services/authSession';
import { UserRole, type AuthSession, type Medicine, type Order } from '../src/types';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const rootElement = document.getElementById('root');
const resultsElement = document.getElementById('results');
if (!rootElement || !resultsElement) throw new Error('Missing browser test containers');
const root = createRoot(rootElement);
const results: { name: string; passed: boolean; error?: string }[] = [];
const medicine = {
  id: 'synthetic-first', name: 'First synthetic medicine', price: 100,
  stockQuantity: 20, isActive: true, imageUrl: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
} as Medicine;
const secondMedicine = { ...medicine, id: 'synthetic-second', name: 'Second synthetic medicine', price: 50 };
const session: AuthSession = {
  user: { id: 'synthetic-customer', fullName: 'Synthetic customer', email: 'customer@example.test',
    phone: '000', address: 'Synthetic test address', role: UserRole.CUSTOMER, isActive: true, createdAt: '2026-01-01' },
  tokens: { accessToken: 'synthetic-browser-test-token', tokenType: 'Bearer' },
};
const originalRestore = authService.restoreSession;
const originalMedicine = medicineService.getMedicineById;
const originalCreate = orderService.createOrder;
const storedValues = [AUTH_SESSION_STORAGE_KEY, REFRESH_TOKEN_STORAGE_KEY].map(key => [key, localStorage.getItem(key)] as const);
let cart: ReturnType<typeof useCart>;
let requests: { input: Parameters<typeof orderService.createOrder>[0]; resolve: (order: Order) => void; reject: (error: Error) => void }[] = [];
const Probe = () => { cart = useCart(); return null; };
const AuthGate = ({ children }: { children: React.ReactNode }) => useAuth().isLoading ? null : children;
const settle = async (callback: () => void) => { await act(() => Promise.resolve(callback())); };
const expect = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
const equal = (actual: unknown, expected: unknown) => expect(JSON.stringify(actual) === JSON.stringify(expected), `Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
const click = async (label: string) => {
  const target = Array.from(rootElement.querySelectorAll('button')).find(button => button.textContent?.trim() === label);
  if (!target) throw new Error(`Missing ${label} button`);
  await settle(() => target.click());
};
const confirm = async () => {
  equal(requests.length, 1);
  const request = requests[0];
  await settle(() => request.resolve({ ...request.input, id: 'synthetic-order', orderNumber: 'TEST-001' } as Order));
};
const run = async (name: string, strict: boolean, check: () => Promise<void>) => {
  try {
    await settle(() => root.render(null));
    requests = [];
    const routes = <Routes>
      <Route path="/checkout" element={<CheckoutScreen />} />
      <Route path="/cart" element={<CartScreen />} />
    </Routes>;
    const app = <AuthProvider><CartProvider><Probe /><AuthGate>
      <MemoryRouter initialEntries={['/checkout']}>{routes}</MemoryRouter>
    </AuthGate></CartProvider></AuthProvider>;
    await settle(() => root.render(strict ? <StrictMode>{app}</StrictMode> : app));
    await settle(() => { cart.addItem(medicine, 2); });
    await click('Place Order');
    equal(requests.length, 1);
    equal(requests[0].input.orderItems.map(item => [item.medicineId, item.quantity]), [[medicine.id, 2]]);
    await check();
    results.push({ name, passed: true });
  } catch (error) {
    results.push({ name, passed: false, error: String(error) });
  }
};

try {
  authService.restoreSession = () => Promise.resolve(session);
  medicineService.getMedicineById = () => Promise.resolve(medicine);
  orderService.createOrder = input => new Promise((resolve, reject) => { requests.push({ input, resolve, reject }); });
  for (const strict of [false, true]) {
    const mode = strict ? 'StrictMode' : 'normal';
    await run(`${mode}: unchanged submitted cart is emptied on confirmation`, strict, async () => {
      await confirm();
      equal(cart.items, []);
      expect(rootElement.textContent?.includes('Order placed successfully') === true, 'Confirmation missing');
    });
    await run(`${mode}: a new medicine survives returning to cart before confirmation`, strict, async () => {
      await click('Back to Cart');
      await settle(() => { cart.addItem(secondMedicine); });
      await confirm();
      equal(cart.items.map(item => [item.medicineId, item.quantity, item.totalPrice]), [[secondMedicine.id, 1, 50]]);
      equal(cart.subtotal, 50);
      expect(rootElement.textContent?.includes(secondMedicine.name) === true, 'New cart medicine disappeared');
    });
    await run(`${mode}: extra quantity survives and keeps its captured price`, strict, async () => {
      await click('Back to Cart');
      await settle(() => { cart.addItem({ ...medicine, price: 150 }, 3); });
      await confirm();
      equal(cart.items.map(item => [item.quantity, item.unitPrice, item.totalPrice]), [[3, 100, 300]]);
      equal(cart.totalItems, 3);
      equal(cart.subtotal, 300);
    });
    await run(`${mode}: a failed checkout preserves all current items`, strict, async () => {
      await click('Back to Cart');
      await settle(() => { cart.addItem(secondMedicine); });
      await settle(() => requests[0].reject(new Error('Synthetic order failure')));
      equal(cart.items.map(item => [item.medicineId, item.quantity]), [[medicine.id, 2], [secondMedicine.id, 1]]);
    });
    await run(`${mode}: a reduced ordered quantity cannot leave a negative cart item`, strict, async () => {
      await click('Back to Cart');
      await settle(() => { cart.updateQuantity(medicine.id, 1); cart.addItem(secondMedicine); });
      await confirm();
      equal(cart.items.map(item => [item.medicineId, item.quantity]), [[secondMedicine.id, 1]]);
      equal(cart.totalItems, 1);
    });
    await run(`${mode}: an already removed ordered item stays removed`, strict, async () => {
      await click('Back to Cart');
      await settle(() => { cart.removeItem(medicine.id); cart.addItem(secondMedicine); });
      await confirm();
      equal(cart.items.map(item => [item.medicineId, item.quantity]), [[secondMedicine.id, 1]]);
    });
    await run(`${mode}: incomplete confirmation preserves the cart and allows retry`, strict, async () => {
      await settle(() => requests[0].resolve({ ...requests[0].input, id: '', orderNumber: '' } as Order));
      equal(cart.totalItems, 2);
      expect(rootElement.textContent?.includes('Order confirmation data is incomplete.') === true, 'Confirmation error missing');
      const submit = rootElement.querySelector<HTMLButtonElement>('button[type="submit"]');
      expect(submit !== null && !submit.disabled, 'Checkout retry is disabled');
    });
  }
} finally {
  await settle(() => root.unmount());
  authService.restoreSession = originalRestore;
  medicineService.getMedicineById = originalMedicine;
  orderService.createOrder = originalCreate;
  for (const [key, value] of storedValues) {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  }
}
resultsElement.textContent = JSON.stringify({
  passed: results.filter(result => result.passed).length,
  failed: results.filter(result => !result.passed).length,
  results,
}, null, 2);
