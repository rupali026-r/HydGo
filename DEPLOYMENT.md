# HydGo Deployment Guide

## Prerequisites
- GitHub account
- Vercel account (for frontend apps)
- Render account (for backend, database, Redis)
- Firebase project configured (for Google Sign-In)

## Repository Setup

### 1. Push to GitHub
```bash
git remote add origin https://github.com/rupali026-r/HydGo.git
git add .
git commit -m "Initial commit - HydGo ride-sharing platform"
git branch -M main
git push -u origin main
```

## Deployment Steps

### 1. Deploy Backend to Render

#### Option A: Using render.yaml (Recommended)
1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New" → "Blueprint"
3. Connect your GitHub repository
4. Render will automatically detect `render.yaml` and create:
   - PostgreSQL database
   - Redis instance
   - Backend web service
5. Set the `ADMIN_SECRET` environment variable manually:
   - Go to Backend service → Environment
   - Add: `ADMIN_SECRET` = `ADMINRUPALI`

#### Option B: Manual Setup
1. **Create PostgreSQL Database:**
   - New → PostgreSQL
   - Name: hydgo-postgres
   - Database: hydgo
   - User: hydgo_user
   - Region: Oregon (or closest to you)
   - Plan: Free
   - Copy the **Internal Database URL**

2. **Create Redis:**
   - New → Redis
   - Name: hydgo-redis
   - Region: Oregon
   - Plan: Free
   - Maxmemory Policy: allkeys-lru
   - Copy the **Internal Redis URL**

3. **Deploy Backend:**
   - New → Web Service
   - Connect repository: `rupali026-r/HydGo`
   - Root Directory: `backend`
   - Name: hydgo-backend
   - Region: Oregon
   - Branch: main
   - Runtime: Node
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Plan: Free
   
   **Environment Variables:**
   ```
   NODE_ENV=production
   PORT=3000
   DATABASE_URL=<postgres_internal_url>
   REDIS_URL=<redis_internal_url>
   JWT_ACCESS_SECRET=<generate_random_string>
   JWT_REFRESH_SECRET=<generate_random_string>
   JWT_ACCESS_EXPIRES=15m
   JWT_REFRESH_EXPIRES=7d
   ADMIN_SECRET=ADMINRUPALI
   CORS_ORIGIN=https://hydgo-passenger.vercel.app,https://hydgo-driver.vercel.app
   SIMULATION_MODE=true
   ```

4. **Run Database Migrations:**
   After deployment, go to Shell and run:
   ```bash
   npx prisma migrate deploy
   ```

### 2. Deploy Passenger App to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/)
2. Click "Add New" → "Project"
3. Import `rupali026-r/HydGo` repository
4. Configure:
   - **Project Name:** hydgo-passenger
   - **Framework Preset:** Other
   - **Root Directory:** `mobile/hydgo-mobile`
   - **Build Command:** `npx expo export --platform web`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`

5. **Environment Variables:**
   ```
   EXPO_PUBLIC_API_URL=https://hydgo-backend.onrender.com/api
   ```

6. Deploy!

7. **Custom Domain (Optional):**
   - Go to Project Settings → Domains
   - Add: `passenger.hydgo.app` (or your domain)

### 3. Deploy Driver App to Vercel

1. In Vercel Dashboard, click "Add New" → "Project"
2. Import same repository
3. Configure:
   - **Project Name:** hydgo-driver
   - **Framework Preset:** Other
   - **Root Directory:** `driver-app`
   - **Build Command:** `npx expo export --platform web`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`

4. **Environment Variables:**
   ```
   EXPO_PUBLIC_API_URL=https://hydgo-backend.onrender.com/api
   ```

5. Deploy!

6. **Custom Domain (Optional):**
   - Add: `driver.hydgo.app`

### 4. Update Backend CORS

After both Vercel apps are deployed, update backend CORS:

1. Go to Render → hydgo-backend → Environment
2. Update `CORS_ORIGIN` with your actual Vercel URLs:
   ```
   CORS_ORIGIN=https://hydgo-passenger.vercel.app,https://hydgo-driver.vercel.app,https://hydgo-driver-<your-hash>.vercel.app,https://hydgo-passenger-<your-hash>.vercel.app
   ```
3. Save → Render will auto-redeploy

