import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app/App';
import { applyTheme } from './shared/lib/theme';
import '@aptora/ui/tokens/ledger-light.css';
import './shared/styles/app.css';
import './shared/styles/procure.css';
import './shared/styles/themes.css';

applyTheme();

const root = document.getElementById('root');
if (!root) throw new Error('Root element missing');

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
