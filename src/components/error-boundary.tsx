'use client'
import React from 'react'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error)
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="min-h-[400px] flex items-center justify-center">
          <div className="max-w-lg p-6 bg-red-50 border border-red-200 rounded-xl text-center">
            <p className="font-semibold text-red-800 mb-2">Error Terjadi</p>
            <pre className="text-xs text-left bg-white p-4 rounded-lg overflow-auto max-h-60 border border-red-100">
              {this.state.error?.message}
              {'\n\n'}
              {this.state.errorInfo?.componentStack}
            </pre>
            <button
              className="mt-4 px-4 py-2 bg-red-100 text-red-800 rounded-lg text-sm"
              onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
            >
              Coba Lagi
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
