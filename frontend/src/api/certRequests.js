import api from './axios'

export const submitCertRequest = ({ message, organization, contact, organizationType, expiresAt, targetAdminId }) =>
  api.post('/cert-requests', {
    message, organization, contact, organizationType,
    expiresAt: expiresAt || undefined,
    targetAdminId: targetAdminId === '__OPERATOR__' ? null : targetAdminId,
  }).then(r => r.data)

export const getSchoolAdmins = () =>
  api.get('/cert-requests/admins').then(r => r.data)

export const getMyCertRequests = () =>
  api.get('/cert-requests/mine').then(r => r.data)

export const cancelCertRequest = (id) =>
  api.delete(`/cert-requests/${id}`).then(r => r.data)

export const getSchoolCertRequests = () =>
  api.get('/school-admin/cert-requests').then(r => r.data)

export const approveCertRequest = (id, memo) =>
  api.post(`/school-admin/cert-requests/${id}/approve`, { memo }).then(r => r.data)

export const rejectCertRequest = (id, reason) =>
  api.post(`/school-admin/cert-requests/${id}/reject`, { reason }).then(r => r.data)

export const getAdminAllCertRequests = (params = {}) =>
  api.get('/admin/cert-requests', { params }).then(r => r.data)

export const adminApproveCertRequest = (id, memo) =>
  api.post(`/admin/cert-requests/${id}/approve`, { memo }).then(r => r.data)

export const adminRejectCertRequest = (id, reason) =>
  api.post(`/admin/cert-requests/${id}/reject`, { reason }).then(r => r.data)
