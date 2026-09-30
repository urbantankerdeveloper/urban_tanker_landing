/**
 * Invoices API Routes
 * Handles invoice generation, retrieval, and download
 * Database-backed implementation (MongoDB)
 */

import express, { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDatabase } from '../database/connection.js';

const router = express.Router();

// Cache for invoice config (5-minute TTL)
let invoiceConfigCache: any = null;
let invoiceConfigCacheTime = 0;
const CONFIG_CACHE_TTL = 5 * 60 * 1000;

/**
 * Get invoice configuration from database or cache
 */
async function getInvoiceConfig() {
  const now = Date.now();
  
  if (invoiceConfigCache && now - invoiceConfigCacheTime < CONFIG_CACHE_TTL) {
    return invoiceConfigCache;
  }

  try {
    const db = await getDatabase();
    const configDoc = await db.collection('configs').findOne({
      configType: 'invoice_config',
    });

    if (configDoc?.data) {
      invoiceConfigCache = configDoc.data;
      invoiceConfigCacheTime = now;
      return invoiceConfigCache;
    }
  } catch (error) {
    console.error('Error fetching invoice config from DB:', error);
  }

  // Fallback defaults
  return {
    gstPercentage: 5,
    invoicePrefix: 'INV',
    billDueInDays: 7,
    companyDetails: {
      name: 'Urban Tanker Services',
      gstin: '18AAAAR5055K1Z5',
      address: 'Bangalore, India',
      email: 'billing@urbantanker.com',
    },
  };
}

/**
 * Get user from auth token
 */
function getAuthUser(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const userId = Buffer.from(token, 'base64').toString().split(':')[0];
    return userId;
  } catch {
    return null;
  }
}

/**
 * POST /api/invoices/generate
 * Generate invoice for an order
 */
router.post('/invoices/generate', async (req: Request, res: Response) => {
  try {
    const userId = getAuthUser(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: 'Order ID required' });
    }

    const db = await getDatabase();
    const collection = db.collection('invoices_v2');
    const config = await getInvoiceConfig();

    // Check if invoice already exists for this order
    const existing = await collection.findOne({ orderId });
    if (existing) {
      return res.json(existing);
    }

    // In production, fetch order details from database
    const invoiceId = randomUUID();
    const sequenceNum = Math.random().toString().substring(2, 8).padStart(6, '0');
    const invoiceNumber = `${config.invoicePrefix}-${new Date().getFullYear()}-${sequenceNum}`;

    const now = new Date();
    const dueDate = new Date(now.getTime() + config.billDueInDays * 24 * 60 * 60 * 1000);

    // Create invoice with config-based GST
    const amount = 1500;
    const discount = 150;
    const subtotal = amount - discount;
    const taxAmount = Math.round(subtotal * (config.gstPercentage / 100));
    const totalAmount = subtotal + taxAmount;

    const invoice: any = {
      id: invoiceId,
      invoiceNumber,
      orderId,
      customerId: userId,
      date: now,
      dueDate,
      amount,
      discount,
      taxAmount,
      totalAmount,
      paymentMethod: 'UPI',
      paymentId: `PAY-${randomUUID().substring(0, 8)}`,
      status: 'paid',
      customerName: 'Customer Name',
      customerEmail: 'customer@example.com',
      customerPhone: '9876543210',
      vendorName: config.companyDetails.name,
      billItems: [
        {
          description: 'Water tanker - 6 KL',
          quantity: 1,
          rate: amount,
          amount,
        },
      ],
      createdAt: now,
      updatedAt: now,
      pdfUrl: `/invoices/${invoiceId}/download`,
    };

    await collection.insertOne(invoice);

    console.log(`✅ Invoice ${invoiceNumber} generated for order ${orderId}`);

    res.json(invoice);
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).json({ error: 'Failed to generate invoice' });
  }
});

/**
 * GET /api/invoices/:invoiceId
 * Get invoice details
 */
router.get('/invoices/:invoiceId', async (req: Request, res: Response) => {
  try {
    const userId = getAuthUser(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { invoiceId } = req.params;
    const db = await getDatabase();
    const collection = db.collection('invoices_v2');

    const invoice = await collection.findOne({ id: invoiceId });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json(invoice);
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

/**
 * GET /api/invoices/order/:orderId
 * Get invoice for a specific order
 */
router.get('/invoices/order/:orderId', async (req: Request, res: Response) => {
  try {
    const userId = getAuthUser(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { orderId } = req.params;
    const db = await getDatabase();
    const collection = db.collection('invoices_v2');

    const invoice = await collection.findOne({ orderId });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found for this order' });
    }

    res.json(invoice);
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

/**
 * GET /api/invoices/:invoiceId/download
 * Download invoice as PDF
 */
router.get('/invoices/:invoiceId/download', async (req: Request, res: Response) => {
  try {
    const userId = getAuthUser(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { invoiceId } = req.params;
    const db = await getDatabase();
    const collection = db.collection('invoices_v2');

    const invoice = await collection.findOne({ id: invoiceId });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // In production, generate actual PDF using pdfkit or similar
    const textContent = generateInvoiceText(invoice);
    const pdfBuffer = Buffer.from(textContent, 'utf-8');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${invoice.invoiceNumber}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error downloading invoice:', error);
    res.status(500).json({ error: 'Failed to download invoice' });
  }
});

/**
 * POST /api/invoices/:invoiceId/email
 * Email invoice to customer
 */
router.post('/invoices/:invoiceId/email', async (req: Request, res: Response) => {
  try {
    const userId = getAuthUser(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { invoiceId } = req.params;
    const { email } = req.body;

    const db = await getDatabase();
    const collection = db.collection('invoices_v2');
    const invoice = await collection.findOne({ id: invoiceId });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // In production, use email service to send invoice
    console.log(`📧 Sending invoice ${invoiceId} to ${email}`);

    res.json({ success: true, message: 'Invoice sent to email' });
  } catch (error) {
    console.error('Error emailing invoice:', error);
    res.status(500).json({ error: 'Failed to send invoice' });
  }
});

/**
 * GET /api/invoices
 * Get all invoices for customer
 */
router.get('/invoices', async (req: Request, res: Response) => {
  try {
    const userId = getAuthUser(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const db = await getDatabase();
    const collection = db.collection('invoices_v2');

    const allInvoices = await collection
      .find({ customerId: userId })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    const total = await collection.countDocuments({ customerId: userId });

    res.json({
      invoices: allInvoices,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

/**
 * Helper function to generate invoice text
 */
function generateInvoiceText(invoice: any): string {
  const lines = [
    '═════════════════════════════════════',
    '                INVOICE               ',
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

  invoice.billItems?.forEach((item) => {
    lines.push(`${item.description}`);
    lines.push(`  Qty: ${item.quantity} × ₹${item.rate} = ₹${item.amount}`);
  });

  lines.push('');
  lines.push('─────────────────────────────────────');
  lines.push(`Subtotal:              ₹${invoice.amount}`);
  if (invoice.discount > 0) {
    lines.push(`Discount:              -₹${invoice.discount}`);
  }
  lines.push(`Tax (GST):             ₹${invoice.taxAmount}`);
  lines.push('─────────────────────────────────────');
  lines.push(`TOTAL:                 ₹${invoice.totalAmount}`);
  lines.push('─────────────────────────────────────');
  lines.push('');
  lines.push(`Payment Method: ${invoice.paymentMethod}`);
  lines.push(`Payment ID: ${invoice.paymentId}`);
  lines.push('');
  lines.push('Thank you for your business!');
  lines.push('═════════════════════════════════════');

  return lines.join('\n');
}

export default router;
