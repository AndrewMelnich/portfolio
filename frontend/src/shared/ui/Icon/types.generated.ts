export const iconNames = ['doc', 'input-star'] as const;

export type IconName = (typeof iconNames)[number];
