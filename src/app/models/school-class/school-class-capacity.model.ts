export interface SchoolClassCapacity {
  enrolled: number | null;
  activeRooms: number | null;
  capacity: number | null;
  remaining: number | null;
  loading: boolean;
  error: boolean;
  restricted: boolean;
}
