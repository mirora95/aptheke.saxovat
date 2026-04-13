import { AuthSession, UserRole } from '../types';

export const AUTH_SESSION_STORAGE_KEY = 'saxovat_auth_session';

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

export const writeStoredAuthSession = (session: AuthSession) => {
  localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
};

export const clearStoredAuthSession = () => {
  localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
};

export const getStoredAccessToken = () => readStoredAuthSession()?.tokens.accessToken ?? null;
