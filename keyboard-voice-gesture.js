// Keyboard voice typing gesture, for Backtalk.
// Port of Surendra's SandFly script keyboard-voice-gesture.lua 1.0.0
// (https://github.com/aaron-gh/sandfly-scripts, Apache License 2.0).
//
// While the keyboard is open, a two-finger double tap presses the keyboard's voice typing key,
// to start and to stop voice typing. Otherwise the gesture does what it normally does, such as
// play or pause media, or answer or end a call.
//
// No "apps" in the manifest on purpose: the keyboard is a window of its own, so the script must
// run in every app. The script API only searches the app's window, so the voice key is learned
// from the keyboard's own events (onContentChange and onFocus) and remembered.

export const manifest = {
  id: 'keyboard-voice-gesture',
  name: 'Keyboard voice typing gesture',
  version: '1.0.1',
  author: 'Surendra',
  description: 'While the keyboard is open, a two-finger double tap presses the keyboard voice typing key, to start and to stop voice typing. Otherwise the gesture does what it normally does, such as play or pause media, or answer or end a call. Ported from SandFly.',
  homepage: 'https://github.com/serrebidev/backtalk-scripts',
  minBuild: 395,
  permissions: ['screen', 'actions', 'speech', 'input'],
  commands: [{ id: 'voice', title: 'Voice typing', gesture: 'twoFingerDoubleTap' }],
};

// The voice key: the id comes first, since the class changes to a plain Button while voice
// typing runs.
const VOICE_KEY = [
  { id: 'key_pos_header_power_key' },
  { className: 'VoiceDictationButton' },
  { contentDescription: 'Use voice typing' },
];

// Gboard and its dev and beta builds.
const isKeyboard = (name) => typeof name === 'string' && name.includes('inputmethod.latin');

let key = null;

// The top item of the window an item is in.
const top = (item) => {
  let current = item;
  for (let i = 0; i < 40; i++) {
    const parent = current.parent;
    if (!parent) break;
    current = parent;
  }
  return current;
};

const search = (from) => {
  const root = top(from);
  for (const query of VOICE_KEY) {
    const found = root.find(query);
    if (found && found.visible) return found;
  }
  return null;
};

const learn = (item) => {
  if (!item || !isKeyboard(item.packageName)) return;
  try {
    const found = search(item);
    if (found) {
      if (!key) console.log('voice key found');
      key = found;
    }
  } catch (error) {
    // the keyboard changed while it was searched
  }
};

// The remembered key, if it is still on screen.
const current = () => {
  if (!key) return null;
  try {
    const fresh = key.refresh();
    if (fresh && fresh.visible) {
      key = fresh;
      return key;
    }
  } catch (error) {
    // Backtalk dropped the snapshot
  }
  key = null;
  return null;
};

backtalk.onContentChange((event) => {
  if (!isKeyboard(event.package) || current()) return;
  learn(event.node);
});

backtalk.onFocus((item) => {
  // Only the item's own field here; searching takes longer than Backtalk waits for onFocus.
  if (item && isKeyboard(item.packageName) && !key) setTimeout(() => learn(item), 0);
});

// A command repeated within a second is not pressed twice.
let lastPress = 0;

backtalk.onCommand('voice', (event) => {
  const now = Date.now();
  if (now - lastPress < 1000) return undefined;
  let found = current();
  if (!found) {
    learn(event.node);
    found = current();
  }
  if (!found) {
    learn(backtalk.screen.focused());
    found = current();
  }
  // Keyboard not open: Backtalk does the normal gesture, such as media or calls.
  if (!found) return false;
  lastPress = now;
  found.click().catch((error) => {
    console.log(`click failed: ${error}`);
    key = null;
  });
  return undefined;
});
