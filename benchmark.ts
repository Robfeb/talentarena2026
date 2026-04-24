import * as fs from 'fs';

interface Session {
  ID: number;
  date: string;
  start: string;
  end: string;
  stage: string;
  speaker: string;
  role: string;
  title: string;
  category: string;
  language: string;
}

const data: Session[] = JSON.parse(fs.readFileSync('talentarena.json', 'utf8'));

function parseDate(value: string): number {
  const parsed = Date.parse(`${value}, 2026`);
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}

function parseTime(value: string): number {
  const [hours, minutes] = value.split(':').map((part) => Number(part));
  return (hours || 0) * 60 + (minutes || 0);
}

function sortSessions(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => {
    const dateCompare = parseDate(a.date) - parseDate(b.date);
    if (dateCompare !== 0) {
      return dateCompare;
    }

    const startCompare = parseTime(a.start) - parseTime(b.start);
    if (startCompare !== 0) {
      return startCompare;
    }

    return a.stage.localeCompare(b.stage);
  });
}

const N = 1000;
const start = performance.now();
for (let i = 0; i < N; i++) {
  sortSessions(data);
}
const end = performance.now();
console.log(`Baseline: ${(end - start).toFixed(2)} ms`);
