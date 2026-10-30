FROM node:24-alpine AS build
WORKDIR /app
ENV NODE_ENV=production
ARG PNPM_VERSION=12.9.1
RUN npm install -g pnpm@$PNPM_VERSION
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod=false
COPY . .
RUN pnpm run build \
 && find dist -type f \( -name '*.map' -o -name '.DS_Store' \) -delete \
 && test -n "$(find dist -name '*.br' -print -quit)" \
 && test -n "$(find dist -name '*.gz' -print -quit)" \
 && JS=$(grep -oE 'src="/assets/[^"]+\.js"' dist/index.html | head -1 | sed 's/src="//;s/"//') \
 && CSS=$(grep -oE 'href="/assets/[^"]+\.css"' dist/index.html | head -1 | sed 's/href="//;s/"//') \
 && test -n "$JS" && test -n "$CSS" \
 && printf '%s\n' "<$JS>; rel=modulepreload; crossorigin; nopush, <$CSS>; rel=preload; as=style; crossorigin; nopush" > /app/link.txt \
 && echo "  Link header -> $(cat /app/link.txt)"

FROM alpine:3.22
RUN apk add --no-cache nginx nginx-mod-http-brotli \
 && mkdir -p /run/nginx /tmp/nginx-client-body /var/log/nginx \
 && rm -f /etc/nginx/http.d/default.conf \
 && chown -R nginx:nginx /run/nginx /tmp/nginx-client-body /var/log/nginx /var/lib/nginx \
 && rm -rf /var/cache/apk/* /tmp/*
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/link.txt /tmp/link.txt
RUN sed -i "s|__LINK__|$(cat /tmp/link.txt)|" /etc/nginx/nginx.conf && rm -f /tmp/link.txt
COPY --from=build --chown=nginx:nginx /app/dist /usr/share/nginx/html
USER nginx
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD wget -qO- http://127.0.0.1:80/healthz || exit 1
CMD ["nginx", "-g", "daemon off;"]
