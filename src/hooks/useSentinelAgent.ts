import { useState, useEffect, useRef } from 'react';
import { geminiModel } from '../lib/gemini';
import { incidentService } from '../services/incidentService';
import { logExternalCall } from '../lib/logger';
import { TranscriptBlock } from '../types';

const SYSTEM_INSTRUCTION = `
You are the Sentinel, an intelligent emergency response observer. 
Your role is to listen to the conversation between a caller and an AI dispatcher (or human).
You must extract critical information and update the emergency incident record in real-time.

Do not generate conversational responses. Your output should only be function calls when you have gathered enough information to populate or update the incident fields.

The fields we need are:
- Caller Name & Phone
- Incident Type (e.g. Fire, Medical, Crime)
- Location (Address or description)
- Priority (Critical, High, Medium, Low)
  - Critical: Immediate threat to life, massive disaster, or high-casualty event. Requires immediate human takeover.
  - High: Serious situation, potential threat to life, or major property damage. Requires immediate human takeover.
  - Medium: Non-life-threatening but urgent requiring dispatch.
  - Low: Non-urgent, administrative, or minor issues.
- Medical Emergency (true/false)
- Impact Category (High/Medium/Low/None)
- Summary (Succinct, 1-2 sentences maximum)

Update the incident whenever you detect new or changed information. 
If the caller corrects themselves, update with the new information.
Only provide the fields that you have extracted or that have changed. Do not guess fields that are not mentioned.
The summary should be very short and accurately describe the core situation.
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

  // Analyze transcript when it changes and we have a valid call ID
  useEffect(() => {
    const analyze = async () => {
      // Logic Update:
      // We process ONLY if the call is NOT active (i.e. it has ended)
      // AND we have transcripts we haven't processed yet.
      if (isActive || !currentCallId || transcripts.length === 0 || transcripts.length === lastProcessedLength || processingRef.current) {
        return;
      }

      processingRef.current = true;
      setIsProcessing(true);

      try {
        console.log(`[Sentinel] START Processing | CallID: ${currentCallId} | Transcripts: ${transcripts.length}`);

        // Construct history for Gemini
        const conversationHistory = transcripts.map(t =>
          `${t.speaker === 'caller' ? 'Caller' : 'Dispatcher'}: ${t.text}`
        ).join('\n');

        const prompt = `${SYSTEM_INSTRUCTION}\n\nCurrent Transcript:\n${conversationHistory}`;

        // We use generateContent with tools
        // EXTERNAL API CALL: Google Gemini (Generative AI for data extraction)
        logExternalCall('Google Gemini', 'generateContent', 'gemini-2.5-flash-lite', { prompt: prompt.substring(0, 500) + '...' });
        const result = await geminiModel.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          tools: [{ functionDeclarations: tools as any }], // Cast for TS if needed
          toolConfig: { functionCallingConfig: { mode: "AUTO" as any } }
        });

        const response = result.response;
        console.log('[Sentinel] Raw Gemini Response:', JSON.stringify(response, null, 2));

        // Check if candidates exist and have content
        if (response.candidates && response.candidates.length > 0) {
          const candidate = response.candidates[0];
          // In newer Gemini SDKs/models, function calls are inside parts
          const parts = candidate.content?.parts || [];

          console.log('[Sentinel] Candidate Parts:', JSON.stringify(parts, null, 2));

          // Look for function calls in parts
          for (const part of parts) {
            if (part.functionCall) {
              const call = part.functionCall;
              console.log(`[Sentinel] FUNCTION CALL FOUND: ${call.name}`, call.args);

              if (call.name === 'update_emergency_incident') {
                console.log('[Sentinel] Triggering update_emergency_incident service...', call.args);
                await incidentService.createOrUpdateEmergencyCall(currentCallId, call.args as any);
              }
            } else {
              console.log('[Sentinel] No function call in this part. Text:', part.text);
            }
          }
        } else {
          console.log('[Sentinel] No candidates returned from Gemini.');
        }

      } catch (err) {
        console.error('[Sentinel] Error processing transcript:', err);
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
