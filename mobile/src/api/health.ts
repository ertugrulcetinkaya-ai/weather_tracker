import { BACKEND_URL } from './config';

export type HealthResponse = {
  status: 'ok';
};

export async function checkBackendHealth(): Promise<HealthResponse> {
  const response = await fetch(`${BACKEND_URL}/health`);
  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }
  const data = (await response.json()) as HealthResponse;
  if (data.status !== 'ok') {
    throw new Error('Unexpected health response');
  }
  return data;
}
