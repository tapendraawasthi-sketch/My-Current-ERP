import axios from 'axios';
const BASE = '/api/export';

const exportService = {
  async exportCurrentScreen(format, options, context) {
    const res = await axios.post(`${BASE}/current`, { format, options, context }, { responseType: 'blob' });
    downloadBlob(res.data, options.fileName, format);
    return { success: true, fileName: options.fileName };
  },
  async exportMasters(masterType, format, filters) {
    const res = await axios.post(`${BASE}/masters`, { masterType, format, filters }, { responseType: 'blob' });
    downloadBlob(res.data, `${masterType}_export.${format}`, format);
  },
  async exportTransactions(filters, format) {
    const res = await axios.post(`${BASE}/transactions`, { filters, format }, { responseType: 'blob' });
    downloadBlob(res.data, `transactions_export.${format}`, format);
  },
  async exportReport(reportType, format, options) {
    const res = await axios.post(`${BASE}/report`, { reportType, format, options }, { responseType: 'blob' });
    downloadBlob(res.data, `${reportType}.${format}`, format);
  },
  async getExportLogs(companyId) {
    const res = await axios.get(`${BASE}/logs/${companyId}`);
    return res.data;
  },
};

function downloadBlob(blob, fileName, format) {
  const mimeTypes = { pdf:'application/pdf', xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', csv:'text/csv', json:'application/json', xml:'application/xml' };
  const url = URL.createObjectURL(new Blob([blob], { type: mimeTypes[format] || 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url; a.download = fileName; a.click();
  URL.revokeObjectURL(url);
}

export default exportService;
