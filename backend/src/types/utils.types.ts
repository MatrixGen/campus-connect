// Utility type to handle null values in creation
export type CreateAttributes<T> = {
  [P in keyof T]: P extends 'id' | 'created_at' | 'updated_at' 
    ? never 
    : T[P] extends string | null 
      ? string | null | undefined
      : T[P] extends Date | null
        ? Date | null | undefined
        : T[P];
};