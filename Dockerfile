FROM node:12-alpine as base

ENV workdir /opt/app

WORKDIR ${workdir}

FROM base as builder
RUN apk add make gcc g++ python jq

COPY package*.json ./

RUN npm install --only=production

COPY . .

FROM base
RUN apk add bash openssl mc

COPY --from=builder /${workdir}/ ./
RUN mkdir -p /${workdir}/storage

CMD ["node", "service.js"]
