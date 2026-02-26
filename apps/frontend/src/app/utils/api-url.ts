export const getRuntimeApiUrl = (): string => {
  const win = typeof window !== 'undefined' ? (window as any) : null;

  if (win && win.__env__ && win.__env__.API_URL) {
    return win.__env__.API_URL;
  }

  const cachedUrl = win?.localStorage?.getItem('api-url');
  if (cachedUrl) {
    return cachedUrl;
  }

  if (win && win.location && win.location.hostname !== 'localhost') {
    const origin = win.location.origin;
    if (origin.includes('frontend')) {
      return origin.replace('frontend', 'backend');
    }
    return origin;
  }

  return 'http://localhost:3001';
};
