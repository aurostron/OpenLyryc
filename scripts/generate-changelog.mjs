import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputFile = resolve(__dirname, '../apps/web/public/changelog.json');

function cleanCommitSubject(subject) {
  let clean = subject.replace(/^(feat|fix|perf|refactor|docs|style|test|chore)(\([^)]+\))?:\s*/i, '');
  if (clean.length > 0) {
    clean = clean.charAt(0).toUpperCase() + clean.slice(1);
  }
  return clean;
}

function determineTag(subject) {
  const lower = subject.toLowerCase();
  if (lower.startsWith('feat')) return 'New';
  if (lower.startsWith('fix')) return 'Fix';
  if (lower.startsWith('perf')) return 'Performance';
  if (lower.startsWith('refactor')) return 'Improvement';
  return 'Update';
}

function formatDate(isoDate) {
  try {
    const [year, month, day] = isoDate.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const m = months[parseInt(month, 10) - 1] || month;
    return `${m} ${parseInt(day, 10)}, ${year}`;
  } catch {
    return isoDate;
  }
}

try {
  const raw = execSync('git log -n 25 --pretty=format:"%h|%s|%ad" --date=short', { encoding: 'utf-8' });
  const entries = [];

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [hash, subject, date] = trimmed.split('|');
    if (!hash || !subject) continue;

    // Filter out internal chore noise and merge commits
    if (
      subject.startsWith('Merge ') ||
      subject.startsWith('docs: log GitHub pull') ||
      subject.startsWith('docs(') ||
      subject.startsWith('chore(')
    ) continue;

    entries.push({
      hash,
      subject: cleanCommitSubject(subject),
      rawSubject: subject,
      tag: determineTag(subject),
      date: formatDate(date),
    });

    if (entries.length >= 3) break;
  }

  mkdirSync(dirname(outputFile), { recursive: true });
  writeFileSync(outputFile, JSON.stringify(entries, null, 2), 'utf-8');
  console.log(`[generate-changelog] Generated ${entries.length} changelog entries at apps/web/public/changelog.json`);
} catch (err) {
  console.warn('[generate-changelog] Failed to generate changelog from git:', err.message);
}
