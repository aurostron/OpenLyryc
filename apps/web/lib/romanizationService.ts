export function isJapaneseScript(text: string): boolean {
  return /[\u3040-\u309F\u30A0-\u30FF]/.test(text);
}

export function isKoreanScript(text: string): boolean {
  return /[\uAC00-\uD7AF\u1100-\u11FF]/.test(text);
}

export function isChineseScript(text: string): boolean {
  return /[\u4E00-\u9FFF]/.test(text);
}

export function hasCjkCharacters(text: string): boolean {
  return isJapaneseScript(text) || isKoreanScript(text) || isChineseScript(text);
}
