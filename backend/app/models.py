from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum
from datetime import datetime


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class Action(BaseModel):
    action_type: str = Field(
        ...,
        description=(
            "The type of action. Valid types: "
            "'create_gpu_instance', 'delete_database', "
            "'restart_server', 'read_logs'"
        ),
    )
    resource: str = Field(..., description="The target resource identifier")
    parameters: Dict[str, Any] = Field(
        default_factory=dict, description="Action-specific parameters"
    )


class ActionPlan(BaseModel):
    intent: str = Field(..., description="The original user request verbatim")
    actions: List[Action] = Field(
        ..., description="Sequential list of actions to fulfill the intent"
    )


class Policy(BaseModel):
    action_type: str
    risk_level: RiskLevel
    requires_step_up: bool
    max_cost: Optional[float] = None
    auto_approve: bool = False
    description: str = ""


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


class ConsentRecord(BaseModel):
    id: Optional[int] = None
    user_id: str
    action_type: str
    resource: str
    scope_granted: str
    risk_level: str
    granted_at: str
    expires_at: Optional[str] = None


class ActionLog(BaseModel):
    id: Optional[int] = None
    user_id: str
    action_type: str
    resource: str
    status: str
    risk_level: str
    required_scope: str
    result_message: str
    executed_at: str
    parameters: str = "{}"
