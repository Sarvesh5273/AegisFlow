import React, { useState, useEffect, useCallback } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { aegisApi } from './api'

const RISK_COLORS = {
  low: { bg: '#064e3b', border: '#10b981', badge: '#10b981' },
  medium: { bg: '#451a03', border: '#f59e0b', badge: '#f59e0b' },
  high: { bg: '#450a0a', border: '#ef4444', badge: '#ef4444' },
}

export default function App() {
  const {
    loginWithRedirect,
    logout,
    isAuthenticated,
    user,
    getAccessTokenSilently,
    getAccessTokenWithPopup,
    isLoading,
    error,
  } = useAuth0()

  const [activeTab, setActiveTab] = useState('agent')
  const [prompt, setPrompt] = useState('')
  const [planResult, setPlanResult] = useState(null)
  const [chatLoading, setChatLoading] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [execResult, setExecResult] = useState(null)

  const [auditLogs, setAuditLogs] = useState([])
  const [cloudState, setCloudState] = useState([])
  const [consents, setConsents] = useState([])
  const [policies, setPolicies] = useState([])
  const [vaultConnections, setVaultConnections] = useState([])
  const [auditLoading, setAuditLoading] = useState(false)

  const getToken = useCallback(async () => {
    try {
      return await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          scope: 'execute:high_risk',
        },
      })
    } catch {
      return await getAccessTokenWithPopup({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          scope: 'execute:high_risk',
        },
      })
    }
  }, [getAccessTokenSilently, getAccessTokenWithPopup])

  const loadAuditData = useCallback(async () => {
    if (!isAuthenticated) return
    setAuditLoading(true)
    try {
      const token = await getToken()
      const [logs, state, consentData, vaultData] = await Promise.all([
        aegisApi.getAuditLogs(token),
        aegisApi.getCloudState(token),
        aegisApi.getConsentRecords(token),
        aegisApi.getVaultConnections(token),
      ])
      setAuditLogs(logs)
      setCloudState(state)
      setConsents(consentData)
      setVaultConnections(vaultData.connections || [])
    } catch (e) {
      console.error('Audit load error:', e)
    } finally {
      setAuditLoading(false)
    }
  }, [isAuthenticated, getToken])

  useEffect(() => {
    aegisApi.getPolicies().then(setPolicies).catch(() => {})
  }, [])

  useEffect(() => {
    if (isAuthenticated && activeTab === 'audit') {
      loadAuditData()
    }
  }, [isAuthenticated, activeTab, loadAuditData])

  const handleChat = async () => {
    if (!prompt.trim()) return
    setChatLoading(true)
    setExecResult(null)
    setPlanResult(null)
    try {
      const data = await aegisApi.getChatPlan(prompt)
      setPlanResult(data)
    } catch {
      alert('Backend error. Is the FastAPI server running?')
    } finally {
      setChatLoading(false)
    }
  }

  const handleExecute = async () => {
    if (!planResult) return
    setExecuting(true)
    try {
      const token = await getAccessTokenWithPopup({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          scope: 'execute:high_risk',
        },
      })
      const primaryAction = planResult.plan.actions[0]
      const result = await aegisApi.executeAction(primaryAction, token)
      setExecResult(result)
      setPlanResult(null)
      setPrompt('')
    } catch (err) {
      const detail = err.response?.data?.detail || 'Authentication failed or access denied.'
      alert(`Execution denied: ${detail}`)
    } finally {
      setExecuting(false)
    }
  }

  const handleAutoApprove = async () => {
    if (!planResult) return
    setExecuting(true)
    try {
      const token = await getToken()
      const primaryAction = planResult.plan.actions[0]
      const result = await aegisApi.executeAction(primaryAction, token)
      setExecResult(result)
      setPlanResult(null)
      setPrompt('')
    } catch (err) {
      alert(`Error: ${err.response?.data?.detail || err.message}`)
    } finally {
      setExecuting(false)
    }
  }

  if (isLoading) {
    return (
      <div style={s.container}>
        <p style={{ color: '#94a3b8' }}>Connecting to AegisFlow Vault...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div style={{ ...s.container, justifyContent: 'center', alignItems: 'center', display: 'flex', flexDirection: 'column' }}>
        <div style={s.logoWrap}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <path d="M24 4L44 14V26C44 35.9 35.1 44.4 24 47C12.9 44.4 4 35.9 4 26V14L24 4Z" fill="#1e293b" stroke="#38bdf8" strokeWidth="2"/>
            <path d="M24 14L32 18V24C32 28.4 28.4 32.2 24 33C19.6 32.2 16 28.4 16 24V18L24 14Z" fill="#38bdf8" opacity="0.3"/>
            <path d="M20 24L23 27L28 21" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 style={s.title}>AegisFlow</h1>
        <p style={{ color: '#64748b', marginBottom: '2rem', fontSize: '1rem' }}>
          Policy-Enforced Consent for Autonomous AI Agents
        </p>
        {error && (
          <div style={s.errorBox}>
            <strong>Auth Error:</strong> {error.message}
          </div>
        )}
        <button onClick={() => loginWithRedirect()} style={s.primaryBtn}>
          Initialize System
        </button>
      </div>
    )
  }

  const decision = planResult?.decision
  const riskColors = decision ? RISK_COLORS[decision.risk_level] || RISK_COLORS.high : null

  return (
    <div style={s.appWrap}>
      {/* Sidebar */}
      <aside style={s.sidebar}>
        <div style={s.logoWrap}>
          <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
            <path d="M24 4L44 14V26C44 35.9 35.1 44.4 24 47C12.9 44.4 4 35.9 4 26V14L24 4Z" fill="#1e293b" stroke="#38bdf8" strokeWidth="2"/>
            <path d="M20 24L23 27L28 21" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ color: '#38bdf8', fontWeight: 700, fontSize: '1.1rem' }}>AegisFlow</span>
        </div>

        <nav style={s.nav}>
          {[
            { id: 'agent', label: 'Agent Console' },
            { id: 'audit', label: 'Audit Log' },
            { id: 'policies', label: 'Policy Registry' },
            { id: 'vault', label: 'Token Vault' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{ ...s.navBtn, ...(activeTab === tab.id ? s.navBtnActive : {}) }}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div style={s.userChip}>
          <div style={s.avatar}>{user.email?.[0]?.toUpperCase()}</div>
          <span style={{ color: '#94a3b8', fontSize: '0.75rem', wordBreak: 'break-all' }}>{user.email}</span>
          <button onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })} style={s.logoutBtn}>
            ×
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={s.main}>

        {/* === AGENT CONSOLE === */}
        {activeTab === 'agent' && (
          <div>
            <h2 style={s.pageTitle}>Agent Console</h2>
            <p style={s.pageSub}>Type a command. The policy engine intercepts high-risk actions before execution.</p>

            <div style={s.inputRow}>
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleChat()}
                placeholder="e.g. 'Read system logs' or 'Provision a GPU instance'"
                style={s.input}
                disabled={chatLoading}
              />
              <button onClick={handleChat} disabled={chatLoading || !prompt.trim()} style={s.primaryBtn}>
                {chatLoading ? 'Analyzing…' : 'Send'}
              </button>
            </div>

            {planResult && !execResult && (
              <div style={s.card}>
                <div style={s.cardHeader}>
                  <span style={s.label}>Proposed Action Plan</span>
                  <span style={{
                    ...s.badge,
                    backgroundColor: riskColors?.badge,
                    color: '#0f172a',
                  }}>
                    {decision?.risk_level?.toUpperCase()} RISK
                  </span>
                </div>
                <pre style={s.code}>{JSON.stringify(planResult.plan.actions, null, 2)}</pre>

                <div style={{ ...s.decisionBox, backgroundColor: riskColors?.bg, border: `1px solid ${riskColors?.border}` }}>
                  <div>
                    <strong style={{ color: riskColors?.border }}>Policy Decision</strong>
                    <p style={{ margin: '0.25rem 0 0', color: '#cbd5e1', fontSize: '0.9rem' }}>{decision?.reason}</p>
                  </div>
                  {decision?.requires_auth ? (
                    <button onClick={handleExecute} disabled={executing} style={{ ...s.primaryBtn, backgroundColor: riskColors?.border }}>
                      {executing ? 'Processing…' : '🔐 Authorize & Execute'}
                    </button>
                  ) : (
                    <button onClick={handleAutoApprove} disabled={executing} style={{ ...s.primaryBtn, backgroundColor: '#10b981' }}>
                      {executing ? 'Processing…' : '✓ Execute (Auto-Approved)'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {execResult && (
              <div style={{ ...s.card, border: '1px solid #10b981' }}>
                <div style={s.cardHeader}>
                  <span style={{ color: '#10b981', fontWeight: 600 }}>✓ Execution Complete</span>
                  <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{execResult.executed_at}</span>
                </div>
                <p style={{ color: '#cbd5e1', marginBottom: '1rem' }}>{execResult.message}</p>
                <div style={s.label}>Side Effects (written to audit)</div>
                <pre style={s.code}>{JSON.stringify(execResult.side_effects, null, 2)}</pre>
                <button onClick={() => setExecResult(null)} style={{ ...s.secondaryBtn, marginTop: '1rem' }}>
                  Clear
                </button>
              </div>
            )}
          </div>
        )}

        {/* === AUDIT LOG === */}
        {activeTab === 'audit' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={s.pageTitle}>Audit Log</h2>
              <button onClick={loadAuditData} style={s.secondaryBtn} disabled={auditLoading}>
                {auditLoading ? 'Loading…' : '↻ Refresh'}
              </button>
            </div>

            <div style={s.gridTwo}>
              <div>
                <div style={s.label}>Action History</div>
                {auditLogs.length === 0 ? (
                  <p style={{ color: '#475569' }}>No actions logged yet.</p>
                ) : (
                  auditLogs.map((log) => (
                    <div key={log.id} style={{ ...s.logRow, borderLeft: `3px solid ${log.status === 'success' ? '#10b981' : '#ef4444'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.85rem' }}>{log.action_type}</span>
                        <span style={{ color: log.status === 'success' ? '#10b981' : '#ef4444', fontSize: '0.75rem' }}>
                          {log.status.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{log.resource} · {log.risk_level} risk</div>
                      <div style={{ color: '#475569', fontSize: '0.7rem', marginTop: '0.2rem' }}>{log.executed_at}</div>
                    </div>
                  ))
                )}
              </div>

              <div>
                <div style={s.label}>Cloud Resources</div>
                {cloudState.length === 0 ? (
                  <p style={{ color: '#475569' }}>No resources provisioned yet.</p>
                ) : (
                  cloudState.map((r) => (
                    <div key={r.id} style={{ ...s.logRow, borderLeft: `3px solid ${r.status === 'running' || r.status === 'online' ? '#10b981' : '#ef4444'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.85rem' }}>{r.resource_type}</span>
                        <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{r.status}</span>
                      </div>
                      <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{r.resource_id}</div>
                    </div>
                  ))
                )}

                <div style={{ ...s.label, marginTop: '1.5rem' }}>Consent Records</div>
                {consents.length === 0 ? (
                  <p style={{ color: '#475569' }}>No consents recorded yet.</p>
                ) : (
                  consents.map((c) => (
                    <div key={c.id} style={{ ...s.logRow, borderLeft: '3px solid #38bdf8' }}>
                      <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.85rem' }}>{c.action_type}</div>
                      <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Scope: {c.scope_granted} · User: {c.user_id?.slice(0, 20)}…</div>
                      <div style={{ color: '#475569', fontSize: '0.7rem' }}>{c.granted_at}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* === POLICY REGISTRY === */}
        {activeTab === 'policies' && (
          <div>
            <h2 style={s.pageTitle}>Policy Registry</h2>
            <p style={s.pageSub}>All registered policies. These determine when the agent requires user consent.</p>
            <div style={s.gridTwo}>
              {policies.map((p) => {
                const rc = RISK_COLORS[p.risk_level] || RISK_COLORS.high
                return (
                  <div key={p.action_type} style={{ ...s.card, border: `1px solid ${rc.border}` }}>
                    <div style={s.cardHeader}>
                      <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{p.action_type}</span>
                      <span style={{ ...s.badge, backgroundColor: rc.badge, color: '#0f172a' }}>
                        {p.risk_level.toUpperCase()}
                      </span>
                    </div>
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0.5rem 0' }}>{p.description}</p>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={s.chip}>{p.requires_step_up ? '🔐 Step-up required' : '✓ Auto-approve'}</span>
                      {p.max_cost && <span style={s.chip}>Max cost: ${p.max_cost}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* === TOKEN VAULT === */}
        {activeTab === 'vault' && (
          <div>
            <h2 style={s.pageTitle}>Auth0 Token Vault</h2>
            <p style={s.pageSub}>
              Token Vault stores third-party OAuth credentials on behalf of the user.
              The agent retrieves these to call external APIs without ever seeing raw credentials.
            </p>

            <div style={s.card}>
              <div style={s.label}>How it works</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem' }}>
                {[
                  { step: '1', text: 'User links a third-party service (e.g. GitHub) via Auth0.' },
                  { step: '2', text: 'Auth0 stores the OAuth token in the Token Vault, scoped to this user.' },
                  { step: '3', text: 'When the agent needs to act, it calls /vault/token/{connection} with the user\'s JWT.' },
                  { step: '4', text: 'AegisFlow retrieves the vault token and calls the external API on behalf of the user.' },
                  { step: '5', text: 'The raw credential is never exposed to the agent or the frontend.' },
                ].map((item) => (
                  <div key={item.step} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <span style={{ ...s.badge, backgroundColor: '#38bdf8', color: '#0f172a', flexShrink: 0 }}>{item.step}</span>
                    <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ ...s.card, marginTop: '1rem' }}>
              <div style={s.cardHeader}>
                <span style={s.label}>Linked Connections</span>
                <button onClick={loadAuditData} style={s.secondaryBtn} disabled={auditLoading}>
                  {auditLoading ? 'Loading…' : '↻ Refresh'}
                </button>
              </div>
              {vaultConnections.length === 0 ? (
                <p style={{ color: '#475569', marginTop: '0.75rem' }}>
                  No third-party connections found. Link a social account (GitHub, Google) in your Auth0 profile to enable Token Vault.
                </p>
              ) : (
                vaultConnections.map((c) => (
                  <div key={c.connection} style={{ ...s.logRow, borderLeft: `3px solid ${c.has_token ? '#10b981' : '#64748b'}` }}>
                    <span style={{ color: '#e2e8f0' }}>{c.connection}</span>
                    <span style={{ color: c.has_token ? '#10b981' : '#64748b', fontSize: '0.8rem' }}>
                      {c.has_token ? '✓ Token stored in vault' : 'No token'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  )
}

// --- STYLES ---
const s = {
  container: { backgroundColor: '#0f172a', color: 'white', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif', padding: '2rem' },
  appWrap: { display: 'flex', minHeight: '100vh', backgroundColor: '#0f172a', color: 'white', fontFamily: 'Inter, system-ui, sans-serif' },
  sidebar: { width: '220px', flexShrink: 0, backgroundColor: '#0a1628', borderRight: '1px solid #1e293b', display: 'flex', flexDirection: 'column', padding: '1.5rem 1rem', gap: '0.5rem' },
  logoWrap: { display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem' },
  nav: { display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 },
  navBtn: { background: 'none', border: 'none', color: '#64748b', textAlign: 'left', padding: '0.6rem 0.75rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem' },
  navBtnActive: { backgroundColor: '#1e293b', color: '#e2e8f0' },
  userChip: { display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 'auto', padding: '0.75rem', backgroundColor: '#1e293b', borderRadius: '8px' },
  avatar: { width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#38bdf8', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 },
  logoutBtn: { background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '1.2rem', marginLeft: 'auto', flexShrink: 0 },
  main: { flex: 1, padding: '2.5rem', overflowY: 'auto', maxWidth: '900px' },
  pageTitle: { fontSize: '1.5rem', fontWeight: 700, color: '#f1f5f9', margin: '0 0 0.25rem' },
  pageSub: { color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' },
  title: { fontSize: '3rem', fontWeight: 800, background: 'linear-gradient(to right, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: '1rem 0 0.5rem' },
  inputRow: { display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' },
  input: { flex: 1, padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #1e293b', backgroundColor: '#1e293b', color: '#f1f5f9', fontSize: '0.95rem', outline: 'none' },
  card: { backgroundColor: '#1e293b', borderRadius: '12px', padding: '1.25rem', marginBottom: '1rem', border: '1px solid #334155' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' },
  label: { color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' },
  badge: { padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700 },
  chip: { backgroundColor: '#0f172a', color: '#94a3b8', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', border: '1px solid #334155' },
  code: { backgroundColor: '#0f172a', padding: '1rem', borderRadius: '8px', overflowX: 'auto', color: '#94a3b8', fontSize: '0.82rem', margin: '0 0 1rem' },
  decisionBox: { padding: '1rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' },
  primaryBtn: { backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', padding: '0.65rem 1.25rem', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem', whiteSpace: 'nowrap' },
  secondaryBtn: { backgroundColor: 'transparent', color: '#94a3b8', border: '1px solid #334155', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem' },
  errorBox: { backgroundColor: '#450a0a', color: '#fca5a5', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' },
  gridTwo: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' },
  logRow: { backgroundColor: '#0f172a', padding: '0.75rem', borderRadius: '6px', marginBottom: '0.5rem', paddingLeft: '0.75rem' },
}
