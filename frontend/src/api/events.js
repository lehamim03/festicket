import api from './axios'

export const getEvents = async (schoolId) => {
  const res = await api.get('/v1/events', { params: schoolId ? { schoolId } : {} })
  return res.data
}

export const getMyEvents = async () => {
  const res = await api.get('/v1/events/mine')
  return res.data
}

export const getEvent = async (id) => {
  const res = await api.get(`/v1/events/${id}`)
  return res.data
}

export const createEvent = async (data) => {
  const res = await api.post('/v1/events', data)
  return res.data
}

export const updateEvent = async (id, data) => {
  const res = await api.put(`/v1/events/${id}`, data)
  return res.data
}

export const publishEvent = async (id) => {
  const res = await api.put(`/v1/events/${id}/publish`)
  return res.data
}

export const closeEvent = async (id) => {
  const res = await api.post(`/v1/events/${id}/close`)
  return res.data
}

export const deleteEvent = async (id) => {
  const res = await api.delete(`/v1/events/${id}`)
  return res.data
}

export const cancelEvent = async (id, cancelReason) => {
  const res = await api.post(`/v1/events/${id}/cancel`, { cancelReason })
  return res.data
}

export const getAttendees = async (id) => {
  const res = await api.get(`/v1/events/${id}/attendees`)
  return res.data
}

export const getEventRegistrations = async (id) => {
  const res = await api.get(`/v1/events/${id}/registrations`)
  return res.data
}

export const getNextRelease = async (id) => {
  const res = await api.get(`/v1/events/${id}/next-release`)
  return res.data
}

export const approveRefund = async (eventId, regId, reason) => {
  const res = await api.post(`/v1/events/${eventId}/registrations/${regId}/refund`, { cancelReason: reason })
  return res.data
}

export const searchCoHostCandidates = async (schoolId, q) => {
  const res = await api.get('/v1/events/cohost-candidates', { params: { schoolId, q } })
  return res.data
}

export const addCoHost = async (eventId, userId) => {
  const res = await api.post(`/v1/events/${eventId}/cohosts`, { userId })
  return res.data
}

export const removeCoHost = async (eventId, userId) => {
  const res = await api.delete(`/v1/events/${eventId}/cohosts/${userId}`)
  return res.data
}

export const downloadReport = async (eventId, format) => {
  const res = await api.get(`/v1/events/${eventId}/report`, {
    params: { format },
    responseType: 'blob',
  })
  const blob = res.data instanceof Blob ? res.data : new Blob([res.data])
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `report_${eventId}.${format}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => window.URL.revokeObjectURL(url), 1000)
}

export const uploadEventImage = async (file) => {
  const form = new FormData()
  form.append('image', file)
  const res = await api.post('/v1/events/upload-image', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data  // { imageUrl }
}
