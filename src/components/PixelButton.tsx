import { ButtonHTMLAttributes } from 'react';
import styles from './PixelButton.module.css';
import { audio } from '../sound/AudioEngine';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  color?: 'green' | 'amber' | 'magenta';
  selected?: boolean;
  /** play the coin-insertion sfx on hover (title prompt) */
  coinHover?: boolean;
}

export default function PixelButton({ color = 'green', selected, coinHover, onMouseEnter, onClick, className, children, ...rest }: Props) {
  const colorClass = color === 'green' ? '' : styles[color];
  return (
    <button
      className={`${styles.btn} ${colorClass} ${selected ? styles.selected : ''} ${className ?? ''}`}
      onMouseEnter={(e) => {
        if (coinHover) audio.coin();
        else audio.cursor();
        onMouseEnter?.(e);
      }}
      onClick={(e) => {
        audio.confirm();
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
