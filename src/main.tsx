import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { LogoProvider } from './context/LogoContext';

createRoot(document.getElementById('root')!).render(
  <LogoProvider>
    <App />
  </LogoProvider>
);

