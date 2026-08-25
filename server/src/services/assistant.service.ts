import { GoogleGenAI } from '@google/genai';

import config from '../config.js';
import * as coursesService from './courses.service.js';
import * as ragService from './rag.service.js';
import * as schedulesService from './schedules.service.js';
import { AppError } from '../utils/app-error.js';
import { logger } from '../utils/logger.js';

const genai = config.gemini.apiKey ? new GoogleGenAI({ apiKey: config.gemini.apiKey }) : null;

type ToolResult = { output: string; error?: string };

const TOOL_DEFINITIONS = [
  {
    name: 'searchKnowledgeBase',
    description:
      'Search the university knowledge base for policies, deadlines, procedures, and general information.',
    parameters: {
      query: { type: 'string', description: 'The search query' },
    },
  },
  {
    name: 'searchCourses',
    description: 'Search for university courses by name, subject, or keyword.',
    parameters: {
      query: { type: 'string', description: 'Course name or keyword to search for' },
    },
  },
  {
    name: 'getCourseSections',
    description:
      'Get available sections for a specific course including CRN, professor, schedule, and seat availability.',
    parameters: {
      courseCode: { type: 'string', description: 'Course code (e.g. EECE 330, MATH 201)' },
    },
  },
  {
    name: 'getUserSchedules',
    description: "Get the authenticated user's saved schedules.",
    parameters: {},
  },
  {
    name: 'getScheduleDetails',
    description:
      'Get detailed information about a specific schedule including all courses and sections.',
    parameters: {
      scheduleId: { type: 'number', description: 'The schedule ID' },
    },
  },
] as const;

function buildToolSchema(): string {
  return TOOL_DEFINITIONS.map((tool) => {
    const params = Object.entries(tool.parameters)
      .map(([k, v]) => `    "${k}": ${v.description}`)
      .join('\n');
    return `- ${tool.name}: ${tool.description}\n  Parameters:\n${params || '    (none)'}`;
  }).join('\n\n');
}

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  userId: string,
): Promise<ToolResult> {
  try {
    switch (name) {
      case 'searchKnowledgeBase': {
        const query = String(args.query ?? '').trim();
        if (!query) {
          return { output: '', error: 'A search query is required.' };
        }
        const chunks = await ragService.retrieveChunks(query, 5);
        if (chunks.length === 0) {
          return { output: 'No relevant information found in the knowledge base.' };
        }
        return { output: chunks.map((c) => c.content).join('\n\n---\n\n') };
      }

      case 'searchCourses': {
        const query = String(args.query ?? '').trim();
        if (!query) {
          return { output: '', error: 'A course search query is required.' };
        }
        const result = await coursesService.listCourses({
          search: query,
          sort: 'name',
          order: 'asc',
          pagination: { page: 1, limit: 5, offset: 0 },
        });
        if (result.data.length === 0) {
          return { output: 'No courses found matching the search.' };
        }
        const summary = result.data
          .map(
            (c) =>
              `${c.code} - ${c.title} (${c.credits} credits, ${c.level ?? 'N/A'})${c.averageRating ? ` | Rating: ${c.averageRating}/5` : ''}`,
          )
          .join('\n');
        return { output: summary };
      }

      case 'getCourseSections': {
        const code = String(args.courseCode ?? '').trim();
        if (!code) {
          return { output: '', error: 'A course code is required (e.g. EECE 330).' };
        }
        const sections = await coursesService.getSections(code);
        if (sections.length === 0) {
          return { output: `No sections found for ${code}.` };
        }
        const summary = sections
          .map(
            (s) =>
              `Section ${s.section_number} | CRN: ${s.crn} | ${s.professors ? `${s.professors.first_name} ${s.professors.last_name}` : 'TBA'} | ${s.days ?? 'TBA'} ${s.start_time ?? ''}-${s.end_time ?? ''} | Seats: ${s.seats_remaining ?? '?'}/${s.seats_total ?? '?'} | ${s.status ?? 'N/A'}`,
          )
          .join('\n');
        return { output: summary };
      }

      case 'getUserSchedules': {
        const result = await schedulesService.listSchedules(userId, {
          page: 1,
          limit: 10,
          offset: 0,
        });
        if (result.data.length === 0) {
          return { output: 'You have no saved schedules.' };
        }
        const summary = result.data
          .map(
            (s) =>
              `Schedule #${s.id}: ${s.name ?? 'Untitled'} | ${s.courseCount} courses | ${s.totalCredits} credits`,
          )
          .join('\n');
        return { output: summary };
      }

      case 'getScheduleDetails': {
        const scheduleId = Number(args.scheduleId);
        if (!Number.isFinite(scheduleId) || scheduleId < 1) {
          return { output: '', error: 'A valid schedule ID is required.' };
        }
        const schedule = await schedulesService.getSchedule(userId, scheduleId);
        const courses = schedule.courses
          .map(
            (c) =>
              `${c.code ?? 'Unknown'} - ${c.title ?? 'Unknown'} | Section ${c.section.sectionNumber} | ${c.professor ? `${c.professor.firstName} ${c.professor.lastName}` : 'TBA'} | ${c.section.days.join(', ')} ${c.section.startTime ?? ''}-${c.section.endTime ?? ''}`,
          )
          .join('\n');
        return {
          output: `Schedule: ${schedule.name ?? 'Untitled'}\n${schedule.courseCount} courses, ${schedule.totalCredits} credits\n\n${courses}`,
        };
      }

      default:
        return { output: '', error: `Unknown tool: ${name}` };
    }
  } catch (error) {
    if (error instanceof AppError) {
      return { output: '', error: error.message };
    }
    logger.error({ tool: name, error }, 'Tool execution failed');
    return { output: '', error: 'An error occurred while executing the tool.' };
  }
}

