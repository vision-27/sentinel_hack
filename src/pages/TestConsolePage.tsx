import { useState, useEffect } from 'react';
import { useSentinelAgent } from '../hooks/useSentinelAgent';
import { TranscriptBlock } from '../types';
import { Button } from '../components/Button';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Send, BrainCircuit, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function TestConsolePage() {
  const [transcripts, setTranscripts] = useState<TranscriptBlock[]>([]);
  const [input, setInput] = useState('');
  const [callId, setCallId] = useState<string | null>(null);
  const [incidentData, setIncidentData] = useState<any>(null);

  // Use the hook with our local state
  const { isProcessing } = useSentinelAgent(transcripts, callId);

  // Initialize a test call record
  const initTestCall = async () => {
    const newCallId = `TEST-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    try {
      const { data, error } = await supabase
        .from('calls')
        .insert({
          call_id: newCallId,
          status: 'ai_handling',
          priority: 'medium',
          incident_type: 'Test Incident',
          location_text: 'Test Location',
          source_type: 'web_voice',
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      setCallId(data.id);
      console.log('Created test call:', data.id);
    } catch (err) {
      console.error('Failed to create test call:', err);
    }
  };

  useEffect(() => {
    initTestCall();
  }, []);

  // Poll for updates to the incident record to verify Sentinel actions
  useEffect(() => {
    if (!callId) return;

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('calls')
        .select('*')
        .eq('id', callId)
        .single();

      if (data) setIncidentData(data);
    }, 1000);

    return () => clearInterval(interval);
  }, [callId]);

  const handleSend = () => {
    if (!input.trim() || !callId) return;

    const newBlock: TranscriptBlock = {
      id: Math.random().toString(36).substring(7),
      call_id: callId,
      speaker: 'caller',
      text: input,
      timestamp_iso: new Date().toISOString(),
      is_highlighted: false,
      created_at: new Date().toISOString()
    };

    setTranscripts(prev => [...prev, newBlock]);
    setInput('');
  };

  const handleAgentResponse = () => {
    const newBlock: TranscriptBlock = {
      id: Math.random().toString(36).substring(7),
      call_id: callId || 'test',
      speaker: 'ai',
      text: "I understand. Can you tell me more about the location?",
      timestamp_iso: new Date().toISOString(),
      is_highlighted: false,
      created_at: new Date().toISOString()
    };
    setTranscripts(prev => [...prev, newBlock]);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex flex-col">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-gray-500 hover:text-gray-700">
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Sentinel Agent Test Console</h1>
        </div>
        <div className="flex items-center gap-3">
          {isProcessing ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
              <BrainCircuit size={16} className="animate-spin" />
              Sentinel Analyzing...
            </div>
          ) : (
            <div className="text-gray-500 text-sm">Sentinel Idle</div>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
        {/* Chat Interface */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden h-[600px]">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 font-medium text-gray-700">
            Simulated Transcript
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {transcripts.length === 0 && (
              <div className="text-center text-gray-400 mt-20">
                Start typing to simulate a caller...
              </div>
            )}
            {transcripts.map((t, i) => (
              <div key={i} className={`p-3 rounded-lg max-w-[80%] ${t.speaker === 'caller' ? 'bg-green-50 ml-auto border-l-4 border-green-500' : 'bg-blue-50 mr-auto border-l-4 border-blue-500'}`}>
                <div className="text-xs text-gray-500 mb-1 font-semibold uppercase">{t.speaker}</div>
                {t.text}
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-gray-100 bg-gray-50">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Type caller message..."
                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Button onClick={handleSend} disabled={!input.trim()}>
                <Send size={18} />
              </Button>
            </div>
            <div className="mt-2 flex justify-end">
              <button onClick={handleAgentResponse} className="text-xs text-blue-600 hover:underline">
                + Add Agent Response
              </button>
            </div>
          </div>
        </div>

        {/* Live Data View */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden h-[600px]">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 font-medium text-gray-700 flex justify-between">
            <span>Live Incident Record</span>
            <span className="text-xs text-gray-400 font-mono">{callId}</span>
          </div>
          <div className="p-6 overflow-y-auto">
            {incidentData ? (
              <div className="space-y-4">
                <DataRow label="Incident Type" value={incidentData.incident_type} />
                <DataRow label="Location" value={incidentData.location_text} />
                <DataRow label="Caller Name" value={incidentData.caller_name || 'N/A'} />
                <DataRow label="Phone" value={incidentData.caller_phone || 'N/A'} />
                <DataRow label="Priority" value={incidentData.priority} />
                <DataRow label="Medical Emergency" value={incidentData.medical_emergency ? 'YES' : 'No'} />
                <DataRow label="Weapons" value={incidentData.weapons_present} />
                <DataRow label="Victims" value={incidentData.number_of_victims} />
                <DataRow label="Impact" value={incidentData.impact_category} />
                <div className="mt-4">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Notes</span>
                  <div className="mt-1 p-3 bg-gray-50 rounded text-sm text-gray-700 min-h-[60px]">
                    {incidentData.notes || 'No notes extracted yet.'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <AlertCircle size={32} className="mb-2 opacity-50" />
                <p>Waiting for call data...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DataRow({ label, value }: { label: string, value: any }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm font-medium text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-gray-900">{value?.toString()}</span>
    </div>
  );
}

