/**
 * Detecção de WebGL.
 *
 * Vive num módulo próprio (e não junto da cena) porque o chamador precisa
 * consultar isso ANTES de decidir carregar o three.js — importar da cena
 * anularia o lazy-loading e traria o bundle 3D para o carregamento inicial.
 */
export function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')),
    );
  } catch {
    return false;
  }
}
