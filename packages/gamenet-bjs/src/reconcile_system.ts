import { Quaternion, Scene } from "@babylonjs/core";
import { queryXforms } from "@skyboxgg/bjs-ecs";
import { xformSync, XformSyncData } from "./netsync";

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
