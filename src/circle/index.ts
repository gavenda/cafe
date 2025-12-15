import { Circle } from './circle';
import { Member } from './member';

export interface CircleResponse {
  circle: Circle;
  members: Member[];
}

export * from './circle';
export * from './member';
