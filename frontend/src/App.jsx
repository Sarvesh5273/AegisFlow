import React, { useState, useEffect, useCallback } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { aegisApi } from './api'

const RISK = {
  low:    { bg: '#052e16', border: '#16a34a', badge: '#16a34a', text: '#bbf7d0' },
  medium: { bg: '#431407', border: '#ea580c', badge: '#ea580c', text: '#fed7aa' },
  high:   { bg: '#450a0a', border: '#dc2626', badge: '#dc2626', text: '#fecaca' },
}

const TABS = [
  { id: 'agent',    label: '⚡ Agent' },
  { id: 'audit',    label: '📋 Audit Log' },
  { id: 'policies', label: '🛡️ Policies' },
  { id: 'vault',    label: '🔐 Token Vault' },
]

export default function App() {
  const { loginWithRedirect, logout, isAuthenticated, user,
          getAccessTokenSilently, getAccessTokenWithPopup, isLoading, error } = useAuth0()

  const [tab, setTab]           = useState('agent')
  const [prompt, setPrompt]     = useState('')
  const [planResult, setPlan]   = useState(null)
  const [execResult, setExec]   = useState(null)
  const [chatBusy, setChatBusy] = useState(false)
  const [execBusy, setExecBusy] = useState(false)

  const [logs, setLogs]           = useState([])
  const [ghState, setGhState]     = useState([])
  const [consents, setConsents]   = useState([])
  const [policies, setPolicies]   = useState([])
  const [vaultConns, setVault]    = useState([])
  const [auditBusy, setAuditBusy] = useState(false)

  const [editingPolicy, setEditingPolicy] = useState(null)
  const [saveMsg, setSaveMsg]             = useState('')

  const getToken = useCallback(async (popup = false) => {
    const params = { authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE, scope: 'execute:high_risk' } }
    return popup
      ? getAccessTokenWithPopup(params)
      : getAccessTokenSilently(params).catch(() => getAccessTokenWithPopup(params))
  }, [getAccessTokenSilently, getAccessTokenWithPopup])

  // Load policies (public)
  useEffect(() => {
    aegisApi.getPolicies().then(setPolicies).catch(() => {})
  }, [])

  // Load audit data when tab opens
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
    } catch (e) { console.error(e) }
    finally { setAuditBusy(false) }
  }, [isAuthenticated, getToken])

  useEffect(() => {
    if (isAuthenticated && (tab === 'audit' || tab === 'vault')) loadAudit()
  }, [isAuthenticated, tab, loadAudit])

  // ── Chat ──
  const handleChat = async () => {
    if (!prompt.trim()) return
    setChatBusy(true); setPlan(null); setExec(null)
    try {
      const data = await aegisApi.getChatPlan(prompt)
      setPlan(data)
    } catch { alert('Backend error — is uvicorn running?') }
    finally { setChatBusy(false) }
  }

  // ── Execute (step-up) ──
  const handleExecute = async () => {
    setExecBusy(true)
    try {
      const token = await getToken(true)            // force popup = explicit consent
      const action = planResult.plan.actions[0]
      const result = await aegisApi.executeAction(action, token)
      setExec(result); setPlan(null); setPrompt('')
    } catch (err) {
      alert('Denied: ' + (err.response?.data?.detail || err.message))
    } finally { setExecBusy(false) }
  }

  // ── Auto-approve (low risk) ──
  const handleAutoExec = async () => {
    setExecBusy(true)
    try {
      const token = await getToken()
      const action = planResult.plan.actions[0]
      const result = await aegisApi.executeAction(action, token)
      setExec(result); setPlan(null); setPrompt('')
    } catch (err) {
      alert('Error: ' + (err.response?.data?.detail || err.message))
    } finally { setExecBusy(false) }
  }

  // ── Policy editor ──
  const handleSavePolicy = async () => {
    if (!editingPolicy) return
    setSaveMsg('')
    try {
      const token = await getToken()
      await aegisApi.updatePolicy(editingPolicy, token)
      const updated = await aegisApi.getPolicies()
      setPolicies(updated)
      setSaveMsg('✓ Policy saved')
      setEditingPolicy(null)
    } catch (err) {
      setSaveMsg('Error: ' + (err.response?.data?.detail || err.message))
    }
  }

  const handleResetPolicies = async () => {
    try {
      const token = await getToken()
      await aegisApi.resetPolicies(token)
      const updated = await aegisApi.getPolicies()
      setPolicies(updated)
      setSaveMsg('✓ Policies reset to defaults')
    } catch (err) {
      setSaveMsg('Error: ' + (err.response?.data?.detail || err.message))
    }
  }

  // ── Loading / not authed ──
  if (isLoading) return <div style={s.splash}><p style={{color:'#64748b'}}>Connecting to AegisFlow…</p></div>

  if (!isAuthenticated) return (
    <div style={s.splash}>
      <Shield size={56} />
      <h1 style={s.bigTitle}>AegisFlow</h1>
      <p style={{color:'#64748b',marginBottom:'2rem',maxWidth:360,textAlign:'center'}}>
        Policy-Enforced Consent for AI Agents.<br/>
        Powered by Auth0 Token Vault.
      </p>
      {error && <div style={s.errBox}>{error.message}</div>}
      <button onClick={() => loginWithRedirect()} style={s.btn.primary}>
        Initialize System
      </button>
    </div>
  )

  const decision = planResult?.decision
  const rc = decision ? (RISK[decision.risk_level] || RISK.high) : null

  return (
    <div style={s.layout}>

      {/* Sidebar */}
      <aside style={s.sidebar}>
        <div style={s.logo}><Shield size={24}/><span style={{color:'#38bdf8',fontWeight:700}}>AegisFlow</span></div>
        <nav style={s.nav}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{...s.navBtn, ...(tab===t.id ? s.navActive : {})}}>
              {t.label}
            </button>
          ))}
        </nav>
        <div style={s.userChip}>
          <div style={s.avatar}>{user.email?.[0]?.toUpperCase()}</div>
          <span style={{color:'#64748b',fontSize:'0.72rem',wordBreak:'break-all',flex:1}}>{user.email}</span>
          <button onClick={() => logout({logoutParams:{returnTo:window.location.origin}})} style={s.xBtn}>✕</button>
        </div>
      </aside>

      {/* Main */}
      <main style={s.main}>

        {/* ══ AGENT ══ */}
        {tab === 'agent' && (
          <div>
            <PageHeader title="Agent Console"
              sub="Type a command. AegisFlow intercepts high-risk actions before execution." />

            <div style={s.inputRow}>
              <input value={prompt} onChange={e=>setPrompt(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&handleChat()}
                placeholder="e.g. 'Show my repos' or 'Delete the repo myuser/test-repo'"
                style={s.input} disabled={chatBusy} />
              <button onClick={handleChat} disabled={chatBusy||!prompt.trim()} style={s.btn.primary}>
                {chatBusy ? 'Analyzing…' : 'Send'}
              </button>
            </div>

            {/* Plan card */}
            {planResult && !execResult && (
              <div style={{...s.card, border:`1px solid ${rc.border}`}}>
                <div style={s.cardRow}>
                  <span style={s.label}>Action Plan</span>
                  <RiskBadge level={decision.risk_level} />
                </div>
                <pre style={s.code}>{JSON.stringify(planResult.plan.actions, null, 2)}</pre>
                <div style={{...s.decisionBox, background:rc.bg, border:`1px solid ${rc.border}`}}>
                  <div>
                    <div style={{color:rc.text,fontWeight:600,marginBottom:'0.25rem'}}>
                      {decision.requires_auth ? '🔐 Step-up Auth Required' : '✓ Auto-Approved'}
                    </div>
                    <div style={{color:'#94a3b8',fontSize:'0.85rem'}}>{decision.reason}</div>
                  </div>
                  {decision.requires_auth
                    ? <button onClick={handleExecute} disabled={execBusy}
                        style={{...s.btn.primary, background:rc.badge, color:'#000'}}>
                        {execBusy ? 'Processing…' : '🔐 Authorize & Execute'}
                      </button>
                    : <button onClick={handleAutoExec} disabled={execBusy}
                        style={{...s.btn.primary, background:'#16a34a'}}>
                        {execBusy ? 'Processing…' : '✓ Execute'}
                      </button>
                  }
                </div>
              </div>
            )}

            {/* Execution result */}
            {execResult && (
              <div style={{...s.card, border:'1px solid #16a34a'}}>
                <div style={s.cardRow}>
                  <span style={{color:'#16a34a',fontWeight:600}}>✓ Execution Complete</span>
                  {execResult.vault_used && <span style={s.vaultTag}>🔐 Token Vault Used</span>}
                </div>
                <p style={{color:'#cbd5e1',margin:'0 0 1rem'}}>{execResult.message}</p>
                <div style={s.label}>Side Effects (written to audit log)</div>
                <pre style={s.code}>{JSON.stringify(execResult.side_effects, null, 2)}</pre>
                <button onClick={()=>setExec(null)} style={{...s.btn.ghost,marginTop:'0.75rem'}}>Clear</button>
              </div>
            )}

            {/* Sample commands */}
            {!planResult && !execResult && (
              <div style={{marginTop:'1.5rem'}}>
                <div style={s.label}>Try these commands</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:'0.5rem',marginTop:'0.5rem'}}>
                  {[
                    'Show my GitHub repositories',
                    'Create an issue in myuser/my-repo titled "Bug: login fails"',
                    'Create a new private repo called aegisflow-test',
                    'Delete the repository myuser/test-repo',
                  ].map(cmd => (
                    <button key={cmd} onClick={()=>{setPrompt(cmd)}}
                      style={s.chip}>{cmd}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ AUDIT LOG ══ */}
        {tab === 'audit' && (
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <PageHeader title="Audit Log" sub="Every action, consent, and GitHub operation is recorded." />
              <button onClick={loadAudit} style={s.btn.ghost} disabled={auditBusy}>
                {auditBusy ? 'Loading…' : '↻ Refresh'}
              </button>
            </div>

            <div style={s.grid2}>
              {/* Action logs */}
              <div>
                <div style={s.label}>Action History</div>
                {logs.length === 0
                  ? <Empty text="No actions yet. Run a command." />
                  : logs.map(l => (
                    <div key={l.id} style={{...s.logRow, borderLeft:`3px solid ${l.status==='success'?'#16a34a':'#dc2626'}`}}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:'0.15rem'}}>
                        <span style={{color:'#e2e8f0',fontWeight:600,fontSize:'0.82rem'}}>{l.action_type}</span>
                        <span style={{fontSize:'0.72rem',color:l.status==='success'?'#16a34a':'#dc2626'}}>{l.status.toUpperCase()}</span>
                      </div>
                      <div style={{color:'#64748b',fontSize:'0.75rem'}}>{l.resource}</div>
                      <div style={{display:'flex',justifyContent:'space-between',marginTop:'0.15rem'}}>
                        <span style={{color:'#475569',fontSize:'0.7rem'}}>{l.risk_level} risk</span>
                        {l.vault_used===1 && <span style={s.vaultTag}>Vault</span>}
                      </div>
                      <div style={{color:'#334155',fontSize:'0.68rem',marginTop:'0.15rem'}}>{l.executed_at}</div>
                    </div>
                  ))}
              </div>

              <div>
                {/* Consent records */}
                <div style={s.label}>Consent Records</div>
                {consents.length === 0
                  ? <Empty text="No consents yet." />
                  : consents.map(c => (
                    <div key={c.id} style={{...s.logRow, borderLeft:'3px solid #38bdf8'}}>
                      <span style={{color:'#e2e8f0',fontWeight:600,fontSize:'0.82rem'}}>{c.action_type}</span>
                      <div style={{color:'#64748b',fontSize:'0.75rem'}}>Scope: {c.scope_granted}</div>
                      <div style={{color:'#475569',fontSize:'0.68rem'}}>{c.granted_at}</div>
                    </div>
                  ))}

                {/* GitHub state */}
                <div style={{...s.label,marginTop:'1.25rem'}}>GitHub Operations</div>
                {ghState.length === 0
                  ? <Empty text="No GitHub operations yet." />
                  : ghState.map(g => (
                    <div key={g.id} style={{...s.logRow, borderLeft:'3px solid #a78bfa'}}>
                      <span style={{color:'#e2e8f0',fontWeight:600,fontSize:'0.82rem'}}>{g.action}</span>
                      <div style={{color:'#64748b',fontSize:'0.75rem'}}>{g.repo}</div>
                      <div style={{color:'#475569',fontSize:'0.68rem'}}>{g.created_at}</div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* ══ POLICIES ══ */}
        {tab === 'policies' && (
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <PageHeader title="Policy Registry"
                sub="Runtime-editable policies. Change risk levels and consent requirements live." />
              <button onClick={handleResetPolicies} style={s.btn.ghost}>↺ Reset Defaults</button>
            </div>
            {saveMsg && <div style={{...s.infoBox,marginBottom:'1rem'}}>{saveMsg}</div>}

            <div style={s.grid2}>
              {policies.map(p => {
                const rc2 = RISK[p.risk_level] || RISK.high
                const editing = editingPolicy?.action_type === p.action_type
                return (
                  <div key={p.action_type} style={{...s.card, border:`1px solid ${rc2.border}`}}>
                    <div style={s.cardRow}>
                      <span style={{color:'#e2e8f0',fontWeight:600,fontSize:'0.9rem'}}>{p.action_type}</span>
                      <RiskBadge level={p.risk_level} />
                    </div>
                    <p style={{color:'#64748b',fontSize:'0.82rem',margin:'0.4rem 0 0.75rem'}}>{p.description}</p>

                    {!editing ? (
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span style={{fontSize:'0.78rem',color:'#94a3b8'}}>
                          {p.requires_step_up ? '🔐 Step-up required' : '✓ Auto-approve'}
                        </span>
                        <button onClick={()=>setEditingPolicy({...p})} style={s.btn.ghost}>Edit</button>
                      </div>
                    ) : (
                      <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
                        <label style={s.formLabel}>Risk Level
                          <select value={editingPolicy.risk_level}
                            onChange={e=>setEditingPolicy({...editingPolicy,risk_level:e.target.value})}
                            style={s.select}>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                          </select>
                        </label>
                        <label style={{...s.formLabel,flexDirection:'row',alignItems:'center',gap:'0.5rem'}}>
                          <input type="checkbox" checked={editingPolicy.requires_step_up}
                            onChange={e=>setEditingPolicy({...editingPolicy,requires_step_up:e.target.checked})} />
                          Requires step-up auth
                        </label>
                        <div style={{display:'flex',gap:'0.5rem',marginTop:'0.25rem'}}>
                          <button onClick={handleSavePolicy} style={s.btn.primary}>Save</button>
                          <button onClick={()=>setEditingPolicy(null)} style={s.btn.ghost}>Cancel</button>
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
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <PageHeader title="Auth0 Token Vault"
                sub="Stored third-party credentials. The agent retrieves these to call APIs without seeing your password." />
              <button onClick={loadAudit} style={s.btn.ghost} disabled={auditBusy}>
                {auditBusy ? 'Loading…' : '↻ Refresh'}
              </button>
            </div>

            {/* How it works */}
            <div style={s.card}>
              <div style={s.label}>How Token Vault Works</div>
              <div style={{display:'flex',flexDirection:'column',gap:'0.6rem',marginTop:'0.75rem'}}>
                {[
                  ['1', 'You log in with GitHub via Auth0 (social connection).'],
                  ['2', 'Auth0 stores your GitHub OAuth token in the Token Vault — encrypted, scoped to you.'],
                  ['3', 'When the agent needs to call GitHub, it sends your Auth0 JWT to AegisFlow.'],
                  ['4', 'AegisFlow calls the Auth0 Management API (M2M) to retrieve the vault token.'],
                  ['5', 'The GitHub API is called. Your raw credential never left Auth0.'],
                ].map(([n, t]) => (
                  <div key={n} style={{display:'flex',gap:'0.75rem',alignItems:'flex-start'}}>
                    <span style={{...s.badge,background:'#38bdf8',color:'#0f172a',flexShrink:0}}>{n}</span>
                    <span style={{color:'#94a3b8',fontSize:'0.88rem'}}>{t}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Linked connections */}
            <div style={{...s.card,marginTop:'1rem'}}>
              <div style={s.cardRow}>
                <div style={s.label}>Linked Connections</div>
              </div>
              {vaultConns.length === 0 ? (
                <div style={{color:'#475569',fontSize:'0.88rem',marginTop:'0.75rem'}}>
                  <p>No third-party connections found.</p>
                  <p style={{marginTop:'0.5rem'}}>To enable Token Vault:</p>
                  <ol style={{color:'#64748b',paddingLeft:'1.25rem',lineHeight:1.8}}>
                    <li>Go to Auth0 Dashboard → Authentication → Social</li>
                    <li>Enable GitHub connection</li>
                    <li>Turn on <strong style={{color:'#e2e8f0'}}>"Store tokens"</strong> in the connection settings</li>
                    <li>Log out and log back in using the GitHub button</li>
                  </ol>
                </div>
              ) : (
                vaultConns.map(c => (
                  <div key={c.connection} style={{...s.logRow, borderLeft:`3px solid ${c.has_token?'#16a34a':'#475569'}`, marginTop:'0.5rem'}}>
                    <div style={{display:'flex',justifyContent:'space-between'}}>
                      <span style={{color:'#e2e8f0',fontWeight:600}}>{c.connection}</span>
                      <span style={{color:c.has_token?'#16a34a':'#64748b',fontSize:'0.8rem'}}>
                        {c.has_token ? '✓ Token stored in vault' : 'No token stored'}
                      </span>
                    </div>
                    {c.user_id && <div style={{color:'#475569',fontSize:'0.72rem',marginTop:'0.2rem'}}>{c.user_id}</div>}
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

// ── Small components ──
function Shield({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <path d="M24 4L44 14V26C44 35.9 35.1 44.4 24 47C12.9 44.4 4 35.9 4 26V14L24 4Z"
        fill="#1e293b" stroke="#38bdf8" strokeWidth="2"/>
      <path d="M20 24L23 27L28 21" stroke="#38bdf8" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function RiskBadge({ level }) {
  const rc = RISK[level] || RISK.high
  return <span style={{...s.badge, background:rc.badge, color:'#000'}}>{level.toUpperCase()}</span>
}

function PageHeader({ title, sub }) {
  return (
    <div style={{marginBottom:'1.5rem'}}>
      <h2 style={{color:'#f1f5f9',fontWeight:700,margin:'0 0 0.25rem',fontSize:'1.4rem'}}>{title}</h2>
      <p style={{color:'#64748b',fontSize:'0.88rem',margin:0}}>{sub}</p>
    </div>
  )
}

function Empty({ text }) {
  return <p style={{color:'#334155',fontSize:'0.85rem',padding:'0.5rem 0'}}>{text}</p>
}

// ── Styles ──
const s = {
  splash:   { minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#0f172a', color:'white', fontFamily:'Inter,system-ui,sans-serif', padding:'2rem' },
  bigTitle: { fontSize:'3rem', fontWeight:800, background:'linear-gradient(to right,#38bdf8,#818cf8)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', margin:'1rem 0 0.5rem' },
  layout:   { display:'flex', minHeight:'100vh', background:'#0f172a', color:'white', fontFamily:'Inter,system-ui,sans-serif' },
  sidebar:  { width:210, flexShrink:0, background:'#080f1e', borderRight:'1px solid #1e293b', display:'flex', flexDirection:'column', padding:'1.25rem 0.75rem', gap:'0.25rem' },
  logo:     { display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'1.75rem', padding:'0 0.25rem' },
  nav:      { display:'flex', flexDirection:'column', gap:'0.15rem', flex:1 },
  navBtn:   { background:'none', border:'none', color:'#475569', textAlign:'left', padding:'0.55rem 0.75rem', borderRadius:'6px', cursor:'pointer', fontSize:'0.85rem' },
  navActive:{ background:'#1e293b', color:'#e2e8f0' },
  userChip: { display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.6rem', background:'#1e293b', borderRadius:'8px', marginTop:'auto' },
  avatar:   { width:26, height:26, borderRadius:'50%', background:'#38bdf8', color:'#0f172a', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:'0.75rem', flexShrink:0 },
  xBtn:     { background:'none', border:'none', color:'#475569', cursor:'pointer', fontSize:'1rem', flexShrink:0 },
  main:     { flex:1, padding:'2.5rem', overflowY:'auto', maxWidth:960 },
  inputRow: { display:'flex', gap:'0.75rem', marginBottom:'1.25rem' },
  input:    { flex:1, padding:'0.7rem 1rem', borderRadius:'8px', border:'1px solid #1e293b', background:'#1e293b', color:'#f1f5f9', fontSize:'0.95rem', outline:'none' },
  card:     { background:'#1e293b', borderRadius:'12px', padding:'1.25rem', marginBottom:'1rem', border:'1px solid #334155' },
  cardRow:  { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.75rem' },
  decisionBox: { padding:'1rem', borderRadius:'8px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:'1rem', flexWrap:'wrap' },
  code:     { background:'#0f172a', padding:'1rem', borderRadius:'8px', overflowX:'auto', color:'#94a3b8', fontSize:'0.8rem', margin:'0 0 1rem', fontFamily:'monospace' },
  label:    { color:'#64748b', fontSize:'0.72rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' },
  badge:    { padding:'0.2rem 0.55rem', borderRadius:'20px', fontSize:'0.68rem', fontWeight:700 },
  vaultTag: { background:'#1e3a5f', color:'#38bdf8', padding:'0.15rem 0.5rem', borderRadius:'4px', fontSize:'0.68rem', fontWeight:600 },
  chip:     { background:'#1e293b', border:'1px solid #334155', color:'#94a3b8', padding:'0.35rem 0.75rem', borderRadius:'20px', fontSize:'0.78rem', cursor:'pointer' },
  grid2:    { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem' },
  logRow:   { background:'#0f172a', padding:'0.65rem 0.75rem', borderRadius:'6px', marginBottom:'0.4rem' },
  infoBox:  { background:'#052e16', color:'#86efac', border:'1px solid #16a34a', padding:'0.6rem 1rem', borderRadius:'8px', fontSize:'0.85rem' },
  errBox:   { background:'#450a0a', color:'#fca5a5', padding:'0.75rem 1rem', borderRadius:'8px', marginBottom:'1rem', fontSize:'0.88rem' },
  formLabel:{ display:'flex', flexDirection:'column', gap:'0.3rem', color:'#94a3b8', fontSize:'0.82rem' },
  select:   { background:'#0f172a', border:'1px solid #334155', color:'#e2e8f0', padding:'0.4rem', borderRadius:'6px', marginTop:'0.2rem' },
  btn: {
    primary: { background:'#38bdf8', color:'#0f172a', border:'none', padding:'0.65rem 1.25rem', borderRadius:'8px', fontWeight:600, cursor:'pointer', fontSize:'0.9rem', whiteSpace:'nowrap' },
    ghost:   { background:'transparent', color:'#94a3b8', border:'1px solid #334155', padding:'0.5rem 1rem', borderRadius:'8px', cursor:'pointer', fontSize:'0.82rem' },
  },
}
