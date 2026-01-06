import React, { useState, useEffect } from 'react';
import { useElevenLabsAgent } from '../hooks/useElevenLabsAgent';
import { Button } from './Button';
import { Mic, MicOff, Activity } from 'lucide-react';

export const VoiceAgentButton = () => {
  const { status, isSpeaking, startAgent, stopAgent } = useElevenLabsAgent();
  const [error, setError] = useState<string | null>(null);

  const isConnected = status === 'connected';

  const handleClick = async () => {
    setError(null);
    try {
      if (isConnected) {
        await stopAgent();
      } else {
        await startAgent();
      }
    } catch (err) {
      console.error('Failed to toggle agent:', err);
      setError('Failed to connect to agent');
    }
  };

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span className="text-xs text-red-500 hidden md:inline">{error}</span>
      )}
      
      <Button
        variant={isConnected ? 'danger' : 'primary'}
        size="sm"
        onClick={handleClick}
        className={`flex items-center gap-2 ${isConnected ? 'animate-pulse-subtle' : ''}`}
        title={isConnected ? 'Disconnect Agent' : 'Connect to Dispatch AI'}
      >
        {isConnected ? <MicOff size={16} /> : <Mic size={16} />}
        {isConnected ? 'Disconnect Agent' : 'Connect AI Dispatcher'}
      </Button>
      
      {isConnected && (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 text-green-700 rounded-md border border-green-200 text-xs font-medium">
          <Activity size={14} className={isSpeaking ? 'animate-pulse' : ''} />
          {isSpeaking ? 'Speaking...' : 'Listening'}
        </div>
      )}
    </div>
  );
};

