export interface ApiMessage {
  human_query: string;
  chat_id: string;
  id: string;
  ai_reply: string;
  meta_data: Record<string, any>;
  render_type: string;
  is_bookmarked: boolean;
  is_thumbsup: boolean;
  sent_at: string;
  bot_id: string;
  model: string;
  cost: number;
}

export interface Bot {
  id: string;
  name: string;
  description: string;
  bot_class: string;
  default_model: string;
  bot_config: Record<string, unknown>;
}
