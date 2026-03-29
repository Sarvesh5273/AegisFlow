import axios from 'axios'

const BASE = 'http://localhost:8000'

const open = axios.create({ baseURL: BASE, headers: { 'Content-Type': 'application/json' } })

const auth = (token) =>
  axios.create({
    baseURL: BASE,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  })

export const aegisApi = {
  getChatPlan: (prompt) => open.post('/agent/chat', { prompt }).then(r => r.data),
  executeAction: (action, token) => auth(token).post('/agent/execute', action).then(r => r.data),
  getPolicies: () => open.get('/policies').then(r => r.data),
  updatePolicy: (policy, token) => auth(token).put('/policies/update', policy).then(r => r.data),
  resetPolicies: (token) => auth(token).post('/policies/reset').then(r => r.data),
  getAuditLogs: (token) => auth(token).get('/audit/logs').then(r => r.data),
  getGithubState: (token) => auth(token).get('/audit/github').then(r => r.data),
  getConsentRecords: (token) => auth(token).get('/audit/consents').then(r => r.data),
  getVaultConnections: (token) => auth(token).get('/vault/connections').then(r => r.data),
}