### 5. Update Firebase Authorized Domains

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: **hydgo-3c94d**
3. Authentication → Settings → Authorized domains
4. Add:
   - `hydgo-passenger.vercel.app`
   - `hydgo-passenger-<your-hash>.vercel.app` (if different)
5. Save

## Post-Deployment Configuration

### 1. Test Backend Health
```bash
curl https://hydgo-backend.onrender.com/api/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "hydgo-backend",
  "dependencies": {
    "database": "ok",
    "redis": "ok"
  }
}
```

### 2. Create Admin Account

Open passenger app in browser:
- Go to: `https://hydgo-passenger.vercel.app/admin/login`
- Click "Register with Key"
- Fill in:
  - Name: Your Name
  - Email: your@email.com
  - Password: (Strong password)
  - Admin Secret: `ADMINRUPALI`
- Submit

### 3. Test Passenger Google Sign-In

1. Go to: `https://hydgo-passenger.vercel.app/passenger/login`
2. Click "Continue with Google"
3. Sign in with Google account
4. Should redirect to passenger home

### 4. Register Driver

1. Go to: `https://hydgo-driver.vercel.app/register`
2. Fill driver registration form:
   - License number required
   - Bus type, experience, etc.
3. Submit → Status will be "Pending Approval"

### 5. Approve Driver (Admin)

1. Login as admin: `https://hydgo-passenger.vercel.app/admin/login`
2. Go to Admin Panel
3. Find pending driver
4. Click "Approve"
5. Driver can now login and use driver app

## Environment URLs

- **Passenger App:** https://hydgo-passenger.vercel.app
- **Driver App:** https://hydgo-driver.vercel.app  
- **Backend API:** https://hydgo-backend.onrender.com
- **Admin Portal:** https://hydgo-passenger.vercel.app/admin/login

## Database Migrations

To add new migrations in production:

1. Go to Render → hydgo-backend → Shell
2. Run:
   ```bash
   npx prisma migrate deploy
   ```

Or update via local:
```bash
DATABASE_URL="<production_database_url>" npx prisma migrate deploy
```

## Monitoring

### Backend Logs
- Render Dashboard → hydgo-backend → Logs

### Database Console
- Render Dashboard → hydgo-postgres → Connect
- Use provided connection details with any PostgreSQL client

### Redis Console
- Render Dashboard → hydgo-redis → Connect
- Use Redis CLI or RedisInsight

## Troubleshooting

### Backend won't start
- Check environment variables are set
- Check database migrations ran successfully
- View logs in Render dashboard

### Frontend can't connect to backend
- Verify `EXPO_PUBLIC_API_URL` in Vercel
- Check CORS settings in backend
- Verify backend health endpoint

### Google Sign-In not working
- Verify Firebase authorized domains
- Check Firebase config in `mobile/hydgo-mobile/lib/firebase.ts`
- Ensure `localhost` is in authorized domains for local testing

### Database connection issues
- Use **Internal Database URL** from Render (not external)
- Check database is in same region as backend
- Verify connection string format

## Free Tier Limits

### Render Free Tier:
- PostgreSQL: 1GB storage, 90-day expiry if inactive
- Redis: 25MB memory
- Web Service: Spins down after 15min inactivity, 750 hours/month

### Vercel Free Tier:
- 100GB bandwidth/month
- 100 deployments/day
- Unlimited websites

## Paid Upgrades (Optional)

### When to upgrade:
- **Render Starter ($7/month):** Keep backend always running, more resources
- **Render Standard ($25/month):** Better database, no 90-day limit
- **Vercel Pro ($20/month):** Custom domains, better analytics

## Security Notes

1. **Never commit:**
   - `.env` files (already in .gitignore)
   - Firebase service account keys
   - Database passwords

2. **Rotate secrets regularly:**
   - JWT secrets
   - Admin secret
   - Database passwords

3. **Use environment variables:**
   - All sensitive config via Vercel/Render environment variables
   - Never hardcode secrets

## Support

For issues:
1. Check logs in respective platforms
2. Verify environment variables
3. Test backend health endpoint
4. Check Firebase console for auth errors

---

**Deployed by:** Rupali  
**Project:** HydGo - Smart Bus Ride-Sharing Platform  
**Tech Stack:** React Native (Expo), Node.js, PostgreSQL, Redis, Firebase Auth
