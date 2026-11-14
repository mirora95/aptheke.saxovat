import React, { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { CartProvider } from '../src/context/CartContext';
import { CustomerCatalogScreen } from '../src/screens/CustomerScreens';
import { categoryService, medicineService } from '../src/services';
import type { Medicine } from '../src/types';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const rootElement = document.getElementById('root');
const resultsElement = document.getElementById('results');
if (!rootElement || !resultsElement) throw new Error('Missing browser test containers');
const root = createRoot(rootElement);
const results: { name: string; passed: boolean; error?: string }[] = [];
const categories = [{ id: 'first', name: 'First category', description: '', isActive: true }, { id: 'second', name: 'Second category', description: '', isActive: true }];
const medicine = (name: string, categoryId = 'second') => ({
  id: name, name, categoryId, price: 10, stockQuantity: 1, isActive: true,
} as Medicine);
const originalCategories = categoryService.getCategories;
const originalSearch = medicineService.searchMedicines;
let requests: { query: string; resolve: (value: Medicine[]) => void; reject: (error: Error) => void }[] = [];
let navigate: ReturnType<typeof useNavigate> | null = null;
const NavigationProbe = () => { navigate = useNavigate(); return null; };
const text = () => rootElement.textContent ?? '';
const expect = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
const settle = async (callback: () => void) => { await act(async () => { callback(); }); };
const move = async (path: string) => { await settle(() => navigate?.(path)); };
const finish = async (query: string, failed = false) => {
  const pending = requests.filter(request => request.query === query);
  expect(pending.length > 0, `No request for ${query}`);
  await settle(() => pending.forEach(request => failed
    ? request.reject(new Error(`${query} request failed`))
    : request.resolve([medicine(`${query} result`, query === 'older' ? 'first' : 'second')])));
};
const run = async (name: string, strict: boolean, check: () => Promise<void>) => {
  try {
    await settle(() => root.render(null));
    requests = [];
    const app = <MemoryRouter initialEntries={['/category/first?q=older']}>
      <NavigationProbe /><CartProvider><Routes>
        <Route path="/category/:id" element={<CustomerCatalogScreen />} />
      </Routes></CartProvider>
    </MemoryRouter>;
    await settle(() => root.render(strict ? <StrictMode>{app}</StrictMode> : app));
    await check();
    results.push({ name, passed: true });
  } catch (error) {
    results.push({ name, passed: false, error: String(error) });
  }
};

try {
  categoryService.getCategories = async () => categories;
  medicineService.searchMedicines = query => new Promise((resolve, reject) => {
    requests.push({ query, resolve, reject });
  });
  for (const strict of [false, true]) {
    const mode = strict ? 'StrictMode' : 'normal';
    await run(`${mode}: late old success cannot replace current results`, strict, async () => {
      await move('/category/second?q=newer');
      await finish('newer');
      expect(text().includes('newer result'), 'Current result missing');
      await finish('older');
      expect(text().includes('newer result') && !text().includes('older result'), 'Old response replaced current result');
      expect(text().includes('Second category'), 'Old categories replaced current selection');
    });
    await run(`${mode}: late old failure cannot replace current results`, strict, async () => {
      await move('/category/second?q=newer');
      await finish('newer');
      await finish('older', true);
      expect(text().includes('newer result') && !text().includes('request failed'), 'Old error replaced current result');
    });
    for (const failed of [false, true]) {
      await run(`${mode}: old ${failed ? 'failure' : 'success'} cannot finish current loading`, strict, async () => {
        await move('/category/second?q=newer');
        await finish('older', failed);
        expect(text().includes('Loading medicines...'), 'Old request cleared current loading state');
        await finish('newer');
        expect(text().includes('newer result'), 'Current request did not finish normally');
      });
    }
    await run(`${mode}: current failures remain visible after old success`, strict, async () => {
      await move('/category/second?q=newer');
      await finish('older');
      await finish('newer', true);
      expect(text().includes('newer request failed') && text().includes('Try Again'), 'Current request failure missing');
    });
    await run(`${mode}: same-query category changes ignore previous category responses`, strict, async () => {
      const oldRequests = [...requests];
      await move('/category/second?q=older');
      const currentRequests = requests.filter(request => !oldRequests.includes(request));
      expect(currentRequests.length > 0, 'Category change did not request data');
      await settle(() => currentRequests.forEach(request => request.resolve([medicine('second category result')])));
      await settle(() => oldRequests.forEach(request => request.resolve([medicine('first category result', 'first')])));
      expect(text().includes('second category result') && !text().includes('first category result'), 'Old category response replaced current filter');
    });
  }
} finally {
  await settle(() => root.unmount());
  categoryService.getCategories = originalCategories;
  medicineService.searchMedicines = originalSearch;
}
resultsElement.textContent = JSON.stringify({
  passed: results.filter(result => result.passed).length,
  failed: results.filter(result => !result.passed).length,
  results,
}, null, 2);
