# =============================================================================
# DCart AI / Recommendation Service Dockerfile
# =============================================================================
# Python 3.12 slim image with FastAPI + ML dependencies
# Runs as non-root user on port 8000
# =============================================================================

FROM python:3.12-slim AS base

# Install system dependencies needed by some pip packages (gcc, etc.)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        gcc \
        g++ \
        curl \
        && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ---------------------------------------------------------------------------
# Install Python dependencies (cached unless requirements.txt changes)
# ---------------------------------------------------------------------------
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ---------------------------------------------------------------------------
# Copy application source and model artifacts
# ---------------------------------------------------------------------------
COPY main.py .
COPY fraud_detector.py .
COPY fraud_model.pkl .
COPY fraud_metrics.json .

# ---------------------------------------------------------------------------
# Create non-root user for security
# ---------------------------------------------------------------------------
RUN groupadd --gid 1001 appuser && \
    useradd --uid 1001 --gid appuser --shell /bin/bash --create-home appuser && \
    chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

# Health check: verify FastAPI responds on /health
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Run uvicorn with 2 workers for production
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
