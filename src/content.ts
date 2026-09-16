export interface CouponContent {
  code: string;
  label: string;
  discount: number;
  service?: string;
  firstBooking?: boolean;
}

export interface AppContent {
  coupons: CouponContent[];
  brand: { name: string; tagline: string; city: string };
  customer: {
    nav: { offers: string; track: string; support: string; home: string; book: string; orders: string };
    hero: { eyebrow: string; title: string; description: string; promise: string; eta: string; locationLabel: string };
    actions: { water: string; waterMeta: string; sewage: string; sewageMeta: string; repeat: string; repeatMeta: string };
    booking: { eyebrow: string; title: string; description: string; cta: string };
    tracking: { eyebrow: string; title: string; emptyTitle: string; emptyDescription: string };
    how: { eyebrow: string; title: string; steps: Array<{ number: string; title: string; description: string }> };
    essentials: { eyebrow: string; title: string; addresses: string; orders: string; support: string };
    form: { serviceStep: string; serviceHelp: string; detailStep: string; detailHelp: string; capacityStep: string; capacityHelp: string; deliveryStep: string; deliveryHelp: string; waterType: string; serviceRequirement: string; capacity: string; address: string; addressHelp: string; landmark: string; instructions: string; estimate: string; finalPrice: string; continue: string; waterServiceHelp: string; sewageServiceHelp: string; waterTypes: string[]; sewageTypes: string[]; capacities: string[] };
    support: { eyebrow: string; title: string; description: string; message: string; messageDescription: string; call: string; callDescription: string };
  };
  auth: { eyebrow: string; title: string; description: string; registerTitle: string; registerDescription: string; google: string; emailDivider: string; remember: string; register: string; signIn: string; toggleRegister: string; toggleSignIn: string; phoneHelp: string; authNote: string };
  operations: { searchPlaceholder: string; workspaceLabel: string; trustedTitle: string; trustedDescription: string; settings: string; notificationLabel: string; openNavigation: string; customerView: string; vendorPortal: string; adminCommandCentre: string; overview: string; bookTanker: string; orders: string; liveTracking: string; helpSupport: string; signOut: string; locationLabel: string; useCurrentLocation: string; refreshLocation: string };
  checkout: { eyebrow: string; title: string; description: string; payment: string; pay: string; note: string };
  vendor: { eyebrow: string; title: string; description: string; shareLocation: string; protocol: string; protocolTitle: string };
  admin: { eyebrow: string; title: string; description: string; refresh: string; createOrder: string; orders: string; bookingControl: string; export: string };
  loading: string;
}

