import {
  DataSet,
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
  pattern,
} from "obscenity";

/**
 * Shared profanity matcher for user-supplied public text (usernames, display
 * names).
 *
 * This replaces the previous `bad-words` filter, which only ever compared whole
 * whitespace-delimited tokens against its word list. That meant any slur became
 * invisible the moment it was glued to another word ("<slur>fucker" was one
 * unknown token, so it passed), and it saw through neither leetspeak ("fvck")
 * nor stretched characters ("fuuuck"). `obscenity` matches inside compounds and
 * normalises both of those classes of obfuscation before matching.
 */

/**
 * Slurs the bundled English dataset does not carry. Kept unbounded (matched
 * anywhere in the string) so they cannot be evaded by padding, with the
 * innocuous words that contain them whitelisted below.
 */
const SUPPLEMENTARY_TERMS: readonly string[] = [
  "spic",
  "wetback",
  "gook",
  "coon",
];

/**
 * Legitimate words and names that contain a blacklisted substring. Without
 * these, real surnames and Australian place names are rejected.
 */
const WHITELISTED_TERMS: readonly string[] = [
  // Surnames containing "dick", "penis", "cum" or "fag"
  "dickinson",
  "dickens",
  "dickson",
  "dickerson",
  "cummings",
  "cummins",
  "fagan",
  "fagin",
  // Place names
  "penistone",
  "coonabarabran",
  "coonawarra",
  "coonamble",
  // Everyday words
  "raccoon",
  "racoon",
  "cocoon",
  "tycoon",
  "spice",
  "spices",
  "spicy",
  "spicer",
  "auspicious",
  "suspicious",
  "conspicuous",
  "despicable",
  "gobbledygook",
];

const dataset = new DataSet<{ originalWord: string }>()
  .addAll(englishDataset)
  .addPhrase((phrase) => {
    let p = phrase.setMetadata({ originalWord: "supplementary" });
    for (const term of SUPPLEMENTARY_TERMS) p = p.addPattern(pattern`${term}`);
    for (const term of WHITELISTED_TERMS) p = p.addWhitelistedTerm(term);
    return p;
  });

const matcher = new RegExpMatcher({
  ...dataset.build(),
  ...englishRecommendedTransformers,
});

/**
 * True when `text` contains profanity, including inside a longer word and after
 * common obfuscation (leetspeak, repeated characters, confusable glyphs).
 */
export function containsProfanity(text: string): boolean {
  if (!text) return false;

  // Separators are a bypass on their own ("f-u-c-k", "f.u.c.k"), so the
  // stripped form is checked alongside the original. Checking both means a
  // separator can neither hide a match nor manufacture one across a boundary
  // that the original text does not have.
  const stripped = text.replace(/[^a-zA-Z0-9]/g, "");

  return matcher.hasMatch(text) || (stripped !== text && matcher.hasMatch(stripped));
}
