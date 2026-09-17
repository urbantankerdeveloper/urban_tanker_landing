/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {applicationDefault, getApps, initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getDatabase} from "firebase-admin/database";
import {createHash, createHmac, randomBytes, scryptSync, timingSafeEqual} from "node:crypto";
import type {Request} from "express";
import {setGlobalOptions} from "firebase-functions";
import {onRequest} from "firebase-functions/https";
import {onValueWritten} from "firebase-functions/v2/database";

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({maxInstances: 10});

if (!getApps().length) {
	const projectId = process.env.GCLOUD_PROJECT || 'urban-tanker-landing';
	initializeApp({credential: applicationDefault(), databaseURL: process.env.FIREBASE_DATABASE_URL || `https://${projectId}-default-rtdb.firebaseio.com`});
}

type NotificationOrder = {id?: string; service?: string; capacity?: string; address?: string; customer?: string; customerEmail?: string; vendor?: string; vendorEmail?: string; vendorPhone?: string; vendorLatitude?: number; vendorLongitude?: number; amount?: number; status?: string};

async function sendOrderEmail(to: string | undefined, subject: string, html: string): Promise<void> {
	const apiKey = process.env.RESEND_API_KEY;
	const from = process.env.MAIL_FROM;
	if (!apiKey || !from || !to) {
		console.warn('Order email skipped: configure RESEND_API_KEY, MAIL_FROM, and a recipient.');
		return;
	}
	const response = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json'},
		body: JSON.stringify({from, to: [to], subject, html})
	});
	if (!response.ok) throw new Error(`Email provider returned ${response.status}.`);
}

