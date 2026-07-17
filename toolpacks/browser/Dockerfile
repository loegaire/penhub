FROM mcr.microsoft.com/playwright:v1.59.1-noble
RUN npm install --global playwright@1.59.1 \
  && ln -s "$(find /ms-playwright -type f -name chrome -print -quit)" /usr/local/bin/chromium
WORKDIR /workspace
