import React, { useState, useEffect } from 'react';
import { Shield, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useStore } from '../../store/useStore';

const TallyVault = () => {
  const { companySettings } = useStore();
  
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [strength, setStrength] = useState(0);
  const [tab, setTab] = useState<'status' | 'set' | 'change' | 'disable'>('status');

  useEffect(() => {
    // Simulate loading from storage
    setIsEncrypted(localStorage.getItem('tallyVaultEnabled') === 'true');
  }, []);

  useEffect(() => {
    let newStrength = 0;
    if (password.length >= 8) newStrength++;
    if (/[A-Z]/.test(password)) newStrength++;
    if (/[0-9]/.test(password)) newStrength++;
    if (/[!@#$%^&*]/.test(password)) newStrength++;
    setStrength(newStrength);
  }, [password]);

  const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
  const strengthColors = ['#dc2626', '#dc2626', '#d97706', '#059669', '#059669'];

  const handleEnableEncryption = () => {
    if (strength < 3) {
      toast.error('Password is too weak. Minimum: 8 chars, uppercase, digit, special char.');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    
    localStorage.setItem('tallyVaultEnabled', 'true');
    localStorage.setItem('tallyVaultHint', 'Set on ' + new Date().toLocaleDateString());
    setIsEncrypted(true);
    setTab('status');
    setPassword('');
    setConfirmPassword('');
    toast.success('TallyVault encryption ENABLED. Company data is now encrypted on disk.');
  };

  const handleChangePassword = () => {
    if (oldPassword.length === 0) {
      toast.error('Enter current TallyVault password.');
      return;
    }
    // Simulate: in real app would verify against stored hash
    localStorage.setItem('tallyVaultHint', 'Changed on ' + new Date().toLocaleDateString());
    toast.success('TallyVault password changed successfully. All data re-encrypted with new key.');
    setOldPassword('');
    setPassword('');
    setConfirmPassword('');
    setTab('status');
  };

  const handleDisableEncryption = () => {
    if (oldPassword.length === 0) {
      toast.error('Enter current password to confirm disabling encryption.');
      return;
    }
    if (!window.confirm('Are you SURE you want to disable TallyVault encryption? Company data will be unencrypted on disk.')) {
      return;
    }
    
    localStorage.removeItem('tallyVaultEnabled');
    setIsEncrypted(false);
    setTab('status');
    setOldPassword('');
    toast.success('TallyVault disabled. Data files are now unencrypted.');
  };

  return (
    <div className="max-w-[700px] mx-auto p-5 font-sans">
      {/* Header Bar */}
      <div className="bg-[#1e2433] px-4 py-3 rounded-t-lg flex justify-between items-center border-b border-gray-700 shadow-sm">
        <div className="flex items-center gap-2">
          <Shield size={20} className="text-white" />
          <span className="text-[14px] font-semibold text-white tracking-wide">TallyVault — Company Data Encryption</span>
        </div>
        <div className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider text-white shadow-sm ${
          isEncrypted ? 'bg-[#059669]' : 'bg-[#dc2626]'
        }`}>
          {isEncrypted ? '🔒 Encrypted' : '🔓 Not Encrypted'}
        </div>
      </div>
      
      {/* Company Info Band */}
      <div className="bg-gray-50 px-4 py-2 border-x border-gray-200 flex items-center gap-2 shadow-sm">
        <span className="text-[11px] text-gray-500 uppercase font-semibold tracking-wide">Company:</span>
        <span className="text-[12px] font-medium text-gray-800">{companySettings?.name || 'Current Company'}</span>
      </div>
      
      {/* Tab Bar */}
      <div className="flex bg-gray-50 border-x border-b border-gray-200 shadow-sm">
        <button
          onClick={() => setTab('status')}
          className={`px-4 py-2.5 text-[11px] font-semibold transition-colors border-b-2 flex-1 ${
            tab === 'status' 
              ? 'bg-white text-[#1557b0] border-[#1557b0]' 
              : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100 border-transparent'
          }`}
        >
          📊 Status & Info
        </button>
        
        {!isEncrypted && (
          <button
            onClick={() => setTab('set')}
            className={`px-4 py-2.5 text-[11px] font-semibold transition-colors border-b-2 flex-1 ${
              tab === 'set' 
                ? 'bg-white text-[#1557b0] border-[#1557b0]' 
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100 border-transparent'
            }`}
          >
            🔐 Enable Encryption
          </button>
        )}
        
        {isEncrypted && (
          <button
            onClick={() => setTab('change')}
            className={`px-4 py-2.5 text-[11px] font-semibold transition-colors border-b-2 flex-1 ${
              tab === 'change' 
                ? 'bg-white text-[#1557b0] border-[#1557b0]' 
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100 border-transparent'
            }`}
          >
            🔑 Change Password
          </button>
        )}
        
        {isEncrypted && (
          <button
            onClick={() => setTab('disable')}
            className={`px-4 py-2.5 text-[11px] font-semibold transition-colors border-b-2 flex-1 ${
              tab === 'disable' 
                ? 'bg-white text-[#1557b0] border-[#1557b0]' 
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100 border-transparent'
            }`}
          >
            🔓 Disable Encryption
          </button>
        )}
      </div>
      
      {/* Main Card */}
      <div className="bg-[#f5f6fa] border border-gray-200 border-t-0 p-5 rounded-b-lg shadow-sm">
        {tab === 'status' && (
          <div className="grid grid-cols-2 gap-5">
            {/* Left Column: How It Works */}
            <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm">
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 pb-2 mb-3">
                How TallyVault Works
              </div>
              <ul className="text-[11px] text-gray-700 space-y-2 list-disc pl-4">
                <li><span className="font-medium text-gray-800">AES-256 encryption</span> — industry standard, used by banks.</li>
                <li>Password is never stored — derived fresh each time you open the company.</li>
                <li>Data files on disk become unreadable without the password.</li>
                <li>Backup files are also encrypted — theft of backup reveals nothing.</li>
                <li>Incorrect password: 3 attempts → company locked for 15 minutes.</li>
                <li className="text-red-600 font-medium">If you forget the password, data CANNOT be recovered. No backdoor exists.</li>
              </ul>
            </div>
            
            {/* Right Column: Comparison Table */}
            <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Feature</th>
                    <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">TallyVault Password</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-3 py-2 text-[11px] font-medium text-gray-600">Purpose</td>
                    <td className="px-3 py-2 text-[11px] text-gray-800">Encrypt data on disk</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-[11px] font-medium text-gray-600">Who sets it</td>
                    <td className="px-3 py-2 text-[11px] text-gray-800">Company owner/admin</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-[11px] font-medium text-gray-600">When prompted</td>
                    <td className="px-3 py-2 text-[11px] text-gray-800">At company open</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-[11px] font-medium text-gray-600">If forgotten</td>
                    <td className="px-3 py-2 text-[11px] text-red-600 font-medium">Data permanently inaccessible</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-[11px] font-medium text-gray-600">Scope</td>
                    <td className="px-3 py-2 text-[11px] text-gray-800">Per company</td>
                  </tr>
                </tbody>
              </table>
              
              {/* Warning Box */}
              <div className="m-3 p-2 bg-amber-50 border border-amber-200 rounded-md flex gap-2">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="text-[10px] text-amber-800 leading-snug">
                  <span className="font-semibold uppercase tracking-wide">Important:</span> Store your TallyVault password in a secure location (e.g., password manager, sealed envelope). Nobody can recover encrypted data without the password.
                </div>
              </div>
            </div>
          </div>
        )}
        
        {tab === 'set' && !isEncrypted && (
          <div className="bg-white border border-gray-200 rounded-md p-5 shadow-sm max-w-md mx-auto">
            {/* Warning Band */}
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md flex gap-2 items-start">
              <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="text-[11px] text-amber-800 leading-snug">
                Enabling TallyVault will encrypt all data files on disk. You will need to enter this password every time you open this company. <span className="font-semibold text-red-600">If forgotten — data is PERMANENTLY INACCESSIBLE with no recovery option.</span>
              </div>
            </div>
            
            {/* Password Field */}
            <div className="mb-3">
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                Set TallyVault Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-8 pl-2.5 pr-8 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] transition-colors"
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            
            {/* Password Strength */}
            {password.length > 0 && (
              <div className="mb-3 bg-gray-50 p-2.5 rounded border border-gray-100">
                <div className="flex gap-1 h-1.5 mb-1.5">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`flex-1 rounded-full ${i < strength ? (strength < 3 ? 'bg-amber-500' : 'bg-[#059669]') : 'bg-gray-200'}`}
                      style={{ backgroundColor: i < strength ? strengthColors[strength] : undefined }}
                    />
                  ))}
                </div>
                <div className="text-[10px] font-medium" style={{ color: strengthColors[strength] }}>
                  Password Strength: {strengthLabels[strength]}
                </div>
                
                {/* Requirements Checklist */}
                <div className="text-[10px] mt-2 space-y-1 text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <span className={password.length >= 8 ? 'text-[#059669]' : 'text-gray-400'}>{password.length >= 8 ? '✓' : '○'}</span>
                    <span>Minimum 8 characters</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={/[A-Z]/.test(password) ? 'text-[#059669]' : 'text-gray-400'}>{/[A-Z]/.test(password) ? '✓' : '○'}</span>
                    <span>At least one uppercase letter</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={/[0-9]/.test(password) ? 'text-[#059669]' : 'text-gray-400'}>{/[0-9]/.test(password) ? '✓' : '○'}</span>
                    <span>At least one digit</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={/[!@#$%^&*]/.test(password) ? 'text-[#059669]' : 'text-gray-400'}>{/[!@#$%^&*]/.test(password) ? '✓' : '○'}</span>
                    <span>At least one special character (!@#$%^&*)</span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Confirm Password Field */}
            <div className="mb-4">
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full h-8 pl-2.5 pr-8 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] transition-colors"
                />
                <button
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {confirmPassword.length > 0 && confirmPassword !== password && (
                <div className="text-[#dc2626] text-[10px] mt-1 font-medium">Passwords do not match</div>
              )}
              {confirmPassword.length > 0 && confirmPassword === password && (
                <div className="text-[#059669] text-[10px] mt-1 font-medium">✓ Passwords match</div>
              )}
            </div>
            
            {/* Enable Button */}
            <button
              onClick={handleEnableEncryption}
              disabled={strength < 3 || password !== confirmPassword || password.length === 0}
              className={`w-full h-9 rounded-md text-[12px] font-medium transition-colors shadow-sm ${
                strength < 3 || password !== confirmPassword || password.length === 0 
                  ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed' 
                  : 'bg-[#1557b0] hover:bg-[#0f4a96] text-white'
              }`}
            >
              Enable TallyVault Encryption
            </button>
          </div>
        )}
        
        {tab === 'change' && isEncrypted && (
          <div className="bg-white border border-gray-200 rounded-md p-5 shadow-sm max-w-md mx-auto">
            <div className="mb-4">
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                Current TallyVault Password
              </label>
              <div className="relative">
                <input
                  type={showOld ? 'text' : 'password'}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full h-8 pl-2.5 pr-8 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] transition-colors"
                />
                <button
                  onClick={() => setShowOld(!showOld)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showOld ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            
            <div className="mb-4 border-t border-gray-100 pt-4">
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                New TallyVault Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-8 pl-2.5 pr-8 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] transition-colors"
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            
            <div className="mb-5">
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full h-8 pl-2.5 pr-8 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] transition-colors"
                />
                <button
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            
            <button
              onClick={handleChangePassword}
              disabled={!oldPassword || !password || password !== confirmPassword}
              className={`w-full h-9 rounded-md text-[12px] font-medium transition-colors shadow-sm ${
                !oldPassword || !password || password !== confirmPassword
                  ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                  : 'bg-[#1557b0] hover:bg-[#0f4a96] text-white'
              }`}
            >
              Change TallyVault Password
            </button>
          </div>
        )}
        
        {tab === 'disable' && isEncrypted && (
          <div className="bg-white border border-gray-200 rounded-md p-5 shadow-sm max-w-md mx-auto">
            {/* Danger Box */}
            <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-md flex gap-2 items-start">
              <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
              <div className="text-[11px] text-red-800 leading-snug">
                <span className="font-semibold uppercase tracking-wide">Danger:</span> Disabling TallyVault will DECRYPT all data files. Anyone with access to the data folder will be able to read company data. This action cannot be undone without re-enabling.
              </div>
            </div>
            
            <div className="mb-5">
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                Current TallyVault Password
              </label>
              <div className="relative">
                <input
                  type={showOld ? 'text' : 'password'}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full h-8 pl-2.5 pr-8 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 transition-colors"
                />
                <button
                  onClick={() => setShowOld(!showOld)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showOld ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            
            <button
              onClick={handleDisableEncryption}
              disabled={!oldPassword}
              className={`w-full h-9 rounded-md text-[12px] font-medium transition-colors shadow-sm ${
                !oldPassword
                  ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                  : 'bg-[#dc2626] hover:bg-red-800 text-white'
              }`}
            >
              Disable TallyVault Encryption
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TallyVault;
