import { initExperience } from "./experience.js";
import { initBowArrow } from "./bowArrow.js";
import { initHeartTransition } from "./heartTransition.js";
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
  }
}

initializeApplication();
