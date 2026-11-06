import { Matrix4, Quaternion, Vector3 } from "three";

/**
 * Turns a pose written the way a person would describe it ("the upper arm
 * hangs a little out, the forearm comes up in front, its inside toward the
 * viewer; weight on the right leg, the left one a step forward") into a turn
 * for every bone of the statue's skeleton.
 *
 * The body frame: +X the figure's own left, +Y up, +Z its front.
 *
 * - The torso, the neck and the head take small bends, turns and leans.
 * - An arm is given as directions for its upper arm and its forearm (and,
 *   when it matters, where the inside of the forearm faces), relative to the
 *   chest. The elbow only ever folds about its own hinge: the shoulder takes
 *   whatever twist that asks for, as a real one does.
 * - A leg is given in degrees from standing, in the room's frame (a tilted
 *   pelvis does not carry the legs with it), and the feet stay flat on the
 *   floor: the figure is lowered or raised until the supporting foot stands,
 *   and the other knee gives until that foot touches too.
 */

export type Vec = [number, number, number];
export type Side = "L" | "R";

/** Degrees. Bend is forward, turn is toward the figure's own left, lean is toward its left. */
export interface Lean {
  bend?: number;
  turn?: number;
  lean?: number;
}

/** Directions for one arm, with +X pointing out to that arm's own side (so one description serves both arms). */
export interface ArmPose {
  upper: Vec;
  fore: Vec;
  /** Where the inside of the forearm (and the palm) faces. Left out, the forearm keeps the twist the pose carries it to. */
  inner?: Vec;
}

/** Degrees from standing, each positive toward the leg's natural way: forward, out to its side, toes turned out, knee folded, heel off the floor. */
export interface LegPose {
  fwd?: number;
  out?: number;
  turn?: number;
  knee?: number;
  heel?: number;
}

export interface Pose {
  pelvis?: Lean;
  /** Shared along the four bones of the spine. */
  spine?: Lean;
  /** Shared between the neck and the head. */
  look?: Lean;
  /** Each shoulder girdle: lifted, and brought forward (negative: drawn back). */
  shoulderL?: { raise?: number; fwd?: number };
  shoulderR?: { raise?: number; fwd?: number };
  armL?: ArmPose;
  armR?: ArmPose;
  legL?: LegPose;
  legR?: LegPose;
}

/** What the solver needs to know of the figure at rest, in its own space (metres, before the height scale). */
export interface RigRest {
  /** Joint positions by bone name. */
  pos: Map<string, Vector3>;
  /** Which way the inside of each forearm faces at rest. */
  volar: Record<Side, Vector3>;
  /** Heel and toe on the sole of each foot. */
  sole: Record<Side, { heel: Vector3; toe: Vector3 }>;
}

export interface Solved {
  /** Each bone's turn from rest, in the figure's space. */
  extra: Map<string, Quaternion>;
  /** How far the whole figure rises (or sinks) so its feet stand on the floor. */
  lift: number;
}

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
const RAD = Math.PI / 180;
const about = (axis: Vector3, deg: number) => new Quaternion().setFromAxisAngle(axis, deg * RAD);

/** Lean first, then bend, then turn, about the figure's own axes; `share` takes a part of it. */
function lean(l: Lean | undefined, share = 1): Quaternion {
  if (!l) return new Quaternion();
  return about(Y, (l.turn ?? 0) * share)
    .multiply(about(X, (l.bend ?? 0) * share))
    .multiply(about(Z, -(l.lean ?? 0) * share));
}

/** A frame with `a` as its first axis and `b`, squared off against it, as its second. */
function basis(a: Vector3, b: Vector3): Quaternion {
  const x = a.clone().normalize();
  const y = b.clone().addScaledVector(x, -b.dot(x)).normalize();
  const z = new Vector3().crossVectors(x, y);
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
}

const SPINE: [string, number][] = [
  ["spine04", 0.2],
  ["spine03", 0.25],
  ["spine02", 0.3],
  ["spine01", 0.25],
];

/** The arm as it hangs when nobody is thinking about it: a little out, the elbow soft, the palm toward the thigh. */
export const HANG: ArmPose = { upper: [0.27, -0.96, 0.03], fore: [0.2, -0.93, 0.3], inner: [-0.8, 0.05, 0.6] };

