/**
 * API HELPER
 * ----------------------------------------------------------------------------
 * One shared "axios" instance that every page uses to talk to the back end.
 *   - baseURL '/api': page code can write api.get('/books') instead of the full URL.
 *   - The interceptor below runs before EVERY request and attaches the login token:
 *         Authorization: Bearer <token>
 *     The server's authenticateToken middleware reads this header to know who is asking.
 */
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

api.interceptors.request.use((config) => {
  // The token is saved in the browser's localStorage when the user logs in (see App.tsx)
  const token = localStorage.getItem('library_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Runs when a request FAILS. Pages show `err.response.data.error` to the user, so we
 * make sure it is always plain text. Some errors (e.g. Vercel's own "500" page) send
 * an object like { code, message } or an HTML page instead. Showing an object directly
 * crashes React and leaves a blank white page.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const response = error.response;
    if (response) {
      const data = response.data;
      if (data && typeof data === 'object' && !(data instanceof Blob) && typeof data.error === 'string') {
        // Normal error from our own server: already a text message
      } else if (data && typeof data === 'object' && data.error && typeof data.error === 'object') {
        response.data = { error: String(data.error.message || `Server error (${response.status})`) };
      } else {
        response.data = { error: `Server error (${response.status}). Please try again later.` };
      }
    }
    return Promise.reject(error);
  }
);

export default api;
