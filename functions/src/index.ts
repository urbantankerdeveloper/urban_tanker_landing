/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {getApps, initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {createHmac, timingSafeEqual} from "node:crypto";
import type {Request} from "express";
import {setGlobalOptions} from "firebase-functions";
import {onRequest} from "firebase-functions/https";

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

if (!getApps().length) initializeApp();

function setCorsHeaders(response: {set: (field: string, value: string) => unknown}): void {
	response.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
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

export const updateUserSignIn = onRequest(async (request, response) => {
	setCorsHeaders(response);
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
	setCorsHeaders(response);
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
	setCorsHeaders(response);
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
