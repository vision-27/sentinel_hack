# Quick Start - Google Maps Integration

## 🚀 Get Started in 5 Minutes

### Step 1: Get Your API Key (2 minutes)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create/select a project
3. Enable **Maps JavaScript API**
4. Create an **API Key**
5. Copy your API key

### Step 2: Configure Your Project (1 minute)

Create a `.env` file in the project root:

```bash
# Copy this template
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GOOGLE_MAPS_API_KEY=AIzaSyC...your_api_key_here
```

### Step 3: Run the App (30 seconds)

```bash
npm install  # If you haven't already
npm run dev
```

### Step 4: Test It Out (30 seconds)

1. Open `http://localhost:5173` in your browser
2. Click on any call in the sidebar
3. Scroll down to see the **Location Map** displaying the emergency location
4. The marker color indicates priority (red = critical, orange = high, etc.)

## ✨ What You'll See

### Map Features
- 📍 **Interactive markers** showing emergency locations
- 🎨 **Color-coded by priority**: Red (critical), Orange (high), Yellow (medium), Green (low)
- 🗺️ **Auto-centered** on emergency location
- 🔍 **Zoom controls** for detailed view
- 📱 **Responsive** design for all screen sizes

### Sample Data
The dashboard comes with 3 sample emergency calls in NYC:
- **Medical Emergency** - Downtown Manhattan (Critical)
- **Fire** - Westside Manhattan (High)
- **Traffic Accident** - Eastside Manhattan (Medium)

All have GPS coordinates ready to display on the map!

## ❓ Troubleshooting

### Map not showing?
- ✅ Check that `VITE_GOOGLE_MAPS_API_KEY` is in your `.env` file
- ✅ Verify the API key is valid in [Google Cloud Console](https://console.cloud.google.com/)
- ✅ Make sure "Maps JavaScript API" is enabled
- ✅ Restart your dev server after adding the API key

### "This page can't load Google Maps correctly"
- Enable billing in Google Cloud Console (free tier is generous: $200/month credit)
- Check API key restrictions aren't blocking localhost

### Map shows but no markers?
- Verify the call has `location_lat` and `location_lon` values
- Check browser console for errors

## 📚 More Information

- **Detailed Setup**: See `GOOGLE_MAPS_SETUP.md`
- **Implementation Details**: See `IMPLEMENTATION_SUMMARY.md`
- **General Info**: See `README.md`

## 🔐 Security Reminder

Before deploying to production:
1. **Restrict your API key** to your domain
2. **Enable billing alerts** in Google Cloud Console
3. **Never commit** `.env` files to git (already in `.gitignore`)

## 💰 Cost

Google Maps is **free** for most use cases:
- $200 free credit per month
- ~28,000 map loads per month free
- Perfect for development and moderate production use

---

**Need Help?** Check the detailed guides:
- [Google Maps Setup Guide](./GOOGLE_MAPS_SETUP.md)
- [Implementation Summary](./IMPLEMENTATION_SUMMARY.md)

