import vocabRaw from '../../assets/models/clip_vocab.json';
import mergesRaw from '../../assets/models/clip_merges.json';

const vocab = vocabRaw as Record<string, number>;
const merges = mergesRaw as [string, string][];

const mergeRanks = new Map<string, number>();
merges.forEach(([first, second], index) => {
  mergeRanks.set(`${first} ${second}`, index);
});

export const SOT_TOKEN_ID = vocab['<|startoftext|>'];
export const EOT_TOKEN_ID = vocab['<|endoftext|>'];
const SOT = SOT_TOKEN_ID;
const EOT = EOT_TOKEN_ID;
const MAX_LEN = 77;

const BYTE_ENCODER = buildBytesToUnicode();

function buildBytesToUnicode(): Map<number, string> {
  const map = new Map<number, string>();
  const ranges: number[] = [];

  for (let i = 33; i <= 126; i++) ranges.push(i);
  for (let i = 161; i <= 172; i++) ranges.push(i);
  for (let i = 174; i <= 255; i++) ranges.push(i);

  let n = 0;
  for (const byte of ranges) {
    map.set(byte, String.fromCharCode(byte));
    n += 1;
  }

  for (let byte = 0; byte < 256; byte++) {
    if (!map.has(byte)) {
      map.set(byte, String.fromCharCode(256 + n));
      n += 1;
    }
  }

  return map;
}

function encodeWord(word: string): string[] {
  const bytes = new TextEncoder().encode(word);
  const chars = Array.from(bytes, (byte) => BYTE_ENCODER.get(byte) ?? '');
  return chars.map((char, index) =>
    index === chars.length - 1 ? `${char}</w>` : char
  );
}

function getPairs(word: string[]): Set<string> {
  const pairs = new Set<string>();
  for (let i = 0; i < word.length - 1; i++) {
    pairs.add(`${word[i]} ${word[i + 1]}`);
  }
  return pairs;
}

function bytePairMerge(word: string[]): string[] {
  if (word.length === 1) return word;

  let parts = [...word];

  while (parts.length > 1) {
    let bestRank = Infinity;
    let bestPair: string | null = null;

    for (let i = 0; i < parts.length - 1; i++) {
      const pair = `${parts[i]} ${parts[i + 1]}`;
      const rank = mergeRanks.get(pair);
      if (rank !== undefined && rank < bestRank) {
        bestRank = rank;
        bestPair = pair;
      }
    }

    if (bestPair === null || bestRank === Infinity) break;

    const [first, second] = bestPair.split(' ');
    const merged: string[] = [];
    let index = 0;

    while (index < parts.length) {
      if (index < parts.length - 1 && parts[index] === first && parts[index + 1] === second) {
        merged.push(first + second);
        index += 2;
      } else {
        merged.push(parts[index]);
        index += 1;
      }
    }

    parts = merged;
  }

  return parts;
}

function bpe(token: string): string[] {
  return bytePairMerge(encodeWord(token));
}

function basicTokenize(text: string): string[] {
  const cleaned = text.trim().replace(/\s+/g, ' ').toLowerCase();
  if (!cleaned) return [];

  const pattern =
    /<\|startoftext\|>|<\|endoftext\|>|'s|'t|'re|'ve|'m|'ll|'d|[^\s]+/gi;

  return cleaned.match(pattern) ?? [];
}

export function tokenize(text: string): number[] {
  const tokens: number[] = [SOT];

  for (const word of basicTokenize(text)) {
    for (const piece of bpe(word)) {
      const id = vocab[piece];
      if (id !== undefined) tokens.push(id);
    }
  }

  tokens.push(EOT);

  const truncated = tokens.slice(0, MAX_LEN);
  while (truncated.length < MAX_LEN) truncated.push(0);

  return truncated;
}
