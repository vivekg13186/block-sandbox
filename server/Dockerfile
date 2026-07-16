# Block Sandbox server.
#
# Build (from the server/ folder as context):
#   docker build -t block-sandbox ./server
# Run (persist flows/env/schedules + the managed venv in a named volume):
#   docker run -p 8000:8000 -v block-sandbox-data:/app/server/data block-sandbox
# Then open http://127.0.0.1:8000
#
# NOTE: the /api/run endpoint executes arbitrary Python with the container's
# privileges. Only expose this on a trusted network.

FROM python:3.12-slim

# git      -> the flows-folder version-control feature (status/diff/commit/pull)
# ca-certs -> HTTPS for pip installs and user HTTP blocks
RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Trust bind-mounted repos regardless of their host ownership, so the in-app
# Git panel works on a mounted flows directory.
RUN git config --system --add safe.directory '*'

WORKDIR /app/server

# Install server deps first for better layer caching.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# App code, prebuilt UI (static/) and sample data. The host venv/__pycache__
# are excluded via .dockerignore; the container builds its own venv at runtime
# under data/venv when a module is first run.
COPY . .

# Flows, environments, schedules and the managed venv live here. Mount a volume
# to persist them across container restarts.
VOLUME ["/app/server/data"]

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/').status==200 else 1)"

# 0.0.0.0 so the port is reachable from the host.
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
