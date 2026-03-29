# AegisFlow

**Policy-Enforced Consent for Autonomous AI Agents**

AegisFlow is a zero-trust execution layer for AI agents. It intercepts high-risk cloud operations, requires explicit user consent via Auth0 Token Vault, and produces a verifiable audit trail of every action.

Built for the [Authorized to Act Hackathon](https://auth0.devpost.com) — Auth0 for AI Agents.

---

## Architecture

```
User Prompt
    ↓
LLM (Groq llama-3.3-70b) → ActionPlan
    ↓
Policy Engine → DecisionResult (allowed / requires_auth)
    ↓
[If requires_auth]
Auth0 Token Vault → Scoped JWT
    ↓
/agent/execute → verify_token → scope check → Executor → SQLite audit log
```

## Stack

| Layer | Tech |
|---|---|
| Backend | FastAPI, Python 3.9+ |
| LLM | Groq API (llama-3.3-70b-versatile) via instructor |
| Identity | Auth0 (JWT RS256, Token Vault, step-up auth) |
| Audit | SQLite |
| Frontend | React + Vite |

## Setup

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in your values
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env   # fill in your values
npm run dev
```

## Auth0 Setup

1. Create a tenant (e.g. `aegisflow.us.auth0.com`)
2. Register a **Single Page Application** → copy Client ID to frontend `.env`
3. Register an **API** with identifier `https://api.aegisflow.local` → add scope `execute:high_risk`
4. Create a **Machine-to-Machine Application** for Token Vault management → copy to backend `.env`
5. Enable a social connection (GitHub / Google) with **Token Vault** enabled

## Key Endpoints

| Endpoint | Auth | Description |
|---|---|---|
| `POST /agent/chat` | None | LLM parses prompt → policy decision |
| `POST /agent/execute` | JWT + scope | Executes action, writes audit log |
| `GET /vault/connections` | JWT | Lists Token Vault connections |
| `GET /vault/token/{connection}` | JWT | Retrieves vault token (agent use only) |
| `GET /audit/logs` | JWT | Action history |
| `GET /audit/state` | JWT | Cloud resource state |
| `GET /audit/consents` | JWT | Consent records |
| `GET /policies` | None | Policy registry |
