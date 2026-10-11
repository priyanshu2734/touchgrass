import { useEffect } from 'react';

const BASE = 'TouchGrass';

/** Sets the page title and meta description for the current route. */
export function useDocumentTitle(title: string, description?: string): void {
  useEffect(() => {
    document.title = title === BASE ? `${BASE} | Less scrolling. More living.` : `${title} | ${BASE}`;
    if (description) {
      let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'description';
        document.head.appendChild(meta);
      }
      meta.content = description;
    }
  }, [title, description]);
}
