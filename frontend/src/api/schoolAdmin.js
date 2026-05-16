import api from './axios'

export const getMySchoolUsers = (search) =>
  api.get('/school-admin/users', { params: search ? { search } : {} }).then(r => r.data)

export const updateMySchoolUserRole = (userId, role, memo) =>
  api.put(`/school-admin/users/${userId}/role`, { role, memo }).then(r => r.data)

export const getSchoolUserRegistrations = (userId) =>
  api.get(`/school-admin/users/${userId}/registrations`).then(r => r.data)

export const updateSchoolContact = (adminContact) =>
  api.put('/school-admin/contact', { adminContact }).then(r => r.data)

export const getSchoolAuditLogs = () =>
  api.get('/school-admin/audit-logs').then(r => r.data)
