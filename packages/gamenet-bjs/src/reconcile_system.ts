import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene.js";
import { SnapshotVault } from "@gamenet/core";
import { queryXforms, xform } from "@skyboxgg/bjs-ecs";
import {
  EntitiesSync,
  ServerEntityIdMap,
  xformSync,
  XformSyncData,
} from "./netsync";

export function setupReconcile(scene: Scene) {
  scene.onBeforeRenderObservable.add(() => {
    const xformEntities = queryXforms(["netsync", xformSync]);
    const dt = scene.getEngine().getDeltaTime() / 1000;
    for (const e of xformEntities) {
      const xform = e.xform;
      const netDiff: XformSyncData = e.xformSync.diff;

      // pos
      const posFraction = Math.min(1, dt * 18);
      const posChange = netDiff.pos.scale(posFraction);
      xform.position.addInPlace(posChange);
      netDiff.pos.scaleInPlace(1 - posFraction);

      // linearVel
      if (netDiff.linearVel && xform.physicsBody) {
        const linearVel = xform.physicsBody.getLinearVelocity();
        const linearVelFraction = Math.min(1, dt * 1);
        const linearVelChange = netDiff.linearVel.scale(linearVelFraction);
        linearVel.addInPlace(linearVelChange);
        xform.physicsBody.setLinearVelocity(linearVel);
        netDiff.linearVel.scaleInPlace(1 - linearVelFraction);
      }

      // quat
      const quatFraction = Math.min(1, dt * 18);
      const quatChange = Quaternion.Slerp(
        Quaternion.Identity(),
        netDiff.quat,
        quatFraction
      );
      xform.rotationQuaternion = quatChange.multiply(xform.rotationQuaternion!);
      netDiff.quat = Quaternion.Slerp(
        netDiff.quat,
        Quaternion.Identity(),
        quatFraction
      );

      // angularVel
      if (netDiff.angularVel && xform.physicsBody) {
        const angularVel = xform.physicsBody.getAngularVelocity();
        const angularVelFraction = Math.min(1, dt * 2);
        const angularVelChange = netDiff.angularVel.scale(angularVelFraction);
        angularVel.addInPlace(angularVelChange);
        xform.physicsBody.setAngularVelocity(angularVel);
        netDiff.angularVel.scaleInPlace(1 - angularVelFraction);
      }
    }
  });
}

export function storeEntityXformDiffs(
  entities: EntitiesSync,
  timeDiff: number,
  vault: SnapshotVault,
  serverIdMap: ServerEntityIdMap
) {
  entities.forEach((e) => {
    const existingEntity = serverIdMap.get(e.id);
    if (existingEntity) {
      const xformComp = e.comps.find((c) => c.k === "xform")?.v as
        | XformSyncData
        | undefined;
      if (xformComp) {
        const xformVal = (
          existingEntity.comps.xform as ReturnType<typeof xform>
        ).value;
        // lookup in snapshot vault
        const vaultXform = vault.query(
          existingEntity.id,
          "xform",
          timeDiff
        ) as XformSyncData | null;
        if (xformVal && vaultXform) {
          const pos = new Vector3().copyFrom(xformComp.pos);
          const quat = new Quaternion().copyFrom(xformComp.quat);
          const linearVel = xformComp.linearVel
            ? new Vector3().copyFrom(xformComp.linearVel)
            : undefined;
          const angularVel = xformComp.angularVel
            ? new Vector3().copyFrom(xformComp.angularVel)
            : undefined;

          const xformSyncVal = (
            existingEntity.comps.xformSync as ReturnType<typeof xformSync>
          ).value;
          if (xformSyncVal) {
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
        }
      }
    }
  });
}
