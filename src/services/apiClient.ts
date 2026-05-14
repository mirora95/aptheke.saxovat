import type { ApiErrorResponse, ApiListResponse } from '../types';
import { getStoredAccessToken, getStoredRefreshToken, readStoredAuthSession, writeStoredAuthSession } from './authSession';

export const AUTH_UNAUTHORIZED_EVENT = 'saxovat:auth-unauthorized';

let requestRefreshPromise: Promise<boolean> | null = null;

const getApiBaseUrl = () => {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  return configuredBaseUrl && configuredBaseUrl.length > 0 ? configuredBaseUrl : 'http://localhost:5062';
};

const performTokenRefresh = async (refreshToken: string): Promise<boolean> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) return false;

    const data = await response.json() as { tokens: { accessToken: string; refreshToken?: string; expiresAt?: string } };
    const session = readStoredAuthSession();
    if (session) {
      writeStoredAuthSession({ ...session, tokens: { ...session.tokens, ...data.tokens } });
    }
    return true;
  } catch {
    return false;
  }
};

export class ServiceError extends Error {
  readonly code: ApiErrorResponse['code'];
  readonly status: number;
  readonly fieldErrors?: ApiErrorResponse['fieldErrors'];
  readonly traceId?: string;
  readonly source = 'api';

  constructor(
    code: ApiErrorResponse['code'],
    message: string,
    options?: {
      status?: number;
      fieldErrors?: ApiErrorResponse['fieldErrors'];
      traceId?: string;
    }
  ) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
    this.status = options?.status ?? 500;
    this.fieldErrors = options?.fieldErrors;
    this.traceId = options?.traceId;
  }

  toResponse(): ApiErrorResponse {
    return {
      code: this.code,
      message: this.message,
      fieldErrors: this.fieldErrors,
      traceId: this.traceId,
    };
  }
}

type RequestOptions = {
  body?: unknown;
  query?: Record<string, unknown>;
  accessToken?: string | null;
  suppressUnauthorizedEvent?: boolean;
};

const buildUrl = (path: string, query?: Record<string, unknown>) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(normalizedPath, `${getApiBaseUrl().replace(/\/+$/, '')}/`);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }

      if (Array.isArray(value)) {
        value.forEach(item => {
          if (item !== undefined && item !== null && item !== '') {
            url.searchParams.append(key, String(item));
          }
        });
        return;
      }

      url.searchParams.set(key, String(value));
    });
  }

  return url.toString();
};

const isApiErrorResponse = (value: unknown): value is ApiErrorResponse => {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'code' in value &&
      typeof (value as ApiErrorResponse).code === 'string' &&
      'message' in value &&
      typeof (value as ApiErrorResponse).message === 'string'
  );
};

const emitUnauthorized = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
  }
};

const createServiceError = (
  response: Response,
  payload: unknown,
  fallbackMessage: string
) => {
  if (isApiErrorResponse(payload)) {
    return new ServiceError(payload.code, payload.message || fallbackMessage, {
      status: response.status,
      fieldErrors: payload.fieldErrors,
      traceId: payload.traceId,
    });
  }

  return new ServiceError(
    response.status === 400
      ? 'VALIDATION'
      : response.status === 401
        ? 'UNAUTHORIZED'
        : response.status === 403
          ? 'FORBIDDEN'
          : response.status === 404
            ? 'NOT_FOUND'
            : response.status === 409
              ? 'CONFLICT'
              : 'UNKNOWN',
    fallbackMessage,
    {
      status: response.status,
    }
  );
};

const request = async <T>(method: string, path: string, options: RequestOptions = {}): Promise<T> => {
  const headers = new Headers({
    Accept: 'application/json',
  });

  const accessToken = options.accessToken ?? getStoredAccessToken();
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const isJsonBody = options.body !== undefined && options.body !== null && !(options.body instanceof FormData);
  if (isJsonBody) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;

  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      body: options.body === undefined ? undefined : isJsonBody ? JSON.stringify(options.body) : (options.body as BodyInit),
    });
  } catch (error) {
    throw new ServiceError('NETWORK', error instanceof Error ? error.message : 'Network request failed', {
      status: 0,
    });
  }

  const hasJsonBody = response.status !== 204 && response.headers.get('content-type')?.includes('application/json');
  const payload = hasJsonBody ? await response.json() : null;

  if (!response.ok) {
    if (response.status === 401 && !options.suppressUnauthorizedEvent) {
      const storedRefreshToken = getStoredRefreshToken();
      if (storedRefreshToken) {
        requestRefreshPromise ??= performTokenRefresh(storedRefreshToken);
        const refreshed = await requestRefreshPromise;
        requestRefreshPromise = null;
        if (refreshed) {
          const newToken = getStoredAccessToken();
          if (newToken) {
            headers.set('Authorization', `Bearer ${newToken}`);
            try {
              response = await fetch(buildUrl(path, options.query), {
                method,
                headers,
                body: options.body === undefined ? undefined : isJsonBody ? JSON.stringify(options.body) : (options.body as BodyInit),
              });
              if (response.ok) {
                const retryPayload = response.status !== 204 && response.headers.get('content-type')?.includes('application/json')
                  ? await response.json() : null;
                return retryPayload as T;
              }
            } catch {
              // fall through to unauthorized
            }
          }
        }
      }
      emitUnauthorized();
    }

    throw createServiceError(response, payload, response.statusText || 'Request failed');
  }

  return payload as T;
};

export const apiClient = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'body'>) => request<T>('GET', path, options),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>) =>
    request<T>('POST', path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>) =>
    request<T>('PUT', path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>) =>
    request<T>('PATCH', path, { ...options, body }),
};

export const getListItems = <T>(response: ApiListResponse<T>) => response.items;

export const toApiErrorResponse = (error: unknown): ApiErrorResponse => {
  if (error instanceof ServiceError) {
    return error.toResponse();
  }

  if (error instanceof Error && error.message) {
    return {
      code: 'UNKNOWN',
      message: error.message,
    };
  }

  return {
    code: 'UNKNOWN',
    message: 'Unexpected error',
  };
};
