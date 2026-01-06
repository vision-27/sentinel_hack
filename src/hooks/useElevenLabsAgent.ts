import { useConversation } from '@11labs/react';
import { useCallback, useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useCall } from '../contexts/CallContext';
import { TranscriptBlock } from '../types';

export function useElevenLabsAgent() {
  const [transcripts, setTranscripts] = useState<TranscriptBlock[]>([]);
  const { addTranscriptBlock } = useCall();
  const currentCallIdRef = useRef<string | null>(null);
  const [callId, setCallId] = useState<string | null>(null); // Expose for other hooks
  const transcriptsRef = useRef<TranscriptBlock[]>([]);

  // Keep ref in sync with state for access inside callbacks
  useEffect(() => {
    transcriptsRef.current = transcripts;
  }, [transcripts]);

  // Create a skeleton call record immediately when the conversation starts
  const createSkeletonCall = useCallback(async () => {
    if (currentCallIdRef.current) return;

    try {
      console.log('[createSkeletonCall] Creating initial call record...');
      const newCallId = `CALL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      const { data, error } = await supabase
        .from('calls')
        .insert({
          call_id: newCallId,
          status: 'ai_handling',
          priority: 'medium',
          incident_type: 'Incoming Call...',
          location_text: 'Identifying...',
          source_type: 'web_voice',
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      
      currentCallIdRef.current = data.id;
      setCallId(data.id);
      console.log('[createSkeletonCall] Created initial record:', data.id);

      // Backfill any transcripts that happened before this
      const existingTranscripts = transcriptsRef.current;
      if (existingTranscripts.length > 0) {
        const blocksToInsert = existingTranscripts.map(t => ({
          call_id: data.id,
          speaker: t.speaker,
          text: t.text,
          timestamp_iso: t.timestamp_iso
        }));
        
        await supabase.from('transcript_blocks').insert(blocksToInsert);
      }
    } catch (err) {
      console.error('[createSkeletonCall] Error:', err);
    }
  }, []);

  const conversation = useConversation({
    onMessage: async (message: any) => {
      // console.log('Message:', message);
      let text = '';
      let speaker: 'caller' | 'ai' | null = null;

      // Handle various message formats
      if (message.source && message.message) {
        // Simplified format
        speaker = message.source === 'user' ? 'caller' : 'ai';
        text = message.message;
      } else if (message.type === 'user_transcription') {
        speaker = 'caller';
        text = message.user_transcription_event?.user_transcript || '';
      } else if (message.type === 'agent_response') {
        speaker = 'ai';
        text = message.agent_response_event?.agent_response || '';
      }

      if (text && speaker) {
        // If this is the first user message, ensure we have a call record
        if (speaker === 'caller' && !currentCallIdRef.current) {
          await createSkeletonCall();
        }

        const block: TranscriptBlock = {
          id: Math.random().toString(36).substring(7),
          call_id: currentCallIdRef.current || 'live-session',
          speaker,
          text,
          timestamp_iso: new Date().toISOString(),
          is_highlighted: false,
          created_at: new Date().toISOString()
        };
        setTranscripts(prev => [...prev, block]);

        // If we have an active call ID, save to Supabase immediately
        if (currentCallIdRef.current) {
          try {
            await supabase.from('transcript_blocks').insert({
              call_id: currentCallIdRef.current,
              speaker: block.speaker,
              text: block.text,
              timestamp_iso: block.timestamp_iso
            });
          } catch (err) {
            console.error('Failed to save transcript block:', err);
          }
        }
      }
    }
  });

  const startAgent = useCallback(async () => {
    try {
      const agentId = import.meta.env.VITE_ELEVENLABS_AGENT_ID;
      if (!agentId) {
        throw new Error('VITE_ELEVENLABS_AGENT_ID is not defined');
      }

      await conversation.startSession({
        agentId,
        // clientTools removed - Sentinel Agent handles this now
      });
    } catch (err) {
      console.error('Failed to start conversation:', err);
      throw err;
    }
  }, [conversation]);

  const stopAgent = useCallback(async () => {
    await conversation.endSession();
    // Reset call ID when session ends so new calls start fresh
    currentCallIdRef.current = null;
    setCallId(null);
    setTranscripts([]); // Clear transcripts on stop
  }, [conversation]);

  return {
    status: conversation.status,
    isSpeaking: conversation.isSpeaking,
    startAgent,
    stopAgent,
    conversation,
    transcripts,
    callId // Expose callId for Sentinel Agent
  };
}
