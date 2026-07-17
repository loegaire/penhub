FROM golang:1.24.5-bookworm AS build
RUN CGO_ENABLED=0 go install github.com/gitleaks/gitleaks/v8@v8.28.0 \
  && CGO_ENABLED=0 go install github.com/google/osv-scanner/v2/cmd/osv-scanner@v2.0.2

FROM aquasec/trivy:0.66.0 AS trivy

FROM python:3.12.11-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates git ripgrep shellcheck \
  && pip install --no-cache-dir bandit==1.8.6 semgrep==1.136.0 \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /go/bin/gitleaks /go/bin/osv-scanner /usr/local/bin/
COPY --from=trivy /usr/local/bin/trivy /usr/local/bin/trivy
WORKDIR /workspace
