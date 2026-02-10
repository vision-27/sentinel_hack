import { CallWithContext } from '../types';
import { Card, CardHeader, CardTitle, CardContent } from './Card';
import { Badge, MapView } from './index';
import { MapPin, Activity, Zap, Clock, Send, Shield, Flame, Heart } from 'lucide-react';
import { getElapsedTime, getSeverityColor, confidenceColor, formatConfidence } from '../lib/utils';
import LiveTranscript from './LiveTranscript';
import ActionBar from './ActionBar';

interface CallDetailProps {
  call: CallWithContext;
}

export default function CallDetail({ call }: CallDetailProps) {
  // Get dispatched services from actions
  const dispatchActions = call.actions?.filter((action) => action.action_type === 'dispatch') || [];
  const dispatchedServices: string[] = [];

  dispatchActions.forEach((action) => {
    const dispatchTypes = (action.action_data as any)?.dispatch_types || [];
    dispatchedServices.push(...dispatchTypes);
  });

  const getDispatchIcon = (type: string) => {
    switch (type) {
      case 'fire':
        return <Flame size={16} className="text-red-600" />;
      case 'police':
        return <Shield size={16} className="text-blue-600" />;
      case 'ems':
        return <Heart size={16} className="text-green-600" />;
      default:
        return <Send size={16} className="text-gray-600" />;
    }
  };

  const getDispatchLabel = (type: string) => {
    switch (type) {
      case 'fire':
        return 'Fire Department';
      case 'police':
        return 'Police';
      case 'ems':
        return 'EMS / Ambulance';
      default:
        return type;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 h-full">
      <div className="lg:col-span-2 flex flex-col gap-4 overflow-y-auto">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle level="h2">Critical Snapshot</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-600 uppercase tracking-wider mb-1">Incident Type</p>
                  <p className="text-lg font-bold text-gray-900">{call.incident_type || 'Unknown'}</p>
                </div>

                <div>
                  <p className="text-xs text-gray-600 uppercase tracking-wider mb-1">Severity</p>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${getSeverityColor(call.severity_score)}`}
                        style={{ width: `${call.severity_score}%` }}
                      />
                    </div>
                    <span className="text-lg font-bold">{call.severity_score}</span>
                  </div>
                </div>

                <div className="col-span-2">
                  <p className="text-xs text-gray-600 uppercase tracking-wider mb-1">Location</p>
                  <div className="flex items-start gap-2">
                    <MapPin size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">{call.location_text || 'Not provided'}</p>
                      {call.location_lat && call.location_lon && (
                        <p className="text-xs text-gray-500">
                          {call.location_lat.toFixed(4)}, {call.location_lon.toFixed(4)}
                        </p>
                      )}
                      {call.location_accuracy && (
                        <p className="text-xs text-gray-500 capitalize">{call.location_accuracy}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-gray-600 uppercase tracking-wider mb-1">Victims</p>
                  <p className="text-lg font-bold text-gray-900">{call.number_of_victims || 0}</p>
                </div>

                <div>
                  <p className="text-xs text-gray-600 uppercase tracking-wider mb-1">Weapons</p>
                  <Badge variant={call.weapons_present === 'yes' ? 'danger' : call.weapons_present === 'unknown' ? 'warning' : 'success'} size="sm">
                    {call.weapons_present?.toUpperCase() || 'UNKNOWN'}
                  </Badge>
                </div>

                <div className="col-span-2">
                  <p className="text-xs text-gray-600 uppercase tracking-wider mb-1">Call Duration</p>
                  <p className="text-base font-semibold text-gray-900">
                    {getElapsedTime(call.started_at || call.created_at, call.closed_at)}
                  </p>
                </div>

              </div>
            </CardContent>
          </Card>

          {dispatchedServices.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle level="h3" className="flex items-center gap-2">
                  <Send size={20} className="text-blue-600" />
                  Dispatched Services
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-3">
                    {Array.from(new Set(dispatchedServices)).map((service) => (
                      <Badge key={service} variant="info" size="lg" className="flex items-center gap-2 px-4 py-2 text-base">
                        {getDispatchIcon(service)}
                        <span className="font-bold">{getDispatchLabel(service)}</span>
                      </Badge>
                    ))}
                  </div>
                  <p className="text-sm text-gray-600 mt-3">
                    <span className="font-semibold">Location:</span> {call.location_text || 'Not specified'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-3 gap-3">
            <Card padding="md">
              <div className="text-center">
                <Activity className="text-blue-600 mx-auto mb-2" size={24} />
                <p className="text-xs text-gray-600 mb-1">Status</p>
                <p className="text-sm font-bold text-gray-900 capitalize">{call.status.replace('_', ' ')}</p>
              </div>
            </Card>

            <Card padding="md">
              <div className="text-center">
                <Zap className="text-yellow-600 mx-auto mb-2" size={24} />
                <p className="text-xs text-gray-600 mb-1">AI Confidence</p>
                <p className={`text-sm font-bold ${confidenceColor(call.ai_confidence_avg)}`}>
                  {formatConfidence(call.ai_confidence_avg)}
                </p>
              </div>
            </Card>

            <Card padding="md">
              <div className="text-center">
                <Clock className="text-green-600 mx-auto mb-2" size={24} />
                <p className="text-xs text-gray-600 mb-1">Started</p>
                <p className="text-xs font-bold text-gray-900">
                  {getElapsedTime(call.started_at, call.closed_at)}
                </p>
              </div>
            </Card>
          </div>
        </div>

        <MapView call={call} height="350px" />
      </div>

      <div className="lg:col-span-1 flex flex-col gap-4 overflow-y-auto">
        <LiveTranscript call={call} />
      </div>

      <div className="lg:col-span-3">
        <ActionBar call={call} />
      </div>
    </div>
  );
}
