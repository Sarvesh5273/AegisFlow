import axios from 'axios'

const API_BASE_URL = 'http://localhost:8000'

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

const authClient = (token) =>
  axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })

export const aegisApi = {
  async getChatPlan(prompt) {
    const res = await apiClient.post('/agent/chat', { prompt })
    return res.data
  },

  async executeAction(action, token) {
    const res = await authClient(token).post('/agent/execute', action)
    return res.data
  },

  async getPolicies() {
    const res = await apiClient.get('/policies')
    return res.data
  },

  async getAuditLogs(token) {
    const res = await authClient(token).get('/audit/logs')
    return res.data
  },

  async getCloudState(token) {
    const res = await authClient(token).get('/audit/state')
    return res.data
  },

  async getConsentRecords(token) {
    const res = await authClient(token).get('/audit/consents')
    return res.data
  },

  async getVaultConnections(token) {
    const res = await authClient(token).get('/vault/connections')
    return res.data
  },
}