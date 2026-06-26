import axios from 'axios';
const BASE = '/api/data';

const dataService = {
  async backup(options) {
    const res = await axios.post(`${BASE}/backup`, options);
    return res.data;
  },
  async restore(options) {
    const res = await axios.post(`${BASE}/restore`, options);
    return res.data;
  },
  async migrate(companyId) {
    const res = await axios.post(`${BASE}/migrate`, { companyId });
    return res.data;
  },
  async splitCompany(options) {
    const res = await axios.post(`${BASE}/split`, options);
    return res.data;
  },
  async repair(companyId, mode) {
    const res = await axios.post(`${BASE}/repair`, { companyId, mode });
    return res.data;
  },
  async cloudBackup(options) {
    const res = await axios.post(`${BASE}/cloud-backup`, options);
    return res.data;
  },
  async getBackupHistory(companyId) {
    const res = await axios.get(`${BASE}/backup-history/${companyId}`);
    return res.data;
  },
};

export default dataService;
