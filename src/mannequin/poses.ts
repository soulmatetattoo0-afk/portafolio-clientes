import { HANG, type ArmPose, type Lean, type LegPose, type Pose, type Side } from "./solve";

/**
 * How the statue holds itself to show an area, the way a person does when
 * someone asks to see their tattoo: the forearm comes up with its inside
 * toward you, the bicep is flexed open, the hand behind the head opens the
 * ribs, a step forward turns the thigh out, the chin lifts off the neck, the
 * head bows for the nape, and the head turns to look at what is being shown.
 * The feet always stand on the floor (the solver sees to it).
 *
 * Poses are written once, for the figure's left side (see solve.ts for the
 * words), and mirrored for the right. Each comes with the shot the camera
 * takes of it.
 */

/** Where the camera stands: degrees round the figure from its front toward its own left, degrees above level, and how the area sits in the frame. */
export interface Shot {
  az: number;
  el: number;
  /** How much of the frame's half-height (or half-width) the area may take; smaller leaves more body around it. */
  fill?: number;
  /** Never show less than this much of the figure, in metres from the centre of the frame to its edge. */
  min?: number;
}

/** Standing at ease: arms hanging, toes a touch out. Everything else starts from here. */
const STANCE: Pose = { armL: HANG, armR: HANG, legL: { turn: 5 }, legR: { turn: 5 } };

/* ------------------------------------------------------------------ arms */

/** The forearm raised beside the shoulder, its inside turned to the viewer: how an inner-forearm piece is shown. */
const INNER_FOREARM: ArmPose = { upper: [0.42, -0.86, 0.3], fore: [0.34, 0.9, 0.27], inner: [-0.2, -0.1, 0.97] };
/** The forearm laid across the body as if reading a watch: its outside faces the viewer. */
const OUTER_FOREARM: ArmPose = { upper: [0.24, -0.9, 0.36], fore: [-0.82, 0.22, 0.52], inner: [0.1, -0.5, -0.86] };
/** The hand lifted in front of the chest, its back to the viewer. */
const HAND_UP: ArmPose = { upper: [0.3, -0.88, 0.36], fore: [-0.28, 0.8, 0.53], inner: [0.05, -0.2, -0.98] };
/** The bicep opened: the arm out to the side, the forearm folded up toward the head. */
const FLEX: ArmPose = { upper: [0.88, -0.3, 0.36], fore: [-0.3, 0.9, 0.3] };
/** The whole arm held away from the body, the elbow soft, the inside turned forward: a sleeve in one line. */
const SLEEVE: ArmPose = { upper: [0.7, -0.7, 0.16], fore: [0.62, -0.62, 0.48], inner: [-0.25, 0.25, 0.94] };
/** The arm a little off the body, the shoulder and upper arm given to the viewer. */
const SHOULDER: ArmPose = { upper: [0.34, -0.93, -0.1], fore: [0.2, -0.9, 0.38], inner: [-0.8, 0, 0.6] };
/** The forearm held out level from a hanging upper arm, as for a handshake: seen from above, half its inside and half its outside. */
const FOREARM_OUT: ArmPose = { upper: [0.26, -0.94, 0.2], fore: [0.62, -0.12, 0.77], inner: [-0.7, -0.55, 0.3] };
/** The hand behind the head: the arm out of the way of the ribs, the side stretched open. */
const BEHIND_HEAD: ArmPose = { upper: [0.6, 0.78, 0.14], fore: [-0.86, -0.34, -0.38] };
/** The arm lifted off the hip, the hand resting by the chest. */
const OFF_HIP: ArmPose = { upper: [0.34, -0.8, 0.5], fore: [-0.6, 0.76, 0.26] };
/** Arms let fall a little forward, shoulders rounded: the back spreads wide. */
const FORWARD: ArmPose = { upper: [0.24, -0.93, 0.27], fore: [0.04, -0.86, 0.5], inner: [-0.6, 0, -0.8] };
/** Arms eased back and open: the chest comes forward. */
const OPEN: ArmPose = { upper: [0.32, -0.94, -0.12], fore: [0.24, -0.95, 0.16], inner: [-0.8, 0.05, 0.6] };
/** Hands toward the small of the back: nothing hangs over the stomach. */
const BEHIND_BACK: ArmPose = { upper: [0.42, -0.86, -0.28], fore: [-0.3, -0.84, -0.46], inner: [0.2, 0, -0.98] };