export const defaultContent: AppContent = {
  coupons: [],
  brand: { name: 'Urban Tanker', tagline: 'Water & wastewater services, simplified.', city: 'Chennai operations' },
  customer: {
    nav: { offers: 'Offers', track: 'Track order', support: 'Help & support', home: 'Home', book: 'Book', orders: 'Orders' },
    hero: { eyebrow: 'Water & wastewater services, simplified', title: 'Water arrives when you need it.', description: 'Book trusted water or sewage tankers, choose a convenient slot, pay securely, and track every delivery.', promise: 'Clear price. Clear ETA.', eta: 'Live tracking', locationLabel: 'Delivering to' },
    actions: { water: 'Book Water Tanker', waterMeta: 'Potable, domestic & borewell water', sewage: 'Book Sewage Tanker', sewageMeta: 'Septic tank & sewage removal', repeat: 'Book again', repeatMeta: 'LAST ORDER · 12 KL WATER TANKER' },
    booking: { eyebrow: 'New booking', title: 'Plan your delivery in minutes.', description: 'Choose a service, a preferred delivery slot, and the right tanker capacity.', cta: 'Start a booking' },
    tracking: { eyebrow: 'Stay in the loop', title: 'Track every delivery.', emptyTitle: 'No active booking yet', emptyDescription: 'Your next delivery and live updates will appear here.' },
    how: { eyebrow: 'Simple by design', title: 'From request to receipt.', steps: [{ number: '01', title: 'Book', description: 'Select your service, delivery time, and location.' }, { number: '02', title: 'Match', description: 'A nearby verified vendor accepts your job.' }, { number: '03', title: 'Track', description: 'Follow the journey and get status updates.' }, { number: '04', title: 'Confirm', description: 'Share your delivery OTP and receive an invoice.' }] },
    essentials: { eyebrow: 'More for regular customers', title: 'Your Urban Tanker essentials.', addresses: 'Saved addresses', orders: 'My orders', support: 'Help & support' },
    form: { serviceStep: 'Choose your service', serviceHelp: 'We match capacity and vehicle type to your request.', detailStep: 'Water type', detailHelp: 'Help your driver arrive prepared.', capacityStep: 'Capacity and timing', capacityHelp: 'Select the right size for your location.', deliveryStep: 'Where should we deliver?', deliveryHelp: 'Give the driver enough detail for a smooth handover.', waterType: 'Water type', serviceRequirement: 'Service requirement', capacity: 'Tanker capacity', address: 'Delivery address', addressHelp: 'Use your current location, or enter your delivery address.', landmark: 'Landmark', instructions: 'Special instructions', estimate: 'Estimated price', finalPrice: 'Final price shown before payment. No surprise charges.', continue: 'Continue to payment', waterServiceHelp: 'For homes, offices and sites', sewageServiceHelp: 'Septic and wastewater removal', waterTypes: ['Drinking / potable', 'Domestic', 'Borewell', 'Other'], sewageTypes: ['Septic tank cleaning', 'Sewage removal', 'Drain cleaning'], capacities: ['3 KL', '6 KL', '9 KL', '12 KL', '16 KL'] },
    support: { eyebrow: 'Customer support', title: 'How can we help?', description: 'Our Chennai team is available for bookings, payments, tanker access, and account questions.', message: 'Message support', messageDescription: 'Describe the issue and include your order ID.', call: 'Call dispatch', callDescription: 'For an active delivery, connect directly with our operations desk.' }
  },
  auth: { eyebrow: 'Secure access', title: 'Welcome back to Urban Tanker.', description: 'Sign in to continue to your workspace.', registerTitle: 'Create your Urban Tanker account.', registerDescription: 'Register as a customer, vendor, or administrator.', google: 'Continue with Google', emailDivider: 'or use email and password', remember: 'Remember me on this device', register: 'Register', signIn: 'Sign in', toggleRegister: 'New to Urban Tanker? Register here', toggleSignIn: 'Already have an account? Sign in', phoneHelp: 'Required for delivery updates and account recovery.', authNote: 'Firebase Auth protects your account. Workspace permissions must be enforced with Firebase custom claims.' },
  operations: { searchPlaceholder: 'Search bookings, customers, tankers', workspaceLabel: 'Workspace', trustedTitle: 'Trusted delivery', trustedDescription: 'OTP protected handovers', settings: 'Settings', notificationLabel: 'Notifications', openNavigation: 'Open navigation', customerView: 'Customer view', vendorPortal: 'Vendor portal', adminCommandCentre: 'Admin command centre', overview: 'Overview', bookTanker: 'Book a tanker', orders: 'Orders', liveTracking: 'Live tracking', helpSupport: 'Help & support', signOut: 'Sign out', locationLabel: 'Delivering to', useCurrentLocation: 'Use your current delivery location', refreshLocation: 'Refresh current location' },
  checkout: { eyebrow: 'Confirm booking', title: 'Almost there.', description: 'Review your service details and choose a payment method.', payment: 'Payment method', pay: 'Pay securely', note: 'Demo checkout only. Production payments should be verified server-side.' },
  vendor: { eyebrow: 'Vendor portal · BlueDrop Tankers', title: 'Keep every delivery moving.', description: 'Accept new bookings quickly, keep the customer updated, and complete delivery with their OTP.', shareLocation: 'Share location', protocol: 'Delivery protocol', protocolTitle: 'Protect every handover.' },
  admin: { eyebrow: 'Network intelligence · September 2026', title: 'Welcome back, Admin.', description: 'Monitor bookings, operations, revenue, and tanker activity across Chennai.', refresh: 'Refresh', createOrder: 'Create test order', orders: 'Orders', bookingControl: 'Booking control', export: 'Export report' },
  loading: 'Connecting to secure operations data...'
};
