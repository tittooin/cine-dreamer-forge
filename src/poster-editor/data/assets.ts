export type AssetItem = {
  id: string;
  url: string;
  thumb: string;
  category: 'photo' | 'background' | 'shape' | 'icon';
  tags: string[];
};

// Demo assets: public, safe URLs (Unsplash/Pexels/Pixabay) and SVGs via unpkg
export const DEFAULT_ASSETS: AssetItem[] = [
  // Photos (Unsplash)
  { id: 'unsplash-city', url: 'https://images.unsplash.com/photo-1467269204584-7202d4fcd42b?q=80&w=1600&auto=format&fit=crop', thumb: 'https://images.unsplash.com/photo-1467269204584-7202d4fcd42b?q=60&w=400&auto=format&fit=crop', category: 'photo', tags: ['city','night'] },
  { id: 'unsplash-mountains', url: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?q=80&w=1600&auto=format&fit=crop', thumb: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?q=60&w=400&auto=format&fit=crop', category: 'photo', tags: ['mountains','nature'] },
  { id: 'unsplash-portrait', url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=1600&auto=format&fit=crop', thumb: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=60&w=400&auto=format&fit=crop', category: 'photo', tags: ['portrait','person'] },
  { id: 'unsplash-laptop', url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1600&auto=format&fit=crop', thumb: 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=60&w=400&auto=format&fit=crop', category: 'photo', tags: ['tech','laptop'] },
  { id: 'unsplash-food', url: 'https://images.unsplash.com/photo-1478145046317-39f10e56b5e9?q=80&w=1600&auto=format&fit=crop', thumb: 'https://images.unsplash.com/photo-1478145046317-39f10e56b5e9?q=60&w=400&auto=format&fit=crop', category: 'photo', tags: ['food'] },
  { id: 'unsplash-beach', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1600&auto=format&fit=crop', thumb: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=60&w=400&auto=format&fit=crop', category: 'photo', tags: ['beach'] },

  // Photos (Pexels)
  { id: 'pexels-space', url: 'https://images.pexels.com/photos/2156/sky-space-dark-galaxy.jpg?auto=compress&cs=tinysrgb&w=1600', thumb: 'https://images.pexels.com/photos/2156/sky-space-dark-galaxy.jpg?auto=compress&cs=tinysrgb&w=400', category: 'photo', tags: ['space','galaxy'] },
  { id: 'pexels-forest', url: 'https://images.pexels.com/photos/4827/nature-forest-trees-fog.jpeg?auto=compress&cs=tinysrgb&w=1600', thumb: 'https://images.pexels.com/photos/4827/nature-forest-trees-fog.jpeg?auto=compress&cs=tinysrgb&w=400', category: 'photo', tags: ['forest','fog'] },

  // Photos (Pixabay)
  { id: 'pixabay-car', url: 'https://cdn.pixabay.com/photo/2017/01/06/19/15/car-1957037_1280.jpg', thumb: 'https://cdn.pixabay.com/photo/2017/01/06/19/15/car-1957037_640.jpg', category: 'photo', tags: ['car'] },
  { id: 'pixabay-dog', url: 'https://cdn.pixabay.com/photo/2015/06/08/15/20/dog-802470_1280.jpg', thumb: 'https://cdn.pixabay.com/photo/2015/06/08/15/20/dog-802470_640.jpg', category: 'photo', tags: ['dog'] },

  // Backgrounds
  { id: 'bg-gradient-1', url: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?q=80&w=1600&auto=format&fit=crop', thumb: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?q=60&w=400&auto=format&fit=crop', category: 'background', tags: ['gradient'] },
  { id: 'bg-pattern-1', url: 'https://images.unsplash.com/photo-1541233349642-6e425fe6190e?q=80&w=1600&auto=format&fit=crop', thumb: 'https://images.unsplash.com/photo-1541233349642-6e425fe6190e?q=60&w=400&auto=format&fit=crop', category: 'background', tags: ['pattern'] },
  { id: 'bg-pixels', url: 'https://images.unsplash.com/photo-1518544355850-860e2a0f46fa?q=80&w=1600&auto=format&fit=crop', thumb: 'https://images.unsplash.com/photo-1518544355850-860e2a0f46fa?q=60&w=400&auto=format&fit=crop', category: 'background', tags: ['pixels'] },
  { id: 'bg-sunset', url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1600&auto=format&fit=crop', thumb: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=60&w=400&auto=format&fit=crop', category: 'background', tags: ['sunset'] },

  // Shapes (SVG)
  { id: 'shape-star', url: 'https://unpkg.com/heroicons@2.1.4/24/solid/star.svg', thumb: 'https://unpkg.com/heroicons@2.1.4/24/solid/star.svg', category: 'shape', tags: ['star'] },
  { id: 'shape-heart', url: 'https://unpkg.com/heroicons@2.1.4/24/solid/heart.svg', thumb: 'https://unpkg.com/heroicons@2.1.4/24/solid/heart.svg', category: 'shape', tags: ['heart'] },

  // Icons (SVG)
  { id: 'icon-camera', url: 'https://unpkg.com/heroicons@2.1.4/24/solid/camera.svg', thumb: 'https://unpkg.com/heroicons@2.1.4/24/solid/camera.svg', category: 'icon', tags: ['camera'] },
  { id: 'icon-arrow', url: 'https://unpkg.com/heroicons@2.1.4/24/solid/arrow-up-right.svg', thumb: 'https://unpkg.com/heroicons@2.1.4/24/solid/arrow-up-right.svg', category: 'icon', tags: ['arrow'] },
];

export default DEFAULT_ASSETS;