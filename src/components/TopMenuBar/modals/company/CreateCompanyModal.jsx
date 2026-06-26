import React, { useState } from 'react';
import styles from './CreateCompanyModal.module.css';
import { useApp } from '../../context/AppContext';
import { useMenu } from '../../context/MenuContext';
import companyService from '../../../../services/companyService';
import { logAuditEvent, AUDIT_ACTIONS } from '../../../../utils/auditLogger';

const STEPS = ['Basic Info', 'Financial & Tax', 'Features'];

const INITIAL_FORM = {
  // Step 1
  companyName: '', mailingName: '', address1: '', address2: '',
  city: '', state: '', country: 'India', postalCode: '',
  phone: '', mobile: '', email: '', website: '',
  companyType: 'Private Limited',
  // Step 2
  financialYearFrom: '', booksBeginningFrom: '',
  currency: 'INR', currencySymbol: '₹', decimalPlaces: 2,
  gstin: '', pan: '', taxRegNumber: '',
  gstApplicable: true,
  // Step 3
  features: {
    inventory: false, taxation: true, payroll: false,
    costCenters: false, multiCurrency: false, billWise: true,
    banking: true, budgets: false,
  },
};

const COMPANY_TYPES = ['Proprietorship','Partnership','LLP','Private Limited','Public Limited','Trust','Society','NGO','Branch','Individual','Other'];

function validateStep1(data) {
  const errors = {};
  if (!data.companyName.trim()) errors.companyName = 'Company name is required.';
  if (!data.country.trim()) errors.country = 'Country is required.';
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.email = 'Invalid email address.';
  return errors;
}

function validateStep2(data) {
  const errors = {};
  if (!data.financialYearFrom) errors.financialYearFrom = 'Financial year start date is required.';
  if (!data.booksBeginningFrom) errors.booksBeginningFrom = 'Books beginning date is required.';
  if (data.financialYearFrom && data.booksBeginningFrom) {
    if (new Date(data.booksBeginningFrom) < new Date(data.financialYearFrom)) {
      errors.booksBeginningFrom = 'Books beginning date cannot be before financial year start.';
    }
  }
  return errors;
}

