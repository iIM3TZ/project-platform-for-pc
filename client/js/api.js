// All calls to the backend live here. Pages import these functions instead of calling fetch.

// An error from the API, with the HTTP status and, for invalid forms, the problem per field
export class ApiError extends Error {
  constructor(message, status, fields = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

// body: an object sent as JSON. file: a File sent as it is (for picture uploads).
async function request(path, { method = 'GET', body, file } = {}) {
  const options = { method, headers: {} };
  if (file) {
    options.headers['Content-Type'] = file.type;
    options.body = file;
  } else if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`/api${path}`, options);
  } catch {
    throw new ApiError('Network error', 0);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = payload.error || {};
    throw new ApiError(error.message || 'Request failed', response.status, error.fields || {});
  }
  return payload.data;
}

// ---------- Public ----------

export const getCategories = () => request('/categories');
export const getStores = () => request('/stores');

// filters: { category: 'gpu', q: '4060' }; empty values are left out
export function getProducts(filters = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) query.set(key, value);
  }
  const text = query.toString();
  return request(text ? `/products?${text}` : '/products');
}

// ---------- Admin ----------

export const getSpecFields = () => request('/admin/spec-fields');
export const getProductImages = () => request('/admin/product-images');
export const uploadProductImage = (file) =>
  request(`/admin/product-images?name=${encodeURIComponent(file.name)}`, { method: 'POST', file });
export const getAdminProducts = () => request('/admin/products');
export const createProduct = (product) => request('/admin/products', { method: 'POST', body: product });
export const updateProduct = (id, product) => request(`/admin/products/${id}`, { method: 'PUT', body: product });
export const getAdminProductOffers = (productId) => request(`/admin/products/${productId}/offers`);
export const createOffer = (offer) => request('/admin/offers', { method: 'POST', body: offer });
export const updateOffer = (id, offer) => request(`/admin/offers/${id}`, { method: 'PUT', body: offer });
