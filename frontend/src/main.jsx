import React from 'react'
import ReactDOM from 'react-dom/client'
import { Auth0Provider } from '@auth0/auth0-react'
import App from './App'
import './index.css'

// Debugging line: Check your browser console to see if these show up!
console.log("Auth0 Domain:", import.meta.env.VITE_AUTH0_DOMAIN);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Auth0Provider
      domain={import.meta.env.VITE_AUTH0_DOMAIN}
      clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        scope: "openid profile email execute:high_risk"
      }}
    >
      <App />
    </Auth0Provider>
  </React.StrictMode>,
)