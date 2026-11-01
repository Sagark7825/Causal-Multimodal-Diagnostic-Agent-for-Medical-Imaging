/**
 * MRI Service
 * ============
 * Modular client-side service handling MRI laboratory data queries and analysis workflows.
 * Keeps App.jsx clean and avoids duplication.
 */

import axios from 'axios';

export const mriService = {
  /**
   * Fetches only MRI-assigned or MRI-requested cases from the system
   */
  async getMRICases(apiBase, token) {
    const res = await axios.get(`${apiBase}/patients/cases/all`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.data && res.data.success) {
      // Filter cases where modality is 'MRI' or 'Brain MRI'
      const mriCases = res.data.cases.filter(
        c => c.modality === 'MRI' || c.modality === 'Brain MRI'
      );
      return mriCases;
    }
    return [];
  },

  /**
   * Uploads an MRI scan and triggers automatic analysis
   */
  async uploadMRIScan(apiBase, token, caseId, file) {
    const formData = new FormData();
    formData.append('caseId', caseId);
    formData.append('file', file);

    const res = await axios.post(`${apiBase}/reports/upload`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data'
      }
    });
    return res.data;
  },

  /**
   * Triggers AI analysis on an existing uploaded MRI report
   */
  async triggerAI(apiBase, token, reportId) {
    const res = await axios.post(`${apiBase}/reports/${reportId}/run-ai`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.data;
  },

  /**
   * Submits radiologist review and observation for an MRI study
   */
  async submitObservation(apiBase, token, reportId, radiologistObservation, action = 'Accept AI') {
    const res = await axios.post(`${apiBase}/reports/${reportId}/observation`, {
      radiologistObservation,
      action
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.data;
  }
};

export default mriService;
