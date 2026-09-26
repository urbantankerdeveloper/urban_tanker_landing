// Vendor dashboard refresh worker - periodically fetches and updates vendor data
(() => {
  let intervalId: ReturnType<typeof globalThis.setInterval> | null = null;

  interface RefreshConfig {
    intervalMinutes: number;
    token: string;
    apiBaseUrl: string;
  }

  interface VendorData {
    vendor?: any;
    orders?: any[];
    error?: string;
  }

  self.onmessage = async (event: MessageEvent<{ action: string; config?: RefreshConfig }>) => {
    const { action, config } = event.data;

    if (action === 'start' && config) {
      // Clear any existing interval
      if (intervalId) clearInterval(intervalId);

      // Perform initial fetch
      await fetchVendorData(config);

      // Set up periodic refresh
      const intervalMs = config.intervalMinutes * 60 * 1000;
      intervalId = setInterval(() => {
        void fetchVendorData(config);
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

  async function fetchVendorData(config: RefreshConfig): Promise<void> {
  try {
    const response = await fetch(`${config.apiBaseUrl}/api/vendor/dashboard`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Vendor dashboard fetch failed: ${response.statusText}`);
    }

    const data: VendorData = await response.json();
    self.postMessage({ status: 'updated', data });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error fetching vendor data';
    self.postMessage({ status: 'error', error: errorMessage });
  }
  }
})();
