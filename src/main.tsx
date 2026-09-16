import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
class ErrorBoundary extends React.Component<{
    children: React.ReactNode;
}, {
    error: boolean;
}> {
    state = { error: false };
    static getDerivedStateFromError() { return { error: true }; }
    render() { return this.state.error ? <main className="fatal-error"><span className="eyebrow">LET’S GET YOU BACK ON TRACK</span><h1>The workspace hit a snag.</h1><p>Your original files are untouched. Reloading clears this tab’s unsaved session.</p><button className="button button-primary" onClick={() => location.reload()}>Reload the workspace</button></main> : this.props.children; }
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><ErrorBoundary><App /></ErrorBoundary></React.StrictMode>);
