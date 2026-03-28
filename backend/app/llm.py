import os
import instructor
from groq import Groq
from dotenv import load_dotenv
from app.models import ActionPlan

# Load the environment variables from the .env file
load_dotenv()

# Initialize the Groq client and patch it with instructor
# We use the standard Groq client, but instructor gives it superpower to return Pydantic models
client = instructor.from_groq(Groq(api_key=os.environ.get("GROQ_API_KEY")))

def generate_action_plan(user_prompt: str) -> ActionPlan:
    """
    Takes a natural language prompt and extracts a structured ActionPlan.
    """
    # Llama-3-70b is fast and highly capable of structured output on Groq
    return client.chat.completions.create(
        model="llama-3.3-70b-versatile",  # <-- The new active model
        response_model=ActionPlan,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are the reasoning engine for a Sovereign Cloud Agent. "
                    "Your job is to translate user requests into a strict sequence of actions. "
                    "Valid action_types are typically: 'create_gpu_instance', 'read_logs', 'delete_database', 'restart_server'."
                )
            },
            {
                "role": "user",
                "content": user_prompt
            }
        ],
    )