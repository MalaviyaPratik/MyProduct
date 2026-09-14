const LIFECYCLE_EVENTS = Object.freeze([
  "beforeEnter",
  "enter",
  "afterEnter",
  "beforeExit",
  "exit",
  "afterExit",
]);

export function initExperience(experienceData) {
  const root = document.querySelector("#experience");

  if (!root) {
    return null;
  }

  const manager = createSceneManager(root, experienceData.scenes);
  manager.initialize();

  return manager;
}

function createSceneManager(root, sceneConfigurations) {
  const scenes = new Map(
    sceneConfigurations.map((configuration) => [
      configuration.id,
      root.querySelector(`[data-scene="${configuration.id}"]`),
    ]),
  );
  let currentSceneId = null;

  function getScene(sceneId) {
    return scenes.get(sceneId) ?? null;
  }

  function getCurrentScene() {
    return getScene(currentSceneId);
  }

  function dispatchLifecycle(scene, phase) {
    root.dispatchEvent(
      new CustomEvent("experience:scene-lifecycle", {
        detail: {
          phase,
          sceneId: scene.dataset.scene,
        },
      }),
    );
  }

  function activateScene(scene) {
    dispatchLifecycle(scene, "beforeEnter");
    scene.classList.add("scene--entering", "scene--active");
    scene.setAttribute("aria-hidden", "false");
    dispatchLifecycle(scene, "enter");
    scene.classList.remove("scene--entering");
    dispatchLifecycle(scene, "afterEnter");
  }

  function deactivateScene(scene) {
    dispatchLifecycle(scene, "beforeExit");
    scene.classList.add("scene--exiting");
    dispatchLifecycle(scene, "exit");
    scene.classList.remove("scene--active", "scene--exiting");
    scene.setAttribute("aria-hidden", "true");
    dispatchLifecycle(scene, "afterExit");
  }

  function goToScene(sceneId) {
    const nextScene = getScene(sceneId);

    if (!nextScene || sceneId === currentSceneId) {
      return getCurrentScene();
    }

    const currentScene = getCurrentScene();

    if (currentScene) {
      deactivateScene(currentScene);
    }

    activateScene(nextScene);
    currentSceneId = sceneId;

    return nextScene;
  }

  function initialize() {
    scenes.forEach((scene, sceneId) => {
      if (!scene) {
        throw new Error(`Experience scene "${sceneId}" is missing from the stage.`);
      }

      scene.classList.remove("scene--active");
      scene.setAttribute("aria-hidden", "true");
    });

    const initialScene = sceneConfigurations.find((scene) => scene.status === "initial");

    if (initialScene) {
      goToScene(initialScene.id);
    }

    root.classList.add("experience--ready");
  }

  return Object.freeze({
    getCurrentScene,
    getScene,
    goToScene,
    initialize,
    lifecycleEvents: LIFECYCLE_EVENTS,
  });
}
