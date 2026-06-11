import { Component, ReactNode } from 'react';

interface Props {
  /** rendered instead of children if the canvas crashes */
  fallback: ReactNode;
  children: ReactNode;
}

/**
 * Error boundary around R3F canvases. Without it, a WebGL context
 * failure throws during render and React 18 unmounts the ENTIRE app —
 * the user sees a permanently black page. With it, the screen degrades
 * to its DOM fallback and the rest of the site keeps working.
 */
export default class GLBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
