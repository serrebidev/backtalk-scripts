// WaveSmith Swipes, for Backtalk.
// Port of Justin Harris's SandFly script wavesmith-swipes.lua 1.0
// (https://github.com/jharris171185/sandfly-scripts). Untested, as the original.
//
// While the WaveSmith waveform has focus and audio is playing, one-finger swipes run the
// waveform's own actions: left rewinds, right fast-forwards, up zooms in, down zooms out.
// Paused, or with focus anywhere else, every swipe does what it always does.

export const manifest = {
  id: 'wavesmith-swipes',
  name: 'WaveSmith Swipes',
  version: '1.0.1',
  author: 'Justin Harris',
  description: 'In WaveSmith, while audio plays and the waveform has focus, swipes rewind, fast-forward and zoom. Ported from SandFly.',
  homepage: 'https://github.com/serrebidev/backtalk-scripts',
  minBuild: 395,
  apps: ['app.wavesmith'],
  permissions: ['screen', 'actions', 'input', 'speech'],
  commands: [
    { id: 'rewind', title: 'Rewind', gesture: 'swipeLeft' },
    { id: 'forward', title: 'Fast forward', gesture: 'swipeRight' },
    { id: 'zoomin', title: 'Zoom in', gesture: 'swipeUp' },
    { id: 'zoomout', title: 'Zoom out', gesture: 'swipeDown' },
  ],
};

const transport = (event, label) => {
  const node = event.node;
  if (!node) return false;
  // Only the waveform itself, by its view id or its class.
  if (!(node.id || '').includes('waveform') && !(node.className || '').includes('WaveformView')) return false;
  // Only while playing: paused, the swipe is navigation.
  if (node.stateDescription !== 'Playing' && !(node.contentDescription || '').includes('Playing')) return false;
  if (!(node.actions || []).some((a) => (a.label || '').toLowerCase() === label.toLowerCase())) {
    backtalk.speak('Swipe action failed.');
    return undefined;
  }
  node.perform(label)
    .then((ok) => ok || backtalk.speak('Swipe action failed.'))
    .catch(() => backtalk.speak('Swipe action failed.'));
  return undefined;
};

backtalk.onCommand('rewind', (event) => transport(event, 'Rewind'));
backtalk.onCommand('forward', (event) => transport(event, 'Fast forward'));
backtalk.onCommand('zoomin', (event) => transport(event, 'Zoom in'));
backtalk.onCommand('zoomout', (event) => transport(event, 'Zoom out'));
