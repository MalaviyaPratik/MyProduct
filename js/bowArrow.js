const INTERACTION_STATES = Object.freeze({
  IDLE: "idle",
  DRAGGING: "dragging",
  FLYING: "flying",
  HIT: "hit",
  MISS: "miss",
  RESETTING: "resetting",
});

const MAX_PULL_DISTANCE = 150;
const MIN_LAUNCH_STRENGTH = 0.12;
const GRAVITY = 280;

export function initBowArrow(scene) {
  if (!scene) {
    return null;
  }

  const controller = createBowArrowController(scene);
  controller.initialize();

  return controller;
}

function createBowArrowController(scene) {
  const arrow = scene.querySelector("[data-arrow-control]");
  const bowRig = scene.querySelector("[data-bow-rig]");
  const target = scene.querySelector("[data-heart-target]");
  const feedback = scene.querySelector("[data-bow-arrow-feedback]");
  const upperString = scene.querySelector("[data-string-upper]");
  const lowerString = scene.querySelector("[data-string-lower]");
  const nockRatio = Number(arrow.dataset.arrowNock) || 0.06;
  const tipRatio = Number(arrow.dataset.arrowTip) || 0.98;
  let state = INTERACTION_STATES.IDLE;
  let pull = { x: 0, y: 0, strength: 0 };
  let aim = { x: 1, y: 0, angle: 0 };
  let feedbackCategory = null;
  let animationFrame = null;
  let resetTimer = null;

  function getPointInScene(event) {
    const bounds = scene.getBoundingClientRect();

    return {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
  }

  function getBowOrigin() {
    return {
      x: bowRig.offsetLeft + bowRig.offsetWidth * 0.5,
      y: bowRig.offsetTop + bowRig.offsetHeight * 0.47,
    };
  }

  function getTargetPoint() {
    const targetBounds = target.getBoundingClientRect();
    const sceneBounds = scene.getBoundingClientRect();

    return {
      x: targetBounds.left - sceneBounds.left + targetBounds.width * 0.5,
      y: targetBounds.top - sceneBounds.top + targetBounds.height * 0.53,
      size: Math.min(targetBounds.width, targetBounds.height),
    };
  }

  function getArrowTipOffset() {
    return arrow.offsetWidth * (tipRatio - nockRatio);
  }

  function getArrowTip(nockPosition, direction = aim) {
    const tipOffset = getArrowTipOffset();

    return {
      x: nockPosition.x + direction.x * tipOffset,
      y: nockPosition.y + direction.y * tipOffset,
    };
  }

  function setState(nextState) {
    state = nextState;
    scene.dataset.state = nextState;
    arrow.disabled = nextState !== INTERACTION_STATES.IDLE && nextState !== INTERACTION_STATES.DRAGGING;
  }

  function updateString() {
    const stringX = 50 + (pull.x / MAX_PULL_DISTANCE) * 34;
    const stringY = 120 + (pull.y / MAX_PULL_DISTANCE) * 34;

    upperString.setAttribute("x2", String(stringX));
    upperString.setAttribute("y2", String(stringY));
    lowerString.setAttribute("x2", String(stringX));
    lowerString.setAttribute("y2", String(stringY));
  }

  function updateVisuals(nockOffset = pull, direction = aim) {
    scene.style.setProperty("--arrow-x", `${nockOffset.x}px`);
    scene.style.setProperty("--arrow-y", `${nockOffset.y}px`);
    scene.style.setProperty("--arrow-angle", `${direction.angle}deg`);
    scene.style.setProperty("--bow-tilt", `${Math.max(-10, Math.min(10, direction.angle + 45))}deg`);
  }

  function getDistanceFeedback(distance, targetSize, hitRadius) {
    if (distance <= hitRadius + targetSize * 0.15) {
      return { category: "very-close", message: "Almost… ❤️" };
    }

    if (distance <= targetSize * 0.75) {
      return { category: "close", message: "So close… ❤️" };
    }

    if (distance <= targetSize * 1.45) {
      return { category: "medium", message: "You’re getting close…" };
    }

    if (distance <= targetSize * 2.5) {
      return { category: "far", message: "Getting closer…" };
    }

    return { category: "very-far", message: "Too far… keep aiming ❤️" };
  }

  function updateDistanceFeedback() {
    const origin = getBowOrigin();
    const tip = getArrowTip({ x: origin.x + pull.x, y: origin.y + pull.y });
    const targetPoint = getTargetPoint();
    const hitRadius = getHitRadius(targetPoint.size);
    const distance = Math.hypot(tip.x - targetPoint.x, tip.y - targetPoint.y);
    const nextFeedback = getDistanceFeedback(distance, targetPoint.size, hitRadius);

    if (nextFeedback.category !== feedbackCategory) {
      feedback.textContent = nextFeedback.message;
      feedbackCategory = nextFeedback.category;
    }
  }

  function updateAim(pointer) {
    const origin = getBowOrigin();
    const rawPull = {
      x: pointer.x - origin.x,
      y: pointer.y - origin.y,
    };
    const distance = Math.hypot(rawPull.x, rawPull.y);
    const constrainedDistance = Math.min(distance, MAX_PULL_DISTANCE);
    const scale = distance > 0 ? constrainedDistance / distance : 0;

    pull = {
      x: rawPull.x * scale,
      y: rawPull.y * scale,
      strength: constrainedDistance / MAX_PULL_DISTANCE,
    };

    const launchVector = { x: -pull.x, y: -pull.y };
    const launchDistance = Math.hypot(launchVector.x, launchVector.y) || 1;

    aim = {
      x: launchVector.x / launchDistance,
      y: launchVector.y / launchDistance,
      angle: (Math.atan2(launchVector.y, launchVector.x) * 180) / Math.PI,
    };

    updateString();
    updateVisuals();
    updateDistanceFeedback();
  }

  function resetVisuals() {
    const origin = getBowOrigin();
    const targetPoint = getTargetPoint();
    const directionX = targetPoint.x - origin.x;
    const directionY = targetPoint.y - origin.y;
    const distance = Math.hypot(directionX, directionY) || 1;

    pull = { x: 0, y: 0, strength: 0 };
    aim = {
      x: directionX / distance,
      y: directionY / distance,
      angle: (Math.atan2(directionY, directionX) * 180) / Math.PI,
    };
    feedbackCategory = null;
    feedback.textContent = "";
    updateString();
    updateVisuals();
  }

  function getHitRadius(targetSize) {
    return Math.max(12, Math.min(20, targetSize * 0.14));
  }

  function endWithMiss() {
    setState(INTERACTION_STATES.MISS);
    feedbackCategory = null;
    feedback.textContent = "A little off—try again.";
    resetTimer = window.setTimeout(() => {
      setState(INTERACTION_STATES.RESETTING);
      resetVisuals();
      setState(INTERACTION_STATES.IDLE);
    }, 650);
  }

  function endWithHit() {
    setState(INTERACTION_STATES.HIT);
    feedback.textContent = "";
    target.classList.add("heart-target--impact");
    window.setTimeout(() => target.classList.remove("heart-target--impact"), 250);
  }

  function arrowTipHitTarget(tip) {
    const targetPoint = getTargetPoint();
    const hitRadius = getHitRadius(targetPoint.size);

    return Math.hypot(tip.x - targetPoint.x, tip.y - targetPoint.y) <= hitRadius;
  }

  function launchArrow() {
    if (pull.strength < MIN_LAUNCH_STRENGTH) {
      setState(INTERACTION_STATES.RESETTING);
      resetVisuals();
      setState(INTERACTION_STATES.IDLE);
      return;
    }

    setState(INTERACTION_STATES.FLYING);
    feedback.textContent = "";
    const origin = getBowOrigin();
    const nockPosition = { x: origin.x + pull.x, y: origin.y + pull.y };
    const tipPosition = getArrowTip(nockPosition);
    const velocity = {
      x: aim.x * (760 + pull.strength * 840),
      y: aim.y * (760 + pull.strength * 840),
    };
    const sceneBounds = scene.getBoundingClientRect();
    let previousTime = null;

    function fly(timestamp) {
      if (state !== INTERACTION_STATES.FLYING) {
        return;
      }

      if (previousTime === null) {
        previousTime = timestamp;
      }

      const delta = Math.min((timestamp - previousTime) / 1000, 0.032);
      previousTime = timestamp;
      velocity.y += GRAVITY * delta;
      tipPosition.x += velocity.x * delta;
      tipPosition.y += velocity.y * delta;
      const flightAngle = (Math.atan2(velocity.y, velocity.x) * 180) / Math.PI;
      const direction = {
        x: Math.cos((flightAngle * Math.PI) / 180),
        y: Math.sin((flightAngle * Math.PI) / 180),
        angle: flightAngle,
      };
      const tipOffset = getArrowTipOffset();
      const flightNock = {
        x: tipPosition.x - direction.x * tipOffset,
        y: tipPosition.y - direction.y * tipOffset,
      };

      updateVisuals(
        {
          x: flightNock.x - origin.x,
          y: flightNock.y - origin.y,
        },
        direction,
      );

      if (arrowTipHitTarget(tipPosition)) {
        animationFrame = null;
        endWithHit();
        return;
      }

      const outsideStage =
        tipPosition.x < -100 ||
        tipPosition.x > sceneBounds.width + 100 ||
        tipPosition.y < -100 ||
        tipPosition.y > sceneBounds.height + 100;

      if (outsideStage) {
        animationFrame = null;
        endWithMiss();
        return;
      }

      animationFrame = window.requestAnimationFrame(fly);
    }

    animationFrame = window.requestAnimationFrame(fly);
  }

  function handlePointerDown(event) {
    if (state !== INTERACTION_STATES.IDLE) {
      return;
    }

    event.preventDefault();
    arrow.setPointerCapture(event.pointerId);
    setState(INTERACTION_STATES.DRAGGING);
  }

  function handlePointerMove(event) {
    if (state !== INTERACTION_STATES.DRAGGING) {
      return;
    }

    event.preventDefault();
    updateAim(getPointInScene(event));
  }

  function releasePointer(event) {
    if (arrow.hasPointerCapture(event.pointerId)) {
      arrow.releasePointerCapture(event.pointerId);
    }
  }

  function handlePointerUp(event) {
    if (state !== INTERACTION_STATES.DRAGGING) {
      return;
    }

    releasePointer(event);
    launchArrow();
  }

  function handlePointerCancel(event) {
    if (state !== INTERACTION_STATES.DRAGGING) {
      return;
    }

    releasePointer(event);
    setState(INTERACTION_STATES.RESETTING);
    resetVisuals();
    setState(INTERACTION_STATES.IDLE);
  }

  function handleViewportChange() {
    if (state === INTERACTION_STATES.IDLE) {
      resetVisuals();
    }
  }

  function initialize() {
    arrow.style.setProperty("--arrow-nock-position", `${nockRatio * 100}%`);
    arrow.addEventListener("pointerdown", handlePointerDown);
    arrow.addEventListener("pointermove", handlePointerMove);
    arrow.addEventListener("pointerup", handlePointerUp);
    arrow.addEventListener("pointercancel", handlePointerCancel);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("orientationchange", handleViewportChange);
    setState(INTERACTION_STATES.IDLE);
    resetVisuals();
  }

  return Object.freeze({
    initialize,
    getState: () => state,
    reset: resetVisuals,
    destroy: () => {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }

      if (resetTimer) {
        window.clearTimeout(resetTimer);
      }
    },
  });
}
