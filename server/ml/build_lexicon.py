"""Builds the word analyzer's dictionary with NLTK.

    python3 ml/build_lexicon.py     -> services/nlp/lexicon.json

  freq   how common each English word is (the Brown corpus, checked against
         WordNet and the NLTK words list so that OCR noise and names drop out)
  lemma  inflected form -> dictionary form, from the WordNet lemmatizer
         ("studied" -> "study", "projects" -> "project", "built" -> "build")
  stop   the NLTK English stop words, without the ones that carry intent here

The server only reads the JSON: NLTK is needed to rebuild it, not to run.
"""
import json
import os
from collections import Counter

import nltk

HERE = os.path.dirname(os.path.abspath(__file__))
nltk.data.path.insert(0, os.path.join(HERE, "nltk_data"))

from nltk.corpus import brown, stopwords, wordnet, words  # noqa: E402
from nltk.stem import WordNetLemmatizer  # noqa: E402

lemmatizer = WordNetLemmatizer()
english = {word.lower() for word in words.words()}
counts = Counter(word.lower() for word in brown.words() if word.isalpha())


def real(word):
    return word in english or bool(wordnet.synsets(word))


# Short words must be common: "te" and "ot" would swallow every typo
freq = {word: count for word, count in counts.items() if real(word) and (len(word) > 2 or count >= 30) and (count >= 2 or len(word) >= 5)}


def lemma_of(word):
    for pos in ("v", "n", "a"):
        lemma = lemmatizer.lemmatize(word, pos)
        if lemma != word:
            return lemma
    return word


lemma = {word: lemma_of(word) for word in freq if lemma_of(word) != word}

# Intent lives in these: "what", "all", "only", "my", "not" must stay
KEEP = set("what which who when where how why all any both each few more most other some no nor not only own same than very don't dont my i am do did have has had is are was were".split())
stop = sorted(set(stopwords.words("english")) - KEEP)

path = os.path.join(HERE, "..", "services", "nlp", "lexicon.json")
with open(path, "w") as out:
    json.dump({"freq": freq, "lemma": lemma, "stop": stop}, out, separators=(",", ":"), sort_keys=True)
print(f"{len(freq)} words, {len(lemma)} lemmas, {len(stop)} stop words -> {os.path.getsize(path) // 1024} KB")
