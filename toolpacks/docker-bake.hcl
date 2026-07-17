variable "REGISTRY" { default = "ghcr.io/penhub-ai" }
variable "VERSION" { default = "0.1.0" }

group "default" {
  targets = ["web", "browser", "audit", "binary", "forensics", "crypto"]
}

target "base" {
  platforms = ["linux/amd64", "linux/arm64"]
}

target "web" {
  inherits = ["base"]
  context = "web"
  tags = ["${REGISTRY}/toolpack-web:${VERSION}"]
}

target "browser" {
  inherits = ["base"]
  context = "browser"
  tags = ["${REGISTRY}/toolpack-browser:${VERSION}"]
}

target "audit" {
  inherits = ["base"]
  context = "audit"
  tags = ["${REGISTRY}/toolpack-audit:${VERSION}"]
}

target "binary" {
  inherits = ["base"]
  context = "binary"
  tags = ["${REGISTRY}/toolpack-binary:${VERSION}"]
}

target "forensics" {
  inherits = ["base"]
  context = "forensics"
  tags = ["${REGISTRY}/toolpack-forensics:${VERSION}"]
}

target "crypto" {
  inherits = ["base"]
  context = "crypto"
  tags = ["${REGISTRY}/toolpack-crypto:${VERSION}"]
}
