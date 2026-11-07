import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function useFocusMain() {
  const { pathname } = useLocation();

  useEffect(() => {
    // A slight delay ensures the new route has rendered
    const timeout = setTimeout(() => {
      const main = document.getElementById('main-content');
      if (main) {
        // Only focus if the active element is not already inside main
        if (!main.contains(document.activeElement)) {
          main.focus({ preventScroll: true });
        }
      }
    }, 50);

    return () => clearTimeout(timeout);
  }, [pathname]);
}
