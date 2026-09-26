// Web Worker for Chart Data Processing
// Moves O(n×m) calculations off main thread for analytics dashboards
// Usage: new Worker(new URL('chartDataWorker.ts', import.meta.url), { type: 'module' })

interface Order {
  id: string;
  service: string;
  status: string;
  created: string;
  amount: number;
}

interface ChartDataMessage {
  type: 'generateChartData';
  orders: Order[];
  days: 7 | 30 | 90;
}

interface ChartDataPoint {
  label: string;
  water: number;
  sewage: number;
  revenue: number;
}

interface VendorAnalytics {
  activeCount: number;
  inactiveCount: number;
  topVendors: Array<{ uid: string; name: string; orderCount: number }>;
}

interface WorkerResponse {
  type: 'success' | 'error';
  data?: ChartDataPoint[] | VendorAnalytics;
  error?: string;
}

function generateChartData(orders: Order[], days: number): ChartDataPoint[] {
  const chartData: ChartDataPoint[] = [];
  
  // Create map for O(1) lookup instead of O(n) filtering per day
  const ordersByDate = new Map<string, Order[]>();
  
  orders.forEach(order => {
    const dateKey = new Date(order.created).toISOString().slice(0, 10);
    if (!ordersByDate.has(dateKey)) {
      ordersByDate.set(dateKey, []);
    }
    ordersByDate.get(dateKey)!.push(order);
  });
  
  // Generate data for each day
  for (let index = 0; index < days; index++) {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - (days - 1 - index));
    const dateKey = day.toISOString().slice(0, 10);
    const dayOrders = ordersByDate.get(dateKey) || [];
    
    const label = days === 7
      ? day.toLocaleDateString('en-IN', { weekday: 'short' })
      : day.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    
    const waterOrders = dayOrders.filter(o => o.service === 'Water tanker');
    const sewageOrders = dayOrders.filter(o => o.service === 'Sewage pickup');
    
    chartData.push({
      label,
      water: waterOrders.length,
      sewage: sewageOrders.length,
      revenue: dayOrders.reduce((sum, o) => sum + (o.amount || 0), 0)
    });
  }
  
  return chartData;
}

function analyzeVendors(vendors: any[]): VendorAnalytics {
  const activeCount = vendors.filter(v => v.status === 'active' || v.available === true).length;
  const inactiveCount = vendors.length - activeCount;
  
  // Get top 5 vendors by orders (would need order counts from main data)
  const topVendors = vendors
    .slice(0, 5)
    .map(v => ({
      uid: v.uid,
      name: v.name,
      orderCount: 0 // Should be calculated from orders data
    }));
  
  return {
    activeCount,
    inactiveCount,
    topVendors
  };
}

self.onmessage = (event: MessageEvent<ChartDataMessage>) => {
  try {
    if (event.data.type === 'generateChartData') {
      const result = generateChartData(event.data.orders, event.data.days);
      self.postMessage({ type: 'success', data: result } as WorkerResponse);
    } else {
      self.postMessage({ type: 'error', error: 'Unknown message type' } as WorkerResponse);
    }
  } catch (error) {
    self.postMessage({ type: 'error', error: String(error) } as WorkerResponse);
  }
};
