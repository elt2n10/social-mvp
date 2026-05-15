import React, { useEffect, useState } from 'react';
import { fileUrl } from '../api/api';

export default function Lightbox({ images = [], startIndex = 0, onClose }) {
  const [index, setIndex] = useState(startIndex);
  const list = images.filter(Boolean);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (e.key === 'ArrowRight') setIndex(i => Math.min(i + 1, list.length - 1));
      if (e.key === 'ArrowLeft') setIndex(i => Math.max(i - 1, 0));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [list.length, onClose]);

  if (!list.length) return null;

  return (
    <div className="lightbox" onClick={onClose}>
      <button className="lightboxClose" onClick={onClose}>×</button>
      {list.length > 1 && index > 0 && (
        <button className="lightboxArrow left" onClick={(e) => { e.stopPropagation(); setIndex(index - 1); }}>‹</button>
      )}
      <img src={fileUrl(list[index])} alt="photo" onClick={(e) => e.stopPropagation()} />
      {list.length > 1 && index < list.length - 1 && (
        <button className="lightboxArrow right" onClick={(e) => { e.stopPropagation(); setIndex(index + 1); }}>›</button>
      )}
      <div className="lightboxCounter">{index + 1}/{list.length}</div>
    </div>
  );
}
