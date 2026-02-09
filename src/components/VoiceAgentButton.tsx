import { useNavigate } from 'react-router-dom';
import { useElevenLabsAgent } from '../hooks/useElevenLabsAgent';
import { Button } from './Button';
import { Mic, Activity } from 'lucide-react';

export const VoiceAgentButton = () => {
  const { status, isSpeaking } = useElevenLabsAgent();
  const navigate = useNavigate();

  const isConnected = status === 'connected';

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="primary"
        size="sm"
        onClick={() => navigate('/call')}
        className="flex items-center gap-2"
        title="Open AI Dispatcher"
      >
        <Mic size={16} />
        Connect AI Dispatcher
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

