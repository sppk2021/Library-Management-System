/**
 * FRONT-END ENTRY POINT
 * The browser loads index.html, which runs this file. It mounts the React <App />
 * into the <div id="root"> element and loads the global Tailwind CSS styles.
 */
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
