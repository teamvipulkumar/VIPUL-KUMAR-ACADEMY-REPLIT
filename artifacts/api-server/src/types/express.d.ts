export {};

declare module "express-serve-static-core" {
  interface ParamsDictionary {
    [key: string]: string;
    [key: number]: string;
  }
}
