export type LogRecord = {
  line_number: number;
  line: string;
  template_id?: number;
  template?: string;
  template_similarity?: number;
  parameter_similarity?: number;
  scored?: boolean;
  error?: string;
};
