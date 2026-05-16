import api from './axios'

export const submitCertRequest = ({ message, organization, contact, organizationType, expiresAt }) =>
  api.post('/cert-requests', { message, organization, contact, organizationType, expiresAt: expiresAt || undefined }).then(r => r.data)

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
