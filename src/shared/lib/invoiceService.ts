/**
 * Invoice Service
 * Handles invoice generation, retrieval, and download
 */

import type { Invoice, Order, Profile } from './types';
import { API_BASE_URL } from './apiConfig';
import { getAuthToken } from '../../features/auth/auth';

/**
 * Generate invoice for an order
 */
export async function generateInvoice(orderId: string): Promise<Invoice> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('User not authenticated');
  }

  const response = await fetch(`${API_BASE_URL}/api/invoices/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ orderId }),
  });

  if (!response.ok) {
    throw new Error('Failed to generate invoice');
  }

  return await response.json();
}

/**
 * Get invoice details by ID
 */
export async function getInvoice(invoiceId: string): Promise<Invoice | null> {
  const token = getAuthToken();
  if (!token) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/invoices/${invoiceId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Get invoice for order
 */
export async function getOrderInvoice(orderId: string): Promise<Invoice | null> {
  const token = getAuthToken();
  if (!token) {
    return null;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/invoices/order/${orderId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Download invoice PDF
 */
export async function downloadInvoicePdf(invoiceId: string): Promise<Blob> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('User not authenticated');
  }

  const response = await fetch(
    `${API_BASE_URL}/api/invoices/${invoiceId}/download`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to download invoice');
  }

  return await response.blob();
}

/**
 * Email invoice to customer
 */
export async function emailInvoice(
  invoiceId: string,
  email: string
): Promise<{ success: boolean }> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('User not authenticated');
  }

  const response = await fetch(
    `${API_BASE_URL}/api/invoices/${invoiceId}/email`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ email }),
    }
  );

  if (!response.ok) {
    throw new Error('Failed to email invoice');
  }

  return await response.json();
}

/**
 * Get all invoices for customer
 */
export async function getCustomerInvoices(
  limit: number = 20,
  offset: number = 0
): Promise<Invoice[]> {
  const token = getAuthToken();
  if (!token) {
    return [];
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/invoices?limit=${limit}&offset=${offset}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.invoices || [];
  } catch {
    return [];
  }
}

/**
 * Create invoice data from order (for local generation)
 */
export function createInvoiceFromOrder(
  order: Order,
  profile: Profile,
  vendorName: string = 'Urban Tanker Service',
  vendorEmail: string = 'billing@urbantanker.com'
): Partial<Invoice> {
  const taxPercentage = 5; // Example GST rate
  const subtotal = order.amount - (order.discount || 0);
  const taxAmount = Math.round((subtotal * taxPercentage) / 100);
  const totalAmount = subtotal + taxAmount;

  return {
    invoiceNumber: `INV-${order.id.substring(0, 8).toUpperCase()}`,
    orderId: order.id,
    date: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
    amount: order.amount,
    discount: order.discount || 0,
    taxAmount,
    totalAmount,
    paymentMethod: order.payment,
    paymentId: order.paymentId,
    status: 'paid',
    customerName: profile.name,
    customerEmail: profile.email || '',
    customerPhone: profile.phone,
    vendorName,
    billItems: [
      {
        description: `${order.service} - ${order.capacity}`,
        quantity: 1,
        rate: order.amount - (order.discount || 0),
        amount: order.amount - (order.discount || 0),
      },
    ],
  };
}

/**
 * Format invoice for printing/display
 */
export function formatInvoiceForPrint(invoice: Invoice): string {
  const lines = [
    '═════════════════════════════════════',
    `                INVOICE               `,
    '═════════════════════════════════════',
    '',
    `Invoice Number: ${invoice.invoiceNumber}`,
    `Date: ${invoice.date}`,
    `Order ID: ${invoice.orderId}`,
    '',
    '─────────────────────────────────────',
    'CUSTOMER DETAILS',
    '─────────────────────────────────────',
    `Name: ${invoice.customerName}`,
    `Email: ${invoice.customerEmail}`,
    `Phone: ${invoice.customerPhone}`,
    '',
    '─────────────────────────────────────',
    'VENDOR DETAILS',
    '─────────────────────────────────────',
    `Name: ${invoice.vendorName}`,
    '',
    '─────────────────────────────────────',
    'BILL ITEMS',
    '─────────────────────────────────────',
  ];

  invoice.billItems.forEach((item) => {
    lines.push(`${item.description}`);
    lines.push(
      `  Qty: ${item.quantity} × ₹${item.rate} = ₹${item.amount}`
    );
  });

  lines.push('');
  lines.push('─────────────────────────────────────');
  lines.push(
    `Subtotal:              ₹${invoice.amount.toLocaleString('en-IN')}`
  );
  if (invoice.discount > 0) {
    lines.push(
      `Discount:              -₹${invoice.discount.toLocaleString('en-IN')}`
    );
  }
  lines.push(
    `Tax (GST):             ₹${invoice.taxAmount.toLocaleString('en-IN')}`
  );
  lines.push('─────────────────────────────────────');
  lines.push(
    `TOTAL:                 ₹${invoice.totalAmount.toLocaleString('en-IN')}`
  );
  lines.push('─────────────────────────────────────');
  lines.push('');
  lines.push(`Payment Method: ${invoice.paymentMethod}`);
  lines.push(`Payment ID: ${invoice.paymentId}`);
  lines.push('');
  lines.push('Thank you for your business!');
  lines.push('═════════════════════════════════════');

  return lines.join('\n');
}

/**
 * Download invoice as text file
 */
export function downloadInvoiceAsText(invoice: Invoice): void {
  const text = formatInvoiceForPrint(invoice);
  const blob = new Blob([text], { type: 'text/plain' });
  downloadBlob(blob, `${invoice.invoiceNumber}.txt`);
}

/**
 * Helper to download blob as file
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Convert invoice to CSV format
 */
export function invoiceToCsv(invoices: Invoice[]): string {
  const headers = [
    'Invoice Number',
    'Order ID',
    'Date',
    'Customer Name',
    'Customer Email',
    'Amount',
    'Discount',
    'Tax',
    'Total Amount',
    'Payment Method',
    'Status',
  ];

  const rows = invoices.map((inv) => [
    inv.invoiceNumber,
    inv.orderId,
    inv.date,
    inv.customerName,
    inv.customerEmail,
    inv.amount,
    inv.discount,
    inv.taxAmount,
    inv.totalAmount,
    inv.paymentMethod,
    inv.status,
  ]);

  const csv = [
    headers.join(','),
    ...rows.map((row) =>
      row
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(',')
    ),
  ].join('\n');

  return csv;
}

/**
 * Download invoices as CSV
 */
export function downloadInvoicesAsCsv(invoices: Invoice[]): void {
  const csv = invoiceToCsv(invoices);
  const blob = new Blob([csv], { type: 'text/csv' });
  downloadBlob(blob, `invoices-${new Date().toISOString().split('T')[0]}.csv`);
}
