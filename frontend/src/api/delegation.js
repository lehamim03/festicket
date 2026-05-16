import api from './axios'

export const submitDelegation = (toUserId) =>
  api.post('/delegations', { toUserId }).then(r => r.data)

export const getMyDelegations = () =>
  api.get('/delegations/mine').then(r => r.data)

export const cancelDelegation = (id) =>
  api.delete(`/delegations/${id}`).then(r => r.data)

export const getSchoolDelegations = () =>
  api.get('/delegations/school').then(r => r.data)

export const approveDelegation = (id) =>
  api.post(`/delegations/${id}/approve`).then(r => r.data)

export const rejectDelegation = (id, reason) =>
  api.post(`/delegations/${id}/reject`, { reason }).then(r => r.data)
