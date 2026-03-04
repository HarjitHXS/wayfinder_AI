# Reproducible Setup and Testing

This guide is focused on reproducing the project end-to-end for judges and reviewers. For the high-level overview, see [README.md](README.md).

## 1) Prerequisites
- Node.js 18+
- Google Cloud project with Vertex AI enabled
- A service account JSON key with `roles/aiplatform.user`
- Docker (optional, for container builds)

## 2) Google Cloud Setup (Vertex AI)
```bash
# Pick a project ID and set it
export PROJECT_ID="wayfinder-ai-demo"
export REGION="us-central1"

gcloud projects create "$PROJECT_ID" --name="Wayfinder AI Demo"
gcloud config set project "$PROJECT_ID"

gcloud services enable aiplatform.googleapis.com

# Create a service account

gcloud iam service-accounts create wayfinder-sa \
  --display-name="Wayfinder AI Service Account"

# Grant Vertex AI access

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:wayfinder-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

# Download key

gcloud iam service-accounts keys create ./wayfinder-sa-key.json \
  --iam-account=wayfinder-sa@$PROJECT_ID.iam.gserviceaccount.com
```

## 3) Environment Variables
Create a `.env` in the repo root:
```env
GOOGLE_CLOUD_PROJECT_ID=wayfinder-ai-demo
GOOGLE_CLOUD_REGION=us-central1
GEMINI_MODEL=gemini-2.0-flash
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/wayfinder-sa-key.json

# Backend
BACKEND_PORT=3001
FRONTEND_URL=http://localhost:3000

# Frontend (local dev)
VITE_API_URL=http://localhost:3001

# Firebase (optional for auth + history)
FIREBASE_API_KEY=your-firebase-api-key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
```

## 4) Install Dependencies
```bash
npm install
```

## 5) Run Locally (Reproducible)
Open two terminals:
```bash
# Terminal 1
npm run backend
```

```bash
# Terminal 2
npm run frontend
```

Then open: http://localhost:3000

## 6) Reproducible Test Tasks
Use these exact tasks to verify the agent:

### Test A: Simple Form Fill
```
URL: https://httpbin.org/forms/post
Task: "Fill out the form with the following details:
  - Customer Name: John Smith
  - Email: john@example.com
  - Message: I'm interested in your services
  Then click the Submit button"
```
Expected outcome: form submitted successfully; execution log shows click/type steps.

### Test B: Multi-step Task
```
URL: https://example.com
Task: "
1. Search for 'Python programming'
2. Click on the first result
3. Scroll down and find the 'Comments' section
4. Take a screenshot
"
```
Expected outcome: navigation to a result page; log shows scroll and screenshot steps.

### Test C: Data Extraction
```
URL: https://github.com/trending
Task: "List the top 5 trending repositories with their star counts"
```
Expected outcome: execution log includes extracted repo names and star counts.

## 7) Optional: Deploy Backend to Cloud Run
```bash
cd apps/backend

docker build -t gcr.io/$PROJECT_ID/wayfinder-backend:latest .
docker push gcr.io/$PROJECT_ID/wayfinder-backend:latest

gcloud run deploy wayfinder-backend \
  --image gcr.io/$PROJECT_ID/wayfinder-backend:latest \
  --platform managed \
  --region "$REGION" \
  --memory 4Gi \
  --timeout 3600 \
  --set-env-vars=\
GOOGLE_CLOUD_PROJECT_ID=$PROJECT_ID,\
GOOGLE_CLOUD_REGION=$REGION,\
GEMINI_MODEL=gemini-2.0-flash,\
FRONTEND_URL=https://your-frontend-url.com,\
BACKEND_PORT=8080
```

## Notes
- If you do not configure Firebase, authentication and history storage are disabled, but the agent flow still works.
- If Vertex AI is not enabled or credentials are missing, the agent will not be able to analyze screenshots.
