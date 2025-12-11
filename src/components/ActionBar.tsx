import React, { useState } from 'react';
import { CallWithContext, CallPriority } from '../types';
import { Button, Modal } from './index';
import { Send, UserCheck, AlertTriangle, FileText, Shield, Flame, Heart } from 'lucide-react';
import { TextArea } from './Input';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useCall } from '../contexts/CallContext';

type DispatchType = 'fire' | 'police' | 'ems';

interface ActionBarProps {
  call: CallWithContext;
}

const DISPATCH_TYPES: { value: DispatchType; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'fire', label: 'Fire Department', icon: <Flame size={20} />, color: 'text-red-600' },
  { value: 'police', label: 'Police', icon: <Shield size={20} />, color: 'text-blue-600' },
  { value: 'ems', label: 'EMS / Ambulance', icon: <Heart size={20} />, color: 'text-green-600' },
];

const PRIORITY_ORDER: CallPriority[] = ['low', 'medium', 'high', 'critical'];

export default function ActionBar({ call }: ActionBarProps) {
  const { responder } = useAuth();
  const { updateCall, setActiveCall, setCalls } = useCall();
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showMarkSafeModal, setShowMarkSafeModal] = useState(false);
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [selectedDispatchTypes, setSelectedDispatchTypes] = useState<DispatchType[]>([]);
  const [selectedPriority, setSelectedPriority] = useState<CallPriority>(call.priority);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleDispatchType = (type: DispatchType) => {
    setSelectedDispatchTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleDispatch = async () => {
    if (selectedDispatchTypes.length === 0) {
      alert('Please select at least one service to dispatch.');
      return;
    }

    setIsSubmitting(true);
    try {
      console.log('Dispatching services (UI only):', selectedDispatchTypes);
      console.log('Call ID:', call.id);

      // Create a dispatch action locally (UI only, no database)
      const dispatchAction = {
        id: `temp-${Date.now()}`,
        call_id: call.id,
        responder_id: responder?.id || 'temp-responder',
        action_type: 'dispatch' as const,
        action_data: {
          dispatch_types: selectedDispatchTypes,
          timestamp: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
      };

      // Update call state with dispatch info (UI only)
      const updatedCall = {
        ...call,
        actions: [...(call.actions || []), dispatchAction],
      };
      
      setActiveCall(updatedCall);
      console.log('Call state updated with dispatch action (UI only)');
      
      setShowDispatchModal(false);
      setSelectedDispatchTypes([]);
    } catch (error) {
      console.error('Dispatch error:', error);
      alert(`Failed to dispatch: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkSafe = async () => {
    if (!responder) {
      alert('No responder information available');
      return;
    }

    setIsSubmitting(true);
    try {
      // Persist mark_safe action to database
      const { data: actionData, error: actionError } = await supabase
        .from('call_actions')
        .insert({
          call_id: call.id,
          responder_id: responder.id,
          action_type: 'mark_safe',
          action_data: {
            timestamp: new Date().toISOString(),
          },
        })
        .select()
        .single();

      if (actionError) throw actionError;

      // Update call status to closed
      const { error: updateError } = await supabase
        .from('calls')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
        })
        .eq('id', call.id);

      if (updateError) throw updateError;

      // Update local state
      const markSafeAction = {
        id: actionData.id,
        call_id: call.id,
        responder_id: responder.id,
        action_type: 'mark_safe' as const,
        action_data: {
          timestamp: new Date().toISOString(),
        },
        created_at: actionData.created_at,
      };

      const updatedCall = {
        ...call,
        status: 'closed' as const,
        closed_at: new Date().toISOString(),
        actions: [...(call.actions || []), markSafeAction],
        hasMarkSafeAction: true,
      };

      setActiveCall(updatedCall);
      updateCall({ status: 'closed', closed_at: new Date().toISOString() });
      
      // Also update the calls list to show the green tag immediately
      setCalls((prevCalls: any[]) =>
        prevCalls.map((c: any) =>
          c.id === call.id ? { ...c, hasMarkSafeAction: true, status: 'closed', closed_at: new Date().toISOString() } : c
        )
      );
      
      setShowMarkSafeModal(false);
    } catch (error) {
      console.error('Mark safe error:', error);
      alert(`Failed to mark as safe: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEscalate = () => {
    if (selectedPriority === call.priority) return;
    updateCall({ priority: selectedPriority });
    setShowEscalateModal(false);
  };

  const handleAddNote = async () => {
    if (!note.trim() || !responder) return;

    setIsSubmitting(true);
    try {
      await supabase.from('call_actions').insert({
        call_id: call.id,
        responder_id: responder.id,
        action_type: 'note',
        action_data: { note },
      });

      setNote('');
      setShowNoteModal(false);
    } catch (error) {
      console.error('Note error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="sticky bottom-0 bg-white border-t border-gray-200 shadow-lg p-4">
        <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => setShowDispatchModal(true)}>
              <Send size={18} />
              Dispatch
            </Button>
            <Button variant="secondary" onClick={() => setShowNoteModal(true)}>
              <FileText size={18} />
              Add Note
            </Button>
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowMarkSafeModal(true)}>
              <UserCheck size={18} />
              Mark Safe
            </Button>
            <Button variant="danger" onClick={() => setShowEscalateModal(true)}>
              <AlertTriangle size={18} />
              Escalate
            </Button>
          </div>
        </div>
      </div>

      {/* Dispatch Modal */}
      <Modal
        isOpen={showDispatchModal}
        onClose={() => {
          setShowDispatchModal(false);
          setSelectedDispatchTypes([]);
        }}
        title="Dispatch Emergency Services"
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setShowDispatchModal(false);
                setSelectedDispatchTypes([]);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Dispatch button clicked', { selectedDispatchTypes, responder: !!responder });
                handleDispatch();
              }}
              isLoading={isSubmitting}
              disabled={selectedDispatchTypes.length === 0 || isSubmitting}
            >
              Confirm Dispatch ({selectedDispatchTypes.length})
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Select one or more emergency services to dispatch for this call:
          </p>
          <div className="grid grid-cols-1 gap-3">
            {DISPATCH_TYPES.map((type) => {
              const isSelected = selectedDispatchTypes.includes(type.value);
              return (
                <button
                  key={type.value}
                  onClick={() => toggleDispatchType(type.value)}
                  className={`p-4 border-2 rounded-lg transition-all text-left ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex-shrink-0 w-5 h-5 border-2 rounded ${
                      isSelected
                        ? 'border-blue-600 bg-blue-600'
                        : 'border-gray-300'
                    } flex items-center justify-center`}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <div className={type.color}>{type.icon}</div>
                    <span className="font-medium text-gray-900">{type.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
          {selectedDispatchTypes.length > 0 && (
            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
              <p className="text-blue-800 font-medium">
                Selected: {selectedDispatchTypes.map(type => 
                  DISPATCH_TYPES.find(t => t.value === type)?.label
                ).join(', ')}
              </p>
            </div>
          )}
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
            <p className="font-semibold">Call: {call.call_id}</p>
            <p>Location: {call.location_text || 'Unknown'}</p>
            <p>Type: {call.incident_type || 'Unknown'}</p>
          </div>
        </div>
      </Modal>

      {/* Mark Safe Modal */}
      <Modal
        isOpen={showMarkSafeModal}
        onClose={() => setShowMarkSafeModal(false)}
        title="Mark Call as Safe"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowMarkSafeModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleMarkSafe} isLoading={isSubmitting}>
              Confirm Safe
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Are you sure you want to mark this call as safe? This will close the call and mark it as resolved.
          </p>
          <div className="p-3 bg-green-50 border border-green-200 rounded text-sm">
            <p className="font-semibold">Call: {call.call_id}</p>
            <p>Location: {call.location_text || 'Unknown'}</p>
            <p>Type: {call.incident_type || 'Unknown'}</p>
            <p className="mt-2 text-green-700">
              This action will be recorded in the call history.
            </p>
          </div>
        </div>
      </Modal>

      {/* Escalate Modal */}
      <Modal
        isOpen={showEscalateModal}
        onClose={() => {
          setShowEscalateModal(false);
          setSelectedPriority(call.priority);
        }}
        title="Escalate Call Priority"
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setShowEscalateModal(false);
                setSelectedPriority(call.priority);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleEscalate}
              disabled={selectedPriority === call.priority}
            >
              Escalate Priority
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Select the new priority level for this call:
          </p>
          <div className="space-y-2">
            {PRIORITY_ORDER.map((priority) => {
              const isCurrent = priority === call.priority;
              const isSelected = priority === selectedPriority;
              const canSelect = PRIORITY_ORDER.indexOf(priority) > PRIORITY_ORDER.indexOf(call.priority);

              return (
                <button
                  key={priority}
                  onClick={() => {
                    if (canSelect || isCurrent) {
                      setSelectedPriority(priority);
                    }
                  }}
                  disabled={!canSelect && !isCurrent}
                  className={`w-full p-3 border-2 rounded-lg transition-all text-left ${
                    isCurrent
                      ? 'border-gray-300 bg-gray-100 cursor-not-allowed'
                      : isSelected
                      ? 'border-red-600 bg-red-50'
                      : canSelect
                      ? 'border-gray-200 hover:border-gray-300'
                      : 'border-gray-100 bg-gray-50 cursor-not-allowed opacity-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900 capitalize">{priority}</span>
                    {isCurrent && <span className="text-xs text-gray-500">Current</span>}
                    {isSelected && !isCurrent && (
                      <span className="text-xs text-red-600 font-semibold">Selected</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
            <p className="font-semibold">Call: {call.call_id}</p>
            <p>Current Priority: <span className="capitalize font-medium">{call.priority}</span></p>
            {selectedPriority !== call.priority && (
              <p className="mt-1 text-yellow-700">
                New Priority: <span className="capitalize font-medium">{selectedPriority}</span>
              </p>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showNoteModal}
        onClose={() => setShowNoteModal(false)}
        title="Add Note"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowNoteModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleAddNote} isLoading={isSubmitting}>
              Save Note
            </Button>
          </>
        }
      >
        <TextArea
          label="Note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          placeholder="Enter your note here..."
        />
      </Modal>
    </>
  );
}
