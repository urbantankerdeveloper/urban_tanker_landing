import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { AuthProvider } from './providers/AuthContext';
import { ErrorBoundary } from '../shared/components/ErrorBoundary';
import '../styles.scss';

const root = document.getElementById('root');

if (!root) throw new Error('Urban Tanker root element was not found.');

registerSW({ immediate: true });

createRoot(root).render(<StrictMode><ErrorBoundary><AuthProvider><App /></AuthProvider></ErrorBoundary></StrictMode>);
