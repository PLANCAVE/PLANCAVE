// types/image.d.ts
import 'next/image';

// Extend the built-in NextJS Image component types
declare module 'next/image' {
  interface ImageProps {
    // Define explicitly allowed props (helps catch misspellings)
    src: string;
    alt?: string;
    width?: number;
    height?: number;
    fill?: boolean;
    sizes?: string;
    quality?: number;
    priority?: boolean;
    placeholder?: 'blur' | 'empty';
    style?: React.CSSProperties;
    className?: string;
    onLoad?: React.ReactEventHandler<HTMLImageElement>;
    onError?: React.ReactEventHandler<HTMLImageElement>;
    
    // Explicitly disallow certain props that cause issues
    fetchPriority?: never; // This will cause a TypeScript error if someone tries to use this prop
  }
}

// Custom image component props type
export interface CustomImageProps {
  src: string;
  alt?: string;
  className?: string;
  width?: number | string;
  height?: number | string;
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  onError?: React.ReactEventHandler<HTMLImageElement>;
  onLoad?: React.ReactEventHandler<HTMLImageElement>;
  loading?: 'eager' | 'lazy';
  // Add fetchpriority as lowercase if needed
  fetchpriority?: 'high' | 'low' | 'auto';
}