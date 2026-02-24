# 🚀 DEPLOY TO GOOGLE CLOUD - STEP BY STEP

**Time needed**: 30-45 minutes  
**Cost**: Free tier eligible

---

## Prerequisites

1. **Google Cloud Account** with billing enabled
2. **gcloud CLI** installed ([Install here](https://cloud.google.com/sdk/docs/install))
3. **Docker** installed locally

---

## Step 1: Set Up Google Cloud Project (5 min)

```bash
# Set your project ID (replace with your actual project ID)
export PROJECT_ID="your-project-id"

# Login to Google Cloud
gcloud auth login

# Set the project
gcloud config set project $PROJECT_ID

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable aiplatform.googleapis.com

echo "✅ Google Cloud configured"
```

---

## Step 2: Configure Backend Environment (2 min)

Create `.env` file in `backend/` if not exists:

```bash
cd backend

cat > .env << EOF
GOOGLE_CLOUD_PROJECT_ID=$PROJECT_ID
GOOGLE_CLOUD_REGION=us-central1
GEMINI_MODEL=gemini-2.0-flash-exp
NODE_ENV=production
PORT=8080
FRONTEND_URL=https://your-frontend-url.web.app
EOF

echo "✅ Environment configured"
```

---

## Step 3: Deploy Backend to Cloud Run (15 min)

```bash
# Still in backend/ directory

# Build and submit to Cloud Build
gcloud builds submit --tag gcr.io/$PROJECT_ID/wayfinder-backend

# Deploy to Cloud Run
gcloud run deploy wayfinder-backend \
  --image gcr.io/$PROJECT_ID/wayfinder-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --set-env-vars GOOGLE_CLOUD_PROJECT_ID=$PROJECT_ID,GEMINI_MODEL=gemini-2.0-flash-exp,NODE_ENV=production

# Get the backend URL
export BACKEND_URL=$(gcloud run services describe wayfinder-backend \
  --region us-central1 \
  --format 'value(status.url)')

echo "✅ Backend deployed!"
echo "Backend URL: $BACKEND_URL"
```

**IMPORTANT**: Copy the `$BACKEND_URL` - you'll need it for the frontend!

---

## Step 4: Record Proof of Deployment Video (5 min)

**This is MANDATORY for submission**

### Option A: Console Screenshot
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to **Cloud Run** → Select `wayfinder-backend`
3. Take screenshot showing:
   - Service name
   - Status: "✓ Serving"
   - URL displayed
   - Revision deployed

### Option B: Short Screen Recording (Better)
1. Open Google Cloud Console
2. Navigate to **Cloud Run** → `wayfinder-backend`
3. Click **LOGS** tab
4. Make a test request to your backend
5. Show logs appearing in real-time
6. Save as `deployment-proof.mp4`

```bash
# Test your backend
curl $BACKEND_URL/health

# You should see: {"status":"ok"}
```

---

## Step 5: Deploy Frontend to Firebase (10 min)

```bash
cd ../frontend

# Install Firebase CLI if not installed
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase (if not already done)
firebase init hosting
# - Choose "Use an existing project" and select your project
# - Set public directory to: dist/frontend/browser
# - Configure as single-page app: Yes
# - Set up automatic builds: No
# - Don't overwrite index.html

# Update environment with backend URL
cat > src/environments/environment.prod.ts << EOF
export const environment = {
  production: true,
  apiUrl: '$BACKEND_URL'
};
EOF

# Build for production
npm run build

# Deploy to Firebase
firebase deploy --only hosting

# Get your frontend URL
firebase hosting:sites:list

echo "✅ Frontend deployed!"
```

---

## Step 6: Update CORS Settings (5 min)

Your backend needs to allow your frontend domain:

```bash
cd ../backend

# Update backend with frontend URL
gcloud run services update wayfinder-backend \
  --region us-central1 \
  --update-env-vars FRONTEND_URL=https://your-project.web.app

echo "✅ CORS configured"
```

---

## Step 7: Test End-to-End (5 min)

1. Open your frontend: `https://your-project.web.app`
2. Enter a task: "search for cake" on https://google.com
3. Click "Start Automation"
4. Watch it work!

```bash
# Monitor backend logs in real-time
gcloud run services logs tail wayfinder-backend \
  --region us-central1 \
  --format pretty
```

---

## Step 8: Get Deployment URLs for Submission

```bash
# Backend URL
echo "Backend URL: $BACKEND_URL"

# Frontend URL
firebase hosting:sites:list | grep "Site URL"

# Save these for your Devpost submission!
```

---

## Troubleshooting

### Backend build fails
```bash
# Check build logs
gcloud builds list --limit 5

# View specific build
gcloud builds log BUILD_ID
```

### "Permission Denied" errors
```bash
# Ensure Vertex AI is enabled
gcloud services enable aiplatform.googleapis.com

# Grant Cloud Run service account access
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member=serviceAccount:$(gcloud run services describe wayfinder-backend \
    --region us-central1 \
    --format='value(spec.template.spec.serviceAccountName)') \
  --role=roles/aiplatform.user
```

### Frontend can't connect to backend
1. Check CORS settings in backend
2. Verify `FRONTEND_URL` environment variable
3. Check browser console for errors

### Gemini API errors
```bash
# Verify Vertex AI is enabled
gcloud services list --enabled | grep aiplatform

# Check quotas
gcloud AI quotas list --region us-central1
```

---

## Cost Optimization

**Cloud Run** (Backend):
- Free tier: 2 million requests/month
- After: ~$0.00002 per request
- Estimated: $0-5/month for hackathon

**Firebase Hosting** (Frontend):
- Free tier: 10GB/month
- Estimated: $0/month for hackathon

**Vertex AI** (Gemini):
- Check current pricing: https://cloud.google.com/vertex-ai/pricing
- Use the $100 credit from hackathon

---

## Clean Up After Hackathon

```bash
# Delete Cloud Run service
gcloud run services delete wayfinder-backend --region us-central1

# Delete Firebase hosting
firebase hosting:disable

# Delete container images
gcloud container images delete gcr.io/$PROJECT_ID/wayfinder-backend
```

---

## Quick Deploy Script (All-in-One)

Save this as `deploy.sh`:

```bash
#!/bin/bash
set -e

PROJECT_ID="your-project-id"

echo "🚀 Deploying Wayfinder AI to Google Cloud..."

# Backend
cd backend
gcloud builds submit --tag gcr.io/$PROJECT_ID/wayfinder-backend
gcloud run deploy wayfinder-backend \
  --image gcr.io/$PROJECT_ID/wayfinder-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --timeout 300

BACKEND_URL=$(gcloud run services describe wayfinder-backend \
  --region us-central1 --format 'value(status.url)')

# Frontend  
cd ../frontend
echo "export const environment = { production: true, apiUrl: '$BACKEND_URL' };" > src/environments/environment.prod.ts
npm run build
firebase deploy --only hosting

echo "✅ Deployment complete!"
echo "Backend: $BACKEND_URL"
```

Run with: `chmod +x deploy.sh && ./deploy.sh`

---

## Next Steps

- [ ] Add deployment URLs to README
- [ ] Record deployment proof video
- [ ] Test the live application
- [ ] Submit on Devpost with proof of deployment

🎉 **Your app is now live on Google Cloud!**
