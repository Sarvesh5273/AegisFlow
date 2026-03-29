from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class Action(BaseModel):
    action_type: str = Field(
        ...,
        description=(
            "Valid types: 'github_read_repos', 'github_create_issue', "
            "'github_create_repo', 'github_delete_repo'"
        ),
    )
    resource: str = Field(..., description="Target resource, e.g. 'owner/repo' or username")
    parameters: Dict[str, Any] = Field(default_factory=dict)


class ActionPlan(BaseModel):
    intent: str = Field(..., description="Original user request verbatim")
    actions: List[Action] = Field(..., description="Sequential actions to fulfill intent")


class Policy(BaseModel):
    action_type: str
    risk_level: RiskLevel
    requires_step_up: bool
    auto_approve: bool = False
    description: str = ""
    requires_vault: bool = True


class DecisionResult(BaseModel):
    action: Action
    allowed: bool
    requires_auth: bool
    risk_level: RiskLevel
    reason: str


class ExecutionResult(BaseModel):
    action_type: str
    resource: str
    status: str
    message: str
    side_effects: Dict[str, Any] = Field(default_factory=dict)
    executed_at: str
    verified_user_id: str
    vault_used: bool = False


class PolicyUpdateRequest(BaseModel):
    action_type: str
    risk_level: RiskLevel
    requires_step_up: bool
    auto_approve: bool = False
    description: str = ""
