import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AuthProvider } from './contexts/AuthContext';
import './styles.scss';

const root = document.getElementById('root');

if (!root) throw new Error('Urban Tanker root element was not found.');

createRoot(root).render(<StrictMode><AuthProvider><App /></AuthProvider></StrictMode>);
