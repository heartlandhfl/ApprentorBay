import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { getFirebaseStatus } from './lib/firebase';
import './index.css';

const firebase = getFirebaseStatus();
if (firebase.initialized) {
  console.info('Firebase initialized', { projectId: firebase.projectId });
} else {
  console.warn('Firebase did not initialize', firebase);
}

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element #root is missing');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
