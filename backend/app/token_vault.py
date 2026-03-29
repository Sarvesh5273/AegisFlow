"""
Auth0 Token Vault — retrieves stored third-party OAuth tokens (GitHub, Google, etc.)
so the AI agent can call external APIs without ever seeing raw user credentials.

Docs: https://auth0.com/docs/secure/tokens/token-vault
"""
import os
import httpx
from fastapi import HTTPException, status
from dotenv import load_dotenv

load_dotenv()

AUTH0_DOMAIN = os.environ.get("AUTH0_DOMAIN")
AUTH0_MGMT_CLIENT_ID = os.environ.get("AUTH0_MGMT_CLIENT_ID")
AUTH0_MGMT_CLIENT_SECRET = os.environ.get("AUTH0_MGMT_CLIENT_SECRET")


async def _get_management_token() -> str:
    """
    Obtain a short-lived M2M token for the Auth0 Management API.
    This is the gateway to Token Vault — the agent uses this to retrieve
    stored user credentials without them being exposed in the frontend.
    """
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"https://{AUTH0_DOMAIN}/oauth/token",
            json={
                "grant_type": "client_credentials",
                "client_id": AUTH0_MGMT_CLIENT_ID,
                "client_secret": AUTH0_MGMT_CLIENT_SECRET,
                "audience": f"https://{AUTH0_DOMAIN}/api/v2/",
            },
            timeout=10.0,
        )

    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to obtain Auth0 Management token: {response.text}",
        )
    return response.json()["access_token"]


async def get_github_token_from_vault(user_id: str) -> str:
    """
    Retrieve the user's GitHub OAuth token from Auth0 Token Vault.

    This is the core Token Vault pattern:
    1. Agent has the user's Auth0 sub (user_id) from the JWT
    2. Agent calls Management API using M2M credentials (never user-visible)
    3. Auth0 returns the stored GitHub token from the vault
    4. Agent uses it to call GitHub API — user's credential never left Auth0

    Args:
        user_id: Auth0 user sub, e.g. "github|12345678"

    Returns:
        GitHub access token string
    """
    mgmt_token = await _get_management_token()

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://{AUTH0_DOMAIN}/api/v2/users/{user_id}",
            headers={"Authorization": f"Bearer {mgmt_token}"},
            timeout=10.0,
        )

    if response.status_code == 404:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "Token Vault: no stored GitHub token for this user. "
                "User must log in with GitHub via Auth0 to enable vault access."
            ),
        )

    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Token Vault retrieval failed: {response.text}",
        )

    user_data = response.json()
    identities = user_data.get("identities", [])

    for identity in identities:
        if identity.get("provider") == "github":
            github_token = identity.get("access_token")
            if not github_token:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=(
                        "Token Vault: GitHub identity found but no access_token stored. "
                        "Ensure 'store tokens' is enabled on the GitHub social connection."
                    ),
                )
            return github_token

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=(
            "Token Vault: no GitHub identity linked to this account. "
            "User must log in with GitHub to store credentials in the vault."
        ),
    )


async def list_vault_connections(user_id: str) -> list:
    """
    List all third-party connections stored in the vault for a user.
    Shown in the Token Vault tab of the UI.
    """
    try:
        mgmt_token = await _get_management_token()
    except Exception:
        return []

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://{AUTH0_DOMAIN}/api/v2/users/{user_id}",
            headers={"Authorization": f"Bearer {mgmt_token}"},
            timeout=10.0,
        )

    if response.status_code != 200:
        return []

    user_data = response.json()
    identities = user_data.get("identities", [])

    return [
        {
            "connection": i.get("provider"),
            "has_token": "access_token" in i,
            "user_id": i.get("user_id"),
        }
        for i in identities
        if i.get("provider") != "auth0"
    ]
