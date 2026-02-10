import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Call, TranscriptBlock, ExtractedField, CallWithContext } from '../types';

interface CallContextType {
  activeCall: CallWithContext | null;
  calls: Call[];
  setActiveCall: (call: CallWithContext | null | ((prev: CallWithContext | null) => CallWithContext | null)) => void;
  setCalls: (calls: Call[] | ((prevCalls: Call[]) => Call[])) => void;
  addTranscriptBlock: (block: TranscriptBlock) => void;
  updateExtractedField: (field: ExtractedField) => void;
  updateCall: (call: Partial<Call>) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export function CallProvider({ children }: { children: ReactNode }) {
  const [activeCall, setActiveCall] = useState<CallWithContext | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addTranscriptBlock = useCallback(
    (block: TranscriptBlock) => {
      setActiveCall((prev) => {
        if (prev && block.call_id === prev.id) {
          return {
            ...prev,
            transcripts: [...(prev.transcripts || []), block],
          };
        }
        return prev;
      });
    },
    []
  );

  const updateExtractedField = useCallback(
    (field: ExtractedField) => {
      setActiveCall((prev) => {
        if (prev && field.call_id === prev.id) {
          const existingIndex =
            prev.extracted_fields?.findIndex((f) => f.field_name === field.field_name) ?? -1;

          if (existingIndex >= 0) {
            const updated = [...(prev.extracted_fields || [])];
            updated[existingIndex] = field;
            return {
              ...prev,
              extracted_fields: updated,
            };
          } else {
            return {
              ...prev,
              extracted_fields: [...(prev.extracted_fields || []), field],
            };
          }
        }
        return prev;
      });
    },
    []
  );

  const updateCall = useCallback(
    (updates: Partial<Call>) => {
      setActiveCall((prev) => {
        if (prev) {
          const updated = { ...prev, ...updates };
          // After updating activeCall, we also need to update the calls list
          setCalls((prevCalls) =>
            prevCalls.map((call) =>
              call.id === prev.id ? { ...call, ...updates } : call
            )
          );
          return updated;
        }
        return prev;
      });
    },
    []
  );

  const value: CallContextType = {
    activeCall,
    calls,
    setActiveCall,
    setCalls,
    addTranscriptBlock,
    updateExtractedField,
    updateCall,
    isLoading,
    setIsLoading,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall() {
  const context = useContext(CallContext);
  if (context === undefined) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
}
