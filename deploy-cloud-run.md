# Cloud Run Deployment Guide

## 📋 Prerequisites

1. **Google Cloud Project Setup:**

```bash
gcloud config set project YOUR_PROJECT_ID
gcloud auth login
gcloud services enable run.googleapis.com cloudbuild.googleapis.com sqladmin.googleapis.com
```

2. **Database Setup:**

```bash
# Create Cloud SQL PostgreSQL instance
gcloud sql instances create trackivity-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=asia-southeast1

# Create database
gcloud sql databases create trackivity --instance=trackivity-db

# Create user
gcloud sql users create trackivity-user \
  --instance=trackivity-db \
  --password=YOUR_SECURE_PASSWORD
```

## 🚀 Deployment Options

### Option 1: Cloud Build (Recommended)

1. **Update `cloudbuild.yaml`:**

```yaml
substitutions:
  _CLOUDSQL_CONNECTION_NAME: 'your-project:asia-southeast1:trackivity-db'
  # Optional: set defaults here or via trigger/CLI
  # _DATABASE_URL: 'postgresql://user:pass@host:5432/db?sslmode=require'
  # _JWT_SECRET: 'change_me_long_random_secret'
```

2. **Deploy:**

```bash
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_DATABASE_URL='postgresql://user:pass@host:5432/db?sslmode=require',_JWT_SECRET='your-long-random-secret'
```

### Option 2: Direct Docker Deployment

```bash
# Build and push
docker build -t gcr.io/YOUR_PROJECT_ID/trackivity-v2 .
docker push gcr.io/YOUR_PROJECT_ID/trackivity-v2

# Deploy
gcloud run deploy trackivity-v2 \
  --image gcr.io/YOUR_PROJECT_ID/trackivity-v2 \
  --platform managed \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --concurrency 100 \
  --max-instances 10 \
  --set-env-vars NODE_ENV=production \
  --set-env-vars DATABASE_URL='postgresql://user:pass@host:5432/db?sslmode=require' \
  --set-env-vars JWT_SECRET='your-long-random-secret' \
  --add-cloudsql-instances YOUR_PROJECT_ID:asia-southeast1:trackivity-db
```

## 🔐 Environment Variables Setup

```bash
# Required environment variables
gcloud run services update trackivity-v2 \
  --set-env-vars \
  DATABASE_URL="postgresql://trackivity-user:YOUR_PASSWORD@/trackivity?host=/cloudsql/YOUR_PROJECT_ID:asia-southeast1:trackivity-db",\
  JWT_SECRET="your-super-secure-jwt-secret-at-least-32-chars",\
  NODE_ENV="production"
```

## 📊 Performance Optimizations

### Cloud Run Configuration:

- **Memory**: 1Gi works well for the Node.js runtime
- **CPU**: 1 CPU is typically sufficient for moderate workloads
- **Concurrency**: 100 as a baseline; tune with load testing
- **Max Instances**: 10 to start; adjust based on traffic

### Database Connection:

- Use connection pooling
- Configure Cloud SQL Proxy for secure connections
- Set appropriate connection limits

## 🔍 Health Monitoring

Cloud Run will use the built-in health check:

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node --version || exit 1
```

## 🚀 Expected Performance

- Node.js 20 on Cloud Run typically cold starts in ~1-2s on Alpine-based images.
- Expect baseline memory usage around 180-250MB; monitor with Cloud Run metrics.
- Use load testing (see `scripts/loadtest.ts`) to validate concurrency and tuning.

## 💰 Cost Considerations

- Monitor CPU/Memory utilization in Cloud Run to right-size instances.
- Keep concurrency balanced against cold starts; reduce max instances if traffic is predictable.
- Leverage Cloud Monitoring alerts to track resource usage trends over time.

## 🔧 Troubleshooting

### Common Issues:

1. **Database Connection:**

```bash
# Check Cloud SQL connection
gcloud sql instances describe trackivity-db
```

2. **Container Logs:**

```bash
gcloud run logs tail trackivity-v2 --region=asia-southeast1
```

3. **Build Issues:**

```bash
gcloud builds log BUILD_ID
```

### Debug Mode:

Set `LOG_LEVEL=debug` in environment variables for detailed logging.

## 🔄 CI/CD Integration

For automated deployments, connect to GitHub:

```bash
gcloud builds triggers create github \
  --repo-name=trackivity-v2 \
  --repo-owner=YOUR_USERNAME \
  --branch-pattern="^main$" \
  --build-config=cloudbuild.yaml
```

This setup provides a production-ready, highly performant deployment with Node.js on Google Cloud Run!
