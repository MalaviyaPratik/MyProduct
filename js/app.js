import { initExperience } from "./experience.js";
import { initBowArrow } from "./bowArrow.js";
import { getExperienceData } from "./data.js";
import { initializeTheme } from "./theme.js";

function initializeApplication() {
  const experienceData = getExperienceData();

  initializeTheme();
  const experience = initExperience(experienceData);

  if (experience) {
    initBowArrow(experience.getCurrentScene());
  }
}

initializeApplication();
