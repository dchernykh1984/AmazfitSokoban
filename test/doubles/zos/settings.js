// A stand-in for @zos/settings. `language.code` is the Zepp OS integer language
// code the watch would report; 2 is English.
export const language = { code: 2 };

export function getLanguage() {
  return language.code;
}
