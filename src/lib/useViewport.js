import { useEffect, useState } from "react";

/**
 * Hook responsive — detecta tamaño de pantalla en vivo
 * Breakpoints:
 *   isMobile  < 768px
 *   isTablet  768-1099px
 *   isDesktop >= 1100px
 */
export function useViewport() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);
  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return {
    w,
    isMobile:  w < 768,
    isTablet:  w >= 768 && w < 1100,
    isDesktop: w >= 1100,
  };
}
