# StakeChess Deployment Guide

## Prerequisites
- GitHub account
- Vercel account (for frontend)
- Render account (for backend)
- MongoDB Atlas account (or self-hosted MongoDB)

## Deployment Steps

### 1. GitHub Setup

The repository is already set up at: https://github.com/davidolsonab62-cloud/StakeChess

Push your code if you haven't already:
```bash
git add .
git commit -m "Add auto-refresh and return to match features"
git push origin main
```

### 2. Backend Deployment (Render)

1. Go to [render.com](https://render.com) and sign up/login
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `stakechess-api`
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3.10`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn server:app --host 0.0.0.0 --port 8000`

5. Add Environment Variables in Render Dashboard:
   - `MONGO_URL`: Your MongoDB connection string
   - `DB_NAME`: `stakechess`
   - `JWT_SECRET`: Generate a secure random string
   - `CORS_ORIGINS`: `https://yourdomain.vercel.app,https://yourdomain.com`

6. Click "Create Web Service"
7. Wait for deployment to complete (5-10 minutes)
8. Note your Render URL (e.g., `https://stakechess-api.onrender.com`)

### 3. Frontend Deployment (Vercel)

1. Go to [vercel.com](https://vercel.com) and sign up/login
2. Click "Add New..." → "Project"
3. Import your GitHub repository
4. Configure the project:
   - **Framework**: Create React App
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`

5. Add Environment Variables:
   - `REACT_APP_API_URL`: `https://stakechess-api.onrender.com/api`
   - `REACT_APP_BACKEND_URL`: `https://stakechess-api.onrender.com`

6. Click "Deploy"
7. Wait for deployment (2-5 minutes)
8. Your app is live at the provided Vercel URL

### 4. Update CORS Origins

After getting your Vercel URL, update the backend:
1. Go to Render dashboard → StakeChess API → Environment
2. Update `CORS_ORIGINS`: `https://your-vercel-url.vercel.app,https://yourdomain.com`
3. Redeploy

### 5. Custom Domain (Optional)

#### For Vercel Frontend:
1. In Vercel dashboard → Project Settings → Domains
2. Add your custom domain
3. Follow DNS configuration instructions

#### For Render Backend:
1. In Render dashboard → Service → Settings
2. Add Custom Domain
3. Update DNS records

## Environment Variables Reference

### Backend (`backend/.env`)
```
MONGO_URL=mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority
DB_NAME=stakechess
JWT_SECRET=your-secure-secret-key
CORS_ORIGINS=https://yourdomain.vercel.app,https://yourdomain.com
```

### Frontend (`frontend/.env`)
```
REACT_APP_API_URL=https://stakechess-api.onrender.com/api
REACT_APP_BACKEND_URL=https://stakechess-api.onrender.com
```

## Troubleshooting

### 500 errors from API
- Check MongoDB connection string in Render environment
- Verify CORS origins are correctly configured
- Check Render logs for detailed error messages

### WebSocket connection fails
- Ensure backend is running and accessible
- Check that `REACT_APP_BACKEND_URL` matches actual backend URL
- Render may require additional configuration for WebSocket; check Render docs

### Frontend shows "Disconnected from game server"
- Verify `REACT_APP_BACKEND_URL` environment variable
- Check browser console for connection errors
- Ensure backend is deployed and running

## Monitoring

- **Render**: Dashboard → Logs tab for backend errors
- **Vercel**: Deployments tab for build logs, Function logs for runtime errors
- **MongoDB Atlas**: Cloud console for database status and metrics

## Rollback

### Render
1. Go to Deployment History
2. Click on previous deployment
3. Click "Redeploy"

### Vercel
1. Go to Deployments
2. Click on previous deployment
3. Click "Promote to Production"
