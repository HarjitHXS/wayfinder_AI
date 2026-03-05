export const getRuntimeApiUrl = (): string => {
  const HARDCODED_BACKEND_URL = 'https://wayfinder-backend-ff4xcobz3q-uc.a.run.app';
  const win = typeof window !== 'undefined' ? (window as any) : null;

  if (win && win.location && win.location.hostname === 'localhost') {
    return 'http://localhost:3001';
  }

  return HARDCODED_BACKEND_URL;
};
