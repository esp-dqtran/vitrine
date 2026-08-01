FROM rust:1.72.1-bookworm AS builder

ARG OCTOBASE_COMMIT=58f3bbdf97f391a535e772d32828a484376c4159
ENV CARGO_NET_GIT_FETCH_WITH_CLI=true

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    clang \
    cmake \
    git \
    libclang-dev \
    libssl-dev \
    pkg-config \
  && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/toeverything/OctoBase.git /src/octobase \
  && cd /src/octobase \
  && git checkout --detach "${OCTOBASE_COMMIT}" \
  && test "$(git rev-parse HEAD)" = "${OCTOBASE_COMMIT}"

WORKDIR /src/octobase
RUN cargo build \
  --locked \
  --release \
  --package affine-cloud \
  --no-default-features \
  --features affine

FROM debian:bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*
COPY --from=builder /src/octobase/target/release/affine-cloud /usr/local/bin/affine-cloud
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/affine-cloud"]
