# Wayfinder AI - Quick Reference Guide

## 🚀 Quick Commands

### First Time Setup
```bash
# 1. Run the automated setup
./setup.sh

# 2. Configure Google Cloud (edit backend/.env)
# GOOGLE_CLOUD_PROJECT_ID=your-project-id

# 3. Start development servers
./start-dev.sh
```

### Manual Backend Start
```bash
cd backend
npm install
npm run dev
```

### Manual Frontend Start
```bash
cd frontend
npm install
npm start
```

### Docker Setup
```bash
docker-compose up --build
```

## 🔧 Environment Configuration

### Backend (.env)
```env
GOOGLE_CLOUD_PROJECT_ID=your-gcp-project-id
GOOGLE_CLOUD_REGION=us-central1
GEMINI_MODEL=gemini-2.0-flash
BACKEND_PORT=3001
FRONTEND_URL=http://localhost:3000
```

### Frontend (.env.local)
```env
REACT_APP_API_URL=http://localhost:3001
```

## 📡 API Quick Test

### Execute Task
```bash
curl -X POST http://localhost:3001/api/agent/execute \
  -H "Content-Type: application/json" \
  -d '{
    "taskDescription": "Find the email contact on the page",
    "startUrl": "https://example.com"
  }'
```

### Check Status
```bash
curl http://localhost:3001/api/agent/status/{sessionId}
```

### Health Check
```bash
curl http://localhost:3001/health
```

## 🐛 Troubleshooting

### "Port 3000/3001 already in use"
```bash
# Find process using port
lsof -i :3000
# Kill process
kill -9 <PID>
```

### "Cannot find module '@google-cloud/vertexai'"
```bash
cd backend
npm install
```

### "Puppeteer: Failed to launch browser"
```bash
# Reinstall Puppeteer
cd backend
npm rebuild puppeteer
```

### "Gemini API Error: Invalid credentials"
- Verify `GOOGLE_CLOUD_PROJECT_ID` is set correctly
- Check credentials are available (Application Default Credentials)
- Ensure Vertex AI API is enabled in Cloud Console

### "Frontend can't connect to backend"
- Verify backend is running on port 3001
- Check `REACT_APP_API_URL` in frontend/.env.local
- Ensure CORS is enabled (it is by default)

### "Screenshots are blank/black"
- Check Pupputeer is properly installed
- Verify browser viewport (1280x720)
- Ensure page has finished loading

## 📚 Key Files

| File | Purpose |
|------|---------|
| `backend/src/index.ts` | Express server setup |
| `backend/src/gemini/client.ts` | Gemini API interactions |
| `backend/src/browser/controller.ts` | Playwright automation |
| `backend/src/agents/manager.ts` | Task orchestration |
| `frontend/src/App.tsx` | Main dashboard |
| `docker-compose.yml` | Container setup |

## 🔄 Development Workflow

1. **Edit Backend**
   - Update files in `backend/src/`
   - TypeScript auto-compiles with `npm run watch`
   - Server restarts automatically (in dev mode)

2. **Edit Frontend**
   - Update files in `frontend/src/`
   - React hot-reloads automatically
   - CSS changes apply instantly

3. **Test API**
   - Use curl or Postman
   - Check browser DevTools Network tab
   - Monitor backend console for logs

## 📊 Default Ports

- **Frontend**: 3000 (React)
- **Backend API**: 3001 (Express)
- **Docker Network**: Both services connected

## 🎯 Common Tasks

### Enable Debug Logging
Add to `backend/src/index.ts`:
```typescript
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, req.body);
  next();
});
```

### Change Browser Viewport
Edit `backend/src/browser/controller.ts`:
```typescript
defaultViewport: { width: 1920, height: 1080 }
```

### Increase Task Timeout
Edit `backend/src/agents/manager.ts`:
```typescript
private maxSteps: number = 100; // Increase from 50
```

### Change Gemini Model
Edit `backend/.env`:
```env
GEMINI_MODEL=gemini-1.5-pro
```

## 📖 Documentation Links

- [Google Gemini API Docs](https://ai.google.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Express.js Guide](https://expressjs.com/)
- [React Documentation](https://react.dev/)
- [Docker Compose Docs](https://docs.docker.com/compose/)

## 🚀 Production Deployment

### Deploy to Google Cloud Run
```bash
# Build backend image
gcloud builds submit --tag gcr.io/PROJECT_ID/autosteer-backend ./backend

# Deploy
gcloud run deploy autosteer-backend \
  --image gcr.io/PROJECT_ID/autosteer-backend \
  --memory 2Gi \
  --timeout 3600
```

### Deploy Frontend to Firebase
```bash
npm install -g firebase-tools
firebase init
firebase deploy
```

## 💡 Tips & Tricks

- **Faster Development**: Use VS Code's TypeScript checking
- **Monitor Gemini Costs**: Check Google Cloud Console
- **Debug Screenshots**: Save them to disk for analysis
- **Parallel Tasks**: Create multiple sessions for concurrent runs
- **Error Handling**: Check console logs for detailed error info

---

**Happy Automating! 🤖✨**
