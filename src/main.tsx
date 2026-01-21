import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/globals.css';

console.log('Main.tsx starting...');
try {
  const rootElement = document.getElementById('root');
  console.log('Root element:', rootElement);
  
  if (!rootElement) throw new Error('Root element not found');

  createRoot(rootElement).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  );
  console.log('React app mounted successfully');
} catch (error) {
  console.error('Error mounting React app:', error);
}
