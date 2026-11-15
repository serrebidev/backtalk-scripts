# Backtalk scripts

JavaScript ports of SandFly screen reader scripts, for the [Backtalk](https://github.com/trypsynth/backtalk) screen reader for Android. SandFly is a fork of Backtalk, but its scripts are written in Lua against a different script API, so they can't be installed in Backtalk as they are. Each script here does everything the SandFly original does. Scripts that need something Backtalk's script API can't do yet are not here; see [Not ported yet](#not-ported-yet).

All text is in English, including the scripts that were written in Russian.

## Install

The scripts need Backtalk build 395 or newer, on a phone or tablet. Backtalk can't run scripts on a TV or watch.

1. In Backtalk settings, go to **Apps** > **Scripts** > **Script sources**.
2. Choose **Add source**, and enter `github.com/serrebidev/backtalk-scripts`.
3. Open the source, and choose a script to install.

## Scripts

### Ported from Justin Harris's scripts

From [jharris171185/sandfly-scripts](https://github.com/jharris171185/sandfly-scripts).

| Script | App | What it does |
| --- | --- | --- |
| [Facebook Actions and Skip](facebook-actions-skip.js) | Facebook | Swipe up or down on a post to cycle its actions (Like, React, Comment, Share and the rest), then double-tap to run the one you picked. Backtalk+J, or a two- or three-finger swipe right, skips stories, reels and People You May Know to the next post. |
| [Phone Actions and Switch](phone-actions-switch.js) | Google Phone and Google Contacts | iOS-style lists: swipe right or left moves entry to entry without stopping on the buttons inside, swipe down or up cycles the entry's actions, double-tap calls or runs the picked action. A three-finger swipe left or right switches between Recents and Contacts. |
| [WaveSmith Swipes](wavesmith-swipes.js) | WaveSmith | While audio plays and the waveform has focus: swipe left rewinds, right fast-forwards, up zooms in, down zooms out. Untested, as the original. |

### Ported from Aaron Hewitt's scripts

From [aaron-gh/sandfly-scripts](https://github.com/aaron-gh/sandfly-scripts), under the Apache License 2.0.

| Script | App | What it does |
| --- | --- | --- |
| [Dialect keypad](dialect-keypad.js) | Dialect | Keys activate when the finger lifts, and long-press after a hold time you choose. |
| [Google Messages conversation actions](google-messages-actions.js) | Google Messages | Pin, Mark as unread, Archive, Delete, Snooze, Block and Add contact are in each conversation's Actions menu. By Surendra. |
| [Keyboard voice typing gesture](keyboard-voice-gesture.js) | All apps | While the keyboard is open, a two-finger double tap presses the keyboard's voice typing key. By Surendra. |
| [WhatsApp messages (3.5)](whatsapp-messages-plus.js) | WhatsApp | Each message in a chat is one item: sender, content, the message it replies to, and time. Its buttons are in its Actions menu. This is version 3.5; Backtalk's own script source has the older 1.1, so turn that one off while this one is on. |

### Ported from the WAM Agents scripts

From [magiyastraha-tech/sandfly-scripts](https://github.com/magiyastraha-tech/sandfly-scripts), translated from Russian to English.

| Script | App | What it does |
| --- | --- | --- |
| [YMusic: title and time](ymusic-video-rows.js) | YMusic | Video rows say only the title and time; channel, views and date are in the Actions menu, with the More button. Focus goes to the New section when the app or the Subscriptions tab opens. Works with YMusic in English or Russian. |
| [Translator](translator.js) | All apps | From the Backtalk menu, translates the text in focus into any language: favorite languages, or all languages with search. The translation goes back into the edit field, to the clipboard, or into a window. The text is sent to Google Translate. |

## Not ported yet

These need things Backtalk's script API doesn't have yet: touching the screen, recognizing text in a screenshot, keys without the Backtalk key (such as plain Ctrl+N or the arrow keys), changing the media volume, or finding items by whether they scroll, can be long-pressed or are headings. They will be ported when Backtalk can do them, so that no port does less than its original.

| Script | From | Needs |
| --- | --- | --- |
| Play Protect Install | Justin Harris | Touching the screen and recognizing text, to press the "Install without scanning" link. |
| Thunderbird Keys and Actions | Justin Harris | Plain keys: Ctrl+N, Ctrl+R, Delete, Space and the arrow keys. |
| Jump and Send | Justin Harris | The plain Up and Down arrows in Telegram, and Ctrl+Enter. |
| OpenBubbles messages | Aaron Hewitt | Rules that find items by whether they scroll or can be long-pressed. |
| YouTube video actions | Aaron Hewitt | YouTube's desktop keys (K, J, L, M and the rest), the media volume, and rules that find rows by whether they scroll. |
| Tele2 account summary | WAM Agents | Recognizing text, for the gigabytes left. |
| Nekogram message actions | WAM Agents | Touching the screen, to record a voice message. |

## Credits

The scripts are by their original authors, named in each file and in the tables above. The ports to Backtalk's JavaScript API are by serrebi. Aaron Hewitt's scripts, and so their ports, are under the Apache License 2.0, in [LICENSE](LICENSE). The other original repositories have no license; they were shared publicly by their authors to help others, and any author who wants their port taken down can open an issue.
