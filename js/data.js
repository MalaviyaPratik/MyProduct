const experienceData = Object.freeze({
  version: "S1.4",
  scenes: Object.freeze([
    Object.freeze({
      id: "scene-01",
      order: 1,
      status: "initial",
    }),
  ]),
});

/**
 * Provides the presentation layer with data independently of its future source.
 */
export function getExperienceData() {
  return experienceData;
}
