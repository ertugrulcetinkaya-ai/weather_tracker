import { requestJson } from './client';

export type HealthResponse = {
  status: 'ok';
};

export async function checkBackendHealth(): Promise<HealthResponse> {
  const data = await requestJson('/health');
  if (typeof data !== 'object' || data === null || !('status' in data) || data.status !== 'ok') {
    throw new Error('Unexpected health response');
  }
  return { status: 'ok' };
}
