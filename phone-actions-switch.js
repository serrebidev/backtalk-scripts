// Phone Actions and Switch, for Backtalk.
// Port of Justin Harris's SandFly script phone-actions-switch.lua 1.1
// (https://github.com/jharris171185/sandfly-scripts).
//
// Google Phone (com.google.android.dialer) and Google Contacts (com.google.android.contacts),
// with lists that work the way iOS VoiceOver handles them:
// - Swipe right or left moves entry to entry, skipping the buttons inside each entry.
// - Swipe down or up cycles the entry's actions: in Recents Call, Message, History, Quick contact
//   and any other buttons the entry has; in Contacts Call, Message, Video call, Email, Open card,
//   Edit contact.
// - Double-tap runs the selected action. With nothing selected, double-tap calls.
// - A three-finger swipe right or left switches between Recents and Contacts.
// Anywhere else (keypad, voicemail, in-call screen, search) the gestures do what they always do.

export const manifest = {
  id: 'phone-actions-switch',
  name: 'Phone Actions and Switch',
  version: '1.1.1',
  author: 'Justin Harris',
  description: 'iOS-style actions for the Google Phone call log and the Contacts list: swipe right or left moves entry to entry, swipe down or up cycles actions, double-tap calls or runs the selected action. A three-finger swipe left or right switches between Recents and Contacts. Ported from SandFly',
  homepage: 'https://github.com/serrebidev/backtalk-scripts',
  minBuild: 395,
  apps: ['com.google.android.dialer', 'com.google.android.contacts'],
  permissions: ['screen', 'actions', 'input', 'speech'],
  commands: [
    { id: 'next_action', title: 'Next action', gesture: 'swipeDown' },
    { id: 'prev_action', title: 'Previous action', gesture: 'swipeUp' },
    { id: 'run_action', title: 'Run selected action or call', gesture: 'doubleTap' },
    { id: 'next_item', title: 'Next entry', gesture: 'swipeRight' },
    { id: 'prev_item', title: 'Previous entry', gesture: 'swipeLeft' },
    { id: 'switch_view', title: 'Switch Recents and Contacts', gesture: ['threeFingerSwipeRight', 'threeFingerSwipeLeft'] },
  ],
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const later = (promise) => promise.catch((error) => console.error(String(error)));
const waitFor = async (query, timeout = 5000, interval = 250) => {
  const end = Date.now() + timeout;
  for (;;) {
    const found = backtalk.screen.find(query);
    if (found || Date.now() >= end) return found;
    await sleep(interval);
  }
};

const DIALER = 'com.google.android.dialer';
const CONTACTS = 'com.google.android.contacts';

const isInside = (node, ancestor) => {
  let p = node;
  for (let i = 0; p && i < 40; i++) {
    if (p.equals(ancestor)) return true;
    p = p.parent;
  }
  return false;
};
const hasAction = (node, label) => (node.actions || []).some((a) => a.label === label);
const top = (n) => n.bounds?.top ?? 0;
const byPos = (items) =>
  items.sort((a, b) => top(a) - top(b) || (a.bounds?.left ?? 0) - (b.bounds?.left ?? 0));

// ---------------------------------------------------------------- selection

let selKey = null;
let selIdx = null;
let selLabels = null;
const clearSelection = () => {
  selKey = null;
  selIdx = null;
  selLabels = null;
};
const cycle = (step) => {
  if (!selLabels || selLabels.length === 0) return null;
  const n = selLabels.length;
  selIdx = selIdx == null ? (step > 0 ? 0 : n - 1) : (selIdx + step + n) % n;
  return selLabels[selIdx];
};

// ---------------------------------------------------------------- Recents

const CARD_ID = 'com.google.android.dialer:id/call_log_entry_card';
const LOG_ID = 'com.google.android.dialer:id/call_log_recycler_view';
const EXPAND_LABEL = 'expand or collapse menu';

const findCards = () => {
  let cards = backtalk.screen.findAll({ id: CARD_ID }, 100);
  if (cards.length === 0) {
    cards = backtalk.screen.findAll({ className: 'CardView' }, 100).filter((c) => hasAction(c, EXPAND_LABEL));
  }
  return byPos(cards);
};

const cardOf = (node) => {
  let p = node;
  for (let i = 0; p && i < 12; i++) {
    if (hasAction(p, EXPAND_LABEL)) return p;
    p = p.parent;
  }
  return null;
};
const cardKey = (card) => card.contentDescription || card.text || '';
const cardChildByDesc = (card, prefix) =>
  card.findAll({}, 60).find((k) => (k.contentDescription || '').startsWith(prefix)) || null;

// The entry's expanded-area buttons, visible ones only, in screen order.
const cardButtons = (card) => byPos(card.findAll({ className: 'Button' }, 40).filter((k) => k.text && k.visible !== false));

const cardCycleLabels = (card) => {
  const labels = ['Call', 'Message', 'History', 'Quick contact'];
  for (const b of cardButtons(card)) if (!labels.includes(b.text)) labels.push(b.text);
  return labels;
};

const runCardPick = async (card, pick) => {
  const key = cardKey(card);
  if (pick === 'Call') {
    const btn = cardChildByDesc(card, 'call ');
    if (btn) btn.click();
    else backtalk.speak('No call button');
    return;
  }
  if (pick === 'Quick contact') {
    const av = cardChildByDesc(card, 'Quick contact for');
    if (av) av.click();
    else backtalk.speak('No quick contact');
    return;
  }
  // Everything else is in the expanded area: expand if needed, then press the real button.
  if (cardButtons(card).length === 0) {
    try {
      await card.perform(EXPAND_LABEL);
    } catch (error) {
      // not expandable
    }
    await sleep(450);
  }
  const fresh = findCards().find((c) => cardKey(c) === key) || card;
  const btn = cardButtons(fresh).find((b) => b.text === pick);
  if (btn) btn.click();
  else backtalk.speak('Not on this entry');
};

// ---------------------------------------------------------------- Contacts

const CONTACTS_CONTENT_ID = 'com.google.android.contacts:id/content';
const VERB_CALL_ID = 'com.google.android.contacts:id/verb_call';

const onContactDetail = () => backtalk.screen.find({ id: 'com.google.android.contacts:id/quickcontact_fragment_root' }) != null;

// The first item that scrolls, in screen-tree order, as a search for it would give.
const firstScrollable = (node, depth = 0) => {
  if (depth > 0 && node.scrollable) return node;
  if (depth > 15) return null;
  for (const k of node.children) {
    const hit = firstScrollable(k, depth + 1);
    if (hit) return hit;
  }
  return null;
};

const contactsList = () => {
  if (onContactDetail()) return null;
  const content = backtalk.screen.find({ id: CONTACTS_CONTENT_ID });
  return content ? firstScrollable(content) : null;
};

// The topmost focusable items under a node: a focusable item inside another one isn't a stop.
const topFocusables = (node, depth = 0) => {
  if (depth > 10) return [];
  return node.children.flatMap((k) => (k.focusable ? [k] : topFocusables(k, depth + 1)));
};
const listRows = (list) => byPos(topFocusables(list));

const rowTexts = (row) => row.findAll({ className: 'TextView' }, 12).map((t) => t.text).filter(Boolean);
// A contact row has one text, the name. "Create contact" has one too; "Your info" has two.
const isContactRow = (row) => {
  const texts = rowTexts(row);
  return texts.length === 1 && texts[0] !== 'Create contact';
};
const rowKey = (row) => rowTexts(row).join(' | ');

const rowOf = (list, node) => {
  let p = node;
  for (let i = 0; p && i < 12; i++) {
    if (p.focusable && !p.equals(list) && isInside(p, list)) {
      let q = p.parent;
      let outer = false;
      for (let j = 0; q && j < 12 && !q.equals(list); j++) {
        if (q.focusable) {
          outer = true;
          break;
        }
        q = q.parent;
      }
      if (!outer) return p;
    }
    p = p.parent;
  }
  return null;
};

const CONTACT_CYCLE = ['Call', 'Message', 'Video call', 'Email', 'Open card', 'Edit contact'];
const VERB_IDS = {
  Call: 'com.google.android.contacts:id/verb_call',
  Message: 'com.google.android.contacts:id/verb_text',
  'Video call': 'com.google.android.contacts:id/verb_video',
  Email: 'com.google.android.contacts:id/verb_email',
};

const runContactPick = async (row, pick) => {
  row.click();
  if (!(await waitFor({ id: VERB_CALL_ID }, 2500))) {
    backtalk.speak('Contact did not open');
    return;
  }
  if (pick === 'Open card') return;
  if (pick === 'Edit contact') {
    const edit = backtalk.screen.find({ id: 'com.google.android.contacts:id/menu_insert_or_edit' });
    if (edit) edit.click();
    else backtalk.speak('Not available');
    return;
  }
  const box = backtalk.screen.find({ id: VERB_IDS[pick] });
  const btn = box && box.findAll({ className: 'Button' }, 10)[0];
  if (!btn) {
    backtalk.speak('Not available');
    return;
  }
  if (pick === 'Email' && btn.enabled === false) {
    backtalk.speak('No email for this contact');
    return;
  }
  btn.click();
};

// ---------------------------------------------------------------- traversal

// Moves focus between stops. Gives true when done, or a promise when the list has to scroll.
const moveFocus = (stops, keyOf, node, step, list, reread) => {
  if (stops.length === 0) return false;
  const cur = stops.findIndex((s) => node.equals(s) || isInside(node, s));
  if (cur < 0) {
    // Focus is in the list but not on a stop: take the first stop past it.
    const y = top(node);
    if (step > 0) {
      const next = stops.find((s) => top(s) > y);
      if (next) {
        next.focus();
        return true;
      }
    } else {
      const prev = [...stops].reverse().find((s) => top(s) < y);
      if (prev) prev.focus();
      return Boolean(prev);
    }
  } else if (stops[cur + step]) {
    stops[cur + step].focus();
    return true;
  }
  // At the edge: scroll the list and look again.
  const oldKeys = new Set(stops.map(keyOf));
  return later((async () => {
    await (step > 0 ? list.scrollForward() : list.scrollBackward());
    await sleep(350);
    const fresh = reread();
    const order = step > 0 ? fresh : [...fresh].reverse();
    const target = order.find((s) => !oldKeys.has(keyOf(s)));
    if (target) target.focus();
    else backtalk.speak(step > 0 ? 'End of list' : 'Start of list');
  })());
};

const moveDialer = (node, step) => {
  const list = backtalk.screen.find({ id: LOG_ID });
  if (!list || !isInside(node, list)) return false;
  return moveFocus(findCards(), cardKey, node, step, list, findCards);
};

const moveContacts = (node, step) => {
  const list = contactsList();
  if (!list || !isInside(node, list)) return false;
  return moveFocus(listRows(list), rowKey, node, step, list, () => {
    const fresh = contactsList();
    return fresh ? listRows(fresh) : [];
  });
};

// ---------------------------------------------------------------- commands

const pkg = () => backtalk.app?.package || '';
const focusedNode = (event) => event?.node || backtalk.screen.focused();

// The entry the focus is on, as { key, kind, item }.
const entryOf = (node) => {
  if (pkg() === DIALER) {
    const card = cardOf(node);
    return card && { key: cardKey(card), kind: 'card', item: card };
  }
  if (pkg() === CONTACTS) {
    const list = contactsList();
    const row = list && rowOf(list, node);
    return row && isContactRow(row) ? { key: rowKey(row), kind: 'row', item: row } : null;
  }
  return null;
};

const cycleCommand = (event, step) => {
  const node = focusedNode(event);
  const entry = node && entryOf(node);
  if (!entry) return false;
  if (selKey !== entry.key) {
    clearSelection();
    selKey = entry.key;
    selLabels = entry.kind === 'card' ? cardCycleLabels(entry.item) : CONTACT_CYCLE;
  }
  const label = cycle(step);
  if (label == null) return false;
  backtalk.speak(label, { interrupt: true });
  return undefined;
};

backtalk.onCommand('next_action', (event) => cycleCommand(event, 1));
backtalk.onCommand('prev_action', (event) => cycleCommand(event, -1));

backtalk.onCommand('run_action', (event) => {
  const node = focusedNode(event);
  const entry = node && entryOf(node);
  if (!entry) return false;
  let pick = 'Call';
  if (selKey === entry.key && selIdx != null && selLabels) pick = selLabels[selIdx];
  clearSelection();
  later(entry.kind === 'card' ? runCardPick(entry.item, pick) : runContactPick(entry.item, pick));
  return undefined;
});

const move = (event, step) => {
  const node = focusedNode(event);
  if (!node) return false;
  const done = pkg() === DIALER ? moveDialer(node, step) : pkg() === CONTACTS ? moveContacts(node, step) : false;
  return done === false ? false : undefined;
};
backtalk.onCommand('next_item', (event) => move(event, 1));
backtalk.onCommand('prev_item', (event) => move(event, -1));

const openContacts = async () => {
  let drawer = backtalk.screen.find({ id: 'com.google.android.dialer:id/design_navigation_view' });
  if (!drawer) {
    const btn = backtalk.screen.find({ contentDescription: 'Open navigation drawer' });
    if (!btn) return;
    btn.click();
    drawer = await waitFor({ id: 'com.google.android.dialer:id/design_navigation_view' }, 2000);
    if (!drawer) {
      backtalk.speak('Menu did not open');
      return;
    }
  }
  const t = backtalk.screen.findAll({ id: 'com.google.android.dialer:id/design_menu_item_text' }, 20).find((x) => x.text === 'Contacts');
  if (!t) {
    backtalk.speak('Contacts not in menu');
    return;
  }
  const row = t.parent;
  if (!(row && (await row.click()))) t.click();
};

// Moving to another entry drops the pending pick, so it can never fire on the wrong entry.
// The entry is looked up after onFocus returns: it takes longer than Backtalk waits.
backtalk.onFocus((item) => {
  if (selKey == null) return;
  if (!item) {
    clearSelection();
    return;
  }
  setTimeout(() => {
    try {
      if (entryOf(item)?.key !== selKey) clearSelection();
    } catch (error) {
      clearSelection();
    }
  }, 0);
});

backtalk.onCommand('switch_view', () => {
  const activity = backtalk.app?.activity || '';
  if (pkg() === DIALER) {
    if (!activity.includes('MainActivity')) return false;
    if (!backtalk.screen.find({ id: 'com.google.android.dialer:id/design_navigation_view' })
        && !backtalk.screen.find({ contentDescription: 'Open navigation drawer' })) return false;
    later(openContacts());
    return undefined;
  }
  if (pkg() === CONTACTS) {
    if (!activity.includes('ContactLeafActivity')) return false;
    const up = backtalk.screen.find({ contentDescription: 'Navigate up' });
    if (!up) return false;
    up.click();
    return undefined;
  }
  return false;
});
