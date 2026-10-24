import { userInitials } from './data/userInitials'

export function UserAvatar({ name, language }: {
  name: string
  language: 'en' | 'fr'
}) {
  const label = name || (language === 'fr' ? 'Utilisateur' : 'User')
  return (
    <span className="user-avatar small-avatar" role="img" aria-label={label} title={label}>
      <span aria-hidden="true">{userInitials(name)}</span>
    </span>
  )
}
