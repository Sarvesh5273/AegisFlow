import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { aegisApi } from './api'

// ── Risk config ──────────────────────────────────────────────
const RISK = {
  low:    { color: '#22c55e', bg: 'rgba(34,197,94,0.08)',    border: 'rgba(34,197,94,0.25)',    label: 'LOW' },
  medium: { color: '#f97316', bg: 'rgba(249,115,22,0.08)',   border: 'rgba(249,115,22,0.25)',   label: 'MED' },
  high:   { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',    border: 'rgba(239,68,68,0.25)',    label: 'HIGH' },
}

// ── SVG Icons ────────────────────────────────────────────────
const Icon = {
  Shield: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  Agent: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
    </svg>
  ),
  Log: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/>
    </svg>
  ),
  Policy: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 12h6M9 15h4"/>
    </svg>
  ),
  Vault: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="16" r="1"/>
    </svg>
  ),
  Send: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9"/>
    </svg>
  ),
  Check: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20,6 9,17 4,12"/>
    </svg>
  ),
  Refresh: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23,4 23,10 17,10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  ),
  Repo: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3h18v18H3zM3 9h18M9 21V9"/>
    </svg>
  ),
  Lock: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
  Edit: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  ),
  Star: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
      <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
    </svg>
  ),
  X: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
}

const TABS = [
  { id: 'agent',    label: 'Agent',       icon: Icon.Agent },
  { id: 'audit',    label: 'Audit Log',   icon: Icon.Log },
  { id: 'policies', label: 'Policies',    icon: Icon.Policy },
  { id: 'vault',    label: 'Token Vault', icon: Icon.Vault },
]

// ── Result renderers ─────────────────────────────────────────
function RepoCard({ repo }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'0.6rem 0.75rem', background:'rgba(255,255,255,0.03)',
      borderRadius:'6px', marginBottom:'0.35rem', border:'1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
        <span style={{ color:'#64748b' }}><Icon.Repo /></span>
        <span style={{ color:'#e2e8f0', fontSize:'0.83rem', fontFamily:'JetBrains Mono, monospace' }}>
          {repo.name}
        </span>
        {repo.private && (
          <span style={{ color:'#64748b', display:'flex', alignItems:'center' }}><Icon.Lock /></span>
        )}
      </div>
      {repo.stars > 0 && (
        <span style={{ color:'#fbbf24', display:'flex', alignItems:'center', gap:'0.25rem', fontSize:'0.75rem' }}>
          <Icon.Star /> {repo.stars}
        </span>
      )}
    </div>
  )
}

function ExecutionOutput({ result }) {
  if (!result) return null
  const { action_type, side_effects, message } = result

  if (action_type === 'github_read_repos' && side_effects?.repositories) {
    return (
      <div>
        <div style={{ color:'#64748b', fontSize:'0.72rem', fontWeight:600, textTransform:'uppercase',
          letterSpacing:'0.06em', marginBottom:'0.6rem' }}>
          {side_effects.repositories.length} repositories
        </div>
        {side_effects.repositories.map(r => <RepoCard key={r.name} repo={r} />)}
      </div>
    )
  }

  if (action_type === 'github_create_issue' && side_effects?.issue_url) {
    return (
      <div style={{ padding:'0.75rem', background:'rgba(34,197,94,0.06)',
        borderRadius:'8px', border:'1px solid rgba(34,197,94,0.2)' }}>
        <div style={{ color:'#22c55e', fontWeight:600, fontSize:'0.85rem', marginBottom:'0.35rem' }}>
          Issue #{side_effects.issue_number} created
        </div>
        <div style={{ color:'#94a3b8', fontSize:'0.82rem' }}>{side_effects.title}</div>
        <a href={side_effects.issue_url} target="_blank" rel="noreferrer"
          style={{ color:'#38bdf8', fontSize:'0.78rem', display:'block', marginTop:'0.35rem' }}>
          {side_effects.issue_url}
        </a>
      </div>
    )
  }

  if (action_type === 'github_create_repo' && side_effects?.repo_url) {
    return (
      <div style={{ padding:'0.75rem', background:'rgba(34,197,94,0.06)',
        borderRadius:'8px', border:'1px solid rgba(34,197,94,0.2)' }}>
        <div style={{ color:'#22c55e', fontWeight:600, fontSize:'0.85rem', marginBottom:'0.35rem' }}>
          Repository created
        </div>
        <div style={{ color:'#94a3b8', fontSize:'0.82rem', fontFamily:'monospace' }}>
          {side_effects.repo_name}
        </div>
        <div style={{ color:'#475569', fontSize:'0.75rem', marginTop:'0.2rem' }}>
          {side_effects.private ? 'Private' : 'Public'}
        </div>
      </div>
    )
  }

  if (action_type === 'github_delete_repo') {
    return (
      <div style={{ padding:'0.75rem', background:'rgba(239,68,68,0.06)',
        borderRadius:'8px', border:'1px solid rgba(239,68,68,0.2)' }}>
        <div style={{ color:'#ef4444', fontWeight:600, fontSize:'0.85rem', marginBottom:'0.25rem' }}>
          Repository deleted
        </div>
        <div style={{ color:'#94a3b8', fontSize:'0.82rem', fontFamily:'monospace' }}>
          {side_effects?.repo}
        </div>
      </div>
    )
  }

  return <div style={{ color:'#94a3b8', fontSize:'0.85rem' }}>{message}</div>
}

