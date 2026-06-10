import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { SnapshotVault } from "@gamenet/core";
import { Comp, createComponent, xform } from "@skyboxgg/bjs-ecs";
import { ComponentSerde, NetsyncState } from "./serde";

export type XformSyncData = {
  pos: Vector3;
  quat: Quaternion;
  linearVel?: Vector3;
  angularVel?: Vector3;
  /** Server time (ms) of the last teleport for this xform, if any. */
  teleportTime?: number;
};

export function serializeXformSyncData(data: XformSyncData): number[] {
  const arr = [
    (data.linearVel ? 1 : 0) |
      (data.angularVel ? 2 : 0) |
      (data.teleportTime ? 4 : 0),
    data.pos.x,
    data.pos.y,
    data.pos.z,
    data.quat.x,
    data.quat.y,
    data.quat.z,
    data.quat.w,
  ];
  if (data.linearVel) {
    arr.push(data.linearVel.x, data.linearVel.y, data.linearVel.z);
  }
  if (data.angularVel) {
    arr.push(data.angularVel.x, data.angularVel.y, data.angularVel.z);
  }
  if (data.teleportTime) {
    arr.push(data.teleportTime);
  }
  return arr;
}

export function deserializeXformSyncData(arr: number[]): XformSyncData {
  const flags = arr[0];
  const data: XformSyncData = {
    pos: new Vector3(arr[1], arr[2], arr[3]),
    quat: new Quaternion(arr[4], arr[5], arr[6], arr[7]),
  };
  let index = 8;
  if (flags & 1) {
    data.linearVel = new Vector3(arr[index], arr[index + 1], arr[index + 2]);
    index += 3;
  }
  if (flags & 2) {
    data.angularVel = new Vector3(arr[index], arr[index + 1], arr[index + 2]);
    index += 3;
  }
  if (flags & 4) {
    data.teleportTime = arr[index];
  }
  return data;
}

export const xformSync = createComponent(
  "xformSync",
  (init: { diff: XformSyncData; lastTeleportTime?: number }) => ({
    diff: init.diff,
    lastTeleportTime: init.lastTeleportTime ?? 0,
  })
);

/**
 * State fields used by the xform serde. `vault` and `renderTime` are only
 * needed client-side for `applyUpdate` (reconciliation against snapshots).
 */
export interface XformSerdeState extends NetsyncState<TransformNode> {
  /** Client-side snapshot vault; required for `applyUpdate`. */
  vault?: SnapshotVault;
  /** Render time (server-time ms) used for vault lookup in `applyUpdate`. */
  renderTime?: number;
}

function serializeXform(comp: true | Comp): number[] {
  const xformVal = (comp as ReturnType<typeof xform>).value;
  const xformData: XformSyncData = {
    pos: xformVal.position,
    quat:
      xformVal.rotationQuaternion ??
      Quaternion.FromEulerVector(xformVal.rotation),
    linearVel: xformVal.physicsBody?.getLinearVelocity(),
    angularVel: xformVal.physicsBody?.getAngularVelocity(),
  };
  const teleportTime = (xformVal.metadata as { teleportTime?: number } | null)
    ?.teleportTime;
  if (teleportTime !== undefined) {
    xformData.teleportTime = teleportTime;
  }
  return serializeXformSyncData(xformData);
}

