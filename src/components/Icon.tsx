import * as LucideIcons from 'lucide-react-native';
import { ComponentType } from 'react';
import { SvgProps } from 'react-native-svg';

interface IconProps {
  name: keyof typeof LucideIcons;
  size?: number;
  color?: string;
}

export default function Icon({
  name,
  size = 24,
  color = 'currentColor',
}: IconProps) {
  const IconComponent = LucideIcons[name] as ComponentType<SvgProps>;

  if (!IconComponent) return null;

  return <IconComponent width={size} height={size} color={color} />;
}
