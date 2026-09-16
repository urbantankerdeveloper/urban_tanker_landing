# Urban Tanker Operations

Modern React/Vite implementation of the Urban Tanker prototype. It covers the customer booking and tracking workflow, vendor dispatch workflow, and admin operations dashboard in one responsive application.

## Component structure

- `src/main.tsx` owns application state and role-level routing.
- `src/components/AppShell.tsx` owns the shared top bar, navigation, and workspace chrome.
- `src/components/ui.tsx` contains reusable headers, buttons, status pills, and stat cards.
- `src/components/Toast.tsx` owns transient feedback announcements.
- `src/components/AuthScreen.tsx` owns the accessible customer, vendor, and admin entry screen.
- `src/components/CustomerPortal.tsx` owns booking, quotes, tracking, orders, and support.
- `src/components/VendorPortal.tsx` owns dispatch, location sharing, and delivery completion.
- `src/components/AdminDashboard.tsx` owns operations KPIs, insights, and booking control.
- `src/components/CheckoutModal.tsx` owns the accessible payment confirmation dialog.
- `src/hooks/useApi.ts` owns typed `GET`, `POST`, `PUT`, `PATCH`, and `DELETE` requests with Zustand-backed loading, data, and error state.
- `src/firebase.ts` and `src/cloudStore.ts` own Firebase initialization and Firestore synchronization.
- `src/styles.scss` contains the responsive visual system shared by all roles.

## Run locally

```sh
npm install
npm run dev
```

`npm run dev` opens the default Urban Tanker customer home page. Use the role-specific development commands when reviewing a portal:

```sh
npm run dev:customer
npm run dev:vendor
npm run dev:admin
```

Run `npm run typecheck` to validate the TypeScript source without emitting files.
Run `npm run lint` to validate React hooks, TypeScript, and component export conventions.

## HTTP requests

Use the API hook from any component or feature hook:

```tsx
const ordersApi = useApi<Order[]>('orders');
const orders = await ordersApi.get('/orders', { query: { status: 'active' } });
await ordersApi.post('/orders', { service: 'Water tanker', capacity: '6 KL' });
```

Set `VITE_API_BASE_URL` for an external API. Without it, requests use the same-origin `/api` path. Requests automatically serialize JSON bodies, preserve `FormData`, expose loading and errors through Zustand, and cancel the previous request for the same hook instance.

For production server mode, build the app and serve the generated bundle:

```sh
npm run build
npm start
```

The development server runs on `http://localhost:5173`. Production preview runs on `http://localhost:4173`. Both bind to `0.0.0.0` so they can be opened from another device on the same network.

Use the workspace switcher in the left navigation to move between Customer, Vendor, and Admin views. Demo state is persisted in browser local storage so a booking created in Customer view is immediately available to Vendor and Admin.

## Firebase setup

1. Create or select the Firebase project used by the app and register a Firebase Web App.
2. Enable Email/Password and Google providers under Firebase Authentication.
3. Create a Firestore database and deploy the included rules with `firebase deploy --only firestore:rules`.
4. Copy `.env.example` to `.env.local` and fill in the Web App configuration values, including `VITE_FIREBASE_MEASUREMENT_ID` when Analytics is enabled.
5. Set `VITE_CONTENT_CLIENT_ID` to the client document ID, for example `acme-water`.
6. Run `npm install`, then `npm run dev` or `npm run build`.

When Firebase variables are present, the app authenticates with Google or email/password and synchronizes each user's state under `users/{uid}/state/urban-tanker`. UI content is read from `content/{VITE_CONTENT_CLIENT_ID}` before login, updated live with `onSnapshot`, and encrypted in local storage under a client-specific cache key for startup/offline fallback. Without Firebase variables, the app stays usable with the built-in defaults and local state. The current state document is still a prototype store; production orders, payments, OTP validation, vendor assignment, and status transitions must be handled by authenticated server APIs.

Static UI content is stored in the public-read Firestore document `content/{clientId}`. Copy the complete structure from `firebase-content.seed.json` into each client document and update the additional `operations` and `customer.form` fields when customizing navigation or booking options. The app hydrates it into Zustand through `useContent`, while `src/content.ts` supplies defaults for missing fields. Only users with the Firebase custom claim `role: "admin"` can update content documents.

For example, create these separate documents for separate clients:

```text
content/acme-water
content/chennai-municipal
content/demo
```

Each deployed client sets its own `VITE_CONTENT_CLIENT_ID`; no frontend rebuild is needed when that client’s text is edited in Firestore, because active sessions receive updates in real time.

### Updating Firebase sign-in details

The `updateUserSignIn` HTTPS function accepts an authenticated `POST` request. The frontend API helper automatically adds the current Firebase ID token as a bearer token.

```ts
const accountApi = useApi('account');
await accountApi.post('/updateUserSignIn', {
	email: 'new-address@example.com',
	password: 'a-new-password-123'
});
```

Set `VITE_API_BASE_URL` to the deployed Functions base URL. Do not hash passwords in the browser or store them in Firestore. The request is protected by HTTPS, and Firebase Authentication hashes and stores the password internally. The function accepts a minimum of eight characters and allows a user to update their own account; an authenticated user with the `admin` custom claim may include another user's `uid`.

### Razorpay payments

Razorpay uses two authenticated HTTPS functions: `createRazorpayOrder` and `verifyRazorpayPayment`. The browser never receives the Razorpay secret. Before deploying Functions, create `functions/.env` from `functions/.env.example` and set the server-only values:

```env
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_server_only_secret
ALLOWED_ORIGIN=https://urban-tanker-landing.web.app
```

Deploy the payment functions with:

```sh
firebase deploy --only functions:createRazorpayOrder,functions:verifyRazorpayPayment
```

The frontend creates the Razorpay order server-side, opens Razorpay Checkout, and marks the booking as paid only after the server verifies the Razorpay HMAC signature. Cash-on-delivery remains available without Razorpay.

Firebase data lifecycle:

- The application shows an accessible loading skeleton until the first Firestore snapshot is received.
- A temporary AES-GCM encrypted cache is stored in localStorage with a five-minute TTL.
- The application decrypts and uses the cache only as a temporary startup fallback while Firebase is reconnecting.
- An expired cache triggers a Firestore refresh and the refreshed state replaces the encrypted cache.
- The encryption key is kept in sessionStorage, so the cache cannot be decrypted outside the current browser session. This protects cached content at rest from casual inspection, but it is not a substitute for server-side authorization or encryption.

## Firebase Hosting

Build with `npm run build`, then run `firebase init hosting` once for the Firebase project and deploy with `firebase deploy --only hosting`. The included `firebase.json` serves `dist` and rewrites application routes to `index.html`.

## Production handoff

This is a frontend workflow prototype. Replace the local-storage store with authenticated server APIs before deployment. Payment verification, OTP validation, role permissions, vendor links, live location, and order status transitions must be enforced server-side. See the reference handoff in the archived application for the required route and security checklist.