export default function CreateCompanyModal({ onClose }) {
  const { currentUser, setActiveCompany, addOpenedCompany } = useApp();
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState(null);

  const update = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const updateFeature = (feat, val) => {
    setFormData(prev => ({ ...prev, features: { ...prev.features, [feat]: val } }));
  };

  const handleNext = () => {
    let errs = {};
    if (step === 0) errs = validateStep1(formData);
    if (step === 1) errs = validateStep2(formData);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setStep(s => s + 1);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const newCompany = await companyService.createCompany(formData);
      setActiveCompany(newCompany);
      addOpenedCompany(newCompany);
      await logAuditEvent({
        action: AUDIT_ACTIONS.COMPANY_CREATED,
        userId: currentUser?.id,
        companyId: newCompany.id,
        newValue: formData.companyName,
        status: 'SUCCESS',
      });
      onClose();
    } catch (err) {
      setServerError(err.response?.data?.message || err.message || 'Failed to create company.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <div className={styles.header}>
          <h2 className={styles.title}>Create Company</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Step indicator */}
        <div className={styles.stepBar}>
          {STEPS.map((s, i) => (
            <div key={s} className={`${styles.step} ${i === step ? styles.stepActive : ''} ${i < step ? styles.stepDone : ''}`}>
              <span className={styles.stepNum}>{i + 1}</span>
              <span className={styles.stepLabel}>{s}</span>
            </div>
          ))}
        </div>

        <div className={styles.body}>
          {/* STEP 1 */}
          {step === 0 && (
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label>Company Name *</label>
                <input value={formData.companyName} onChange={e => update('companyName', e.target.value)} autoFocus/>
                {errors.companyName && <span className={styles.err}>{errors.companyName}</span>}
              </div>
              <div className={styles.field}>
                <label>Mailing Name</label>
                <input value={formData.mailingName} onChange={e => update('mailingName', e.target.value)}
                  placeholder="Same as company name if blank"/>
              </div>
              <div className={`${styles.field} ${styles.fullWidth}`}>
                <label>Address Line 1</label>
                <input value={formData.address1} onChange={e => update('address1', e.target.value)}/>
              </div>
              <div className={`${styles.field} ${styles.fullWidth}`}>
                <label>Address Line 2</label>
                <input value={formData.address2} onChange={e => update('address2', e.target.value)}/>
              </div>
              <div className={styles.field}>
                <label>City</label>
                <input value={formData.city} onChange={e => update('city', e.target.value)}/>
              </div>
              <div className={styles.field}>
                <label>State / Province</label>
                <input value={formData.state} onChange={e => update('state', e.target.value)}/>
              </div>
              <div className={styles.field}>
                <label>Country *</label>
                <input value={formData.country} onChange={e => update('country', e.target.value)}/>
                {errors.country && <span className={styles.err}>{errors.country}</span>}
              </div>
              <div className={styles.field}>
                <label>Postal Code</label>
                <input value={formData.postalCode} onChange={e => update('postalCode', e.target.value)}/>
              </div>
              <div className={styles.field}>
                <label>Phone</label>
                <input value={formData.phone} onChange={e => update('phone', e.target.value)}/>
              </div>
              <div className={styles.field}>
                <label>Mobile</label>
                <input value={formData.mobile} onChange={e => update('mobile', e.target.value)}/>
              </div>
              <div className={styles.field}>
                <label>Email</label>
                <input type="email" value={formData.email} onChange={e => update('email', e.target.value)}/>
                {errors.email && <span className={styles.err}>{errors.email}</span>}
              </div>
              <div className={styles.field}>
                <label>Company Type</label>
                <select value={formData.companyType} onChange={e => update('companyType', e.target.value)}>
                  {COMPANY_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 1 && (
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label>Financial Year From *</label>
                <input type="date" value={formData.financialYearFrom} onChange={e => update('financialYearFrom', e.target.value)}/>
                {errors.financialYearFrom && <span className={styles.err}>{errors.financialYearFrom}</span>}
              </div>
              <div className={styles.field}>
                <label>Books Beginning From *</label>
                <input type="date" value={formData.booksBeginningFrom} onChange={e => update('booksBeginningFrom', e.target.value)}/>
                {errors.booksBeginningFrom && <span className={styles.err}>{errors.booksBeginningFrom}</span>}
              </div>
              <div className={styles.field}>
                <label>Currency</label>
                <input value={formData.currency} onChange={e => update('currency', e.target.value)}/>
              </div>
              <div className={styles.field}>
                <label>Currency Symbol</label>
                <input value={formData.currencySymbol} onChange={e => update('currencySymbol', e.target.value)}/>
              </div>
              <div className={styles.field}>
                <label>GSTIN / VAT Number</label>
                <input value={formData.gstin} onChange={e => update('gstin', e.target.value)} placeholder="e.g. 27ABCDE1234F1Z5"/>
              </div>
              <div className={styles.field}>
                <label>PAN / Income Tax No.</label>
                <input value={formData.pan} onChange={e => update('pan', e.target.value)}/>
              </div>
              <div className={styles.field}>
                <label>GST Applicable</label>
                <select value={formData.gstApplicable ? 'yes' : 'no'} onChange={e => update('gstApplicable', e.target.value === 'yes')}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div className={styles.field}>
                <label>Decimal Places</label>
                <select value={formData.decimalPlaces} onChange={e => update('decimalPlaces', parseInt(e.target.value))}>
                  {[0,1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 2 && (
            <div className={styles.featuresGrid}>
              <p className={styles.featuresHint}>Select the features to enable for this company. You can change these later in Company Features (F11).</p>
              {Object.entries(formData.features).map(([feat, enabled]) => (
                <label key={feat} className={styles.featureRow}>
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={e => updateFeature(feat, e.target.checked)}
                  />
                  <span className={styles.featureLabel}>{FEATURE_LABELS[feat] || feat}</span>
                </label>
              ))}
              {serverError && <div className={styles.serverErr}>{serverError}</div>}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          {step > 0 && <button className={styles.backBtn} onClick={() => setStep(s => s - 1)}>← Back</button>}
          <span style={{flex:1}}/>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          {step < STEPS.length - 1
            ? <button className={styles.nextBtn} onClick={handleNext}>Next →</button>
            : <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>{saving ? 'Creating...' : 'Create Company'}</button>
          }
        </div>
      </div>
    </div>
  );
}

const FEATURE_LABELS = {
  inventory: 'Inventory Management',
  taxation: 'GST / VAT Taxation',
  payroll: 'Payroll Management',
  costCenters: 'Cost Centers & Categories',
  multiCurrency: 'Multi-Currency Support',
  billWise: 'Bill-wise Details',
  banking: 'Banking & Reconciliation',
  budgets: 'Budgets & Scenarios',
};