export function solvePose(rig: RigRest, pose: Pose | null): Solved {
  const p = pose ?? {};
  const extra = new Map<string, Quaternion>();
  const joint = (name: string) => rig.pos.get(name)!;

  // The trunk, from the pelvis up.
  const pelvis = lean(p.pelvis);
  extra.set("pelvis", pelvis);
  let carry = pelvis;
  for (const [name, share] of SPINE) {
    carry = carry.clone().multiply(lean(p.spine, share));
    extra.set(name, carry);
  }
  const chest = carry;
  const neck = chest.clone().multiply(lean(p.look, 0.4));
  extra.set("neck", neck);
  extra.set("head", neck.clone().multiply(lean(p.look, 0.6)));

  // The arms, each from the chest.
  for (const side of ["L", "R"] as Side[]) {
    const s = side === "L" ? 1 : -1;
    const own = (v: Vec) => new Vector3(v[0] * s, v[1], v[2]).normalize();
    const arm = (side === "L" ? p.armL : p.armR) ?? HANG;
    const girdle = (side === "L" ? p.shoulderL : p.shoulderR) ?? {};
    const u0 = joint(`forearm_${side}`).clone().sub(joint(`upperarm_${side}`)).normalize();
    const f0 = joint(`hand_${side}`).clone().sub(joint(`forearm_${side}`)).normalize();
    const h0 = new Vector3().crossVectors(u0, f0).normalize();
    const u1 = own(arm.upper);
    const f1 = own(arm.fore);
    // The elbow's hinge after the move: square to both bones. A straight arm has none of its own and keeps the one the shoulder carries.
    const h1 = new Vector3().crossVectors(u1, f1);
    // A mirrored arm bends the mirrored way round.
    if (h1.length() < 0.06) h1.copy(h0).applyQuaternion(new Quaternion().setFromUnitVectors(u0, u1));
    const upper = basis(u1, h1).multiply(basis(u0, h0).invert());
    const fold = about(h0, (Math.acos(Math.max(-1, Math.min(1, u1.dot(f1)))) - Math.acos(Math.max(-1, Math.min(1, u0.dot(f0))))) / RAD);
    let fore = fold;
    if (arm.inner) {
      // Twist the forearm about itself until its inside faces where it was asked to.
      const now = rig.volar[side].clone().applyQuaternion(upper.clone().multiply(fold));
      const want = own(arm.inner);
      want.addScaledVector(f1, -want.dot(f1));
      now.addScaledVector(f1, -now.dot(f1));
      if (want.lengthSq() > 1e-6 && now.lengthSq() > 1e-6) {
        want.normalize();
        now.normalize();
        const twist = Math.atan2(f1.dot(new Vector3().crossVectors(now, want)), now.dot(want));
        fore = fold.clone().multiply(new Quaternion().setFromAxisAngle(f0, twist));
      }
    }
    // The shoulder girdle rides up with a raised arm, as the collarbone does.
    const up = Math.acos(Math.max(-1, Math.min(1, -u1.y))) / RAD;
    const raise = (girdle.raise ?? 0) + Math.max(0, Math.min(22, (up - 60) * 0.35));
    const clav = about(Z, s * raise).multiply(about(Y, -s * (girdle.fwd ?? 0)));
    const clavWorld = chest.clone().multiply(clav);
    extra.set(`clavicle_${side}`, clavWorld);
    extra.set(`shoulder_${side}`, clavWorld);
    // The arm's directions are the chest's to give: the girdle moves the joint, not the aim.
    const upperWorld = chest.clone().multiply(upper);
    extra.set(`upperarm_${side}`, upperWorld);
    const foreWorld = upperWorld.clone().multiply(fore);
    extra.set(`forearm_${side}`, foreWorld);
    extra.set(`hand_${side}`, foreWorld);
  }

  // The legs, in the room's frame; then the floor.
  const legs = (["L", "R"] as Side[]).map((side) => {
    const s = side === "L" ? 1 : -1;
    const leg = (side === "L" ? p.legL : p.legR) ?? {};
    const thigh = about(X, -(leg.fwd ?? 0))
      .multiply(about(Z, s * (leg.out ?? 0)))
      .multiply(about(Y, s * (leg.turn ?? 0)));
    return { side, thigh, knee: Math.max(0, leg.knee ?? 0), heel: leg.heel ?? 0 };
  });
  /** Lowest point of a foot for a given knee, with the pelvis where it is at rest. */
  const stand = (leg: (typeof legs)[number], knee: number) => {
    const { side, thigh } = leg;
    const shin = thigh.clone().multiply(about(X, knee));
    const ahead = Z.clone().applyQuaternion(shin);
    const foot = about(Y, Math.atan2(ahead.x, ahead.z) / RAD).multiply(about(X, leg.heel));
    const hip = joint("pelvis").clone().add(joint(`thigh_${side}`).clone().sub(joint("pelvis")).applyQuaternion(pelvis));
    const kneeAt = hip.add(joint(`lowerleg_${side}`).clone().sub(joint(`thigh_${side}`)).applyQuaternion(thigh));
    const ankle = kneeAt.add(joint(`foot_${side}`).clone().sub(joint(`lowerleg_${side}`)).applyQuaternion(shin));
    const sole = rig.sole[side];
    const low = Math.min(...[sole.heel, sole.toe].map((ref) => ankle.y + ref.clone().sub(joint(`foot_${side}`)).applyQuaternion(foot).y));
    return { shin, foot, low };
  };
  const floor = Math.min(rig.sole.L.heel.y, rig.sole.L.toe.y, rig.sole.R.heel.y, rig.sole.R.toe.y);
  const first = legs.map((leg) => stand(leg, leg.knee));
  // The foot that reaches lowest carries the weight: the figure settles onto it.
  const support = first[0].low <= first[1].low ? 0 : 1;
  const lift = floor - first[support].low;
  legs.forEach((leg, i) => {
    let knee = leg.knee;
    if (i !== support && first[i].low + lift > floor + 0.002) {
      // The other foot hangs in the air: let its knee give until it touches (or comes as near as the leg allows).
      let best = knee;
      let bestGap = first[i].low + lift - floor;
      for (let k = knee - 0.5; k >= 0; k -= 0.5) {
        const gap = stand(leg, k).low + lift - floor;
        if (gap <= 0) {
          best = k + (0.5 * -gap) / Math.max(1e-6, bestGap - gap);
          bestGap = 0;
          break;
        }
        if (gap < bestGap) {
          best = k;
          bestGap = gap;
        } else break; // past the lowest the leg can reach
      }
      knee = best;
    }
    const { shin, foot } = stand(leg, knee);
    extra.set(`thigh_${leg.side}`, leg.thigh);
    extra.set(`lowerleg_${leg.side}`, shin);
    extra.set(`foot_${leg.side}`, foot);
  });

  return { extra, lift };
}
