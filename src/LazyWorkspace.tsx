import { Component, Suspense, createElement, lazy, type ComponentType, type LazyExoticComponent } from 'react'

type Props<P extends object> = {
  load: () => Promise<{ default: ComponentType<P> }>
  workspaceProps: P
  language: 'en' | 'fr'
}
type State<P extends object> = {
  Workspace: LazyExoticComponent<ComponentType<P>>
  error?: Error
}

export class LazyWorkspace<P extends object> extends Component<Props<P>, State<P>> {
  constructor(props: Props<P>) {
    super(props)
    this.state = { Workspace: lazy(props.load) }
  }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    const french = this.props.language === 'fr'
    if (this.state.error) {
      return <div className="error-box" role="alert">
        <strong>{french ? 'Impossible de charger cet espace de travail.' : 'Could not load this workspace.'}</strong>
        <span>{this.state.error.message}</span>
        <button className="button secondary" onClick={() => this.setState({
          Workspace: lazy(this.props.load), error: undefined,
        })}>{french ? 'Réessayer' : 'Retry'}</button>
      </div>
    }
    return <Suspense fallback={<p role="status" className="inline-state">
      {french ? 'Chargement de l’espace de travail…' : 'Loading workspace…'}
    </p>}>{createElement(this.state.Workspace, this.props.workspaceProps)}</Suspense>
  }
}
