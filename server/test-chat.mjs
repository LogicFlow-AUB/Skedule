import { handleMessage, clearSessionHistory } from './src/services/assistant.service.js';

async function main() {
  const q = process.argv[2] ?? 'first';
  const session = 'test-session-1';
  clearSessionHistory(session);

  if (q === 'first') {
    const r = await handleMessage(
      'Give me one Lecture for MATH 201 that starts early in the morning on MWF with its corresponding recitations that are linked to it.',
      'test-user',
      session,
    );
    console.log('\n===== ANSWER 1 =====\n');
    console.log(r.response);
  }

  if (q === 'followup') {
    const r1 = await handleMessage('Show me MATH 201 lectures.', 'test-user', session);
    console.log('\n===== FOLLOWUP 1: MATH 201 lectures =====\n');
    console.log(r1.response);

    const r2 = await handleMessage('Which one starts the earliest?', 'test-user', session);
    console.log('\n===== FOLLOWUP 2: earliest =====\n');
    console.log(r2.response);

    const r3 = await handleMessage('What recitations correspond to that one?', 'test-user', session);
    console.log('\n===== FOLLOWUP 3: recitations =====\n');
    console.log(r3.response);
  }
}
main();
