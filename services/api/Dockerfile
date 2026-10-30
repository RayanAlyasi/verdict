# The api: Python 3.14 with the locked dependencies, run as a non-root user. Build it from the
# repository root:
#   docker build -f services/api/Dockerfile --build-arg APP_COMMIT=$(git rev-parse HEAD) .
# By default it migrates the database (python -m verdict.migrate), then serves; a worker runs
# `python -m verdict.worker <queue>`.

# Named in FROM lines, not ARGs, so Dependabot can see them and propose updates.
FROM ghcr.io/astral-sh/uv:0.13.6@sha256:af22a52f5eafef3d78e551599d405c02df61919d18028f0cea8eda93bc9986d0 AS uv
FROM python:3.15.0-slim-trixie@sha256:f5b92f2a669a4c347044f29367f31983280b648250ca94dea66f98c53bc87e58 AS base

FROM base AS build
COPY --from=uv /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
WORKDIR /app
# Dependencies first, so a code change doesn't reinstall them.
COPY services/api/pyproject.toml services/api/uv.lock services/api/.python-version ./
RUN uv sync --locked --no-dev --no-install-project
COPY services/api/ ./
RUN uv sync --locked --no-dev

FROM base
# Current root certificates: the HTTP clients trust the operating system's store, not certifi.
# tini runs as PID 1 and passes stop signals to the whole process group (-g), so a deploy can stop
# the container while it's still migrating instead of killing it after the timeout.
RUN apt-get update \
  && apt-get install --yes --no-install-recommends ca-certificates tini \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --uid 1000 --create-home --shell /usr/sbin/nologin verdict
ARG APP_COMMIT
LABEL org.opencontainers.image.licenses="AGPL-3.0-only" \
  org.opencontainers.image.source="https://github.com/RayanAlyasi/verdict" \
  org.opencontainers.image.revision="${APP_COMMIT}"
# APP_COMMIT is baked in: production runs the image built for staging, so it can't be set later.
ENV PATH="/app/.venv/bin:${PATH}" \
  PYTHONUNBUFFERED=1 \
  APP_COMMIT=${APP_COMMIT}
WORKDIR /app
COPY --from=build /app /app
# STORAGE_LOCAL_PATH's default, writable by the api. A new named volume mounted here takes this
# ownership; a host folder mounted instead must belong to uid 1000.
RUN mkdir storage && chown verdict:verdict storage
USER verdict
EXPOSE 8000
ENTRYPOINT ["tini", "-g", "--"]
CMD ["sh", "-c", "python -m verdict.migrate && exec uvicorn verdict.main:app --host 0.0.0.0 --port 8000"]