export const notifyOrderEmail = onValueWritten('customers/{customerId}/operations/orders/{orderId}', async event => {
	const before = event.data.before.val() as NotificationOrder | null;
	const after = event.data.after.val() as NotificationOrder | null;
	if (!after) return;
	const orderId = after.id || event.params.orderId;
	const details = `<p><strong>Service:</strong> ${after.service || 'Tanker service'}</p><p><strong>Capacity:</strong> ${after.capacity || '—'}</p><p><strong>Delivery:</strong> ${after.address || '—'}</p><p><strong>Amount:</strong> ₹${Number(after.amount || 0).toLocaleString('en-IN')}</p>`;
	if (!before) {
		await sendOrderEmail(after.customerEmail, `Urban Tanker booking confirmed · ${orderId}`, `<h2>Booking confirmed</h2><p>Hello ${after.customer || 'customer'},</p>${details}<p>We will notify you when a vendor accepts the booking.</p>`);
		return;
	}
	if (before.status !== 'Vendor accepted' && after.status === 'Vendor accepted') {
		const vendorLocation = typeof after.vendorLatitude === 'number' && typeof after.vendorLongitude === 'number' ? `${after.vendorLatitude},${after.vendorLongitude}` : '';
		const trackingLink = vendorLocation ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(vendorLocation)}&destination=${encodeURIComponent(after.address || '')}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(after.address || '')}`;
		const contact = `<p><strong>Vendor:</strong> ${after.vendor || 'Assigned vendor'}${after.vendorPhone ? ` · <a href="tel:${after.vendorPhone}">${after.vendorPhone}</a>` : ''}</p><p><a href="${trackingLink}">Track vendor route to your location</a></p>`;
		await sendOrderEmail(after.customerEmail, `Vendor accepted your booking · ${orderId}`, `<h2>Your vendor accepted the booking</h2><p>Hello ${after.customer || 'customer'},</p>${details}${contact}<p>The vendor has accepted your booking and the tracking link shows the current route to your delivery location.</p>`);
	}
});

function hashPassword(password: string, salt = randomBytes(16).toString('hex')): string {
	return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

function verifyPassword(password: string, stored: string): boolean {
	const [salt, expectedHex] = stored.split(':');
	if (!salt || !expectedHex) return false;
	const expected = Buffer.from(expectedHex, 'hex');
	const actual = scryptSync(password, salt, expected.length);
	return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function hashResetToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

function databaseUserPath(clientId: string, uid: string): string {
	return `customers/${clientId}/users/${uid}`;
}

export const signInWithDatabaseCredentials = onRequest({invoker: 'public'}, async (request, response) => {
	setCorsHeaders(response, request);
	if (request.method === 'OPTIONS') { response.status(204).send(''); return; }
	if (request.method !== 'POST') { response.status(405).json({message: 'Only POST requests are supported.'}); return; }
	try {
		const body = request.body && typeof request.body === 'object' ? request.body as {action?: unknown; clientId?: unknown; email?: unknown; password?: unknown; displayName?: unknown; phone?: unknown; role?: unknown} : {};
		const action = body.action === 'register' ? 'register' : 'login';
		const clientId = typeof body.clientId === 'string' ? body.clientId.trim() : '';
		const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
		const password = typeof body.password === 'string' ? body.password : '';
		if (!clientId || !email || password.length < 8) { response.status(400).json({message: 'Client ID, email, and a password of at least 8 characters are required.'}); return; }
		const database = getDatabase();
		const usersSnapshot = await database.ref(`customers/${clientId}/authUsers`).get();
		const users = usersSnapshot.val() as Record<string, {email?: string; passwordHash?: string; role?: string; name?: string; phone?: string}> | null;
		const existing = Object.entries(users || {}).find(([, user]) => user.email === email);
		if (action === 'register') {
			if (body.role !== 'customer') { response.status(403).json({message: 'Only customer accounts can self-register.'}); return; }
			if (existing) { response.status(409).json({message: 'That email address is already registered.'}); return; }
			const uid = database.ref(`customers/${clientId}/authUsers`).push().key!;
			const name = typeof body.displayName === 'string' && body.displayName.trim() ? body.displayName.trim() : email.split('@')[0];
			const phone = typeof body.phone === 'string' ? body.phone : '';
			const user = {email, passwordHash: hashPassword(password), role: 'customer', name, phone, clientId, createdAt: Date.now()};
			await database.ref(databaseUserPath(clientId, uid)).set({auth: user, profile: {name, email, phone, role: 'customer', clientId, createdAt: user.createdAt, updatedAt: user.createdAt}});
			const customToken = await getAuth().createCustomToken(uid, {role: 'customer', clientId});
			response.status(201).json({customToken, user: {uid, email, displayName: name, phoneNumber: phone, role: 'customer'}});
			return;
		}
		if (!existing || !existing[1].passwordHash || !verifyPassword(password, existing[1].passwordHash)) { response.status(401).json({message: 'Invalid email or password.'}); return; }
		const [uid, stored] = existing;
		if (body.role !== stored.role || stored.role !== 'customer' && stored.role !== 'vendor' && stored.role !== 'admin') { response.status(403).json({message: `This account is registered as ${stored.role || 'unknown'}. Select the matching role.`}); return; }
		const customToken = await getAuth().createCustomToken(uid, {role: stored.role, clientId});
		response.status(200).json({customToken, user: {uid, email: stored.email, displayName: stored.name || stored.email?.split('@')[0], phoneNumber: stored.phone || null, role: stored.role}});
	} catch (error) {
		console.error('Database credential auth error:', error);
		response.status(500).json({message: 'Unable to authenticate with the client database.'});
	}
});

export const registerWithDatabaseCredentials = onRequest({invoker: 'public'}, async (request, response) => {
	setCorsHeaders(response, request);
	if (request.method === 'OPTIONS') { response.status(204).send(''); return; }
	if (request.method !== 'POST') { response.status(405).json({message: 'Only POST requests are supported.'}); return; }
	try {
		const body = request.body && typeof request.body === 'object' ? request.body as {clientId?: unknown; email?: unknown; password?: unknown; displayName?: unknown; phone?: unknown; role?: unknown} : {};
		const clientId = typeof body.clientId === 'string' ? body.clientId.trim() : '';
		const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
		const password = typeof body.password === 'string' ? body.password : '';
		if (!clientId || !email || password.length < 8 || body.role !== 'customer') { response.status(400).json({message: 'Client ID, customer role, email, and a password of at least 8 characters are required.'}); return; }
		const database = getDatabase();
		const authUsersRef = database.ref(`customers/${clientId}/authUsers`);
		const users = (await authUsersRef.get()).val() as Record<string, {email?: string}> | null;
		if (Object.values(users || {}).some(user => user.email === email)) { response.status(409).json({message: 'That email address is already registered.'}); return; }
		const uid = authUsersRef.push().key!;
		const name = typeof body.displayName === 'string' && body.displayName.trim() ? body.displayName.trim() : email.split('@')[0];
		const phone = typeof body.phone === 'string' ? body.phone : '';
		const now = Date.now();
		const user = {email, passwordHash: hashPassword(password), role: 'customer', name, phone, clientId, createdAt: now};
		await database.ref(databaseUserPath(clientId, uid)).set({auth: user, profile: {name, email, phone, role: 'customer', clientId, createdAt: now, updatedAt: now}});
		const customToken = await getAuth().createCustomToken(uid, {role: 'customer', clientId});
		response.status(201).json({customToken, user: {uid, email, displayName: name, phoneNumber: phone, role: 'customer'}});
	} catch (error) {
		console.error('Database registration error:', error);
		response.status(500).json({message: 'Unable to register with the client database.'});
	}
});

export const resetDatabasePassword = onRequest({invoker: 'public'}, async (request, response) => {
	setCorsHeaders(response, request);
	if (request.method === 'OPTIONS') { response.status(204).send(''); return; }
	if (request.method !== 'POST') { response.status(405).json({message: 'Only POST requests are supported.'}); return; }
	try {
		const body = request.body && typeof request.body === 'object' ? request.body as {action?: unknown; clientId?: unknown; email?: unknown; token?: unknown; password?: unknown} : {};
		const action = body.action === 'complete' ? 'complete' : 'request';
		const clientId = typeof body.clientId === 'string' ? body.clientId.trim() : '';
		const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
		const database = getDatabase();
		const authUsersRef = database.ref(`customers/${clientId}/authUsers`);
		const users = (await authUsersRef.get()).val() as Record<string, {email?: string; passwordHash?: string; resetTokenHash?: string; resetExpiresAt?: number}> | null;
		const existing = Object.entries(users || {}).find(([, user]) => user.email === email);
		if (action === 'request') {
			if (clientId && email && existing) {
				const token = randomBytes(32).toString('hex');
				await authUsersRef.child(existing[0]).update({resetTokenHash: hashResetToken(token), resetExpiresAt: Date.now() + 15 * 60 * 1000});
				const resetUrl = `https://urban-tanker-landing.web.app/?resetToken=${encodeURIComponent(token)}&resetEmail=${encodeURIComponent(email)}&resetClient=${encodeURIComponent(clientId)}`;
				await sendOrderEmail(email, 'Reset your Urban Tanker password', `<h2>Reset your password</h2><p>This link expires in 15 minutes.</p><p><a href="${resetUrl}">Reset password</a></p>`);
			}
			response.status(200).json({message: 'If the account exists, a reset link has been sent.'});
			return;
		}
		const token = typeof body.token === 'string' ? body.token : '';
		const password = typeof body.password === 'string' ? body.password : '';
		if (!existing || password.length < 8 || !token || existing[1].resetTokenHash !== hashResetToken(token) || Number(existing[1].resetExpiresAt || 0) < Date.now()) {
			response.status(400).json({message: 'This password reset link is invalid or expired.'});
			return;
		}
		await authUsersRef.child(existing[0]).update({passwordHash: hashPassword(password), resetTokenHash: null, resetExpiresAt: null});
		response.status(200).json({message: 'Password reset successfully.'});
	} catch (error) {
		console.error('Password reset error:', error);
		response.status(500).json({message: 'Unable to reset the password.'});
	}
});