/* ------------------------------------------------------------------ legs */

/** The leg the weight is on, and the quiet one beside it. */
const PLANTED: LegPose = { turn: 5 };

/** One-sided poses, written for the left; `flip` makes the right. */
const LEFT: Record<string, Pose> = {
  shoulder: { armL: SHOULDER, spine: { turn: -14 }, look: { turn: 30, bend: 8 } },
  upper_arm: { armL: FLEX, spine: { lean: -3 }, look: { turn: 34, bend: 4 } },
  forearm_inner: { armL: INNER_FOREARM, look: { turn: 22, bend: 4 } },
  forearm_outer: { armL: OUTER_FOREARM, look: { turn: -6, bend: 16 } },
  forearm_full: { armL: FOREARM_OUT, look: { turn: 16, bend: 18 } },
  hand: { armL: HAND_UP, look: { turn: 6, bend: 10 } },
  sleeve_full: { armL: SLEEVE, spine: { turn: -6 }, look: { turn: 30, bend: 10 } },
  sleeve_half: { armL: SHOULDER, spine: { turn: -12 }, look: { turn: 30, bend: 8 } },
  chest: { armL: OPEN, armR: OPEN, shoulderL: { fwd: -7 }, shoulderR: { fwd: -7 }, spine: { bend: -3, turn: -6 }, look: { bend: -6, turn: 8 } },
  ribs: { armL: BEHIND_HEAD, spine: { lean: -9, turn: -10 }, look: { turn: -8, bend: -2 }, pelvis: { lean: 3 } },
  hip: { armL: OFF_HIP, pelvis: { lean: -5 }, spine: { lean: 6, turn: -8 }, look: { turn: 24, bend: 16 }, legL: PLANTED, legR: { fwd: 6, out: 4, turn: 8, knee: 14 } },
  thigh: { legL: { fwd: 20, out: 7, turn: 24, knee: 34, heel: 26 }, legR: PLANTED, pelvis: { turn: -5 }, look: { turn: 12, bend: 20 } },
  shin: { legL: { fwd: 15, turn: 8, knee: 8 }, legR: { fwd: -9, turn: 6, knee: 5 }, look: { bend: 20, turn: 6 } },
  calf: { legL: { fwd: -7, turn: 4 }, legR: { fwd: 14, turn: 8, knee: 14 }, look: { turn: 30, bend: 12 } },
  foot: { legL: { fwd: 14, out: 3, turn: 16, knee: 6 }, legR: { fwd: -6, turn: 6, knee: 4 }, look: { bend: 26, turn: 10 } },
  leg_sleeve: { legL: { fwd: 11, out: 8, turn: 18, knee: 10 }, legR: { fwd: -6, turn: 5 }, look: { turn: 12, bend: 18 } },
};

const SHOTS_LEFT: Record<string, Shot> = {
  shoulder: { az: 58, el: 8, fill: 0.42 },
  upper_arm: { az: 14, el: 4, fill: 0.4, min: 0.44 },
  forearm_inner: { az: 14, el: -2, fill: 0.42, min: 0.46 },
  forearm_outer: { az: 6, el: 14, fill: 0.44, min: 0.46 },
  forearm_full: { az: 10, el: 32, fill: 0.44, min: 0.46 },
  hand: { az: 4, el: 8, fill: 0.34, min: 0.4 },
  sleeve_full: { az: 22, el: 6, fill: 0.6, min: 0.52 },
  sleeve_half: { az: 52, el: 8, fill: 0.5 },
  chest: { az: 10, el: 2, fill: 0.44 },
  ribs: { az: 62, el: 4, fill: 0.52 },
  hip: { az: 66, el: 0, fill: 0.4, min: 0.5 },
  thigh: { az: 30, el: 2, fill: 0.56, min: 0.55 },
  shin: { az: 12, el: -2, fill: 0.5, min: 0.5 },
  calf: { az: 158, el: 0, fill: 0.5, min: 0.5 },
  foot: { az: 24, el: 34, fill: 0.3, min: 0.36 },
  leg_sleeve: { az: 30, el: 4, fill: 0.74 },
};

