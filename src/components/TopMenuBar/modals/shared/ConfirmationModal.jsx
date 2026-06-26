import React, { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import styles from './ConfirmationModal.module.css';

export default function ConfirmationModal({
  onClose,
  title = 'Confirm Action',
  message = 'Are you sure?',
  confirmLabel = 'Yes',
  cancelLabel = 'Cancel',
  thirdLabel = null,
  onConfirm,
  onThird,
  danger = false,
  icon = null,
}) {
  const confirmRef = useRef(null);
  useEffect(() => { confirmRef.current?.focus(); }, []);

  const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };

  return (
    <div className={styles.overlay} onKeyDown={handleKeyDown}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="conf-title">
        <div className={styles.header}>
          {icon || <AlertTriangle size={20} color={danger ? '#fc8181' : '#f6e05e'}/>}
          <h2 id="conf-title" className={styles.title}>{title}</h2>
        </div>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          {thirdLabel && (
            <button className={styles.thirdBtn} onClick={() => { onThird?.(); onClose(); }}>
              {thirdLabel}
            </button>
          )}
          <button className={styles.cancelBtn} onClick={onClose}>{cancelLabel}</button>
          <button
            ref={confirmRef}
            className={danger ? styles.dangerBtn : styles.confirmBtn}
            onClick={() => { onConfirm?.(); onClose(); }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
