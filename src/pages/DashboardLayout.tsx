import { useState, useEffect, useRef } from 'react';
import { Phone, AlertCircle, Menu, X } from 'lucide-react';
import { useCall } from '../contexts/CallContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logExternalCall } from '../lib/logger';
import { Call, CallWithContext, CallAction } from '../types';
import { Button, Badge } from '../components';
import { VoiceAgentButton } from '../components/VoiceAgentButton';
import { getStatusBadge } from '../lib/utils';
import CallList from '../components/CallList';
import CallDetail from '../components/CallDetail';

export default function DashboardLayout() {
  const { activeCall, setActiveCall, calls, setCalls, isLoading, setIsLoading, addTranscriptBlock } = useCall();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userSelectedCall, setUserSelectedCall] = useState(false);
  const activeCallRef = useRef(activeCall);
  const userSelectedCallRef = useRef(userSelectedCall);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setError('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file');
      return;
    }
    loadCalls(false);
    const cleanup1 = subscribeToCallUpdates();
    const cleanup2 = subscribeToCallActionsUpdates();
    const pollId = window.setInterval(() => loadCalls(false), 1000);
    return () => {
      cleanup1();
      cleanup2();
      window.clearInterval(pollId);
    };
  }, []);

  // Keep ref in sync with activeCall
  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  // Keep ref in sync with userSelectedCall
  useEffect(() => {
    userSelectedCallRef.current = userSelectedCall;
  }, [userSelectedCall]);

  // Subscribe to call_actions updates for the active call
  useEffect(() => {
    if (!activeCall) return;

    const callId = activeCall.id;
    const subscription = supabase
      .channel(`call-actions-${callId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_actions',
          filter: `call_id=eq.${callId}`,
        },
        (payload) => {
          const newAction = payload.new as CallAction;
          // Use functional update to avoid stale closures
          setActiveCall((prev: CallWithContext | null) => {
            if (!prev || prev.id !== callId) return prev;
            // Check if action already exists to avoid duplicates
            const actionExists = prev.actions?.some((a: CallAction) => a.id === newAction.id);
            if (actionExists) return prev;
            // Update the call with the new action
            return {
              ...prev,
              actions: [...(prev.actions || []), newAction],
            };
          });
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [activeCall?.id, setActiveCall]);

  const fetchActiveCallTranscripts = async (callId: string) => {
    try {
      logExternalCall('Supabase', 'select', 'transcript_blocks (refresh)', { call_id: callId });
      const { data: transcripts } = await supabase
        .from('transcript_blocks')
        .select('*')
        .eq('call_id', callId)
        .order('created_at', { ascending: true });

      if (transcripts) {
        setActiveCall((prev: CallWithContext | null) => {
          if (!prev || prev.id !== callId) return prev;
          return { ...prev, transcripts };
        });
      }
    } catch (err) {
      console.error('[Dashboard] Failed to refresh transcripts:', err);
    }
  };

  const loadCalls = async (showLoading = false) => {
    if (showLoading) {
      setIsLoading(true);
    }
    try {
      logExternalCall('Supabase', 'select', 'calls', { status: ['ai_handling', 'human_active', 'closed'] });
      const { data, error } = await supabase
        .from('calls')
        .select('*')
        .in('status', ['ai_handling', 'human_active', 'closed'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch mark_safe actions for all calls
      const callIds = (data || []).map(call => call.id);
      if (callIds.length > 0) {
        logExternalCall('Supabase', 'select', 'call_actions (mark_safe)', { callIds });
        const { data: actionsData } = await supabase
          .from('call_actions')
          .select('call_id, action_type')
          .in('call_id', callIds)
          .eq('action_type', 'mark_safe');

        // Create a map of call_id -> has mark_safe action
        const markSafeMap = new Map<string, boolean>();
        (actionsData || []).forEach(action => {
          markSafeMap.set(action.call_id, true);
        });

        // Add mark_safe flag to calls
        const callsWithMarkSafe = (data || []).map(call => ({
          ...call,
          hasMarkSafeAction: markSafeMap.has(call.id),
        }));

        setCalls(callsWithMarkSafe);

        // SYNC: Update activeCall with any basic field changes from the poller
        setActiveCall((prev: CallWithContext | null) => {
          if (!prev) return prev;
          const updated = callsWithMarkSafe.find(c => c.id === prev.id);
          if (updated) {
            // Only update if something actually changed to avoid unnecessary re-renders
            if (updated.updated_at !== prev.updated_at || updated.status !== prev.status) {
              // Trigger transcript refresh if call data changed
              fetchActiveCallTranscripts(prev.id);
              return { ...prev, ...updated };
            }
          }
          return prev;
        });

        if (!userSelectedCallRef.current && callsWithMarkSafe.length > 0) {
          const newestCall = callsWithMarkSafe[0];
          // Use ref check to avoid loop
          if (activeCallRef.current?.id !== newestCall.id) {
            handleSelectCall(newestCall, false);
          }
        }
      } else {
        setCalls([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load calls');
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  };

  const subscribeToCallUpdates = () => {
    const subscription = supabase
      .channel('calls-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calls',
        },
        async (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updatedCall = payload.new as Call;
            // Preserve hasMarkSafeAction flag if it exists
            setCalls((prevCalls: Call[]) =>
              prevCalls.map((call: Call) => {
                if (call.id === updatedCall.id) {
                  return { ...updatedCall, hasMarkSafeAction: call.hasMarkSafeAction };
                }
                return call;
              })
            );

            setActiveCall((prev) => {
              if (prev?.id === updatedCall.id) {
                // Trigger transcript refresh on real-time update
                fetchActiveCallTranscripts(updatedCall.id);
                return { ...prev, ...updatedCall };
              }
              return prev;
            });
          } else if (payload.eventType === 'INSERT') {
            const newCall = payload.new as Call;
            // Check if this new call has a mark_safe action
            logExternalCall('Supabase', 'select', 'call_actions (new call check)', { call_id: newCall.id });
            const { data: actionsData } = await supabase
              .from('call_actions')
              .select('call_id')
              .eq('call_id', newCall.id)
              .eq('action_type', 'mark_safe')
              .limit(1);

            const callWithMarkSafe = {
              ...newCall,
              hasMarkSafeAction: (actionsData || []).length > 0,
            };
            setCalls((prevCalls: Call[]) => [callWithMarkSafe, ...prevCalls]);
            if (!userSelectedCallRef.current && activeCallRef.current?.id !== callWithMarkSafe.id) {
              handleSelectCall(callWithMarkSafe, false);
            }
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const subscribeToCallActionsUpdates = () => {
    const subscription = supabase
      .channel('call-actions-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_actions',
          filter: 'action_type=eq.mark_safe',
        },
        async (payload) => {
          const newAction = payload.new as CallAction;
          // Update the calls list to mark this call as safe
          setCalls((prevCalls: Call[]) =>
            prevCalls.map((call: Call) =>
              call.id === newAction.call_id
                ? { ...call, hasMarkSafeAction: true }
                : call
            )
          );
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  // Subscribe to extracted_fields updates
  useEffect(() => {
    if (!activeCall) return;

    const callId = activeCall.id;
    const subscription = supabase
      .channel(`extracted-fields-${callId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'extracted_fields',
          filter: `call_id=eq.${callId}`,
        },
        async (payload) => {
          console.log('[Dashboard] Extracted field change detected:', payload);
          const changedField = payload.new as any;

          // Update the active call state with the new extracted field
          setActiveCall((prev: CallWithContext | null) => {
            if (!prev || prev.id !== callId) return prev;

            // Map field_name to call properties if applicable
            const updatedCall = { ...prev };
            const fieldName = changedField.field_name;
            const fieldValue = changedField.field_value;

            // Update main call properties if they match extracted fields
            if (fieldName === 'caller_name') updatedCall.caller_name = fieldValue;
            if (fieldName === 'caller_phone') updatedCall.caller_phone = fieldValue;
            if (fieldName === 'incident_type') updatedCall.incident_type = fieldValue;
            if (fieldName === 'location_text') updatedCall.location_text = fieldValue;
            if (fieldName === 'priority') updatedCall.priority = fieldValue as any;
            if (fieldName === 'impact_category') updatedCall.impact_category = fieldValue as any;
            if (fieldName === 'notes' || fieldName === 'summary') updatedCall.notes = fieldValue;
            if (fieldName === 'severity_score') updatedCall.severity_score = Number(fieldValue);
            if (fieldName === 'ai_confidence_avg') updatedCall.ai_confidence_avg = Number(fieldValue);

            // Also update the extracted_fields array
            const existingFieldIndex = updatedCall.extracted_fields?.findIndex(f => f.field_name === fieldName);
            if (existingFieldIndex !== undefined && existingFieldIndex !== -1) {
              const newExtractedFields = [...(updatedCall.extracted_fields || [])];
              newExtractedFields[existingFieldIndex] = changedField;
              updatedCall.extracted_fields = newExtractedFields;
            } else {
              updatedCall.extracted_fields = [...(updatedCall.extracted_fields || []), changedField];
            }

            return updatedCall;
          });
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [activeCall?.id, setActiveCall]);

  // Subscribe to transcript_blocks updates
  useEffect(() => {
    if (!activeCall) return;

    const callId = activeCall.id;
    const subscription = supabase
      .channel(`transcript-blocks-${callId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transcript_blocks',
          filter: `call_id=eq.${callId}`,
        },
        (payload) => {
          console.log('[Dashboard] New transcript block detected:', payload);
          addTranscriptBlock(payload.new as any);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [activeCall?.id, addTranscriptBlock]);

  const handleSelectCall = async (call: Call, showLoading = true, isUserAction = false) => {
    if (isUserAction) {
      setUserSelectedCall(true);
      userSelectedCallRef.current = true;
    }
    if (showLoading) {
      setIsLoading(true);
    }
    try {
      logExternalCall('Supabase', 'select', 'transcript_blocks', { call_id: call.id });
      const { data: transcripts } = await supabase
        .from('transcript_blocks')
        .select('*')
        .eq('call_id', call.id)
        .order('created_at', { ascending: true });

      logExternalCall('Supabase', 'select', 'extracted_fields', { call_id: call.id });
      const { data: fields } = await supabase
        .from('extracted_fields')
        .select('*')
        .eq('call_id', call.id);

      logExternalCall('Supabase', 'select', 'call_actions', { call_id: call.id });
      const { data: actions } = await supabase
        .from('call_actions')
        .select('*')
        .eq('call_id', call.id);

      const hasMarkSafe = actions?.some(action => action.action_type === 'mark_safe') || false;

      setActiveCall({
        ...call,
        transcripts: transcripts || [],
        extracted_fields: fields || [],
        actions: actions || [],
        hasMarkSafeAction: hasMarkSafe,
      } as CallWithContext);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load call details');
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            <div className="flex items-center gap-3">
              <Phone className="text-blue-600" size={28} />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Emergency Response</h1>
                <p className="text-sm text-gray-500">Real-time Call Dashboard</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <VoiceAgentButton />

            {activeCall && (
              <div className="hidden md:flex items-center gap-6 border-l border-gray-200 pl-6">
                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-900">{activeCall.caller_name || 'Anonymous Caller'}</div>
                  <div className="text-xs text-gray-500">Call ID: {activeCall.call_id}</div>
                </div>

                <Badge variant={getStatusBadge(activeCall.status).color.includes('blue') ? 'info' : 'default'}>
                  {getStatusBadge(activeCall.status).label}
                </Badge>

                <div className="flex gap-2">
                  <Button variant="secondary" size="sm">
                    Take Over
                  </Button>
                  <Button variant="danger" size="sm">
                    <AlertCircle size={16} /> Dispatch
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside
          className={`${sidebarOpen ? 'w-80' : 'w-0'
            } bg-white border-r border-gray-200 overflow-y-auto transition-all duration-300 lg:w-80`}
        >
          <CallList calls={calls} activeCall={activeCall} onSelectCall={(call) => handleSelectCall(call, true, true)} isLoading={isLoading} />
        </aside>

        <main className="flex-1 overflow-y-auto">
          {error && (
            <div className="m-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5" size={20} />
                <div>
                  <h3 className="font-semibold mb-1">Configuration Error</h3>
                  <p>{error}</p>
                  <p className="mt-2 text-sm">
                    Create a <code className="bg-red-100 px-1 rounded">.env</code> file in the project root with:
                  </p>
                  <pre className="mt-2 bg-red-100 p-2 rounded text-xs overflow-x-auto">
                    {`VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key`}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {activeCall ? (
            <CallDetail call={activeCall} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Phone size={48} className="mx-auto text-gray-300 mb-4" />
                <h2 className="text-xl font-semibold text-gray-900 mb-2">No Call Selected</h2>
                <p className="text-gray-600">
                  {calls.length === 0 ? 'No active calls' : 'Select a call from the list to begin'}
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
