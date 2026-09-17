import type { AppData, Role } from '../lib/types';

const modeRole = import.meta.env.MODE === 'vendor' || import.meta.env.MODE === 'admin' ? import.meta.env.MODE : 'customer';

export const initialState: AppData = {
  role: modeRole as Role,
  profile: null,
  location: { address: 'ECR, Chennai', latitude: null, longitude: null, accuracy: null, permission: 'prompt', updatedAt: null },
  booking: { service: 'Water tanker', waterType: 'Drinking / potable', capacity: '6 KL', date: new Date().toISOString().slice(0, 10), slot: 'As soon as possible', address: '18 Lakeview Apartments, Indiranagar', landmark: 'Gate 2', notes: '' },
  orders: [
    { id: 'AF-260901', service: 'Water tanker', capacity: '6 KL', address: '18 Lakeview Apartments, Indiranagar', customer: 'Aarav Mehta', amount: 1250, status: 'En route', vendor: 'BlueDrop Tankers', driver: 'Ravi Kumar', eta: '18 min', payment: 'Paid', created: 'Today, 8:10 AM' },
    { id: 'AF-260874', service: 'Sewage pickup', capacity: '6 KL', address: '22 Palm Grove, Adyar', customer: 'Priya Shah', amount: 2300, status: 'Delivered', vendor: 'EcoDrain Solutions', driver: 'Manish Das', eta: 'Delivered', payment: 'Paid', created: 'Yesterday, 4:35 PM' },
    { id: 'AF-260861', service: 'Water tanker', capacity: '12 KL', address: 'Harbour View Site, OMR', customer: 'Karthik Raman', amount: 2400, status: 'Vendor assigned', vendor: 'ClearSpring Services', driver: 'Arun Das', eta: '42 min', payment: 'Due on delivery', created: 'Sep 11, 10:40 AM' }
  ],
  vendors: [
    { name: 'BlueDrop Tankers', driver: 'Ravi Kumar', zone: 'South Chennai', vehicle: 'TN 09 AB 1234', capacity: '10,000 L', status: 'Online', rating: '4.9' },
    { name: 'ClearSpring Services', driver: 'Anita Rao', zone: 'North Chennai', vehicle: 'TN 38 CJ 8821', capacity: '8,000 L', status: 'On trip', rating: '4.8' },
    { name: 'EcoDrain Solutions', driver: 'Manish Das', zone: 'East Chennai', vehicle: 'TN 01 QX 4410', capacity: '6,000 L', status: 'Offline', rating: '4.7' }
  ]
};

export const money = (value: number) => `₹${value.toLocaleString('en-IN')}`;
