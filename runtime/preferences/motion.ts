import { setCharacterMotionPreference } from '../characters/scheduler';
import './motion.css';

type MotionPreference = 'auto' | 'reduce' | 'full';
let current: MotionPreference = 'auto';
const query = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
function paintPreference() {
  const reduce = current === 'reduce' || (current === 'auto' && query?.matches === true);
  if (typeof document !== 'undefined') document.documentElement.dataset.woodsReducedMotion = String(reduce);
  setCharacterMotionPreference(current);
}
export function applyMotionPreferences(value: unknown) {
  current = value === 'reduce' || value === 'full' ? value : 'auto';
  paintPreference();
}
query?.addEventListener('change', paintPreference);
paintPreference();
