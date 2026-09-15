import { initExperience } from "./experience.js";
import { initBowArrow } from "./bowArrow.js";
import { initHeartTransition } from "./heartTransition.js";
import { initSceneTwo } from "./sceneTwo.js";
import { createTextSequence } from "./textEngine.js";
import { getExperienceData } from "./data.js";
import { initializeTheme } from "./theme.js";

function initializeApplication() {
  const experienceData = getExperienceData();

  initializeTheme();
  const experience = initExperience(experienceData);

  if (experience) {
    const activeScene = experience.getCurrentScene();

    initHeartTransition(activeScene);
    initBowArrow(activeScene);
    const sceneTwo = experience.getScene("scene-02");

    initializeSceneTwoHandoff(experience, activeScene);
    initSceneTwo(sceneTwo);
    initializeSceneTwoTextDemo(sceneTwo);
  }
}

function initializeSceneTwoTextDemo(scene) {
  const textElement = scene?.querySelector("[data-scene-two-text]");
  const stage = scene?.closest(".experience-stage");
  const sequence = createTextSequence(textElement, {
    sequenceId: "scene-two-heart-demo",
  });

  if (!sequence || !stage) {
    return;
  }

  scene.addEventListener("envelope:heart-open", () => {
    sequence.play("Hey... I made something for you.");
  });

  stage.addEventListener("heart-transition:reset", () => {
    sequence.reset();
  });
}

function initializeSceneTwoHandoff(experience, sourceScene) {
  const stage = sourceScene?.closest(".experience-stage");
  const transitionLayer = stage?.querySelector("[data-heart-transition]");
  const sceneTwo = experience.getScene("scene-02");

  if (!stage || !transitionLayer || !sceneTwo) {
    return;
  }

  let hasActivatedSceneTwo = false;

  function activateSceneTwo() {
    if (hasActivatedSceneTwo || experience.getCurrentScene() === sceneTwo) {
      return;
    }

    /*
     * The color wave is complete at this point. Hiding its retained final
     * state lets the existing scene manager reveal Scene 2 without a flash.
     */
    transitionLayer.hidden = true;
    experience.goToScene("scene-02");
    hasActivatedSceneTwo = true;
  }

  function restoreInitialScene() {
    hasActivatedSceneTwo = false;
    transitionLayer.hidden = false;

    if (experience.getCurrentScene() === sceneTwo) {
      experience.goToScene("scene-01");
    }
  }

  stage.addEventListener("heart-transition:complete", activateSceneTwo);
  stage.addEventListener("heart-transition:started", () => {
    hasActivatedSceneTwo = false;
    transitionLayer.hidden = false;
  });
  stage.addEventListener("heart-transition:reset", restoreInitialScene);
}

initializeApplication();
