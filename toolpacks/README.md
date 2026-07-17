# PenHub tool packs

PenHub runs security binaries inside six versioned OCI images. Dockerfiles are multi-architecture and the runtime mounts only the active workspace at `/workspace`; security binaries are never resolved from the host `PATH`.

Build all packs with Buildx:

```sh
docker buildx bake --push
bun run toolpacks/script/lock.ts
```

`images.lock.json` is the release input. A release must contain a registry digest for every pack before the catalog image references are promoted from version tags to `tag@sha256:digest`.
