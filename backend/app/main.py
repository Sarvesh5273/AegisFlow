from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List

from app.models import Action, DecisionResult, Policy, RiskLevel, ExecutionResult
from app.llm import generate_action_plan
from app.security import verify_token
from app.executors import dispatch
from app.token_vault import retrieve_vault_token, list_vault_connections
from app import database

app = FastAPI(title="AegisFlow Core API", version="0.2.0")

# Initialise SQLite on startup
@app.on_event("startup")
async def startup():
    database.init_db()


# --- CORS ---
ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


# --- POLICY REGISTRY ---
# All 4 action types are registered with explicit risk levels.
POLICIES: dict[str, Policy] = {
    "read_logs": Policy(
        action_type="read_logs",
        risk_level=RiskLevel.LOW,
        requires_step_up=False,
        auto_approve=True,
        description="Read system logs and health metrics.",
    ),
    "restart_server": Policy(
        action_type="restart_server",
        risk_level=RiskLevel.MEDIUM,
        requires_step_up=True,
        description="Restart a cloud server or service instance.",
    ),
    "create_gpu_instance": Policy(
        action_type="create_gpu_instance",
        risk_level=RiskLevel.HIGH,
        requires_step_up=True,
        max_cost=50.0,
        description="Provision an expensive GPU compute instance.",
    ),
    "delete_database": Policy(
        action_type="delete_database",
        risk_level=RiskLevel.HIGH,
        requires_step_up=True,
        description="Permanently delete a database. Irreversible.",
    ),
}


# --- SCOPE MAP ---
# Maps risk levels to the Auth0 scope required for execution.
SCOPE_MAP = {
    RiskLevel.LOW: None,
    RiskLevel.MEDIUM: "execute:high_risk",
    RiskLevel.HIGH: "execute:high_risk",
}


# --- REQUEST MODELS ---
class ChatRequest(BaseModel):
    prompt: str


# --- POLICY ENGINE ---
def run_policy_check(action: Action) -> DecisionResult:
    """Evaluate a single action against the AegisFlow Policy Registry."""
    policy = POLICIES.get(action.action_type)

    if not policy:
        return DecisionResult(
            action=action,
            allowed=False,
            requires_auth=False,
            risk_level=RiskLevel.HIGH,
            reason=f"Action type '{action.action_type}' is not recognised by AegisFlow policy.",
        )

    if policy.requires_step_up:
        return DecisionResult(
            action=action,
            allowed=False,
            requires_auth=True,
            risk_level=policy.risk_level,
            reason=(
                f"AegisFlow policy requires step-up authentication for "
                f"{policy.risk_level.value.upper()} risk action: {policy.description}"
            ),
        )

    return DecisionResult(
        action=action,
        allowed=True,
        requires_auth=False,
        risk_level=policy.risk_level,
        reason=f"Auto-approved: {policy.description}",
    )


# --- ENDPOINTS ---

@app.get("/health")
async def health_check():
    return {"status": "operational", "version": "0.2.0"}


@app.get("/policies")
async def list_policies():
    """Return all registered policies — used by the frontend policy viewer."""
    return [p.model_dump() for p in POLICIES.values()]


@app.post("/engine/evaluate", response_model=DecisionResult)
async def evaluate_action(action: Action):
    """Directly evaluate a raw action against the Policy Registry."""
    return run_policy_check(action)


@app.post("/agent/chat")
async def process_chat(request: ChatRequest):
    """
    Full agent pipeline:
    1. LLM parses natural language into a structured ActionPlan.
    2. Policy Engine evaluates every action in the plan.
    3. Returns the plan + decisions so the frontend can present them.
    """
    plan = generate_action_plan(request.prompt)

    if not plan.actions:
        return {"status": "error", "message": "The AI could not determine any actions."}

    decisions = [run_policy_check(a).model_dump() for a in plan.actions]

    return {
        "plan": plan.model_dump(),
        "decisions": decisions,
        # Primary decision is the most restrictive one
        "decision": next(
            (d for d in decisions if d["requires_auth"]),
            decisions[0],
        ),
    }


@app.post("/agent/execute", response_model=ExecutionResult)
async def execute_action(
    action: Action,
    token_payload: dict = Depends(verify_token),
):
    """
    Execution gate — protected by Auth0 JWT.

    Flow:
    1. Verify JWT is valid (handled by Depends(verify_token)).
    2. Check the token contains the required scope for this action's risk level.
    3. Log consent to SQLite.
    4. Dispatch to the appropriate mock executor.
    5. Write audit log to SQLite.
    6. Return ExecutionResult with side_effects visible to judges.
    """
    user_id: str = token_payload.get("sub", "unknown")
    scopes: List[str] = token_payload.get("scope", "").split()
    policy = POLICIES.get(action.action_type)

    if not policy:
        raise HTTPException(
            status_code=400,
            detail=f"Action type '{action.action_type}' not recognised.",
        )

    required_scope = SCOPE_MAP.get(policy.risk_level)

    # Scope enforcement
    if required_scope and required_scope not in scopes:
        database.log_action(
            user_id=user_id,
            action_type=action.action_type,
            resource=action.resource,
            status="blocked",
            risk_level=policy.risk_level.value,
            required_scope=required_scope or "none",
            result_message=f"Blocked: missing scope '{required_scope}'.",
            parameters=action.parameters,
        )
        raise HTTPException(
            status_code=403,
            detail=f"Token is valid but missing required scope '{required_scope}'.",
        )

    # Log consent
    if required_scope:
        database.log_consent(
            user_id=user_id,
            action_type=action.action_type,
            resource=action.resource,
            scope_granted=required_scope,
            risk_level=policy.risk_level.value,
        )

    # Execute
    result = dispatch(action, user_id)

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
    )

    return result


# --- TOKEN VAULT ENDPOINTS ---

@app.get("/vault/connections")
async def get_vault_connections(token_payload: dict = Depends(verify_token)):
    """
    List all third-party connections stored in the Auth0 Token Vault for the
    authenticated user. Used by the frontend to show which services are linked.
    """
    user_id = token_payload.get("sub")
    connections = await list_vault_connections(user_id)
    return {"user_id": user_id, "connections": connections}


@app.get("/vault/token/{connection}")
async def get_vault_token(
    connection: str,
    token_payload: dict = Depends(verify_token),
):
    """
    Retrieve a stored third-party OAuth token from Auth0 Token Vault.
    The agent calls this to act on behalf of the user without seeing credentials.

    Example: connection = "github" retrieves the user's GitHub token.
    """
    user_id = token_payload.get("sub")
    vault_data = await retrieve_vault_token(user_id, connection)
    # Never return the raw access_token to the frontend — only metadata
    return {
        "connection": vault_data["connection"],
        "user_id": vault_data["user_id"],
        "vault_retrieved": True,
        "provider": vault_data["provider"],
    }


# --- AUDIT LOG ENDPOINTS ---

@app.get("/audit/logs")
async def get_audit_logs(token_payload: dict = Depends(verify_token)):
    """Return the last 20 action logs for the authenticated user."""
    return database.get_action_logs(limit=20)


@app.get("/audit/state")
async def get_cloud_state(token_payload: dict = Depends(verify_token)):
    """Return all cloud resources provisioned/modified by the agent."""
    return database.get_cloud_state()


@app.get("/audit/consents")
async def get_consent_records(token_payload: dict = Depends(verify_token)):
    """Return consent records — shows judges what the user approved and when."""
    return database.get_consent_records(limit=20)
