import type { Circle } from './circle';
import type { Member } from './member';

export interface CircleResponse {
  circle: Circle;
  members: Member[];
}

export * from './circle';
export * from './member';
