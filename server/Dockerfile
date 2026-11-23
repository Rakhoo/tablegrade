# Multi-stage build of notenfeder-server. Go cross-compiles for the target platform, so
# `docker buildx build --platform linux/arm64,linux/amd64` needs no emulation.
FROM --platform=$BUILDPLATFORM golang:1.24-bookworm AS build
ARG TARGETOS
ARG TARGETARCH
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH \
    go build -trimpath -ldflags="-s -w" -o /out/notenfeder-server ./cmd/notenfeder-server \
 && mkdir /out/data

# distroless/static has no shell and runs as the unprivileged user 65532.
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/notenfeder-server /notenfeder-server
COPY --from=build --chown=65532:65532 /out/data /data
ENV DATA_DIR=/data LISTEN_ADDR=:8080
EXPOSE 8080
VOLUME /data
USER 65532:65532
HEALTHCHECK --interval=1m --timeout=5s CMD ["/notenfeder-server", "healthcheck"]
ENTRYPOINT ["/notenfeder-server"]
