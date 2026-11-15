// WhatsApp messages, for Backtalk.
// Port of Aaron Hewitt's SandFly script whatsapp-messages.lua 3.5
// (https://github.com/aaron-gh/sandfly-scripts, Apache License 2.0). Backtalk's own
// backtalk-scripts has an older version of this script, 1.1; this is the newer one, with polls,
// voice and audio messages, documents, photos, link previews, reactions, edited messages, and
// long messages expanded. Its id is different, so turn the older one off while this one is on.

export const manifest = {
  id: 'whatsapp-messages-plus',
  name: 'WhatsApp messages (3.5)',
  version: '3.5.1',
  author: 'Aaron Hewitt',
  description: 'Reads each message in a WhatsApp chat as one item: sender, content, the message it replies to, and time. Play, playback speed and the other buttons in a message are in its Actions menu. Ported from SandFly version 3.5; turn off the older WhatsApp messages script while this one is on',
  homepage: 'https://github.com/serrebidev/backtalk-scripts',
  minBuild: 395,
  apps: [
    { package: 'com.whatsapp', activity: 'Conversation' },
    { package: 'com.whatsapp.w4b', activity: 'Conversation' },
  ],
  permissions: ['screen', 'actions', 'speech', 'input'],
  settings: [{ key: 'expandLong', type: 'switch', title: 'Expand long messages', default: true }],
  rules: [
    { match: { parentId: 'list', className: 'ViewGroup' }, group: true },
    // A double tap on a photo message opens the photo, not the row.
    { id: 'conversation_row_image', activate: { id: 'image' } },
    { match: { clickable: true, inside: { parentId: 'list', className: 'ViewGroup' } }, hide: 'all' },
    { match: { className: 'SeekBar', inside: { parentId: 'list', className: 'ViewGroup' } }, hide: true, silence: true },
    // A voice message's time, which counts up each second while it plays.
    { match: { id: 'description', inside: { parentId: 'list', className: 'ViewGroup' } }, silence: true },
  ],
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A message row is read with one search, which gives the row and everything in it, so the rest
// of the script looks things up here instead of asking WhatsApp again. Every call to the app
// takes time, more than Backtalk waits for onFocus, so the row is read after onFocus returns.
const MAX_ROW_ITEMS = 200;
const MAX_BUTTONS = 24;
const MAX_OPTIONS = 20;
const MAX_REACTIONS = 8;
const MAX_NOTICES = 5;
const LABEL_DEPTH = 3;
const MAX_BUBBLE_ITEMS = 60;
const MAX_BUBBLE_TEXTS = 6;

const join = (parts, separator) => parts.filter((p) => p).join(separator);
const shortId = (item) => (item.id || '').split('/').pop();

// Removes the direction marks WhatsApp adds, and the "~" before a name the contact list doesn't
// have.
const clean = (text) =>
  (text || '')
    .replace(/[​-‏‪-‮⁦-⁩]/g, '')
    .replace(/ /g, ' ')
    .trim()
    .replace(/^~\s*/, '')
    .trim();

// The list of messages the row is in, or null if the item isn't a message row.
const listOf = (item) => {
  if (!shortId(item).startsWith('conversation_row_')) return null;
  const parent = item.parent;
  return parent && (parent.id || '').endsWith('/list') ? parent : null;
};

// The row and everything in it, by short id.
const readRow = (row, list) => {
  const items = row.findAll({}, MAX_ROW_ITEMS);
  const byId = new Map();
  for (const item of items) {
    const id = shortId(item);
    if (!id) continue;
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id).push(item);
  }
  return { node: row, list, items, byId };
};

const first = (r, id) => r.byId.get(id)?.[0] || null;
const allOf = (r, id, limit) => (r.byId.get(id) || []).slice(0, limit);
const textIn = (r, id) => clean(first(r, id)?.text);
const mainOf = (r) => first(r, 'main_layout') || first(r, 'polls_main_layout');

