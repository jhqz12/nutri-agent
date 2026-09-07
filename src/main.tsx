import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { AppProvider } from './state/AppContext'
import { NutritionProvider } from './state/NutritionContext'
import './styles.css'
import './nutritionStyles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProvider>
      <NutritionProvider>
        <App />
      </NutritionProvider>
    </AppProvider>
  </React.StrictMode>
)
