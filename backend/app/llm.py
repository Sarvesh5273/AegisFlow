import os
import instructor
from groq import Groq
from dotenv import load_dotenv
from app.models import ActionPlan

load_dotenv()

client = instructor.from_groq(Groq(api_key=os.environ.get("GROQ_API_KEY")))

SYSTEM_PROMPT = """
You are the reasoning engine for AegisFlow, a Sovereign Cloud Agent.

Your job is to translate user requests into a strict sequence of cloud actions.

Valid action_types (use ONLY these exact strings):
- "read_logs"          → reading system logs, health checks, monitoring (LOW risk)
- "restart_server"     → restarting a server or service (MEDIUM risk)
- "create_gpu_instance" → provisioning GPU, compute, or expensive cloud resources (HIGH risk)
- "delete_database"    → deleting, dropping, or destroying any database or storage (HIGH risk)

Rules:
1. Always output a valid ActionPlan with at least one action.
2. Pick the action_type that best matches the user's intent.
3. Set resource to the specific resource mentioned, or a sensible default.
4. Add relevant parameters (region, instance_type, db_name, etc.) when inferable.
5. Never invent new action_types outside the list above.
""".strip()


def generate_action_plan(user_prompt: str) -> ActionPlan:
    """
    Takes a natural language prompt and returns a strictly typed ActionPlan.
    """
    return client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        response_model=ActionPlan,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
    )