function setCorsHeaders(response: {set: (field: string, value: string) => unknown}, request?: Request): void {
	const allowedOrigins = (process.env.ALLOWED_ORIGIN || 'https://urban-tanker-landing.web.app,http://localhost:5173,http://localhost:5174').split(',').map(origin => origin.trim());
	const requestOrigin = request?.get('Origin');
	response.set('Access-Control-Allow-Origin', requestOrigin && allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0]);
	response.set('Vary', 'Origin');
	response.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
	response.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

function getBearerToken(authorization: string | undefined): string | null {
	if (!authorization?.startsWith('Bearer ')) return null;
	return authorization.slice('Bearer '.length).trim() || null;
}

async function verifyCaller(request: Request) {
	const token = getBearerToken(request.get('Authorization'));
	if (!token) throw new Error('AUTH_REQUIRED');
	return getAuth().verifyIdToken(token);
}

export const createUserWithRole = onRequest({invoker: 'public'}, async (request, response) => {
	setCorsHeaders(response, request);
	if (request.method === 'OPTIONS') { response.status(204).send(''); return; }
	if (request.method !== 'POST') { response.status(405).json({message: 'Only POST requests are supported.'}); return; }
	try {
		const caller = await verifyCaller(request);
		const body = request.body && typeof request.body === 'object' ? request.body as {clientId?: unknown; name?: unknown; email?: unknown; phone?: unknown; password?: unknown; role?: unknown} : {};
		const clientId = typeof body.clientId === 'string' ? body.clientId.trim() : '';
		const name = typeof body.name === 'string' ? body.name.trim() : '';
		const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
		const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
		const password = typeof body.password === 'string' ? body.password : '';
		const role = body.role === 'customer' || body.role === 'vendor' || body.role === 'admin' ? body.role : '';
		if (caller.clientId !== clientId || caller.role !== 'admin') { response.status(403).json({message: 'Only an administrator from this client can create users.'}); return; }
		if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || !role) { response.status(400).json({message: 'Name, valid email, role, and a password of at least 8 characters are required.'}); return; }
		const database = getDatabase();
		const authUsersRef = database.ref(`customers/${clientId}/authUsers`);
		const snapshot = await authUsersRef.get();
		const users = snapshot.val() as Record<string, {email?: string}> | null;
		if (Object.values(users || {}).some(user => user.email === email)) { response.status(409).json({message: 'That email address is already registered for this client.'}); return; }
		const uid = authUsersRef.push().key!;
		const now = Date.now();
		const user = {email, passwordHash: hashPassword(password), role, name, phone, clientId, createdAt: now};
		await database.ref(databaseUserPath(clientId, uid)).set({auth: user, profile: {name, email, phone, role, clientId, createdAt: now, updatedAt: now}});
		if (role === 'vendor') await database.ref(`customers/${clientId}/operations/vendors/${uid}`).set({uid, name, email, phone, status: 'Online', available: true, updatedAt: now});
		response.status(201).json({uid, clientId, name, email, phone, role});
	} catch (error) {
		const message = error instanceof Error ? error.message : '';
		response.status(message === 'AUTH_REQUIRED' ? 401 : 500).json({message: message === 'AUTH_REQUIRED' ? 'A Firebase ID token is required.' : 'Unable to create the user.'});
	}
});

