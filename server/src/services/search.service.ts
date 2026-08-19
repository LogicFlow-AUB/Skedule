import { requireSupabaseClient } from '../db/supabase.js';

export type SearchResults = {
  courses: { id: number; code: string; title: string; department: string | null }[];
  professors: { id: number; firstName: string; lastName: string; department: string | null }[];
  users: { id: string; firstName: string | null; lastName: string | null; major: string | null }[];
  posts: { id: number; type: string; content: string; createdAt: string }[];
};

type CourseRow = {
  id: number;
  subject: string;
  course_number: string;
  title: string;
  department: string | null;
};
type ProfessorRow = {
  id: number;
  first_name: string;
  last_name: string;
  department: string | null;
};
type UserRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  major: string | null;
};
type PostRow = { id: number; type: string; content: string; created_at: string };

export async function search(term: string, limit = 5): Promise<SearchResults> {
  const db = requireSupabaseClient();
  const query = term.replace(/[(),]/g, '');

  const [coursesResult, professorsResult, usersResult, postsResult] = await Promise.all([
    db
      .from('courses')
      .select('id, subject, course_number, title, department')
      .or(
        `subject.ilike.%${query}%,course_number.ilike.%${query}%,title.ilike.%${query}%,department.ilike.%${query}%`,
      )
      .limit(limit),
    db
      .from('professors')
      .select('id, first_name, last_name, department')
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,department.ilike.%${query}%`)
      .limit(limit),
    db
      .from('users')
      .select('id, first_name, last_name, major')
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,major.ilike.%${query}%`)
      .limit(limit),
    db
      .from('posts')
      .select('id, type, content, created_at')
      .ilike('content', `%${query}%`)
      .order('created_at', { ascending: false })
      .limit(limit),
  ]);

  if (coursesResult.error) {
    throw coursesResult.error;
  }

  if (professorsResult.error) {
    throw professorsResult.error;
  }

  if (usersResult.error) {
    throw usersResult.error;
  }

  if (postsResult.error) {
    throw postsResult.error;
  }

  return {
    courses: (coursesResult.data as CourseRow[]).map((course) => ({
      id: course.id,
      code: `${course.subject} ${course.course_number}`,
      title: course.title,
      department: course.department,
    })),
    professors: (professorsResult.data as ProfessorRow[]).map((professor) => ({
      id: professor.id,
      firstName: professor.first_name,
      lastName: professor.last_name,
      department: professor.department,
    })),
    users: (usersResult.data as UserRow[]).map((user) => ({
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      major: user.major,
    })),
    posts: (postsResult.data as PostRow[]).map((post) => ({
      id: post.id,
      type: post.type,
      content: post.content,
      createdAt: post.created_at,
    })),
  };
}
