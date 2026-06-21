# 🚀 StakeChess - Deployment Quick Start

## Repository
✅ Code is pushed to: https://github.com/davidolsonab62-cloud/StakeChess

## What's New
- ✅ **Auto-Refresh Lobby**: Games update in real-time via Socket.IO when players join
- ✅ **Return to Match**: Users can rejoin their active game if they accidentally navigate away
- ✅ **Deployment Ready**: Vercel + Render configuration included

## Deploy Frontend to Vercel (5 minutes)

1. Go to https://vercel.com/new
2. Import the GitHub repository
3. Configure:
   - **Framework**: Create React App
   - **Root Directory**: `frontend`
4. Add Environment Variables:
   ```
   REACT_APP_API_URL=https://YOUR-BACKEND-URL/api
   REACT_APP_BACKEND_URL=https://YOUR-BACKEND-URL
   ```
5. Click Deploy
6. Your frontend is live! ✅

## Deploy Backend to Render (10 minutes)

1. Go to https://dashboard.render.com/new/web
2. Connect GitHub & select StakeChess repo
3. Configure:
   - **Name**: stakechess-api
   - **Root Directory**: backend
   - **Runtime**: Python 3.10
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn server:app --host 0.0.0.0 --port 8000`
4. Add Environment Variables:
   ```
   MONGO_URL=<Your MongoDB Atlas URL>
   DB_NAME=stakechess
   JWT_SECRET=<Generate a secure random string>
   CORS_ORIGINS=https://YOUR-VERCEL-URL.vercel.app
   ```
5. Click Create
6. Wait 5-10 minutes for deployment
7. Your backend is live! ✅

## Connection Test

After deployment:
1. Visit your Vercel URL
2. Login and create a game
3. Check browser console for connection logs
4. If you see "🔌 Socket connected", you're good!

## Troubleshooting

| Issue | Solution |
|-------|----------|
| 500 errors | Check MONGO_URL and MongoDB Atlas network access |
| WebSocket disconnects | Verify REACT_APP_BACKEND_URL matches backend URL |
| Games don't load | Check CORS_ORIGINS includes your Vercel domain |
| Can't join games | Verify Socket.IO connection in browser console |

## Environment Variables Required

### Backend (Render)
- `MONGO_URL` - MongoDB Atlas connection string
- `DB_NAME` - Database name (e.g., "stakechess")
- `JWT_SECRET` - Secret key for JWT tokens
- `CORS_ORIGINS` - Comma-separated list of allowed origins

### Frontend (Vercel)
- `REACT_APP_API_URL` - Backend API URL with `/api` suffix
- `REACT_APP_BACKEND_URL` - Backend base URL for Socket.IO

## Features Deployed

✅ Real-time game updates via Socket.IO
✅ Auto-refresh lobby when players join
✅ Return to current match button
✅ 5-second auto-refresh of game state
✅ Full chess game with chat
✅ Leaderboard and tournaments
✅ Wallet management with crypto support

## Next Steps

1. Configure custom domain (optional)
2. Set up MongoDB Atlas backups
3. Monitor Render & Vercel dashboards
4. Set up error tracking (Sentry, LogRocket)
5. Configure email notifications

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.
