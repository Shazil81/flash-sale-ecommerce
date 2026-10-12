import axios from 'axios';
import { getAuthToken, getAuthRefreshToken, clearThisTabAuth } from './utils/auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Automatically add token to the headers of every request if it exists in current tab
api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Intercept responses to handle authentication errors automatically
let refreshRequest = null;
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && original && !original._retry && original.url !== '/login/') {
      original._retry = true;
      const refresh = getAuthRefreshToken();
      if (refresh) {
        try {
          if (!refreshRequest) {
            refreshRequest = axios.post(`${API_BASE_URL}/login/refresh/`, { refresh })
              .then(({ data }) => {
                sessionStorage.setItem('access_token', data.access);
                return data.access;
              }).finally(() => { refreshRequest = null; });
          }
          await refreshRequest;
          return api(original);
        } catch {
          clearThisTabAuth();
          window.location.assign('/login');
        }
      } else {
        clearThisTabAuth();
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
export { API_BASE_URL };
