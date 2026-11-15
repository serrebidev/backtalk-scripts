// Facebook Actions and Skip, for Backtalk.
// Port of Justin Harris's SandFly script facebook-actions-skip.lua 1.6
// (https://github.com/jharris171185/sandfly-scripts).
//
// 1. Post actions, iOS VoiceOver style. On a feed post, swipe down or up to cycle the post's
//    actions (Like, React, Comment, Share, and the rest), then double-tap to run the one you
//    picked. A feed post only exposes "Open full post" and "Open actions menu", so the script
//    opens that menu, reads its real buttons, and presses your pick. It tracks reactions per post
//    ("Like" becomes "Remove Like reaction"), and corrects itself from the real menu.
//    With nothing picked, double-tap does what it always does.
// 2. Section skip. Backtalk+J, or a two- or three-finger swipe right, jumps out of a feed
//    section (stories, reels, People You May Know) to the first real post below it.
//
// SandFly crept down the feed with small finger swipes when nothing below a section was loaded.
// Backtalk scripts can't touch the screen, so this port takes the same small steps with
// Android's "show on screen" action on the feed's last row.

export const manifest = {
  id: 'facebook-actions-skip',
  name: 'Facebook Actions and Skip',
  version: '1.6.1',
  author: 'Justin Harris',
  description: 'Swipe up or down on a post to cycle its actions, double-tap to run the selected one. Backtalk+J or a two-finger swipe right skips feed sections (stories, reels, People You May Know) to the next post. Ported from SandFly',
  homepage: 'https://github.com/serrebidev/backtalk-scripts',
  minBuild: 395,
  apps: ['com.facebook.katana'],
  permissions: ['screen', 'actions', 'input', 'speech'],
  commands: [
    { id: 'next_action', title: 'Next action', gesture: 'swipeDown' },
    { id: 'prev_action', title: 'Previous action', gesture: 'swipeUp' },
    { id: 'run_action', title: 'Run selected action', gesture: 'doubleTap' },
    { id: 'skip_section', title: 'Skip section', gesture: ['twoFingerSwipeRight', 'threeFingerSwipeRight'], keys: 'backtalk+j' },
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

const STANDARD = new Set(['click', 'longClick', 'scrollForward', 'scrollBackward', 'expand', 'collapse', 'dismiss', 'copy', 'cut', 'paste', 'select']);
const hasAction = (node, label) => (node.actions || []).some((a) => a.label === label);
const isPost = (node) => hasAction(node, 'Open actions menu');
const postKey = (node) => node.contentDescription || node.text || '';
const containsText = (node) => Boolean(node.text || node.contentDescription);

const isInside = (node, ancestor) => {
  let p = node;
  for (let i = 0; p && i < 40; i++) {
    if (p.equals(ancestor)) return true;
    p = p.parent;
  }
  return false;
};

// ---------------------------------------------------------------- Part 1: action cycling

let sel = null; // { node, idx, label, id, kind }

// Reaction state per post: 'like', 'other', or missing for no reaction. Kept for this visit to
// the app only; the menu check corrects it whenever it is wrong.
const postState = new Map();

const postMenuItems = (state) => {
  const [first, second] =
    state === 'like' ? ['Remove Like reaction', 'Change reaction']
      : state === 'other' ? ['Remove reaction', 'Change reaction']
        : ['Like', 'React'];
  return [first, second, 'Comment', 'Share', 'See more options for this post', 'Get detailed image descriptions'];
};

const usableActions = (node) =>
  (node.actions || []).filter((a) => a.label && !STANDARD.has(a.label)).map((a) => ({ label: a.label, id: a.id }));

const cycle = (dir, node) => {
  if (!node) return false;
  let items;
  let kind;
  if (isPost(node)) {
    items = postMenuItems(postState.get(postKey(node))).map((label) => ({ label }));
    kind = 'menu';
  } else {
    items = usableActions(node);
    kind = 'action';
  }
  if (items.length === 0) return false;
  let idx;
  if (!sel || !sel.node.equals(node) || sel.kind !== kind) {
    idx = dir > 0 ? 0 : items.length - 1;
  } else {
    idx = (sel.idx + dir + items.length) % items.length;
  }
  sel = { node, idx, kind, label: items[idx].label, id: items[idx].id };
  backtalk.speak(sel.label, { interrupt: true });
  return true;
};

backtalk.onCommand('next_action', (event) => (cycle(1, event.node || backtalk.screen.focused()) ? undefined : false));
backtalk.onCommand('prev_action', (event) => (cycle(-1, event.node || backtalk.screen.focused()) ? undefined : false));

// Opens the post's menu, reads its real buttons, and presses the pick.
const runMenuPick = async (post, label) => {
  const key = postKey(post);
  let opened = false;
  try {
    opened = await post.perform('Open actions menu');
  } catch (error) {
    opened = false;
  }
  if (!opened) {
    backtalk.speak('Could not open the menu');
    return;
  }
  // "Comment" is in the menu in every state, so it says the menu is ready.
  const ready = await waitFor({ contentDescription: 'Comment', className: 'Button' }, 3000);
  if (!ready) {
    backtalk.speak('Menu did not open');
    return;
  }
  const byLabel = new Map();
  let removeBtn = null;
  let removeLabel = null;
  for (const b of backtalk.screen.findAll({ className: 'Button' }, 60)) {
    const d = b.contentDescription;
    if (!d) continue;
    if (!byLabel.has(d)) byLabel.set(d, b);
    if (d.startsWith('Remove ') && d.endsWith(' reaction')) {
      removeBtn = b;
      removeLabel = d;
    }
  }
  const closeMenu = () => byLabel.get('Close')?.click();
  const learnFromRemove = () => postState.set(key, removeLabel === 'Remove Like reaction' ? 'like' : 'other');

  if (label === 'Like') {
    if (byLabel.has('Like')) {
      byLabel.get('Like').click();
      postState.set(key, 'like');
      backtalk.speak('Liked');
    } else if (removeBtn) {
      learnFromRemove();
      closeMenu();
      backtalk.speak('Already reacted');
    } else {
      backtalk.speak('Not in this menu');
    }
    return;
  }
  if (label === 'Remove Like reaction' || label === 'Remove reaction') {
    if (removeBtn) {
      removeBtn.click();
      postState.delete(key);
      backtalk.speak('Reaction removed');
    } else if (byLabel.has('Like')) {
      postState.delete(key);
      closeMenu();
      backtalk.speak('Not reacted');
    } else {
      backtalk.speak('Not in this menu');
    }
    return;
  }
  if (label === 'React' || label === 'Change reaction') {
    const b = byLabel.get('React') || byLabel.get('Change reaction');
    if (b) {
      b.click();
      // The picker is open now; whatever is picked there is a reaction.
      postState.set(key, 'other');
    } else {
      backtalk.speak('Not in this menu');
    }
    return;
  }
  const b = byLabel.get(label);
  if (b) {
    b.click();
  } else {
    // Left open on screen, so it can be picked by hand.
    backtalk.speak('Not in this menu');
  }
};

const runAction = async (node, label, id) => {
  let ok = false;
  try {
    ok = await node.perform(label);
  } catch (error) {
    ok = false;
  }
  if (!ok && id != null) {
    try {
      ok = await node.perform(id);
    } catch (error) {
      ok = false;
    }
  }
  if (!ok) backtalk.speak('Action did not run');
};

backtalk.onCommand('run_action', (event) => {
  const node = event.node || backtalk.screen.focused();
  if (!sel || !node || !node.equals(sel.node)) return false;
  const fresh = node.refresh();
  const { label, id, kind } = sel;
  sel = null;
  if (!fresh) return false;
  later(kind === 'menu' ? runMenuPick(fresh, label) : runAction(fresh, label, id));
  return undefined;
});

// Moving focus to another item forgets the selection. equals needs no call to the app.
backtalk.onFocus((item) => {
  if (sel && item && !item.equals(sel.node)) sel = null;
});

// ---------------------------------------------------------------- Part 2: section skip

// The feed list: the RecyclerView that isn't inside another list.
const feedList = () => {
  for (const list of backtalk.screen.findAll({ className: 'RecyclerView' }, 50)) {
    let p = list.parent;
    let nested = false;
    for (let i = 0; p && i < 40; i++) {
      if ((p.className || '').endsWith('RecyclerView')) {
        nested = true;
        break;
      }
      p = p.parent;
    }
    if (!nested) return list;
  }
  return null;
};

// Trays and shelves hold a list; posts and the composer don't.
const containsList = (node, depth) => {
  if (depth > 6) return false;
  for (const k of node.children) {
    const cn = k.className || '';
    if (cn.endsWith('RecyclerView') || cn.endsWith('ListView')) return true;
    if (containsList(k, depth + 1)) return true;
  }
  return false;
};

const SECTION_WORDS = ['story tray', 'people you may know', 'reels'];
const isSection = (row) => {
  if (containsList(row, 0)) return true;
  const d = (row.contentDescription || '').toLowerCase();
  return SECTION_WORDS.some((w) => d.includes(w));
};

// The first focusable item with text inside a feed row: the post itself.
const postTarget = (node, depth) => {
  if (depth > 6) return null;
  if (node.focusable && containsText(node)) return node;
  for (const k of node.children) {
    const t = postTarget(k, depth + 1);
    if (t) return t;
  }
  return null;
};

const focusPostBelow = (kids, from) => {
  for (let i = from; i < kids.length; i++) {
    if (isSection(kids[i])) continue;
    const t = postTarget(kids[i], 0);
    if (t) {
      t.focus();
      return true;
    }
  }
  return false;
};

// A real post carries the "Open actions menu" action. Focus the topmost one at or below minTop.
// Each feed row is searched on its own, so a long feed can't push posts past the search limit.
const scanPostBelow = (list, minTop) => {
  // Rows run top to bottom, so the first row with a post holds the topmost one. Focusing it at
  // once also keeps it within the last 500 items Backtalk remembers.
  for (const row of list.children) {
    if (row.bounds && minTop != null && row.bounds.bottom < minTop - 4) continue;
    let best = null;
    for (const p of [row, ...row.findAll({}, 200)]) {
      if (!p.focusable || !isPost(p) || !p.bounds) continue;
      const { top, bottom } = p.bounds;
      if (bottom > 0 && (minTop == null || top >= minTop - 4) && (!best || top < best.bounds.top)) best = p;
    }
    if (best) {
      best.focus();
      return true;
    }
  }
  return false;
};

// After a scroll: land after a section still loaded, or on the first post whose top is on screen.
const landAfterScroll = () => {
  const list = feedList();
  if (!list) return false;
  const kids = list.children;
  const secIdx = kids.findIndex(isSection);
  if (secIdx >= 0) {
    if (focusPostBelow(kids, secIdx + 1)) return true;
    return scanPostBelow(list, kids[secIdx].bounds?.bottom);
  }
  for (const k of kids) {
    if (k.bounds && (k.bounds.bottom <= 0 || k.bounds.top < 0)) continue;
    const t = postTarget(k, 0);
    if (t) {
      t.focus();
      return true;
    }
  }
  return false;
};

// Android's "show on screen" action on the feed's last row: the list scrolls only as far as
// that row needs, a small step, and lays out the rows under it. Checked after every step, so
// the first post under the section is the one landed on.
const ACTION_SHOW_ON_SCREEN = 16908342;
const scrollAndLand = async () => {
  for (let i = 0; i < 4; i++) {
    const list = feedList();
    const kids = list ? list.children : [];
    const last = kids[kids.length - 1];
    if (!last) break;
    if (!(await last.perform(ACTION_SHOW_ON_SCREEN).catch(() => false))) await list.scrollForward();
    await sleep(350);
    if (landAfterScroll()) return;
  }
  backtalk.speak('No post below');
};

backtalk.onCommand('skip_section', (event) => {
  const node = event.node || backtalk.screen.focused();
  if (!node) return undefined;
  const list = feedList();
  if (!list) return undefined;
  const kids = list.children;
  const cur = kids.findIndex((k) => node.equals(k) || isInside(node, k));
  if (cur < 0 || !isSection(kids[cur])) return undefined; // escape only
  if (focusPostBelow(kids, cur + 1)) return undefined;
  if (scanPostBelow(list, kids[cur].bounds?.bottom)) return undefined;
  later(scrollAndLand());
  return undefined;
});