export const updateUserSignIn = onRequest(async (request, response) => {
	setCorsHeaders(response, request);
	if (request.method === 'OPTIONS') {
		response.status(204).send('');
		return;
	}
	if (request.method !== 'POST') {
		response.status(405).json({message: 'Only POST requests are supported.'});
		return;
	}

	try {
		const token = getBearerToken(request.get('Authorization'));
		if (!token) {
			response.status(401).json({message: 'A Firebase ID token is required.'});
			return;
		}
		const caller = await getAuth().verifyIdToken(token);
		const body = request.body && typeof request.body === 'object' ? request.body as {email?: unknown; password?: unknown; uid?: unknown} : {};
		const targetUid = typeof body.uid === 'string' && caller.role === 'admin' ? body.uid : caller.uid;
		const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : undefined;
		const password = typeof body.password === 'string' ? body.password : undefined;

		if (!email && !password) {
			response.status(400).json({message: 'Provide an email, password, or both.'});
			return;
		}
		if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			response.status(400).json({message: 'Enter a valid email address.'});
			return;
		}
		if (password && password.length < 8) {
			response.status(400).json({message: 'Password must contain at least 8 characters.'});
			return;
		}

		const updatedUser = await getAuth().updateUser(targetUid, {
			...(email ? {email} : {}),
			...(password ? {password} : {})
		});
		response.status(200).json({uid: updatedUser.uid, email: updatedUser.email || null});
	} catch (error) {
		const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
		if (code === 'auth/id-token-expired' || code === 'auth/invalid-id-token') {
			response.status(401).json({message: 'Your Firebase session has expired. Sign in again.'});
			return;
		}
		if (code === 'auth/email-already-exists') {
			response.status(409).json({message: 'That email address is already in use.'});
			return;
		}
		if (code === 'auth/user-not-found') {
			response.status(404).json({message: 'User account was not found.'});
			return;
		}
		response.status(500).json({message: 'Unable to update sign-in details.'});
	}
});

