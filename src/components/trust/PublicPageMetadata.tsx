import { useEffect } from 'react';

const PUBLIC_ORIGIN = 'https://www.getshipseal.com';

export function PublicPageMetadata({ title, description, path }: { title: string; description: string; path: string }) {
  useEffect(() => {
    document.title = `${title} · ShipSeal`;
    setMeta('description', description);
    setMeta('og:title', `${title} · ShipSeal`, 'property');
    setMeta('og:description', description, 'property');
    setCanonical(`${PUBLIC_ORIGIN}${path}`);
  }, [description, path, title]);
  return null;
}

function setMeta(name: string, content: string, attribute: 'name' | 'property' = 'name') {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${name}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, name);
    document.head.appendChild(element);
  }
  element.content = content;
}

function setCanonical(href: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = document.createElement('link');
    element.rel = 'canonical';
    document.head.appendChild(element);
  }
  element.href = href;
}
