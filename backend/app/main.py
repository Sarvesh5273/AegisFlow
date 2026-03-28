from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

# Local project imports
from app.models import Action, DecisionResult, Policy, RiskLevel
from app.llm import generate_action_plan
from app.security import verify_token

app = FastAPI(title="AegisFlow Core API")

# --- PHASE 4: CORS BRIDGE ---
# Only allow your AegisFlow React frontend to communicate with this API
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

# Mock Policy Database
POLICIES = {
    "create_gpu_instance": Policy(
        action_type="create_gpu_instance", 
        risk_level=RiskLevel.HIGH, 
        requires_step_up=True, 
        max_cost=50.0
    ),
    "read_logs": Policy(
        action_type="read_logs", 
        risk_level=RiskLevel.LOW, 
        requires_step_up=False, 
        auto_approve=True
    )
}

class ChatRequest(BaseModel):
    prompt: str

# --- HELPER LOGIC ---
def run_policy_check(action: Action) -> DecisionResult:
    """Internal helper to evaluate an action against AegisFlow policies."""
    policy = POLICIES.get(action.action_type)
    
    if not policy:
        return DecisionResult(
            action=action, 
            allowed=False, 
            requires_auth=False, 
            reason="Action type not recognized by policy."
        )

    if policy.requires_step_up:
        return DecisionResult(
            action=action, 
            allowed=False, 
            requires_auth=True, 
            reason=f"Policy mandates step-up authentication for {policy.risk_level.value} risk actions."
        )

    return DecisionResult(
        action=action, 
        allowed=True, 
        requires_auth=False, 
        reason="Auto-approved by policy."
    )

# --- ENDPOINTS ---

@app.get("/health")
async def health_check():
    return {"status": "operational", "version": "0.1.0"}

@app.post("/engine/evaluate", response_model=DecisionResult)
async def evaluate_action(action: Action):
    """Directly evaluates a raw action against our Policy-as-Code rules."""
    return run_policy_check(action)

@app.post("/agent/chat")
async def process_chat(request: ChatRequest):
    """
    1. Sends text to LLM to get an ActionPlan.
    2. Evaluates the primary action against the AegisFlow Policy Engine.
    """
    plan = generate_action_plan(request.prompt)
    
    if not plan.actions:
        return {"status": "error", "message": "The AI could not determine any actions."}
        
    # Evaluate the first action in the sequence for the demo
    decision = run_policy_check(plan.actions[0])
    
    return {
         "plan": plan.model_dump(),
         "decision": decision.model_dump()
    }

@app.post("/agent/execute")
async def execute_action(action: Action, token_payload: dict = Depends(verify_token)):
    """
    High-risk execution gate. 
    Only runs if:
    1. A valid Auth0 JWT is provided via Bearer token.
    2. The token contains the 'execute:high_risk' scope.
    """
    scopes = token_payload.get("scope", "").split()
    policy = POLICIES.get(action.action_type)
    
    if policy and policy.requires_step_up and "execute:high_risk" not in scopes:
        raise HTTPException(
            status_code=403, 
            detail="Valid token provided, but missing required 'execute:high_risk' scope."
        )

    # In a real app, this is where you'd call the Azure/AWS/GCP SDKs
    return {
        "status": "success", 
        "message": f"Action '{action.action_type}' executed securely via AegisFlow.",
        "verified_user_id": token_payload.get("sub")
    }