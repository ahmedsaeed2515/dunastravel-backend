# Dunas Travel Backend - Deployment Guide

This guide covers the process of building, running, and securing the Dunas Travel backend for a production environment. The application is a containerized Node.js service using PostgreSQL, designed to be run via Docker Compose or deployed to any standard container orchestration platform (e.g., Kubernetes).

## Prerequisites
- Docker and Docker Compose installed.
- PostgreSQL database (can be run via Compose or an external managed service).
- Redis instance (can be run via Compose or managed).
- API Keys for Resend (email), Cloudinary (media), OpenExchangeRates (currency), and Anthropic (AI).

## Environment Configuration
The backend enforces a strict fail-fast configuration on startup. Ensure all required variables are present.

### Base Settings
| Variable | Description | Default | Required |
| --- | --- | --- | --- |
| `NODE_ENV` | Environment context. Use `production` for prod. | `development` | Yes |
| `PORT` | API port to listen on. | `3000` | No |
| `FRONTEND_URL` | Used for CORS and email links. | | Yes |
| `CORS_ALLOWED_ORIGINS` | Comma-separated list of allowed origins. | | Yes |
| `ADMIN_DASHBOARD_BASE_URL` | Used for admin-specific email links. | | Yes |

### Database & Storage
| Variable | Description | Required |
| --- | --- | --- |
| `DATABASE_URL` | Connection string to PostgreSQL. | Yes |
| `REDIS_URL` | Connection string to Redis. | No |

### Authentication
| Variable | Description | Required |
| --- | --- | --- |
| `JWT_SECRET` | Must be at least 32 characters. | Yes |
| `JWT_EXPIRES_IN` | e.g. `7d` or `1h`. | No |

### Third-Party Services
Check the `.env.example` file for complete AI, Media, Mail, and Currency environment variables.

## Building and Running with Docker Compose

1. Clone the repository to the production server.
2. Copy `.env.example` to `.env` and fill in the production secrets.
3. Start the stack:
   ```bash
   docker-compose up -d --build
   ```
4. Check the logs to ensure successful startup:
   ```bash
   docker-compose logs -f api
   ```

*Note: The included `docker-compose.yml` mounts a local PostgreSQL container automatically. For managed databases (e.g. AWS RDS), update `DATABASE_URL` and remove the `postgres` block from the compose file.*

## Nginx Reverse Proxy & HTTPS

A sample template is provided in `nginx/nginx.conf`. This template defines:
- **Rate limiting** for both public (30 req/min) and admin (120 req/min) zones.
- **Client Body Limits**: Set to 25MB (`client_max_body_size`) to handle image uploads to Cloudinary without failing at the ingress layer.
- **Trust Proxy**: Forwarded headers are automatically mapped so the backend correctly identifies client IPs.
- **Security Headers**: HSTS, Content-Type, X-Frame-Options.

### TLS / HTTPS (Certbot)
1. Point your domain (e.g., `api.dunastravel.com`) to the server IP.
2. Install Certbot and request a certificate.
3. Update the `nginx.conf` file to uncomment the SSL configuration blocks and replace `example.com` with your actual domain.
4. Reload Nginx: `nginx -s reload`.

## Health Checks & Monitoring

The application provides dedicated unauthenticated probes tailored for Kubernetes and Docker health checks:
- **Liveness** (`/api/health/live`): Checks if the Node process is responsive. Returns 200 immediately.
- **Readiness** (`/api/health/ready`): Performs a 2-second `SELECT 1` timeout query against PostgreSQL. Returns 503 if the DB is unreachable, pulling the container out of the load balancer rotation.

## Structured Logging

The application uses a custom `JsonLoggerService` which writes directly to `stdout` in a single-line JSON format. All request-related logs automatically include a `correlationId` injected from the `X-Correlation-ID` header, enabling end-to-end distributed tracing.

To view logs safely:
```bash
docker-compose logs api | jq .
```

## Security Best Practices
- **Helmet**: A production-safe CSP allows 'self' for scripts/styles and sets `upgrade-insecure-requests`.
- **Cookies**: Authentication cookies are dynamically set with `Secure: true` and `SameSite: strict` when `NODE_ENV=production`.
- **Secret Management**: Do not hardcode secrets into the `.env` file checked into Git. In Kubernetes, utilize `ConfigMap` and `Secret` resources to inject these at runtime.

## Advanced Topics
- **Redis / Cache**: The current configuration is stateless aside from database interactions. Caching is not implemented by default as the read-path queries are sufficiently optimized for the target scale.
- **Prometheus/Grafana**: Not implemented in this phase. The application architecture supports adding a `/metrics` endpoint later via `@willsoto/nestjs-prometheus`.
