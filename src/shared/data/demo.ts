import type { AppData, Role } from '../lib/types';

const modeRole = import.meta.env.MODE === 'vendor' || import.meta.env.MODE === 'admin' ? import.meta.env.MODE : 'customer';

export const initialState: AppData = {
  role: modeRole as Role,
  profile: null,
  location: { address: 'ECR, Chennai', latitude: null, longitude: null, accuracy: null, permission: 'prompt', updatedAt: null },
  booking: { service: 'Water tanker', waterType: 'Drinking / potable', capacity: '6 KL', date: new Date().toISOString().slice(0, 10), slot: 'As soon as possible', address: '18 Lakeview Apartments, Indiranagar', landmark: 'Gate 2', notes: '' },
  orders: [],
  vendors: [],
  savedAddresses: []
};

export const money = (value: number) => `₹${value.toLocaleString('en-IN')}`;
