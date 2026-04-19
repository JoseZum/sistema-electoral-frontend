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
}

export interface ElectionOption {
  id: string;
  election_id: string;
  label: string;
  option_type: string;
  display_order: number;
  metadata: Record<string, unknown> | null;
}

export interface ElectionDetail extends Election {
  options: ElectionOption[];
}

export interface ElectionResults {
  election: Election;
  options: Array<{
    id: string;
    label: string;
    option_type: string;
    vote_count: number;
    percentage: number;
  }>;
  total_votes: number;
  total_eligible: number;
  participation_rate: number;
}

// Voter-facing types
export interface VoterElection {
  id: string;
  title: string;
  description: string | null;
  status: string;
  is_anonymous: boolean;
  tag_name: string | null;
  start_time: string | null;
  end_time: string | null;
  has_voted: boolean;
  total_options: number;
}

export interface VoterElectionDetail {
  id: string;
  title: string;
  description: string | null;
  status: string;
  is_anonymous: boolean;
  tag_name: string | null;
  start_time: string | null;
  end_time: string | null;
  has_voted: boolean;
  options: Array<{
    id: string;
    label: string;
    option_type: string;
    display_order: number;
  }>;
}
