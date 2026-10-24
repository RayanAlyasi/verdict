"""Print the api's OpenAPI schema, for pnpm contract:check. Needs no settings or database."""

import json

from verdict.main import app

if __name__ == "__main__":
    print(json.dumps(app.openapi(), indent=2, sort_keys=True))
