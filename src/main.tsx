import { createRoot } from 'react-dom/client'
import './shadcn.css'
import './styles/meridian-utilities.css'
import App from './App'

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}

const root = createRoot(document.getElementById('app')!)
root.render(<App />)
