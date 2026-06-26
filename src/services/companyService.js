import axios from 'axios';

const BASE = '/api/companies';

const companyService = {
  async listCompanies() {
    const res = await axios.get(BASE);
    return res.data; // array of company objects
  },
  async openCompany(companyId) {
    const res = await axios.post(`${BASE}/${companyId}/open`);
    return res.data; // full company object
  },
  async createCompany(data) {
    const res = await axios.post(BASE, data);
    return res.data;
  },
  async updateCompany(companyId, data) {
    const res = await axios.put(`${BASE}/${companyId}`, data);
    return res.data;
  },
  async shutCompany(companyId) {
    await axios.post(`${BASE}/${companyId}/shut`);
  },
  async getCompanyFeatures(companyId) {
    const res = await axios.get(`${BASE}/${companyId}/features`);
    return res.data;
  },
  async updateCompanyFeatures(companyId, features) {
    const res = await axios.put(`${BASE}/${companyId}/features`, features);
    return res.data;
  },
  async getSecuritySettings(companyId) {
    const res = await axios.get(`${BASE}/${companyId}/security`);
    return res.data;
  },
  async updateSecuritySettings(companyId, settings) {
    const res = await axios.put(`${BASE}/${companyId}/security`, settings);
    return res.data;
  },
  async listUsers(companyId) {
    const res = await axios.get(`${BASE}/${companyId}/users`);
    return res.data;
  },
  async createUser(companyId, userData) {
    const res = await axios.post(`${BASE}/${companyId}/users`, userData);
    return res.data;
  },
  async updateUser(companyId, userId, userData) {
    const res = await axios.put(`${BASE}/${companyId}/users/${userId}`, userData);
    return res.data;
  },
  async getLicenseInfo() {
    const res = await axios.get('/api/license');
    return res.data;
  },
  async setEncryption(companyId, encryptionData) {
    const res = await axios.post(`${BASE}/${companyId}/encrypt`, encryptionData);
    return res.data;
  },
};

export default companyService;
