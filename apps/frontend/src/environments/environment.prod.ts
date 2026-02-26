export const environment = {
  production: true,
  // Backend URL will be injected at runtime via BACKEND_URL env var
  // Fallback is set in api.service.ts
  apiUrl: '' // Will be set by ApiService.getApiUrl()
};
