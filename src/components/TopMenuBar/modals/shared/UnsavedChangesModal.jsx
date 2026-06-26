import React from 'react';
import { Save } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';

export default function UnsavedChangesModal({ onClose, onSave, onDiscard, onCancel }) {
  return (
    <ConfirmationModal
      onClose={() => { onCancel?.(); onClose(); }}
      title="Unsaved Changes"
      message="You have unsaved changes. Do you want to save before continuing?"
      confirmLabel="Save"
      cancelLabel="Cancel"
      thirdLabel="Discard Changes"
      danger={false}
      icon={<Save size={20} color="#90cdf4"/>}
      onConfirm={() => { onSave?.(); onClose(); }}
      onThird={() => { onDiscard?.(); onClose(); }}
    />
  );
}
