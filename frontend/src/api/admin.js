import api from './axios'

export const getAdminStats = () =>
  api.get('/admin/stats').then(r => r.data)

export const getAdminUsers = (params) =>
  api.get('/admin/users', { params }).then(r => r.data)

export const editAdminUser = (userId, data) =>
  api.patch(`/admin/users/${userId}`, data).then(r => r.data)

export const getSchoolUsers = (schoolId, search) =>
  api.get(`/admin/schools/${schoolId}/users`, { params: search ? { search } : {} }).then(r => r.data)

export const updateUserRole = (userId, role, memo, organizationType) =>
  api.put(`/admin/users/${userId}/role`, { role, memo, organizationType }).then(r => r.data)

export const getUserRegistrations = (userId) =>
  api.get(`/admin/users/${userId}/registrations`).then(r => r.data)

export const getAuditLogs = (params) =>
  api.get('/admin/audit-logs', { params }).then(r => r.data)

export const cancelRegistration = (registrationId) =>
  api.post(`/admin/registrations/${registrationId}/cancel`).then(r => r.data)
