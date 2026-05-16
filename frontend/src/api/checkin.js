import api from './axios'

export const checkin = async (qrCode, eventId) => {
  const res = await api.post('/v1/checkin', { qrCode, eventId })
  return res.data
}

export const getCheckinStats = async (eventId) => {
  const res = await api.get(`/v1/checkin/${eventId}/stats`)
  return res.data
}
