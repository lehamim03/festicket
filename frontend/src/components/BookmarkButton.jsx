import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toggleBookmark } from '../api/bookmarks'
import { useAuth } from '../hooks/useAuth'
import { useToast } from './Toast'

export default function BookmarkButton({ eventId, isBookmarked, className = '' }) {
  const { user } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => toggleBookmark(eventId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bookmark-ids'] })
      queryClient.invalidateQueries({ queryKey: ['my-bookmarks'] })
      toast(data.bookmarked ? '즐겨찾기에 추가했습니다.' : '즐겨찾기를 해제했습니다.', 'success')
    },
    onError: () => toast('로그인이 필요합니다.', 'error'),
  })

  if (!user) return null

  return (
    <button
      onClick={e => { e.preventDefault(); e.stopPropagation(); mutation.mutate() }}
      disabled={mutation.isPending}
      className={`flex items-center justify-center transition ${className}`}
      aria-label={isBookmarked ? '즐겨찾기 해제' : '즐겨찾기 추가'}
    >
      <svg
        className={`w-5 h-5 transition-all duration-150 ${isBookmarked ? 'text-amber-400 fill-amber-400 scale-110' : 'text-gray-300 fill-transparent hover:text-amber-300'}`}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
    </button>
  )
}
