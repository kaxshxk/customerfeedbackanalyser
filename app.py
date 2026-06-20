"""Flask Application.

This file demonstrates secure Flask configuration, avoiding hardcoded
secrets and debug mode in production.
"""

import os
import secrets
from flask import Flask

app = Flask(__name__)

# WARNING: Never commit real SECRET_KEY! Set via environment variable.
app.secret_key = os.environ.get("SECRET_KEY") or secrets.token_hex(16)


@app.route("/")
def index() -> str:
    """Home route."""
    return "Customer Feedback Analyser Secure Backend API"


if __name__ == "__main__":
    # Run with debug mode enabled only in development environment
    app.run(
        debug=os.getenv("FLASK_ENV") == "development",
        host="0.0.0.0",
        port=5000,
    )
