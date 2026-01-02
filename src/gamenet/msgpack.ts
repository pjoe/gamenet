// import { decode, encode, ExtensionCodec } from '@msgpack/msgpack';
// import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';

// const extensionCodec = new ExtensionCodec();
// const SCALE_FACTOR = 128;
// const VEC3_EXT_TYPE = 0;
// extensionCodec.register({
//   type: VEC3_EXT_TYPE,
//   encode: (object: unknown): Uint8Array | null => {
//     if (object instanceof Vector3) {
//       return encode([
//         (object.x * SCALE_FACTOR) | 0,
//         (object.y * SCALE_FACTOR) | 0,
//         (object.z * SCALE_FACTOR) | 0,
//       ]);
//     } else {
//       return null;
//     }
//   },
//   decode: (data: Uint8Array) => {
//     const array = decode(data) as number[];
//     return new Vector3(
//       array[0] / SCALE_FACTOR,
//       array[1] / SCALE_FACTOR,
//       array[2] / SCALE_FACTOR
//     );
//   },
// });

// const QUAT_EXT_TYPE = 1;
// extensionCodec.register({
//   type: QUAT_EXT_TYPE,
//   encode: (object: unknown): Uint8Array | null => {
//     if (object instanceof Quaternion) {
//       return encode([
//         (object.x * SCALE_FACTOR) | 0,
//         (object.y * SCALE_FACTOR) | 0,
//         (object.z * SCALE_FACTOR) | 0,
//         (object.w * SCALE_FACTOR) | 0,
//       ]);
//     } else {
//       return null;
//     }
//   },
//   decode: (data: Uint8Array) => {
//     const array = decode(data) as number[];
//     return new Quaternion(
//       array[0] / SCALE_FACTOR,
//       array[1] / SCALE_FACTOR,
//       array[2] / SCALE_FACTOR,
//       array[3] / SCALE_FACTOR
//     );
//   },
// });

// const p = new Vector3(11.1, 22.2, 33.3);
// const v = new Vector3(1.1, 2.2, 3.3);
// const av = new Vector3(0.4, 0.5, 0.6);
// const q = new Quaternion(4.4, 5.5, 6.6, 7.7);

// const obj = {
//   p,
//   v,
//   av,
//   q,
// };

// function buf2hex(buffer: Uint8Array) {
//   // buffer is an ArrayBuffer
//   return [...buffer].map((x) => x.toString(16).padStart(2, '0')).join(' ');
// }

// const enc = encode(obj, { extensionCodec });
// console.log('length:', enc.byteLength);
// console.log(buf2hex(enc));
// console.log(decode(enc, { extensionCodec }));
