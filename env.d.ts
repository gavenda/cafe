declare namespace NodeJS {
  interface ProcessEnv {
    TOKEN: string;
    CLIENT_ID: string;
    CAFE_BREW: string;
    UMA_MOE_API_KEY: string;
    SQLITE_FILE?: string;
  }
}
