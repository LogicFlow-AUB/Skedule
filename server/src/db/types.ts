export type User = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  major: string | null;
  level: string | null;
};

export type CourseReview = {
  id: number;
  user_id: string;
  course_id: number | null;
  rating: number;
  difficulty: number | null;
  workload: number | null;
  would_retake: boolean | null;
  comment: string | null;
  created_at: string;
};

export type ProfessorReview = {
  id: number;
  user_id: string;
  professor_id: number | null;
  rating: number;
  difficulty: number | null;
  would_retake: boolean | null;
  comment: string | null;
  created_at: string;
};

export type Course = {
  id: number;
  title: string;
  subject: string;
  course_number: string;
  credits: string;
  level: string | null;
  college: string | null;
  department: string | null;
};

export type Professor = {
  id: number;
  first_name: string;
  last_name: string;
  department: string | null;
  title: string | null;
};

export type Section = {
  id: number;
  course_id: number | null;
  professor_id: number | null;
  section_number: string;
  days: string | null;
  start_time: string | null;
  end_time: string | null;
  room: string | null;
  seats_total: number | null;
  seats_remaining: number | null;
};

export type Schedule = {
  id: number;
  user_id: string;
  name: string | null;
  notes: string | null;
  term_id: number | null;
  created_at: string;
  updated_at: string;
};

export type ScheduleSection = {
  schedule_id: number;
  section_id: number;
};

export type Post = {
  id: number;
  user_id: string;
  type: 'schedule' | 'review' | 'question' | 'tip';
  content: string;
  tags: string[];
  schedule_id: number | null;
  created_at: string;
};

export type PostComment = {
  id: number;
  post_id: number;
  user_id: string;
  content: string;
  created_at: string;
};

export type Friendship = {
  id: number;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
};

export type Notification = {
  id: number;
  user_id: string;
  type: string;
  message: string;
  data: Record<string, unknown>;
  actor_id: string | null;
  read: boolean;
  created_at: string;
};

export type NotificationPreference = {
  user_id: string;
  friend_requests: boolean;
  friend_acceptances: boolean;
  post_likes: boolean;
  post_comments: boolean;
  review_likes: boolean;
  schedule_shares: boolean;
  registration_reminders: boolean;
};
