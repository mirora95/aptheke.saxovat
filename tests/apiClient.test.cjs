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

[undefined, ''].forEach(refreshToken => {
  test(`does not refresh with the previous session's token when the new token is ${String(refreshToken)}`, async (context) => {
    const session = auth.readStoredAuthSession();
    auth.writeStoredAuthSession({
      ...session,
      user: { ...session.user, id: 'another-user' },
      tokens: { accessToken: 'new-session-token', tokenType: 'Bearer', refreshToken },
    });
    const fetch = context.mock.method(globalThis, 'fetch', () => Promise.resolve(
      json(401, { code: 'UNAUTHORIZED', message: 'Session expired' }),
    ));

    await assert.rejects(api.apiClient.get('/medicines'), { code: 'UNAUTHORIZED', status: 401 });

    assert.equal(auth.getStoredRefreshToken(), null);
    assert.equal(auth.getStoredAccessToken(), 'new-session-token');
    assert.equal(fetch.mock.callCount(), 1);
    assert.equal(unauthorizedEvents, 1);
  });
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
    assert.equal(auth.getStoredRefreshToken(), 'rotated-refresh-token');
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

[
  null,
  {},
  { tokens: null },
  { tokens: {} },
  { tokens: { accessToken: null, refreshToken: 'rotated-refresh-token' } },
  { tokens: { accessToken: 42, refreshToken: 'rotated-refresh-token' } },
  { tokens: { accessToken: '', refreshToken: 'rotated-refresh-token' } },
  { tokens: { accessToken: ' \t\n', refreshToken: 'rotated-refresh-token' } },
].forEach((payload) => {
  test(`rejects an unusable refresh response without changing stored tokens: ${JSON.stringify(payload)}`, async (context) => {
    const storedSession = localStorage.getItem(auth.AUTH_SESSION_STORAGE_KEY);
    const refreshToken = auth.getStoredRefreshToken();
    const fetch = context.mock.method(globalThis, 'fetch', (url) => Promise.resolve(
      new URL(url).pathname === '/auth/refresh'
        ? json(200, payload)
        : json(401, { code: 'UNAUTHORIZED', message: 'Expired token' }),
    ));

    await assert.rejects(api.apiClient.get('/medicines'),
      error => error instanceof api.ServiceError && error.status === 401 && error.message === 'Expired token');

    assert.equal(fetch.mock.callCount(), 2);
    assert.equal(localStorage.getItem(auth.AUTH_SESSION_STORAGE_KEY), storedSession);
    assert.equal(auth.getStoredRefreshToken(), refreshToken);
    assert.equal(unauthorizedEvents, 1);
  });
});

test('stores a valid rotated token response and preserves the user', async (context) => {
  const session = auth.readStoredAuthSession();
  const tokens = {
    accessToken: 'fresh-token', refreshToken: 'rotated-refresh-token',
    tokenType: 'Bearer', expiresAt: '2026-11-06T12:00:00Z',
  };
  const responses = [
    json(401, { code: 'UNAUTHORIZED', message: 'Expired token' }),
    json(200, { tokens }),
    json(200, { saved: true }),
  ];
  const fetch = context.mock.method(globalThis, 'fetch', () => Promise.resolve(responses.shift()));

  assert.deepEqual(await api.apiClient.get('/medicines'), { saved: true });

  assert.deepEqual(auth.readStoredAuthSession(), { ...session, tokens });
  assert.equal(auth.getStoredRefreshToken(), tokens.refreshToken);
  assert.equal(fetch.mock.calls[2].arguments[1].headers.get('Authorization'), 'Bearer fresh-token');
  assert.equal(fetch.mock.callCount(), 3);
  assert.equal(unauthorizedEvents, 0);
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


[undefined, null, new FormData()].forEach((body) => {
  test(`sends a non-JSON body without setting a JSON content type: ${String(body)}`, async (context) => {
    const fetch = context.mock.method(globalThis, 'fetch', () =>
      Promise.resolve(new Response(null, { status: 204 })));

    assert.equal(await api.apiClient.post('/example', body), null);
    const options = fetch.mock.calls[0].arguments[1];
    assert.equal(options.body, body);
    assert.equal(options.headers.get('Content-Type'), null);
    assert.equal(options.headers.get('Accept'), 'application/json');
    assert.equal(options.headers.get('Authorization'), 'Bearer expired-token');
  });
});

['', '{invalid'].forEach((body) => {
  [
    [400, 'VALIDATION'],
    [401, 'UNAUTHORIZED'],
    [403, 'FORBIDDEN'],
    [500, 'UNKNOWN'],
  ].forEach(([status, code]) => {
    test(`preserves HTTP ${status} when its JSON error body is ${JSON.stringify(body)}`, async (context) => {
      localStorage.removeItem(auth.REFRESH_TOKEN_STORAGE_KEY);
      const fetch = context.mock.method(globalThis, 'fetch', () => Promise.resolve(new Response(body, {
        status, statusText: 'Request denied', headers: { 'Content-Type': 'application/json' },
      })));

      await assert.rejects(api.apiClient.get('/medicines'), (error) => {
        assert.ok(error instanceof api.ServiceError);
        assert.equal(error.code, code);
        assert.equal(error.status, status);
        assert.equal(error.message, 'Request denied');
        return true;
      });

      assert.equal(fetch.mock.callCount(), 1);
      assert.equal(unauthorizedEvents, status === 401 ? 1 : 0);
    });
  });

  test(`refreshes and retries a 401 with JSON body ${JSON.stringify(body)}`, async (context) => {
    const responses = [
      new Response(body, { status: 401, headers: { 'Content-Type': 'application/json' } }),
      json(200, { tokens: { accessToken: 'fresh-token' } }),
      json(200, { saved: true }),
    ];
    const fetch = context.mock.method(globalThis, 'fetch', () => Promise.resolve(responses.shift()));

    assert.deepEqual(await api.apiClient.get('/medicines'), { saved: true });

    assert.equal(fetch.mock.callCount(), 3);
    assert.equal(new URL(fetch.mock.calls[1].arguments[0]).pathname, '/auth/refresh');
    assert.equal(fetch.mock.calls[2].arguments[1].headers.get('Authorization'), 'Bearer fresh-token');
    assert.equal(unauthorizedEvents, 0);
  });
});

test('reports a malformed JSON 401 retry and logs out once', async (context) => {
  const responses = [
    json(401, { code: 'UNAUTHORIZED', message: 'Expired token' }),
    json(200, { tokens: { accessToken: 'fresh-token' } }),
    new Response('{invalid', { status: 401, headers: { 'Content-Type': 'application/json' } }),
  ];
  const fetch = context.mock.method(globalThis, 'fetch', () => Promise.resolve(responses.shift()));

  await assert.rejects(api.apiClient.get('/medicines'),
    error => error instanceof api.ServiceError && error.status === 401 && error.code === 'UNAUTHORIZED');

  assert.equal(fetch.mock.callCount(), 3);
  assert.equal(unauthorizedEvents, 1);
});

test('keeps login logout-event suppression when the JSON error body is malformed', async (context) => {
  const fetch = context.mock.method(globalThis, 'fetch', () => Promise.resolve(new Response('{invalid', {
    status: 401, headers: { 'Content-Type': 'application/json' },
  })));

  await assert.rejects(api.apiClient.post('/auth/login', {}, { suppressUnauthorizedEvent: true }),
    error => error instanceof api.ServiceError && error.status === 401);

  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(unauthorizedEvents, 0);
});

test('rejects malformed JSON in a successful response', async (context) => {
  context.mock.method(globalThis, 'fetch', () => Promise.resolve(new Response('{invalid', {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })));

  await assert.rejects(api.apiClient.get('/medicines'), SyntaxError);

  assert.equal(unauthorizedEvents, 0);
});

test('propagates error-body stream failures without refreshing', async (context) => {
  const failure = new TypeError('Response stream failed');
  const body = new ReadableStream({ start(controller) { controller.error(failure); } });
  const fetch = context.mock.method(globalThis, 'fetch', () => Promise.resolve(new Response(body, {
    status: 401, headers: { 'Content-Type': 'application/json' },
  })));

  await assert.rejects(api.apiClient.get('/medicines'), error => error === failure);

  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(unauthorizedEvents, 0);
});


const deferred = () => {
  let resolve = null;
  const promise = new Promise(complete => { resolve = complete; });
  return { promise, resolve };
};

[200, 401].flatMap(refreshStatus => ['replacement-user', 'test-user'].flatMap(userId =>
  ['app', 'external storage'].map(writer => ({ refreshStatus, userId, writer }))
)).forEach(({ refreshStatus, userId, writer }) => {
  test(`ignores a pending refresh ${refreshStatus} after ${writer} login for ${userId}`, async (context) => {
    const started = deferred();
    const refreshed = deferred();
    const replacement = {
      ...auth.readStoredAuthSession(),
      user: { ...auth.readStoredAuthSession().user, id: userId },
      tokens: { accessToken: 'replacement-access', refreshToken: 'replacement-refresh', tokenType: 'Bearer' },
    };
    window.addEventListener(api.AUTH_UNAUTHORIZED_EVENT, auth.clearStoredAuthSession);
    const fetch = context.mock.method(globalThis, 'fetch', (url, options) => {
      if (new URL(url).pathname === '/auth/refresh') {
        started.resolve();
        return refreshed.promise;
      }
      return Promise.resolve(options.headers.get('Authorization') === 'Bearer expired-token'
        ? json(401, { code: 'UNAUTHORIZED', message: 'Old request expired' })
        : json(200, { saved: true }));
    });
    const pending = api.apiClient.get('/medicines');
    await started.promise;
    if (writer === 'app') {
      auth.clearStoredAuthSession();
      auth.writeStoredAuthSession(replacement);
    } else {
      localStorage.setItem(auth.AUTH_SESSION_STORAGE_KEY, JSON.stringify(replacement));
      localStorage.setItem(auth.REFRESH_TOKEN_STORAGE_KEY, replacement.tokens.refreshToken);
    }
    refreshed.resolve(json(refreshStatus, refreshStatus === 200
      ? { tokens: { accessToken: 'old-rotated-access', refreshToken: 'old-rotated-refresh' } }
      : { code: 'UNAUTHORIZED', message: 'Old refresh expired' }));
    const [result] = await Promise.allSettled([pending]);

    assert.deepEqual(auth.readStoredAuthSession(), replacement);
    assert.equal(auth.getStoredRefreshToken(), replacement.tokens.refreshToken);
    assert.equal(unauthorizedEvents, 0);
    assert.equal(fetch.mock.callCount(), 2, 'The old request must not replay under the replacement login');
    assert.equal(result.status, 'rejected');
    assert.ok(result.reason instanceof api.ServiceError && result.reason.status === 401);
  });
});

test('does not refresh or sign out a replacement login for a late original 401', async (context) => {
  const response = deferred();
  const replacement = {
    ...auth.readStoredAuthSession(),
    user: { ...auth.readStoredAuthSession().user, id: 'replacement-user' },
    tokens: { accessToken: 'replacement-access', refreshToken: 'replacement-refresh', tokenType: 'Bearer' },
  };
  window.addEventListener(api.AUTH_UNAUTHORIZED_EVENT, auth.clearStoredAuthSession);
  const fetch = context.mock.method(globalThis, 'fetch', (_url, _options) =>
    fetch.mock.callCount() === 1 ? response.promise : Promise.resolve(json(401, { code: 'UNAUTHORIZED', message: 'Expired' })));
  const pending = api.apiClient.get('/medicines');
  auth.writeStoredAuthSession(replacement);
  response.resolve(json(401, { code: 'UNAUTHORIZED', message: 'Old request expired' }));
  const [result] = await Promise.allSettled([pending]);

  assert.deepEqual(auth.readStoredAuthSession(), replacement);
  assert.equal(unauthorizedEvents, 0);
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(result.status, 'rejected');
});

test('does not sign out a replacement login for a late retried 401', async (context) => {
  const retryStarted = deferred();
  const retried = deferred();
  const replacement = {
    ...auth.readStoredAuthSession(),
    user: { ...auth.readStoredAuthSession().user, id: 'replacement-user' },
    tokens: { accessToken: 'replacement-access', refreshToken: 'replacement-refresh', tokenType: 'Bearer' },
  };
  window.addEventListener(api.AUTH_UNAUTHORIZED_EVENT, auth.clearStoredAuthSession);
  context.mock.method(globalThis, 'fetch', (url, options) => {
    if (new URL(url).pathname === '/auth/refresh') return Promise.resolve(json(200, { tokens: { accessToken: 'rotated-access' } }));
    if (options.headers.get('Authorization') === 'Bearer rotated-access') {
      retryStarted.resolve();
      return retried.promise;
    }
    return Promise.resolve(json(401, { code: 'UNAUTHORIZED', message: 'Expired' }));
  });
  const pending = api.apiClient.get('/medicines');
  await retryStarted.promise;
  auth.writeStoredAuthSession(replacement);
  retried.resolve(json(401, { code: 'UNAUTHORIZED', message: 'Old retry expired' }));
  const [result] = await Promise.allSettled([pending]);

  assert.deepEqual(auth.readStoredAuthSession(), replacement);
  assert.equal(unauthorizedEvents, 0);
  assert.equal(result.status, 'rejected');
});


[200, 401].forEach(refreshStatus => {
  test(`does not revive or notify a logged-out session after refresh ${refreshStatus}`, async (context) => {
    const started = deferred();
    const refreshed = deferred();
    context.mock.method(globalThis, 'fetch', url => {
      if (new URL(url).pathname === '/auth/refresh') {
        started.resolve();
        return refreshed.promise;
      }
      return Promise.resolve(json(401, { code: 'UNAUTHORIZED', message: 'Expired' }));
    });
    const pending = api.apiClient.get('/medicines');
    await started.promise;
    auth.clearStoredAuthSession();
    refreshed.resolve(json(refreshStatus, { tokens: { accessToken: 'old-rotated-access' } }));
    const [result] = await Promise.allSettled([pending]);

    assert.equal(auth.readStoredAuthSession(), null);
    assert.equal(auth.getStoredRefreshToken(), null);
    assert.equal(unauthorizedEvents, 0);
    assert.equal(result.status, 'rejected');
  });
});

test('does not mutate the stored session when an explicit different token is rejected', async (context) => {
  const session = auth.readStoredAuthSession();
  window.addEventListener(api.AUTH_UNAUTHORIZED_EVENT, auth.clearStoredAuthSession);
  const fetch = context.mock.method(globalThis, 'fetch', () => Promise.resolve(json(401, { code: 'UNAUTHORIZED', message: 'Expired' })));

  await assert.rejects(api.apiClient.get('/auth/me', { accessToken: 'another-session-access' }),
    error => error instanceof api.ServiceError && error.status === 401);

  assert.deepEqual(auth.readStoredAuthSession(), session);
  assert.equal(unauthorizedEvents, 0);
  assert.equal(fetch.mock.callCount(), 1);
});

test('a new login refreshes independently and old completion cannot clear its shared refresh', async (context) => {
  const started = deferred();
  const oldRefresh = deferred();
  const newRefresh = deferred();
  let newRefreshCalls = 0;
  context.mock.method(globalThis, 'fetch', (url, options) => {
    if (new URL(url).pathname === '/auth/refresh') {
      if (JSON.parse(options.body).refreshToken === 'test-refresh-token') {
        started.resolve();
        return oldRefresh.promise;
      }
      newRefreshCalls += 1;
      return newRefresh.promise;
    }
    return Promise.resolve(options.headers.get('Authorization') === 'Bearer new-rotated-access'
      ? json(200, { saved: true })
      : json(401, { code: 'UNAUTHORIZED', message: 'Expired' }));
  });
  const oldRequest = Promise.allSettled([api.apiClient.get('/medicines')]);
  await started.promise;
  auth.writeStoredAuthSession({
    ...auth.readStoredAuthSession(),
    user: { ...auth.readStoredAuthSession().user, id: 'replacement-user' },
    tokens: { accessToken: 'replacement-access', refreshToken: 'replacement-refresh', tokenType: 'Bearer' },
  });
  const newRequest = Promise.allSettled([api.apiClient.get('/categories')]);
  // Drain the request/JSON microtasks without a timing delay.
  await new Promise(setImmediate);
  oldRefresh.resolve(json(200, { tokens: { accessToken: 'old-rotated-access' } }));
  const [oldResult] = await oldRequest;
  const anotherNewRequest = Promise.allSettled([api.apiClient.get('/medicines')]);
  await new Promise(setImmediate);
  newRefresh.resolve(json(200, { tokens: { accessToken: 'new-rotated-access', refreshToken: 'new-rotated-refresh' } }));
  const results = (await Promise.all([newRequest, anotherNewRequest])).flat();

  assert.equal(oldResult.status, 'rejected');
  assert.ok(results.every(result => result.status === 'fulfilled'));
  assert.equal(newRefreshCalls, 1);
  assert.equal(auth.getStoredAccessToken(), 'new-rotated-access');
  assert.equal(auth.readStoredAuthSession().user.id, 'replacement-user');
  assert.equal(unauthorizedEvents, 0);
});

test('keeps a late original 401 retry working after another request rotated the same session', async (context) => {
  const slow = deferred();
  let firstSlow = true;
  context.mock.method(globalThis, 'fetch', (url, options) => {
    const path = new URL(url).pathname;
    if (path === '/auth/refresh') return Promise.resolve(json(200, { tokens: { accessToken: 'fresh-token', refreshToken: 'rotated-refresh' } }));
    if (path === '/slow' && firstSlow) { firstSlow = false; return slow.promise; }
    return Promise.resolve(options.headers.get('Authorization') === 'Bearer fresh-token'
      ? json(200, { saved: true })
      : json(401, { code: 'UNAUTHORIZED', message: 'Expired' }));
  });
  const slowRequest = api.apiClient.get('/slow');
  assert.deepEqual(await api.apiClient.get('/fast'), { saved: true });
  slow.resolve(json(401, { code: 'UNAUTHORIZED', message: 'Expired' }));

  assert.deepEqual(await slowRequest, { saved: true });
  assert.equal(auth.readStoredAuthSession().user.id, 'test-user');
  assert.equal(unauthorizedEvents, 0);
});
