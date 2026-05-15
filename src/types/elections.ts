export interface Election {
  id: string;
  title: string;
  description: string | null;
  status: 'DRAFT' | 'SCHEDULED' | 'OPEN' | 'CLOSED' | 'SCRUTINIZED' | 'ARCHIVED';
  is_anonymous: boolean;
  auth_method: 'MICROSOFT';
  requires_keys: boolean;
  min_keys: number;
  voter_source: 'FULL_PADRON' | 'FILTERED' | 'MANUAL' | 'TAG';
  voter_filter: Record<string, unknown> | null;
  tag_id: string | null;
  tag_name: string | null;
  tag_color: string | null;
  tag_description: string | null;
  tag_member_count: number | null;
  starts_immediately: boolean;
  immediate_minutes: number | null;
  start_time: string | null;
  end_time: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  total_voters: number;
  votes_cast: number;
  options_count: number;
  allow_suboptions?: boolean;
}

export interface ElectionOption {
  id: string;
  election_id?: string;
  label: string;
  option_type: string;
  display_order: number;
  parent_option_id?: string | null;
  image_url?: string | null;
  metadata?: Record<string, unknown> | null;
  suboptions?: ElectionOption[];
}

export interface ElectionDetail extends Election {
  options: ElectionOption[];
}

export interface ElectionResultVoter {
  full_name: string;
  carnet: string;
  has_voted: boolean;
  selected_option_label: string | null;
}

export interface ElectionResults {
  election: Election;
  options: ElectionResultOption[];
  total_votes: number;
  total_eligible: number;
  participation_rate: number;
  voters?: ElectionResultVoter[];
}

export interface ElectionResultOption {
    id: string;
    label: string;
    option_type: string;
    parent_option_id?: string | null;
    image_url?: string | null;
    metadata?: Record<string, unknown> | null;
    vote_count: number;
    percentage: number;
    suboptions?: ElectionResultOption[];
}

// Voter-facing types
export interface VoterElection {
  id: string;
  title: string;
  description: string | null;
  status: string;
  is_anonymous: boolean;
  tag_name: string | null;
  tag_color: string | null;
  start_time: string | null;
  end_time: string | null;
  has_voted: boolean;
  allow_suboptions?: boolean;
  total_options: number;
}

export interface VoterElectionDetail {
  id: string;
  title: string;
  description: string | null;
  status: string;
  is_anonymous: boolean;
  tag_name: string | null;
  tag_color: string | null;
  start_time: string | null;
  end_time: string | null;
  has_voted: boolean;
  allow_suboptions?: boolean;
  options: ElectionOption[];
}
