# The deployed database: Postgres 18 with pgvector, plus WAL-G, which archives every change to
# object storage at another provider (ADR 0011). The backup container runs this image too, with
# db-schedule.sh. Build it from the repository root:
#   docker build -f config/db/Dockerfile .
# docs/DEPLOYMENT.md covers the setup and how to restore.

# Named in the FROM line, not an ARG, so Dependabot can see it and propose updates. Previews run
# this base image without WAL-G (config/deploy.api.preview-*.yml); keep their digest in step.
FROM pgvector/pgvector:0.8.7-pg18-trixie@sha256:9d9c930220cb9bf2f956d10a8f909cf9973d9672ca0278aef2c1e6facccad2e0

# Root certificates for the storage's HTTPS, curl for the heartbeats, jq for WAL-G's JSON.
RUN apt-get update \
  && apt-get install --yes --no-install-recommends ca-certificates curl jq \
  && rm -rf /var/lib/apt/lists/*

# WAL-G isn't packaged for Debian. Its release binaries link only libc (libsodium is built in), and
# the pinned checksums fail the build if a release file is ever replaced. Dependabot can't see
# this, so update it by hand.
ARG TARGETARCH
ARG WALG_VERSION=v3.0.9
RUN case "$TARGETARCH" in \
    arm64) asset=aarch64 sum=1edd72c3387bfc3a1c19acad9daa36709dbb7cff0642f7044e175d5f8b555d64 ;; \
    amd64) asset=amd64 sum=8015836f246a978f27b31a2462eac7765312558ae5b11ac033322b555abf9e22 ;; \
    *) echo "No WAL-G build for $TARGETARCH" >&2; exit 1 ;; \
  esac \
  && curl -fsSL -o /usr/local/bin/wal-g \
    "https://github.com/wal-g/wal-g/releases/download/$WALG_VERSION/wal-g-pg-24.04-$asset" \
  && echo "$sum  /usr/local/bin/wal-g" | sha256sum -c - \
  && chmod 755 /usr/local/bin/wal-g

COPY config/db/bin/ /usr/local/bin/

ARG APP_COMMIT
LABEL org.opencontainers.image.source="https://github.com/RayanAlyasi/verdict" \
  org.opencontainers.image.revision="${APP_COMMIT}"

# A folder mounted from the server: config.json holds the storage, its credentials and the
# encryption key, and heartbeats.json the monitoring URLs. zstd shrinks the mostly empty segments
# that archive_timeout closes to a few kilobytes. Four uploads at a time (the default is 16) keep
# a catch-up after a storage outage well inside the database container's memory.
ENV WALG_CONFIG_PATH=/etc/wal-g/config.json \
  WALG_COMPRESSION_METHOD=zstd \
  WALG_UPLOAD_CONCURRENCY=4

# Each finished WAL segment goes to storage, and archive_timeout closes a segment at least every
# minute, so a lost server loses at most about a minute of writes. db-restore.sh repeats these.
CMD ["postgres", "-c", "archive_mode=on", "-c", "archive_command=wal-g wal-push %p", "-c", "archive_timeout=60"]
