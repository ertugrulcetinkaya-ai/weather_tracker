// Backend base URL.
// - iOS simulator için localhost çalışabilir.
// - Fiziksel cihazda daha sonra Mac'in LAN IP adresi kullanılacak.
const BACKEND_URL = "http://127.0.0.1:8000";

export type HealthResponse = {
  status: "ok";
};

export async function checkBackendHealth(): Promise<HealthResponse> {
  const response = await fetch(`${BACKEND_URL}/health`);
  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }
  const data = (await response.json()) as HealthResponse;
  if (data.status !== "ok") {
    throw new Error("Unexpected health response");
  }
  return data;
}
