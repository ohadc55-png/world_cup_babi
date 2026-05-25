"""
מעלה env vars ל-Railway via GraphQL API.
משתמש ב-RAILWAY_API_TOKEN מהסביבה. קורא את ה-.env המקומיים.

לא מדפיס שום ערך — רק שמות + סטטוס הצלחה.
"""
import os
import sys
import json
from pathlib import Path
from urllib import request, error

TOKEN = os.environ["RAILWAY_API_TOKEN"]
PROJECT_ID = "ffa1ff41-7624-43a8-8cdd-567f8a7ee6f7"
ENV_ID = "1169ca10-73a8-43c5-8593-83989b38b0ee"
BACKEND_SVC = "fdbe086a-3410-4f8d-82e6-35b0be5ecb94"
FRONTEND_SVC = "c29bfa5a-411d-4923-bafe-67eb48e6ea72"

BACKEND_PUBLIC = "https://backend-production-b1411c.up.railway.app"
FRONTEND_PUBLIC = "https://frontend-production-9e59.up.railway.app"


def parse_env(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.exists():
        return out
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        k, v = line.split("=", 1)
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        if k and v:
            out[k] = v
    return out


def gql(query: str, variables: dict | None = None) -> dict:
    payload = json.dumps({"query": query, "variables": variables or {}}).encode("utf-8")
    req = request.Request(
        "https://backboard.railway.com/graphql/v2",
        data=payload,
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except error.HTTPError as e:
        return {"errors": [{"message": f"HTTP {e.code}: {e.read().decode('utf-8')}"}]}


COLLECTION_UPSERT = """
mutation($input: VariableCollectionUpsertInput!) {
  variableCollectionUpsert(input: $input)
}
"""


def set_vars_batch(service_id: str, vars_map: dict[str, str]) -> str:
    if not vars_map:
        return "  (no vars)"
    res = gql(COLLECTION_UPSERT, {"input": {
        "projectId": PROJECT_ID,
        "environmentId": ENV_ID,
        "serviceId": service_id,
        "variables": vars_map,
        "replace": False,
    }})
    if res.get("errors"):
        return f"  FAIL batch: {res['errors'][0].get('message', 'unknown')}"
    names = ", ".join(sorted(vars_map.keys()))
    return f"  OK batched {len(vars_map)} vars: {names}"


def main() -> int:
    backend_dir = Path(__file__).parent.parent
    repo_root = backend_dir.parent

    backend_env = parse_env(backend_dir / ".env")
    frontend_env = parse_env(repo_root / "frontend" / ".env")

    # ===== BACKEND vars =====
    skip_backend = {"PORT", "ADMIN_USER_ID"}
    backend_vars: dict[str, str] = {}
    for k, v in backend_env.items():
        if k in skip_backend:
            continue
        if k == "FRONTEND_URL":
            v = FRONTEND_PUBLIC
        elif k == "ENVIRONMENT":
            v = "production"
        backend_vars[k] = v
    print(f"\n=== Backend service ===")
    print(set_vars_batch(BACKEND_SVC, backend_vars))

    # ===== FRONTEND vars =====
    frontend_vars = {"VITE_API_BASE_URL": BACKEND_PUBLIC}
    frontend_vars.update(frontend_env)
    print(f"\n=== Frontend service ===")
    print(set_vars_batch(FRONTEND_SVC, frontend_vars))

    print("\nDone.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
