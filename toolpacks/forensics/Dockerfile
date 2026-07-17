FROM python:3.12.11-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends \
    binwalk ca-certificates exiftool file foremost pngcheck poppler-utils sleuthkit steghide tcpdump tshark yara \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace
