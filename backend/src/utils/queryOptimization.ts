// Backend database optimization utilities
// Uses MongoDB aggregation pipelines instead of in-memory processing

export interface ChartDataPoint {
  label: string;
  water: number;
  sewage: number;
  revenue: number;
}

export interface DashboardAnalytics {
  revenue: number;
  delivered: number;
  activeDeliveries: number;
  activeVendors: number;
  chartData: ChartDataPoint[];
}

/**
 * Generate dashboard analytics using MongoDB aggregation
 * Much faster than filtering/reducing in memory
 */
export function buildDashboardAggregation(days: 7 | 30 | 90 = 7): any[] {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  return [
    // Match orders from client within date range
    {
      $match: {
        created: { $gte: startDate }
      }
    },
    // Group by day
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$created' }
        },
        water: {
          $sum: {
            $cond: [{ $eq: ['$service', 'Water tanker'] }, 1, 0]
          }
        },
        sewage: {
          $sum: {
            $cond: [{ $eq: ['$service', 'Sewage pickup'] }, 1, 0]
          }
        },
        revenue: {
          $sum: {
            $cond: [{ $eq: ['$status', 'Delivered'] }, { $toDouble: '$amount' }, 0]
          }
        }
      }
    },
    // Sort by date
    {
      $sort: { _id: 1 }
    }
  ];
}

/**
 * Get delivered orders statistics using aggregation
 */
export function buildDeliveredStatsAggregation(): any[] {
  return [
    {
      $match: {
        status: 'Delivered'
      }
    },
    {
      $group: {
        _id: null,
        revenue: {
          $sum: { $toDouble: '$amount' }
        },
        count: { $sum: 1 }
      }
    }
  ];
}

/**
 * Get active vendors statistics using aggregation
 */
export function buildActiveVendorsAggregation(): any[] {
  return [
    {
      $match: {
        $or: [
          { status: 'active' },
          { available: true }
        ]
      }
    },
    {
      $group: {
        _id: null,
        count: { $sum: 1 }
      }
    }
  ];
}

/**
 * Get orders by status using aggregation
 */
export function buildOrdersByStatusAggregation(): any[] {
  return [
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    },
    {
      $sort: { count: -1 }
    }
  ];
}

/**
 * Calculate distance between two coordinates
 * Haversine formula for accurate distance calculation
 */
export function distanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Create a vendor lookup map for O(1) access
 */
export function createVendorMap(vendors: any[]): Map<string, string> {
  return new Map(
    vendors.map((vendor: any) => [
      vendor.uid,
      vendor.name || vendor.display_name
    ])
  );
}

/**
 * Filter orders by distance radius
 * Returns only orders within specified distance
 */
export function filterOrdersByDistance(
  orders: any[],
  vendorLocation: { latitude: number; longitude: number } | null,
  radiusKm: number
): any[] {
  if (!vendorLocation || typeof vendorLocation.latitude !== 'number') {
    return [];
  }

  return orders.filter((order: any) => {
    if (
      typeof order.deliveryLatitude !== 'number' ||
      typeof order.deliveryLongitude !== 'number'
    ) {
      return false;
    }

    const distance = distanceKm(
      vendorLocation.latitude,
      vendorLocation.longitude,
      order.deliveryLatitude,
      order.deliveryLongitude
    );

    return distance <= radiusKm;
  });
}

/**
 * Batch process orders with efficient memory usage
 */
export async function batchProcessOrders(
  orders: any[],
  processor: (order: any) => Promise<void>,
  batchSize: number = 50
): Promise<void> {
  for (let i = 0; i < orders.length; i += batchSize) {
    const batch = orders.slice(i, i + batchSize);
    await Promise.all(batch.map(processor));
  }
}

/**
 * Normalize order data for consistent output
 */
export function normalizeOrder(order: any): any {
  return {
    id: order.id,
    service: order.service,
    capacity: order.capacity,
    customer: order.customer,
    address: order.address,
    vendor: order.vendor,
    driver: order.driver,
    amount: order.amount,
    payment: order.payment,
    status: order.status,
    created: order.created,
    // Never return sensitive fields
    customerDeliveryOtp: undefined,
    deliveryOtpHash: undefined
  };
}

/**
 * Deduplicate array by key efficiently
 */
export function deduplicateBy<T>(
  array: T[],
  keyFn: (item: T) => string | number
): T[] {
  const seen = new Set<string | number>();
  const result: T[] = [];

  for (const item of array) {
    const key = keyFn(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }

  return result;
}
