// All recovered and new components share the same pinned React instance.
import { u } from './vendor/react-foundation.js';
import type * as ReactTypes from 'react';
export const React = u() as typeof ReactTypes;
