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

  if (
    !arrow ||
    !bowRig ||
    !target ||
    !feedback ||
    !upperString ||
    !lowerString
  ) {
    return null;
  }

  const nockRatio = Number(arrow.dataset.arrowNock) || 0.06;
  const tipRatio = Number(arrow.dataset.arrowTip) || 0.98;

  let state = INTERACTION_STATES.IDLE;
  let pull = { x: 0, y: 0, strength: 0 };
  let aim = { x: 1, y: 0, angle: 0 };
  let feedbackCategory = null;
  let animationFrame = null;
  let resetTimer = null;

  /*
   * Stores the successful hit point.
   *
   * The important part is heartXRatio / heartYRatio.
   * These values describe where the arrow hit relative
   * to the actual heart body, not relative to the viewport.
   *
   * This makes the hit position responsive-safe.
   */
  let lastHitPoint = null;

  function getPointInScene(event) {
    const bounds = scene.getBoundingClientRect();

    return {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
  }

  /*
   * The bow is a horizontal SVG.
   * Its actual string/nock center is the visual center of the bow.
   */
  function getBowOrigin() {
    return {
      x: bowRig.offsetLeft + bowRig.offsetWidth * 0.5,
      y: bowRig.offsetTop + bowRig.offsetHeight * 0.5,
    };
  }

  /*
   * Only the central heart body counts as the target.
   * Decorative wings are intentionally excluded.
   */
  function getHeartHitRegion() {
    const targetBounds = target.getBoundingClientRect();
    const sceneBounds = scene.getBoundingClientRect();

    const width = targetBounds.width;
    const height = targetBounds.height;

    const centerX =
      targetBounds.left -
      sceneBounds.left +
      width * 0.5;

    const centerY =
      targetBounds.top -
      sceneBounds.top +
      height * 0.55;

    /*
     * Central heart body only.
     * Wings remain outside this ellipse.
     */
    const radiusX = width * 0.20;
    const radiusY = height * 0.38;

    return {
      centerX,
      centerY,
      radiusX,
      radiusY,
      size: Math.min(width, height),
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

    arrow.disabled =
      nextState !== INTERACTION_STATES.IDLE &&
      nextState !== INTERACTION_STATES.DRAGGING;
  }

  /*
   * String center always follows the actual arrow nock.
   */
  function updateString() {
    const centerX = 148 + pull.x;
    const centerY = 37.69 + pull.y;

    upperString.setAttribute("x2", String(centerX));
    upperString.setAttribute("y2", String(centerY));

    lowerString.setAttribute("x2", String(centerX));
    lowerString.setAttribute("y2", String(centerY));
  }

  function updateArrowNockPosition() {
    const nockOffset = arrow.offsetWidth * nockRatio;

    arrow.style.setProperty(
      "--arrow-nock-shift",
      `${-nockOffset}px`,
    );
  }

  function updateVisuals(nockOffset = pull, direction = aim) {
    scene.style.setProperty(
      "--arrow-x",
      `${nockOffset.x}px`,
    );

    scene.style.setProperty(
      "--arrow-y",
      `${nockOffset.y}px`,
    );

    scene.style.setProperty(
      "--arrow-angle",
      `${direction.angle}deg`,
    );

    /*
     * The bow itself must NEVER rotate with the arrow.
     */
    scene.style.setProperty("--bow-tilt", "0deg");
  }

  function getDistanceFeedback(distance, targetRegion) {
    const normalizedX =
      distance.x / targetRegion.radiusX;

    const normalizedY =
      distance.y / targetRegion.radiusY;

    const normalizedDistance = Math.sqrt(
      normalizedX * normalizedX +
        normalizedY * normalizedY,
    );

    if (normalizedDistance <= 0.35) {
      return {
        category: "very-close",
        message: "Right there… ❤️",
      };
    }

    if (normalizedDistance <= 0.75) {
      return {
        category: "close",
        message: "So close… ❤️",
      };
    }

    if (normalizedDistance <= 1.5) {
      return {
        category: "medium",
        message: "Getting closer…",
      };
    }

    if (normalizedDistance <= 2.5) {
      return {
        category: "far",
        message: "A little farther…",
      };
    }

    return {
      category: "very-far",
      message: "Too far… keep aiming ❤️",
    };
  }

  function updateDistanceFeedback() {
    const origin = getBowOrigin();

    const nockPosition = {
      x: origin.x + pull.x,
      y: origin.y + pull.y,
    };

    const tip = getArrowTip(nockPosition);
    const region = getHeartHitRegion();

    const distance = {
      x: tip.x - region.centerX,
      y: tip.y - region.centerY,
    };

    const nextFeedback = getDistanceFeedback(
      Math.hypot(distance.x, distance.y),
      region,
    );

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

    const distance = Math.hypot(
      rawPull.x,
      rawPull.y,
    );

    const constrainedDistance = Math.min(
      distance,
      MAX_PULL_DISTANCE,
    );

    const scale =
      distance > 0
        ? constrainedDistance / distance
        : 0;

    pull = {
      x: rawPull.x * scale,
      y: rawPull.y * scale,
      strength:
        constrainedDistance /
        MAX_PULL_DISTANCE,
    };

    /*
     * Arrow flies in the exact opposite direction
     * of the pull.
     */
    const launchVector = {
      x: -pull.x,
      y: -pull.y,
    };

    const launchDistance =
      Math.hypot(
        launchVector.x,
        launchVector.y,
      ) || 1;

    aim = {
      x:
        launchVector.x /
        launchDistance,

      y:
        launchVector.y /
        launchDistance,

      angle:
        (Math.atan2(
          launchVector.y,
          launchVector.x,
        ) *
          180) /
        Math.PI,
    };

    updateString();
    updateVisuals();
    updateDistanceFeedback();
  }

  function resetVisuals() {
    const origin = getBowOrigin();
    const region = getHeartHitRegion();

    const directionX =
      region.centerX - origin.x;

    const directionY =
      region.centerY - origin.y;

    const distance =
      Math.hypot(
        directionX,
        directionY,
      ) || 1;

    pull = {
      x: 0,
      y: 0,
      strength: 0,
    };

    aim = {
      x: directionX / distance,
      y: directionY / distance,
      angle:
        (Math.atan2(
          directionY,
          directionX,
        ) *
          180) /
        Math.PI,
    };

    lastHitPoint = null;
    feedbackCategory = null;

    feedback.classList.remove(
      "feedback--hit",
    );

    feedback.textContent = "";

    updateArrowNockPosition();
    updateString();
    updateVisuals();
  }

  function isPointInsideHeart(tip) {
    const region = getHeartHitRegion();

    const normalizedX =
      (tip.x - region.centerX) /
      region.radiusX;

    const normalizedY =
      (tip.y - region.centerY) /
      region.radiusY;

    /*
     * Ellipse hit area.
     * Wings are outside this region.
     */
    return (
      normalizedX * normalizedX +
        normalizedY * normalizedY <=
      1
    );
  }

  function endWithMiss() {
    setState(INTERACTION_STATES.MISS);

    feedback.classList.remove(
      "feedback--hit",
    );

    feedbackCategory = null;

    feedback.textContent =
      "A little off — try again.";

    resetTimer = window.setTimeout(() => {
      setState(
        INTERACTION_STATES.RESETTING,
      );

      resetVisuals();

      setState(
        INTERACTION_STATES.IDLE,
      );
    }, 650);
  }

  function endWithHit(impactPoint) {
    /*
     * Capture the impact relative to the current heart body.
     *
     * This is the key to responsive resize support.
     */
    const region = getHeartHitRegion();

    const heartXRatio =
      region.radiusX
        ? (impactPoint.x - region.centerX) /
          region.radiusX
        : 0;

    const heartYRatio =
      region.radiusY
        ? (impactPoint.y - region.centerY) /
          region.radiusY
        : 0;

    lastHitPoint = Object.freeze({
      x: impactPoint.x,
      y: impactPoint.y,
      heartXRatio,
      heartYRatio,
    });

    setState(INTERACTION_STATES.HIT);

    feedback.classList.add(
      "feedback--hit",
    );

    feedback.textContent =
      "Bullseye! 💘 You just hit my heart!";

    scene.dispatchEvent(
      new CustomEvent("bow-arrow:hit", {
        bubbles: true,
        detail: {
          coordinateSpace: "scene",

          impactPoint: Object.freeze({
            x: impactPoint.x,
            y: impactPoint.y,
          }),

          /*
           * Future transition modules can use these
           * responsive-safe coordinates.
           */
          heartImpact: Object.freeze({
            xRatio: heartXRatio,
            yRatio: heartYRatio,
          }),
        },
      }),
    );

    target.classList.add(
      "heart-target--impact",
    );

    window.setTimeout(() => {
      target.classList.remove(
        "heart-target--impact",
      );
    }, 250);
  }

  function launchArrow() {
    if (
      pull.strength <
      MIN_LAUNCH_STRENGTH
    ) {
      setState(
        INTERACTION_STATES.RESETTING,
      );

      resetVisuals();

      setState(
        INTERACTION_STATES.IDLE,
      );

      return;
    }

    setState(
      INTERACTION_STATES.FLYING,
    );

    feedback.textContent = "";

    const origin = getBowOrigin();

    const nockPosition = {
      x: origin.x + pull.x,
      y: origin.y + pull.y,
    };

    let currentTip = getArrowTip(
      nockPosition,
      aim,
    );

    const speed =
      760 + pull.strength * 840;

    const velocity = {
      x: aim.x * speed,
      y: aim.y * speed,
    };

    const sceneBounds =
      scene.getBoundingClientRect();

    let previousTime = null;

    function fly(timestamp) {
      if (
        state !==
        INTERACTION_STATES.FLYING
      ) {
        return;
      }

      if (previousTime === null) {
        previousTime = timestamp;
      }

      const delta = Math.min(
        (timestamp - previousTime) /
          1000,
        0.032,
      );

      previousTime = timestamp;

      const previousTip = {
        x: currentTip.x,
        y: currentTip.y,
      };

      currentTip.x +=
        velocity.x * delta;

      currentTip.y +=
        velocity.y * delta;

      const flightAngle =
        (Math.atan2(
          velocity.y,
          velocity.x,
        ) *
          180) /
        Math.PI;

      const direction = {
        x: Math.cos(
          (flightAngle * Math.PI) /
            180,
        ),

        y: Math.sin(
          (flightAngle * Math.PI) /
            180,
        ),

        angle: flightAngle,
      };

      const tipOffset =
        getArrowTipOffset();

      const flightNock = {
        x:
          currentTip.x -
          direction.x *
            tipOffset,

        y:
          currentTip.y -
          direction.y *
            tipOffset,
      };

      updateVisuals(
        {
          x:
            flightNock.x -
            origin.x,

          y:
            flightNock.y -
            origin.y,
        },
        direction,
      );

      /*
       * Check the complete movement segment.
       */
      if (
        segmentHitsHeart(
          previousTip,
          currentTip,
        )
      ) {
        animationFrame = null;

        endWithHit(currentTip);

        return;
      }

      const outsideStage =
        currentTip.x < -100 ||
        currentTip.x >
          sceneBounds.width + 100 ||
        currentTip.y < -100 ||
        currentTip.y >
          sceneBounds.height + 100;

      if (outsideStage) {
        animationFrame = null;

        endWithMiss();

        return;
      }

      animationFrame =
        window.requestAnimationFrame(
          fly,
        );
    }

    animationFrame =
      window.requestAnimationFrame(
        fly,
      );
  }

  function segmentHitsHeart(
    start,
    end,
  ) {
    const region =
      getHeartHitRegion();

    const steps = 8;

    for (
      let index = 0;
      index <= steps;
      index += 1
    ) {
      const progress =
        index / steps;

      const point = {
        x:
          start.x +
          (end.x - start.x) *
            progress,

        y:
          start.y +
          (end.y - start.y) *
            progress,
      };

      if (
        isPointInsideHeart(point)
      ) {
        return true;
      }
    }

    return false;
  }

  function handlePointerDown(event) {
    if (
      state !==
      INTERACTION_STATES.IDLE
    ) {
      return;
    }

    event.preventDefault();

    arrow.setPointerCapture(
      event.pointerId,
    );

    setState(
      INTERACTION_STATES.DRAGGING,
    );
  }

  function handlePointerMove(event) {
    if (
      state !==
      INTERACTION_STATES.DRAGGING
    ) {
      return;
    }

    event.preventDefault();

    updateAim(
      getPointInScene(event),
    );
  }

  function releasePointer(event) {
    if (
      arrow.hasPointerCapture(
        event.pointerId,
      )
    ) {
      arrow.releasePointerCapture(
        event.pointerId,
      );
    }
  }

  function handlePointerUp(event) {
    if (
      state !==
      INTERACTION_STATES.DRAGGING
    ) {
      return;
    }

    releasePointer(event);

    launchArrow();
  }

  function handlePointerCancel(event) {
    if (
      state !==
      INTERACTION_STATES.DRAGGING
    ) {
      return;
    }

    releasePointer(event);

    setState(
      INTERACTION_STATES.RESETTING,
    );

    resetVisuals();

    setState(
      INTERACTION_STATES.IDLE,
    );
  }

  function handleViewportChange() {
    /*
     * Normal idle state:
     * recalculate the default arrow/bow alignment
     * against the new responsive layout.
     */
    if (
      state ===
      INTERACTION_STATES.IDLE
    ) {
      resetVisuals();
      return;
    }

    /*
     * While dragging, do not reset the user's pull.
     * The next pointer movement will use the new layout.
     */
    if (
      state ===
      INTERACTION_STATES.DRAGGING
    ) {
      updateArrowNockPosition();
      updateString();
      return;
    }

    /*
     * Do not interfere with an arrow already flying.
     */
    if (
      state ===
      INTERACTION_STATES.FLYING
    ) {
      updateArrowNockPosition();
      return;
    }

    /*
     * Successful hit:
     *
     * Recalculate the current heart geometry first,
     * then reconstruct the same relative impact point.
     *
     * This is what makes:
     *
     * Mobile → Desktop
     * Desktop → Mobile
     *
     * responsive-safe.
     */
    if (
      state ===
        INTERACTION_STATES.HIT &&
      lastHitPoint
    ) {
      const region =
        getHeartHitRegion();

      if (
        !region.radiusX ||
        !region.radiusY
      ) {
        return;
      }

      const nextImpactPoint = {
        x:
          region.centerX +
          lastHitPoint.heartXRatio *
            region.radiusX,

        y:
          region.centerY +
          lastHitPoint.heartYRatio *
            region.radiusY,
      };

      /*
       * Keep the stored point synchronized with
       * the current responsive geometry.
       */
      lastHitPoint = Object.freeze({
        ...lastHitPoint,
        x: nextImpactPoint.x,
        y: nextImpactPoint.y,
      });

      const origin = getBowOrigin();

      const direction = {
        x: aim.x,
        y: aim.y,
        angle: aim.angle,
      };

      const tipOffset =
        getArrowTipOffset();

      const nockPosition = {
        x:
          nextImpactPoint.x -
          direction.x *
            tipOffset,

        y:
          nextImpactPoint.y -
          direction.y *
            tipOffset,
      };

      updateArrowNockPosition();

      updateVisuals(
        {
          x:
            nockPosition.x -
            origin.x,

          y:
            nockPosition.y -
            origin.y,
        },
        direction,
      );
    }
  }

  function initialize() {
    updateArrowNockPosition();

    arrow.addEventListener(
      "pointerdown",
      handlePointerDown,
    );

    arrow.addEventListener(
      "pointermove",
      handlePointerMove,
    );

    arrow.addEventListener(
      "pointerup",
      handlePointerUp,
    );

    arrow.addEventListener(
      "pointercancel",
      handlePointerCancel,
    );

    window.addEventListener(
      "resize",
      handleViewportChange,
    );

    window.addEventListener(
      "orientationchange",
      handleViewportChange,
    );

    setState(
      INTERACTION_STATES.IDLE,
    );

    resetVisuals();
  }

  return Object.freeze({
    initialize,

    getState: () => state,

    reset: resetVisuals,

    destroy: () => {
      if (animationFrame) {
        window.cancelAnimationFrame(
          animationFrame,
        );
      }

      if (resetTimer) {
        window.clearTimeout(
          resetTimer,
        );
      }
    },
  });
}