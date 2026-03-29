"""
GitHub executors — real API calls using tokens retrieved from Auth0 Token Vault.
The agent never sees the user's GitHub credentials directly.
"""
import httpx
from datetime import datetime, timezone
from app.models import Action, ExecutionResult
from app import database


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


GITHUB_API = "https://api.github.com"


def _headers(github_token: str) -> dict:
    return {
        "Authorization": f"Bearer {github_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


async def github_read_repos(action: Action, user_id: str, github_token: str) -> ExecutionResult:
    """List the authenticated user's repositories — LOW risk, no consent required."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{GITHUB_API}/user/repos",
            headers=_headers(github_token),
            params={"per_page": 10, "sort": "updated"},
            timeout=10.0,
        )

    if response.status_code != 200:
        return ExecutionResult(
            action_type=action.action_type,
            resource=action.resource,
            status="error",
            message=f"GitHub API error: {response.status_code} — {response.json().get('message', 'Unknown')}",
            executed_at=_now(),
            verified_user_id=user_id,
            vault_used=True,
        )

    repos = response.json()
    repo_list = [
        {"name": r["full_name"], "private": r["private"], "stars": r["stargazers_count"]}
        for r in repos[:10]
    ]

    database.log_github_state(
        user_id=user_id,
        action="read_repos",
        repo="all",
        metadata={"count": len(repo_list), "repos": repo_list},
    )

    return ExecutionResult(
        action_type=action.action_type,
        resource=action.resource,
        status="success",
        message=f"Retrieved {len(repo_list)} repositories via Token Vault.",
        side_effects={"repositories": repo_list, "vault_used": True},
        executed_at=_now(),
        verified_user_id=user_id,
        vault_used=True,
    )


async def github_create_issue(action: Action, user_id: str, github_token: str) -> ExecutionResult:
    """Create an issue in a repository — MEDIUM risk, requires consent."""
    repo = action.resource  # expected: "owner/repo"
    title = action.parameters.get("title", "Issue created by AegisFlow Agent")
    body = action.parameters.get("body", "This issue was created by an authorized AI agent via AegisFlow.")

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{GITHUB_API}/repos/{repo}/issues",
            headers=_headers(github_token),
            json={"title": title, "body": body},
            timeout=10.0,
        )

    if response.status_code not in (200, 201):
        return ExecutionResult(
            action_type=action.action_type,
            resource=action.resource,
            status="error",
            message=f"GitHub API error: {response.status_code} — {response.json().get('message', 'Unknown')}",
            executed_at=_now(),
            verified_user_id=user_id,
            vault_used=True,
        )

    issue = response.json()
    metadata = {
        "issue_number": issue["number"],
        "issue_url": issue["html_url"],
        "title": issue["title"],
        "repo": repo,
    }

    database.log_github_state(
        user_id=user_id,
        action="create_issue",
        repo=repo,
        metadata=metadata,
    )

    return ExecutionResult(
        action_type=action.action_type,
        resource=action.resource,
        status="success",
        message=f"Issue #{issue['number']} created in {repo}: '{title}'",
        side_effects=metadata,
        executed_at=_now(),
        verified_user_id=user_id,
        vault_used=True,
    )


async def github_create_repo(action: Action, user_id: str, github_token: str) -> ExecutionResult:
    """Create a new repository — MEDIUM risk, requires consent."""
    repo_name = action.parameters.get("name", action.resource.split("/")[-1])
    private = action.parameters.get("private", True)
    description = action.parameters.get("description", "Created by AegisFlow Agent")

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{GITHUB_API}/user/repos",
            headers=_headers(github_token),
            json={
                "name": repo_name,
                "description": description,
                "private": private,
                "auto_init": True,
            },
            timeout=10.0,
        )

    if response.status_code not in (200, 201):
        return ExecutionResult(
            action_type=action.action_type,
            resource=action.resource,
            status="error",
            message=f"GitHub API error: {response.status_code} — {response.json().get('message', 'Unknown')}",
            executed_at=_now(),
            verified_user_id=user_id,
            vault_used=True,
        )

    repo = response.json()
    metadata = {
        "repo_name": repo["full_name"],
        "repo_url": repo["html_url"],
        "private": repo["private"],
    }

    database.log_github_state(
        user_id=user_id,
        action="create_repo",
        repo=repo["full_name"],
        metadata=metadata,
    )

    return ExecutionResult(
        action_type=action.action_type,
        resource=action.resource,
        status="success",
        message=f"Repository '{repo['full_name']}' created successfully.",
        side_effects=metadata,
        executed_at=_now(),
        verified_user_id=user_id,
        vault_used=True,
    )


async def github_delete_repo(action: Action, user_id: str, github_token: str) -> ExecutionResult:
    """Delete a repository — HIGH risk, requires step-up MFA."""
    repo = action.resource  # expected: "owner/repo"

    async with httpx.AsyncClient() as client:
        response = await client.delete(
            f"{GITHUB_API}/repos/{repo}",
            headers=_headers(github_token),
            timeout=10.0,
        )

    # 204 = deleted successfully
    if response.status_code not in (204, 200):
        return ExecutionResult(
            action_type=action.action_type,
            resource=action.resource,
            status="error",
            message=f"GitHub API error: {response.status_code} — {response.text or 'Permission denied or repo not found'}",
            executed_at=_now(),
            verified_user_id=user_id,
            vault_used=True,
        )

    metadata = {"repo": repo, "deleted_by": user_id}

    database.log_github_state(
        user_id=user_id,
        action="delete_repo",
        repo=repo,
        metadata=metadata,
    )

    return ExecutionResult(
        action_type=action.action_type,
        resource=action.resource,
        status="success",
        message=f"Repository '{repo}' permanently deleted. This action is irreversible.",
        side_effects=metadata,
        executed_at=_now(),
        verified_user_id=user_id,
        vault_used=True,
    )


EXECUTOR_MAP = {
    "github_read_repos": github_read_repos,
    "github_create_issue": github_create_issue,
    "github_create_repo": github_create_repo,
    "github_delete_repo": github_delete_repo,
}


async def dispatch(action: Action, user_id: str, github_token: str) -> ExecutionResult:
    executor = EXECUTOR_MAP.get(action.action_type)
    if not executor:
        return ExecutionResult(
            action_type=action.action_type,
            resource=action.resource,
            status="error",
            message=f"No executor for action type '{action.action_type}'.",
            executed_at=_now(),
            verified_user_id=user_id,
            vault_used=False,
        )
    return await executor(action, user_id, github_token)
