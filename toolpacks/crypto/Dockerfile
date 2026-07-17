FROM sagemath/sagemath:10.6
USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
    hashcat john openssl pari-gp vim-common z3 \
  && sage -pip install --no-cache-dir pycryptodome==3.23.0 sympy==1.14.0 z3-solver==4.15.3.0 \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace
