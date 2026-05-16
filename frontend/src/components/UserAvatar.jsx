export default function UserAvatar({ user, size = 'sm', className = '' }) {
  const sizeClass = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-10 h-10 text-base',
    xl: 'w-20 h-20 text-3xl',
  }[size] ?? 'w-7 h-7 text-xs'

  const initials = user?.name?.slice(0, 1) ?? '?'

  return (
    <div className={`rounded-full overflow-hidden bg-primary-100 flex items-center justify-center shrink-0 ${sizeClass} ${className}`}>
      {user?.profileImageUrl ? (
        <img src={user.profileImageUrl} alt={user.name} className="w-full h-full object-cover" />
      ) : (
        <span className="font-bold text-primary-700">{initials}</span>
      )}
    </div>
  )
}
