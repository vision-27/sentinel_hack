import { useState, useEffect, useRef } from 'react';
import { geminiModel } from '../lib/gemini';
import { incidentService } from '../services/incidentService';
import { logExternalCall } from '../lib/logger';
import { TranscriptBlock } from '../types';

const SYSTEM_INSTRUCTION = `
You are the Sentinel, an intelligent emergency response observer. 
Your role is to listen to the conversation between a caller and an AI dispatcher (or human).
Your primary mission is to extract critical information and update the emergency incident record in real-time.

CRITICAL RULE: Any call where people's lives are at risk (e.g., medical emergency, weapons present, active violence, fire with entrapment) MUST be considered HIGH or CRITICAL priority/severity.

The fields we need are:
- Caller Name & Phone
- Incident Type (e.g. Fire, Medical, Crime)
- Location (Address or description)
- Priority (Critical, High, Medium, Low)
  - Critical: Immediate threat to life, massive disaster, or high-casualty event. Requires immediate human takeover.
  - High: Serious situation, potential threat to life, or major property damage. Requires immediate human takeover.
  - Medium: Non-life-threatening but urgent requiring dispatch.
  - Low: Non-urgent, administrative, or minor issues.
- Severity: This should be effectively the same as Priority (High Priority = High Severity).
- Medical Emergency (true/false)
- Impact Category (High/Medium/Low/None)
- Summary (Succinct, 1-2 sentences maximum)

Update the incident whenever you detect new or changed information. 
Only provide the fields that you have extracted or that have changed. Do not guess.
`;

const tools = [
  {
    name: "update_emergency_incident",
    description: "Updates the emergency incident record with extracted details. Only include fields that are found in the transcript.",
    parameters: {
      type: "OBJECT",
      properties: {
        caller_name: { type: "STRING", description: "Name of the caller" },
        caller_phone: { type: "STRING", description: "Phone number of the caller" },
        incident_type: { type: "STRING", description: "Type of emergency (Fire, Medical, etc.)" },
        location_text: { type: "STRING", description: "Address or location description" },
        priority: {
          type: "STRING",
          enum: ["low", "medium", "high", "critical"],
          description: "Urgency level. MUST be one of: low, medium, high, critical."
        },
        medical_emergency: { type: "BOOLEAN", description: "Is medical attention needed?" },
        impact_category: {
          type: "STRING",
          enum: ["None", "Low", "Medium", "High"],
          description: "Severity of impact"
        },
        summary: { type: "STRING", description: "Short, succinct summary of the incident (max 20 words)" }
      },
      required: []
    }
  }
];

export function useSentinelAgent(transcripts: TranscriptBlock[], currentCallId: string | null, isActive: boolean = false) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastProcessedLength, setLastProcessedLength] = useState(0);
  const processingRef = useRef(false);

  // Reset progress when call ID changes
  useEffect(() => {
    if (currentCallId) {
      setLastProcessedLength(0);
    }
  }, [currentCallId]);

  const lastPingTimeRef = useRef<number>(0);
  const PING_THROTTLE_MS = 3000; // 3 seconds

  // Analyze transcript when it changes and we have a valid call ID
  useEffect(() => {
    const analyze = async () => {
      // Logic Update:
      // We process if we have a valid call ID AND transcripts we haven't processed yet.
      // If the call IS active, we throttle to avoid over-pinging Gemini.
      if (!currentCallId || transcripts.length === 0 || transcripts.length === lastProcessedLength || processingRef.current) {
        return;
      }

      // Throttle pings during active calls
      const now = Date.now();
      if (isActive && (now - lastPingTimeRef.current < PING_THROTTLE_MS)) {
        return;
      }

      processingRef.current = true;
      setIsProcessing(true);
      lastPingTimeRef.current = now;

      try {
        console.log(`[Sentinel] START Processing | CallID: ${currentCallId} | Transcripts: ${transcripts.length} | Active: ${isActive}`);

        // Construct history for Gemini
        const conversationHistory = transcripts.map(t =>
          `${t.speaker === 'caller' ? 'Caller' : 'Dispatcher'}: ${t.text}`
        ).join('\n');

        const prompt = `${SYSTEM_INSTRUCTION}\n\nCurrent Transcript:\n${conversationHistory}`;

        // We use generateContent with tools
        // EXTERNAL API CALL: Google Gemini (Generative AI for data extraction)
        logExternalCall('Google Gemini', 'generateContent', 'gemini-2.0-flash-lite', {
          promptTruncated: prompt.length > 500 ? prompt.substring(0, 500) + '...' : prompt,
          fullPromptLength: prompt.length,
          transcriptLength: transcripts.length
        });

        const result = await geminiModel.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          tools: [{ functionDeclarations: tools as any }], // Cast for TS if needed
          toolConfig: { functionCallingConfig: { mode: "AUTO" as any } }
        });

        const response = result.response;
        console.log('[Sentinel] Full Gemini Response received:', response);

        // Check if candidates exist and have content
        if (response.candidates && response.candidates.length > 0) {
          const candidate = response.candidates[0];
          // In newer Gemini SDKs/models, function calls are inside parts
          const parts = candidate.content?.parts || [];

          console.log('[Sentinel] Candidate Parts:', JSON.stringify(parts, null, 2));

          let functionCalled = false;
          // Look for function calls in parts
          for (const part of parts) {
            if (part.functionCall) {
              functionCalled = true;
              const call = part.functionCall;
              console.log(`%c[Sentinel] FUNCTION CALL FOUND: ${call.name}`, 'color: #10b981; font-weight: bold;', call.args);

              if (call.name === 'update_emergency_incident') {
                console.log('[Sentinel] Triggering update_emergency_incident service...', call.args);
                await incidentService.createOrUpdateEmergencyCall(currentCallId, call.args as any);
              }
            }
          }

          if (!functionCalled) {
            const textResponse = parts.map(p => p.text).filter(Boolean).join('\n');
            console.log('%c[Sentinel] Gemini responded with text BUT NO function call:', 'color: #f59e0b; font-weight: bold;', textResponse);
          }
        } else {
          console.warn('%c[Sentinel] No candidates returned from Gemini. Finish reason:', 'color: #ef4444; font-weight: bold;', response.promptFeedback);
        }

      } catch (err) {
        console.error('%c[Sentinel] CRITICAL Error calling Gemini API:', 'color: #ef4444; font-weight: bold;', err);
        if (err instanceof Error) {
          console.error('[Sentinel] Error message:', err.message);
          console.error('[Sentinel] Error stack:', err.stack);
        }
      } finally {
        setLastProcessedLength(transcripts.length);
        processingRef.current = false;
        setIsProcessing(false);
      }
    };

    // Reduced debounce to 1s to be more responsive to "end of sentence"
    const timeoutId = setTimeout(analyze, 1000);
    return () => clearTimeout(timeoutId);
  }, [transcripts, currentCallId, lastProcessedLength, isActive]);

  return {
    isProcessing
  };
}
