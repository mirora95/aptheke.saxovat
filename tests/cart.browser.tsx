import React, { act, StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CartProvider, useCart } from '../src/context/CartContext';
import type { Medicine } from '../src/types';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const medicine = {
  id: 'synthetic-medicine', name: 'Synthetic medicine', price: 100,
  discountPrice: 80, stockQuantity: 2, isActive: true,
} as Medicine;
type Cart = ReturnType<typeof useCart>;
let cart: Cart;
let action: (value: Cart) => string;
const root = createRoot(document.getElementById('root')!);
const results: { name: string; passed: boolean; error?: string }[] = [];

function Probe() {
  cart = useCart();
  const [notice, setNotice] = useState('');
  return <>
    <button onClick={() => setNotice(action(cart))}>Run cart action</button>
    <output>{notice}</output>
  </>;
}

function equal(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

async function click(callback: (value: Cart) => string) {
  let failure: unknown;
  action = value => {
    try { return callback(value); }
    catch (error) { failure = error; return 'Assertion failed'; }
  };
  await act(async () => { document.querySelector('button')!.click(); });
  if (failure) throw failure;
}

async function run(name: string, strict: boolean, check: () => Promise<void>) {
  try {
    await act(async () => { root.render(strict
      ? <StrictMode><CartProvider key={name}><Probe /></CartProvider></StrictMode>
      : <CartProvider key={name}><Probe /></CartProvider>); });
    await check();
    results.push({ name, passed: true });
  } catch (error) {
    results.push({ name, passed: false, error: String(error) });
  }
}

for (const strict of [false, true]) {
  const mode = strict ? 'StrictMode' : 'normal';
  await run(`${mode}: queued adds report the stock-limit failure`, strict, async () => {
    await click(value => {
      equal(value.addItem(medicine, 2).success, true);
      const result = value.addItem(medicine);
      equal(result.success, false);
      return result.message!;
    });
    equal(cart.totalItems, 2);
    equal(cart.subtotal, 160);
    equal(document.querySelector('output')!.textContent, 'You already have the maximum available quantity in your cart.');
  });

  await run(`${mode}: repeated clicks show accurate stock-limit feedback`, strict, async () => {
    await click(value => value.addItem(medicine, 2).success ? 'Added' : 'Rejected');
    await click(value => {
      const result = value.addItem(medicine);
      return result.success ? 'Added' : result.message!;
    });
    equal(cart.totalItems, 2);
    equal(document.querySelector('output')!.textContent, 'You already have the maximum available quantity in your cart.');
  });

  await run(`${mode}: queued quantity updates preserve captured prices`, strict, async () => {
    await click(value => {
      equal(value.addItem(medicine).success, true);
      equal(value.updateQuantity(medicine.id, 2).success, true);
      equal(value.updateQuantity(medicine.id, 3).success, false);
      return 'Updated';
    });
    equal(cart.items.map(item => [item.quantity, item.unitPrice, item.totalPrice]), [[2, 80, 160]]);
    await click(value => {
      equal(value.updateQuantity(medicine.id, 1).success, true);
      equal(value.addItem({ ...medicine, discountPrice: 70 }).success, true);
      return 'Added';
    });
    equal(cart.items.map(item => [item.quantity, item.unitPrice, item.totalPrice]), [[2, 80, 160]]);
  });

  await run(`${mode}: remove and clear are visible to the next queued action`, strict, async () => {
    await click(value => {
      value.addItem(medicine);
      value.removeItem(medicine.id);
      equal(value.updateQuantity(medicine.id, 1).success, false);
      value.addItem(medicine);
      value.clearCart();
      equal(value.updateQuantity(medicine.id, 1).success, false);
      equal(value.addItem({ ...medicine, discountPrice: 0 }).success, true);
      return 'Reset';
    });
    equal(cart.items.map(item => [item.quantity, item.unitPrice, item.totalPrice]), [[1, 0, 0]]);
  });

  await run(`${mode}: unavailable items and zero-quantity removal keep their behavior`, strict, async () => {
    await click(value => {
      equal(value.addItem({ ...medicine, isActive: false }).success, false);
      equal(value.addItem({ ...medicine, stockQuantity: 0 }).success, false);
      equal(value.addItem(medicine, 0).success, false);
      equal(value.addItem(medicine).success, true);
      equal(value.updateQuantity(medicine.id, 0).success, true);
      return 'Removed';
    });
    equal(cart.items, []);
  });
}

await act(async () => { root.unmount(); });
document.getElementById('results')!.textContent = JSON.stringify({
  passed: results.filter(result => result.passed).length,
  failed: results.filter(result => !result.passed).length,
  results,
}, null, 2);
