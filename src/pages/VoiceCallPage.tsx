import { useEffect, useRef, useState } from 'react';
import { useElevenLabsAgent } from '../hooks/useElevenLabsAgent';
import { useSentinelAgent } from '../hooks/useSentinelAgent';
import { Button } from '../components/Button';
import { Mic, MicOff, Phone, PhoneOff, ArrowLeft, BrainCircuit } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function VoiceCallPage() {
  const { status, isSpeaking, startAgent, stopAgent, transcripts, callId } = useElevenLabsAgent();
  const { isProcessing } = useSentinelAgent(transcripts, callId, status === 'connected');
  const [scrollLocked, setScrollLocked] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const isConnected = status === 'connected';

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollLocked && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [transcripts, scrollLocked]);

  const speakerColors = {
    caller: 'text-green-700 font-semibold',
    ai: 'text-blue-700 font-semibold',
    responder: 'text-purple-700 font-semibold',
  };

  const speakerBgColors = {
    caller: 'bg-green-50 border-l-4 border-l-green-500',
    ai: 'bg-blue-50 border-l-4 border-l-blue-500',
    responder: 'bg-purple-50 border-l-4 border-l-purple-500',
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-gray-500 hover:text-gray-700 transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-full">
              <Phone className="text-blue-600" size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Emergency Call Line</h1>
              <p className="text-sm text-gray-500">Live Voice Agent</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isConnected && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium animate-pulse">
              <span className="w-2 h-2 bg-green-600 rounded-full"></span>
              Live Connection
            </div>
          )}
          {isProcessing && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
              <BrainCircuit size={16} className="animate-spin" />
              Sentinel Analyzing...
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-6 flex flex-col">
        {/* Controls */}
        <div className="bg-white rounded-xl shadow-sm p-8 mb-6 text-center border border-gray-100">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">
              {isConnected ? 'Call in Progress' : 'Start a Call'}
            </h2>
            <p className="text-gray-500">
              {isConnected
                ? 'Speak clearly to the emergency dispatcher.'
                : 'Click the button below to connect with the AI dispatcher.'}
            </p>
          </div>

          <div className="flex justify-center">
            <Button
              variant={isConnected ? 'danger' : 'primary'}
              size="lg"
              onClick={isConnected ? stopAgent : startAgent}
              className={`w-48 h-16 rounded-full text-lg shadow-lg transition-all transform hover:scale-105 ${isConnected ? 'animate-pulse-subtle' : ''
                }`}
            >
              {isConnected ? (
                <>
                  <PhoneOff className="mr-3" size={24} />
                  End Call
                </>
              ) : (
                <>
                  <Phone className="mr-3" size={24} />
                  Start Call
                </>
              )}
            </Button>
          </div>

          {isConnected && (
            <div className="mt-4 text-sm text-gray-400 flex items-center justify-center gap-2">
              {isSpeaking ? (
                <>
                  <Mic className="animate-pulse text-blue-500" size={16} />
                  <span>Agent is speaking...</span>
                </>
              ) : (
                <>
                  <MicOff className="text-gray-300" size={16} />
                  <span>Listening...</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Transcript Area */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col min-h-[400px]">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
            <h3 className="font-semibold text-gray-700">Live Transcript</h3>
            <span className="text-xs text-gray-500">{transcripts.length} messages</span>
          </div>

          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto p-6 space-y-4 bg-white"
            onScroll={(e) => {
              if (scrollLocked) {
                const element = e.currentTarget;
                const isAtBottom =
                  element.scrollHeight - element.scrollTop - element.clientHeight < 50;
                setScrollLocked(isAtBottom);
              }
            }}
          >
            {transcripts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <p>Transcript will appear here...</p>
              </div>
            ) : (
              transcripts.map((block, index) => (
                <div
                  key={index} // fallback to index if id is duplicate
                  className={`p-4 rounded-lg transition-colors ${speakerBgColors[block.speaker]} max-w-[85%] ${block.speaker === 'caller' ? 'ml-auto' : 'mr-auto'
                    }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className={speakerColors[block.speaker]}>
                      {block.speaker === 'caller' ? 'Caller (You)' : 'Dispatcher (AI)'}
                    </span>
                    <span className="text-xs text-gray-500 opacity-70">
                      {new Date(block.timestamp_iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-gray-800 leading-relaxed text-lg">
                    {block.text}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
