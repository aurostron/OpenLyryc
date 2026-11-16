/**
 * YouTube candidate ranking for the local dev proxies.
 *
 * JS port of `apps/web/lib/youtubeSearchRank.ts` — keep the two in step. Used by
 * `scripts/yt-proxy.mjs` and `scripts/dev-server.mjs` so a hit scores the same
 * locally as it does in the Cloudflare function and through the extension.
 */

const HARD_NEGATIVE_KEYWORDS = [
  'remix', 'mashup', 'slowed', 'reverb', 'speed up', 'sped up', 'sped-up',
  'cover', 'karaoke', 'parody', 'reaction', 'tribute',
  'tutorial', 'synthesia', '1 hour', '10 hours', 'loop', 'bass boosted',
  'nightcore', 'fan made', 'fan-made', 'amv', 'anime mv',
];

const LYRIC_VIDEO_KEYWORDS = [
  'lyric video', 'lyrics video', 'official lyric', 'official lyrics',
  'lyric clip', 'with lyrics', '(lyrics)', '[ lyrics ]',
  'visualizer', 'visualiser', 'audio visualizer', 'animated lyric', 'kinetic lyric',
];
const STANDALONE_LYRIC_RE = /\b(lyrics?)\b/i;
const MUSIC_VIDEO_RE = /\b(music videos?|official mvs?|official music videos?|video clips?|videoclips?|mv)\b/i;
const TOPIC_CHANNEL_RE = /\s-\s*topic\s*$/i;
const TOPIC_RELEASE_RE = /\b(topic|releases?)\b/i;
const OFFICIAL_AUDIO_RE = /(\bofficial audio\b|\(audio\))/i;

const INSTRUMENTAL_RE = /\binstrumentals?\b/i;

const INSTRUMENTAL_NEGATIVE_KEYWORDS = [
  'tutorial', 'how to play', 'synthesia', 'lesson', 'reaction', 'parody',
  'amv', 'cover', 'remix', 'mashup', 'slowed', 'reverb', 'speed up', 'sped up',
  'bass boosted', '1 hour', '10 hours', 'loop', 'nightcore', 'fan made', 'fan-made',
  'guitar tab', 'chords', 'karaoke with vocals', 'vocal cover',
];

function normalize(value) {
  return (value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function calculateTokenSimilarity(query, candidateTitle, candidateChannel) {
  const tokens = normalize(query).split(' ').filter((token) => token.length > 1);
  if (tokens.length === 0) return 1;

  const targetText = normalize(`${candidateTitle} ${candidateChannel}`);
  const targetTokens = new Set(targetText.split(' '));
  let matched = 0;
  for (const token of tokens) {
    if (targetTokens.has(token) || targetText.includes(token)) matched++;
  }
  return matched / tokens.length;
}

function scoreCandidate(candidate, query, durationSeconds, rawIndex, options) {
  const title = candidate.title || '';
  const channel = candidate.channelTitle || '';
  const lowerTitle = title.toLowerCase();
  const lowerChannel = channel.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const duration = candidate.durationSeconds || 0;

  let score = 0;

  // Instrumental / Karaoke mode scoring
  if (options?.instrumentalOnly) {
    const isInst = INSTRUMENTAL_RE.test(title);

    if (isInst) {
      score += 800;
      if (lowerTitle.includes('official instrumental')) score += 300;
      else if (lowerTitle.includes('instrumental version')) score += 200;
      else if (lowerTitle.includes('instrumental audio') || lowerTitle.includes('audio')) score += 150;
      else if (lowerTitle.includes('backing track') || lowerTitle.includes('karaoke')) score += 100;
    } else {
      score -= 1000;
    }

    for (const kw of INSTRUMENTAL_NEGATIVE_KEYWORDS) {
      if (lowerTitle.includes(kw)) {
        score -= 500;
        break;
      }
    }

    const tokenSim = calculateTokenSimilarity(query, title, channel);
    score += tokenSim * 120;
    if (tokenSim < 0.4) score -= 300;

    if (durationSeconds > 0 && duration > 0) {
      const delta = Math.abs(duration - durationSeconds);
      if (delta <= 2) score += 120;
      else if (delta <= 5) score += 80;
      else if (delta <= 10) score += 50;
      else if (delta <= 20) score += 20;
      else if (delta > 35) score -= Math.min(250, (delta - 35) * 4);
    }

    if (TOPIC_CHANNEL_RE.test(channel)) score += 200;
    else if (candidate.musicVideoType === 'MUSIC_VIDEO_TYPE_ATV') score += 250;

    score += Math.max(0, 30 - rawIndex * 2);

    return Math.round(score);
  }

  const tokenSim = calculateTokenSimilarity(query, title, channel);
  score += tokenSim * 100;
  if (tokenSim < 0.5) score -= 300;

  if (durationSeconds > 0 && duration > 0) {
    const delta = Math.abs(duration - durationSeconds);
    if (delta <= 1) score += 100;
    else if (delta <= 3) score += 80;
    else if (delta <= 6) score += 60;
    else if (delta <= 12) score += 30;
    else if (delta <= 20) score += 10;
    else if (delta > 30) score -= Math.min(200, (delta - 30) * 3);
  }

  for (const keyword of HARD_NEGATIVE_KEYWORDS) {
    if (lowerTitle.includes(keyword) && !lowerQuery.includes(keyword)) {
      score -= 400;
      break;
    }
  }

  const isLyricVideo =
    LYRIC_VIDEO_KEYWORDS.some((keyword) => lowerTitle.includes(keyword)) ||
    STANDALONE_LYRIC_RE.test(title);
  if (isLyricVideo) score -= 350;

  const videoType = candidate.musicVideoType;
  if (videoType === 'MUSIC_VIDEO_TYPE_ATV') score += 300;
  else if (videoType === 'MUSIC_VIDEO_TYPE_OMV') score -= 150;
  else if (!videoType && MUSIC_VIDEO_RE.test(title)) score -= 150;

  if (TOPIC_CHANNEL_RE.test(channel)) score += 200;
  else if (/\btopic\b/i.test(channel) || /\btopic\b/i.test(title)) score += 160;
  if (TOPIC_RELEASE_RE.test(channel) || TOPIC_RELEASE_RE.test(title)) score += 180;

  if (OFFICIAL_AUDIO_RE.test(lowerTitle)) score += 60;
  else if (lowerChannel.includes('vevo')) score += 40;
  if (lowerTitle.includes('official') || lowerTitle.includes('clip officiel')) score += 15;

  score += Math.max(0, 30 - rawIndex * 2);

  return Math.round(score);
}

export function rankYouTubeCandidates(candidates, query, durationSeconds = 0, options) {
  const ranked = candidates
    .map((candidate, index) => ({
      ...candidate,
      score: scoreCandidate(candidate, query, durationSeconds, index, options),
    }))
    .sort((a, b) => b.score - a.score);

  if (options?.instrumentalOnly) {
    const instrumentalMatches = ranked.filter((c) => INSTRUMENTAL_RE.test(c.title));
    const finalCandidates = instrumentalMatches.length > 0 ? instrumentalMatches : ranked;
    return {
      bestMatch: finalCandidates[0] ? { ...finalCandidates[0] } : null,
      candidates: finalCandidates,
    };
  }

  return {
    bestMatch: ranked[0] ? { ...ranked[0] } : null,
    candidates: ranked,
  };
}
