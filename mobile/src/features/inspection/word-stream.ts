export function normalizeWordStreamText(text: string) {
  return text.replace(/\s+/g, " ").trimStart();
}

export function getNextWordStreamText(currentText: string, targetText: string) {
  const current = normalizeWordStreamText(currentText);
  const target = normalizeWordStreamText(targetText);

  if (!target) {
    return "";
  }

  if (!current || !target.startsWith(current)) {
    return readNextWord(target, 0);
  }

  if (current === target) {
    return target;
  }

  const nextWordStart = skipWhitespace(target, current.length);
  return readNextWord(target, nextWordStart);
}

export function isWordStreamComplete(currentText: string, targetText: string) {
  return normalizeWordStreamText(currentText) === normalizeWordStreamText(targetText);
}

function skipWhitespace(text: string, index: number) {
  let nextIndex = index;
  while (nextIndex < text.length && /\s/.test(text[nextIndex])) {
    nextIndex += 1;
  }
  return nextIndex;
}

function readNextWord(text: string, startIndex: number) {
  let endIndex = startIndex;
  while (endIndex < text.length && !/\s/.test(text[endIndex])) {
    endIndex += 1;
  }
  return text.slice(0, endIndex);
}
