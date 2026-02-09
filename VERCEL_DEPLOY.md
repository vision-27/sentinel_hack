# Vercel Deployment Guide

## Quick Deploy

1. **Install Vercel CLI** (if you haven't):
   ```bash
   npm i -g vercel
   ```

2. **Deploy from your project folder**:
   ```bash
   vercel
   ```
   
   Follow the prompts:
   - Link to existing project or create new
   - Confirm settings (Vercel auto-detects Vite)

3. **Set Environment Variables** in Vercel Dashboard:
   - Go to your project → Settings → Environment Variables
   - Add these:
     ```
     VITE_SUPABASE_URL
     VITE_SUPABASE_ANON_KEY
     VITE_GOOGLE_MAPS_API_KEY
     VITE_GEMINI_API_KEY
     SUPABASE_URL
     SUPABASE_SERVICE_ROLE_KEY
     GOOGLE_GEOCODING_API_KEY
     ```

4. **Redeploy** after adding env vars:
   ```bash
   vercel --prod
   ```

## Your URLs After Deploy

- **Frontend**: `https://your-project.vercel.app`
- **Health Check**: `https://your-project.vercel.app/health`
- **Webhook - Events**: `https://your-project.vercel.app/v1/dispatch/events`
- **Webhook - Call Start**: `https://your-project.vercel.app/v1/dispatch/call-start`

## Update ElevenLabs Webhooks

In your ElevenLabs workflow settings, update webhook URLs to:
- `https://your-project.vercel.app/v1/dispatch/call-start`
- `https://your-project.vercel.app/v1/dispatch/events`

## Notes

- Frontend is deployed as a static site (Vite build)
- Backend endpoints are serverless functions in `/api`
- No Docker needed - Vercel handles everything
- Free tier includes 100GB bandwidth/month