// Sent messages have a delivery status and sit against the right edge.
const isOutgoing = (r) => {
  if (first(r, 'status')) return true;
  const main = mainOf(r);
  const row = r.node;
  return main != null && row.bounds.right - main.bounds.right < main.bounds.left - row.bounds.left;
};

// Whether the chat is a group, and the contact's name if not, kept for each chat.
let chats = new Map();

// In a chat with one person, the messages from them have no name and no picture.
const contactName = (list) => {
  if (!list) return '';
  let chat = chats.get(list.handle);
  if (!chat) {
    const isGroup = ['name_in_group_tv', 'group_profile_pic', 'group_profile_initials'].some((id) => list.find(id));
    const title = isGroup ? null : backtalk.screen.find('conversation_contact_name');
    chat = { name: title ? clean(title.text) : '' };
    chats.set(list.handle, chat);
  }
  return chat.name;
};

// Splits "54 seconds, 09:11, played" into the body, the time and what follows the time.
const splitTime = (rest) => {
  const re = /,\s*(\d\d?:\d\d)/g;
  let m;
  while ((m = re.exec(rest))) {
    let time = m[1];
    let tail = rest.slice(m.index + m[0].length);
    const ampm = tail.match(/^\s?[aApP][mM]/);
    if (ampm) {
      time += ampm[0];
      tail = tail.slice(ampm[0].length);
    }
    if (tail === '') return { body: rest.slice(0, m.index), time, state: null };
    const state = tail.match(/^,\s*(.*)$/s);
    if (state) return { body: rest.slice(0, m.index), time, state: state[1] };
    re.lastIndex = m.index + 1;
  }
  return null;
};

// "Alex Smith, voice message, 54 seconds, 09:11" has the sender first, and the time and
// "played" last. A sound file reads "audio message" instead, and its row also shows the file name.
const voiceOf = (r) => {
  if (r.voice === undefined) {
    r.voice = null;
    const description = first(r, 'main_layout')?.contentDescription || '';
    const at = [description.indexOf(', voice message'), description.indexOf(', audio message')]
      .filter((i) => i >= 0)
      .reduce((a, b) => Math.min(a, b), Infinity);
    if (at !== Infinity) {
      const rest = description.slice(at + 2);
      const file = shortId(r.node) === 'conversation_row_audio' ? textIn(r, 'description') : '';
      const split = splitTime(rest);
      r.voice = {
        sender: clean(description.slice(0, at)),
        body: join([split ? split.body : rest, file], ', '),
        time: split?.time || '',
        state: split?.state || '',
      };
    }
  }
  return r.voice;
};

// "Poll from Alex Smith, next event.\nSelect one or more\n..."; each option reads "Name, 2 votes".
const pollOf = (r) => {
  if (r.poll === undefined) {
    r.poll = null;
    const main = first(r, 'polls_main_layout');
    if (main) {
      const name = textIn(r, 'poll_name');
      const description = main.contentDescription || '';
      const endAt = description.indexOf(`, ${name}.`);
      const parts = [`poll: ${name}`, textIn(r, 'poll_type_text')];
      for (const option of allOf(r, 'poll_option_main_layout', MAX_OPTIONS)) {
        const label = clean(option.contentDescription);
        parts.push(option.checked ? `selected ${label}` : label);
      }
      const prefix = 'Poll from ';
      r.poll = {
        sender: description.startsWith(prefix) && endAt >= 0 ? clean(description.slice(prefix.length, endAt)) : '',
        body: join(parts, '. '),
      };
    }
  }
  return r.poll;
};

// A message from the same sender as the one before it has no name of its own.
const senderOf = (r, depth = 3) => {
  const named = textIn(r, 'name_in_group_tv');
  if (named) return named;
  const known = (voiceOf(r) || pollOf(r) || {}).sender;
  if (known) return known;
  if (isOutgoing(r)) return 'You';
  if (depth > 0 && r.list) {
    const rows = r.rows || r.list.children;
    const i = rows.findIndex((sibling) => sibling.equals(r.node));
    if (i > 0) {
      const p = readRow(rows[i - 1], r.list);
      p.rows = rows;
      if (!isOutgoing(p)) {
        const name = senderOf(p, depth - 1);
        if (name) return name;
      }
    }
  }
  return contactName(r.list);
};

