const HEART_RELEASE_DURATION = 1050;
const REDUCED_MOTION_RELEASE_DURATION = 180;

export function initSceneTwo(scene) {
  if (!scene) {
    return null;
  }

  const envelope = scene.querySelector(".scene-two-envelope");
  const heart = scene.querySelector("[data-heart-seal]");
  const hint = scene.querySelector("[data-envelope-heart-hint]");
  const stage = scene.closest(".experience-stage");
  const experienceRoot = document.querySelector("#experience");

  if (!envelope || !heart || !hint || !stage || !experienceRoot) {
    return null;
  }

  let interactionStarted = false;
  let eventDispatched = false;
  let completionTimer = null;

  function setEnvelopeState(state) {
    envelope.dataset.state = state;
  }

  function showHint() {
    if (interactionStarted) {
      return;
    }

    hint.dataset.state = "idle";
    void hint.offsetWidth;
    hint.dataset.state = "visible";
  }

  function hideHint() {
    hint.dataset.state = "hidden";
  }

  function clearCompletionTimer() {
    if (completionTimer !== null) {
      window.clearTimeout(completionTimer);
      completionTimer = null;
    }
  }

  function finishHeartRelease() {
    if (envelope.dataset.state !== "opening") {
      return;
    }

    clearCompletionTimer();
    setEnvelopeState("opened");

    if (!eventDispatched) {
      eventDispatched = true;
      scene.dispatchEvent(
        new CustomEvent("envelope:heart-open", {
          bubbles: true,
        }),
      );
    }
  }

  function openHeart() {
    if (interactionStarted || envelope.dataset.state !== "idle") {
      return;
    }

    interactionStarted = true;
    heart.disabled = true;
    setEnvelopeState("opening");
    hideHint();

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    completionTimer = window.setTimeout(
      finishHeartRelease,
      prefersReducedMotion
        ? REDUCED_MOTION_RELEASE_DURATION
        : HEART_RELEASE_DURATION,
    );
  }

  function resetHeartInteraction() {
    clearCompletionTimer();
    interactionStarted = false;
    eventDispatched = false;
    heart.disabled = false;
    setEnvelopeState("idle");
    hideHint();
  }

  function handleSceneLifecycle(event) {
    if (
      event.detail.sceneId === "scene-02" &&
      event.detail.phase === "afterEnter"
    ) {
      showHint();
    }
  }

  heart.addEventListener("click", openHeart);
  heart.addEventListener("animationend", (event) => {
    if (event.animationName === "scene-two-heart-release") {
      finishHeartRelease();
    }
  });
  stage.addEventListener("heart-transition:reset", resetHeartInteraction);
  experienceRoot.addEventListener("experience:scene-lifecycle", handleSceneLifecycle);

  return Object.freeze({
    getState: () => envelope.dataset.state,
    reset: resetHeartInteraction,
  });
}
