declare global {
  interface Response {
    json(): Promise<any>;
  }
}

export {};
