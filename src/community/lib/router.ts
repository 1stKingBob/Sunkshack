import { useEffect, useState } from 'react';

export type Route = { name: 'map' } | { name: 'upload'; placeId: string | null; report: string | null };

/** Parses `#/upload?place=...&report=<base64>` style hashes. Two screens; a library would be overkill. */
function parse(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '');
  const [path, query] = clean.split('?');
  if (path === 'upload') {
    const params = new URLSearchParams(query ?? '');
    return { name: 'upload', placeId: params.get('place'), report: params.get('report') };
  }
  return { name: 'map' };
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function goToUpload(placeId?: string) {
  window.location.hash = placeId ? `/upload?place=${encodeURIComponent(placeId)}` : '/upload';
}

export function goToMap() {
  window.location.hash = '/';
}
