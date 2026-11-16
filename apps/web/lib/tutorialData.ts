import { parseLRC } from './lrcParser';
import type { OpenLyricsDocument } from '@/types/lyrics';

export const TUTORIAL_STORAGE_KEY = 'openlyryc_tutorial_completed_v1';

export const HOLD_MY_HAND_RAW_LRC = `[ti:Hold My Hand]
[ar:Jess Glynne]
[al:I Cry When I Laugh]
[length:03:48.409]
[by:Sigma]
[youtube:kRVXYHrJblk]
[00:03.875]<00:03.875>Standing<00:04.402>in<00:04.665>a<00:04.929>crowded<00:05.456>room,<00:05.719>and<00:05.982>I<00:06.246>can't<00:06.538>see<00:06.802>your<00:07.065>face
[00:11.797]<00:11.797>Put<00:12.041>your<00:12.285>arms<00:12.529>around<00:13.018>me,<00:13.262>tell<00:13.506>me<00:13.750>everything's<00:14.727>okay
[00:19.550]<00:19.550>In<00:19.818>my<00:20.085>mind,<00:20.352>I'm<00:20.618>running<00:21.152>'round<00:21.449>a<00:21.716>cold<00:21.983>and<00:22.248>empty<00:22.783>space
[00:27.118]<00:27.118>Just<00:27.390>put<00:27.660>your<00:27.931>arms<00:28.201>around<00:28.742>me,<00:29.013>tell<00:29.283>me<00:29.553>everything's<00:30.637>okay
[00:35.113]<00:35.113>Break<00:35.808>my<00:36.433>bones,<00:37.685>but<00:38.310>you<00:38.936>won't<00:39.631>see<00:40.256>me<00:40.881>fall,<00:41.506>oh
[00:42.792]<00:42.792>The<00:43.296>rising<00:44.307>tide<00:45.319>will<00:45.825>rise<00:46.835>against<00:47.847>them<00:48.351>all,<00:48.857>all
[00:49.771]<00:49.771>Darling,<00:50.529>hold<00:50.908>my<00:51.286>hand
[00:53.405]<00:53.405>Oh,<00:53.773>won't<00:54.182>you<00:54.548>hold<00:54.915>my<00:55.283>hand?
[00:57.331]<00:57.331>'Cause<00:57.856>I<00:58.118>don't<00:58.409>wanna<00:58.935>walk<00:59.198>on<00:59.460>my<00:59.722>own<00:59.984>anymore
[01:01.045]<01:01.045>Won't<01:01.476>you<01:01.865>understand?
[01:04.171]<01:04.171>'Cause<01:04.623>I<01:04.847>don't<01:05.099>wanna<01:05.551>walk<01:05.777>alone
[01:06.606]<01:06.606>I'm<01:06.980>ready<01:07.727>for<01:08.100>this,<01:08.474>there's<01:09.221>no<01:09.594>denying
[01:10.451]<01:10.451>I'm<01:10.828>ready<01:11.578>for<01:11.953>this,<01:12.329>you<01:12.706>stop<01:13.081>me<01:13.456>falling
[01:14.308]<01:14.308>I'm<01:14.686>ready<01:15.444>for<01:15.822>this,<01:16.200>I<01:16.578>need<01:16.956>you<01:17.334>all<01:17.712>in
[01:18.271]<01:18.271>I'm<01:18.590>ready<01:19.227>for<01:19.546>this,<01:19.865>so<01:20.186>darling,<01:20.823>hold<01:21.143>my<01:21.462>hand
[01:21.906]<01:21.906>Soul<01:22.129>is<01:22.353>like<01:22.802>a<01:23.025>melting<01:23.474>pot<01:23.697>when<01:23.921>you're<01:24.370>not<01:24.593>next<01:24.817>to<01:25.042>me
[01:29.762]<01:29.762>Tell<01:29.984>me<01:30.207>that<01:30.430>you've<01:30.876>got<01:31.099>me<01:31.322>and<01:31.545>you're<01:31.989>never<01:32.436>gonna<01:32.881>leave
[01:37.573]<01:37.572>Tryna<01:38.114>find<01:38.385>a<01:38.656>moment<01:39.197>where<01:39.739>I<01:40.010>can<01:40.281>find<01:40.552>release
[01:44.854]<01:44.855>Please<01:45.308>tell<01:45.534>me<01:45.760>that<01:45.986>you've<01:46.439>got<01:46.665>me<01:46.893>and<01:47.118>you're<01:47.572>never<01:48.024>gonna<01:48.477>leave
[01:53.191]<01:53.191>Break<01:53.885>my<01:54.510>bones,<01:55.759>but<01:56.382>you<01:57.007>won't<01:57.701>see<01:58.325>me<01:58.950>fall,<01:59.575>oh
[02:00.742]<02:00.742>The<02:01.257>rising<02:02.286>tide<02:03.314>will<02:03.828>rise<02:04.858>against<02:05.887>them<02:06.400>all,<02:06.915>all
[02:07.807]<02:07.807>Darling,<02:08.538>hold<02:08.902>my<02:09.269>hand
[02:11.516]<02:11.516>Oh,<02:11.859>won't<02:12.239>you<02:12.581>hold<02:12.924>my<02:13.265>hand?
[02:15.335]<02:15.335>'Cause<02:15.862>I<02:16.127>don't<02:16.420>wanna<02:16.949>walk<02:17.213>on<02:17.478>my<02:17.741>own<02:18.006>anymore
[02:19.062]<02:19.062>Won't<02:19.508>you<02:19.911>understand?
[02:22.219]<02:22.219>'Cause<02:22.681>I<02:22.913>don't<02:23.169>wanna<02:23.632>walk<02:23.862>alone
[02:24.699]<02:24.699>I'm<02:25.066>ready<02:25.800>for<02:26.168>this,<02:26.534>there's<02:27.269>no<02:27.637>denying
[02:28.594]<02:28.594>I'm<02:28.959>ready<02:29.687>for<02:30.051>this,<02:30.415>you<02:30.780>stop<02:31.144>me<02:31.508>falling
[02:32.409]<02:32.409>I'm<02:32.783>ready<02:33.531>for<02:33.905>this,<02:34.278>I<02:34.651>need<02:35.026>you<02:35.400>all<02:35.772>in
[02:36.338]<02:36.338>I'm<02:36.650>ready<02:37.270>for<02:37.581>this,<02:37.893>so<02:38.203>darling,<02:38.824>hold<02:39.135>my<02:39.445>hand
[02:39.804]<02:39.804>Don't<02:40.387>wanna<02:41.436>know
[02:42.695]<02:42.695>That<02:43.039>feeling<02:43.729>when<02:44.073>I'm<02:44.418>all<02:44.762>alone
[02:46.530]<02:46.530>So<02:46.758>please<02:47.212>don't<02:47.466>make<02:47.920>me<02:48.147>wait
[02:48.520]<02:48.520>'Cause<02:49.030>I<02:49.283>don't<02:49.567>wanna<02:50.076>break
[02:50.560]<02:50.560>No,<02:50.936>I<02:51.311>don't<02:51.729>wanna<02:52.479>fall
[02:55.165]<02:55.165>When<02:55.566>you're<02:56.365>next<02:56.764>to<02:57.164>me
[02:58.275]<02:58.275>Content,<02:59.067>I'm<02:59.462>not<02:59.859>afraid<03:00.651>to<03:01.046>be
[03:02.318]<03:02.318>You<03:02.616>don't<03:02.949>make<03:03.549>me<03:03.848>wait,<03:04.147>and<03:04.447>never<03:05.045>let<03:05.344>me<03:05.644>break
[03:06.066]<03:06.066>You<03:06.669>never<03:07.877>let<03:08.481>me<03:09.086>fall,<03:09.689>ooh
[03:10.294]<03:10.294>Darling,<03:11.026>hold<03:11.390>my<03:11.757>hand
[03:13.966]<03:13.966>Oh,<03:14.264>won't<03:14.598>you<03:14.897>hold<03:15.197>my<03:15.497>hand?
[03:17.783]<03:17.782>'Cause<03:18.304>I<03:18.564>don't<03:18.854>wanna<03:19.375>walk<03:19.634>on<03:19.895>my<03:20.156>own<03:20.417>anymore
[03:21.459]<03:21.459>Won't<03:21.909>you<03:22.314>understand?
[03:24.640]<03:24.640>'Cause<03:25.081>I<03:25.302>don't<03:25.548>wanna<03:25.989>walk<03:26.209>alone
[03:27.074]<03:27.074>I'm<03:27.443>ready<03:28.182>for<03:28.551>this,<03:28.920>there's<03:29.659>no<03:30.030>denying
[03:31.028]<03:31.028>I'm<03:31.391>ready<03:32.116>for<03:32.479>this,<03:32.842>you<03:33.205>stop<03:33.568>me<03:33.931>falling
[03:34.920]<03:34.920>I'm<03:35.286>ready<03:36.015>for<03:36.381>this,<03:36.747>I<03:37.111>need<03:37.477>you<03:37.842>all<03:38.206>in
[03:38.793]<03:38.794>I'm<03:39.173>ready<03:39.930>for<03:40.308>this,<03:40.687>so<03:41.067>darling,<03:41.824>hold<03:42.203>my<03:42.581>hand`;

