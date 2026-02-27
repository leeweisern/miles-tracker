export interface Bindings {
  DB: D1Database;
  AUTH_TOKEN: string;
}

declare const __variables: unique symbol;

export interface Variables {
  [__variables]?: never;
}
