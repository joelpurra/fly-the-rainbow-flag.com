ARG RUNNER_USER_ID='4567'
ARG RUNNER_GROUP_ID='4567'

ARG ALPINE_IMAGE_IMAGE='docker.io/library/alpine'
ARG ALPINE_IMAGE_TAG='3'
ARG ALPINE_IMAGE_IDENTIFIER="${ALPINE_IMAGE_IMAGE}:${ALPINE_IMAGE_TAG}"

FROM "$ALPINE_IMAGE_IDENTIFIER" as alpine

RUN apk add --no-cache \
	tini

ENTRYPOINT ["/sbin/tini", "--"]

ARG RUNNER_USER_ID
ARG RUNNER_GROUP_ID
ARG RUNNER_SOFTWARE_DIR='/opt/runner'

RUN test -n "$RUNNER_USER_ID" \
	&& test -n "$RUNNER_GROUP_ID"

ENV RUNNER_USER_ID="$RUNNER_USER_ID" \
	RUNNER_GROUP_ID="$RUNNER_GROUP_ID"

RUN addgroup -g "$RUNNER_GROUP_ID" -S runner \
	&& adduser -u "$RUNNER_USER_ID" -s -/bin/false -S -G runner runner

# NOTE: create directory to require root/uid 0 to copy executables into the container/layers.
RUN test -n "$RUNNER_SOFTWARE_DIR"
ENV RUNNER_SOFTWARE_DIR="$RUNNER_SOFTWARE_DIR"
WORKDIR "$RUNNER_SOFTWARE_DIR"

# NOTE: separating only the npm apk package, not image layers.
RUN apk add --no-cache \
		nodejs-current \
	&& echo 'Installed Node.js' "$(node --version)" \
	&& apk add --no-cache --virtual .temporary-npm \
		npm \
	&& echo 'Installed npm' "v$(npm --version)"

COPY package.json package-lock.json ./

RUN NODE_ENV='production' npm ci --omit=dev \
	&& apk del -q .temporary-npm

COPY . .

USER "$RUNNER_USER_ID":"$RUNNER_GROUP_ID"

CMD ["node", "./app/web.js"]
