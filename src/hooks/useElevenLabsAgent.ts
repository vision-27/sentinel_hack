import { useConversation } from '@11labs/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useCall } from '../contexts/CallContext';
import { TranscriptBlock } from '../types';

export function useElevenLabsAgent() {
  const [transcripts, setTranscripts] = useState<TranscriptBlock[]>([]);
  const { addTranscriptBlock, updateCall } = useCall();
  const currentCallIdRef = useRef<string | null>(null);
  const [callId, setCallId] = useState<string | null>(null);
  const transcriptsRef = useRef<TranscriptBlock[]>([]);
  const conversationIdRef = useRef<string | null>(null);

  useEffect(() => {
    transcriptsRef.current = transcripts;
  }, [transcripts]);

  const createSkeletonCall = useCallback(async () => {
    if (currentCallIdRef.current) return;
    const elevenLabsCallId = conversationIdRef.current;
    if (!elevenLabsCallId) {
      console.warn('[createSkeletonCall] No conversation ID yet, using fallback');
    }

    try {
      console.log('[createSkeletonCall] Creating/finding call record for:', elevenLabsCallId || 'fallback');

      // Use ElevenLabs conversation ID so transcripts and webhooks (location, etc.) land on the same call
      const callIdToUse = elevenLabsCallId || `CALL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      const { data: existing } = await supabase
        .from('calls')
        .select('id')
        .eq('call_id', callIdToUse)
        .maybeSingle();

      let data: { id: string };
      if (existing) {
        data = existing;
        console.log('[createSkeletonCall] Found existing call from webhook:', data.id);
      } else {
        const { data: inserted, error } = await supabase
          .from('calls')
          .insert({
            call_id: callIdToUse,
            status: 'ai_handling',
            priority: 'medium',
            incident_type: 'Incoming Call...',
            location_text: 'Identifying...',
            source_type: 'web_voice',
            started_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) throw error;
        data = inserted;
        console.log('[createSkeletonCall] Created initial record:', data.id);
      }

      currentCallIdRef.current = data.id;
      setCallId(data.id);

      const existingTranscripts = transcriptsRef.current;
      if (existingTranscripts.length > 0) {
        const blocksToInsert = existingTranscripts.map((t) => ({
          call_id: data.id,
          speaker: t.speaker,
          text: t.text,
          timestamp_iso: t.timestamp_iso,
        }));

        await supabase.from('transcript_blocks').insert(blocksToInsert);
      }
    } catch (err) {
      console.error('[createSkeletonCall] Error:', err);
    }
  }, []);

  const conversation = useConversation({
    onMessage: async (message: any) => {
      let text = '';
      let speaker: 'caller' | 'ai' | null = null;

      if (message.source && message.message) {
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
          created_at: new Date().toISOString(),
        };

        setTranscripts((prev) => [...prev, block]);
        addTranscriptBlock(block);

        if (currentCallIdRef.current) {
          try {
            await supabase.from('transcript_blocks').insert({
              call_id: currentCallIdRef.current,
              speaker: block.speaker,
              text: block.text,
              timestamp_iso: block.timestamp_iso,
            });
          } catch (err) {
            console.error('Failed to save transcript block:', err);
          }
        }
      }
    },
  });

  const startAgent = useCallback(async () => {
    try {
      // Clear previous call state when starting a new one
      setTranscripts([]);
      setCallId(null);
      currentCallIdRef.current = null;
      conversationIdRef.current = null;

      const agentId = import.meta.env.VITE_ELEVENLABS_AGENT_ID;
      if (!agentId) {
        throw new Error('VITE_ELEVENLABS_AGENT_ID is not defined');
      }

      // EXTERNAL API CALL: ElevenLabs (Voice AI Session)
      const conversationId = await conversation.startSession({
        agentId,
        connectionType: 'websocket',
      });
      conversationIdRef.current = typeof conversationId === 'string' ? conversationId : String(conversationId ?? '');
      if (conversationIdRef.current) {
        console.log('[startAgent] ElevenLabs conversation ID (used as call_id for webhooks):', conversationIdRef.current);
        // Create the skeleton call immediately so we have an ID for transcripts and duration tracking
        await createSkeletonCall();
      }
    } catch (err) {
      console.error('Failed to start conversation:', err);
      throw err;
    }
  }, [conversation, createSkeletonCall]);

  const stopAgent = useCallback(async () => {
    await conversation.endSession();

    if (currentCallIdRef.current) {
      try {
        await supabase
          .from('calls')
          .update({
            status: 'closed',
            closed_at: new Date().toISOString(),
          })
          .eq('id', currentCallIdRef.current);

        // Update local context state so the UI reflects the change immediately
        updateCall({
          status: 'closed',
          closed_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Failed to update call status:', err);
      }
    }

    // We no longer clear callId and transcripts here
    // to allow the Sentinel (Gemini) to process the final transcript.
    // They will be cleared when the next call starts.
    currentCallIdRef.current = null;
    conversationIdRef.current = null;
  }, [conversation]);

  return {
    status: conversation.status,
    isSpeaking: conversation.isSpeaking,
    startAgent,
    stopAgent,
    conversation,
    transcripts,
    callId,
  };
}
