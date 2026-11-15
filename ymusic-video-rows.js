// YMusic: title and time, for Backtalk.
// Port of the SandFly script ymusic.video_rows.lua 1.7 by Алёшка
// (https://github.com/magiyastraha-tech/sandfly-scripts), translated to English.
//
// In YMusic (io.ymusic.android) lists, a video, clip or live stream row says only its title and
// time. The channel, views and publish date move to the row's Actions menu, for videos, clips,
// streams, mixes and playlists. The More button is taken out of swiping in every list row and is
// in the Actions menu instead. On entering the app, and each time the Subscriptions tab opens,
// focus goes to the New section.
//
// The app is matched in Russian and in English, so the script works with either app language.

export const manifest = {
  id: 'ymusic-video-rows',
  name: 'YMusic: title and time',
  version: '1.7.1',
  author: 'Алёшка',
  description: 'Videos, clips and live streams in YMusic lists read only their title and time. Channel, views and publish date move to the Actions menu, for videos, clips, streams, mixes and playlists. The More button is hidden in every list row and opens from the Actions menu. On entering the app and each time Subscriptions opens, focus goes to the New section. Ported from SandFly and translated to English.',
  homepage: 'https://github.com/serrebidev/backtalk-scripts',
  minBuild: 395,
  apps: ['io.ymusic.android'],
  permissions: ['screen', 'speech', 'input', 'actions', 'events'],
  commands: [{ id: 'focus_new', title: 'Go to the New section', menu: true }],
  settings: [
    { key: 'focusNew', type: 'switch', title: 'Focus on New', summary: 'On entering the app, focus goes to the New section', default: true },
    { key: 'shorten', type: 'switch', title: 'Short row', summary: 'Only the title and time', default: true },
    {
      key: 'lineTime',
      type: 'list',
      title: 'What counts as the time',
      options: [
        { value: 'duration', label: 'Duration' },
        { value: 'published', label: 'When published' },
        { value: 'both', label: 'Both' },
      ],
      default: 'duration',
    },
  ],
  rules: [
    // The More button is hidden in every list row. A row is told by the " · " between its
    // details, which videos, clips, mixes, podcasts and playlists all have.
    { match: { className: 'Button', contentDescription: 'Ещё', inside: { textContains: ' · ' } }, hide: true },
    { match: { className: 'Button', contentDescription: 'More', inside: { textContains: ' · ' } }, hide: true },
  ],
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const later = (promise) => promise.catch((error) => console.error(String(error)));

// What YMusic shows, in Russian and in English.
const NEW = ['Новые', 'New'];
const MORE = ['Ещё', 'More'];
const SUBSCRIPTIONS = ['подписк', 'subscription'];

const setting = (key, fallback) => {
  const value = backtalk.settings.get(key);
  return value == null ? fallback : value;
};

// Duration: "11 minutes 57 seconds", "2:30", "1 hour". Channels have digits too, so a digit
// alone isn't enough: a time word or a colon is needed.
const looksLikeDuration = (s) => {
  if (!s || !/\d/.test(s)) return false;
  if (s.includes(':')) return true;
  const low = s.toLowerCase();
  return ['мин', 'сек', 'час', 'min', 'sec', 'hour'].some((w) => low.includes(w));
};

// Row kinds that have a channel, views and a date: videos, clips and live streams.
const VIDEO_KINDS = new Set(['видео', 'клип', 'видеоклип', 'трансляция', 'прямая трансляция', 'эфир', 'прямой эфир', 'video', 'clip', 'live', 'live stream', 'stream']);
const isVideoKind = (kind) => VIDEO_KINDS.has(kind.toLowerCase());

// Videos and clips: Video, <title>, <duration>, <channel> · <views> · <when>
// A stream can have no duration: <kind>, <title>, <channel> · … · …
// Mixes and playlists are shorter: <kind>, <title> · Playlist.
// The title can contain commas, so the row is cut from the end.
const parseRow = (text) => {
  if (!text) return null;
  const segs = text.split(' · ');
  if (segs.length < 2) return null;
  const head = segs[0].trim();
  let published = segs[segs.length - 1].trim();
  const views = segs.length >= 3 ? segs.slice(1, -1).map((s) => s.trim()).join(', ') || null : null;
  const parts = head.split(',');
  if (parts.length < 2) return null;
  const kind = parts[0].trim();
  const video = isVideoKind(kind);
  let channel = null;
  let duration = null;
  let titleTo = parts.length;
  if (video && parts.length >= 4 && looksLikeDuration(parts[parts.length - 2])) {
    channel = parts[parts.length - 1].trim();
    duration = parts[parts.length - 2].trim();
    titleTo = parts.length - 2;
  } else if (video && parts.length >= 3) {
    // A stream without a duration: the last part is the channel.
    channel = parts[parts.length - 1].trim();
    titleTo = parts.length - 1;
  }
  const title = parts.slice(1, titleTo).map((p) => p.trim()).join(', ');
  if (!title) return null;
  // For a mix or playlist the last piece ("Playlist") is the row's kind, not a date.
  if (!video) published = null;
  return { kind, video, title, duration: duration || null, channel: channel || null, views, published };
};

const lineTime = (row) => {
  const mode = setting('lineTime', 'duration');
  if (mode === 'published') return row.published || row.duration;
  if (mode === 'both' && row.duration && row.published) return `${row.duration}, ${row.published}`;
  return row.duration || row.published;
};

const restText = (row) => {
  const mode = setting('lineTime', 'duration');
  const parts = [];
  if (mode === 'published' && row.duration) parts.push(row.duration);
  if (row.views) parts.push(row.views);
  // The date isn't repeated when it was already said as the row's time, as for a stream.
  if (mode !== 'published' && row.published && row.duration) parts.push(row.published);
  return parts.join(', ');
};

// A video, clip or stream row says only its title and time.
backtalk.onFocus((item, text) => {
  const row = (item && parseRow(item.text)) || (text && parseRow(text));
  if (!row || !row.video || setting('shorten', true) === false) return undefined;
  const t = lineTime(row);
  return t ? { speak: `${row.title}, ${t}` } : undefined;
});

// The More button is hidden from swiping by a rule, but is still on screen to press.
const findMore = (it) => {
  if (!it) return null;
  for (const label of MORE) {
    const button = it.find({ className: 'Button', contentDescription: label });
    if (button) return button;
  }
  return it.find({ className: 'Button', text: 'Ещё' }) || it.find({ className: 'Button', text: 'More' });
};

const clickMore = (it) => {
  const button = findMore(it) || it?.find({ className: 'Button' });
  if (button) button.click();
  else backtalk.speak('More button not found');
};

// Actions: the channel, the other details and the More button. Each appears when the row has it.
backtalk.onActions((item) => {
  if (!item) return undefined;
  const row = parseRow(item.text);
  const actions = [];
  if (row?.channel) actions.push({ title: `Channel: ${row.channel}`, run: () => backtalk.speak(`Channel: ${row.channel}`) });
  const rest = row ? restText(row) : '';
  if (rest) actions.push({ title: `Details: ${rest}`, run: () => backtalk.speak(rest) });
  if (findMore(item)) actions.push({ title: 'More', run: (it) => clickMore(it) });
  return actions.length ? actions : undefined;
});

// ---------------------------------------------------------------- focus on New

const findNew = (headingOnly) => {
  for (const label of NEW) {
    const found = backtalk.screen.findAll({ text: label }, 10);
    const hit = headingOnly ? found.find((n) => n.heading) : found[0];
    if (hit) return hit;
  }
  return null;
};

const waitForNew = async (headingOnly, timeout, interval = 300) => {
  const end = Date.now() + timeout;
  for (;;) {
    const found = findNew(headingOnly);
    if (found || Date.now() >= end) return found;
    await sleep(interval);
  }
};

// The list takes a while to appear, so wait: up to 15 seconds for the heading itself, then
// briefly for any "New" text.
const findNewHeading = async (timeout = 15000) => (await waitForNew(true, timeout)) || waitForNew(false, 1500);

// Leave the focus alone if it's already in the list of videos.
const focusIsInList = () => {
  const cur = backtalk.screen.focused();
  return Boolean(cur && parseRow(cur.text)?.video);
};
const focusIsOnHeading = () => NEW.includes(backtalk.screen.focused()?.text);

let focusGen = 0;

// force: entering the app, where focus always goes to New, even if it was left on a video row.
const focusNewSection = (force) => {
  if (setting('focusNew', true) === false) return;
  const mine = ++focusGen;
  later((async () => {
    const heading = await findNewHeading(force ? 15000 : 6000);
    // The screen changed again while waiting: the later call does the work.
    if (!heading || mine !== focusGen || focusIsOnHeading()) return;
    if (!force && focusIsInList()) return;
    heading.focus();
  })());
};

backtalk.onAppEnter(() => focusNewSection(true));
backtalk.onWindowChange(() => focusNewSection(false));

// The Subscriptions tab: after switching to it, focus goes to New. The label's length is
// checked, so the bottom bar's container, whose label lists every tab, doesn't match.
backtalk.onEvent((event) => {
  if (event.type !== 'VIEW_CLICKED' || event.package !== 'io.ymusic.android') return;
  if (setting('focusNew', true) === false) return;
  const label = (event.text || event.contentDescription || '').toLowerCase();
  if (!label || label.length > 40 || !SUBSCRIPTIONS.some((w) => label.includes(w))) return;
  later((async () => {
    const heading = await waitForNew(false, 5000);
    if (heading && !focusIsOnHeading()) heading.focus();
  })());
});

// Watch for the New heading to appear: the Subscriptions tab opened from another tab, the app
// came back to it, and so on. If it only scrolled out of view, focus is on a video row and is
// left there.
let headingShown = false;
let checkScheduled = false;
backtalk.onContentChange(() => {
  if (checkScheduled) return;
  checkScheduled = true;
  setTimeout(() => {
    checkScheduled = false;
    const heading = findNew(true) || findNew(false);
    if (!heading) {
      headingShown = false;
      return;
    }
    if (headingShown) return;
    headingShown = true;
    focusNewSection(false);
  }, 500);
});

backtalk.onCommand('focus_new', () => {
  later((async () => {
    const heading = await findNewHeading(3000);
    if (heading) heading.focus();
    else backtalk.speak('New section not found');
  })());
});