export const xformSerde: ComponentSerde<XformSerdeState> = {
  serialize: serializeXform,
  serializeUpdate: serializeXform,
  deserialize: (data: unknown, state: XformSerdeState) => {
    const xformData = deserializeXformSyncData(data as number[]);
    const node = state.node;
    if (node) {
      node.position.copyFrom(xformData.pos);
      node.rotationQuaternion = new Quaternion().copyFrom(xformData.quat);
      if (node.physicsBody) {
        if (xformData.linearVel) {
          node.physicsBody.setLinearVelocity(xformData.linearVel);
        }
        if (xformData.angularVel) {
          node.physicsBody.setAngularVelocity(xformData.angularVel);
        }
      }
    }
    return {
      comps: [
        xformSync({
          diff: {
            pos: Vector3.Zero(),
            quat: Quaternion.Identity(),
            linearVel: Vector3.Zero(),
            angularVel: Vector3.Zero(),
          },
          lastTeleportTime: xformData.teleportTime ?? 0,
        }),
      ],
    };
  },
  applyUpdate: (data: unknown, state: XformSerdeState) => {
    const { entity, vault, renderTime } = state;
    if (!entity || !vault || renderTime === undefined) return;
    const xformComp = deserializeXformSyncData(data as number[]);
    const xformVal = (
      entity.comps.xform as ReturnType<typeof xform> | undefined
    )?.value;
    const xformSyncVal = (
      entity.comps.xformSync as ReturnType<typeof xformSync> | undefined
    )?.value;
    if (!xformVal || !xformSyncVal) return;

    // Teleport: if server reports a newer teleportTime, snap the entity
    // to the server-reported state and skip diff/reconciliation for this
    // update.
    if (
      xformComp.teleportTime !== undefined &&
      xformComp.teleportTime > xformSyncVal.lastTeleportTime
    ) {
      xformVal.position.copyFrom(xformComp.pos);
      if (!xformVal.rotationQuaternion) {
        xformVal.rotationQuaternion = new Quaternion();
      }
      xformVal.rotationQuaternion.copyFrom(xformComp.quat);
      if (xformVal.physicsBody) {
        if (xformComp.linearVel) {
          xformVal.physicsBody.setLinearVelocity(xformComp.linearVel);
        }
        if (xformComp.angularVel) {
          xformVal.physicsBody.setAngularVelocity(xformComp.angularVel);
        }
      }
      const diff = xformSyncVal.diff;
      diff.pos.setAll(0);
      diff.quat.copyFrom(Quaternion.Identity());
      diff.linearVel?.setAll(0);
      diff.angularVel?.setAll(0);
      xformSyncVal.lastTeleportTime = xformComp.teleportTime;
      // Drop stale snapshots; next client snapshot tick will repopulate
      // based on the new post-teleport state.
      vault.remove(entity.id);
      return;
    }

    // lookup in snapshot vault
    const vaultXform = vault.query(
      entity.id,
      "xform",
      renderTime
    ) as XformSyncData | null;
    if (vaultXform) {
      const pos = new Vector3().copyFrom(xformComp.pos);
      const quat = new Quaternion().copyFrom(xformComp.quat);
      const linearVel = xformComp.linearVel
        ? new Vector3().copyFrom(xformComp.linearVel)
        : undefined;
      const angularVel = xformComp.angularVel
        ? new Vector3().copyFrom(xformComp.angularVel)
        : undefined;

      const diff = xformSyncVal.diff;
      diff.pos = pos.subtract(vaultXform.pos);
      diff.quat = quat.multiply(vaultXform.quat.conjugate());
      diff.linearVel = linearVel?.subtract(
        vaultXform.linearVel ?? Vector3.Zero()
      );
      diff.angularVel = angularVel?.subtract(
        vaultXform.angularVel ?? Vector3.Zero()
      );
    }
  },
  captureSnapshot: (comp: true | Comp) => {
    const xformVal = (comp as ReturnType<typeof xform>).value;
    return {
      pos: xformVal.position,
      quat:
        xformVal.rotationQuaternion ??
        Quaternion.FromEulerVector(xformVal.rotation),
      linearVel: xformVal.physicsBody?.getLinearVelocity(),
      angularVel: xformVal.physicsBody?.getAngularVelocity(),
    };
  },
};

/**
 * Mark the given transform node as having teleported at `time` (ms).
 * The next networked update will carry this `teleportTime`, allowing
 * clients to snap the entity instead of interpolating toward the new state.
 */
export function markXformTeleport(
  node: TransformNode,
  time: number = Date.now()
): void {
  if (!node.metadata) {
    node.metadata = {};
  }
  (node.metadata as { teleportTime?: number }).teleportTime = time;
}
