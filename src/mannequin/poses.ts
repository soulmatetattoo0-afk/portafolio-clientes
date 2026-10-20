/**
 * How the statue holds itself to show an area, the way a client would in the
 * chair: the inner forearm is offered palm up, the outer forearm left hanging
 * at rest, the bicep opened out to the side, the ribs opened with the hand behind the
 * head, the back shown with the arms folded in front. Legs, torso and neck keep
 * the rest pose; the camera does the work there.
 *
 * Each bone turns about its own axes at rest, in the order written: X is the
 * hinge (negative swings the limb forward or bends the elbow), Y a twist along
 * the bone (positive supinates a left arm), Z the lift out to the side
 * (positive abducts a left arm). A parent's turn then carries its children, so
 * an elbow is bent first and the upper arm takes it wherever it goes. Angles
 * are degrees. The right side mirrors the left: twists and lifts change sign.
 */
export type Axis = "x" | "y" | "z";
export type PoseSpec = Record<string, [Axis, number][]>;

/** The rest pose is an A-pose: the arms hang about this far out from vertical. */
const REST_ABDUCTION = 38;
/** Lift that brings a hanging arm to the side of the body. */
const IN = -REST_ABDUCTION + 8;

type Side = "L" | "R";

/** A left-arm pose by anatomical motion; the side is filled in and mirrored. */
type Arm = { upper: [Axis, number][]; fore: [Axis, number][] };

const arm = (side: Side, a: Arm): PoseSpec => {
  const m = side === "L" ? 1 : -1;
  const mirror = (steps: [Axis, number][]): [Axis, number][] => steps.map(([axis, deg]) => [axis, axis === "x" ? deg : deg * m]);
  return { [`upperarm_${side}`]: mirror(a.upper), [`forearm_${side}`]: mirror(a.fore) };
};

/** Arm reached out in front and a little down, nearly straight, palm up: the inner forearm faces the camera. */
const INNER_FOREARM: Arm = { upper: [["z", -16], ["x", -70]], fore: [["y", 100], ["x", 10]] };
/** Hand offered forward, back of the hand up. */
const HAND: Arm = { upper: [["z", IN + 2], ["x", -55]], fore: [["y", -90], ["x", -25]] };
/** The bicep shown: the arm opened out to the side, level and straight, palm turned forward so the inner bicep faces the camera. */
const BICEP: Arm = { upper: [["z", 85 - REST_ABDUCTION]], fore: [["y", 90], ["x", 12]] };
/** Arm held out level, palm down: the whole sleeve in one line. */
const OUT_LEVEL: Arm = { upper: [["z", 85 - REST_ABDUCTION], ["x", -8]], fore: [["x", -8]] };
/** Arm raised with the hand behind the head: the ribs open up. */
const BEHIND_HEAD: Arm = { upper: [["y", 120], ["z", 153 - REST_ABDUCTION]], fore: [["x", -130]] };
/** Arms loosely folded in front, so nothing hangs over the back. */
const FOLDED: Arm = { upper: [["z", IN], ["x", -35]], fore: [["y", 30], ["x", -80]] };

const BOTH_FOLDED: PoseSpec = { ...arm("L", FOLDED), ...arm("R", FOLDED) };

const BY_BASE: Record<string, (side: Side) => PoseSpec> = {
  forearm_inner: (s) => arm(s, INNER_FOREARM),
  forearm_full: (s) => arm(s, INNER_FOREARM),
  // The outer forearm reads best as it is: the arm hangs at rest and the camera finds the outside.
  hand: (s) => arm(s, HAND),
  upper_arm: (s) => arm(s, BICEP),
  sleeve_full: (s) => arm(s, OUT_LEVEL),
  sleeve_half: (s) => arm(s, OUT_LEVEL),
  ribs: (s) => arm(s, BEHIND_HEAD),
};

const BACK = new Set(["back_upper", "back_lower", "back_full", "nape"]);

/** The pose for a placement, or null for the rest pose. */
export function poseFor(placement: string): PoseSpec | null {
  if (BACK.has(placement)) return BOTH_FOLDED;
  const m = /^(.*)_([LR])$/.exec(placement);
  if (!m) return null;
  const build = BY_BASE[m[1]];
  return build ? build(m[2] as Side) : null;
}

/**
 * Where the camera should stand for a pose, in the figure's frame (+Z the
 * front, +X the figure's left), when the area's own facing would mislead it:
 * an arm held out level faces the front, so look from the front, a little to
 * that side, not down the length of the arm.
 */
export function viewFor(placement: string): [number, number, number] | null {
  const m = /^(upper_arm|forearm_inner|forearm_full|sleeve_half|sleeve_full)_([LR])$/.exec(placement);
  if (!m) return null;
  const side = m[2] === "L" ? 1 : -1;
  // The bicep and the sleeves from the front, a little to their side; the inner forearm from in front and slightly above, palm up.
  if (m[1] === "upper_arm" || m[1] === "sleeve_half" || m[1] === "sleeve_full") return [side * 0.45, 0.12, 1];
  return [side * 0.25, 0.32, 1];
}
