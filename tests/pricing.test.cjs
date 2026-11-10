const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');

let server = null;
let pricing = null;

before(async () => {
  const { createServer } = await import('vite');
  server = await createServer({
    configFile: false,
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
  });
  pricing = await server.ssrLoadModule('/src/lib/utils.ts');
});

after(async () => { await server?.close(); });

[
  ['no discount', { price: 100 }, 100],
  ['undefined discount', { price: 100, discountPrice: undefined }, 100],
  ['API null discount', { price: 100, discountPrice: null }, 100],
  ['discounted item', { price: 100, discountPrice: 80 }, 80],
  ['free discounted item', { price: 100, discountPrice: 0 }, 0],
  ['equal regular and discount prices', { price: 100, discountPrice: 100 }, 100],
  ['zero regular price', { price: 0 }, 0],
  ['fractional price', { price: 100, discountPrice: 80.25 }, 80.25],
].forEach(([name, medicine, expected]) => {
  test(`uses the server's effective price for ${name}`, () => {
    assert.equal(pricing.getMedicinePrice(medicine), expected);
  });
});
