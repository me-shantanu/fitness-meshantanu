export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'legs'
  | 'shoulders'
  | 'arms'
  | 'core'
  | 'full_body';

export const mapMusclesToGroups = (muscles: string[]): MuscleGroup[] => {
  const m = muscles.map(x => x.toLowerCase());
  const groups = new Set<MuscleGroup>();

  if (m.some(x => x.includes('pectoral') || x.includes('chest')))
    groups.add('chest');

  if (m.some(x => x.includes('lat') || x.includes('back')))
    groups.add('back');

  if (m.some(x => x.includes('quad') || x.includes('ham') || x.includes('glute')))
    groups.add('legs');

  if (m.some(x => x.includes('deltoid') || x.includes('shoulder')))
    groups.add('shoulders');

  if (m.some(x => x.includes('biceps') || x.includes('triceps')))
    groups.add('arms');

  if (m.some(x => x.includes('abs') || x.includes('core')))
    groups.add('core');

  return groups.size ? Array.from(groups) : ['full_body'];
};
