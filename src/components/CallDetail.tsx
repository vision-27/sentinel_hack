import { CallWithContext } from '../types';
import { Card, CardHeader, CardTitle, CardContent } from './Card';
import { Badge, MapView } from './index';
import { MapPin, Activity, Zap, Send, Shield, Flame, Heart } from 'lucide-react';
import { getSeverityColor, confidenceColor, formatConfidence } from '../lib/utils';
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
                  <p className="text-xs text-gray-600 uppercase tracking-wider mb-1">Caller</p>
                  <p className="text-lg font-bold text-gray-900">{call.caller_name || 'Anonymous'}</p>
                  {call.caller_phone && <p className="text-xs text-gray-500">{call.caller_phone}</p>}
                </div>

                <div>
                  <p className="text-xs text-gray-600 uppercase tracking-wider mb-1">Incident Type</p>
                  <p className="text-lg font-bold text-gray-900">{call.incident_type || 'Unknown'}</p>
                </div>

                <div>
                  <p className="text-xs text-gray-600 uppercase tracking-wider mb-1">Location</p>
                  <div className="flex items-start gap-2">
                    <MapPin size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900 line-clamp-2">{call.location_text || 'Not provided'}</p>
                      {call.location_lat && call.location_lon && (
                        <p className="text-xs text-gray-500">
                          {call.location_lat.toFixed(4)}, {call.location_lon.toFixed(4)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-gray-600 uppercase tracking-wider mb-1">Severity / Priority</p>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${getSeverityColor(call.severity_score)}`}
                        style={{ width: `${call.severity_score || 50}%` }}
                      />
                    </div>
                    <span className="text-lg font-bold capitalize">{call.priority || 'Medium'}</span>
                  </div>
                </div>

                <div className="col-span-2">
                  <p className="text-xs text-gray-600 uppercase tracking-wider mb-1">AI Summary</p>
                  <p className="text-base font-medium text-gray-800 italic leading-relaxed">
                    {call.notes || call.summary || 'Summary generating...'}
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

          <div className="grid grid-cols-2 gap-3">
            <Card padding="sm">
              <div className="flex items-center gap-2">
                <Activity className="text-blue-600 flex-shrink-0" size={16} />
                <span className="text-xs text-gray-500">Status</span>
                <span className="text-sm font-bold text-gray-900 capitalize ml-auto">{call.status.replace('_', ' ')}</span>
              </div>
            </Card>

            <Card padding="sm">
              <div className="flex items-center gap-2">
                <Zap className="text-yellow-600 flex-shrink-0" size={16} />
                <span className="text-xs text-gray-500">AI Confidence</span>
                <span className={`text-sm font-bold ml-auto ${confidenceColor(call.ai_confidence_avg)}`}>
                  {formatConfidence(call.ai_confidence_avg)}
                </span>
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
