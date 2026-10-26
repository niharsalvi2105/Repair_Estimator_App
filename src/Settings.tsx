import type { useUserPreferences } from './useUserPreferences'

export function Settings({ preferences, onClose }: { preferences: ReturnType<typeof useUserPreferences>; onClose: () => void }) {
  const language = preferences.language
  const fr = language === 'fr'
  return <section className="page-content settings-workspace">
    <div className="page-heading"><div><h1>{fr ? 'Paramètres' : 'Settings'}</h1>
      <p>{fr ? 'Préférences de votre compte. La langue des propositions reste indépendante.' : 'Your account preferences. Proposal language remains independent.'}</p>
    </div><button className="button secondary" onClick={onClose}>{fr ? 'Retour à l’espace de travail' : 'Return to workspace'}</button></div>
    <section className="dashboard-card settings-card">
      <label className="field-label language-control">{fr ? 'Langue' : 'Language'}
        <select className="text-input" aria-label={fr ? 'Langue' : 'Language'} value={language}
          disabled={!preferences.ready || preferences.busy} onChange={(event) => {
            const next = event.target.value
            if (next === 'en' || next === 'fr') void preferences.save({
              language: next, locale: next === 'fr' ? 'fr-CA' : 'en-US', theme: preferences.theme,
            })
          }}><option value="en">English</option><option value="fr">Français</option></select>
      </label>
      <label className="field-label language-control">{fr ? 'Thème' : 'Theme'}
        <select className="text-input" aria-label={fr ? 'Thème' : 'Theme'} value={preferences.theme}
          disabled={!preferences.ready || preferences.busy} onChange={(event) => {
            const theme = event.target.value
            if (theme === 'system' || theme === 'dark' || theme === 'light') void preferences.save({
              language, locale: preferences.locale, theme,
            })
          }}>
          <option value="system">{fr ? 'Selon le système' : 'System'}</option>
          <option value="light">{fr ? 'Mode clair' : 'Light mode'}</option>
          <option value="dark">{fr ? 'Mode sombre' : 'Dark mode'}</option>
        </select>
      </label>
    </section>
  </section>
}
