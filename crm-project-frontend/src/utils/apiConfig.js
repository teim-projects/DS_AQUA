/**
 * API Configuration Helper for DS Aqua CRM
 */
export const getBaseApiUrl = () => {
  return import.meta.env.VITE_BASE_API_URL || "http://localhost:8000";
};

export default {
  getBaseApiUrl,
};