// "Voice message, 2 minutes, 33 seconds elapsed"; "0 seconds elapsed" before it has played.
const elapsedOf = (r) => {
  const m = (first(r, 'audio_seekbar')?.contentDescription || '').match(/^Voice message, (.*) elapsed$/);
  return m && m[1] !== '0 seconds' ? `${m[1]} elapsed` : '';
};

const labelOf = (item, depth = LABEL_DEPTH) => {
  const own = clean(item.contentDescription || item.text);
  if (own || depth === 0) return own;
  for (const child of item.children) {
    const label = labelOf(child, depth - 1);
    if (label) return label;
  }
  return '';
};

const documentOf = (r) => {
  if (shortId(r.node) !== 'conversation_row_document') return '';
  const content = first(r, 'content');
  const label = content ? labelOf(content) : '';
  return label ? `document: ${label}` : 'document';
};

// "Enlarge photo", or "Photo 331 kB" before it is downloaded.
const photoOf = (r) => {
  if (shortId(r.node) !== 'conversation_row_image') return '';
  const label = clean(first(r, 'image')?.contentDescription);
  if (!label || label.toLowerCase() === 'enlarge photo') return 'photo';
  if (label.slice(0, 5).toLowerCase() === 'photo') return `photo${label.slice(5)}`;
  return label;
};

// Only the quote's title and text are there for a screen reader.
const replyOf = (r) => {
  const author = textIn(r, 'quoted_title');
  const quoted = textIn(r, 'quoted_text');
  if (!author && !quoted) return '';
  return join([`in reply to ${author}`.trim(), quoted], ': ');
};

// A link's preview repeats the link; only a title that isn't the address is worth saying,
// unless the message is only the link.
const previewOf = (r, alone) => {
  const title = textIn(r, 'title');
  const isAddress = /^https?:\/\//.test(title) || /^www\./.test(title);
  let named = null;
  if (title && !isAddress) named = title;
  else if (alone) named = textIn(r, 'url') || title;
  if (!named) return '';
  return `${first(r, 'play_button') ? 'video link' : 'link'}: ${named}`;
};

// A message of a kind not handled above is read from the rest of the text in its bubble.
const SKIP_IDS = new Set(['date', 'status', 'name_in_group_tv', 'secondary_name_in_group_tv', 'conversation_row_date_divider', 'group_profile_initials']);
const bubbleTextOf = (r) => {
  const main = mainOf(r) || r.node;
  const texts = [];
  const seen = new Set();
  for (const item of main.findAll({}, MAX_BUBBLE_ITEMS)) {
    if (texts.length >= MAX_BUBBLE_TEXTS) break;
    if (SKIP_IDS.has(shortId(item))) continue;
    const own = clean(item.contentDescription || item.text);
    if (own && !seen.has(own)) {
      seen.add(own);
      texts.push(own);
    }
  }
  return texts.join(', ');
};

const reactionsOf = (r) => {
  const reactions = allOf(r, 'reaction_bubble_emoji_text', MAX_REACTIONS).map((x) => clean(x.text));
  return reactions.length ? `reactions ${reactions.join(' ')}` : '';
};

const describe = (r) => {
  const voice = voiceOf(r);
  const poll = voice ? null : pollOf(r);
  let body;
  if (voice) body = voice.body;
  else if (poll) body = poll.body;
  else body = join([documentOf(r) || photoOf(r), textIn(r, 'message_text') || textIn(r, 'caption')], ', ');
  const notices = allOf(r, 'info', MAX_NOTICES).map((x) => clean(x.text));
  const preview = previewOf(r, body === '');
  const other = body === '' && preview === '' ? bubbleTextOf(r) : '';
  if (!body && !preview && !other) return notices.length ? notices.join(', ') : null;
  const status = first(r, 'status');
  const time = voice ? voice.time : textIn(r, 'date');
  const state = (voice && voice.state) || status?.contentDescription;
  return join([
    senderOf(r),
    body || preview || other,
    voice && elapsedOf(r),
    first(r, 'edit_label') && 'edited',
    body && preview,
    replyOf(r),
    reactionsOf(r),
    join([time, state, textIn(r, 'conversation_row_date_divider')], ', '),
    ...notices,
  ], ', ');
};

