import api from './axios'

export const toggleBookmark = (eventId) =>
  api.post(`/bookmarks/${eventId}`).then(r => r.data)

export const getMyBookmarks = () =>
  api.get('/bookmarks').then(r => r.data)

export const getBookmarkIds = () =>
  api.get('/bookmarks/ids').then(r => r.data)
