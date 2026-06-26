import React, { useState, useEffect, useCallback } from 'react';
import { Search, Building2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import styles from './SelectCompanyModal.module.css';
import { useApp } from '@/context/AppContext';
import { useMenu } from '@/context/MenuContext';
import companyService from '@/services/companyService';
import { logAuditEvent, AUDIT_ACTIONS } from '@/utils/auditLogger';

export default function SelectCompanyModal({ onClose, changeMode = false }) {
  const { setActiveCompany, addOpenedCompany, currentUser } = useApp();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'active' | 'closed'
  const [selected, setSelected] = useState(null);
  const [opening, setOpening] = useState(false);

  // Load companies on mount
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await companyService.listCompanies();
        setCompanies(data);
      } catch (err) {
        setError('Failed to load companies. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = companies.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || c.status?.toLowerCase() === filter;
    return matchSearch && matchFilter;
  });

  const handleOpen = useCallback(async () => {
    if (!selected) return;
    try {
      setOpening(true);
      const company = await companyService.openCompany(selected.id);
      setActiveCompany(company);
      addOpenedCompany(company);
      await logAuditEvent({
        action: AUDIT_ACTIONS.COMPANY_SELECTED,
        userId: currentUser?.id,
        companyId: company.id,
        status: 'SUCCESS',
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to open company.');
    } finally {
      setOpening(false);
    }
  }, [selected, setActiveCompany, addOpenedCompany, currentUser, onClose]);

  const statusColor = (status) => {
    switch(status?.toLowerCase()) {
      case 'active': return '#68d391';
      case 'closed': return '#fc8181';
      case 'corrupt': return '#f6ad55';
      default: return '#a0aec0';
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Select Company">
        <div className={styles.header}>
          <Building2 size={20} color="#90cdf4"/>
          <h2 className={styles.title}>{changeMode ? 'Change Company' : 'Select Company'}</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Search + filter bar */}
        <div className={styles.searchBar}>
          <div className={styles.searchInput}>
            <Search size={14}/>
            <input
              type="text"
              placeholder="Search company name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <select className={styles.filterSelect} value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        {/* Company list */}
        <div className={styles.list}>
          {loading && <div className={styles.loading}><RefreshCw size={16} className={styles.spin}/> Loading companies...</div>}
          {error && <div className={styles.errorMsg}><AlertCircle size={14}/> {error}</div>}
          {!loading && !error && filtered.length === 0 && (
            <div className={styles.empty}>No companies found.</div>
          )}
          {!loading && filtered.map(company => (
            <div
              key={company.id}
              className={`${styles.companyRow} ${selected?.id === company.id ? styles.companyRowSelected : ''}`}
              onClick={() => setSelected(company)}
              onDoubleClick={handleOpen}
              role="option"
              aria-selected={selected?.id === company.id}
            >
              <div className={styles.companyMain}>
                <span className={styles.companyName}>{company.name}</span>
                <span className={styles.companyFY}>FY: {company.financialYear}</span>
              </div>
              <div className={styles.companyMeta}>
                <span className={styles.companyCountry}>{company.country}</span>
                <span className={styles.companyStatus} style={{ color: statusColor(company.status) }}>
                  {company.status}
                </span>
                {selected?.id === company.id && <CheckCircle size={14} color="#68d391"/>}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <span className={styles.hint}>Double-click to open | Enter to confirm</span>
          <div className={styles.footerBtns}>
            <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button
              className={styles.openBtn}
              onClick={handleOpen}
              disabled={!selected || opening}
            >
              {opening ? 'Opening...' : 'Open Company'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
