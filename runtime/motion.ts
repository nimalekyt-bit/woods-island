// Types come from the prototype package; the executable uses the pinned vendor runtime.
import { ml, od } from './vendor/motion.js';
export const AnimatePresence = ml as unknown as typeof import('framer-motion').AnimatePresence;
export const motion = od as unknown as typeof import('framer-motion').motion;
