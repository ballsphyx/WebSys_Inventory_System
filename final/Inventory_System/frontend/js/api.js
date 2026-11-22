/* Inventory System API client. Keep this file loaded before page-specific scripts. */
(function () {
  const API_BASE = window.INVENTORY_API_BASE || "http://127.0.0.1:8000";
  const state = { products: [], transactions: [] };

  async function request(path, options = {}) {
    const config = { ...options, credentials: "include", headers: { ...(options.headers || {}) } };
    if (config.body && typeof config.body !== "string") {
      config.headers["Content-Type"] = "application/json";
      config.body = JSON.stringify(config.body);
    }
    const response = await fetch(API_BASE + path, config);
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? await response.json() : null;
    if (!response.ok) {
      const error = new Error(payload?.detail || `Request failed (${response.status})`);
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  async function refreshProducts() { state.products = await request("/api/products"); return state.products; }
  async function refreshTransactions() { state.transactions = await request("/api/transactions"); return state.transactions; }
  async function refreshAll() { await Promise.all([refreshProducts(), refreshTransactions()]); return state; }

  window.InventoryAPI = {
    base: API_BASE, state, request, refreshProducts, refreshTransactions, refreshAll,
    products: () => state.products,
    transactions: () => state.transactions,
    async createProduct(data) { const p = await request("/api/products", { method: "POST", body: data }); await refreshProducts(); return p; },
    async updateProduct(id, data) { const p = await request(`/api/products/${encodeURIComponent(id)}`, { method: "PUT", body: data }); await refreshProducts(); return p; },
    async deleteProduct(id) { const result = await request(`/api/products/${encodeURIComponent(id)}`, { method: "DELETE" }); await refreshProducts(); return result; },
    async createTransaction(data) { const t = await request("/api/transactions", { method: "POST", body: data }); await refreshAll(); return t; },
    async updateTransaction(id, data) { const t = await request(`/api/transactions/${encodeURIComponent(id)}`, { method: "PUT", body: data }); await refreshAll(); return t; }
  };
})();
