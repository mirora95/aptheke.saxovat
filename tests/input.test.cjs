const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

let server = null;
let Input = null;

before(async () => {
  const { createServer } = await import('vite');
  server = await createServer({
    configFile: false,
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
  });
  ({ Input } = await server.ssrLoadModule('/src/components/UI.tsx'));
});

after(async () => { await server?.close(); });

test('each visible label identifies its own input, even when labels repeat', () => {
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null,
    React.createElement(Input, { label: 'Email', type: 'email' }),
    React.createElement(Input, { label: 'Email', type: 'email', id: undefined }),
  ));
  const labels = [...html.matchAll(/<label[^>]*for="([^"]+)"/g)].map(match => match[1]);
  const inputs = [...html.matchAll(/<input[^>]*id="([^"]+)"/g)].map(match => match[1]);

  assert.equal(labels.length, 2);
  assert.equal(new Set(labels).size, 2);
  assert.deepEqual(labels, inputs);
});

test('a caller-supplied input id remains the label target', () => {
  const html = renderToStaticMarkup(React.createElement(Input, {
    label: 'Delivery Address', id: 'delivery-address', name: 'address', required: true,
  }));

  assert.match(html, /<label[^>]*for="delivery-address"/);
  assert.match(html, /<input[^>]*id="delivery-address"/);
  assert.match(html, /name="address"/);
  assert.match(html, /required=""/);
});

test('unlabelled inputs keep native accessibility and disabled props', () => {
  const html = renderToStaticMarkup(React.createElement(Input, {
    'aria-label': 'Search medicines', disabled: true, defaultValue: 'Example',
  }));

  assert.doesNotMatch(html, /<label/);
  assert.match(html, /aria-label="Search medicines"/);
  assert.match(html, /disabled=""/);
  assert.match(html, /value="Example"/);
});
