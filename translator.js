// Translator, for Backtalk.
// Port of the SandFly script wam.translator.lua 2.2 by Slonobass
// (https://github.com/magiyastraha-tech/sandfly-scripts), translated to English.
//
// Translates the text in focus into any language from a list. The command "Translate text to a
// chosen language" is in the Backtalk menu, with no gesture of its own; assign one on the
// script's page if you like. It opens "Translate to which language?": your favorite languages,
// then All languages and Manage favorites. Double-tapping a language translates into it.
//
// The text comes from the edit field being typed in, or else the item in focus. With no text
// there, it asks: the last thing Backtalk said, the clipboard, or type it in. The translation goes
// back into the edit field it came from, is copied to the clipboard, or is shown in a window.
//
// SandFly translated with the service chosen in its own settings. Backtalk has none, so this port
// sends the text to Google Translate.

export const manifest = {
  id: 'translator',
  name: 'Translator',
  version: '2.2.1',
  author: 'Slonobass',
  description: 'Translates the text in focus into any language. From the Backtalk menu: favorite languages, or all languages with search, then the translation in a window or straight into the edit field. Text is sent to Google Translate. Ported from SandFly and translated to English',
  homepage: 'https://github.com/serrebidev/backtalk-scripts',
  minBuild: 395,
  permissions: ['input', 'screen', 'actions', 'speech', 'dialogs', 'network', 'clipboard'],
  settings: [
    { key: 'replace', type: 'switch', title: 'Put the translation back into the edit field', default: true },
    { key: 'copy', type: 'switch', title: 'Copy the translation to the clipboard', default: true },
  ],
  commands: [{ id: 'translate', title: 'Translate text to a chosen language', menu: true }],
};

const LANGUAGES = {
  af: 'Afrikaans', ak: 'Akan', am: 'Amharic', ar: 'Arabic', as: 'Assamese', ay: 'Aymara',
  az: 'Azerbaijani', be: 'Belarusian', bg: 'Bulgarian', bho: 'Bhojpuri', bm: 'Bambara', bn: 'Bengali',
  bs: 'Bosnian', ca: 'Catalan', ceb: 'Cebuano', ckb: 'Kurdish (Sorani)', co: 'Corsican', cs: 'Czech',
  cy: 'Welsh', da: 'Danish', de: 'German', doi: 'Dogri', dv: 'Dhivehi', ee: 'Ewe', el: 'Greek',
  en: 'English', eo: 'Esperanto', es: 'Spanish', et: 'Estonian', eu: 'Basque', fa: 'Persian',
  fi: 'Finnish', fil: 'Filipino', fr: 'French', fy: 'Frisian', ga: 'Irish', gd: 'Scottish Gaelic',
  gl: 'Galician', gn: 'Guarani', gom: 'Konkani', gu: 'Gujarati', ha: 'Hausa', haw: 'Hawaiian',
  he: 'Hebrew', hi: 'Hindi', hmn: 'Hmong', hr: 'Croatian', ht: 'Haitian Creole', hu: 'Hungarian',
  hy: 'Armenian', id: 'Indonesian', ig: 'Igbo', ilo: 'Ilocano', is: 'Icelandic', it: 'Italian',
  ja: 'Japanese', jv: 'Javanese', ka: 'Georgian', kk: 'Kazakh', km: 'Khmer', kn: 'Kannada',
  ko: 'Korean', kri: 'Krio', ku: 'Kurdish', ky: 'Kyrgyz', la: 'Latin', lb: 'Luxembourgish',
  lg: 'Luganda', ln: 'Lingala', lo: 'Lao', lt: 'Lithuanian', lus: 'Mizo', lv: 'Latvian',
  mai: 'Maithili', mg: 'Malagasy', mi: 'Maori', mk: 'Macedonian', ml: 'Malayalam', mn: 'Mongolian',
  mni: 'Manipuri', mr: 'Marathi', ms: 'Malay', mt: 'Maltese', my: 'Burmese', ne: 'Nepali',
  nl: 'Dutch', no: 'Norwegian', nso: 'Sepedi', ny: 'Chichewa', om: 'Oromo', or: 'Odia',
  pa: 'Punjabi', pl: 'Polish', ps: 'Pashto', pt: 'Portuguese', qu: 'Quechua', ro: 'Romanian',
  ru: 'Russian', rw: 'Kinyarwanda', sa: 'Sanskrit', sd: 'Sindhi', si: 'Sinhala', sk: 'Slovak',
  sl: 'Slovenian', sm: 'Samoan', sn: 'Shona', so: 'Somali', sq: 'Albanian', sr: 'Serbian',
  st: 'Sesotho', su: 'Sundanese', sv: 'Swedish', sw: 'Swahili', ta: 'Tamil', te: 'Telugu',
  tg: 'Tajik', th: 'Thai', ti: 'Tigrinya', tk: 'Turkmen', tr: 'Turkish', ts: 'Tsonga', tt: 'Tatar',
  ug: 'Uyghur', uk: 'Ukrainian', ur: 'Urdu', uz: 'Uzbek', vi: 'Vietnamese', xh: 'Xhosa',
  yi: 'Yiddish', yo: 'Yoruba', 'zh-Hans': 'Chinese (Simplified)', 'zh-Hant': 'Chinese (Traditional)', zu: 'Zulu',
};
const ALL = Object.entries(LANGUAGES)
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name));

