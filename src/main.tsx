import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const root = createRoot(document.getElementById('root')!)
if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('materialPreview') === '1') {
  import('./dev/MaterialCatalogPreview').then(({ default: MaterialCatalogPreview }) => {
    root.render(<StrictMode><MaterialCatalogPreview /></StrictMode>)
  }, (reason: unknown) => {
    root.render(<p role="alert">Material preview could not load: {reason instanceof Error ? reason.message : String(reason)}</p>)
  })
} else {
  root.render(<StrictMode><App /></StrictMode>)
}
