import { useEffect, useState, useRef } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, useMapsLibrary } from '@vis.gl/react-google-maps';
import { Call } from '../types';
import { Card, CardHeader, CardTitle, CardContent } from './Card';
import { Badge } from './Badge';
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
  }, [call?.location_lat, call?.location_lon, calls]);

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
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle level="h3">Location Map</CardTitle>
        {call?.location_text && !call.location_lat && (
          <Badge variant="warning" size="sm">Resolving Location...</Badge>
        )}
      </CardHeader>
      <CardContent className="p-0 relative">
        <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
          <div style={{ height, width: '100%' }} className="relative">
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
              onCenterChanged={(ev) => setCenter(ev.detail.center)}
              onZoomChanged={(ev) => setZoom(ev.detail.zoom)}
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
            <MapSearchControl onLocationSelect={(loc) => {
              setCenter({ lat: loc.lat, lng: loc.lng });
              setZoom(16);
            }} />
          </div>
        </APIProvider>
      </CardContent>
    </Card>
  );
}

function MapSearchControl({ onLocationSelect }: { onLocationSelect: (loc: { lat: number, lng: number }) => void }) {
  const places = useMapsLibrary('places');
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!places || !inputRef.current) return;

    const options = {
      fields: ['geometry', 'name', 'formatted_address'],
    };

    const autocomplete = new places.Autocomplete(inputRef.current, options);

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (place.geometry?.location) {
        const loc = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng()
        };
        onLocationSelect(loc);
        setInputValue(place.formatted_address || place.name || '');
      }
    });

    return () => {
      google.maps.event.clearInstanceListeners(autocomplete);
    };
  }, [places, onLocationSelect]);

  return (
    <div className="absolute top-4 left-4 z-10 w-72">
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <MapPin size={16} className="text-gray-400 group-focus-within:text-blue-500 transition-colors" />
        </div>
        <input
          ref={inputRef}
          type="text"
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-white shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
          placeholder="Search location..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
      </div>
    </div>
  );
}

