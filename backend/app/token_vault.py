"""
Auth0 Token Vault client.

Token Vault stores third-party OAuth tokens (GitHub, Google, etc.) on behalf
of users. The agent retrieves these tokens to call external APIs without ever
seeing the user's raw credentials.

Docs: https://auth0.com/docs/secure/tokens/token-vault
"""
import os
import httpx
from fastapi import HTTPException, status
from dotenv import load_dotenv

load_dotenv()

AUTH0_DOMAIN = os.environ.get("AUTH0_DOMAIN")
AUTH0_MANAGEMENT_CLIENT_ID = os.environ.get("AUTH0_MGMT_CLIENT_ID")
AUTH0_MANAGEMENT_CLIENT_SECRET = os.environ.get("AUTH0_MGMT_CLIENT_SECRET")


async def get_management_token() -> str:
    """
    Fetch a Machine-to-Machine token for the Auth0 Management API.
    Used to call Token Vault endpoints on behalf of the agent.
    """
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"https://{AUTH0_DOMAIN}/oauth/token",
            json={
                "grant_type": "client_credentials",
                "client_id": AUTH0_MANAGEMENT_CLIENT_ID,
                "client_secret": AUTH0_MANAGEMENT_CLIENT_SECRET,
                "audience": f"https://{AUTH0_DOMAIN}/api/v2/",
            },
        )
        if response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Failed to obtain Auth0 Management token for Token Vault access.",
            )
        return response.json()["access_token"]


async def retrieve_vault_token(user_id: str, connection: str) -> dict:
    """
    Retrieve a stored third-party token from Auth0 Token Vault for a given user.

    Args:
        user_id:    Auth0 user sub (e.g. "auth0|abc123")
        connection: The social connection name (e.g. "github", "google-oauth2")

    Returns:
        dict with 'access_token' and token metadata from the vault.
    """
    mgmt_token = await get_management_token()

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://{AUTH0_DOMAIN}/api/v2/users/{user_id}/identities",
            headers={"Authorization": f"Bearer {mgmt_token}"},
        )

        if response.status_code == 404:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No Token Vault entry found for user '{user_id}' on connection '{connection}'.",
            )

        if response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Token Vault retrieval failed.",
            )

        identities = response.json()
        for identity in identities:
            if identity.get("provider") == connection:
                token_data = {
                    "connection": connection,
                    "user_id": user_id,
                    "access_token": identity.get("access_token"),
                    "provider": identity.get("provider"),
                    "vault_retrieved": True,
                }
                return token_data

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Token Vault: no stored token for connection '{connection}'. "
                   "User must link their account first.",
        )


async def list_vault_connections(user_id: str) -> list:
    """
    List all third-party connections stored in the vault for a user.
    Used by the frontend to show which services the agent can access.
    """
    mgmt_token = await get_management_token()

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://{AUTH0_DOMAIN}/api/v2/users/{user_id}/identities",
            headers={"Authorization": f"Bearer {mgmt_token}"},
        )
        if response.status_code != 200:
            return []

        identities = response.json()
        return [
            {
                "connection": i.get("provider"),
                "has_token": "access_token" in i,
            }
            for i in identities
            if i.get("provider") != "auth0"
        ]
