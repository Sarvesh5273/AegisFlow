from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum

class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class Action(BaseModel):
    action_type: str = Field(..., description="The type of action, e.g., 'create_gpu_instance', 'read_logs'")
    resource: str = Field(..., description="The target resource")
    parameters: dict = Field(default_factory=dict, description="Action specific parameters")

class ActionPlan(BaseModel):
    intent: str = Field(..., description="The original user request")
    actions: List[Action] = Field(..., description="Sequential list of actions to fulfill the intent")

class Policy(BaseModel):
    action_type: str
    risk_level: RiskLevel
    requires_step_up: bool
    max_cost: Optional[float] = None
    auto_approve: bool = False

class DecisionResult(BaseModel):
    action: Action
    allowed: bool
    requires_auth: bool
    reason: str