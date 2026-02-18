
import React from 'react';

export const COLORS = {
  Free: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Low: 'bg-amber-100 text-amber-700 border-amber-200',
  High: 'bg-rose-100 text-rose-700 border-rose-200',
};

export const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Financial: '💰',
  Health: '🥗',
  Travel: '✈️',
  Relationship: '❤️',
  Career: '💼',
  Adventure: '🧗',
  Creative: '🎨',
  Relaxing: '🧘',
  Growth: '🌱',
};

export const USERS = {
  DAVID: { id: 'user-1', name: 'David', avatar: 'https://picsum.photos/seed/david/100/100' },
  CARLA: { id: 'user-2', name: 'Carla', avatar: 'https://picsum.photos/seed/carla/100/100' },
};
