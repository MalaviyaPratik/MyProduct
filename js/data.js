const experienceData = Object.freeze({
  version: "S2.1.1",
  scenes: Object.freeze([
    Object.freeze({
      id: "scene-01",
      order: 1,
      status: "initial",
    }),
    Object.freeze({
      id: "scene-02",
      order: 2,
      status: "reserved",
    }),
  ]),
});

/**
 * Provides the presentation layer with data independently of its future source.
 */
export function getExperienceData() {
  return experienceData;
}