async function routeWithGemini(
  message: string,
): Promise<{ route: 'rag' | 'tools'; tool: string | null; args: Record<string, unknown> | null }> {
  if (!genai) {
    throw new AppError(
      503,
      'GEMINI_UNAVAILABLE',
      'AI assistant is not configured. Set GEMINI_API_KEY in your environment.',
    );
  }

  const systemPrompt = `You are a router for a university assistant. Analyze the user's message and decide which route to use.

Routes:
- "rag": For questions about university information, policies, procedures, deadlines, documentation, or information that might be stored in a knowledge base.
- "tools": For questions requiring real-time/database information about courses, sections, professors, seats, or the authenticated user's schedules.

Also determine which specific tool to use if the route is "tools":
- searchCourses: Search for courses by name, subject, or keyword
- getCourseSections: Get sections for a specific course (requires course code like "EECE 330")
- getUserSchedules: Get the user's saved schedules
- getScheduleDetails: Get details about a specific schedule (requires schedule ID)

Respond with ONLY a JSON object in this exact format:
{"route": "rag"|"tools", "tool": "toolName"|null, "args": {}|null}

Examples:
- "What is the deadline for dropping a course?" → {"route": "rag"}
- "What sections are available for EECE 330?" → {"route": "tools", "tool": "getCourseSections", "args": {"courseCode": "EECE 330"}}
- "Show me my schedules" → {"route": "tools", "tool": "getUserSchedules"}
- "Who teaches MATH 201?" → {"route": "tools", "tool": "getCourseSections", "args": {"courseCode": "MATH 201"}}
- "Give me details about schedule 5" → {"route": "tools", "tool": "getScheduleDetails", "args": {"scheduleId": 5}}`;

  try {
    const response = await genai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: message,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0,
        responseMimeType: 'application/json',
      },
    });

    const text = response.text ?? '';
    
    const parsed = JSON.parse(text) as {
      route?: string;
      tool?: string;
      args?: Record<string, unknown>;
    };

    if (parsed.route === 'rag' || parsed.route === 'tools') {
      return {
        route: parsed.route,
        tool: parsed.tool ?? null,
        args: parsed.args ?? null,
      };
    }

    logger.warn({ response: text }, 'Invalid Gemini routing response, defaulting to tools');
    return { route: 'tools', tool: null, args: null };
  } catch (error) {
    logger.error({ error }, 'Gemini routing failed, defaulting to tools');
    return { route: 'tools', tool: null, args: null };
  }
}

export type AssistantResponse = {
  response: string;
};

export async function handleMessage(
  message: string,
  userId: string,
): Promise<AssistantResponse> {
  const routing = await routeWithGemini(message);

  if (routing.route === 'rag') {
    const chunks = await ragService.retrieveChunks(message, 5);
    if (chunks.length === 0) {
      return { response: 'No relevant information found in the knowledge base.' };
    }
    return { response: chunks.map((c) => c.content).join('\n\n---\n\n') };
  }

  if (routing.route === 'tools' && routing.tool) {
    const toolResult = await executeTool(routing.tool, routing.args ?? {}, userId);
    if (toolResult.error) {
      return { response: `Error: ${toolResult.error}` };
    }
    return { response: toolResult.output };
  }

  return { response: 'I can help you with course information, schedules, or university policies. Please ask a specific question.' };
}
