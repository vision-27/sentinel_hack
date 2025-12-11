import { useEffect, useState } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { Call } from '../types';
import { Card, CardHeader, CardTitle, CardContent } from './Card';
import { MapPin, AlertTriangle } from 'lucide-react';

interface MapViewProps {
  call?: Call;
  calls?: Call[];
  height?: string;
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// Default center (can be adjusted based on your jurisdiction)
const DEFAULT_CENTER = { lat: 37.7749, lng: -122.4194 }; // San Francisco

export default function MapView({ call, calls, height = '400px' }: MapViewProps) {
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [zoom, setZoom] = useState(12);

  useEffect(() => {
    // If single call with location, center on it
    if (call?.location_lat && call?.location_lon) {
      setCenter({ lat: call.location_lat, lng: call.location_lon });
      setZoom(15);
    }
    // If multiple calls, center on first one with location
    else if (calls && calls.length > 0) {
      const callWithLocation = calls.find(c => c.location_lat && c.location_lon);
      if (callWithLocation) {
        setCenter({ 
          lat: callWithLocation.location_lat!, 
          lng: callWithLocation.location_lon! 
        });
        setZoom(12);
      }
    }
  }, [call, calls]);

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <Card>
        <CardHeader>
          <CardTitle level="h3">Location Map</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center" style={{ height }}>
            <AlertTriangle className="text-yellow-500 mb-4" size={48} />
            <p className="text-sm text-gray-600 mb-2">Google Maps API key not configured</p>
            <p className="text-xs text-gray-500">
              Add VITE_GOOGLE_MAPS_API_KEY to your .env file
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const markers = call 
    ? (call.location_lat && call.location_lon ? [call] : [])
    : (calls || []).filter(c => c.location_lat && c.location_lon);

  if (markers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle level="h3">Location Map</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center" style={{ height }}>
            <MapPin className="text-gray-400 mb-4" size={48} />
            <p className="text-sm text-gray-600">No location data available for this call</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getPriorityColor = (priority: Call['priority']) => {
    switch (priority) {
      case 'critical':
        return '#DC2626'; // red-600
      case 'high':
        return '#EA580C'; // orange-600
      case 'medium':
        return '#F59E0B'; // amber-500
      case 'low':
        return '#10B981'; // emerald-500
      default:
        return '#6B7280'; // gray-500
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle level="h3">Location Map</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
          <div style={{ height, width: '100%' }}>
            <Map
              mapId="emergency-call-map"
              center={center}
              zoom={zoom}
              gestureHandling="greedy"
              disableDefaultUI={false}
              zoomControl={true}
              mapTypeControl={false}
              streetViewControl={false}
              fullscreenControl={true}
            >
              {markers.map((marker) => (
                <AdvancedMarker
                  key={marker.id}
                  position={{ lat: marker.location_lat!, lng: marker.location_lon! }}
                  title={`${marker.call_id} - ${marker.incident_type || 'Unknown Incident'}`}
                >
                  <Pin
                    background={getPriorityColor(marker.priority)}
                    borderColor="#1F2937"
                    glyphColor="#FFFFFF"
                  />
                </AdvancedMarker>
              ))}
            </Map>
          </div>
        </APIProvider>
      </CardContent>
    </Card>
  );
}

