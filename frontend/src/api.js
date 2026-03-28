import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const aegisApi = {
  /**
   * Sends the user's natural language prompt to the AI agent.
   */
  async getChatPlan(prompt) {
    const response = await apiClient.post('/agent/chat', { prompt });
    return response.data;
  },

  /**
   * Executes a specific action. 
   * Requires a valid Auth0 Access Token for high-risk actions.
   */
  async executeAction(action, token = null) {
    const config = {};
    if (token) {
      config.headers = {
        Authorization: `Bearer ${token}`,
      };
    }
    
    const response = await apiClient.post('/agent/execute', action, config);
    return response.data;
  }
};