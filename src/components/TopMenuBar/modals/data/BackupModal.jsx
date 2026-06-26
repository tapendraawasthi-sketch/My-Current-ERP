import React, { useState } from 'react';
import styles from './BackupModal.module.css';
import { HardDrive, CheckCircle, AlertCircle } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import dataService from '@/services/dataService';
import { logAuditEvent, AUDIT_ACTIONS } from '@/utils/auditLogger';

export default function BackupModal({ onClose }) {
  const { activeCompany, currentUser } = useApp();
  const [form, setForm] = useState({
    backupLocation: '',
    fileName: activeCompany
      ? `${activeCompany.name.replace(/\s+/g,'_')}_Backup_${new Date().toISOString().slice(0,10)}.zip`
      : 'backup.zip',
    backupType: 'full',        // 'full' | 'incremental'
    includeAttachments: true,
    encrypt: false,
    encryptPassword: '',
    confirmPassword: '',
    compress: true,
  });
  const [status, setStatus] = useState(null); // null | 'running' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [progress, setProgress] = useState(0);

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const validate = () => {
    if (!form.backupLocation.trim()) return 'Backup location is required.';
    if (form.encrypt && !form.encryptPassword) return 'Encryption password is required.';
    if (form.encrypt && form.encryptPassword !== form.confirmPassword) return 'Passwords do not match.';
    return null;
  };

  const handleBackup = async () => {
    const err = validate();
    if (err) { setErrorMsg(err); return; }
    try {
      setStatus('running');
      setProgress(0);
      setErrorMsg('');
      // Poll progress via interval
      const interval = setInterval(() => setProgress(p => Math.min(p + 10, 90)), 400);
      await dataService.backup({ ...form, companyId: activeCompany?.id });
      clearInterval(interval);
      setProgress(100);
      setStatus('success');
      await logAuditEvent({ action: AUDIT_ACTIONS.BACKUP_TAKEN, userId: currentUser?.id, companyId: activeCompany?.id, status: 'SUCCESS' });
    } catch (e) {
      setStatus('error');
      setErrorMsg(e.response?.data?.message || e.message || 'Backup failed.');
      await logAuditEvent({ action: AUDIT_ACTIONS.BACKUP_TAKEN, userId: currentUser?.id, companyId: activeCompany?.id, status: 'FAILED', failureReason: e.message });
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <div className={styles.header}>
          <HardDrive size={20} color="#90cdf4"/>
          <h2 className={styles.title}>Backup Company Data</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.body}>
          {/* Company display */}
          <div className={styles.companyBadge}>
            Company: <strong>{activeCompany?.name || 'No company selected'}</strong>
          </div>

          <div className={styles.field}>
            <label>Backup Location / Destination Path *</label>
            <input value={form.backupLocation} onChange={e => update('backupLocation', e.target.value)}
              placeholder="e.g. D:\AccountingBackups\" disabled={status==='running'}/>
          </div>
          <div className={styles.field}>
            <label>Backup File Name</label>
            <input value={form.fileName} onChange={e => update('fileName', e.target.value)} disabled={status==='running'}/>
          </div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label>Backup Type</label>
              <select value={form.backupType} onChange={e => update('backupType', e.target.value)} disabled={status==='running'}>
                <option value="full">Full Backup</option>
                <option value="incremental">Incremental Backup</option>
              </select>
            </div>
            <div className={styles.field}>
              <label>Compression</label>
              <select value={form.compress ? 'yes':'no'} onChange={e => update('compress', e.target.value==='yes')} disabled={status==='running'}>
                <option value="yes">Yes (Recommended)</option>
                <option value="no">No</option>
              </select>
            </div>
          </div>
          <label className={styles.checkRow}>
            <input type="checkbox" checked={form.includeAttachments} onChange={e => update('includeAttachments', e.target.checked)} disabled={status==='running'}/>
            Include Attachments
          </label>
          <label className={styles.checkRow}>
            <input type="checkbox" checked={form.encrypt} onChange={e => update('encrypt', e.target.checked)} disabled={status==='running'}/>
            Encrypt Backup
          </label>
          {form.encrypt && (
            <>
              <div className={styles.field}>
                <label>Encryption Password</label>
                <input type="password" value={form.encryptPassword} onChange={e => update('encryptPassword', e.target.value)} disabled={status==='running'}/>
              </div>
              <div className={styles.field}>
                <label>Confirm Password</label>
                <input type="password" value={form.confirmPassword} onChange={e => update('confirmPassword', e.target.value)} disabled={status==='running'}/>
              </div>
            </>
          )}

          {/* Progress bar */}
          {status === 'running' && (
            <div className={styles.progressWrap}>
              <div className={styles.progressBar} style={{width:`${progress}%`}}/>
              <span className={styles.progressLabel}>Backing up... {progress}%</span>
            </div>
          )}

          {/* Success */}
          {status === 'success' && (
            <div className={styles.successMsg}>
              <CheckCircle size={16}/> Backup completed successfully!
              <br/><small>{form.backupLocation}/{form.fileName}</small>
            </div>
          )}

          {/* Error */}
          {(errorMsg || status === 'error') && (
            <div className={styles.errorMsg}>
              <AlertCircle size={16}/> {errorMsg || 'Backup failed.'}
            </div>
          )}
        </div>
        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>
            {status === 'success' ? 'Close' : 'Cancel'}
          </button>
          {status !== 'success' && (
            <button className={styles.backupBtn} onClick={handleBackup} disabled={status==='running' || !activeCompany}>
              {status === 'running' ? 'Backing up...' : 'Start Backup'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
