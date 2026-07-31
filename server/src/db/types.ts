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
  comment: string | null;
  created_at: string;
};

export type ProfessorReview = {
  id: number;
  user_id: string;
  professor_id: number | null;
  rating: number;
  comment: string | null;
  created_at: string;
};
