// src/utils/auth.js
// Multi-Tab Independent Authentication Storage Utility (Strict Per-Tab Session Storage)

export const getAuthToken = () => {
  return sessionStorage.getItem('access_token');
};

export const getAuthRefreshToken = () => {
  return sessionStorage.getItem('refresh_token');
};

export const getAuthUsername = () => {
  return sessionStorage.getItem('username');
};

export const getAuthRole = () => {
  return sessionStorage.getItem('role');
};

export const setAuthSession = (access, refresh, username, role) => {
  // Store strictly in sessionStorage so each tab is 100% isolated
  sessionStorage.setItem('access_token', access);
  sessionStorage.setItem('refresh_token', refresh);
  sessionStorage.setItem('username', username);
  if (role) sessionStorage.setItem('role', role);

  // Clear any legacy localStorage auth keys so they never cause ghost logins
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('username');
  localStorage.removeItem('role');
};

export const clearThisTabAuth = () => {
  // Clear strictly this tab's session
  sessionStorage.removeItem('access_token');
  sessionStorage.removeItem('refresh_token');
  sessionStorage.removeItem('username');
  sessionStorage.removeItem('role');

  // Also clean localStorage completely
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('username');
  localStorage.removeItem('role');
};

export const clearAllAuth = () => {
  clearThisTabAuth();
};
