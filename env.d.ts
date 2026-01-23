declare namespace NodeJS {
  interface ProcessEnv {
    TOKEN: string;
    CLIENT_ID: string;
    CAFE_BREW: string;
    SQLITE_FILE: string;
    N8N_AGENT_WEBHOOK: string;
    N8N_AGENT_WEBHOOK_SECRET: string;
  }
}
