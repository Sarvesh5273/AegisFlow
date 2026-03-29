import os
import instructor
from groq import Groq
from dotenv import load_dotenv
from app.models import ActionPlan

load_dotenv()

client = instructor.from_groq(Groq(api_key=os.environ.get("GROQ_API_KEY")))

SYSTEM_PROMPT = """
You are the reasoning engine for AegisFlow, a Policy-Enforced AI Agent for GitHub operations.

Translate user requests into a strict sequence of GitHub actions.

Valid action_types (use ONLY these exact strings):
- "github_read_repos"    → list/view repositories, check repos, see what repos exist (LOW risk)
- "github_create_issue"  → create an issue, report a bug, file a ticket (MEDIUM risk)
- "github_create_repo"   → create a new repository (MEDIUM risk)
- "github_delete_repo"   → delete or remove a repository (HIGH risk, irreversible)

Rules:
1. Always output a valid ActionPlan with at least one action.
2. Set resource to the repo in "owner/repo" format when applicable, or the username.
3. For github_create_issue: add parameters.title and parameters.body when inferable.
4. For github_create_repo: add parameters.name and parameters.private (default true).
5. For github_delete_repo: resource must be "owner/repo" format.
6. For github_read_repos: resource can be the username or "me".
7. Never invent action_types outside the list above.
""".strip()


def generate_action_plan(user_prompt: str) -> ActionPlan:
    return client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        response_model=ActionPlan,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
    )
