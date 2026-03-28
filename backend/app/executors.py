"""
Mock cloud executors — each produces real side effects written to SQLite.
In a real deployment, these would call AWS/Azure/GCP SDKs.
"""
import uuid
from datetime import datetime, timezone
from app.database import upsert_cloud_resource
from app.models import Action, ExecutionResult


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def execute_create_gpu_instance(action: Action, user_id: str) -> ExecutionResult:
    instance_id = f"gpu-{uuid.uuid4().hex[:8]}"
    instance_type = action.parameters.get("instance_type", "a100.xlarge")
    region = action.parameters.get("region", "us-east-1")

    metadata = {
        "instance_id": instance_id,
        "instance_type": instance_type,
        "region": region,
        "launched_by": user_id,
        "estimated_cost_per_hr": "$3.06",
    }

    upsert_cloud_resource(
        resource_type="gpu_instance",
        resource_id=instance_id,
        status="running",
        metadata=metadata,
    )

    return ExecutionResult(
        action_type=action.action_type,
        resource=action.resource,
        status="success",
        message=f"GPU instance {instance_id} ({instance_type}) launched in {region}.",
        side_effects=metadata,
        executed_at=_now(),
        verified_user_id=user_id,
    )


def execute_delete_database(action: Action, user_id: str) -> ExecutionResult:
    db_id = f"db-{uuid.uuid4().hex[:8]}"
    db_name = action.parameters.get("db_name", action.resource)

    metadata = {
        "db_id": db_id,
        "db_name": db_name,
        "deleted_by": user_id,
        "backup_retained": True,
        "backup_id": f"backup-{uuid.uuid4().hex[:8]}",
    }

    upsert_cloud_resource(
        resource_type="database",
        resource_id=db_id,
        status="deleted",
        metadata=metadata,
    )

    return ExecutionResult(
        action_type=action.action_type,
        resource=action.resource,
        status="success",
        message=f"Database '{db_name}' deleted. Backup retained with ID {metadata['backup_id']}.",
        side_effects=metadata,
        executed_at=_now(),
        verified_user_id=user_id,
    )


def execute_restart_server(action: Action, user_id: str) -> ExecutionResult:
    server_id = action.resource or f"server-{uuid.uuid4().hex[:8]}"

    metadata = {
        "server_id": server_id,
        "restarted_by": user_id,
        "previous_uptime_hrs": 142,
        "new_status": "online",
    }

    upsert_cloud_resource(
        resource_type="server",
        resource_id=server_id,
        status="online",
        metadata=metadata,
    )

    return ExecutionResult(
        action_type=action.action_type,
        resource=action.resource,
        status="success",
        message=f"Server '{server_id}' restarted successfully. Status: online.",
        side_effects=metadata,
        executed_at=_now(),
        verified_user_id=user_id,
    )


def execute_read_logs(action: Action, user_id: str) -> ExecutionResult:
    sample_logs = [
        {"timestamp": _now(), "level": "INFO", "msg": "Health check passed"},
        {"timestamp": _now(), "level": "WARN", "msg": "High memory usage: 87%"},
        {"timestamp": _now(), "level": "INFO", "msg": "Scheduled backup completed"},
    ]

    return ExecutionResult(
        action_type=action.action_type,
        resource=action.resource,
        status="success",
        message=f"Retrieved 3 log entries from '{action.resource}'.",
        side_effects={"logs": sample_logs, "read_by": user_id},
        executed_at=_now(),
        verified_user_id=user_id,
    )


# Dispatch table — keeps main.py clean
EXECUTOR_MAP = {
    "create_gpu_instance": execute_create_gpu_instance,
    "delete_database": execute_delete_database,
    "restart_server": execute_restart_server,
    "read_logs": execute_read_logs,
}


def dispatch(action: "Action", user_id: str) -> ExecutionResult:
    executor = EXECUTOR_MAP.get(action.action_type)
    if not executor:
        return ExecutionResult(
            action_type=action.action_type,
            resource=action.resource,
            status="error",
            message=f"No executor registered for action type '{action.action_type}'.",
            side_effects={},
            executed_at=_now(),
            verified_user_id=user_id,
        )
    return executor(action, user_id)
