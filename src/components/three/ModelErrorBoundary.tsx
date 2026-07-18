import React from 'react';

/**
 * ErrorBoundary de cena: se o carregamento do .glb falhar, renderiza o fallback
 * em vez de derrubar a árvore inteira — a tela nunca quebra.
 *
 * Extraído do MotorViewer para ser compartilhado com a planta 3D.
 */
export class ModelErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode; onError?: () => void },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(err: unknown) {
    console.warn('[3d] falha ao carregar o modelo, usando fallback de primitivos:', err);
    this.props.onError?.();
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
