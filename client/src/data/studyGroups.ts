export interface StudyGroup {
  id: number
  name: string
  courseCode: string
  courseName: string
  description: string
  details: string
  founder: string
  createdAt: string
  memberCount: number
  meetingFrequency: string
  status: 'Open' | 'Active'
  joined: boolean
}

// TODO(frontend): Replace this collection with API data when Study Groups backend work begins.
export const MOCK_STUDY_GROUPS: StudyGroup[] = [
  { id: 1, name: 'EECE 230 Study Group', courseCode: 'EECE 230', courseName: 'Introduction to Programming', description: 'Weekly coding practice and help with course exercises.', details: 'We work through programming exercises together, compare approaches, and review difficult lecture concepts before each quiz.', founder: 'Omar Khalil', createdAt: 'August 12, 2026', memberCount: 12, meetingFrequency: 'Every Tuesday', status: 'Open', joined: true },
  { id: 2, name: 'EECE 321 Midterm Prep', courseCode: 'EECE 321', courseName: 'Computer Organization', description: 'A focused group for reviewing lectures and preparing for assessments.', details: 'This group meets twice a week to review EECE 321 lecture material, solve practice problems, and prepare together for quizzes and midterms.', founder: 'Sarah Ahmad', createdAt: 'August 20, 2026', memberCount: 8, meetingFrequency: 'Twice a week', status: 'Open', joined: false },
  { id: 3, name: 'MATH 201 Problem Solving', courseCode: 'MATH 201', courseName: 'Calculus and Analytic Geometry III', description: 'Collaborative problem-solving sessions for challenging calculus topics.', details: 'Members bring difficult problem sets to a weekly whiteboard session where we develop solutions and review the underlying concepts.', founder: 'Lina Saad', createdAt: 'August 17, 2026', memberCount: 15, meetingFrequency: 'Every Wednesday', status: 'Active', joined: true },
  { id: 4, name: 'CMPS 212 Data Structures Group', courseCode: 'CMPS 212', courseName: 'Intermediate Programming with Data Structures', description: 'Practice implementations, algorithms, and exam questions together.', details: 'We review data structures, discuss runtime tradeoffs, and pair up on extra practice problems without sharing graded solutions.', founder: 'Karim Nassar', createdAt: 'August 23, 2026', memberCount: 10, meetingFrequency: 'Every Thursday', status: 'Open', joined: false },
  { id: 5, name: 'PHYS 210 Study Crew', courseCode: 'PHYS 210', courseName: 'Introductory Physics II', description: 'Concept reviews and collaborative physics problem solving.', details: 'A friendly study crew for reviewing lecture notes, building intuition, and solving additional electricity and magnetism problems.', founder: 'Maya Haddad', createdAt: 'August 8, 2026', memberCount: 7, meetingFrequency: 'Weekends', status: 'Active', joined: false },
]

export interface ChatMessage { id: number; sender: string; text: string; timestamp: string; currentUser?: boolean }

export const MOCK_MESSAGES: Record<number, ChatMessage[]> = {
  1: [
    { id: 1, sender: 'Sarah', text: 'Does everyone want to review Chapter 4 tomorrow?', timestamp: '2:14 PM' },
    { id: 2, sender: 'Omar', text: 'Yes, 3 PM works for me.', timestamp: '2:18 PM' },
    { id: 3, sender: 'You', text: "I'll bring the practice questions.", timestamp: '2:22 PM', currentUser: true },
  ],
  3: [
    { id: 1, sender: 'Lina', text: 'I uploaded a list of practice topics for Wednesday.', timestamp: '11:05 AM' },
    { id: 2, sender: 'You', text: 'Great, I can lead the vector fields review.', timestamp: '11:12 AM', currentUser: true },
  ],
}