// ── Main App ─────────────────────────────────────────────────
export default function App() {
  const { loginWithRedirect, logout, isAuthenticated, user,
    getAccessTokenSilently, getAccessTokenWithPopup, isLoading, error } = useAuth0()

  const [tab, setTab]             = useState('agent')
  const [prompt, setPrompt]       = useState('')
  const [planResult, setPlan]     = useState(null)
  const [execResult, setExec]     = useState(null)
  const [chatBusy, setChatBusy]   = useState(false)
  const [execBusy, setExecBusy]   = useState(false)
  const [statusMsg, setStatus]    = useState('')

  const [logs, setLogs]           = useState([])
  const [ghState, setGhState]     = useState([])
  const [consents, setConsents]   = useState([])
  const [policies, setPolicies]   = useState([])
  const [vaultConns, setVault]    = useState([])
  const [auditBusy, setAuditBusy] = useState(false)
  const [editingPolicy, setEditing] = useState(null)
  const [saveMsg, setSaveMsg]     = useState('')

  const inputRef = useRef(null)

  const getToken = useCallback(async (popup = false) => {
    const p = { authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE, scope: 'execute:high_risk' } }
    return popup
      ? getAccessTokenWithPopup(p)
      : getAccessTokenSilently(p).catch(() => getAccessTokenWithPopup(p))
  }, [getAccessTokenSilently, getAccessTokenWithPopup])

  useEffect(() => {
    aegisApi.getPolicies().then(setPolicies).catch(() => {})
  }, [])

  const loadAudit = useCallback(async () => {
    if (!isAuthenticated) return
    setAuditBusy(true)
    try {
      const token = await getToken()
      const [l, g, c, v] = await Promise.all([
        aegisApi.getAuditLogs(token),
        aegisApi.getGithubState(token),
        aegisApi.getConsentRecords(token),
        aegisApi.getVaultConnections(token),
      ])
      setLogs(l); setGhState(g); setConsents(c)
      setVault(v.connections || [])
    } catch(e) { console.error(e) }
    finally { setAuditBusy(false) }
  }, [isAuthenticated, getToken])

  useEffect(() => {
    if (isAuthenticated && (tab === 'audit' || tab === 'vault')) loadAudit()
  }, [isAuthenticated, tab, loadAudit])

  const handleChat = async () => {
    if (!prompt.trim() || chatBusy) return
    setChatBusy(true); setPlan(null); setExec(null); setStatus('Analyzing command…')
    try {
      const data = await aegisApi.getChatPlan(prompt)
      if (!data.plan?.actions?.length) { setStatus('Could not parse command.'); return }

      const decision = data.decision
      setStatus('')

      if (!decision.requires_auth) {
        // LOW risk — auto-execute immediately, no button needed
        setStatus('Auto-approved — executing…')
        setExecBusy(true)
        try {
          const token = await getToken()
          const result = await aegisApi.executeAction(data.plan.actions[0], token)
          setExec(result)
          setPrompt('')
        } catch(err) {
          setStatus('Error: ' + (err.response?.data?.detail || err.message))
        } finally {
          setExecBusy(false)
          setStatus('')
        }
      } else {
        // MEDIUM/HIGH — show plan and wait for explicit user approval
        setPlan(data)
      }
    } catch {
      setStatus('Backend error — is uvicorn running?')
    } finally {
      setChatBusy(false)
    }
  }

  const handleExecute = async () => {
    if (!planResult) return
    setExecBusy(true)
    try {
      const token = await getToken(true)
      const result = await aegisApi.executeAction(planResult.plan.actions[0], token)
      setExec(result); setPlan(null); setPrompt('')
    } catch(err) {
      setStatus('Denied: ' + (err.response?.data?.detail || err.message))
    } finally { setExecBusy(false) }
  }

  const handleSavePolicy = async () => {
    if (!editingPolicy) return
    try {
      const token = await getToken()
      await aegisApi.updatePolicy(editingPolicy, token)
      const updated = await aegisApi.getPolicies()
      setPolicies(updated); setSaveMsg('Policy updated'); setEditing(null)
      setTimeout(() => setSaveMsg(''), 3000)
    } catch(err) {
      setSaveMsg('Error: ' + (err.response?.data?.detail || err.message))
    }
  }

  const handleResetPolicies = async () => {
    try {
      const token = await getToken()
      await aegisApi.resetPolicies(token)
      const updated = await aegisApi.getPolicies()
      setPolicies(updated); setSaveMsg('Reset to defaults')
      setTimeout(() => setSaveMsg(''), 3000)
    } catch(err) { setSaveMsg('Error: ' + err.message) }
  }

  // ── Not authed ───────────────────────────────────────────
  if (isLoading) return (
    <div style={css.splash}>
      <div style={{ color:'#334155', fontSize:'0.85rem' }}>Connecting…</div>
    </div>
  )

  if (!isAuthenticated) return (
    <div style={css.splash}>
      <div style={css.splashInner}>
        <div style={css.splashLogo}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="1.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <polyline points="9,12 11,14 15,10" stroke="#38bdf8" strokeWidth="2"/>
          </svg>
        </div>
        <h1 style={css.splashTitle}>AegisFlow</h1>
        <p style={css.splashSub}>Policy-Enforced Consent for Autonomous AI Agents</p>
        <div style={css.splashMeta}>Powered by Auth0 Token Vault</div>
        {error && <div style={css.errBox}>{error.message}</div>}
        <button onClick={() => loginWithRedirect()} style={css.btnPrimary}>
          Initialize System
        </button>
      </div>
    </div>
  )

  const decision = planResult?.decision
  const rc = decision ? (RISK[decision.risk_level] || RISK.high) : null

  return (
    <div style={css.layout}>

      {/* ── Sidebar ── */}
      <aside style={css.sidebar}>
        <div style={css.sidebarLogo}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="1.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <polyline points="9,12 11,14 15,10" stroke="#38bdf8" strokeWidth="2"/>
          </svg>
          <span style={{ color:'#e2e8f0', fontWeight:700, fontSize:'0.95rem', letterSpacing:'-0.01em' }}>
            AegisFlow
          </span>
        </div>

        <nav style={{ display:'flex', flexDirection:'column', gap:'2px', flex:1 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ ...css.navBtn, ...(tab === t.id ? css.navActive : {}) }}>
              <span style={{ opacity: tab === t.id ? 1 : 0.5 }}><t.icon /></span>
              {t.label}
            </button>
          ))}
        </nav>

        <div style={css.userRow}>
          <div style={css.userAvatar}>{(user.nickname || user.email)?.[0]?.toUpperCase()}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ color:'#94a3b8', fontSize:'0.72rem', whiteSpace:'nowrap',
              overflow:'hidden', textOverflow:'ellipsis' }}>
              {user.nickname || user.email}
            </div>
            <div style={{ color:'#334155', fontSize:'0.65rem' }}>
              {user.sub?.startsWith('github|') ? 'GitHub' : 'Auth0'}
            </div>
          </div>
          <button onClick={() => logout({ logoutParams:{ returnTo: window.location.origin } })}
            style={css.xBtn}><Icon.X /></button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={css.main}>

        {/* ══ AGENT ══ */}
        {tab === 'agent' && (
          <div style={css.page}>
            <div style={css.pageHeader}>
              <div>
                <h2 style={css.pageTitle}>Agent Console</h2>
                <p style={css.pageSub}>
                  Low-risk actions execute instantly. High-risk actions require explicit consent.
                </p>
              </div>
            </div>

            <div style={css.inputWrap}>
              <input ref={inputRef} value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleChat()}
                placeholder="e.g. Show my repos  ·  Create an issue in owner/repo  ·  Delete owner/repo"
                style={css.input} disabled={chatBusy || execBusy} />
              <button onClick={handleChat} disabled={chatBusy || execBusy || !prompt.trim()} style={css.sendBtn}>
                {chatBusy || execBusy
                  ? <span style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.3)',
                      borderTopColor:'white', borderRadius:'50%', display:'block',
                      animation:'spin 0.7s linear infinite' }} />
                  : <Icon.Send />}
              </button>
            </div>

            {statusMsg && (
              <div style={{ color:'#64748b', fontSize:'0.82rem', padding:'0.5rem 0', textAlign:'center' }}>
                {statusMsg}
              </div>
            )}

            {/* Plan card — shown for MEDIUM/HIGH risk */}
            {planResult && !execResult && rc && (
              <div style={{ ...css.card, borderColor: rc.border, background: rc.bg, marginTop:'1rem' }}>
                <div style={css.cardRow}>
                  <div>
                    <span style={{ color: rc.color, fontSize:'0.72rem', fontWeight:700,
                      textTransform:'uppercase', letterSpacing:'0.08em' }}>
                      {rc.label} RISK · Step-up Auth Required
                    </span>
                    <p style={{ color:'#94a3b8', fontSize:'0.82rem', margin:'0.25rem 0 0' }}>
                      {decision.reason}
                    </p>
                  </div>
                  <div style={{ ...css.riskPill, background: rc.color }}>{rc.label}</div>
                </div>

                <div style={{ margin:'0.75rem 0', padding:'0.75rem',
                  background:'rgba(0,0,0,0.2)', borderRadius:'6px',
                  fontFamily:'JetBrains Mono, Fira Code, monospace', fontSize:'0.78rem', color:'#64748b' }}>
                  {planResult.plan.actions.map((a, i) => (
                    <div key={i} style={{ color:'#cbd5e1' }}>
                      <span style={{ color:'#64748b' }}>action</span>
                      <span style={{ color: rc.color }}> {a.action_type}</span>
                      <span style={{ color:'#64748b' }}> on </span>
                      <span style={{ color:'#e2e8f0' }}>{a.resource}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display:'flex', gap:'0.5rem', justifyContent:'flex-end' }}>
                  <button onClick={() => setPlan(null)} style={css.btnGhost}>Cancel</button>
                  <button onClick={handleExecute} disabled={execBusy}
                    style={{ ...css.btnPrimary, background: rc.color, color:'#000',
                      display:'flex', alignItems:'center', gap:'0.4rem' }}>
                    <Icon.Lock />
                    {execBusy ? 'Processing…' : 'Authorize & Execute'}
                  </button>
                </div>
              </div>
            )}

            {/* Result */}
            {execResult && (
              <div style={{ ...css.card, borderColor:'rgba(34,197,94,0.3)', marginTop:'1rem' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                  marginBottom:'0.75rem' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', color:'#22c55e',
                    fontSize:'0.82rem', fontWeight:600 }}>
                    <Icon.Check /> Execution complete
                  </div>
                  <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
                    {execResult.vault_used && (
                      <span style={css.vaultBadge}>Token Vault</span>
                    )}
                    <button onClick={() => setExec(null)} style={css.xBtn}><Icon.X /></button>
                  </div>
                </div>
                <ExecutionOutput result={execResult} />
              </div>
            )}

            {/* Sample prompts */}
            {!planResult && !execResult && !statusMsg && (
              <div style={{ marginTop:'2rem' }}>
                <div style={css.sectionLabel}>Try a command</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'0.5rem', marginTop:'0.5rem' }}>
                  {[
                    ['Show my GitHub repositories', 'low'],
                    ['Create an issue in owner/repo titled "Bug: login fails"', 'medium'],
                    ['Create a private repo called my-project', 'medium'],
                    ['Delete the repository owner/test-repo', 'high'],
                  ].map(([cmd, risk]) => (
                    <button key={cmd} onClick={() => { setPrompt(cmd); inputRef.current?.focus() }}
                      style={{ ...css.promptChip, borderColor: RISK[risk].border, color:'#94a3b8' }}>
                      <span style={{ width:6, height:6, borderRadius:'50%',
                        background: RISK[risk].color, flexShrink:0 }} />
                      {cmd}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ AUDIT LOG ══ */}
        {tab === 'audit' && (
          <div style={css.page}>
            <div style={css.pageHeader}>
              <div>
                <h2 style={css.pageTitle}>Audit Log</h2>
                <p style={css.pageSub}>Every action, consent, and GitHub operation — cryptographically logged.</p>
              </div>
              <button onClick={loadAudit} style={css.btnGhost} disabled={auditBusy}>
                <Icon.Refresh /> {auditBusy ? 'Loading…' : 'Refresh'}
              </button>
            </div>

            <div style={css.auditGrid}>
              <div>
                <div style={css.sectionLabel}>Action History</div>
                {logs.length === 0
                  ? <Empty text="No actions yet." />
                  : logs.map(l => {
                    const isSuccess = l.status === 'success'
                    const rc2 = RISK[l.risk_level] || RISK.high
                    return (
                      <div key={l.id} style={{ ...css.logRow, borderLeftColor: isSuccess ? '#22c55e' : '#ef4444' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.2rem' }}>
                          <span style={{ color:'#e2e8f0', fontFamily:'monospace', fontSize:'0.8rem' }}>
                            {l.action_type}
                          </span>
                          <span style={{ fontSize:'0.7rem', color: isSuccess ? '#22c55e' : '#ef4444',
                            fontWeight:600, textTransform:'uppercase' }}>
                            {l.status}
                          </span>
                        </div>
                        <div style={{ color:'#475569', fontSize:'0.75rem' }}>{l.resource}</div>
                        <div style={{ display:'flex', justifyContent:'space-between', marginTop:'0.25rem' }}>
                          <span style={{ ...css.riskPill, background: rc2.color, fontSize:'0.62rem',
                            padding:'0.1rem 0.4rem' }}>{l.risk_level}</span>
                          <span style={{ color:'#334155', fontSize:'0.68rem' }}>
                            {new Date(l.executed_at).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    )
                  })}
              </div>

              <div>
                <div style={css.sectionLabel}>Consent Records</div>
                {consents.length === 0
                  ? <Empty text="No consents recorded." />
                  : consents.map(c => (
                    <div key={c.id} style={{ ...css.logRow, borderLeftColor:'#38bdf8' }}>
                      <div style={{ color:'#e2e8f0', fontFamily:'monospace', fontSize:'0.8rem' }}>
                        {c.action_type}
                      </div>
                      <div style={{ color:'#475569', fontSize:'0.73rem', marginTop:'0.15rem' }}>
                        scope: {c.scope_granted}
                      </div>
                      <div style={{ color:'#334155', fontSize:'0.68rem', marginTop:'0.15rem' }}>
                        {new Date(c.granted_at).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}

                <div style={{ ...css.sectionLabel, marginTop:'1.25rem' }}>GitHub Operations</div>
                {ghState.length === 0
                  ? <Empty text="No GitHub operations." />
                  : ghState.map(g => (
                    <div key={g.id} style={{ ...css.logRow, borderLeftColor:'#a78bfa' }}>
                      <div style={{ color:'#e2e8f0', fontFamily:'monospace', fontSize:'0.8rem' }}>
                        {g.action}
                      </div>
                      <div style={{ color:'#475569', fontSize:'0.73rem' }}>{g.repo}</div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* ══ POLICIES ══ */}
        {tab === 'policies' && (
          <div style={css.page}>
            <div style={css.pageHeader}>
              <div>
                <h2 style={css.pageTitle}>Policy Registry</h2>
                <p style={css.pageSub}>Runtime-editable. Changes take effect immediately without restarting.</p>
              </div>
              <button onClick={handleResetPolicies} style={css.btnGhost}>
                <Icon.Refresh /> Reset
              </button>
            </div>

            {saveMsg && (
              <div style={{ ...css.infoBox, marginBottom:'1rem' }}>{saveMsg}</div>
            )}

            <div style={css.policyGrid}>
              {policies.map(p => {
                const rc2 = RISK[p.risk_level] || RISK.high
                const isEditing = editingPolicy?.action_type === p.action_type
                return (
                  <div key={p.action_type} style={{ ...css.card,
                    borderColor: isEditing ? rc2.color : rc2.border,
                    background: isEditing ? rc2.bg : 'rgba(255,255,255,0.02)' }}>
                    <div style={css.cardRow}>
                      <div style={{ fontFamily:'JetBrains Mono, monospace', color:'#e2e8f0',
                        fontSize:'0.82rem' }}>{p.action_type}</div>
                      <div style={{ ...css.riskPill, background: rc2.color }}>{rc2.label}</div>
                    </div>
                    <p style={{ color:'#64748b', fontSize:'0.8rem', margin:'0.3rem 0 0.75rem' }}>
                      {p.description}
                    </p>

                    {!isEditing ? (
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ color:'#475569', fontSize:'0.75rem', display:'flex',
                          alignItems:'center', gap:'0.3rem' }}>
                          {p.requires_step_up
                            ? <><Icon.Lock /><span style={{ color:'#64748b' }}>Step-up required</span></>
                            : <><Icon.Check /><span style={{ color:'#22c55e' }}>Auto-approve</span></>}
                        </span>
                        <button onClick={() => setEditing({...p})} style={css.editBtn}>
                          <Icon.Edit /> Edit
                        </button>
                      </div>
                    ) : (
                      <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem' }}>
                        <div>
                          <div style={css.formLabel}>Risk Level</div>
                          <select value={editingPolicy.risk_level}
                            onChange={e => setEditing({...editingPolicy, risk_level: e.target.value})}
                            style={css.select}>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                          </select>
                        </div>
                        <label style={{ display:'flex', alignItems:'center', gap:'0.5rem',
                          color:'#94a3b8', fontSize:'0.82rem', cursor:'pointer' }}>
                          <input type="checkbox" checked={editingPolicy.requires_step_up}
                            onChange={e => setEditing({...editingPolicy, requires_step_up: e.target.checked})}
                            style={{ accentColor:'#38bdf8' }} />
                          Requires step-up authentication
                        </label>
                        <div style={{ display:'flex', gap:'0.5rem', marginTop:'0.25rem' }}>
                          <button onClick={handleSavePolicy} style={css.btnPrimary}>Save</button>
                          <button onClick={() => setEditing(null)} style={css.btnGhost}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ══ TOKEN VAULT ══ */}
        {tab === 'vault' && (
          <div style={css.page}>
            <div style={css.pageHeader}>
              <div>
                <h2 style={css.pageTitle}>Auth0 Token Vault</h2>
                <p style={css.pageSub}>
                  Stored third-party credentials. The agent retrieves these to call APIs without seeing your password.
                </p>
              </div>
              <button onClick={loadAudit} style={css.btnGhost} disabled={auditBusy}>
                <Icon.Refresh /> {auditBusy ? 'Loading…' : 'Refresh'}
              </button>
            </div>

            <div style={{ ...css.card, marginBottom:'1rem' }}>
              <div style={css.sectionLabel}>How Token Vault Works</div>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem', marginTop:'0.75rem' }}>
                {[
                  'You log in with GitHub via Auth0 (social connection).',
                  'Auth0 stores your GitHub OAuth token encrypted in the Token Vault.',
                  'When the agent needs GitHub access, it sends your Auth0 JWT to AegisFlow.',
                  'AegisFlow calls the Auth0 Management API (M2M) to retrieve the vault token.',
                  'The GitHub API is called. Your raw credential never left Auth0.',
                ].map((text, i) => (
                  <div key={i} style={{ display:'flex', gap:'0.75rem', alignItems:'flex-start' }}>
                    <span style={{ ...css.riskPill, background:'#38bdf8', color:'#000',
                      flexShrink:0, minWidth:20, textAlign:'center' }}>{i+1}</span>
                    <span style={{ color:'#94a3b8', fontSize:'0.85rem', lineHeight:1.5 }}>{text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={css.card}>
              <div style={css.sectionLabel}>Linked Connections</div>
              {vaultConns.length === 0 ? (
                <div style={{ color:'#334155', fontSize:'0.85rem', marginTop:'0.75rem' }}>
                  No connections found. Log in with GitHub to enable Token Vault.
                </div>
              ) : (
                vaultConns.map(c => (
                  <div key={c.connection} style={{ ...css.logRow, marginTop:'0.5rem',
                    borderLeftColor: c.has_token ? '#22c55e' : '#334155' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ color:'#e2e8f0', fontFamily:'monospace', fontSize:'0.85rem' }}>
                        {c.connection}
                      </span>
                      <span style={{ fontSize:'0.75rem', display:'flex', alignItems:'center', gap:'0.3rem',
                        color: c.has_token ? '#22c55e' : '#475569' }}>
                        {c.has_token && <Icon.Check />}
                        {c.has_token ? 'Token stored in vault' : 'No token stored'}
                      </span>
                    </div>
                    {c.user_id && (
                      <div style={{ color:'#334155', fontSize:'0.7rem', marginTop:'0.2rem',
                        fontFamily:'monospace' }}>{c.user_id}</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Sora:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #050a14; }
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 2px; }
        input::placeholder { color: #334155; }
        select option { background: #0f172a; }
      `}</style>
    </div>
  )
}

// ── Small helpers ────────────────────────────────────────────
function Empty({ text }) {
  return <p style={{ color:'#334155', fontSize:'0.82rem', padding:'0.4rem 0' }}>{text}</p>
}

// ── Styles ───────────────────────────────────────────────────
const css = {
  splash: {
    minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
    background:'#050a14', fontFamily:"'Sora', system-ui, sans-serif",
  },
  splashInner: {
    display:'flex', flexDirection:'column', alignItems:'center',
    textAlign:'center', padding:'2rem', maxWidth:400,
  },
  splashLogo: {
    width:72, height:72, borderRadius:'50%',
    background:'rgba(56,189,248,0.08)', border:'1px solid rgba(56,189,248,0.15)',
    display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'1.5rem',
  },
  splashTitle: {
    fontSize:'2.5rem', fontWeight:700, color:'#f1f5f9', letterSpacing:'-0.03em',
    marginBottom:'0.5rem',
  },
  splashSub: { color:'#475569', fontSize:'0.9rem', lineHeight:1.6, marginBottom:'0.5rem' },
  splashMeta: {
    color:'#1e3a5f', fontSize:'0.75rem', fontFamily:'monospace',
    border:'1px solid #1e293b', padding:'0.2rem 0.75rem', borderRadius:'20px',
    marginBottom:'2rem',
  },
  layout: {
    display:'flex', minHeight:'100vh',
    background:'#050a14', fontFamily:"'Sora', system-ui, sans-serif",
    color:'white',
  },
  sidebar: {
    width:200, flexShrink:0,
    background:'#070d1a', borderRight:'1px solid rgba(255,255,255,0.04)',
    display:'flex', flexDirection:'column', padding:'1.25rem 0.75rem',
  },
  sidebarLogo: {
    display:'flex', alignItems:'center', gap:'0.5rem',
    marginBottom:'2rem', padding:'0 0.25rem',
  },
  navBtn: {
    background:'none', border:'none', color:'#475569',
    textAlign:'left', padding:'0.55rem 0.75rem',
    borderRadius:'6px', cursor:'pointer', fontSize:'0.83rem',
    display:'flex', alignItems:'center', gap:'0.5rem',
    transition:'all 0.15s',
  },
  navActive: { background:'rgba(255,255,255,0.05)', color:'#e2e8f0' },
  userRow: {
    display:'flex', alignItems:'center', gap:'0.5rem',
    padding:'0.6rem 0.5rem', borderRadius:'8px',
    background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.04)',
    marginTop:'auto',
  },
  userAvatar: {
    width:26, height:26, borderRadius:'50%',
    background:'linear-gradient(135deg,#38bdf8,#818cf8)',
    color:'#000', display:'flex', alignItems:'center', justifyContent:'center',
    fontWeight:700, fontSize:'0.72rem', flexShrink:0,
  },
  xBtn: {
    background:'none', border:'none', color:'#334155',
    cursor:'pointer', padding:'2px', display:'flex', alignItems:'center',
    flexShrink:0,
  },
  main: { flex:1, overflowY:'auto', minWidth:0 },
  page: { padding:'2rem 2.5rem', maxWidth:900 },
  pageHeader: {
    display:'flex', justifyContent:'space-between', alignItems:'flex-start',
    marginBottom:'1.5rem', gap:'1rem',
  },
  pageTitle: {
    fontSize:'1.35rem', fontWeight:700, color:'#f1f5f9',
    letterSpacing:'-0.02em', marginBottom:'0.2rem',
  },
  pageSub: { color:'#475569', fontSize:'0.82rem' },
  inputWrap: {
    display:'flex', gap:'0.5rem', alignItems:'center',
    background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)',
    borderRadius:'10px', padding:'0.5rem 0.5rem 0.5rem 1rem',
  },
  input: {
    flex:1, background:'none', border:'none', color:'#e2e8f0',
    fontSize:'0.9rem', outline:'none', fontFamily:"'Sora', system-ui, sans-serif",
  },
  sendBtn: {
    width:36, height:36, borderRadius:'7px', background:'#38bdf8',
    border:'none', color:'#000', cursor:'pointer',
    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
  },
  card: {
    background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)',
    borderRadius:'10px', padding:'1.1rem', marginBottom:'0.75rem',
  },
  cardRow: {
    display:'flex', justifyContent:'space-between', alignItems:'flex-start',
    marginBottom:'0.5rem',
  },
  riskPill: {
    padding:'0.15rem 0.5rem', borderRadius:'20px',
    fontSize:'0.65rem', fontWeight:700, color:'#000', letterSpacing:'0.04em',
  },
  vaultBadge: {
    background:'rgba(56,189,248,0.1)', color:'#38bdf8',
    border:'1px solid rgba(56,189,248,0.2)',
    padding:'0.15rem 0.5rem', borderRadius:'4px',
    fontSize:'0.7rem', fontWeight:600,
  },
  sectionLabel: {
    color:'#334155', fontSize:'0.7rem', fontWeight:600,
    textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:'0.5rem',
  },
  logRow: {
    background:'rgba(255,255,255,0.02)', padding:'0.65rem 0.75rem',
    borderRadius:'6px', marginBottom:'0.35rem',
    borderLeft:'2px solid transparent',
  },
  promptChip: {
    background:'rgba(255,255,255,0.02)', border:'1px solid transparent',
    color:'#64748b', padding:'0.35rem 0.75rem', borderRadius:'20px',
    fontSize:'0.75rem', cursor:'pointer',
    display:'flex', alignItems:'center', gap:'0.4rem',
    transition:'all 0.15s',
  },
  btnPrimary: {
    background:'#38bdf8', color:'#000', border:'none',
    padding:'0.6rem 1.1rem', borderRadius:'7px',
    fontWeight:600, cursor:'pointer', fontSize:'0.85rem',
    display:'flex', alignItems:'center', gap:'0.4rem',
    fontFamily:"'Sora', system-ui, sans-serif",
  },
  btnGhost: {
    background:'rgba(255,255,255,0.03)', color:'#64748b',
    border:'1px solid rgba(255,255,255,0.07)',
    padding:'0.5rem 0.9rem', borderRadius:'7px',
    cursor:'pointer', fontSize:'0.8rem',
    display:'flex', alignItems:'center', gap:'0.4rem',
    fontFamily:"'Sora', system-ui, sans-serif",
  },
  editBtn: {
    background:'none', border:'1px solid rgba(255,255,255,0.07)',
    color:'#475569', padding:'0.3rem 0.6rem', borderRadius:'5px',
    cursor:'pointer', fontSize:'0.75rem',
    display:'flex', alignItems:'center', gap:'0.3rem',
  },
  infoBox: {
    background:'rgba(34,197,94,0.07)', color:'#86efac',
    border:'1px solid rgba(34,197,94,0.2)',
    padding:'0.6rem 1rem', borderRadius:'7px', fontSize:'0.82rem',
  },
  errBox: {
    background:'rgba(239,68,68,0.08)', color:'#fca5a5',
    border:'1px solid rgba(239,68,68,0.2)',
    padding:'0.6rem 1rem', borderRadius:'7px',
    fontSize:'0.85rem', marginBottom:'1rem',
  },
  formLabel: { color:'#475569', fontSize:'0.75rem', marginBottom:'0.25rem' },
  select: {
    width:'100%', background:'#0a1220',
    border:'1px solid rgba(255,255,255,0.07)',
    color:'#e2e8f0', padding:'0.4rem 0.6rem',
    borderRadius:'6px', fontSize:'0.82rem',
    fontFamily:"'Sora', system-ui, sans-serif",
  },
  auditGrid: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem' },
  policyGrid: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem' },
}