// Google Translate's own codes, where they differ.
const GOOGLE_CODE = { 'zh-Hans': 'zh-CN', 'zh-Hant': 'zh-TW', fil: 'tl', he: 'iw', jv: 'jw', mni: 'mni-Mtei' };

// One request takes up to 5000 characters; stay well under.
const MAX_CHARS = 4500;

const shorten = (s, n) => {
  const chars = [...s];
  return chars.length <= n ? s : `${chars.slice(0, n).join('')}…`;
};

// Cuts off a piece of at most MAX_CHARS, at a paragraph, a sentence or a word where it can.
// The separator stays in the rest, so the pieces don't run together.
const takeChunk = (text) => {
  const chars = [...text];
  if (chars.length <= MAX_CHARS) return [text, ''];
  const head = chars.slice(0, MAX_CHARS).join('');
  const candidates = [head.lastIndexOf('\n\n') + 1, head.search(/[.!?]\s(?![\s\S]*[.!?]\s)/) + 1, head.search(/\s(?![\s\S]*\s)/)];
  const pos = candidates.find((p) => p > 0);
  return pos ? [head.slice(0, pos), text.slice(pos)] : [head, text.slice(head.length)];
};

const translateChunk = async (text, code) => {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&dt=t&tl=${encodeURIComponent(GOOGLE_CODE[code] || code)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: `q=${encodeURIComponent(text)}`,
    timeout: 30000,
  });
  if (!response.ok) throw new Error(`the translation service answered ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data?.[0])) throw new Error('the translation service gave nothing back');
  return data[0].map((segment) => segment?.[0] || '').join('');
};

const translate = async (text, code) => {
  const parts = [];
  let rest = text;
  for (let guard = 0; rest !== '' && guard < 40; guard++) {
    const [chunk, more] = takeChunk(rest);
    parts.push(await translateChunk(chunk, code));
    rest = more;
  }
  return parts.join('\n');
};

// ---------------------------------------------------------------- favorite languages

// The favorites are a list of codes, in the order they are shown. It starts empty.
const favorites = () => {
  const saved = backtalk.storage.get('favorites', []);
  return Array.isArray(saved) ? saved.filter((code) => typeof code === 'string' && LANGUAGES[code]) : [];
};
const saveFavorites = (list) => backtalk.storage.set('favorites', list);
const favoriteRows = () => favorites().map((code) => ({ value: code, label: LANGUAGES[code] }));

const addFavorite = (code) => {
  const name = LANGUAGES[code];
  if (!name) return;
  const list = favorites();
  if (list.includes(code)) {
    backtalk.speak(`Already a favorite: ${name}`);
    return;
  }
  saveFavorites([...list, code]);
  backtalk.speak(`Added to favorites: ${name}`);
};

// A language used goes to the top of the favorites, if it's one of them.
const promoteFavorite = (code) => {
  const list = favorites();
  const at = list.indexOf(code);
  if (at <= 0) return;
  list.splice(at, 1);
  saveFavorites([code, ...list]);
};

const languageRows = (query) => {
  const needle = (query || '').trim().toLowerCase();
  return ALL.filter((e) => !needle || e.name.toLowerCase().includes(needle) || e.code.toLowerCase().includes(needle))
    .map((e) => ({ value: e.code, label: e.name }));
};

// All languages: a search field, then the list. Double-tapping a language translates into it,
// or adds it to the favorites while the switch above the list is on.
const openAllLanguages = (onPick) => {
  let adding = false;
  backtalk.ui.dialog({
    title: 'All languages',
    items: [
      {
        type: 'edit',
        id: 'search',
        label: 'Search',
        hint: 'language name or code',
        onChange: (value, form) => {
          const rows = languageRows(value);
          form.set('langs', { items: rows, label: value.trim() ? `Found: ${rows.length}` : 'Languages' });
        },
      },
      { type: 'switch', id: 'add', label: 'Double-tap adds to favorites', value: false, onChange: (value) => { adding = value; } },
      {
        type: 'list',
        id: 'langs',
        label: 'Languages',
        items: languageRows(''),
        onChange: (code, form) => {
          if (adding) {
            addFavorite(code);
            return;
          }
          form.close();
          onPick(code);
        },
      },
      { type: 'button', id: 'close', label: 'Close', close: true },
    ],
  });
};

// Manage favorites: pick a language, then move it or remove it.
const openManageFavorites = () => {
  let picked = null;
  const refresh = (form) => form.set('favorites', { items: favoriteRows(), value: picked });
  const move = (delta, form) => {
    const list = favorites();
    const at = list.indexOf(picked);
    if (at < 0) {
      backtalk.speak('Choose a language first');
      return;
    }
    const target = at + delta;
    if (target < 0 || target >= list.length) {
      backtalk.speak(delta < 0 ? 'Already at the top' : 'Already at the bottom');
      return;
    }
    [list[at], list[target]] = [list[target], list[at]];
    saveFavorites(list);
    refresh(form);
    backtalk.speak(`${delta < 0 ? 'Up' : 'Down'}: ${LANGUAGES[picked]}`);
  };
  backtalk.ui.dialog({
    title: 'Manage favorites',
    items: [
      {
        type: 'list',
        id: 'favorites',
        label: favorites().length ? 'Favorite languages' : 'No favorite languages yet. Open All languages to add some.',
        items: favoriteRows(),
        onChange: (code) => { picked = code; },
      },
      { type: 'button', id: 'up', label: 'Move up', onClick: (form) => move(-1, form) },
      { type: 'button', id: 'down', label: 'Move down', onClick: (form) => move(1, form) },
      {
        type: 'button',
        id: 'remove',
        label: 'Remove',
        onClick: (form) => {
          if (!favorites().includes(picked)) {
            backtalk.speak('Choose a language first');
            return;
          }
          saveFavorites(favorites().filter((code) => code !== picked));
          backtalk.speak(`Removed: ${LANGUAGES[picked]}`);
          picked = null;
          refresh(form);
        },
      },
      {
        type: 'switch',
        id: 'copy',
        label: 'Copy to the clipboard',
        value: backtalk.settings.get('copy') !== false,
        onChange: (value) => backtalk.settings.set('copy', value),
      },
      { type: 'button', id: 'close', label: 'Close', close: true },
    ],
  });
};

// The main list: favorite languages, then All languages and Manage favorites.
const chooseLanguage = async (onPick) => {
  const options = [
    ...favoriteRows(),
    { value: ':all', label: 'All languages' },
    { value: ':manage', label: 'Manage favorites' },
  ];
  const choice = await backtalk.ui.choose('Translate to which language?', options);
  if (choice === ':all') openAllLanguages(onPick);
  else if (choice === ':manage') openManageFavorites();
  else if (choice) onPick(choice);
};

// ---------------------------------------------------------------- the text

// The last thing Backtalk said, for when the focus has no text.
let lastSpoken = '';
backtalk.onSpeech((text) => {
  if (typeof text === 'string' && text.trim()) lastSpoken = text;
});

// The edit field being typed in, and its text.
const inputField = () => {
  const focused = backtalk.screen.focused();
  const field = focused?.editable ? focused : backtalk.screen.findAll({ className: 'EditText' }, 20).find((e) => e.focused);
  const value = field?.editable && typeof field.text === 'string' ? field.text.trim() : '';
  return value ? { field, value } : null;
};

// The text from the edit field, or else the item in focus. With none, ask where to take it from.
const getText = async () => {
  const input = inputField();
  if (input) return { text: input.value, field: input.field };
  const item = backtalk.screen.focused();
  const own = (item?.text || '').trim() || (item?.contentDescription || '').trim();
  if (own) return { text: own };
  const options = [];
  const spoken = lastSpoken.trim();
  if (spoken) options.push({ value: 'spoken', label: `Last thing said: ${shorten(spoken, 60)}` });
  const clip = (backtalk.clipboard.get() || '').trim();
  if (clip) options.push({ value: 'clipboard', label: `From the clipboard: ${shorten(clip, 60)}` });
  options.push({ value: 'prompt', label: 'Type the text' });
  const choice = await backtalk.ui.choose('There is no text in focus. Where should the text come from?', options);
  if (choice === 'spoken') return { text: spoken };
  if (choice === 'clipboard') return { text: clip };
  if (choice === 'prompt') {
    const typed = await backtalk.ui.prompt('Text to translate');
    if (typed && typed.trim()) return { text: typed.trim() };
  }
  return null;
};

// Puts the translation into the edit field in place of the original. The field is checked again:
// the focus can have moved while the language was chosen, and if its text changed, it is left
// alone so nothing typed meanwhile is lost.
const replaceInField = async (field, original, translated) => {
  const target = field.refresh();
  if (!target || !target.editable) return 'the edit field is gone';
  if ((target.text || '').trim() !== original) return 'the text in the field changed';
  return (await target.setText(translated)) ? null : 'the field does not take text';
};

const showText = (title, text) =>
  backtalk.ui.dialog({
    title,
    items: [
      { type: 'edit', id: 'text', label: 'Translation', value: text, multiline: true },
      { type: 'button', id: 'close', label: 'Close', close: true },
    ],
  });

const translateInto = async (source, code) => {
  promoteFavorite(code);
  const name = LANGUAGES[code] || code;
  backtalk.speak(`Translating: ${name}`);
  let result;
  try {
    result = await translate(source.text, code);
  } catch (error) {
    await backtalk.ui.alert(`The translation didn't work.\n\n${error.message || error}`, { title: 'Translation error' });
    return;
  }
  // Copied before going into the field: the copy switch is about copying, wherever the
  // translation goes.
  let copied = false;
  if (backtalk.settings.get('copy') !== false) {
    backtalk.clipboard.set(result);
    copied = true;
  }
  const done = copied ? ' (copied)' : '';
  if (source.field && backtalk.settings.get('replace') !== false) {
    const why = await replaceInField(source.field, source.text, result);
    if (!why) {
      backtalk.speak(`Translation put in: ${name}${done}`);
      return;
    }
    backtalk.speak(`Not put in the field: ${why}`);
  }
  showText(`Translation: ${name}${done}`, result);
};

backtalk.onCommand('translate', () => {
  (async () => {
    const source = await getText();
    if (!source || !source.text) return;
    await chooseLanguage((code) => translateInto(source, code).catch((error) => console.error(String(error))));
  })().catch((error) => console.error(String(error)));
});
