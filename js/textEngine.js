const DEFAULT_OPTIONS = Object.freeze({
  baseDelay: 260,
  sequenceId: "text-sequence",
});

export function createTextSequence(element, options = {}) {
  if (!element) {
    return null;
  }

  const settings = { ...DEFAULT_OPTIONS, ...options };
  const timers = new Set();
  let runId = 0;

  function clearTimers() {
    timers.forEach((timer) => window.clearTimeout(timer));
    timers.clear();
  }

  function reset() {
    runId += 1;
    clearTimers();
    element.replaceChildren();
  }

  function schedule(callback, delay) {
    const timer = window.setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);

    timers.add(timer);
  }

  function getPunctuationDelay(word) {
    if (/(?:\.\.\.|…)$/.test(word)) {
      return 980;
    }

    const trailingPunctuation = word.match(/[!?]+$/)?.[0] ?? "";

    if (trailingPunctuation) {
      return trailingPunctuation.includes("?") ? 1180 : 840;
    }

    if (/\.$/.test(word)) {
      return 1220;
    }

    if (/,$/.test(word)) {
      return 400;
    }

    return null;
  }

  function getWordDelay(word, index, hasLineBreak) {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const baseDelay = reducedMotion ? 180 : settings.baseDelay;
    const variation = reducedMotion ? 0 : ((index * 17) % 31) - 15;
    const punctuationDelay = getPunctuationDelay(word);
    const nextDelay = punctuationDelay ?? baseDelay + variation;

    return hasLineBreak ? Math.max(nextDelay, 1000) : nextDelay;
  }

  function buildWords(text) {
    const lines = String(text).split(/\r?\n/);
    const words = [];

    lines.forEach((line, lineIndex) => {
      const lineElement = document.createElement("span");
      lineElement.className = "text-sequence-line";
      const lineWords = line.trim() ? line.trim().split(/\s+/) : [];

      lineWords.forEach((word, wordIndex) => {
        const wordElement = document.createElement("span");
        wordElement.className = "text-sequence-word";
        wordElement.textContent = word;
        lineElement.append(wordElement);

        if (wordIndex < lineWords.length - 1) {
          lineElement.append(" ");
        }

        words.push({
          element: wordElement,
          text: word,
          hasLineBreak: wordIndex === lineWords.length - 1 && lineIndex < lines.length - 1,
        });
      });

      element.append(lineElement);
    });

    return words;
  }

  function play(text, playOptions = {}) {
    reset();

    const activeRunId = runId;
    const sequenceId = playOptions.sequenceId ?? settings.sequenceId;
    const words = buildWords(text);

    if (!words.length) {
      element.dispatchEvent(
        new CustomEvent("text-sequence:complete", {
          bubbles: true,
          detail: { element, sequenceId },
        }),
      );

      return;
    }

    function revealWord(index) {
      if (activeRunId !== runId) {
        return;
      }

      const word = words[index];
      word.element.classList.add("is-visible");

      if (index === words.length - 1) {
        schedule(() => {
          if (activeRunId !== runId) {
            return;
          }

          element.dispatchEvent(
            new CustomEvent("text-sequence:complete", {
              bubbles: true,
              detail: { element, sequenceId },
            }),
          );
        }, 420);

        return;
      }

      schedule(
        () => revealWord(index + 1),
        getWordDelay(word.text, index, word.hasLineBreak),
      );
    }

    revealWord(0);
  }

  return Object.freeze({
    play,
    reset,
    cancel: reset,
  });
}
