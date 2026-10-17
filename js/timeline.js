/* Timing shared by the page (captions) and the 3D scene (camera keys), so a
   project's caption shows exactly while the camera lingers on its screen.
   Within the work chapter (progress 0 to 1) project i is centred on workTime. */

export const WORK_PAD = 0.07;
export const workTime = (i, n) => WORK_PAD + ((i + 0.5) / n) * (1 - 2 * WORK_PAD);
export const workHalf = (n) => (0.5 / n) * (1 - 2 * WORK_PAD);