const readMoreIn = (r) => r.items.find((item) => item.contentDescription === 'Read more') || null;

const EXPAND_ATTEMPTS = 4;
const EXPAND_DELAY = 250;

// Each focus is counted, so that a row read after focus moved on isn't said.
let focusCount = 0;

// WhatsApp cuts a long message off in the screen's text, so open it and say the whole message.
const expand = async (row, list, readMore, count) => {
  readMore.click();
  let current = row;
  for (let i = 0; i < EXPAND_ATTEMPTS; i++) {
    await sleep(EXPAND_DELAY);
    current = current.refresh() || current;
    if (!current.find({ contentDescription: 'Read more' })) break;
  }
  const text = describe(readRow(current, list));
  if (text && count === focusCount) backtalk.speak(text, { interrupt: true });
};

let expandLong = backtalk.settings.get('expandLong') !== false;
backtalk.onSettingChange((key, value) => {
  if (key === 'expandLong') expandLong = value !== false;
});

backtalk.onWindowChange(() => {
  chats = new Map();
});

// Reads the focused row and says it, or what Backtalk would have said if it isn't a message.
const sayRow = (item, fallback, count) => {
  const list = listOf(item);
  const r = list && readRow(item, list);
  const readMore = r && expandLong && readMoreIn(r);
  if (readMore) {
    expand(item, list, readMore, count).catch((error) => console.error(String(error)));
    return;
  }
  const text = (r && describe(r)) || fallback;
  if (count === focusCount && text) backtalk.speak(text, { interrupt: true });
};

backtalk.onFocus((item, text) => {
  focusCount++;
  // Only the id is looked at here, which needs no call to WhatsApp.
  if (!shortId(item).startsWith('conversation_row_')) return undefined;
  const count = focusCount;
  setTimeout(() => sayRow(item, text, count), 0);
  return false;
});

const SKIPPED_BUTTONS = new Set(['name_in_group', 'contact_photo_view', 'url_layout', 'poll_option_vote_checkbox', 'info']);
const isImageButton = (button) => (button.className || '').endsWith('ImageButton');

// downloading is true while the row has a Download button, so its photo isn't there yet.
const titleOf = (button, downloading) => {
  const id = shortId(button);
  if (id === 'bubble_quoted_message_frame') return 'Go to replied message';
  if (id === 'reactions_bubble_layout') return 'View reactions';
  if (id === 'link_preview_frame') return 'Open link';
  if (id === 'poll_option_main_layout') return `Vote: ${labelOf(button)}`;
  if (id === 'image') return downloading ? '' : 'Open photo';
  if (id === 'polls_main_layout') {
    const label = labelOf(button);
    return label.toLowerCase() === 'enlarge photo' ? label : '';
  }
  if (id === 'control_btn') return isImageButton(button) ? labelOf(button) : 'Download';
  if (SKIPPED_BUTTONS.has(id)) return '';
  const label = labelOf(button);
  return /^https?:\/\//.test(label) ? 'Open link' : label;
};

backtalk.onActions((item) => {
  if (!listOf(item)) return undefined;
  const buttons = item.findAll({ clickable: true }, MAX_BUTTONS);
  const downloading = buttons.some((b) => shortId(b) === 'control_btn' && !isImageButton(b));
  const actions = [];
  const titles = new Set();
  for (const button of buttons) {
    if (button.equals(item) || button.find('group_profile_initials') || button.find('group_profile_pic')) continue;
    const title = titleOf(button, downloading);
    if (title && !titles.has(title)) {
      titles.add(title);
      actions.push({ title, run: () => button.click() });
    }
  }
  return actions;
});
