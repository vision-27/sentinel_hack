import { useConversation } from '@11labs/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useCall } from '../contexts/CallContext';
import { TranscriptBlock } from '../types';

export function useElevenLabsAgent() {
  const [transcripts, setTranscripts] = useState<TranscriptBlock[]>([]);
  const { addTranscriptBlock } = useCall();
  const currentCallIdRef = useRef<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const creatingCallRef = useRef(false);
  const [callId, setCallId] = useState<string | null>(null);
  const transcriptsRef = useRef<TranscriptBlock[]>([]);

  useEffect(() => {
    transcriptsRef.current = transcripts;
  }, [transcripts]);

  const createSkeletonCall = useCallback(async (incidentId?: string) => {
    if (currentCallIdRef.current || creatingCallRef.current) return;

    try {
      creatingCallRef.current = true;
      console.log('[createSkeletonCall] Creating initial call record...');
      const newCallId = incidentId || `CALL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      if (incidentId) {
        const { data: existingCall, error: existingError } = await supabase
          .from('calls')
          .select('*')
          .eq('call_id', incidentId)
          .maybeSingle();

        if (existingError) throw existingError;

        if (existingCall) {
          currentCallIdRef.current = existingCall.id;
          setCallId(existingCall.id);
          console.log('[createSkeletonCall] Using existing call record:', existingCall.id);

          const existingTranscripts = transcriptsRef.current;
          if (existingTranscripts.length > 0) {
            const blocksToInsert = existingTranscripts.map((t) => ({
              call_id: existingCall.id,
              speaker: t.speaker,
              text: t.text,
              timestamp_iso: t.timestamp_iso,
            }));

            await supabase.from('transcript_blocks').insert(blocksToInsert);
          }
          return;
        }
      }

      const { data, error } = await supabase
        .from('calls')
        .insert({
          call_id: newCallId,
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

      currentCallIdRef.current = data.id;
      setCallId(data.id);
      console.log('[createSkeletonCall] Created initial record:', data.id);

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
    } finally {
      creatingCallRef.current = false;
    }
  }, []);

  const appendTranscript = useCallback(
    async (speaker: 'caller' | 'ai', text: string) => {
      if (!text) return;
      if (speaker === 'caller' && !currentCallIdRef.current) {
        await createSkeletonCall(conversationIdRef.current || undefined);
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
    },
    [addTranscriptBlock, createSkeletonCall]
  );

  const conversation = useConversation({
    onConnect: () => {
      console.log('[ElevenLabs] connected');
    },
    onDisconnect: () => {
      console.log('[ElevenLabs] disconnected');
    },
    onError: (error: unknown) => {
      console.error('[ElevenLabs] error:', error);
    },
    onMessage: async (message: any) => {
      let text = '';
      let speaker: 'caller' | 'ai' | null = null;
      let isFinal = true;

      if (message?.type === 'user_transcript') {
        speaker = 'caller';
        text =
          message?.text ||
          message?.user_transcription_event?.user_transcript ||
          message?.transcript ||
          '';
        isFinal = message?.is_final ?? message?.final ?? true;
      } else if (message?.type === 'agent_response') {
        speaker = 'ai';
        text =
          message?.text ||
          message?.agent_response_event?.agent_response ||
          message?.response ||
          '';
        isFinal = message?.is_final ?? message?.final ?? true;
      } else if (message?.source && message?.message) {
        speaker = message.source === 'user' ? 'caller' : 'ai';
        text = message.message;
      }

      if (!speaker || !text || !isFinal) return;

      if (speaker === 'caller') {
        console.log('[ElevenLabs] caller:', text);
      } else {
        console.log('[ElevenLabs] agent:', text);
      }
      await appendTranscript(speaker, text);
    },
  });

  const startAgent = useCallback(async () => {
    try {
      const agentId = import.meta.env.VITE_ELEVENLABS_AGENT_ID;
      if (!agentId) {
        throw new Error('VITE_ELEVENLABS_AGENT_ID is not defined');
      }

      const conversationId = await (conversation as any).startSession({
        agentId,
      });
      conversationIdRef.current = conversationId;
      await createSkeletonCall(conversationId);
    } catch (err) {
      console.error('Failed to start conversation:', err);
      throw err;
    }
  }, [conversation]);

  const stopAgent = useCallback(async () => {
    await conversation.endSession();
    currentCallIdRef.current = null;
    conversationIdRef.current = null;
    setCallId(null);
    setTranscripts([]);
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
