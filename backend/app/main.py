from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import copy

from app.models import Action, DecisionResult, Policy, RiskLevel, ExecutionResult, PolicyUpdateRequest
from app.llm import generate_action_plan
from app.security import verify_token
from app.github_executor import dispatch as github_dispatch
from app.token_vault import get_github_token_from_vault, list_vault_connections
from app import database

app = FastAPI(title="AegisFlow Core API", version="0.3.0")


@app.on_event("startup")
async def startup():
    database.init_db()


# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT"],
    allow_headers=["Authorization", "Content-Type"],
)


# --- POLICY REGISTRY ---
# Runtime-editable via /policies/update endpoint (policy editor feature)
DEFAULT_POLICIES: dict[str, Policy] = {
    "github_read_repos": Policy(
        action_type="github_read_repos",
        risk_level=RiskLevel.LOW,
        requires_step_up=False,
        auto_approve=True,
        requires_vault=True,
        description="List and read the user's GitHub repositories.",
    ),
    "github_create_issue": Policy(
        action_type="github_create_issue",
        risk_level=RiskLevel.MEDIUM,
        requires_step_up=True,
        requires_vault=True,
        description="Create an issue in a GitHub repository.",
    ),
    "github_create_repo": Policy(
        action_type="github_create_repo",
        risk_level=RiskLevel.MEDIUM,
        requires_step_up=True,
        requires_vault=True,
        description="Create a new GitHub repository.",
    ),
    "github_delete_repo": Policy(
        action_type="github_delete_repo",
        risk_level=RiskLevel.HIGH,
        requires_step_up=True,
        requires_vault=True,
        description="Permanently delete a GitHub repository. Irreversible.",
    ),
}

# Live mutable copy — modified by policy editor
POLICIES: dict[str, Policy] = copy.deepcopy(DEFAULT_POLICIES)

SCOPE_REQUIRED = {
    RiskLevel.LOW: None,
    RiskLevel.MEDIUM: "execute:high_risk",
    RiskLevel.HIGH: "execute:high_risk",
}


# --- POLICY ENGINE ---
def run_policy_check(action: Action) -> DecisionResult:
    policy = POLICIES.get(action.action_type)

    if not policy:
        return DecisionResult(
            action=action,
            allowed=False,
            requires_auth=False,
            risk_level=RiskLevel.HIGH,
            reason=f"Action type '{action.action_type}' is not registered in AegisFlow policy.",
        )

    if policy.requires_step_up:
        return DecisionResult(
            action=action,
            allowed=False,
            requires_auth=True,
            risk_level=policy.risk_level,
            reason=(
                f"Policy requires step-up authentication for "
                f"{policy.risk_level.value.upper()} risk action: {policy.description}"
            ),
        )

    return DecisionResult(
        action=action,
        allowed=True,
        requires_auth=False,
        risk_level=policy.risk_level,
        reason=f"Auto-approved by policy: {policy.description}",
    )


# --- REQUEST MODELS ---
class ChatRequest(BaseModel):
    prompt: str


# --- CORE ENDPOINTS ---

@app.get("/health")
async def health_check():
    return {"status": "operational", "version": "0.3.0"}


@app.get("/policies")
async def list_policies():
    """Return all registered policies. Used by the Policy Registry UI tab."""
    return [p.model_dump() for p in POLICIES.values()]


@app.put("/policies/update")
async def update_policy(
    update: PolicyUpdateRequest,
    token_payload: dict = Depends(verify_token),
):
    """
    Runtime policy editor — update a policy's risk level and step-up requirement.
    Requires authentication. Demonstrates Policy-as-Code governance.
    """
    if update.action_type not in POLICIES:
        raise HTTPException(status_code=404, detail=f"Policy '{update.action_type}' not found.")

    existing = POLICIES[update.action_type]
    POLICIES[update.action_type] = Policy(
        action_type=update.action_type,
        risk_level=update.risk_level,
        requires_step_up=update.requires_step_up,
        auto_approve=update.auto_approve,
        description=update.description or existing.description,
        requires_vault=existing.requires_vault,
    )
    return {"message": f"Policy '{update.action_type}' updated.", "policy": POLICIES[update.action_type].model_dump()}


