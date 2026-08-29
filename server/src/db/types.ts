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
  term_id: number | null;
  professor_id: number | null;
  section_number: string;
  crn: string;
  days: string | null;
  start_time: string | null;
  end_time: string | null;
  schedule_type: string | null;
  campus: string | null;
  seats_total: number | null;
  seats_remaining: number | null;
  status: string | null;
  room: string | null;
  link_identifier: string | null;
  meeting_schedule_type: string | null;
  start_date: string | null;
  end_date: string | null;
  has_monday: boolean;
  has_tuesday: boolean;
  has_wednesday: boolean;
  has_thursday: boolean;
  has_friday: boolean;
  has_saturday: boolean;
  has_sunday: boolean;
};

export type SectionMeeting = {
  id: number;
  section_id: number;
  term_id: number;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  start_time: string | null;
  end_time: string | null;
  building: string | null;
  room: string | null;
  meeting_type: string | null;
  hours_week: number | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};

export type Schedule = {
  id: number;
  user_id: string;
  name: string | null;
  notes: string | null;
  term_id: number | null;
  saved: boolean;
  is_favorite: boolean;
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
  parent_comment_id: number | null;
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

export type Event = {
  id: number;
  title: string;
  type: string;
  starts_at: string;
  ends_at: string | null;
  description: string | null;
  location: string | null;
  term_id: number | null;
  created_at: string;
};

export type EventRsvp = {
  event_id: number;
  user_id: string;
  created_at: string;
};

export type StudyGroup = {
  id: number;
  name: string;
  course_code: string | null;
  description: string | null;
  meeting_time: string | null;
  location: string | null;
  host_user_id: string;
  max_members: number | null;
  created_at: string;
};

export type StudyGroupMember = {
  study_group_id: number;
  user_id: string;
  joined_at: string;
};
