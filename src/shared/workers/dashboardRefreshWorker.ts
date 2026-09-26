// Dashboard refresh worker - periodically fetches and updates dashboard data
(() => {
  let intervalId: ReturnType<typeof globalThis.setInterval> | null = null;

  interface RefreshConfig {
    intervalMinutes: number;
    token: string;
    apiBaseUrl: string;
  }

  interface DashboardData {
    orders?: any[];
    vendors?: any[];
    error?: string;
  }

  self.onmessage = async (event: MessageEvent<{ action: string; config?: RefreshConfig }>) => {
    const { action, config } = event.data;

    if (action === 'start' && config) {
      // Clear any existing interval
      if (intervalId) clearInterval(intervalId);

      // Perform initial fetch
      await fetchDashboardData(config);

      // Set up periodic refresh
      const intervalMs = config.intervalMinutes * 60 * 1000;
      intervalId = setInterval(() => {
        void fetchDashboardData(config);
      }, intervalMs);

      self.postMessage({ status: 'started', intervalMinutes: config.intervalMinutes });
    } else if (action === 'stop') {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      self.postMessage({ status: 'stopped' });
    }
  };

  async function fetchDashboardData(config: RefreshConfig): Promise<void> {
  try {
    const response = await fetch(`${config.apiBaseUrl}/api/admin/dashboard`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Dashboard fetch failed: ${response.statusText}`);
    }

    const data: DashboardData = await response.json();
    self.postMessage({ status: 'updated', data });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error fetching dashboard data';
    self.postMessage({ status: 'error', error: errorMessage });
  }
  }
})();
