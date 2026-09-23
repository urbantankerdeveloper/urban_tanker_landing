import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './ui';

interface ErrorBoundaryProps { children: ReactNode; fallbackTitle?: string }
interface ErrorBoundaryState { hasError: boolean; message: string }

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Urban Tanker UI error:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return <main className="error-state-screen" role="alert"><section className="error-state-panel"><span className="eyebrow">Urban Tanker</span><h1>{this.props.fallbackTitle || 'This workspace needs a refresh.'}</h1><p>{this.state.message || 'An unexpected error interrupted this screen.'}</p><Button variant="primary" onClick={() => window.location.reload()}>Reload workspace</Button></section></main>;
  }
}
