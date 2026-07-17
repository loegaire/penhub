FROM debian:bookworm AS radare
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates git make gcc pkg-config \
  && git clone --depth 1 --branch 5.9.8 https://github.com/radareorg/radare2.git /src/radare2 \
  && /src/radare2/sys/install.sh

FROM python:3.12.11-slim-bookworm
ARG JADX_VERSION=1.5.1
RUN apt-get update && apt-get install -y --no-install-recommends \
    binutils ca-certificates checksec curl default-jre-headless file gdb git nasm patchelf strace ltrace unzip \
  && pip install --no-cache-dir ROPGadget==7.6 pwntools==4.14.1 \
  && curl -fsSL "https://github.com/skylot/jadx/releases/download/v${JADX_VERSION}/jadx-${JADX_VERSION}.zip" -o /tmp/jadx.zip \
  && unzip /tmp/jadx.zip -d /opt/jadx \
  && ln -s /opt/jadx/bin/jadx /usr/local/bin/jadx \
  && rm -rf /var/lib/apt/lists/* /tmp/jadx.zip
COPY --from=radare /usr/local/ /usr/local/
WORKDIR /workspace
