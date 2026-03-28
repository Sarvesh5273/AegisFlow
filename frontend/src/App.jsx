import React, { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { aegisApi } from './api';

function App() {
  const { 
    loginWithRedirect, 
    logout, 
    isAuthenticated, 
    user, 
    getAccessTokenWithPopup,
    isLoading,
    error // Added error tracking
  } = useAuth0();

  const [prompt, setPrompt] = useState("");
  const [plan, setPlan] = useState(null);
  const [decision, setDecision] = useState(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);

  // Monitor Auth0 state changes
  useEffect(() => {
    if (error) {
      console.error("Auth0 SDK Error:", error.message);
    }
  }, [error]);

  const handleLogin = async () => {
    console.log("--- Login Attempt Started ---");
    console.log("Current Auth State:", { isAuthenticated, isLoading });
    try {
      await loginWithRedirect();
      console.log("Redirect initiated...");
    } catch (err) {
      console.error("Login Error Catch:", err);
    }
  };

  const handleChat = async () => {
    setLoading(true);
    try {
      const data = await aegisApi.getChatPlan(prompt);
      setPlan(data.plan);
      setDecision(data.decision);
    } catch (err) {
      alert("AI Bridge Error: Ensure backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteSecurely = async () => {
    setExecuting(true);
    try {
      const token = await getAccessTokenWithPopup({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          scope: "execute:high_risk",
        },
      });
      const result = await aegisApi.executeAction(plan.actions[0], token);
      alert(result.message);
      setPlan(null); setDecision(null); setPrompt("");
    } catch (err) {
      console.error("Execution Error:", err);
      alert("Execution Denied: " + (err.response?.data?.detail || "Authentication Failed"));
    } finally {
      setExecuting(false);
    }
  };

  // If the SDK is still figuring things out, show a splash screen
  if (isLoading) {
    return <div style={containerStyle}><h1>Syncing with AegisFlow Vault...</h1></div>;
  }

  if (!isAuthenticated) {
    return (
      <div style={containerStyle}>
        <h1 style={titleStyle}>AegisFlow</h1>
        <p style={{color: '#94a3b8', marginBottom: '2rem'}}>The Autonomous Security Gate for AI Agents.</p>
        
        {/* Error Display */}
        {error && (
          <div style={{ backgroundColor: '#7f1d1d', color: '#fca5a5', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
            <strong>Configuration Error:</strong> {error.message}
          </div>
        )}

        <button onClick={handleLogin} style={primaryButtonStyle}>Initialize System</button>
        
        {/* Manual Debug Button */}
        <button 
          onClick={() => console.log("Manual Debug Check:", { 
            VITE_DOMAIN: import.meta.env.VITE_AUTH0_DOMAIN,
            VITE_CLIENT: import.meta.env.VITE_AUTH0_CLIENT_ID,
            ORIGIN: window.location.origin 
          })} 
          style={{marginTop: '2rem', display: 'block', background: 'none', border: 'none', color: '#334155', cursor: 'help'}}
        >
          Check Environment Config (Console)
        </button>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <h2 style={{margin: 0, color: '#38bdf8'}}>AegisFlow <span style={{fontSize: '0.7rem'}}>CONTROL PLANE</span></h2>
        <div style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
          <span style={{color: '#94a3b8'}}>{user.email}</span>
          <button onClick={() => logout()} style={secondaryButtonStyle}>Logout</button>
        </div>
      </header>

      <main style={mainStyle}>
        <div style={cardStyle}>
          <input 
            type="text" 
            placeholder="e.g., 'Analyze logs' or 'Deploy a GPU instance'..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            style={inputStyle}
            disabled={loading}
          />
          <button onClick={handleChat} disabled={loading || !prompt} style={primaryButtonStyle}>
            {loading ? "Analyzing..." : "Send Command"}
          </button>
        </div>

        {plan && (
          <div style={planCardStyle}>
            <h3 style={{marginTop: 0, color: '#38bdf8'}}>Proposed Action Plan</h3>
            <pre style={codeBlockStyle}>{JSON.stringify(plan.actions, null, 2)}</pre>
            <div style={decisionBoxStyle(decision.requires_auth)}>
              <strong>Policy Decision:</strong> {decision.reason}
              {decision.requires_auth ? (
                <button onClick={handleExecuteSecurely} disabled={executing} style={authButtonStyle}>
                  {executing ? "Processing..." : "Authorize & Execute"}
                </button>
              ) : (
                <button onClick={() => alert("Executing low-risk action...")} style={primaryButtonStyle}>
                  Execute Auto-Approved Action
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// --- STYLES (Keep existing or update slightly) ---
const containerStyle = { backgroundColor: '#0f172a', color: 'white', minHeight: '100vh', padding: '2rem', fontFamily: 'sans-serif', textAlign: 'center' };
const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4rem', borderBottom: '1px solid #1e293b', paddingBottom: '1rem', textAlign: 'left' };
const titleStyle = { fontSize: '3rem', margin: '0 0 1rem 0', background: 'linear-gradient(to right, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' };
const mainStyle = { maxWidth: '800px', margin: '0 auto', textAlign: 'left' };
const cardStyle = { backgroundColor: '#1e293b', padding: '1.5rem', borderRadius: '12px', display: 'flex', gap: '1rem' };
const inputStyle = { flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#0f172a', color: 'white' };
const planCardStyle = { marginTop: '2rem', backgroundColor: '#1e293b', padding: '1.5rem', borderRadius: '12px', border: '1px solid #334155' };
const codeBlockStyle = { backgroundColor: '#0f172a', padding: '1rem', borderRadius: '8px', overflowX: 'auto', textAlign: 'left' };
const decisionBoxStyle = (isAuth) => ({ padding: '1rem', borderRadius: '8px', backgroundColor: isAuth ? '#451a03' : '#064e3b', border: `1px solid ${isAuth ? '#f59e0b' : '#10b981'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' });
const primaryButtonStyle = { backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' };
const secondaryButtonStyle = { backgroundColor: 'transparent', color: '#94a3b8', border: '1px solid #334155', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' };
const authButtonStyle = { backgroundColor: '#f59e0b', color: '#0f172a', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' };

export default App;