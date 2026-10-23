const assert = require('node:assert/strict');
const { after, before, beforeEach, test } = require('node:test');

let server = null;
let api = null;
let auth = null;
let unauthorizedEvents = 0;

before(async () => {
  const { createServer } = await import('vite');
  server = await createServer({
    configFile: false,
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
  });
  api = await server.ssrLoadModule('/src/services/apiClient.ts');
  auth = await server.ssrLoadModule('/src/services/authSession.ts');
});

after(async () => { await server?.close(); });

beforeEach((context) => {
  const saved = ['localStorage', 'window'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  const storage = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: key => storage.delete(key),
    },
  });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });
  context.after(() => {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });

  unauthorizedEvents = 0;
  window.addEventListener(api.AUTH_UNAUTHORIZED_EVENT, () => { unauthorizedEvents += 1; });
  auth.writeStoredAuthSession({
    user: {
      id: 'test-user', fullName: 'Test User', phone: '', email: 'test@example.com',
      role: 'CUSTOMER', isActive: true, createdAt: '2026-01-01T00:00:00Z',
    },
    tokens: { accessToken: 'expired-token', refreshToken: 'test-refresh-token', tokenType: 'Bearer' },
  });
});

const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
});

[
  [403, 'FORBIDDEN', 0],
  [409, 'CONFLICT', 0],
  [500, 'UNKNOWN', 0],
  [401, 'UNAUTHORIZED', 1],
].forEach(([status, code, events]) => {
  test(`reports the retried ${status} response and emits ${events} logout events`, async (context) => {
    const responses = [
      json(401, { code: 'UNAUTHORIZED', message: 'Expired token' }),
      json(200, { tokens: { accessToken: 'fresh-token', refreshToken: 'rotated-refresh-token' } }),
      json(status, { code, message: 'Retry failed', traceId: 'retry-trace', fieldErrors: { name: ['Retry detail'] } }),
    ];
    const calls = [];
    context.mock.method(globalThis, 'fetch', (url, options) => {
      calls.push({ url, authorization: options.headers instanceof Headers ? options.headers.get('Authorization') : null });
      assert.ok(responses.length, 'The request must not refresh repeatedly');
      return Promise.resolve(responses.shift());
    });

    await assert.rejects(api.apiClient.get('/medicines'), (error) => {
      assert.ok(error instanceof api.ServiceError);
      assert.equal(error.code, code);
      assert.equal(error.status, status);
      assert.equal(error.message, 'Retry failed');
      assert.equal(error.traceId, 'retry-trace');
      assert.deepEqual(error.fieldErrors, { name: ['Retry detail'] });
      return true;
    });

    assert.equal(unauthorizedEvents, events);
    assert.equal(auth.getStoredAccessToken(), 'fresh-token');
    assert.equal(calls.length, 3);
    assert.equal(new URL(calls[1].url).pathname, '/auth/refresh');
    assert.equal(calls[0].authorization, 'Bearer expired-token');
    assert.equal(calls[2].authorization, 'Bearer fresh-token');
  });
});

test('reports a network failure on the retry without logging out', async (context) => {
  const responses = [
    json(401, { code: 'UNAUTHORIZED', message: 'Expired token' }),
    json(200, { tokens: { accessToken: 'fresh-token' } }),
  ];
  const fetch = context.mock.method(globalThis, 'fetch', () => {
    if (responses.length) return Promise.resolve(responses.shift());
    return Promise.reject(new TypeError('Connection lost'));
  });

  await assert.rejects(api.apiClient.get('/medicines'), (error) => {
    assert.ok(error instanceof api.ServiceError);
    assert.equal(error.code, 'NETWORK');
    assert.equal(error.status, 0);
    assert.equal(error.message, 'Connection lost');
    return true;
  });

  assert.equal(unauthorizedEvents, 0);
  assert.equal(fetch.mock.callCount(), 3);
});

[200, 204].forEach((status) => {
  test(`returns a successful ${status} retry and preserves the request`, async (context) => {
    const responses = [
      json(401, { code: 'UNAUTHORIZED', message: 'Expired token' }),
      json(200, { tokens: { accessToken: 'fresh-token' } }),
      status === 204 ? new Response(null, { status }) : json(status, { saved: true }),
    ];
    const fetch = context.mock.method(globalThis, 'fetch', () => Promise.resolve(responses.shift()));

    const result = await api.apiClient.post('/example', { name: 'test' }, { query: { page: 2 } });

    assert.deepEqual(result, status === 204 ? null : { saved: true });
    assert.equal(unauthorizedEvents, 0);
    assert.equal(fetch.mock.callCount(), 3);
    const [url, options] = fetch.mock.calls[2].arguments;
    assert.equal(new URL(url).search, '?page=2');
    assert.equal(options.method, 'POST');
    assert.equal(options.body, JSON.stringify({ name: 'test' }));
    assert.equal(options.headers.get('Authorization'), 'Bearer fresh-token');
  });
});

test('keeps unauthorized-event suppression for login requests', async (context) => {
  const fetch = context.mock.method(globalThis, 'fetch', () =>
    Promise.resolve(json(401, { code: 'UNAUTHORIZED', message: 'Invalid credentials' })));

  await assert.rejects(api.apiClient.post('/auth/login', {}, { suppressUnauthorizedEvent: true }),
    error => error instanceof api.ServiceError && error.message === 'Invalid credentials');

  assert.equal(unauthorizedEvents, 0);
  assert.equal(fetch.mock.callCount(), 1);
});

test('logs out once when refreshing the token fails', async (context) => {
  const fetch = context.mock.method(globalThis, 'fetch', () =>
    Promise.resolve(json(401, { code: 'UNAUTHORIZED', message: 'Session expired' })));

  await assert.rejects(api.apiClient.get('/medicines'),
    error => error instanceof api.ServiceError && error.status === 401);

  assert.equal(unauthorizedEvents, 1);
  assert.equal(fetch.mock.callCount(), 2);
});

test('does not retry when no refresh token is stored', async (context) => {
  localStorage.removeItem(auth.REFRESH_TOKEN_STORAGE_KEY);
  const fetch = context.mock.method(globalThis, 'fetch', () =>
    Promise.resolve(json(401, { code: 'UNAUTHORIZED', message: 'Session expired' })));

  await assert.rejects(api.apiClient.get('/medicines'),
    error => error instanceof api.ServiceError && error.status === 401);

  assert.equal(unauthorizedEvents, 1);
  assert.equal(fetch.mock.callCount(), 1);
});

test('shares a refresh between concurrent unauthorized requests', async (context) => {
  let completeRefresh = null;
  const pendingRefresh = new Promise(resolve => { completeRefresh = resolve; });
  let refreshCalls = 0;
  const fetch = context.mock.method(globalThis, 'fetch', (url, options) => {
    if (new URL(url).pathname === '/auth/refresh') {
      refreshCalls += 1;
      return pendingRefresh;
    }
    if (options.headers.get('Authorization') === 'Bearer fresh-token') {
      return Promise.resolve(json(200, { saved: true }));
    }
    return Promise.resolve(json(401, { code: 'UNAUTHORIZED', message: 'Expired token' }));
  });

  const requests = [api.apiClient.get('/medicines'), api.apiClient.get('/categories')];
  completeRefresh(json(200, { tokens: { accessToken: 'fresh-token' } }));
  assert.deepEqual(await Promise.all(requests), [{ saved: true }, { saved: true }]);
  assert.equal(refreshCalls, 1);
  assert.equal(fetch.mock.callCount(), 5);
  assert.equal(unauthorizedEvents, 0);
});
