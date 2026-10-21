export type RefinementFocusId =
  | "marketable"
  | "concise"
  | "feasible"
  | "ambitious"
  | "clearer";

// Directions the user can steer a refinement in. `instruction` is sent to the
// model; `label` and `description` are shown in the picker.
export const REFINEMENT_FOCUSES: {
  id: RefinementFocusId;
  label: string;
  description: string;
  instruction: string;
}[] = [
  {
    id: "marketable",
    label: "More marketable",
    description: "Who it's for and why they'd care",
    instruction:
      "Make it more marketable: name the audience, the pain it solves, and why they would pay or care.",
  },
  {
    id: "concise",
    label: "More concise",
    description: "Cut it down to the core",
    instruction:
      "Make it more concise: the shortest name and description that keep the core idea.",
  },
  {
    id: "feasible",
    label: "More feasible",
    description: "Something you could build soon",
    instruction:
      "Make it more feasible: scope it to something one person could start building soon.",
  },
  {
    id: "ambitious",
    label: "Bigger vision",
    description: "Push the scope and upside",
    instruction:
      "Make it more ambitious: expand the scope and upside and show where it could lead.",
  },
  {
    id: "clearer",
    label: "Clearer",
    description: "Spell out the problem and solution",
    instruction:
      "Make it clearer: remove vagueness and state the problem and the solution plainly.",
  },
];

export const MAX_REFINEMENT_NOTE_LENGTH = 300;

// Follow-up rounds a refinement can take, each replying to the last draft.
export const MAX_REFINEMENT_ROUNDS = 5;
