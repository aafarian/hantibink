/**
 * Admin dashboard API client. All endpoints 404 for non-admins server-side;
 * the client only calls them after GET /admin/check returns true.
 */
import apiClient from './ApiClient';

const unwrap = response => (response?.success ? response.data : null);

const AdminApiService = {
  async checkAccess() {
    try {
      const response = await apiClient.get('/admin/check');
      // null = couldn't determine (transient failure) — callers must not
      // treat it as an authoritative "not admin"
      if (!response?.success) {
        return null;
      }
      return !!response?.data?.isAdmin;
    } catch (error) {
      return null;
    }
  },

  async getOverview() {
    return unwrap(await apiClient.get('/admin/overview'));
  },

  async listUsers({ q = '', cursor = null } = {}) {
    const params = new URLSearchParams();
    if (q) {
      params.set('q', q);
    }
    if (cursor) {
      params.set('cursor', cursor);
    }
    return unwrap(await apiClient.get(`/admin/users?${params.toString()}`));
  },

  async getUserDetail(userId) {
    return unwrap(await apiClient.get(`/admin/users/${userId}`));
  },

  async banUser(userId) {
    return unwrap(await apiClient.post(`/admin/users/${userId}/ban`));
  },

  async unbanUser(userId) {
    return unwrap(await apiClient.post(`/admin/users/${userId}/unban`));
  },

  async setPremium(userId, isPremium) {
    return unwrap(await apiClient.post(`/admin/users/${userId}/premium`, { isPremium }));
  },

  async verifyEmail(userId) {
    return unwrap(await apiClient.post(`/admin/users/${userId}/verify-email`));
  },

  async listReports(status = 'PENDING') {
    return unwrap(await apiClient.get(`/admin/reports?status=${status}`));
  },

  async resolveReport(reportId, { action = 'NONE', adminNotes = '' } = {}) {
    return unwrap(
      await apiClient.post(`/admin/reports/${reportId}/resolve`, { action, adminNotes })
    );
  },

  async dismissReport(reportId, adminNotes = '') {
    return unwrap(await apiClient.post(`/admin/reports/${reportId}/dismiss`, { adminNotes }));
  },

  async listWaitlist() {
    return unwrap(await apiClient.get('/admin/waitlist'));
  },

  async getAppVersionConfig() {
    return unwrap(await apiClient.get('/admin/config/app-version'));
  },

  async publishAppVersion(config) {
    const response = await apiClient.put('/admin/config/app-version', config);
    if (!response?.success) {
      throw new Error(response?.message || 'Publish failed');
    }
    return response.data;
  },

  async getFlags() {
    return unwrap(await apiClient.get('/admin/config/flags'));
  },

  async updateFlags(flags) {
    return unwrap(await apiClient.put('/admin/config/flags', flags));
  },

  async listAudit() {
    return unwrap(await apiClient.get('/admin/audit'));
  },
};

export default AdminApiService;