export const createRazorpayOrder = onRequest(async (request, response) => {
	setCorsHeaders(response, request);
	if (request.method === 'OPTIONS') {
		response.status(204).send('');
		return;
	}
	if (request.method !== 'POST') {
		response.status(405).json({message: 'Only POST requests are supported.'});
		return;
	}

	try {
		await verifyCaller(request);
		const keyId = process.env.RAZORPAY_KEY_ID;
		const keySecret = process.env.RAZORPAY_KEY_SECRET;
		if (!keyId || !keySecret) {
			response.status(503).json({message: 'Razorpay is not configured on the server.'});
			return;
		}
		const body = request.body && typeof request.body === 'object' ? request.body as {amount?: unknown; receipt?: unknown} : {};
		const amount = typeof body.amount === 'number' && Number.isInteger(body.amount) ? body.amount : 0;
		const receipt = typeof body.receipt === 'string' ? body.receipt.slice(0, 40) : `urban-tanker-${Date.now()}`;
		if (amount < 100) {
			response.status(400).json({message: 'Payment amount must be at least INR 1.'});
			return;
		}

		const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
			method: 'POST',
			headers: {
				Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({amount, currency: 'INR', receipt, payment_capture: 1})
		});
		if (!razorpayResponse.ok) {
			response.status(502).json({message: 'Razorpay could not create the payment order.'});
			return;
		}
		const order = await razorpayResponse.json() as {id: string; amount: number; currency: string};
		response.status(200).json({orderId: order.id, amount: order.amount, currency: order.currency, keyId});
	} catch (error) {
		response.status(error instanceof Error && error.message === 'AUTH_REQUIRED' ? 401 : 500).json({message: error instanceof Error && error.message === 'AUTH_REQUIRED' ? 'A Firebase ID token is required.' : 'Unable to create the payment order.'});
	}
});

export const verifyRazorpayPayment = onRequest(async (request, response) => {
	setCorsHeaders(response, request);
	if (request.method === 'OPTIONS') {
		response.status(204).send('');
		return;
	}
	if (request.method !== 'POST') {
		response.status(405).json({message: 'Only POST requests are supported.'});
		return;
	}

	try {
		await verifyCaller(request);
		const secret = process.env.RAZORPAY_KEY_SECRET;
		const body = request.body && typeof request.body === 'object' ? request.body as {razorpayOrderId?: unknown; razorpayPaymentId?: unknown; razorpaySignature?: unknown} : {};
		const orderId = typeof body.razorpayOrderId === 'string' ? body.razorpayOrderId : '';
		const paymentId = typeof body.razorpayPaymentId === 'string' ? body.razorpayPaymentId : '';
		const signature = typeof body.razorpaySignature === 'string' ? body.razorpaySignature : '';
		if (!secret || !orderId || !paymentId || !signature) {
			response.status(400).json({message: 'Incomplete Razorpay payment details.'});
			return;
		}
		const expected = createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
		const valid = expected.length === signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
		if (!valid) {
			response.status(400).json({message: 'Razorpay payment verification failed.'});
			return;
		}
		response.status(200).json({verified: true, paymentId, orderId});
	} catch (error) {
		response.status(error instanceof Error && error.message === 'AUTH_REQUIRED' ? 401 : 500).json({message: error instanceof Error && error.message === 'AUTH_REQUIRED' ? 'A Firebase ID token is required.' : 'Unable to verify the payment.'});
	}
});
