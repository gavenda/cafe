declare namespace NodeJS {
  interface ProcessEnv {
    TOKEN: string;
    CLIENT_ID: string;
    UMA_MOE_API_KEY: string;
    REDIS_URL?: string;
  }
}
