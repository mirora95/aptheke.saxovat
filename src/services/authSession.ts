import { AuthSession, UserRole } from '../types';

export const AUTH_SESSION_STORAGE_KEY = 'saxovat_auth_session';
export const REFRESH_TOKEN_STORAGE_KEY = 'saxovat-refresh-token';

let sessionVersion = 0;
let observedSession: string | null | undefined;
let observedRefreshToken: string | null | undefined;

export const getAuthSessionVersion = () => {
  const session = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
  if (session !== observedSession || refreshToken !== observedRefreshToken) {
    sessionVersion += 1;
    observedSession = session;
    observedRefreshToken = refreshToken;
  }
  return sessionVersion;
};

const isValidStoredRole = (value: unknown): value is UserRole => {
  return Object.values(UserRole).includes(value as UserRole);
};

export const parseStoredAuthSession = (storedSession: string | null): AuthSession | null => {
  if (!storedSession) return null;

  try {
    const parsed = JSON.parse(storedSession) as Partial<AuthSession>;

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof parsed.user !== 'object' ||
      parsed.user === null ||
      typeof parsed.user.id !== 'string' ||
      typeof parsed.user.fullName !== 'string' ||
      typeof parsed.user.phone !== 'string' ||
      typeof parsed.user.email !== 'string' ||
      !isValidStoredRole(parsed.user.role) ||
      typeof parsed.user.isActive !== 'boolean' ||
      typeof parsed.user.createdAt !== 'string' ||
      typeof parsed.tokens !== 'object' ||
      parsed.tokens === null ||
      typeof parsed.tokens.accessToken !== 'string' ||
      typeof parsed.tokens.tokenType !== 'string'
    ) {
      return null;
    }

    return parsed as AuthSession;
  } catch {
    return null;
  }
};

export const readStoredAuthSession = () => parseStoredAuthSession(localStorage.getItem(AUTH_SESSION_STORAGE_KEY));

const persistAuthSession = (session: AuthSession) => {
  const serialized = JSON.stringify(session);
  localStorage.setItem(AUTH_SESSION_STORAGE_KEY, serialized);
  if (session.tokens.refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, session.tokens.refreshToken);
  } else {
    localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  }
  observedSession = serialized;
  observedRefreshToken = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
};

export const writeStoredAuthSession = (session: AuthSession) => {
  sessionVersion += 1;
  persistAuthSession(session);
};

export const writeRefreshedAuthTokens = (expectedVersion: number | null, tokens: Partial<AuthSession['tokens']>) => {
  if (getAuthSessionVersion() !== expectedVersion) return false;
  const session = readStoredAuthSession();
  if (!session) return false;

  // Token rotation belongs to the same login; pending requests keep their session version.
  persistAuthSession({ ...session, tokens: { ...session.tokens, ...tokens } });
  return true;
};

export const clearStoredAuthSession = () => {
  sessionVersion += 1;
  localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  observedSession = observedRefreshToken = null;
};

export const getStoredAccessToken = () => readStoredAuthSession()?.tokens.accessToken ?? null;

export const getStoredRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