@app.post("/policies/reset")
async def reset_policies(token_payload: dict = Depends(verify_token)):
    """Reset all policies to defaults."""
    global POLICIES
    POLICIES = copy.deepcopy(DEFAULT_POLICIES)
    return {"message": "Policies reset to defaults."}


@app.post("/engine/evaluate", response_model=DecisionResult)
async def evaluate_action(action: Action):
    """Directly evaluate a raw action against the Policy Registry."""
    return run_policy_check(action)


@app.post("/agent/chat")
async def process_chat(request: ChatRequest):
    """
    Full agent pipeline:
    1. LLM parses natural language → structured ActionPlan
    2. Policy Engine evaluates every action
    3. Returns plan + decisions for the frontend to render
    """
    plan = generate_action_plan(request.prompt)

    if not plan.actions:
        return {"status": "error", "message": "The AI could not determine any actions."}

    decisions = [run_policy_check(a).model_dump() for a in plan.actions]

    # Primary decision = most restrictive (requires_auth takes priority)
    primary = next((d for d in decisions if d["requires_auth"]), decisions[0])

    return {
        "plan": plan.model_dump(),
        "decisions": decisions,
        "decision": primary,
    }


@app.post("/agent/execute", response_model=ExecutionResult)
async def execute_action(
    action: Action,
    token_payload: dict = Depends(verify_token),
):
    """
    Execution gate — protected by Auth0 JWT.

    Full flow:
    1. JWT verified (via Depends)
    2. Scope checked against policy
    3. GitHub token retrieved from Auth0 Token Vault (agent never sees credentials)
    4. Real GitHub API call executed
    5. Consent + action written to SQLite audit log
    """
    user_id: str = token_payload.get("sub", "unknown")
    scopes: List[str] = token_payload.get("scope", "").split()
    policy = POLICIES.get(action.action_type)

    if not policy:
        raise HTTPException(status_code=400, detail=f"Action '{action.action_type}' not in policy registry.")

    required_scope = SCOPE_REQUIRED.get(policy.risk_level)

    # Scope enforcement
    if required_scope and required_scope not in scopes:
        database.log_action(
            user_id=user_id,
            action_type=action.action_type,
            resource=action.resource,
            status="blocked",
            risk_level=policy.risk_level.value,
            required_scope=required_scope,
            result_message=f"Blocked: missing scope '{required_scope}'.",
            parameters=action.parameters,
            vault_used=False,
        )
        raise HTTPException(
            status_code=403,
            detail=f"Token valid but missing required scope '{required_scope}'.",
        )

    # Log consent for step-up actions
    if required_scope:
        database.log_consent(
            user_id=user_id,
            action_type=action.action_type,
            resource=action.resource,
            scope_granted=required_scope,
            risk_level=policy.risk_level.value,
        )

    # Retrieve GitHub token from Auth0 Token Vault
    github_token = await get_github_token_from_vault(user_id)

    # Execute real GitHub API call
    result = await github_dispatch(action, user_id, github_token)

    # Audit log
    database.log_action(
        user_id=user_id,
        action_type=action.action_type,
        resource=action.resource,
        status=result.status,
        risk_level=policy.risk_level.value,
        required_scope=required_scope or "none",
        result_message=result.message,
        parameters=action.parameters,
        vault_used=True,
    )

    return result


# --- TOKEN VAULT ENDPOINTS ---

@app.get("/vault/connections")
async def get_vault_connections(token_payload: dict = Depends(verify_token)):
    """List third-party connections stored in Auth0 Token Vault for the user."""
    user_id = token_payload.get("sub")
    connections = await list_vault_connections(user_id)
    return {"user_id": user_id, "connections": connections}


# --- AUDIT ENDPOINTS ---

@app.get("/audit/logs")
async def get_audit_logs(token_payload: dict = Depends(verify_token)):
    return database.get_action_logs(limit=20)


@app.get("/audit/github")
async def get_github_state(token_payload: dict = Depends(verify_token)):
    return database.get_github_state(limit=20)


@app.get("/audit/consents")
async def get_consent_records(token_payload: dict = Depends(verify_token)):
    return database.get_consent_records(limit=20)
