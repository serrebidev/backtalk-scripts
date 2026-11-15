// Google Messages conversation actions, for Backtalk.
// Port of Surendra's SandFly script google-messages-actions.lua 1.0.0
// (https://github.com/aaron-gh/sandfly-scripts, Apache License 2.0).
//
// Adds Pin, Mark as unread, Archive, Delete, Snooze, Block and Add contact to the Actions menu
// of each conversation in the Google Messages list.

export const manifest = {
  id: 'google-messages-actions',
  name: 'Google Messages conversation actions',
  version: '1.0.1',
  author: 'Surendra',
  description: 'Adds Pin, Mark as unread, Archive, Delete, Snooze, Block and Add contact to the Actions menu of each conversation in the Google Messages list. Ported from SandFly',
  homepage: 'https://github.com/serrebidev/backtalk-scripts',
  minBuild: 395,
  apps: ['com.google.android.apps.messaging'],
  permissions: ['screen', 'actions', 'speech', 'input'],
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const ROW_ID = 'swipeableContainer';
const MORE = [{ contentDescription: 'More options' }];
const DONE = [{ id: 'action_mode_close_button' }];

// "bar": a button in the toolbar that appears once the conversation is selected.
// "menu": an entry in the More options popup.
const ACTIONS = [
  { title: 'Pin or unpin conversation', where: 'bar', queries: [{ id: 'action_pin_to_top' }, { contentDescription: 'Unpin' }, { text: 'Unpin' }] },
  { title: 'Mark as unread or read', where: 'menu', queries: [{ text: 'Mark as unread' }, { text: 'Mark as read' }] },
  { title: 'Archive conversation', where: 'bar', queries: [{ id: 'action_archive' }, { contentDescription: 'Unarchive' }] },
  { title: 'Delete conversation', where: 'bar', queries: [{ id: 'action_delete' }] },
  { title: 'Snooze notifications', where: 'bar', queries: [{ id: 'action_snooze' }] },
  { title: 'Block', where: 'menu', queries: [{ text: 'Block' }] },
  { title: 'Add contact', where: 'menu', queries: [{ text: 'Add contact' }] },
];

const shortId = (item) => (item.id || '').split('/').pop();

// A popup entry's text sits in a child; click the item that can be clicked.
const clickable = (node) => {
  let current = node;
  for (let i = 0; current && i < 4; i++) {
    if (current.clickable) return current;
    current = current.parent;
  }
  return node;
};

const locate = (queries) => {
  for (const query of queries) {
    const found = backtalk.screen.find(query);
    if (found) return clickable(found);
  }
  return null;
};

const waitFor = async (queries, tries = 8) => {
  for (let i = 0; i < tries; i++) {
    const found = locate(queries);
    if (found) return found;
    await sleep(150);
  }
  return null;
};

const perform = async (row, action) => {
  // Backtalk's Actions menu closes first.
  await sleep(400);
  if (!(await row.longClick())) {
    backtalk.speak('Could not select the conversation');
    return;
  }
  let target = null;
  if (action.where === 'bar') {
    target = await waitFor(action.queries);
  } else {
    const more = await waitFor(MORE);
    if (more) {
      more.click();
      target = await waitFor(action.queries);
    }
  }
  if (target) {
    target.click();
    return;
  }
  backtalk.speak(`${action.title} is not available`);
  // Leave selection mode so the list works normally again.
  locate(DONE)?.click();
};

backtalk.onActions((item) => {
  if (shortId(item) !== ROW_ID) return undefined;
  return ACTIONS.map((action) => ({ title: action.title, run: () => perform(item, action) }));
});
