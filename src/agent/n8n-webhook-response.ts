export enum ResponseType {
  MESSAGE = 'message',
  HISTORY = 'history'
}

interface N8NBaseWebhookResponse {
  type: ResponseType;
}

interface N8NMessageWebhookResponse extends N8NBaseWebhookResponse {
  type: ResponseType.MESSAGE;
  message: string;
}

interface N8NHistoryWebhookResponse extends N8NBaseWebhookResponse {
  type: ResponseType.HISTORY;
  message: string;
  name: string;
  club: string;
}

export type N8NWebhookResponse = N8NHistoryWebhookResponse | N8NMessageWebhookResponse;
