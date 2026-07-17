FROM golang:1.24.5-bookworm AS build
RUN CGO_ENABLED=0 go install github.com/projectdiscovery/httpx/cmd/httpx@v1.7.2 \
  && CGO_ENABLED=0 go install github.com/ffuf/ffuf/v2@v2.1.0 \
  && CGO_ENABLED=0 go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@v3.4.10 \
  && CGO_ENABLED=0 go install github.com/projectdiscovery/katana/cmd/katana@v1.1.2 \
  && CGO_ENABLED=0 go install github.com/projectdiscovery/subfinder/v2/cmd/subfinder@v2.7.1 \
  && CGO_ENABLED=0 go install github.com/projectdiscovery/naabu/v2/cmd/naabu@v2.3.4 \
  && CGO_ENABLED=0 go install github.com/projectdiscovery/dnsx/cmd/dnsx@v1.2.2 \
  && CGO_ENABLED=0 go install github.com/OJ/gobuster/v3@v3.8.2

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl dnsutils nmap openssl perl perl-modules git sqlmap \
  && rm -rf /var/lib/apt/lists/* \
  && git clone --depth 1 https://github.com/sullo/nikto /opt/nikto \
  && ln -s /opt/nikto/program/nikto.pl /usr/local/bin/nikto
COPY --from=build /go/bin/ /usr/local/bin/
WORKDIR /workspace
