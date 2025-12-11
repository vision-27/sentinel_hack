# Google Maps API Setup Guide

This guide will help you set up Google Maps API for the First Responder Emergency Dashboard.

## Overview

The dashboard now includes an interactive map component that displays emergency call locations with priority-coded markers. Each marker's color indicates the urgency level of the call:

- 🔴 **Red** - Critical priority
- 🟠 **Orange** - High priority  
- 🟡 **Yellow** - Medium priority
- 🟢 **Green** - Low priority

## Getting Your Google Maps API Key

### Step 1: Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account
3. Click **Select a Project** → **New Project**
4. Enter a project name (e.g., "Emergency Dashboard")
5. Click **Create**

### Step 2: Enable the Maps JavaScript API

1. In your project, go to **APIs & Services** → **Library**
2. Search for "Maps JavaScript API"
3. Click on it and press **Enable**
4. (Optional) Also enable "Places API" for enhanced location features

### Step 3: Create an API Key

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **API Key**
3. Your API key will be generated and displayed
4. **Important:** Click **Restrict Key** to set up security restrictions

### Step 4: Restrict Your API Key (Recommended)

For security, you should restrict your API key:

#### Application Restrictions:
- **Development**: Select "None" or "HTTP referrers" and add `http://localhost:*`
- **Production**: Select "HTTP referrers" and add your domain(s)

#### API Restrictions:
- Select "Restrict key"
- Choose only:
  - Maps JavaScript API
  - Places API (if enabled)

### Step 5: Add API Key to Your Project

1. Create a `.env` file in the project root (if it doesn't exist)
2. Add your API key:

```env
VITE_GOOGLE_MAPS_API_KEY=AIzaSyC...your_api_key_here
```

3. Restart your development server:

```bash
npm run dev
```

## Features

### MapView Component

The `MapView` component is automatically integrated into the `CallDetail` view and displays:

- **Single Call View**: Zooms to the specific emergency location
- **Multiple Calls View**: Can display multiple call locations with priority markers
- **Interactive Controls**: Zoom, pan, and fullscreen support
- **Responsive**: Adapts to different screen sizes

### Props

```typescript
interface MapViewProps {
  call?: Call;           // Single call to display
  calls?: Call[];        // Multiple calls to display
  height?: string;       // Map height (default: '400px')
}
```

### Usage Examples

```tsx
// Display a single call location
<MapView call={activeCall} height="350px" />

// Display multiple call locations
<MapView calls={allCalls} height="600px" />
```

## Troubleshooting

### Map Not Showing

1. **API Key Missing**: Make sure `VITE_GOOGLE_MAPS_API_KEY` is set in your `.env` file
2. **API Not Enabled**: Verify Maps JavaScript API is enabled in Google Cloud Console
3. **Billing Not Enabled**: Google Maps requires billing to be enabled (free tier available)
4. **Key Restrictions**: Check that your domain/localhost is allowed in API key restrictions

### Common Errors

#### "This page can't load Google Maps correctly"
- Your API key is invalid or restricted
- Billing is not enabled on your Google Cloud project

#### "RefererNotAllowedMapError"
- Your domain is not authorized in the API key restrictions
- Add your domain to the HTTP referrers list

#### Map Shows but No Markers
- Check that your call has `location_lat` and `location_lon` values
- Verify the coordinates are valid (lat: -90 to 90, lng: -180 to 180)

## Cost Information

Google Maps offers a generous free tier:

- **$200 free credit per month**
- **28,000+ map loads per month** (free)
- Maps JavaScript API: $7 per 1,000 loads (after free tier)

For a typical emergency dashboard with moderate traffic, you should stay within the free tier.

## Security Best Practices

1. **Never commit `.env` files** - Already in `.gitignore`
2. **Restrict API keys** - Limit to specific domains and APIs
3. **Monitor usage** - Check Google Cloud Console regularly
4. **Set usage limits** - Configure budget alerts in Google Cloud
5. **Rotate keys** - Periodically regenerate API keys

## Additional Resources

- [Google Maps JavaScript API Documentation](https://developers.google.com/maps/documentation/javascript)
- [API Key Best Practices](https://developers.google.com/maps/api-security-best-practices)
- [@vis.gl/react-google-maps Documentation](https://visgl.github.io/react-google-maps/)

## Support

If you encounter issues:

1. Check the browser console for errors
2. Verify your API key in the [Google Cloud Console](https://console.cloud.google.com/)
3. Review the Google Maps API [quota and usage](https://console.cloud.google.com/google/maps-apis/quotas)

