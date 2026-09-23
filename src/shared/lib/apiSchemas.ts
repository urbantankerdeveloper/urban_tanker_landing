import { z } from 'zod';

export const notificationItemSchema = z.object({
  id: z.string(),
  orderId: z.string().optional(),
  title: z.string(),
  detail: z.string(),
  status: z.string(),
  timestamp: z.union([z.string(), z.date()]).optional(),
  read: z.boolean().optional(),
});

export const notificationsResponseSchema = z.object({
  unreadCount: z.number().int().nonnegative(),
  notifications: z.array(notificationItemSchema),
});

export const orderHistoryItemSchema = z.object({
  order_id: z.string(),
  client_id: z.string(),
  status: z.string(),
  timestamp: z.union([z.string(), z.date()]),
  actor_uid: z.string().optional(),
  actor_role: z.string().optional(),
  vendor_uid: z.string().optional(),
  rejection_reason: z.string().optional(),
});

export type NotificationItemResponse = z.infer<typeof notificationItemSchema>;
export type OrderHistoryItemResponse = z.infer<typeof orderHistoryItemSchema>;

export function parseApiResponse<T>(schema: z.ZodType<T>, payload: unknown): T {
  const result = schema.safeParse(payload);
  if (!result.success) throw new Error('The server returned an invalid response.');
  return result.data;
}
