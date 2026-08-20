import axios, { type AxiosError, type AxiosInstance } from "axios";

const apiClient: AxiosInstance = axios.create({
  baseURL: "/api",
  timeout: 10000
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as (AxiosError["config"] & {
      __retryCount?: number;
    });

    if (!config) return Promise.reject(error);

    const status = error.response?.status ?? 0;
    const shouldRetry = status >= 500 || status === 429;

    const retryCount = config.__retryCount ?? 0;
    config.__retryCount = retryCount;

    if (shouldRetry && retryCount < 2) {
      const nextCount = retryCount + 1;
      config.__retryCount = nextCount;
      await new Promise((resolve) => setTimeout(resolve, 500 * nextCount));
      return apiClient(config);
    }

    return Promise.reject(error);
  }
);

export default apiClient;
