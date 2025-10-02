
import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'

const queryClient = new QueryClient();

async function prepare() {
  if (import.meta.env.DEV) {
    const { worker } = await import('./mocks/browser');
    await worker.start();
  }
  
  const { seedIfEmpty } = await import('./lib/seed');
  await seedIfEmpty();
}

prepare().then(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </React.StrictMode>,
  )
});
