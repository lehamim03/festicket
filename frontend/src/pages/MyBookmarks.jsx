import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getMyBookmarks } from '../api/bookmarks'
import { getBookmarkIds } from '../api/bookmarks'
import EventCard from '../components/EventCard'

export default function MyBookmarks() {
  const { data: bookmarks = [], isLoading } = useQuery({
    queryKey: ['my-bookmarks'],
    queryFn: getMyBookmarks,
  })

  const { data: bookmarkedIds = [] } = useQuery({
    queryKey: ['bookmark-ids'],
    queryFn: getBookmarkIds,
    staleTime: 60000,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">즐겨찾기</h1>
          <p className="text-sm text-gray-400 mt-1">북마크한 행사 목록입니다.</p>
        </div>
        <span className="text-sm font-semibold text-gray-500">
          총 {bookmarks.length}개
        </span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-64 bg-gray-100 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : bookmarks.length === 0 ? (
        <div className="text-center py-24 space-y-4">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </div>
          <p className="text-gray-400 font-medium">즐겨찾기한 행사가 없습니다.</p>
          <Link to="/" className="inline-block text-sm font-semibold text-primary-600 hover:underline">
            행사 둘러보기 →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {bookmarks.map(event => (
            <EventCard key={event.id} event={event} bookmarkedIds={bookmarkedIds} />
          ))}
        </div>
      )}
    </div>
  )
}
