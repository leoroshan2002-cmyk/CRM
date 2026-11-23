import { apiUrl } from "../config/api.js";

const getToken = () => localStorage.getItem("token");

const buildHeaders = (extra = {}) => ({
  "Content-Type": "application/json",
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
  ...extra,
});

const quotationRequest = async (path, method = "GET", payload) => {
  const response = await fetch(apiUrl(`/quotations${path}`), {
    method,
    headers: buildHeaders(),
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.message || "Quotation request failed");
  }
  return result;
};

const quotationApi = {
  catalog: () => quotationRequest("/catalog"),
  createService: (payload) => quotationRequest("/catalog/services", "POST", payload),
  updateService: (id, payload) => quotationRequest(`/catalog/services/${id}`, "PUT", payload),
  deleteService: (id) => quotationRequest(`/catalog/services/${id}`, "DELETE"),
  createPackage: (payload) => quotationRequest("/catalog/packages", "POST", payload),
  updatePackage: (id, payload) => quotationRequest(`/catalog/packages/${id}`, "PUT", payload),
  deletePackage: (id) => quotationRequest(`/catalog/packages/${id}`, "DELETE"),
  updateDurations: (durations) => quotationRequest("/catalog/durations", "PUT", { durations }),
  list: () => quotationRequest(""),
  create: (payload) => quotationRequest("", "POST", payload),
  update: (id, payload) => quotationRequest(`/${id}`, "PUT", payload),
  remove: (id) => quotationRequest(`/${id}`, "DELETE"),
  duplicate: (id) => quotationRequest(`/${id}/duplicate`, "POST"),
};

export default quotationApi;