/** Poses of the middle of the body, the same from either side. */
const CENTRE: Record<string, { pose: Pose; shot: Shot }> = {
  neck: { pose: { look: { bend: -18 }, shoulderL: { fwd: -4 }, shoulderR: { fwd: -4 } }, shot: { az: 0, el: -6, fill: 0.34, min: 0.36 } },
  nape: { pose: { look: { bend: 30 }, spine: { bend: 5 }, armL: FORWARD, armR: FORWARD }, shot: { az: 180, el: 16, fill: 0.34, min: 0.36 } },
  chest_center: { pose: { armL: OPEN, armR: OPEN, shoulderL: { fwd: -8 }, shoulderR: { fwd: -8 }, spine: { bend: -4 }, look: { bend: -8 } }, shot: { az: 0, el: 2, fill: 0.4 } },
  chest_full: { pose: { armL: OPEN, armR: OPEN, shoulderL: { fwd: -8 }, shoulderR: { fwd: -8 }, spine: { bend: -4 }, look: { bend: -8 } }, shot: { az: 0, el: 2, fill: 0.5 } },
  stomach: { pose: { armL: BEHIND_BACK, armR: BEHIND_BACK, spine: { bend: -3 }, look: { bend: 14 } }, shot: { az: 0, el: -2, fill: 0.46 } },
  back_upper: { pose: { armL: FORWARD, armR: FORWARD, shoulderL: { fwd: 10 }, shoulderR: { fwd: 10 }, spine: { bend: 4 }, look: { bend: 12 } }, shot: { az: 180, el: 8, fill: 0.5 } },
  back_lower: { pose: { armL: FORWARD, armR: FORWARD, shoulderL: { fwd: 6 }, shoulderR: { fwd: 6 }, spine: { bend: 7 }, look: { bend: 10 } }, shot: { az: 180, el: 2, fill: 0.46 } },
  back_full: { pose: { armL: FORWARD, armR: FORWARD, shoulderL: { fwd: 10 }, shoulderR: { fwd: 10 }, spine: { bend: 4 }, look: { bend: 12 } }, shot: { az: 180, el: 6, fill: 0.62 } },
};

const flipLean = (l: Lean | undefined): Lean | undefined => (l ? { bend: l.bend, turn: l.turn === undefined ? undefined : -l.turn, lean: l.lean === undefined ? undefined : -l.lean } : undefined);

/** The same pose on the other side of the body. */
function flip(p: Pose): Pose {
  return { pelvis: flipLean(p.pelvis), spine: flipLean(p.spine), look: flipLean(p.look), shoulderL: p.shoulderR, shoulderR: p.shoulderL, armL: p.armR, armR: p.armL, legL: p.legR, legR: p.legL };
}

const split = (placement: string): { base: string; side: Side | null } => {
  const m = /^(.*)_([LR])$/.exec(placement);
  return m ? { base: m[1], side: m[2] as Side } : { base: placement, side: null };
};

/** The pose for a placement; with none chosen, standing at ease. */
export function poseFor(placement: string | null): Pose {
  if (!placement) return STANCE;
  const centre = CENTRE[placement];
  if (centre) return { ...STANCE, ...centre.pose };
  const { base, side } = split(placement);
  const left = side ? LEFT[base] : undefined;
  if (!left) return STANCE;
  const full = { ...STANCE, ...left };
  return side === "L" ? full : flip(full);
}

/** Where the camera stands for a placement's pose, or null to let it find the clearest view itself. */
export function shotFor(placement: string): Shot | null {
  const centre = CENTRE[placement];
  if (centre) return centre.shot;
  const { base, side } = split(placement);
  const left = side ? SHOTS_LEFT[base] : undefined;
  if (!left) return null;
  return side === "L" ? left : { ...left, az: -left.az };
}
