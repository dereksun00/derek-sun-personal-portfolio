import { ReactNode } from 'react';
import styles from './ScanlinePanel.module.css';

interface Props {
  title?: string;
  color?: 'green' | 'amber' | 'magenta';
  className?: string;
  children: ReactNode;
}

/** Double-bordered pixel panel with baked-in scanlines, as in the original quest log. */
export default function ScanlinePanel({ title, color = 'green', className, children }: Props) {
  const colorClass = color === 'green' ? '' : styles[color];
  return (
    <div className={`${styles.panel} ${colorClass} ${className ?? ''}`}>
      {title && <div className={styles.title}>{title}</div>}
      {children}
    </div>
  );
}