export function getHoldMyHandTutorialDocument(): OpenLyricsDocument {
  const doc = parseLRC(HOLD_MY_HAND_RAW_LRC);
  
  // Guarantee metadata matches the YouTube video provided
  doc.metadata = {
    ...doc.metadata,
    title: 'Hold My Hand',
    artist: 'Jess Glynne',
    album: 'I Cry When I Laugh',
    duration: 228.409,
    youtubeId: 'kRVXYHrJblk',
    coverArt: 'https://img.youtube.com/vi/kRVXYHrJblk/hqdefault.jpg',
  };

  // Enhance Line 3 ("In my mind, I'm running 'round a cold and empty space") for visual emphasis
  if (doc.lines.length > 2) {
    doc.lines[2].emphasis = true;
    if (doc.lines[2].tokens) {
      doc.lines[2].tokens = doc.lines[2].tokens.map((tok) => {
        if (tok.text.includes("'round") || tok.text.includes("running")) {
          return { ...tok, emphasis: true };
        }
        return tok;
      });
    }
  }

  return doc;
}

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  /** Primary CSS selector to anchor the spotlight */
  targetSelector: string;
  /** Fallback selector if the primary is not mounted in current viewport */
  fallbackSelector?: string;
  /** Preferred tooltip card placement */
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  /** Timecode in seconds to jump to during this step */
  seekTime?: number;
  /** Active line index to highlight during this step */
  activeLineIndex?: number;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'step-split-layout',
    title: 'Split-Screen Workspace',
    description:
      'OpenLyryc pairs a precision lyric timing editor on the left with a real-time kinetic stage on the right. Switch to Editor, Stage, Split, or Timeline mode anytime using these tabs.',
    targetSelector: '[data-tutorial="view-switcher"]',
    placement: 'bottom',
    seekTime: 19.55,
    activeLineIndex: 2,
  },
  {
    id: 'step-lyric-stamping',
    title: 'Lyric Lines & Timing Stamps',
    description:
      'Each row displays start and end timestamps. Click any pill to stamp the current playback position, or click to edit manually. Press Spacebar to play/pause audio as you sync.',
    targetSelector: '[data-tutorial="active-lyric-row"]',
    fallbackSelector: '[data-tutorial="lyric-rows"]',
    placement: 'right',
    seekTime: 19.55,
    activeLineIndex: 2,
  },
  {
    id: 'step-word-tokens',
    title: 'Karaoke Syllable & Word Sync',
    description:
      'Lines can be divided into individual words for syllable-accurate karaoke effects. You can click any word token to adjust duration, or toggle word emphasis for expressive typography.',
    targetSelector: '[data-tutorial="word-tokens"]',
    fallbackSelector: '[data-tutorial="active-lyric-row"]',
    placement: 'right',
    seekTime: 21.37,
    activeLineIndex: 2,
  },
  {
    id: 'step-stage-presets',
    title: 'Live Stage Visual Styles',
    description:
      'Switch visual typography on the fly! Flowy gives smooth scrolling lyrics, Karaoke delivers centered lead vocal focus, Kinetic delivers bold poster typography, and Elegant provides magazine layouts.',
    targetSelector: '[data-tutorial="stage-presets"]',
    placement: 'bottom',
    seekTime: 21.37,
    activeLineIndex: 2,
  },
  {
    id: 'step-youtube-sync',
    title: 'Live YouTube Video Sync',
    description:
      'This project is synchronized with Jess Glynne\'s official music video. You can drag and resize the corner player, expand it into a full video backdrop, or switch to local MP3 audio.',
    targetSelector: '[data-tutorial="youtube-player"]',
    fallbackSelector: '[data-tutorial="audio-sources"]',
    placement: 'top',
    seekTime: 21.37,
    activeLineIndex: 2,
  },
  {
    id: 'step-waveform-scrubbing',
    title: 'Waveform Scrubbing & Playback Speed',
    description:
      'Click and drag anywhere on the audio waveform to scrub smoothly. Slow down playback to 0.75x or 0.5x to nail fast vocal timings with millisecond accuracy.',
    targetSelector: '[data-tutorial="waveform-transport"]',
    placement: 'top',
    seekTime: 21.37,
    activeLineIndex: 2,
  },
  {
    id: 'step-autosave-export',
    title: 'Auto-Saved & Multi-Format Export',
    description:
      'All changes auto-save locally to your browser database. When finished, open the Export menu to download standard .LRC, Apple Music .TTML, or OpenLyrics .JSON files.',
    targetSelector: '[data-tutorial="dock-export"]',
    fallbackSelector: '[data-tutorial="autosave-badge"]',
    placement: 'right',
    seekTime: 21.37,
    activeLineIndex: 2,
  },
];
