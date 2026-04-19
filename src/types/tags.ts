export interface TagSummary {
  id: string;
  name: string;
  description: string | null;
  member_count: number;
  created_at: string;
  updated_at: string;
}

export interface TagStudent {
  id: string;
  carnet: string;
  full_name: string;
  sede: string;
  career: string;
  degree_level: string;
  is_active: boolean;
}

export interface TagDetail extends TagSummary {
  members: TagStudent[];
}

export interface CreateTagPayload {
  name: string;
  description?: string | null;
  student_ids?: string[];
}

export interface UpdateTagPayload {
  name?: string;
  description?: string | null;
  student_ids?: string[];
}
