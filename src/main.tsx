import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { isSetUp } from './utils/supabaseClient'
import { NotSetUp } from './components/NotSetUp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isSetUp ? <App /> : <NotSetUp />}
  </StrictMode>,
)
