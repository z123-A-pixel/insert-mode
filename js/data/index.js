import hw from './hw.js';
import mcu from './mcu.js';
import comm from './comm.js';
import rtos from './rtos.js';
import debug from './debug.js';
import interview from './interview.js';
import power from './power.js';
import clang from './clang.js';
import linux from './linux.js';
import motor from './motor.js';
import EXTRAS from './extras.js';

const list = EXTRAS.filter((x) => x && Array.isArray(x.chapters));

export const MODULES = [hw, mcu, comm, rtos, debug, interview, power, clang, linux, motor].map((m) => {
  const parts = list.filter((e) => e.id === m.id);
  if (!parts.length) return m;
  return { ...m, chapters: parts.reduce((acc, e) => acc.concat(e.chapters), m.chapters.slice()) };
});

export default MODULES;