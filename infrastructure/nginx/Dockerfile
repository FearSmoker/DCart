# =============================================================================
# DCart Nginx Dockerfile
# =============================================================================

FROM nginx:alpine

# Remove the default nginx site configuration
RUN rm /etc/nginx/conf.d/default.conf

# Copy our custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf
COPY proxy_params /etc/nginx/proxy_params

EXPOSE 80

# Health check against our custom health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/nginx-health || exit 1

CMD ["nginx", "-g", "daemon off;"]
