# 📦 Google Cloud Deployment Guide

This guide provides step-by-step instructions to deploy Wayfinder AI to Google Cloud Platform.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Google Cloud Setup](#google-cloud-setup)
3. [Build Docker Images](#build-docker-images)
4. [Deploy Backend to Cloud Run](#deploy-backend-to-cloud-run)
5. [Deploy Frontend](#deploy-frontend)
6. [Post-Deployment Verification](#post-deployment-verification)
7. [Monitoring & Troubleshooting](#monitoring--troubleshooting)

---

## Prerequisites

Before starting, ensure you have:

### Tools
- ✅ [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) installed and authenticated
- ✅ [Docker](https://docs.docker.com/install/) installed and running
- ✅ [Node.js 18+](https://nodejs.org/)
- ✅ [Firebase CLI](https://firebase.google.com/docs/cli) (for frontend deployment)

### Google Cloud Account
- ✅ Google Cloud Project created
- ✅ Billing enabled on the project
- ✅ Owner or Editor IAM role

### Verify Installation
```bash
# Check gcloud
gcloud --version

# Check Docker
docker --version

# Check Node.js
node --version
npm --version

# Check Firebase CLI
firebase --version
```

---

## Google Cloud Setup

### 1. Create/Select Project

```bash
# Set environment variable
export PROJECT_ID="your-project-id"  # Replace with your project ID
export REGION="us-central1"           # Or your preferred region

# Authenticate with Google Cloud
gcloud auth login

# Set default project
gcloud config set project $PROJECT_ID

# Verify
gcloud config get-value project
```

### 2. Enable Required APIs

```bash
# Enable Container Registry
gcloud services enable containerregistry.googleapis.com

# Enable Cloud Run
gcloud services enable run.googleapis.com

# Enable Vertex AI API
gcloud services enable aiplatform.googleapis.com

# Enable Firebase APIs
gcloud services enable firebase.googleapis.com
gcloud services enable firebaseauth.googleapis.com
gcloud services enable firestore.googleapis.com
gcloud services enable firebasestorage.googleapis.com

# Enable Cloud Build (optional, for CI/CD)
gcloud services enable cloudbuild.googleapis.com

# Enable Cloud Logging
gcloud services enable logging.googleapis.com

# Verify APIs are enabled
gcloud services list --enabled
```

### 3. Create Service Account

```bash
# Create service account
gcloud iam service-accounts create wayfinder-agent \
  --display-name="Wayfinder AI Agent"

# Grant necessary roles
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:wayfinder-agent@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:wayfinder-agent@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/firestore.user"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:wayfinder-agent@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/logging.logWriter"

# Create and download key
gcloud iam service-accounts keys create wayfinder-key.json \
  --iam-account=wayfinder-agent@${PROJECT_ID}.iam.gserviceaccount.com

echo "✅ Service account created. Key saved to: wayfinder-key.json"
ls -lh wayfinder-key.json
```

### 4. Setup Firebase (for frontend auth)

```bash
# Initialize Firebase project
firebase login

# Link project to Cloud project
firebase projects:list
firebase use $PROJECT_ID

# Enable Firestore
gcloud firestore databases create --location=us-central1

# Enable Firebase Authentication
# Go to: https://console.firebase.google.com/project/$PROJECT_ID/authentication
# Click "Get Started" → "Google" → Enable

echo "✅ Firebase setup complete"
```

---

## Build Docker Images

### 1. Prepare Environment File

Create `.env.prod` in root directory:

```env
# Google Cloud
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_REGION=us-central1

# Gemini API
GEMINI_MODEL=gemini-2.0-flash

# Firebase
FIREBASE_API_KEY=your-firebase-api-key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your-sender-id
FIREBASE_APP_ID=your-app-id

# Backend
BACKEND_PORT=8080  # Cloud Run uses 8080
FRONTEND_URL=https://your-frontend-domain.com
```

### 2. Build Backend Image

```bash
# Navigate to backend
cd apps/backend

# Build Docker image
docker build \
  --tag gcr.io/$PROJECT_ID/wayfinder-backend:latest \
  --tag gcr.io/$PROJECT_ID/wayfinder-backend:v1.0.0 \
  .

# Verify image
docker images | grep wayfinder-backend

# Test image locally (optional)
docker run -p 3001:8080 \
  --env GOOGLE_CLOUD_PROJECT_ID=$PROJECT_ID \
  gcr.io/$PROJECT_ID/wayfinder-backend:latest
```

### 3. Build Frontend Image

```bash
# Navigate to frontend
cd apps/frontend

# Build Angular production bundle
npm run build

# Build Docker image
docker build \
  --tag gcr.io/$PROJECT_ID/wayfinder-frontend:latest \
  --tag gcr.io/$PROJECT_ID/wayfinder-frontend:v1.0.0 \
  .

# Verify image
docker images | grep wayfinder-frontend
```

### 4. Push Images to Container Registry

```bash
# Configure Docker to use gcloud authentication
gcloud auth configure-docker

# Push backend image
docker push gcr.io/$PROJECT_ID/wayfinder-backend:latest
docker push gcr.io/$PROJECT_ID/wayfinder-backend:v1.0.0

# Push frontend image
docker push gcr.io/$PROJECT_ID/wayfinder-frontend:latest
docker push gcr.io/$PROJECT_ID/wayfinder-frontend:v1.0.0

echo "✅ Images pushed to Container Registry"

# Verify
gcloud container images list --repository-url=gcr.io/$PROJECT_ID
```

---

## Deploy Backend to Cloud Run

### 1. Set Environment Variables

```bash
# Create environment variables file
set -a  # Set all variables for export
source .env.prod
set +a

# Verify critical variables
echo "Project: $GOOGLE_CLOUD_PROJECT_ID"
echo "Region: $REGION"
echo "Gemini Model: $GEMINI_MODEL"
```

### 2. Deploy Service

```bash
# Deploy backend to Cloud Run
gcloud run deploy wayfinder-backend \
  --image gcr.io/$PROJECT_ID/wayfinder-backend:latest \
  --platform managed \
  --region $REGION \
  --memory 4Gi \
  --cpu 2 \
  --timeout 3600 \
  --max-instances 100 \
  --min-instances 1 \
  --allow-unauthenticated \
  --set-env-vars \
GOOGLE_CLOUD_PROJECT_ID=$GOOGLE_CLOUD_PROJECT_ID,\
GOOGLE_CLOUD_REGION=$GOOGLE_CLOUD_REGION,\
GEMINI_MODEL=$GEMINI_MODEL,\
FRONTEND_URL=$FRONTEND_URL,\
BACKEND_PORT=8080 \
  --quiet

echo "✅ Backend deployed to Cloud Run"
```

### 3. Get Backend URL

```bash
# Get the service URL
BACKEND_URL=$(gcloud run services describe wayfinder-backend \
  --platform managed \
  --region $REGION \
  --format 'value(status.url)')

echo "Backend URL: $BACKEND_URL"
echo "Save this for frontend configuration"
```

### 4. Test Backend Deployment

```bash
# Health check
curl $BACKEND_URL/health

# Should return: {"status":"ok","timestamp":"2026-..."} 

# Advanced health check
curl -X GET $BACKEND_URL/api/agent/history \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Deploy Frontend

### Option A: Firebase Hosting (Recommended)

```bash
# Navigate to frontend
cd apps/frontend

# Update environment configuration
# Edit: src/environments/environment.prod.ts

# Set API URL to Cloud Run backend
# Example:
# export const environment = {
#   production: true,
#   apiUrl: 'https://wayfinder-backend-xxx.run.app',
#   firebaseConfig: { ... }
# };

# Build production
npm run build

# Deploy to Firebase
firebase deploy --project $PROJECT_ID

# Get the URL
FRONTEND_URL=$(firebase hosting:channel:list --project $PROJECT_ID | grep -v CHANNEL | head -1 | awk '{print $NF}')
echo "Frontend URL: $FRONTEND_URL"
```

### Option B: Google Cloud Storage + Cloud CDN

```bash
# Create Cloud Storage bucket
gsutil mb gs://$PROJECT_ID-frontend

# Set CORS
gsutil cors set - gs://$PROJECT_ID-frontend <<'EOF'
[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
EOF

# Build and upload
cd apps/frontend
npm run build
gsutil -m cp -r dist/apps/frontend/* gs://$PROJECT_ID-frontend/

# Make public
gsutil iam ch serviceAccount:cloud-cdn@gserviceaccount.com:objectViewer gs://$PROJECT_ID-frontend

# Create Load Balancer with Cloud CDN (optional, via Console)
```

---

## Post-Deployment Verification

### 1. Backend Verification

```bash
# Health check
curl $BACKEND_URL/health -v

# Test API endpoint
curl -X GET "$BACKEND_URL/api/stats" \
  -H "Content-Type: application/json"

# Check Cloud Run logs
gcloud run logs read wayfinder-backend --region $REGION --limit 50

# View in Cloud Console
echo "https://console.cloud.google.com/run/detail/$REGION/wayfinder-backend"
```

### 2. Frontend Verification

```bash
# Open frontend URL in browser
echo "Open browser to: $FRONTEND_URL"

# Check Firebase Hosting deployment
firebase hosting:sites:list --project $PROJECT_ID

# View deployment history
firebase hosting:releases:list --project $PROJECT_ID
```

### 3. Integration Test

```bash
# From frontend, try to:
# 1. Sign in with Google
# 2. Execute a simple task
# 3. Monitor execution log
# 4. Check Cloud Run logs for backend activity

gcloud run logs read wayfinder-backend \
  --region $REGION \
  --follow
```

---

## Monitoring & Troubleshooting

### View Logs

```bash
# Real-time logs
gcloud run logs read wayfinder-backend --region $REGION --follow

# Filter by severity
gcloud run logs read wayfinder-backend \
  --region $REGION \
  --filter "severity >= ERROR"

# Download logs
gcloud run logs read wayfinder-backend \
  --region $REGION \
  --limit 1000 > backend-logs.txt
```

### Monitor Performance

```bash
# View Cloud Run metrics
gcloud monitoring metrics list --filter="metric.type:run" | head -20

# Check service status
gcloud run services describe wayfinder-backend --region $REGION

# View recent revisions
gcloud run revisions list --service wayfinder-backend --region $REGION
```

### Common Issues & Solutions

#### Service won't start
```bash
# Check logs for errors
gcloud run logs read wayfinder-backend --region $REGION --severity ERROR

# Verify environment variables
gcloud run services describe wayfinder-backend --region $REGION \
  --format 'value(spec.template.spec.containers[0].env)'

# Check image exists
gcloud container images describe gcr.io/$PROJECT_ID/wayfinder-backend:latest
```

#### High latency
```bash
# Increase memory and CPU
gcloud run deploy wayfinder-backend \
  --image gcr.io/$PROJECT_ID/wayfinder-backend:latest \
  --region $REGION \
  --memory 8Gi \
  --cpu 4

# Scale up minimum instances
gcloud run deploy wayfinder-backend \
  --image gcr.io/$PROJECT_ID/wayfinder-backend:latest \
  --region $REGION \
  --min-instances 5
```

#### Out of quota
```bash
# Check quota limits
gcloud compute project-info describe --project=$PROJECT_ID \
  --format="value(quotas[])"

# Reduce max instances temporarily
gcloud run deploy wayfinder-backend \
  --image gcr.io/$PROJECT_ID/wayfinder-backend:latest \
  --region $REGION \
  --max-instances 50
```

### Update Deployment

To redeploy with new code:

```bash
# 1. Build new image
cd apps/backend
docker build --tag gcr.io/$PROJECT_ID/wayfinder-backend:latest .

# 2. Push to registry
docker push gcr.io/$PROJECT_ID/wayfinder-backend:latest

# 3. Deploy new revision
gcloud run deploy wayfinder-backend \
  --image gcr.io/$PROJECT_ID/wayfinder-backend:latest \
  --region $REGION

# Cloud Run automatically creates new revision and routes traffic
# Old revisions are kept for rollback if needed
```

---

## Cost Optimization

### Recommendations

1. **Set auto-scaling limits**
   - `--max-instances` based on expected load
   - `--min-instances 1` to reduce cold starts

2. **Use Cloud Storage for static files**
   - Store screenshots in Cloud Storage
   - Reference via signed URLs

3. **Enable VPC Connector** (if needed for private APIs)
   - Add cost, use only if necessary

4. **Schedule cleanup jobs**
   - Remove old task history periodically
   - Use Cloud Scheduler for automation

### Cost Estimate
- **Cloud Run (backend)**: ~$0.40 per million requests
- **Firestore**: Pay-as-you-go (typically <$5/month for small usage)
- **Cloud Storage**: Minimal (only if storing large files)
- **Vertex AI**: ~$0.001 per request (Gemini included in Vertex AI pricing)

---

## Next Steps

1. ✅ Deployment complete!
2. Test all features thoroughly
3. [Create architecture diagram](../docs/guides/ARCHITECTURE_DIAGRAM_GUIDE.md)
4. Record demo video (4 min max)
5. Prepare for submission

---

## Useful Commands Reference

```bash
# Set up shell variables
export PROJECT_ID="your-project-id"
export REGION="us-central1"

# View all deployments
gcloud run services list --region $REGION

# Delete service
gcloud run services delete wayfinder-backend --region $REGION

# View service logs
gcloud run logs read wayfinder-backend --region $REGION --follow

# Update service
gcloud run deploy wayfinder-backend \
  --image gcr.io/$PROJECT_ID/wayfinder-backend:latest \
  --region $REGION

# Set traffic to specific revision
gcloud run services update-traffic wayfinder-backend \
  --to-revisions REVISION_NAME=100 \
  --region $REGION

# Get all images in registry
gcloud container images list --repository-url=gcr.io/$PROJECT_ID

# Cleanup old images
gcloud container images delete gcr.io/$PROJECT_ID/wayfinder-backend:OLD_TAG --quiet
```

---

**Last Updated**: February 25, 2026  
**Status**: Ready for Deploy  
**Support**: See [README.md](../README.md#-troubleshooting)
