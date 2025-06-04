/**
 * Animation hooks using react-spring.
 * 
 * IMPORTANT:
 * - These hooks MUST be called inside React function components or other custom hooks.
 * - Do NOT call them at the top level of a module or outside a component.
 * - Using them during SSR (server-side rendering) will cause errors.
 */
"use client";
import { useSpring } from 'react-spring';

// Utility to check if running on the client (browser)
const isClient = typeof window !== 'undefined';

/**
 * Fade in animation hook.
 * @param {number} delay - Delay in ms before animation starts.
 * @returns {object} Spring style object.
 */
export const useFadeIn = (delay = 0) => {
  if (!isClient) return {}; // Prevent SSR errors
  return useSpring({
    from: { opacity: 0 },
    to: { opacity: 1 },
    delay,
    config: { tension: 220, friction: 20 }
  });
};

/**
 * Slide in animation hook.
 * @param {'left'|'right'|'top'|'bottom'} direction - Slide direction.
 * @param {number} delay - Delay in ms before animation starts.
 * @returns {object} Spring style object.
 */
export const useSlideIn = (direction = 'left', delay = 0) => {
  if (!isClient) return {};
  const from = {
    left: { transform: 'translateX(-50px)' },
    right: { transform: 'translateX(50px)' },
    top: { transform: 'translateY(-50px)' },
    bottom: { transform: 'translateY(50px)' }
  }[direction] || { transform: 'translateX(-50px)' };

  // Determine axis for 'to' value
  const to =
    direction === 'top' || direction === 'bottom'
      ? { transform: 'translateY(0)' }
      : { transform: 'translateX(0)' };

  return useSpring({
    from,
    to,
    delay,
    config: { tension: 300, friction: 20 }
  });
};

/**
 * Hover scale animation hook.
 * @param {number} scaleTo - Scale factor on hover.
 * @returns {[object, any]} Event handlers and scale value.
 */
export const useHoverScale = (scaleTo = 1.05) => {
  if (!isClient) return [{}, 1];
  const [props, set] = useSpring(() => ({
    scale: 1,
    config: { mass: 1, tension: 300, friction: 10 }
  }));

  return [
    {
      onMouseEnter: () => set({ scale: scaleTo }),
      onMouseLeave: () => set({ scale: 1 })
    },
    props.scale
  ];
};

/**
 * Table row animation hook.
 * @returns {object} Spring style object.
 */
export const useTableAnimation = () => {
  if (!isClient) return {};
  return useSpring({
    from: { opacity: 0, transform: 'translateY(20px)' },
    to: { opacity: 1, transform: 'translateY(0)' },
    config: { tension: 280, friction: 20 }
  });
};

/**
 * Rotate animation hook.
 * @param {boolean} active - Whether to rotate.
 * @returns {object} Spring style object.
 */
export const useRotate = (active) => {
  if (!isClient) return {};
  return useSpring({
    transform: active ? 'rotate(180deg)' : 'rotate(0deg)',
    config: { tension: 300, friction: 20 }
  });
};