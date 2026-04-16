import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import BrokerageContinuum from './BrokerageContinuum'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrokerageContinuum />
  </StrictMode>,
)
