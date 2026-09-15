export function initHeartTransition(scene) {
  if (!scene) {
    return null;
  }

  const stage = scene.closest(".experience-stage");
  const layer = stage?.querySelector(
    "[data-heart-transition]",
  );
  const marker = layer?.querySelector(
    "[data-heart-impact]",
  );
  const wave = layer?.querySelector(
    "[data-heart-wave]",
  );
  const target = scene.querySelector(
    "[data-heart-target]",
  );

  if (
    !stage ||
    !layer ||
    !marker ||
    !wave ||
    !target
  ) {
    return null;
  }

  let impactPoint = null;
  let burstStarted = false;
  let completionTimer = null;
  const particleTimers = new Set();

  function clearPendingTimers() {
    if (completionTimer !== null) {
      window.clearTimeout(completionTimer);
      completionTimer = null;
    }

    particleTimers.forEach((timer) => window.clearTimeout(timer));
    particleTimers.clear();
  }

  function completeTransition() {
    if (layer.dataset.state !== "transitioning") {
      return;
    }

    clearPendingTimers();
    layer.dataset.state = "completed";
    wave.dataset.state = "completed";
    scene.dataset.transitionState = "completed";

    stage.dispatchEvent(
      new CustomEvent("heart-transition:complete", {
        detail: { impactPoint },
      }),
    );
  }

  function getAnimationTime(value) {
    const trimmedValue = value.trim();

    if (trimmedValue.endsWith("ms")) {
      return Number.parseFloat(trimmedValue);
    }

    if (trimmedValue.endsWith("s")) {
      return Number.parseFloat(trimmedValue) * 1000;
    }

    return 0;
  }

  function scheduleCompletionFallback() {
    const waveStyles = window.getComputedStyle(wave);
    const duration = getAnimationTime(waveStyles.animationDuration.split(",")[0]);
    const delay = getAnimationTime(waveStyles.animationDelay.split(",")[0]);

    completionTimer = window.setTimeout(
      completeTransition,
      duration + delay + 100,
    );
  }

  function resetTransition() {
    clearPendingTimers();
    burstStarted = false;
    impactPoint = null;
    layer.querySelectorAll(".heart-burst-particle").forEach((particle) => particle.remove());
    layer.dataset.state = "idle";
    wave.dataset.state = "idle";
    delete scene.dataset.transitionState;
  }

  function createHeartParticle(index, count, origin, reducedMotion) {
    const svgNamespace = "http://www.w3.org/2000/svg";
    const particle = document.createElementNS(svgNamespace, "svg");
    const heartPath = document.createElementNS(svgNamespace, "path");
    const distribution = count > 1 ? index / (count - 1) : 0.5;
    const angle = -160 + distribution * 320 + Math.sin(index * 2.1) * 8;
    const distance = 56 + (index % 5) * 23 + Math.sin(index * 1.4) * 10;
    const radians = (angle * Math.PI) / 180;
    const size = 9 + (index % 4) * 2.5;
    const duration = 760 + (index % 5) * 110;
    /*
     * Let the impact register before the burst begins. The small stagger keeps
     * the hearts cohesive without making the source feel delayed.
     */
    const delay = reducedMotion ? 0 : 80 + (index % 7) * 18;

    particle.classList.add("heart-burst-particle");
    particle.classList.toggle("heart-burst-particle--soft", index % 3 === 0);
    particle.setAttribute("viewBox", "0 0 24 24");
    particle.setAttribute("aria-hidden", "true");
    particle.style.setProperty("--particle-origin-x", `${origin.stageXRatio * 100}%`);
    particle.style.setProperty("--particle-origin-y", `${origin.stageYRatio * 100}%`);
    particle.style.setProperty("--particle-x", `${Math.cos(radians) * distance}px`);
    particle.style.setProperty("--particle-y", `${Math.sin(radians) * distance}px`);
    particle.style.setProperty("--particle-size", `${size}px`);
    particle.style.setProperty("--particle-rotation", `${-18 + (index % 6) * 9}deg`);
    particle.style.setProperty("--particle-duration", `${reducedMotion ? 420 : duration}ms`);
    particle.style.setProperty("--particle-delay", `${delay}ms`);
    heartPath.setAttribute(
      "d",
      "M12 21.35 10.55 20C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11L12 21.35Z",
    );
    particle.append(heartPath);

    return particle;
  }

  function createHeartBurst(origin) {
    if (burstStarted) {
      return;
    }

    burstStarted = true;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const count = reducedMotion ? 8 : 28;

    layer.querySelectorAll(".heart-burst-particle").forEach((particle) => particle.remove());

    for (let index = 0; index < count; index += 1) {
      const particle = createHeartParticle(index, count, origin, reducedMotion);
      const cleanupDelay = Number.parseFloat(particle.style.getPropertyValue("--particle-duration")) +
        Number.parseFloat(particle.style.getPropertyValue("--particle-delay")) + 120;

      layer.append(particle);
      let timer = null;

      particle.addEventListener("animationend", () => {
        if (timer !== null) {
          window.clearTimeout(timer);
          particleTimers.delete(timer);
        }

        particle.remove();
      }, { once: true });

      timer = window.setTimeout(() => {
        particleTimers.delete(timer);
        particle.remove();
      }, cleanupDelay);

      particleTimers.add(timer);
    }

    stage.dispatchEvent(
      new CustomEvent("heart-transition:burst-started", {
        detail: { impactPoint: origin },
      }),
    );
  }

  /*
   * Recalculate the impact point from the heart's
   * current responsive geometry.
   *
   * The stored xRatio/yRatio describe the exact point
   * inside the heart body where the arrow originally hit.
   */
  function getResponsiveImpactPoint() {
    if (
      !impactPoint ||
      !impactPoint.heartImpact
    ) {
      return null;
    }

    const targetBounds =
      target.getBoundingClientRect();

    const sceneBounds =
      scene.getBoundingClientRect();

    const width = targetBounds.width;
    const height = targetBounds.height;

    if (!width || !height) {
      return null;
    }

    const centerX =
      targetBounds.left -
      sceneBounds.left +
      width * 0.5;

    const centerY =
      targetBounds.top -
      sceneBounds.top +
      height * 0.55;

    const radiusX =
      width * 0.20;

    const radiusY =
      height * 0.38;

    const sceneX =
      centerX +
      impactPoint.heartImpact.xRatio *
        radiusX;

    const sceneY =
      centerY +
      impactPoint.heartImpact.yRatio *
        radiusY;

    const stageBounds =
      stage.getBoundingClientRect();

    const stageX =
      sceneBounds.left -
      stageBounds.left +
      sceneX;

    const stageY =
      sceneBounds.top -
      stageBounds.top +
      sceneY;

    return {
      sceneX,
      sceneY,
      stageX,
      stageY,

      stageXRatio:
        stageBounds.width
          ? stageX /
            stageBounds.width
          : 0.5,

      stageYRatio:
        stageBounds.height
          ? stageY /
            stageBounds.height
          : 0.5,
    };
  }

  function applyImpactPosition() {
    if (!impactPoint) {
      return;
    }

    layer.style.setProperty(
      "--impact-x",
      `${impactPoint.stageXRatio * 100}%`,
    );

    layer.style.setProperty(
      "--impact-y",
      `${impactPoint.stageYRatio * 100}%`,
    );

    wave.style.setProperty(
      "--wave-x",
      `${impactPoint.stageXRatio * 100}%`,
    );

    wave.style.setProperty(
      "--wave-y",
      `${impactPoint.stageYRatio * 100}%`,
    );

    wave.style.setProperty(
      "--wave-scale",
      String(getWaveScale(impactPoint)),
    );
  }

  function getWaveScale(origin) {
    const stageBounds = stage.getBoundingClientRect();
    const originX = origin.stageXRatio * stageBounds.width;
    const originY = origin.stageYRatio * stageBounds.height;
    const farthestCorner = Math.max(
      Math.hypot(originX, originY),
      Math.hypot(stageBounds.width - originX, originY),
      Math.hypot(originX, stageBounds.height - originY),
      Math.hypot(stageBounds.width - originX, stageBounds.height - originY),
    );

    return Math.ceil(((farthestCorner + 96) / 80) * 100) / 100;
  }

  function beginTransition(event) {
    if (layer.dataset.state === "transitioning") {
      return;
    }

    if (layer.dataset.state === "completed") {
      resetTransition();
      void wave.offsetWidth;
    }

    const {
      impactPoint: scenePoint,
      heartImpact,
    } = event.detail;

    const stageBounds =
      stage.getBoundingClientRect();

    const sceneBounds =
      scene.getBoundingClientRect();

    const stageX =
      sceneBounds.left -
      stageBounds.left +
      scenePoint.x;

    const stageY =
      sceneBounds.top -
      stageBounds.top +
      scenePoint.y;

    /*
     * Store both:
     *
     * 1. Current stage position
     * 2. Heart-relative position
     *
     * Heart-relative position is authoritative after resize.
     */
    impactPoint = Object.freeze({
      sceneX: scenePoint.x,
      sceneY: scenePoint.y,
      stageX,
      stageY,

      stageXRatio:
        stageBounds.width
          ? stageX /
            stageBounds.width
          : 0.5,

      stageYRatio:
        stageBounds.height
          ? stageY /
            stageBounds.height
          : 0.5,

      heartImpact: heartImpact
        ? Object.freeze({
            xRatio: heartImpact.xRatio,
            yRatio: heartImpact.yRatio,
          })
        : null,
    });

    applyImpactPosition();

    layer.dataset.state =
      "transitioning";

    wave.dataset.state = "expanding";

    scene.dataset.transitionState =
      "transitioning";

    createHeartBurst(impactPoint);
    scheduleCompletionFallback();

    stage.dispatchEvent(
      new CustomEvent(
        "heart-transition:started",
        {
          detail: {
            impactPoint,
          },
        },
      ),
    );
  }

  function handleViewportChange() {
    if (!impactPoint) {
      return;
    }

    const stageBounds =
      stage.getBoundingClientRect();

    if (
      !stageBounds.width ||
      !stageBounds.height
    ) {
      return;
    }

    /*
     * If heart-relative coordinates are available,
     * reconstruct the impact point against the NEW
     * responsive heart position and size.
     */
    if (impactPoint.heartImpact) {
      const nextPoint =
        getResponsiveImpactPoint();

      if (nextPoint) {
        impactPoint = Object.freeze({
          ...impactPoint,
          ...nextPoint,
        });
      }
    } else {
      /*
       * Backward-safe fallback for any event that does
       * not contain heart-relative coordinates.
       */
      impactPoint = Object.freeze({
        ...impactPoint,
        stageXRatio:
          stageBounds.width
            ? impactPoint.stageX /
              stageBounds.width
            : 0.5,

        stageYRatio:
          stageBounds.height
            ? impactPoint.stageY /
              stageBounds.height
            : 0.5,
      });
    }

    applyImpactPosition();
  }

  scene.addEventListener(
    "bow-arrow:hit",
    beginTransition,
  );

  wave.addEventListener("animationend", (event) => {
    if (event.target === wave && event.animationName.includes("heart-color-wave")) {
      completeTransition();
    }
  });

  stage.addEventListener("heart-transition:reset", resetTransition);

  window.addEventListener(
    "resize",
    handleViewportChange,
  );

  window.addEventListener(
    "orientationchange",
    handleViewportChange,
  );

  return Object.freeze({
    getImpactPoint: () => impactPoint,
    getState: () => layer.dataset.state,
    reset: resetTransition,
  });
}
