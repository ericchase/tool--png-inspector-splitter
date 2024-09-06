// src/lib/ericchase/Algorithm/Sleep.ts
async function Sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

// src/lib/ericchase/Design Pattern/Observer/Store.ts
class Const {
  value;
  subscriptionSet = new Set();
  constructor(value) {
    this.value = value;
  }
  subscribe(callback) {
    this.subscriptionSet.add(callback);
    if (this.value !== undefined) {
      callback(this.value, () => {
        this.subscriptionSet.delete(callback);
      });
    }
    return () => {
      this.subscriptionSet.delete(callback);
    };
  }
  get() {
    return new Promise((resolve) => {
      this.subscribe((value, unsubscribe) => {
        unsubscribe();
        resolve(value);
      });
    });
  }
  set(value) {
    if (this.value === undefined) {
      this.value = value;
      for (const callback of this.subscriptionSet) {
        callback(value, () => {
          this.subscriptionSet.delete(callback);
        });
      }
    }
  }
}

class Store {
  initialValue;
  notifyOnChangeOnly;
  currentValue;
  subscriptionSet = new Set();
  constructor(initialValue, notifyOnChangeOnly = false) {
    this.initialValue = initialValue;
    this.notifyOnChangeOnly = notifyOnChangeOnly;
    this.currentValue = initialValue;
  }
  subscribe(callback) {
    this.subscriptionSet.add(callback);
    const unsubscribe = () => {
      this.subscriptionSet.delete(callback);
    };
    callback(this.currentValue, unsubscribe);
    return unsubscribe;
  }
  get() {
    return new Promise((resolve) => {
      this.subscribe((value, unsubscribe) => {
        unsubscribe();
        resolve(value);
      });
    });
  }
  set(value) {
    if (this.notifyOnChangeOnly && this.currentValue === value) return;
    this.currentValue = value;
    for (const callback of this.subscriptionSet) {
      callback(value, () => {
        this.subscriptionSet.delete(callback);
      });
    }
  }
  update(callback) {
    this.set(callback(this.currentValue));
  }
}

// src/lib/ericchase/Utility/Console.ts
function ConsoleLog(...items) {
  console['log'](...items);
}
function ConsoleError(...items) {
  console['error'](...items);
}

// src/lib/ericchase/Utility/JobQueue.ts
class JobQueue {
  delay_ms;
  constructor(delay_ms) {
    this.delay_ms = delay_ms;
  }
  async abort() {
    this.aborted = true;
    await this.done;
  }
  add(fn, tag) {
    if (this.aborted === false) {
      this.queue.push({ fn, tag });
      if (this.running === false) {
        this.running = true;
        this.run();
      }
    }
  }
  get done() {
    return new Promise((resolve) => {
      this.runningCount.subscribe((count) => {
        if (count === 0) resolve();
      });
    });
  }
  async reset() {
    if (this.running === true || (await this.runningCount.get()) > 0) {
      throw 'Warning: Wait for running jobs to finish before calling reset. `await JobQueue.done;`';
    }
    this.aborted = false;
    this.completionCount = 0;
    this.queue.length = 0;
    this.queueIndex = 0;
    this.results.length = 0;
  }
  subscribe(callback) {
    this.subscriptionSet.add(callback);
    for (const result of this.results) {
      if (callback(result.value, result.error)?.abort === true) {
        this.subscriptionSet.delete(callback);
        return () => {};
      }
    }
    return () => {
      this.subscriptionSet.delete(callback);
    };
  }
  aborted = false;
  completionCount = 0;
  queue = [];
  queueIndex = 0;
  results = [];
  running = false;
  runningCount = new Store(0);
  subscriptionSet = new Set();
  run() {
    if (this.aborted === false && this.queueIndex < this.queue.length) {
      const { fn, tag } = this.queue[this.queueIndex++];
      (async () => {
        this.runningCount.update((count) => {
          return count + 1;
        });
        try {
          const value = await fn();
          this.send({ value, tag });
        } catch (error) {
          ConsoleLog(error);
          this.send({ error, tag });
        }
        this.runningCount.update((count) => {
          return count - 1;
        });
        if (this.delay_ms < 0) {
          this.run();
        }
      })();
      if (this.delay_ms >= 0) {
        setTimeout(() => this.run(), this.delay_ms);
      }
    } else {
      this.running = false;
    }
  }
  send(result) {
    if (this.aborted === false) {
      this.completionCount++;
      this.results.push(result);
      for (const callback of this.subscriptionSet) {
        if (callback(result.value, result.error, result.tag)?.abort === true) {
          this.subscriptionSet.delete(callback);
        }
      }
    }
  }
}

// src/lib/ericchase/Utility/RecursiveAsyncIterator.ts
class RecursiveIterator {
  fn;
  constructor(fn) {
    this.fn = fn;
  }
  async *iterate(init) {
    const list = [init];
    for (let i = 0; i < list.length; i++) {
      for await (const fSEntry of this.fn(list[i], (value) => {
        list.push(value);
      })) {
        yield fSEntry;
      }
    }
  }
}

// src/lib/ericchase/Web API/DataTransfer.ts
class DataTransferItemIterator {
  list = [];
  constructor(items) {
    if (items instanceof DataTransferItem) {
      this.list = [items];
    } else if (items instanceof DataTransferItemList) {
      this.list = Array.from(items);
    } else if (Array.isArray(items)) {
      this.list = items;
    }
  }
  *getAsEntry() {
    for (const item of this.list) {
      const entry = item.getAsEntry?.() ?? item.webkitGetAsEntry?.();
      if (typeof FileSystemEntry !== 'undefined' && entry instanceof FileSystemEntry) {
        yield entry;
      } else {
        yield entry;
      }
    }
  }
  *getAsFile() {
    for (const item of this.list) {
      const file = item.getAsFile?.();
      if (file instanceof File) {
        yield file;
      }
    }
  }
  async *getAsString() {
    for (const item of this.list) {
      yield await new Promise((resolve, reject) => {
        if (typeof item.getAsString === 'function') {
          item.getAsString(resolve);
        } else {
          reject();
        }
      });
    }
  }
}

// src/lib/ericchase/Algorithm/Array/Uint8Array.ts
function U8Concat(arrays) {
  let totalLength = 0;
  for (const array of arrays) {
    totalLength += array.length;
  }
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const array of arrays) {
    result.set(array, offset);
    offset += array.length;
  }
  return result;
}
function U8FromString(from) {
  return new TextEncoder().encode(from);
}
function U8FromUint32(from) {
  const u8s = new Uint8Array(4);
  const view = new DataView(u8s.buffer);
  view.setUint32(0, from >>> 0, false);
  return u8s;
}
function U8Split(bytes, count) {
  if (count > bytes.byteLength) {
    return [bytes.slice()];
  }
  if (count > 0) {
    const parts = [];
    for (let i = 0; i < bytes.length; i += count) {
      parts.push(bytes.slice(i, i + count));
    }
    return parts;
  }
  return [bytes.slice()];
}
function U8Take(bytes, count) {
  if (count > bytes.byteLength) {
    return [bytes.slice(), new Uint8Array()];
  }
  if (count > 0) {
    const chunkA = bytes.slice(0, count);
    const chunkB = bytes.slice(count);
    return [chunkA, chunkB];
  }
  return [new Uint8Array(), bytes.slice()];
}
function U8ToASCII(bytes) {
  return Array.from(bytes)
    .map((byte) => String.fromCharCode(byte >>> 0))
    .join('');
}
function U8ToHex(bytes) {
  return Array.from(bytes).map((byte) => (byte >>> 0).toString(16).padStart(2, '0'));
}

// src/lib/ericchase/Algorithm/Stream/ReadAll.ts
async function U8StreamReadAll(stream) {
  const reader = stream.getReader();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (value) {
      chunks.push(value);
    }
    if (done) {
      break;
    }
  }
  return U8Concat(chunks);
}

// src/lib/ericchase/Web API/File.ts
function GetWebkitRelativePath(file) {
  if (typeof file.webkitRelativePath !== 'undefined') {
    return file.webkitRelativePath;
  }
}
function GetBytes(file) {
  if (file) {
    if (typeof file.bytes !== 'undefined') {
      return file.bytes();
    }
    return U8StreamReadAll(file.stream());
  }
}

// src/lib/ericchase/Web API/FileSystem_Utility.ts
class FileSystemEntryIterator {
  list = [];
  constructor(entries) {
    if (entries) {
      if (Array.isArray(entries)) {
        this.list = entries;
      } else {
        this.list = [entries];
      }
    }
  }
  *getDirectoryEntry() {
    for (const entry of this.list) {
      if (entry.isDirectory && entry instanceof FileSystemDirectoryEntry) {
        yield entry;
      }
    }
  }
  *getFileEntry() {
    for (const entry of this.list) {
      if (typeof FileSystemFileEntry !== 'undefined' && entry.isFile && entry instanceof FileSystemFileEntry) {
        yield entry;
      } else {
        yield entry;
      }
    }
  }
}

class FileSystemDirectoryEntryIterator {
  list = [];
  constructor(entries) {
    if (entries instanceof FileSystemDirectoryEntry) {
      this.list = [entries];
    } else if (Array.isArray(entries)) {
      this.list = entries;
    }
  }
  async *getEntry() {
    for (const entry of this.list) {
      const reader = entry.createReader();
      for (const entry2 of await new Promise((resolve, reject) => reader.readEntries(resolve, reject))) {
        yield entry2;
      }
    }
  }
}

// src/lib/ericchase/Web API/HTMLInputElement.ts
function GetWebkitEntries(element) {
  return element.webkitEntries ?? undefined;
}
function SupportsWebkitDirectory() {
  return /android|iphone|mobile/i.test(window.navigator.userAgent) === true ? false : true;
}

// src/components/drag-and-drop-file-picker/drag-and-drop-file-picker.ts
function setupDragAndDropFilePicker(container, fn, options) {
  const element = container.querySelector('input');
  if (!element) {
    throw 'drag-and-drop-file-picker input element missing';
  }
  if (options?.accept) {
    element.setAttribute('accept', options.accept);
  }
  if (options?.directory === true && SupportsWebkitDirectory()) {
    element.toggleAttribute('webkitdirectory', true);
  }
  if (options?.multiple === true) {
    element.toggleAttribute('multiple', true);
  }
  if (fn.onDragEnd || fn.onDragEnter || fn.onDragLeave) {
    const removeListeners = () => {
      element.addEventListener('dragleave', dragleaveHandler);
      element.addEventListener('dragend', dragendHandler);
      element.addEventListener('drop', dropHandler2);
    };
    const dragendHandler = () => {
      removeListeners();
      fn.onDragEnd?.();
    };
    const dragleaveHandler = () => {
      removeListeners();
      fn.onDragLeave?.();
    };
    const dropHandler2 = () => {
      removeListeners();
      fn.onDrop?.();
    };
    element.addEventListener('dragenter', () => {
      element.addEventListener('dragleave', dragleaveHandler);
      element.addEventListener('dragend', dragendHandler);
      element.addEventListener('drop', dropHandler2);
      fn.onDragEnter?.();
    });
  }
  const fSEntrySet = new Set();
  const fSEntryIterator = new RecursiveIterator(async function* (fSEntryIterator2, push) {
    for await (const fSEntry of fSEntryIterator2) {
      const path = fSEntry.fullPath.slice(1);
      if (!fSEntrySet.has(path)) {
        fSEntrySet.add(path);
        const fsEntries = new FileSystemEntryIterator(fSEntry);
        for (const fSFileEntry of fsEntries.getFileEntry()) {
          yield fSFileEntry;
        }
        for (const fSDirectoryEntry of fsEntries.getDirectoryEntry()) {
          push(new FileSystemDirectoryEntryIterator(fSDirectoryEntry).getEntry());
        }
      }
    }
  });
  const jobQueue = new JobQueue(-1);
  jobQueue.subscribe((_, error) => {
    if (error) {
      fn?.onUploadError?.(error);
    }
  });
  let done = true;
  let running = false;
  const uploadStart = async () => {
    if (running === false) {
      done = false;
      running = true;
      await fn.onUploadStart?.();
      Sleep(500).then(async () => {
        await jobQueue.done;
        uploadEnd();
      });
    }
  };
  const uploadEnd = async () => {
    done = true;
    running = false;
    await fn.onUploadEnd?.();
    jobQueue.reset();
    fSEntrySet.clear();
  };
  const iterateFSEntries = async (entries, files) => {
    if (done === false) {
      for await (const fSFileEntry of fSEntryIterator.iterate(entries)) {
        const file = await new Promise((resolve, reject) => fSFileEntry.file(resolve, reject));
        await fn.onUploadNextFile(file, () => (done = true));
        if (done === true) return;
      }
      for (const file of files) {
        const path = GetWebkitRelativePath(file) + file.name;
        if (!fSEntrySet.has(path)) {
          fSEntrySet.add(path);
          await fn.onUploadNextFile(file, () => (done = true));
          if (done === true) return;
        }
      }
    }
  };
  const changeHandler = () => {
    jobQueue.add(async () => {
      await uploadStart();
      if (done === false && element instanceof HTMLInputElement && element.files) {
        await iterateFSEntries(GetWebkitEntries(element) ?? [], element.files);
      }
    }, 'changeHandler');
  };
  const dropHandler = (event) => {
    jobQueue.add(async () => {
      await uploadStart();
      if (done === false && event.dataTransfer) {
        const dataTransferItems = new DataTransferItemIterator(event.dataTransfer.items);
        await iterateFSEntries(dataTransferItems.getAsEntry(), event.dataTransfer.files);
      }
    }, 'dropHandler');
  };
  element.addEventListener('change', changeHandler);
  element.addEventListener('drop', dropHandler);
}

// src/lib/ericchase/Algorithm/Math/CRC.ts
var crc_table = new Uint32Array(256);
var crc_magic = new Uint32Array(1);
crc_magic[0] = 3988292384;
for (let n = 0; n < 256; n++) {
  let c = n >>> 0;
  for (let k = 0; k < 8; k++) {
    if (c & 1) {
      c = crc_magic[0] ^ (c >>> 1);
    } else {
      c >>>= 1;
    }
  }
  crc_table[n] = c;
}

class CRC {
  static Init(bytes) {
    return (CRC.Update(4294967295 >>> 0, bytes) ^ (4294967295 >>> 0)) >>> 0;
  }
  static Update(crc, bytes) {
    let c = crc >>> 0;
    for (let n = 0; n < bytes.length; n++) {
      c = crc_table[(c ^ bytes[n]) & 255] ^ (c >>> 8);
    }
    return c >>> 0;
  }
}

// node_modules/pako/dist/pako.esm.mjs
function zero$1(buf) {
  let len = buf.length;
  while (--len >= 0) {
    buf[len] = 0;
  }
}
function StaticTreeDesc(static_tree, extra_bits, extra_base, elems, max_length) {
  this.static_tree = static_tree;
  this.extra_bits = extra_bits;
  this.extra_base = extra_base;
  this.elems = elems;
  this.max_length = max_length;
  this.has_stree = static_tree && static_tree.length;
}
function TreeDesc(dyn_tree, stat_desc) {
  this.dyn_tree = dyn_tree;
  this.max_code = 0;
  this.stat_desc = stat_desc;
}
function Config(good_length, max_lazy, nice_length, max_chain, func) {
  this.good_length = good_length;
  this.max_lazy = max_lazy;
  this.nice_length = nice_length;
  this.max_chain = max_chain;
  this.func = func;
}
function DeflateState() {
  this.strm = null;
  this.status = 0;
  this.pending_buf = null;
  this.pending_buf_size = 0;
  this.pending_out = 0;
  this.pending = 0;
  this.wrap = 0;
  this.gzhead = null;
  this.gzindex = 0;
  this.method = Z_DEFLATED$2;
  this.last_flush = -1;
  this.w_size = 0;
  this.w_bits = 0;
  this.w_mask = 0;
  this.window = null;
  this.window_size = 0;
  this.prev = null;
  this.head = null;
  this.ins_h = 0;
  this.hash_size = 0;
  this.hash_bits = 0;
  this.hash_mask = 0;
  this.hash_shift = 0;
  this.block_start = 0;
  this.match_length = 0;
  this.prev_match = 0;
  this.match_available = 0;
  this.strstart = 0;
  this.match_start = 0;
  this.lookahead = 0;
  this.prev_length = 0;
  this.max_chain_length = 0;
  this.max_lazy_match = 0;
  this.level = 0;
  this.strategy = 0;
  this.good_match = 0;
  this.nice_match = 0;
  this.dyn_ltree = new Uint16Array(HEAP_SIZE * 2);
  this.dyn_dtree = new Uint16Array((2 * D_CODES + 1) * 2);
  this.bl_tree = new Uint16Array((2 * BL_CODES + 1) * 2);
  zero(this.dyn_ltree);
  zero(this.dyn_dtree);
  zero(this.bl_tree);
  this.l_desc = null;
  this.d_desc = null;
  this.bl_desc = null;
  this.bl_count = new Uint16Array(MAX_BITS + 1);
  this.heap = new Uint16Array(2 * L_CODES + 1);
  zero(this.heap);
  this.heap_len = 0;
  this.heap_max = 0;
  this.depth = new Uint16Array(2 * L_CODES + 1);
  zero(this.depth);
  this.sym_buf = 0;
  this.lit_bufsize = 0;
  this.sym_next = 0;
  this.sym_end = 0;
  this.opt_len = 0;
  this.static_len = 0;
  this.matches = 0;
  this.insert = 0;
  this.bi_buf = 0;
  this.bi_valid = 0;
}
function ZStream() {
  this.input = null;
  this.next_in = 0;
  this.avail_in = 0;
  this.total_in = 0;
  this.output = null;
  this.next_out = 0;
  this.avail_out = 0;
  this.total_out = 0;
  this.msg = '';
  this.state = null;
  this.data_type = 2;
  this.adler = 0;
}
function Deflate$1(options) {
  this.options = common.assign(
    {
      level: Z_DEFAULT_COMPRESSION,
      method: Z_DEFLATED$1,
      chunkSize: 16384,
      windowBits: 15,
      memLevel: 8,
      strategy: Z_DEFAULT_STRATEGY,
    },
    options || {},
  );
  let opt = this.options;
  if (opt.raw && opt.windowBits > 0) {
    opt.windowBits = -opt.windowBits;
  } else if (opt.gzip && opt.windowBits > 0 && opt.windowBits < 16) {
    opt.windowBits += 16;
  }
  this.err = 0;
  this.msg = '';
  this.ended = false;
  this.chunks = [];
  this.strm = new zstream();
  this.strm.avail_out = 0;
  let status = deflate_1$2.deflateInit2(this.strm, opt.level, opt.method, opt.windowBits, opt.memLevel, opt.strategy);
  if (status !== Z_OK$2) {
    throw new Error(messages[status]);
  }
  if (opt.header) {
    deflate_1$2.deflateSetHeader(this.strm, opt.header);
  }
  if (opt.dictionary) {
    let dict;
    if (typeof opt.dictionary === 'string') {
      dict = strings.string2buf(opt.dictionary);
    } else if (toString$1.call(opt.dictionary) === '[object ArrayBuffer]') {
      dict = new Uint8Array(opt.dictionary);
    } else {
      dict = opt.dictionary;
    }
    status = deflate_1$2.deflateSetDictionary(this.strm, dict);
    if (status !== Z_OK$2) {
      throw new Error(messages[status]);
    }
    this._dict_set = true;
  }
}
function deflate$1(input, options) {
  const deflator = new Deflate$1(options);
  deflator.push(input, true);
  if (deflator.err) {
    throw deflator.msg || messages[deflator.err];
  }
  return deflator.result;
}
function deflateRaw$1(input, options) {
  options = options || {};
  options.raw = true;
  return deflate$1(input, options);
}
function gzip$1(input, options) {
  options = options || {};
  options.gzip = true;
  return deflate$1(input, options);
}
function InflateState() {
  this.strm = null;
  this.mode = 0;
  this.last = false;
  this.wrap = 0;
  this.havedict = false;
  this.flags = 0;
  this.dmax = 0;
  this.check = 0;
  this.total = 0;
  this.head = null;
  this.wbits = 0;
  this.wsize = 0;
  this.whave = 0;
  this.wnext = 0;
  this.window = null;
  this.hold = 0;
  this.bits = 0;
  this.length = 0;
  this.offset = 0;
  this.extra = 0;
  this.lencode = null;
  this.distcode = null;
  this.lenbits = 0;
  this.distbits = 0;
  this.ncode = 0;
  this.nlen = 0;
  this.ndist = 0;
  this.have = 0;
  this.next = null;
  this.lens = new Uint16Array(320);
  this.work = new Uint16Array(288);
  this.lendyn = null;
  this.distdyn = null;
  this.sane = 0;
  this.back = 0;
  this.was = 0;
}
function GZheader() {
  this.text = 0;
  this.time = 0;
  this.xflags = 0;
  this.os = 0;
  this.extra = null;
  this.extra_len = 0;
  this.name = '';
  this.comment = '';
  this.hcrc = 0;
  this.done = false;
}
function Inflate$1(options) {
  this.options = common.assign(
    {
      chunkSize: 1024 * 64,
      windowBits: 15,
      to: '',
    },
    options || {},
  );
  const opt = this.options;
  if (opt.raw && opt.windowBits >= 0 && opt.windowBits < 16) {
    opt.windowBits = -opt.windowBits;
    if (opt.windowBits === 0) {
      opt.windowBits = -15;
    }
  }
  if (opt.windowBits >= 0 && opt.windowBits < 16 && !(options && options.windowBits)) {
    opt.windowBits += 32;
  }
  if (opt.windowBits > 15 && opt.windowBits < 48) {
    if ((opt.windowBits & 15) === 0) {
      opt.windowBits |= 15;
    }
  }
  this.err = 0;
  this.msg = '';
  this.ended = false;
  this.chunks = [];
  this.strm = new zstream();
  this.strm.avail_out = 0;
  let status = inflate_1$2.inflateInit2(this.strm, opt.windowBits);
  if (status !== Z_OK) {
    throw new Error(messages[status]);
  }
  this.header = new gzheader();
  inflate_1$2.inflateGetHeader(this.strm, this.header);
  if (opt.dictionary) {
    if (typeof opt.dictionary === 'string') {
      opt.dictionary = strings.string2buf(opt.dictionary);
    } else if (toString.call(opt.dictionary) === '[object ArrayBuffer]') {
      opt.dictionary = new Uint8Array(opt.dictionary);
    }
    if (opt.raw) {
      status = inflate_1$2.inflateSetDictionary(this.strm, opt.dictionary);
      if (status !== Z_OK) {
        throw new Error(messages[status]);
      }
    }
  }
}
function inflate$1(input, options) {
  const inflator = new Inflate$1(options);
  inflator.push(input);
  if (inflator.err) throw inflator.msg || messages[inflator.err];
  return inflator.result;
}
function inflateRaw$1(input, options) {
  options = options || {};
  options.raw = true;
  return inflate$1(input, options);
}
/*! pako 2.1.0 https://github.com/nodeca/pako @license (MIT AND Zlib) */
var Z_FIXED$1 = 4;
var Z_BINARY = 0;
var Z_TEXT = 1;
var Z_UNKNOWN$1 = 2;
var STORED_BLOCK = 0;
var STATIC_TREES = 1;
var DYN_TREES = 2;
var MIN_MATCH$1 = 3;
var MAX_MATCH$1 = 258;
var LENGTH_CODES$1 = 29;
var LITERALS$1 = 256;
var L_CODES$1 = LITERALS$1 + 1 + LENGTH_CODES$1;
var D_CODES$1 = 30;
var BL_CODES$1 = 19;
var HEAP_SIZE$1 = 2 * L_CODES$1 + 1;
var MAX_BITS$1 = 15;
var Buf_size = 16;
var MAX_BL_BITS = 7;
var END_BLOCK = 256;
var REP_3_6 = 16;
var REPZ_3_10 = 17;
var REPZ_11_138 = 18;
var extra_lbits = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0]);
var extra_dbits = new Uint8Array([0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13]);
var extra_blbits = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7]);
var bl_order = new Uint8Array([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
var DIST_CODE_LEN = 512;
var static_ltree = new Array((L_CODES$1 + 2) * 2);
zero$1(static_ltree);
var static_dtree = new Array(D_CODES$1 * 2);
zero$1(static_dtree);
var _dist_code = new Array(DIST_CODE_LEN);
zero$1(_dist_code);
var _length_code = new Array(MAX_MATCH$1 - MIN_MATCH$1 + 1);
zero$1(_length_code);
var base_length = new Array(LENGTH_CODES$1);
zero$1(base_length);
var base_dist = new Array(D_CODES$1);
zero$1(base_dist);
var static_l_desc;
var static_d_desc;
var static_bl_desc;
var d_code = (dist) => {
  return dist < 256 ? _dist_code[dist] : _dist_code[256 + (dist >>> 7)];
};
var put_short = (s, w) => {
  s.pending_buf[s.pending++] = w & 255;
  s.pending_buf[s.pending++] = (w >>> 8) & 255;
};
var send_bits = (s, value, length) => {
  if (s.bi_valid > Buf_size - length) {
    s.bi_buf |= (value << s.bi_valid) & 65535;
    put_short(s, s.bi_buf);
    s.bi_buf = value >> (Buf_size - s.bi_valid);
    s.bi_valid += length - Buf_size;
  } else {
    s.bi_buf |= (value << s.bi_valid) & 65535;
    s.bi_valid += length;
  }
};
var send_code = (s, c, tree) => {
  send_bits(s, tree[c * 2], tree[c * 2 + 1]);
};
var bi_reverse = (code, len) => {
  let res = 0;
  do {
    res |= code & 1;
    code >>>= 1;
    res <<= 1;
  } while (--len > 0);
  return res >>> 1;
};
var bi_flush = (s) => {
  if (s.bi_valid === 16) {
    put_short(s, s.bi_buf);
    s.bi_buf = 0;
    s.bi_valid = 0;
  } else if (s.bi_valid >= 8) {
    s.pending_buf[s.pending++] = s.bi_buf & 255;
    s.bi_buf >>= 8;
    s.bi_valid -= 8;
  }
};
var gen_bitlen = (s, desc) => {
  const tree = desc.dyn_tree;
  const max_code = desc.max_code;
  const stree = desc.stat_desc.static_tree;
  const has_stree = desc.stat_desc.has_stree;
  const extra = desc.stat_desc.extra_bits;
  const base = desc.stat_desc.extra_base;
  const max_length = desc.stat_desc.max_length;
  let h;
  let n, m;
  let bits;
  let xbits;
  let f;
  let overflow = 0;
  for (bits = 0; bits <= MAX_BITS$1; bits++) {
    s.bl_count[bits] = 0;
  }
  tree[s.heap[s.heap_max] * 2 + 1] = 0;
  for (h = s.heap_max + 1; h < HEAP_SIZE$1; h++) {
    n = s.heap[h];
    bits = tree[tree[n * 2 + 1] * 2 + 1] + 1;
    if (bits > max_length) {
      bits = max_length;
      overflow++;
    }
    tree[n * 2 + 1] = bits;
    if (n > max_code) {
      continue;
    }
    s.bl_count[bits]++;
    xbits = 0;
    if (n >= base) {
      xbits = extra[n - base];
    }
    f = tree[n * 2];
    s.opt_len += f * (bits + xbits);
    if (has_stree) {
      s.static_len += f * (stree[n * 2 + 1] + xbits);
    }
  }
  if (overflow === 0) {
    return;
  }
  do {
    bits = max_length - 1;
    while (s.bl_count[bits] === 0) {
      bits--;
    }
    s.bl_count[bits]--;
    s.bl_count[bits + 1] += 2;
    s.bl_count[max_length]--;
    overflow -= 2;
  } while (overflow > 0);
  for (bits = max_length; bits !== 0; bits--) {
    n = s.bl_count[bits];
    while (n !== 0) {
      m = s.heap[--h];
      if (m > max_code) {
        continue;
      }
      if (tree[m * 2 + 1] !== bits) {
        s.opt_len += (bits - tree[m * 2 + 1]) * tree[m * 2];
        tree[m * 2 + 1] = bits;
      }
      n--;
    }
  }
};
var gen_codes = (tree, max_code, bl_count) => {
  const next_code = new Array(MAX_BITS$1 + 1);
  let code = 0;
  let bits;
  let n;
  for (bits = 1; bits <= MAX_BITS$1; bits++) {
    code = (code + bl_count[bits - 1]) << 1;
    next_code[bits] = code;
  }
  for (n = 0; n <= max_code; n++) {
    let len = tree[n * 2 + 1];
    if (len === 0) {
      continue;
    }
    tree[n * 2] = bi_reverse(next_code[len]++, len);
  }
};
var tr_static_init = () => {
  let n;
  let bits;
  let length;
  let code;
  let dist;
  const bl_count = new Array(MAX_BITS$1 + 1);
  length = 0;
  for (code = 0; code < LENGTH_CODES$1 - 1; code++) {
    base_length[code] = length;
    for (n = 0; n < 1 << extra_lbits[code]; n++) {
      _length_code[length++] = code;
    }
  }
  _length_code[length - 1] = code;
  dist = 0;
  for (code = 0; code < 16; code++) {
    base_dist[code] = dist;
    for (n = 0; n < 1 << extra_dbits[code]; n++) {
      _dist_code[dist++] = code;
    }
  }
  dist >>= 7;
  for (; code < D_CODES$1; code++) {
    base_dist[code] = dist << 7;
    for (n = 0; n < 1 << (extra_dbits[code] - 7); n++) {
      _dist_code[256 + dist++] = code;
    }
  }
  for (bits = 0; bits <= MAX_BITS$1; bits++) {
    bl_count[bits] = 0;
  }
  n = 0;
  while (n <= 143) {
    static_ltree[n * 2 + 1] = 8;
    n++;
    bl_count[8]++;
  }
  while (n <= 255) {
    static_ltree[n * 2 + 1] = 9;
    n++;
    bl_count[9]++;
  }
  while (n <= 279) {
    static_ltree[n * 2 + 1] = 7;
    n++;
    bl_count[7]++;
  }
  while (n <= 287) {
    static_ltree[n * 2 + 1] = 8;
    n++;
    bl_count[8]++;
  }
  gen_codes(static_ltree, L_CODES$1 + 1, bl_count);
  for (n = 0; n < D_CODES$1; n++) {
    static_dtree[n * 2 + 1] = 5;
    static_dtree[n * 2] = bi_reverse(n, 5);
  }
  static_l_desc = new StaticTreeDesc(static_ltree, extra_lbits, LITERALS$1 + 1, L_CODES$1, MAX_BITS$1);
  static_d_desc = new StaticTreeDesc(static_dtree, extra_dbits, 0, D_CODES$1, MAX_BITS$1);
  static_bl_desc = new StaticTreeDesc(new Array(0), extra_blbits, 0, BL_CODES$1, MAX_BL_BITS);
};
var init_block = (s) => {
  let n;
  for (n = 0; n < L_CODES$1; n++) {
    s.dyn_ltree[n * 2] = 0;
  }
  for (n = 0; n < D_CODES$1; n++) {
    s.dyn_dtree[n * 2] = 0;
  }
  for (n = 0; n < BL_CODES$1; n++) {
    s.bl_tree[n * 2] = 0;
  }
  s.dyn_ltree[END_BLOCK * 2] = 1;
  s.opt_len = s.static_len = 0;
  s.sym_next = s.matches = 0;
};
var bi_windup = (s) => {
  if (s.bi_valid > 8) {
    put_short(s, s.bi_buf);
  } else if (s.bi_valid > 0) {
    s.pending_buf[s.pending++] = s.bi_buf;
  }
  s.bi_buf = 0;
  s.bi_valid = 0;
};
var smaller = (tree, n, m, depth) => {
  const _n2 = n * 2;
  const _m2 = m * 2;
  return tree[_n2] < tree[_m2] || (tree[_n2] === tree[_m2] && depth[n] <= depth[m]);
};
var pqdownheap = (s, tree, k) => {
  const v = s.heap[k];
  let j = k << 1;
  while (j <= s.heap_len) {
    if (j < s.heap_len && smaller(tree, s.heap[j + 1], s.heap[j], s.depth)) {
      j++;
    }
    if (smaller(tree, v, s.heap[j], s.depth)) {
      break;
    }
    s.heap[k] = s.heap[j];
    k = j;
    j <<= 1;
  }
  s.heap[k] = v;
};
var compress_block = (s, ltree, dtree) => {
  let dist;
  let lc;
  let sx = 0;
  let code;
  let extra;
  if (s.sym_next !== 0) {
    do {
      dist = s.pending_buf[s.sym_buf + sx++] & 255;
      dist += (s.pending_buf[s.sym_buf + sx++] & 255) << 8;
      lc = s.pending_buf[s.sym_buf + sx++];
      if (dist === 0) {
        send_code(s, lc, ltree);
      } else {
        code = _length_code[lc];
        send_code(s, code + LITERALS$1 + 1, ltree);
        extra = extra_lbits[code];
        if (extra !== 0) {
          lc -= base_length[code];
          send_bits(s, lc, extra);
        }
        dist--;
        code = d_code(dist);
        send_code(s, code, dtree);
        extra = extra_dbits[code];
        if (extra !== 0) {
          dist -= base_dist[code];
          send_bits(s, dist, extra);
        }
      }
    } while (sx < s.sym_next);
  }
  send_code(s, END_BLOCK, ltree);
};
var build_tree = (s, desc) => {
  const tree = desc.dyn_tree;
  const stree = desc.stat_desc.static_tree;
  const has_stree = desc.stat_desc.has_stree;
  const elems = desc.stat_desc.elems;
  let n, m;
  let max_code = -1;
  let node;
  s.heap_len = 0;
  s.heap_max = HEAP_SIZE$1;
  for (n = 0; n < elems; n++) {
    if (tree[n * 2] !== 0) {
      s.heap[++s.heap_len] = max_code = n;
      s.depth[n] = 0;
    } else {
      tree[n * 2 + 1] = 0;
    }
  }
  while (s.heap_len < 2) {
    node = s.heap[++s.heap_len] = max_code < 2 ? ++max_code : 0;
    tree[node * 2] = 1;
    s.depth[node] = 0;
    s.opt_len--;
    if (has_stree) {
      s.static_len -= stree[node * 2 + 1];
    }
  }
  desc.max_code = max_code;
  for (n = s.heap_len >> 1; n >= 1; n--) {
    pqdownheap(s, tree, n);
  }
  node = elems;
  do {
    n = s.heap[1];
    s.heap[1] = s.heap[s.heap_len--];
    pqdownheap(s, tree, 1);
    m = s.heap[1];
    s.heap[--s.heap_max] = n;
    s.heap[--s.heap_max] = m;
    tree[node * 2] = tree[n * 2] + tree[m * 2];
    s.depth[node] = (s.depth[n] >= s.depth[m] ? s.depth[n] : s.depth[m]) + 1;
    tree[n * 2 + 1] = tree[m * 2 + 1] = node;
    s.heap[1] = node++;
    pqdownheap(s, tree, 1);
  } while (s.heap_len >= 2);
  s.heap[--s.heap_max] = s.heap[1];
  gen_bitlen(s, desc);
  gen_codes(tree, max_code, s.bl_count);
};
var scan_tree = (s, tree, max_code) => {
  let n;
  let prevlen = -1;
  let curlen;
  let nextlen = tree[0 * 2 + 1];
  let count = 0;
  let max_count = 7;
  let min_count = 4;
  if (nextlen === 0) {
    max_count = 138;
    min_count = 3;
  }
  tree[(max_code + 1) * 2 + 1] = 65535;
  for (n = 0; n <= max_code; n++) {
    curlen = nextlen;
    nextlen = tree[(n + 1) * 2 + 1];
    if (++count < max_count && curlen === nextlen) {
      continue;
    } else if (count < min_count) {
      s.bl_tree[curlen * 2] += count;
    } else if (curlen !== 0) {
      if (curlen !== prevlen) {
        s.bl_tree[curlen * 2]++;
      }
      s.bl_tree[REP_3_6 * 2]++;
    } else if (count <= 10) {
      s.bl_tree[REPZ_3_10 * 2]++;
    } else {
      s.bl_tree[REPZ_11_138 * 2]++;
    }
    count = 0;
    prevlen = curlen;
    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;
    } else if (curlen === nextlen) {
      max_count = 6;
      min_count = 3;
    } else {
      max_count = 7;
      min_count = 4;
    }
  }
};
var send_tree = (s, tree, max_code) => {
  let n;
  let prevlen = -1;
  let curlen;
  let nextlen = tree[0 * 2 + 1];
  let count = 0;
  let max_count = 7;
  let min_count = 4;
  if (nextlen === 0) {
    max_count = 138;
    min_count = 3;
  }
  for (n = 0; n <= max_code; n++) {
    curlen = nextlen;
    nextlen = tree[(n + 1) * 2 + 1];
    if (++count < max_count && curlen === nextlen) {
      continue;
    } else if (count < min_count) {
      do {
        send_code(s, curlen, s.bl_tree);
      } while (--count !== 0);
    } else if (curlen !== 0) {
      if (curlen !== prevlen) {
        send_code(s, curlen, s.bl_tree);
        count--;
      }
      send_code(s, REP_3_6, s.bl_tree);
      send_bits(s, count - 3, 2);
    } else if (count <= 10) {
      send_code(s, REPZ_3_10, s.bl_tree);
      send_bits(s, count - 3, 3);
    } else {
      send_code(s, REPZ_11_138, s.bl_tree);
      send_bits(s, count - 11, 7);
    }
    count = 0;
    prevlen = curlen;
    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;
    } else if (curlen === nextlen) {
      max_count = 6;
      min_count = 3;
    } else {
      max_count = 7;
      min_count = 4;
    }
  }
};
var build_bl_tree = (s) => {
  let max_blindex;
  scan_tree(s, s.dyn_ltree, s.l_desc.max_code);
  scan_tree(s, s.dyn_dtree, s.d_desc.max_code);
  build_tree(s, s.bl_desc);
  for (max_blindex = BL_CODES$1 - 1; max_blindex >= 3; max_blindex--) {
    if (s.bl_tree[bl_order[max_blindex] * 2 + 1] !== 0) {
      break;
    }
  }
  s.opt_len += 3 * (max_blindex + 1) + 5 + 5 + 4;
  return max_blindex;
};
var send_all_trees = (s, lcodes, dcodes, blcodes) => {
  let rank;
  send_bits(s, lcodes - 257, 5);
  send_bits(s, dcodes - 1, 5);
  send_bits(s, blcodes - 4, 4);
  for (rank = 0; rank < blcodes; rank++) {
    send_bits(s, s.bl_tree[bl_order[rank] * 2 + 1], 3);
  }
  send_tree(s, s.dyn_ltree, lcodes - 1);
  send_tree(s, s.dyn_dtree, dcodes - 1);
};
var detect_data_type = (s) => {
  let block_mask = 4093624447;
  let n;
  for (n = 0; n <= 31; n++, block_mask >>>= 1) {
    if (block_mask & 1 && s.dyn_ltree[n * 2] !== 0) {
      return Z_BINARY;
    }
  }
  if (s.dyn_ltree[9 * 2] !== 0 || s.dyn_ltree[10 * 2] !== 0 || s.dyn_ltree[13 * 2] !== 0) {
    return Z_TEXT;
  }
  for (n = 32; n < LITERALS$1; n++) {
    if (s.dyn_ltree[n * 2] !== 0) {
      return Z_TEXT;
    }
  }
  return Z_BINARY;
};
var static_init_done = false;
var _tr_init$1 = (s) => {
  if (!static_init_done) {
    tr_static_init();
    static_init_done = true;
  }
  s.l_desc = new TreeDesc(s.dyn_ltree, static_l_desc);
  s.d_desc = new TreeDesc(s.dyn_dtree, static_d_desc);
  s.bl_desc = new TreeDesc(s.bl_tree, static_bl_desc);
  s.bi_buf = 0;
  s.bi_valid = 0;
  init_block(s);
};
var _tr_stored_block$1 = (s, buf, stored_len, last) => {
  send_bits(s, (STORED_BLOCK << 1) + (last ? 1 : 0), 3);
  bi_windup(s);
  put_short(s, stored_len);
  put_short(s, ~stored_len);
  if (stored_len) {
    s.pending_buf.set(s.window.subarray(buf, buf + stored_len), s.pending);
  }
  s.pending += stored_len;
};
var _tr_align$1 = (s) => {
  send_bits(s, STATIC_TREES << 1, 3);
  send_code(s, END_BLOCK, static_ltree);
  bi_flush(s);
};
var _tr_flush_block$1 = (s, buf, stored_len, last) => {
  let opt_lenb, static_lenb;
  let max_blindex = 0;
  if (s.level > 0) {
    if (s.strm.data_type === Z_UNKNOWN$1) {
      s.strm.data_type = detect_data_type(s);
    }
    build_tree(s, s.l_desc);
    build_tree(s, s.d_desc);
    max_blindex = build_bl_tree(s);
    opt_lenb = (s.opt_len + 3 + 7) >>> 3;
    static_lenb = (s.static_len + 3 + 7) >>> 3;
    if (static_lenb <= opt_lenb) {
      opt_lenb = static_lenb;
    }
  } else {
    opt_lenb = static_lenb = stored_len + 5;
  }
  if (stored_len + 4 <= opt_lenb && buf !== -1) {
    _tr_stored_block$1(s, buf, stored_len, last);
  } else if (s.strategy === Z_FIXED$1 || static_lenb === opt_lenb) {
    send_bits(s, (STATIC_TREES << 1) + (last ? 1 : 0), 3);
    compress_block(s, static_ltree, static_dtree);
  } else {
    send_bits(s, (DYN_TREES << 1) + (last ? 1 : 0), 3);
    send_all_trees(s, s.l_desc.max_code + 1, s.d_desc.max_code + 1, max_blindex + 1);
    compress_block(s, s.dyn_ltree, s.dyn_dtree);
  }
  init_block(s);
  if (last) {
    bi_windup(s);
  }
};
var _tr_tally$1 = (s, dist, lc) => {
  s.pending_buf[s.sym_buf + s.sym_next++] = dist;
  s.pending_buf[s.sym_buf + s.sym_next++] = dist >> 8;
  s.pending_buf[s.sym_buf + s.sym_next++] = lc;
  if (dist === 0) {
    s.dyn_ltree[lc * 2]++;
  } else {
    s.matches++;
    dist--;
    s.dyn_ltree[(_length_code[lc] + LITERALS$1 + 1) * 2]++;
    s.dyn_dtree[d_code(dist) * 2]++;
  }
  return s.sym_next === s.sym_end;
};
var _tr_init_1 = _tr_init$1;
var _tr_stored_block_1 = _tr_stored_block$1;
var _tr_flush_block_1 = _tr_flush_block$1;
var _tr_tally_1 = _tr_tally$1;
var _tr_align_1 = _tr_align$1;
var trees = {
  _tr_init: _tr_init_1,
  _tr_stored_block: _tr_stored_block_1,
  _tr_flush_block: _tr_flush_block_1,
  _tr_tally: _tr_tally_1,
  _tr_align: _tr_align_1,
};
var adler32 = (adler, buf, len, pos) => {
  let s1 = (adler & 65535) | 0,
    s2 = ((adler >>> 16) & 65535) | 0,
    n = 0;
  while (len !== 0) {
    n = len > 2000 ? 2000 : len;
    len -= n;
    do {
      s1 = (s1 + buf[pos++]) | 0;
      s2 = (s2 + s1) | 0;
    } while (--n);
    s1 %= 65521;
    s2 %= 65521;
  }
  return s1 | (s2 << 16) | 0;
};
var adler32_1 = adler32;
var makeTable = () => {
  let c,
    table = [];
  for (var n = 0; n < 256; n++) {
    c = n;
    for (var k = 0; k < 8; k++) {
      c = c & 1 ? 3988292384 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
};
var crcTable = new Uint32Array(makeTable());
var crc32 = (crc, buf, len, pos) => {
  const t = crcTable;
  const end = pos + len;
  crc ^= -1;
  for (let i = pos; i < end; i++) {
    crc = (crc >>> 8) ^ t[(crc ^ buf[i]) & 255];
  }
  return crc ^ -1;
};
var crc32_1 = crc32;
var messages = {
  2: 'need dictionary',
  1: 'stream end',
  0: '',
  '-1': 'file error',
  '-2': 'stream error',
  '-3': 'data error',
  '-4': 'insufficient memory',
  '-5': 'buffer error',
  '-6': 'incompatible version',
};
var constants$2 = {
  Z_NO_FLUSH: 0,
  Z_PARTIAL_FLUSH: 1,
  Z_SYNC_FLUSH: 2,
  Z_FULL_FLUSH: 3,
  Z_FINISH: 4,
  Z_BLOCK: 5,
  Z_TREES: 6,
  Z_OK: 0,
  Z_STREAM_END: 1,
  Z_NEED_DICT: 2,
  Z_ERRNO: -1,
  Z_STREAM_ERROR: -2,
  Z_DATA_ERROR: -3,
  Z_MEM_ERROR: -4,
  Z_BUF_ERROR: -5,
  Z_NO_COMPRESSION: 0,
  Z_BEST_SPEED: 1,
  Z_BEST_COMPRESSION: 9,
  Z_DEFAULT_COMPRESSION: -1,
  Z_FILTERED: 1,
  Z_HUFFMAN_ONLY: 2,
  Z_RLE: 3,
  Z_FIXED: 4,
  Z_DEFAULT_STRATEGY: 0,
  Z_BINARY: 0,
  Z_TEXT: 1,
  Z_UNKNOWN: 2,
  Z_DEFLATED: 8,
};
var { _tr_init, _tr_stored_block, _tr_flush_block, _tr_tally, _tr_align } = trees;
var { Z_NO_FLUSH: Z_NO_FLUSH$2, Z_PARTIAL_FLUSH, Z_FULL_FLUSH: Z_FULL_FLUSH$1, Z_FINISH: Z_FINISH$3, Z_BLOCK: Z_BLOCK$1, Z_OK: Z_OK$3, Z_STREAM_END: Z_STREAM_END$3, Z_STREAM_ERROR: Z_STREAM_ERROR$2, Z_DATA_ERROR: Z_DATA_ERROR$2, Z_BUF_ERROR: Z_BUF_ERROR$1, Z_DEFAULT_COMPRESSION: Z_DEFAULT_COMPRESSION$1, Z_FILTERED, Z_HUFFMAN_ONLY, Z_RLE, Z_FIXED, Z_DEFAULT_STRATEGY: Z_DEFAULT_STRATEGY$1, Z_UNKNOWN, Z_DEFLATED: Z_DEFLATED$2 } = constants$2;
var MAX_MEM_LEVEL = 9;
var MAX_WBITS$1 = 15;
var DEF_MEM_LEVEL = 8;
var LENGTH_CODES = 29;
var LITERALS = 256;
var L_CODES = LITERALS + 1 + LENGTH_CODES;
var D_CODES = 30;
var BL_CODES = 19;
var HEAP_SIZE = 2 * L_CODES + 1;
var MAX_BITS = 15;
var MIN_MATCH = 3;
var MAX_MATCH = 258;
var MIN_LOOKAHEAD = MAX_MATCH + MIN_MATCH + 1;
var PRESET_DICT = 32;
var INIT_STATE = 42;
var GZIP_STATE = 57;
var EXTRA_STATE = 69;
var NAME_STATE = 73;
var COMMENT_STATE = 91;
var HCRC_STATE = 103;
var BUSY_STATE = 113;
var FINISH_STATE = 666;
var BS_NEED_MORE = 1;
var BS_BLOCK_DONE = 2;
var BS_FINISH_STARTED = 3;
var BS_FINISH_DONE = 4;
var OS_CODE = 3;
var err = (strm, errorCode) => {
  strm.msg = messages[errorCode];
  return errorCode;
};
var rank = (f) => {
  return f * 2 - (f > 4 ? 9 : 0);
};
var zero = (buf) => {
  let len = buf.length;
  while (--len >= 0) {
    buf[len] = 0;
  }
};
var slide_hash = (s) => {
  let n, m;
  let p;
  let wsize = s.w_size;
  n = s.hash_size;
  p = n;
  do {
    m = s.head[--p];
    s.head[p] = m >= wsize ? m - wsize : 0;
  } while (--n);
  n = wsize;
  p = n;
  do {
    m = s.prev[--p];
    s.prev[p] = m >= wsize ? m - wsize : 0;
  } while (--n);
};
var HASH_ZLIB = (s, prev, data) => ((prev << s.hash_shift) ^ data) & s.hash_mask;
var HASH = HASH_ZLIB;
var flush_pending = (strm) => {
  const s = strm.state;
  let len = s.pending;
  if (len > strm.avail_out) {
    len = strm.avail_out;
  }
  if (len === 0) {
    return;
  }
  strm.output.set(s.pending_buf.subarray(s.pending_out, s.pending_out + len), strm.next_out);
  strm.next_out += len;
  s.pending_out += len;
  strm.total_out += len;
  strm.avail_out -= len;
  s.pending -= len;
  if (s.pending === 0) {
    s.pending_out = 0;
  }
};
var flush_block_only = (s, last) => {
  _tr_flush_block(s, s.block_start >= 0 ? s.block_start : -1, s.strstart - s.block_start, last);
  s.block_start = s.strstart;
  flush_pending(s.strm);
};
var put_byte = (s, b) => {
  s.pending_buf[s.pending++] = b;
};
var putShortMSB = (s, b) => {
  s.pending_buf[s.pending++] = (b >>> 8) & 255;
  s.pending_buf[s.pending++] = b & 255;
};
var read_buf = (strm, buf, start, size) => {
  let len = strm.avail_in;
  if (len > size) {
    len = size;
  }
  if (len === 0) {
    return 0;
  }
  strm.avail_in -= len;
  buf.set(strm.input.subarray(strm.next_in, strm.next_in + len), start);
  if (strm.state.wrap === 1) {
    strm.adler = adler32_1(strm.adler, buf, len, start);
  } else if (strm.state.wrap === 2) {
    strm.adler = crc32_1(strm.adler, buf, len, start);
  }
  strm.next_in += len;
  strm.total_in += len;
  return len;
};
var longest_match = (s, cur_match) => {
  let chain_length = s.max_chain_length;
  let scan = s.strstart;
  let match;
  let len;
  let best_len = s.prev_length;
  let nice_match = s.nice_match;
  const limit = s.strstart > s.w_size - MIN_LOOKAHEAD ? s.strstart - (s.w_size - MIN_LOOKAHEAD) : 0;
  const _win = s.window;
  const wmask = s.w_mask;
  const prev = s.prev;
  const strend = s.strstart + MAX_MATCH;
  let scan_end1 = _win[scan + best_len - 1];
  let scan_end = _win[scan + best_len];
  if (s.prev_length >= s.good_match) {
    chain_length >>= 2;
  }
  if (nice_match > s.lookahead) {
    nice_match = s.lookahead;
  }
  do {
    match = cur_match;
    if (_win[match + best_len] !== scan_end || _win[match + best_len - 1] !== scan_end1 || _win[match] !== _win[scan] || _win[++match] !== _win[scan + 1]) {
      continue;
    }
    scan += 2;
    match++;
    do {} while (_win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && scan < strend);
    len = MAX_MATCH - (strend - scan);
    scan = strend - MAX_MATCH;
    if (len > best_len) {
      s.match_start = cur_match;
      best_len = len;
      if (len >= nice_match) {
        break;
      }
      scan_end1 = _win[scan + best_len - 1];
      scan_end = _win[scan + best_len];
    }
  } while ((cur_match = prev[cur_match & wmask]) > limit && --chain_length !== 0);
  if (best_len <= s.lookahead) {
    return best_len;
  }
  return s.lookahead;
};
var fill_window = (s) => {
  const _w_size = s.w_size;
  let n, more, str;
  do {
    more = s.window_size - s.lookahead - s.strstart;
    if (s.strstart >= _w_size + (_w_size - MIN_LOOKAHEAD)) {
      s.window.set(s.window.subarray(_w_size, _w_size + _w_size - more), 0);
      s.match_start -= _w_size;
      s.strstart -= _w_size;
      s.block_start -= _w_size;
      if (s.insert > s.strstart) {
        s.insert = s.strstart;
      }
      slide_hash(s);
      more += _w_size;
    }
    if (s.strm.avail_in === 0) {
      break;
    }
    n = read_buf(s.strm, s.window, s.strstart + s.lookahead, more);
    s.lookahead += n;
    if (s.lookahead + s.insert >= MIN_MATCH) {
      str = s.strstart - s.insert;
      s.ins_h = s.window[str];
      s.ins_h = HASH(s, s.ins_h, s.window[str + 1]);
      while (s.insert) {
        s.ins_h = HASH(s, s.ins_h, s.window[str + MIN_MATCH - 1]);
        s.prev[str & s.w_mask] = s.head[s.ins_h];
        s.head[s.ins_h] = str;
        str++;
        s.insert--;
        if (s.lookahead + s.insert < MIN_MATCH) {
          break;
        }
      }
    }
  } while (s.lookahead < MIN_LOOKAHEAD && s.strm.avail_in !== 0);
};
var deflate_stored = (s, flush) => {
  let min_block = s.pending_buf_size - 5 > s.w_size ? s.w_size : s.pending_buf_size - 5;
  let len,
    left,
    have,
    last = 0;
  let used = s.strm.avail_in;
  do {
    len = 65535;
    have = (s.bi_valid + 42) >> 3;
    if (s.strm.avail_out < have) {
      break;
    }
    have = s.strm.avail_out - have;
    left = s.strstart - s.block_start;
    if (len > left + s.strm.avail_in) {
      len = left + s.strm.avail_in;
    }
    if (len > have) {
      len = have;
    }
    if (len < min_block && ((len === 0 && flush !== Z_FINISH$3) || flush === Z_NO_FLUSH$2 || len !== left + s.strm.avail_in)) {
      break;
    }
    last = flush === Z_FINISH$3 && len === left + s.strm.avail_in ? 1 : 0;
    _tr_stored_block(s, 0, 0, last);
    s.pending_buf[s.pending - 4] = len;
    s.pending_buf[s.pending - 3] = len >> 8;
    s.pending_buf[s.pending - 2] = ~len;
    s.pending_buf[s.pending - 1] = ~len >> 8;
    flush_pending(s.strm);
    if (left) {
      if (left > len) {
        left = len;
      }
      s.strm.output.set(s.window.subarray(s.block_start, s.block_start + left), s.strm.next_out);
      s.strm.next_out += left;
      s.strm.avail_out -= left;
      s.strm.total_out += left;
      s.block_start += left;
      len -= left;
    }
    if (len) {
      read_buf(s.strm, s.strm.output, s.strm.next_out, len);
      s.strm.next_out += len;
      s.strm.avail_out -= len;
      s.strm.total_out += len;
    }
  } while (last === 0);
  used -= s.strm.avail_in;
  if (used) {
    if (used >= s.w_size) {
      s.matches = 2;
      s.window.set(s.strm.input.subarray(s.strm.next_in - s.w_size, s.strm.next_in), 0);
      s.strstart = s.w_size;
      s.insert = s.strstart;
    } else {
      if (s.window_size - s.strstart <= used) {
        s.strstart -= s.w_size;
        s.window.set(s.window.subarray(s.w_size, s.w_size + s.strstart), 0);
        if (s.matches < 2) {
          s.matches++;
        }
        if (s.insert > s.strstart) {
          s.insert = s.strstart;
        }
      }
      s.window.set(s.strm.input.subarray(s.strm.next_in - used, s.strm.next_in), s.strstart);
      s.strstart += used;
      s.insert += used > s.w_size - s.insert ? s.w_size - s.insert : used;
    }
    s.block_start = s.strstart;
  }
  if (s.high_water < s.strstart) {
    s.high_water = s.strstart;
  }
  if (last) {
    return BS_FINISH_DONE;
  }
  if (flush !== Z_NO_FLUSH$2 && flush !== Z_FINISH$3 && s.strm.avail_in === 0 && s.strstart === s.block_start) {
    return BS_BLOCK_DONE;
  }
  have = s.window_size - s.strstart;
  if (s.strm.avail_in > have && s.block_start >= s.w_size) {
    s.block_start -= s.w_size;
    s.strstart -= s.w_size;
    s.window.set(s.window.subarray(s.w_size, s.w_size + s.strstart), 0);
    if (s.matches < 2) {
      s.matches++;
    }
    have += s.w_size;
    if (s.insert > s.strstart) {
      s.insert = s.strstart;
    }
  }
  if (have > s.strm.avail_in) {
    have = s.strm.avail_in;
  }
  if (have) {
    read_buf(s.strm, s.window, s.strstart, have);
    s.strstart += have;
    s.insert += have > s.w_size - s.insert ? s.w_size - s.insert : have;
  }
  if (s.high_water < s.strstart) {
    s.high_water = s.strstart;
  }
  have = (s.bi_valid + 42) >> 3;
  have = s.pending_buf_size - have > 65535 ? 65535 : s.pending_buf_size - have;
  min_block = have > s.w_size ? s.w_size : have;
  left = s.strstart - s.block_start;
  if (left >= min_block || ((left || flush === Z_FINISH$3) && flush !== Z_NO_FLUSH$2 && s.strm.avail_in === 0 && left <= have)) {
    len = left > have ? have : left;
    last = flush === Z_FINISH$3 && s.strm.avail_in === 0 && len === left ? 1 : 0;
    _tr_stored_block(s, s.block_start, len, last);
    s.block_start += len;
    flush_pending(s.strm);
  }
  return last ? BS_FINISH_STARTED : BS_NEED_MORE;
};
var deflate_fast = (s, flush) => {
  let hash_head;
  let bflush;
  for (;;) {
    if (s.lookahead < MIN_LOOKAHEAD) {
      fill_window(s);
      if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH$2) {
        return BS_NEED_MORE;
      }
      if (s.lookahead === 0) {
        break;
      }
    }
    hash_head = 0;
    if (s.lookahead >= MIN_MATCH) {
      s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + MIN_MATCH - 1]);
      hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
      s.head[s.ins_h] = s.strstart;
    }
    if (hash_head !== 0 && s.strstart - hash_head <= s.w_size - MIN_LOOKAHEAD) {
      s.match_length = longest_match(s, hash_head);
    }
    if (s.match_length >= MIN_MATCH) {
      bflush = _tr_tally(s, s.strstart - s.match_start, s.match_length - MIN_MATCH);
      s.lookahead -= s.match_length;
      if (s.match_length <= s.max_lazy_match && s.lookahead >= MIN_MATCH) {
        s.match_length--;
        do {
          s.strstart++;
          s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + MIN_MATCH - 1]);
          hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
          s.head[s.ins_h] = s.strstart;
        } while (--s.match_length !== 0);
        s.strstart++;
      } else {
        s.strstart += s.match_length;
        s.match_length = 0;
        s.ins_h = s.window[s.strstart];
        s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + 1]);
      }
    } else {
      bflush = _tr_tally(s, 0, s.window[s.strstart]);
      s.lookahead--;
      s.strstart++;
    }
    if (bflush) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
  }
  s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1;
  if (flush === Z_FINISH$3) {
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    return BS_FINISH_DONE;
  }
  if (s.sym_next) {
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
  }
  return BS_BLOCK_DONE;
};
var deflate_slow = (s, flush) => {
  let hash_head;
  let bflush;
  let max_insert;
  for (;;) {
    if (s.lookahead < MIN_LOOKAHEAD) {
      fill_window(s);
      if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH$2) {
        return BS_NEED_MORE;
      }
      if (s.lookahead === 0) {
        break;
      }
    }
    hash_head = 0;
    if (s.lookahead >= MIN_MATCH) {
      s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + MIN_MATCH - 1]);
      hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
      s.head[s.ins_h] = s.strstart;
    }
    s.prev_length = s.match_length;
    s.prev_match = s.match_start;
    s.match_length = MIN_MATCH - 1;
    if (hash_head !== 0 && s.prev_length < s.max_lazy_match && s.strstart - hash_head <= s.w_size - MIN_LOOKAHEAD) {
      s.match_length = longest_match(s, hash_head);
      if (s.match_length <= 5 && (s.strategy === Z_FILTERED || (s.match_length === MIN_MATCH && s.strstart - s.match_start > 4096))) {
        s.match_length = MIN_MATCH - 1;
      }
    }
    if (s.prev_length >= MIN_MATCH && s.match_length <= s.prev_length) {
      max_insert = s.strstart + s.lookahead - MIN_MATCH;
      bflush = _tr_tally(s, s.strstart - 1 - s.prev_match, s.prev_length - MIN_MATCH);
      s.lookahead -= s.prev_length - 1;
      s.prev_length -= 2;
      do {
        if (++s.strstart <= max_insert) {
          s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + MIN_MATCH - 1]);
          hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
          s.head[s.ins_h] = s.strstart;
        }
      } while (--s.prev_length !== 0);
      s.match_available = 0;
      s.match_length = MIN_MATCH - 1;
      s.strstart++;
      if (bflush) {
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
      }
    } else if (s.match_available) {
      bflush = _tr_tally(s, 0, s.window[s.strstart - 1]);
      if (bflush) {
        flush_block_only(s, false);
      }
      s.strstart++;
      s.lookahead--;
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    } else {
      s.match_available = 1;
      s.strstart++;
      s.lookahead--;
    }
  }
  if (s.match_available) {
    bflush = _tr_tally(s, 0, s.window[s.strstart - 1]);
    s.match_available = 0;
  }
  s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1;
  if (flush === Z_FINISH$3) {
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    return BS_FINISH_DONE;
  }
  if (s.sym_next) {
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
  }
  return BS_BLOCK_DONE;
};
var deflate_rle = (s, flush) => {
  let bflush;
  let prev;
  let scan, strend;
  const _win = s.window;
  for (;;) {
    if (s.lookahead <= MAX_MATCH) {
      fill_window(s);
      if (s.lookahead <= MAX_MATCH && flush === Z_NO_FLUSH$2) {
        return BS_NEED_MORE;
      }
      if (s.lookahead === 0) {
        break;
      }
    }
    s.match_length = 0;
    if (s.lookahead >= MIN_MATCH && s.strstart > 0) {
      scan = s.strstart - 1;
      prev = _win[scan];
      if (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan]) {
        strend = s.strstart + MAX_MATCH;
        do {} while (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && scan < strend);
        s.match_length = MAX_MATCH - (strend - scan);
        if (s.match_length > s.lookahead) {
          s.match_length = s.lookahead;
        }
      }
    }
    if (s.match_length >= MIN_MATCH) {
      bflush = _tr_tally(s, 1, s.match_length - MIN_MATCH);
      s.lookahead -= s.match_length;
      s.strstart += s.match_length;
      s.match_length = 0;
    } else {
      bflush = _tr_tally(s, 0, s.window[s.strstart]);
      s.lookahead--;
      s.strstart++;
    }
    if (bflush) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
  }
  s.insert = 0;
  if (flush === Z_FINISH$3) {
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    return BS_FINISH_DONE;
  }
  if (s.sym_next) {
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
  }
  return BS_BLOCK_DONE;
};
var deflate_huff = (s, flush) => {
  let bflush;
  for (;;) {
    if (s.lookahead === 0) {
      fill_window(s);
      if (s.lookahead === 0) {
        if (flush === Z_NO_FLUSH$2) {
          return BS_NEED_MORE;
        }
        break;
      }
    }
    s.match_length = 0;
    bflush = _tr_tally(s, 0, s.window[s.strstart]);
    s.lookahead--;
    s.strstart++;
    if (bflush) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
  }
  s.insert = 0;
  if (flush === Z_FINISH$3) {
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    return BS_FINISH_DONE;
  }
  if (s.sym_next) {
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
  }
  return BS_BLOCK_DONE;
};
var configuration_table = [new Config(0, 0, 0, 0, deflate_stored), new Config(4, 4, 8, 4, deflate_fast), new Config(4, 5, 16, 8, deflate_fast), new Config(4, 6, 32, 32, deflate_fast), new Config(4, 4, 16, 16, deflate_slow), new Config(8, 16, 32, 32, deflate_slow), new Config(8, 16, 128, 128, deflate_slow), new Config(8, 32, 128, 256, deflate_slow), new Config(32, 128, 258, 1024, deflate_slow), new Config(32, 258, 258, 4096, deflate_slow)];
var lm_init = (s) => {
  s.window_size = 2 * s.w_size;
  zero(s.head);
  s.max_lazy_match = configuration_table[s.level].max_lazy;
  s.good_match = configuration_table[s.level].good_length;
  s.nice_match = configuration_table[s.level].nice_length;
  s.max_chain_length = configuration_table[s.level].max_chain;
  s.strstart = 0;
  s.block_start = 0;
  s.lookahead = 0;
  s.insert = 0;
  s.match_length = s.prev_length = MIN_MATCH - 1;
  s.match_available = 0;
  s.ins_h = 0;
};
var deflateStateCheck = (strm) => {
  if (!strm) {
    return 1;
  }
  const s = strm.state;
  if (!s || s.strm !== strm || (s.status !== INIT_STATE && s.status !== GZIP_STATE && s.status !== EXTRA_STATE && s.status !== NAME_STATE && s.status !== COMMENT_STATE && s.status !== HCRC_STATE && s.status !== BUSY_STATE && s.status !== FINISH_STATE)) {
    return 1;
  }
  return 0;
};
var deflateResetKeep = (strm) => {
  if (deflateStateCheck(strm)) {
    return err(strm, Z_STREAM_ERROR$2);
  }
  strm.total_in = strm.total_out = 0;
  strm.data_type = Z_UNKNOWN;
  const s = strm.state;
  s.pending = 0;
  s.pending_out = 0;
  if (s.wrap < 0) {
    s.wrap = -s.wrap;
  }
  s.status = s.wrap === 2 ? GZIP_STATE : s.wrap ? INIT_STATE : BUSY_STATE;
  strm.adler = s.wrap === 2 ? 0 : 1;
  s.last_flush = -2;
  _tr_init(s);
  return Z_OK$3;
};
var deflateReset = (strm) => {
  const ret = deflateResetKeep(strm);
  if (ret === Z_OK$3) {
    lm_init(strm.state);
  }
  return ret;
};
var deflateSetHeader = (strm, head) => {
  if (deflateStateCheck(strm) || strm.state.wrap !== 2) {
    return Z_STREAM_ERROR$2;
  }
  strm.state.gzhead = head;
  return Z_OK$3;
};
var deflateInit2 = (strm, level, method, windowBits, memLevel, strategy) => {
  if (!strm) {
    return Z_STREAM_ERROR$2;
  }
  let wrap = 1;
  if (level === Z_DEFAULT_COMPRESSION$1) {
    level = 6;
  }
  if (windowBits < 0) {
    wrap = 0;
    windowBits = -windowBits;
  } else if (windowBits > 15) {
    wrap = 2;
    windowBits -= 16;
  }
  if (memLevel < 1 || memLevel > MAX_MEM_LEVEL || method !== Z_DEFLATED$2 || windowBits < 8 || windowBits > 15 || level < 0 || level > 9 || strategy < 0 || strategy > Z_FIXED || (windowBits === 8 && wrap !== 1)) {
    return err(strm, Z_STREAM_ERROR$2);
  }
  if (windowBits === 8) {
    windowBits = 9;
  }
  const s = new DeflateState();
  strm.state = s;
  s.strm = strm;
  s.status = INIT_STATE;
  s.wrap = wrap;
  s.gzhead = null;
  s.w_bits = windowBits;
  s.w_size = 1 << s.w_bits;
  s.w_mask = s.w_size - 1;
  s.hash_bits = memLevel + 7;
  s.hash_size = 1 << s.hash_bits;
  s.hash_mask = s.hash_size - 1;
  s.hash_shift = ~~((s.hash_bits + MIN_MATCH - 1) / MIN_MATCH);
  s.window = new Uint8Array(s.w_size * 2);
  s.head = new Uint16Array(s.hash_size);
  s.prev = new Uint16Array(s.w_size);
  s.lit_bufsize = 1 << (memLevel + 6);
  s.pending_buf_size = s.lit_bufsize * 4;
  s.pending_buf = new Uint8Array(s.pending_buf_size);
  s.sym_buf = s.lit_bufsize;
  s.sym_end = (s.lit_bufsize - 1) * 3;
  s.level = level;
  s.strategy = strategy;
  s.method = method;
  return deflateReset(strm);
};
var deflateInit = (strm, level) => {
  return deflateInit2(strm, level, Z_DEFLATED$2, MAX_WBITS$1, DEF_MEM_LEVEL, Z_DEFAULT_STRATEGY$1);
};
var deflate$2 = (strm, flush) => {
  if (deflateStateCheck(strm) || flush > Z_BLOCK$1 || flush < 0) {
    return strm ? err(strm, Z_STREAM_ERROR$2) : Z_STREAM_ERROR$2;
  }
  const s = strm.state;
  if (!strm.output || (strm.avail_in !== 0 && !strm.input) || (s.status === FINISH_STATE && flush !== Z_FINISH$3)) {
    return err(strm, strm.avail_out === 0 ? Z_BUF_ERROR$1 : Z_STREAM_ERROR$2);
  }
  const old_flush = s.last_flush;
  s.last_flush = flush;
  if (s.pending !== 0) {
    flush_pending(strm);
    if (strm.avail_out === 0) {
      s.last_flush = -1;
      return Z_OK$3;
    }
  } else if (strm.avail_in === 0 && rank(flush) <= rank(old_flush) && flush !== Z_FINISH$3) {
    return err(strm, Z_BUF_ERROR$1);
  }
  if (s.status === FINISH_STATE && strm.avail_in !== 0) {
    return err(strm, Z_BUF_ERROR$1);
  }
  if (s.status === INIT_STATE && s.wrap === 0) {
    s.status = BUSY_STATE;
  }
  if (s.status === INIT_STATE) {
    let header = (Z_DEFLATED$2 + ((s.w_bits - 8) << 4)) << 8;
    let level_flags = -1;
    if (s.strategy >= Z_HUFFMAN_ONLY || s.level < 2) {
      level_flags = 0;
    } else if (s.level < 6) {
      level_flags = 1;
    } else if (s.level === 6) {
      level_flags = 2;
    } else {
      level_flags = 3;
    }
    header |= level_flags << 6;
    if (s.strstart !== 0) {
      header |= PRESET_DICT;
    }
    header += 31 - (header % 31);
    putShortMSB(s, header);
    if (s.strstart !== 0) {
      putShortMSB(s, strm.adler >>> 16);
      putShortMSB(s, strm.adler & 65535);
    }
    strm.adler = 1;
    s.status = BUSY_STATE;
    flush_pending(strm);
    if (s.pending !== 0) {
      s.last_flush = -1;
      return Z_OK$3;
    }
  }
  if (s.status === GZIP_STATE) {
    strm.adler = 0;
    put_byte(s, 31);
    put_byte(s, 139);
    put_byte(s, 8);
    if (!s.gzhead) {
      put_byte(s, 0);
      put_byte(s, 0);
      put_byte(s, 0);
      put_byte(s, 0);
      put_byte(s, 0);
      put_byte(s, s.level === 9 ? 2 : s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ? 4 : 0);
      put_byte(s, OS_CODE);
      s.status = BUSY_STATE;
      flush_pending(strm);
      if (s.pending !== 0) {
        s.last_flush = -1;
        return Z_OK$3;
      }
    } else {
      put_byte(s, (s.gzhead.text ? 1 : 0) + (s.gzhead.hcrc ? 2 : 0) + (!s.gzhead.extra ? 0 : 4) + (!s.gzhead.name ? 0 : 8) + (!s.gzhead.comment ? 0 : 16));
      put_byte(s, s.gzhead.time & 255);
      put_byte(s, (s.gzhead.time >> 8) & 255);
      put_byte(s, (s.gzhead.time >> 16) & 255);
      put_byte(s, (s.gzhead.time >> 24) & 255);
      put_byte(s, s.level === 9 ? 2 : s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ? 4 : 0);
      put_byte(s, s.gzhead.os & 255);
      if (s.gzhead.extra && s.gzhead.extra.length) {
        put_byte(s, s.gzhead.extra.length & 255);
        put_byte(s, (s.gzhead.extra.length >> 8) & 255);
      }
      if (s.gzhead.hcrc) {
        strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending, 0);
      }
      s.gzindex = 0;
      s.status = EXTRA_STATE;
    }
  }
  if (s.status === EXTRA_STATE) {
    if (s.gzhead.extra) {
      let beg = s.pending;
      let left = (s.gzhead.extra.length & 65535) - s.gzindex;
      while (s.pending + left > s.pending_buf_size) {
        let copy = s.pending_buf_size - s.pending;
        s.pending_buf.set(s.gzhead.extra.subarray(s.gzindex, s.gzindex + copy), s.pending);
        s.pending = s.pending_buf_size;
        if (s.gzhead.hcrc && s.pending > beg) {
          strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
        }
        s.gzindex += copy;
        flush_pending(strm);
        if (s.pending !== 0) {
          s.last_flush = -1;
          return Z_OK$3;
        }
        beg = 0;
        left -= copy;
      }
      let gzhead_extra = new Uint8Array(s.gzhead.extra);
      s.pending_buf.set(gzhead_extra.subarray(s.gzindex, s.gzindex + left), s.pending);
      s.pending += left;
      if (s.gzhead.hcrc && s.pending > beg) {
        strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
      }
      s.gzindex = 0;
    }
    s.status = NAME_STATE;
  }
  if (s.status === NAME_STATE) {
    if (s.gzhead.name) {
      let beg = s.pending;
      let val;
      do {
        if (s.pending === s.pending_buf_size) {
          if (s.gzhead.hcrc && s.pending > beg) {
            strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
          }
          flush_pending(strm);
          if (s.pending !== 0) {
            s.last_flush = -1;
            return Z_OK$3;
          }
          beg = 0;
        }
        if (s.gzindex < s.gzhead.name.length) {
          val = s.gzhead.name.charCodeAt(s.gzindex++) & 255;
        } else {
          val = 0;
        }
        put_byte(s, val);
      } while (val !== 0);
      if (s.gzhead.hcrc && s.pending > beg) {
        strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
      }
      s.gzindex = 0;
    }
    s.status = COMMENT_STATE;
  }
  if (s.status === COMMENT_STATE) {
    if (s.gzhead.comment) {
      let beg = s.pending;
      let val;
      do {
        if (s.pending === s.pending_buf_size) {
          if (s.gzhead.hcrc && s.pending > beg) {
            strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
          }
          flush_pending(strm);
          if (s.pending !== 0) {
            s.last_flush = -1;
            return Z_OK$3;
          }
          beg = 0;
        }
        if (s.gzindex < s.gzhead.comment.length) {
          val = s.gzhead.comment.charCodeAt(s.gzindex++) & 255;
        } else {
          val = 0;
        }
        put_byte(s, val);
      } while (val !== 0);
      if (s.gzhead.hcrc && s.pending > beg) {
        strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
      }
    }
    s.status = HCRC_STATE;
  }
  if (s.status === HCRC_STATE) {
    if (s.gzhead.hcrc) {
      if (s.pending + 2 > s.pending_buf_size) {
        flush_pending(strm);
        if (s.pending !== 0) {
          s.last_flush = -1;
          return Z_OK$3;
        }
      }
      put_byte(s, strm.adler & 255);
      put_byte(s, (strm.adler >> 8) & 255);
      strm.adler = 0;
    }
    s.status = BUSY_STATE;
    flush_pending(strm);
    if (s.pending !== 0) {
      s.last_flush = -1;
      return Z_OK$3;
    }
  }
  if (strm.avail_in !== 0 || s.lookahead !== 0 || (flush !== Z_NO_FLUSH$2 && s.status !== FINISH_STATE)) {
    let bstate = s.level === 0 ? deflate_stored(s, flush) : s.strategy === Z_HUFFMAN_ONLY ? deflate_huff(s, flush) : s.strategy === Z_RLE ? deflate_rle(s, flush) : configuration_table[s.level].func(s, flush);
    if (bstate === BS_FINISH_STARTED || bstate === BS_FINISH_DONE) {
      s.status = FINISH_STATE;
    }
    if (bstate === BS_NEED_MORE || bstate === BS_FINISH_STARTED) {
      if (strm.avail_out === 0) {
        s.last_flush = -1;
      }
      return Z_OK$3;
    }
    if (bstate === BS_BLOCK_DONE) {
      if (flush === Z_PARTIAL_FLUSH) {
        _tr_align(s);
      } else if (flush !== Z_BLOCK$1) {
        _tr_stored_block(s, 0, 0, false);
        if (flush === Z_FULL_FLUSH$1) {
          zero(s.head);
          if (s.lookahead === 0) {
            s.strstart = 0;
            s.block_start = 0;
            s.insert = 0;
          }
        }
      }
      flush_pending(strm);
      if (strm.avail_out === 0) {
        s.last_flush = -1;
        return Z_OK$3;
      }
    }
  }
  if (flush !== Z_FINISH$3) {
    return Z_OK$3;
  }
  if (s.wrap <= 0) {
    return Z_STREAM_END$3;
  }
  if (s.wrap === 2) {
    put_byte(s, strm.adler & 255);
    put_byte(s, (strm.adler >> 8) & 255);
    put_byte(s, (strm.adler >> 16) & 255);
    put_byte(s, (strm.adler >> 24) & 255);
    put_byte(s, strm.total_in & 255);
    put_byte(s, (strm.total_in >> 8) & 255);
    put_byte(s, (strm.total_in >> 16) & 255);
    put_byte(s, (strm.total_in >> 24) & 255);
  } else {
    putShortMSB(s, strm.adler >>> 16);
    putShortMSB(s, strm.adler & 65535);
  }
  flush_pending(strm);
  if (s.wrap > 0) {
    s.wrap = -s.wrap;
  }
  return s.pending !== 0 ? Z_OK$3 : Z_STREAM_END$3;
};
var deflateEnd = (strm) => {
  if (deflateStateCheck(strm)) {
    return Z_STREAM_ERROR$2;
  }
  const status = strm.state.status;
  strm.state = null;
  return status === BUSY_STATE ? err(strm, Z_DATA_ERROR$2) : Z_OK$3;
};
var deflateSetDictionary = (strm, dictionary) => {
  let dictLength = dictionary.length;
  if (deflateStateCheck(strm)) {
    return Z_STREAM_ERROR$2;
  }
  const s = strm.state;
  const wrap = s.wrap;
  if (wrap === 2 || (wrap === 1 && s.status !== INIT_STATE) || s.lookahead) {
    return Z_STREAM_ERROR$2;
  }
  if (wrap === 1) {
    strm.adler = adler32_1(strm.adler, dictionary, dictLength, 0);
  }
  s.wrap = 0;
  if (dictLength >= s.w_size) {
    if (wrap === 0) {
      zero(s.head);
      s.strstart = 0;
      s.block_start = 0;
      s.insert = 0;
    }
    let tmpDict = new Uint8Array(s.w_size);
    tmpDict.set(dictionary.subarray(dictLength - s.w_size, dictLength), 0);
    dictionary = tmpDict;
    dictLength = s.w_size;
  }
  const avail = strm.avail_in;
  const next = strm.next_in;
  const input = strm.input;
  strm.avail_in = dictLength;
  strm.next_in = 0;
  strm.input = dictionary;
  fill_window(s);
  while (s.lookahead >= MIN_MATCH) {
    let str = s.strstart;
    let n = s.lookahead - (MIN_MATCH - 1);
    do {
      s.ins_h = HASH(s, s.ins_h, s.window[str + MIN_MATCH - 1]);
      s.prev[str & s.w_mask] = s.head[s.ins_h];
      s.head[s.ins_h] = str;
      str++;
    } while (--n);
    s.strstart = str;
    s.lookahead = MIN_MATCH - 1;
    fill_window(s);
  }
  s.strstart += s.lookahead;
  s.block_start = s.strstart;
  s.insert = s.lookahead;
  s.lookahead = 0;
  s.match_length = s.prev_length = MIN_MATCH - 1;
  s.match_available = 0;
  strm.next_in = next;
  strm.input = input;
  strm.avail_in = avail;
  s.wrap = wrap;
  return Z_OK$3;
};
var deflateInit_1 = deflateInit;
var deflateInit2_1 = deflateInit2;
var deflateReset_1 = deflateReset;
var deflateResetKeep_1 = deflateResetKeep;
var deflateSetHeader_1 = deflateSetHeader;
var deflate_2$1 = deflate$2;
var deflateEnd_1 = deflateEnd;
var deflateSetDictionary_1 = deflateSetDictionary;
var deflateInfo = 'pako deflate (from Nodeca project)';
var deflate_1$2 = {
  deflateInit: deflateInit_1,
  deflateInit2: deflateInit2_1,
  deflateReset: deflateReset_1,
  deflateResetKeep: deflateResetKeep_1,
  deflateSetHeader: deflateSetHeader_1,
  deflate: deflate_2$1,
  deflateEnd: deflateEnd_1,
  deflateSetDictionary: deflateSetDictionary_1,
  deflateInfo,
};
var _has = (obj, key) => {
  return Object.prototype.hasOwnProperty.call(obj, key);
};
var assign = function (obj) {
  const sources = Array.prototype.slice.call(arguments, 1);
  while (sources.length) {
    const source = sources.shift();
    if (!source) {
      continue;
    }
    if (typeof source !== 'object') {
      throw new TypeError(source + 'must be non-object');
    }
    for (const p in source) {
      if (_has(source, p)) {
        obj[p] = source[p];
      }
    }
  }
  return obj;
};
var flattenChunks = (chunks) => {
  let len = 0;
  for (let i = 0, l = chunks.length; i < l; i++) {
    len += chunks[i].length;
  }
  const result = new Uint8Array(len);
  for (let i = 0, pos = 0, l = chunks.length; i < l; i++) {
    let chunk = chunks[i];
    result.set(chunk, pos);
    pos += chunk.length;
  }
  return result;
};
var common = {
  assign,
  flattenChunks,
};
var STR_APPLY_UIA_OK = true;
try {
  String.fromCharCode.apply(null, new Uint8Array(1));
} catch (__) {
  STR_APPLY_UIA_OK = false;
}
var _utf8len = new Uint8Array(256);
for (let q = 0; q < 256; q++) {
  _utf8len[q] = q >= 252 ? 6 : q >= 248 ? 5 : q >= 240 ? 4 : q >= 224 ? 3 : q >= 192 ? 2 : 1;
}
_utf8len[254] = _utf8len[254] = 1;
var string2buf = (str) => {
  if (typeof TextEncoder === 'function' && TextEncoder.prototype.encode) {
    return new TextEncoder().encode(str);
  }
  let buf,
    c,
    c2,
    m_pos,
    i,
    str_len = str.length,
    buf_len = 0;
  for (m_pos = 0; m_pos < str_len; m_pos++) {
    c = str.charCodeAt(m_pos);
    if ((c & 64512) === 55296 && m_pos + 1 < str_len) {
      c2 = str.charCodeAt(m_pos + 1);
      if ((c2 & 64512) === 56320) {
        c = 65536 + ((c - 55296) << 10) + (c2 - 56320);
        m_pos++;
      }
    }
    buf_len += c < 128 ? 1 : c < 2048 ? 2 : c < 65536 ? 3 : 4;
  }
  buf = new Uint8Array(buf_len);
  for (i = 0, m_pos = 0; i < buf_len; m_pos++) {
    c = str.charCodeAt(m_pos);
    if ((c & 64512) === 55296 && m_pos + 1 < str_len) {
      c2 = str.charCodeAt(m_pos + 1);
      if ((c2 & 64512) === 56320) {
        c = 65536 + ((c - 55296) << 10) + (c2 - 56320);
        m_pos++;
      }
    }
    if (c < 128) {
      buf[i++] = c;
    } else if (c < 2048) {
      buf[i++] = 192 | (c >>> 6);
      buf[i++] = 128 | (c & 63);
    } else if (c < 65536) {
      buf[i++] = 224 | (c >>> 12);
      buf[i++] = 128 | ((c >>> 6) & 63);
      buf[i++] = 128 | (c & 63);
    } else {
      buf[i++] = 240 | (c >>> 18);
      buf[i++] = 128 | ((c >>> 12) & 63);
      buf[i++] = 128 | ((c >>> 6) & 63);
      buf[i++] = 128 | (c & 63);
    }
  }
  return buf;
};
var buf2binstring = (buf, len) => {
  if (len < 65534) {
    if (buf.subarray && STR_APPLY_UIA_OK) {
      return String.fromCharCode.apply(null, buf.length === len ? buf : buf.subarray(0, len));
    }
  }
  let result = '';
  for (let i = 0; i < len; i++) {
    result += String.fromCharCode(buf[i]);
  }
  return result;
};
var buf2string = (buf, max) => {
  const len = max || buf.length;
  if (typeof TextDecoder === 'function' && TextDecoder.prototype.decode) {
    return new TextDecoder().decode(buf.subarray(0, max));
  }
  let i, out;
  const utf16buf = new Array(len * 2);
  for (out = 0, i = 0; i < len; ) {
    let c = buf[i++];
    if (c < 128) {
      utf16buf[out++] = c;
      continue;
    }
    let c_len = _utf8len[c];
    if (c_len > 4) {
      utf16buf[out++] = 65533;
      i += c_len - 1;
      continue;
    }
    c &= c_len === 2 ? 31 : c_len === 3 ? 15 : 7;
    while (c_len > 1 && i < len) {
      c = (c << 6) | (buf[i++] & 63);
      c_len--;
    }
    if (c_len > 1) {
      utf16buf[out++] = 65533;
      continue;
    }
    if (c < 65536) {
      utf16buf[out++] = c;
    } else {
      c -= 65536;
      utf16buf[out++] = 55296 | ((c >> 10) & 1023);
      utf16buf[out++] = 56320 | (c & 1023);
    }
  }
  return buf2binstring(utf16buf, out);
};
var utf8border = (buf, max) => {
  max = max || buf.length;
  if (max > buf.length) {
    max = buf.length;
  }
  let pos = max - 1;
  while (pos >= 0 && (buf[pos] & 192) === 128) {
    pos--;
  }
  if (pos < 0) {
    return max;
  }
  if (pos === 0) {
    return max;
  }
  return pos + _utf8len[buf[pos]] > max ? pos : max;
};
var strings = {
  string2buf,
  buf2string,
  utf8border,
};
var zstream = ZStream;
var toString$1 = Object.prototype.toString;
var { Z_NO_FLUSH: Z_NO_FLUSH$1, Z_SYNC_FLUSH, Z_FULL_FLUSH, Z_FINISH: Z_FINISH$2, Z_OK: Z_OK$2, Z_STREAM_END: Z_STREAM_END$2, Z_DEFAULT_COMPRESSION, Z_DEFAULT_STRATEGY, Z_DEFLATED: Z_DEFLATED$1 } = constants$2;
Deflate$1.prototype.push = function (data, flush_mode) {
  const strm = this.strm;
  const chunkSize = this.options.chunkSize;
  let status, _flush_mode;
  if (this.ended) {
    return false;
  }
  if (flush_mode === ~~flush_mode) _flush_mode = flush_mode;
  else _flush_mode = flush_mode === true ? Z_FINISH$2 : Z_NO_FLUSH$1;
  if (typeof data === 'string') {
    strm.input = strings.string2buf(data);
  } else if (toString$1.call(data) === '[object ArrayBuffer]') {
    strm.input = new Uint8Array(data);
  } else {
    strm.input = data;
  }
  strm.next_in = 0;
  strm.avail_in = strm.input.length;
  for (;;) {
    if (strm.avail_out === 0) {
      strm.output = new Uint8Array(chunkSize);
      strm.next_out = 0;
      strm.avail_out = chunkSize;
    }
    if ((_flush_mode === Z_SYNC_FLUSH || _flush_mode === Z_FULL_FLUSH) && strm.avail_out <= 6) {
      this.onData(strm.output.subarray(0, strm.next_out));
      strm.avail_out = 0;
      continue;
    }
    status = deflate_1$2.deflate(strm, _flush_mode);
    if (status === Z_STREAM_END$2) {
      if (strm.next_out > 0) {
        this.onData(strm.output.subarray(0, strm.next_out));
      }
      status = deflate_1$2.deflateEnd(this.strm);
      this.onEnd(status);
      this.ended = true;
      return status === Z_OK$2;
    }
    if (strm.avail_out === 0) {
      this.onData(strm.output);
      continue;
    }
    if (_flush_mode > 0 && strm.next_out > 0) {
      this.onData(strm.output.subarray(0, strm.next_out));
      strm.avail_out = 0;
      continue;
    }
    if (strm.avail_in === 0) break;
  }
  return true;
};
Deflate$1.prototype.onData = function (chunk) {
  this.chunks.push(chunk);
};
Deflate$1.prototype.onEnd = function (status) {
  if (status === Z_OK$2) {
    this.result = common.flattenChunks(this.chunks);
  }
  this.chunks = [];
  this.err = status;
  this.msg = this.strm.msg;
};
var Deflate_1$1 = Deflate$1;
var deflate_2 = deflate$1;
var deflateRaw_1$1 = deflateRaw$1;
var gzip_1$1 = gzip$1;
var constants$1 = constants$2;
var deflate_1$1 = {
  Deflate: Deflate_1$1,
  deflate: deflate_2,
  deflateRaw: deflateRaw_1$1,
  gzip: gzip_1$1,
  constants: constants$1,
};
var BAD$1 = 16209;
var TYPE$1 = 16191;
var inffast = function inflate_fast(strm, start) {
  let _in;
  let last;
  let _out;
  let beg;
  let end;
  let dmax;
  let wsize;
  let whave;
  let wnext;
  let s_window;
  let hold;
  let bits;
  let lcode;
  let dcode;
  let lmask;
  let dmask;
  let here;
  let op;
  let len;
  let dist;
  let from;
  let from_source;
  let input, output;
  const state = strm.state;
  _in = strm.next_in;
  input = strm.input;
  last = _in + (strm.avail_in - 5);
  _out = strm.next_out;
  output = strm.output;
  beg = _out - (start - strm.avail_out);
  end = _out + (strm.avail_out - 257);
  dmax = state.dmax;
  wsize = state.wsize;
  whave = state.whave;
  wnext = state.wnext;
  s_window = state.window;
  hold = state.hold;
  bits = state.bits;
  lcode = state.lencode;
  dcode = state.distcode;
  lmask = (1 << state.lenbits) - 1;
  dmask = (1 << state.distbits) - 1;
  top: do {
    if (bits < 15) {
      hold += input[_in++] << bits;
      bits += 8;
      hold += input[_in++] << bits;
      bits += 8;
    }
    here = lcode[hold & lmask];
    dolen: for (;;) {
      op = here >>> 24;
      hold >>>= op;
      bits -= op;
      op = (here >>> 16) & 255;
      if (op === 0) {
        output[_out++] = here & 65535;
      } else if (op & 16) {
        len = here & 65535;
        op &= 15;
        if (op) {
          if (bits < op) {
            hold += input[_in++] << bits;
            bits += 8;
          }
          len += hold & ((1 << op) - 1);
          hold >>>= op;
          bits -= op;
        }
        if (bits < 15) {
          hold += input[_in++] << bits;
          bits += 8;
          hold += input[_in++] << bits;
          bits += 8;
        }
        here = dcode[hold & dmask];
        dodist: for (;;) {
          op = here >>> 24;
          hold >>>= op;
          bits -= op;
          op = (here >>> 16) & 255;
          if (op & 16) {
            dist = here & 65535;
            op &= 15;
            if (bits < op) {
              hold += input[_in++] << bits;
              bits += 8;
              if (bits < op) {
                hold += input[_in++] << bits;
                bits += 8;
              }
            }
            dist += hold & ((1 << op) - 1);
            if (dist > dmax) {
              strm.msg = 'invalid distance too far back';
              state.mode = BAD$1;
              break top;
            }
            hold >>>= op;
            bits -= op;
            op = _out - beg;
            if (dist > op) {
              op = dist - op;
              if (op > whave) {
                if (state.sane) {
                  strm.msg = 'invalid distance too far back';
                  state.mode = BAD$1;
                  break top;
                }
              }
              from = 0;
              from_source = s_window;
              if (wnext === 0) {
                from += wsize - op;
                if (op < len) {
                  len -= op;
                  do {
                    output[_out++] = s_window[from++];
                  } while (--op);
                  from = _out - dist;
                  from_source = output;
                }
              } else if (wnext < op) {
                from += wsize + wnext - op;
                op -= wnext;
                if (op < len) {
                  len -= op;
                  do {
                    output[_out++] = s_window[from++];
                  } while (--op);
                  from = 0;
                  if (wnext < len) {
                    op = wnext;
                    len -= op;
                    do {
                      output[_out++] = s_window[from++];
                    } while (--op);
                    from = _out - dist;
                    from_source = output;
                  }
                }
              } else {
                from += wnext - op;
                if (op < len) {
                  len -= op;
                  do {
                    output[_out++] = s_window[from++];
                  } while (--op);
                  from = _out - dist;
                  from_source = output;
                }
              }
              while (len > 2) {
                output[_out++] = from_source[from++];
                output[_out++] = from_source[from++];
                output[_out++] = from_source[from++];
                len -= 3;
              }
              if (len) {
                output[_out++] = from_source[from++];
                if (len > 1) {
                  output[_out++] = from_source[from++];
                }
              }
            } else {
              from = _out - dist;
              do {
                output[_out++] = output[from++];
                output[_out++] = output[from++];
                output[_out++] = output[from++];
                len -= 3;
              } while (len > 2);
              if (len) {
                output[_out++] = output[from++];
                if (len > 1) {
                  output[_out++] = output[from++];
                }
              }
            }
          } else if ((op & 64) === 0) {
            here = dcode[(here & 65535) + (hold & ((1 << op) - 1))];
            continue dodist;
          } else {
            strm.msg = 'invalid distance code';
            state.mode = BAD$1;
            break top;
          }
          break;
        }
      } else if ((op & 64) === 0) {
        here = lcode[(here & 65535) + (hold & ((1 << op) - 1))];
        continue dolen;
      } else if (op & 32) {
        state.mode = TYPE$1;
        break top;
      } else {
        strm.msg = 'invalid literal/length code';
        state.mode = BAD$1;
        break top;
      }
      break;
    }
  } while (_in < last && _out < end);
  len = bits >> 3;
  _in -= len;
  bits -= len << 3;
  hold &= (1 << bits) - 1;
  strm.next_in = _in;
  strm.next_out = _out;
  strm.avail_in = _in < last ? 5 + (last - _in) : 5 - (_in - last);
  strm.avail_out = _out < end ? 257 + (end - _out) : 257 - (_out - end);
  state.hold = hold;
  state.bits = bits;
  return;
};
var MAXBITS = 15;
var ENOUGH_LENS$1 = 852;
var ENOUGH_DISTS$1 = 592;
var CODES$1 = 0;
var LENS$1 = 1;
var DISTS$1 = 2;
var lbase = new Uint16Array([3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 0, 0]);
var lext = new Uint8Array([16, 16, 16, 16, 16, 16, 16, 16, 17, 17, 17, 17, 18, 18, 18, 18, 19, 19, 19, 19, 20, 20, 20, 20, 21, 21, 21, 21, 16, 72, 78]);
var dbase = new Uint16Array([1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577, 0, 0]);
var dext = new Uint8Array([16, 16, 16, 16, 17, 17, 18, 18, 19, 19, 20, 20, 21, 21, 22, 22, 23, 23, 24, 24, 25, 25, 26, 26, 27, 27, 28, 28, 29, 29, 64, 64]);
var inflate_table = (type, lens, lens_index, codes, table, table_index, work, opts) => {
  const bits = opts.bits;
  let len = 0;
  let sym = 0;
  let min = 0,
    max = 0;
  let root = 0;
  let curr = 0;
  let drop = 0;
  let left = 0;
  let used = 0;
  let huff = 0;
  let incr;
  let fill;
  let low;
  let mask;
  let next;
  let base = null;
  let match;
  const count = new Uint16Array(MAXBITS + 1);
  const offs = new Uint16Array(MAXBITS + 1);
  let extra = null;
  let here_bits, here_op, here_val;
  for (len = 0; len <= MAXBITS; len++) {
    count[len] = 0;
  }
  for (sym = 0; sym < codes; sym++) {
    count[lens[lens_index + sym]]++;
  }
  root = bits;
  for (max = MAXBITS; max >= 1; max--) {
    if (count[max] !== 0) {
      break;
    }
  }
  if (root > max) {
    root = max;
  }
  if (max === 0) {
    table[table_index++] = (1 << 24) | (64 << 16) | 0;
    table[table_index++] = (1 << 24) | (64 << 16) | 0;
    opts.bits = 1;
    return 0;
  }
  for (min = 1; min < max; min++) {
    if (count[min] !== 0) {
      break;
    }
  }
  if (root < min) {
    root = min;
  }
  left = 1;
  for (len = 1; len <= MAXBITS; len++) {
    left <<= 1;
    left -= count[len];
    if (left < 0) {
      return -1;
    }
  }
  if (left > 0 && (type === CODES$1 || max !== 1)) {
    return -1;
  }
  offs[1] = 0;
  for (len = 1; len < MAXBITS; len++) {
    offs[len + 1] = offs[len] + count[len];
  }
  for (sym = 0; sym < codes; sym++) {
    if (lens[lens_index + sym] !== 0) {
      work[offs[lens[lens_index + sym]]++] = sym;
    }
  }
  if (type === CODES$1) {
    base = extra = work;
    match = 20;
  } else if (type === LENS$1) {
    base = lbase;
    extra = lext;
    match = 257;
  } else {
    base = dbase;
    extra = dext;
    match = 0;
  }
  huff = 0;
  sym = 0;
  len = min;
  next = table_index;
  curr = root;
  drop = 0;
  low = -1;
  used = 1 << root;
  mask = used - 1;
  if ((type === LENS$1 && used > ENOUGH_LENS$1) || (type === DISTS$1 && used > ENOUGH_DISTS$1)) {
    return 1;
  }
  for (;;) {
    here_bits = len - drop;
    if (work[sym] + 1 < match) {
      here_op = 0;
      here_val = work[sym];
    } else if (work[sym] >= match) {
      here_op = extra[work[sym] - match];
      here_val = base[work[sym] - match];
    } else {
      here_op = 32 + 64;
      here_val = 0;
    }
    incr = 1 << (len - drop);
    fill = 1 << curr;
    min = fill;
    do {
      fill -= incr;
      table[next + (huff >> drop) + fill] = (here_bits << 24) | (here_op << 16) | here_val | 0;
    } while (fill !== 0);
    incr = 1 << (len - 1);
    while (huff & incr) {
      incr >>= 1;
    }
    if (incr !== 0) {
      huff &= incr - 1;
      huff += incr;
    } else {
      huff = 0;
    }
    sym++;
    if (--count[len] === 0) {
      if (len === max) {
        break;
      }
      len = lens[lens_index + work[sym]];
    }
    if (len > root && (huff & mask) !== low) {
      if (drop === 0) {
        drop = root;
      }
      next += min;
      curr = len - drop;
      left = 1 << curr;
      while (curr + drop < max) {
        left -= count[curr + drop];
        if (left <= 0) {
          break;
        }
        curr++;
        left <<= 1;
      }
      used += 1 << curr;
      if ((type === LENS$1 && used > ENOUGH_LENS$1) || (type === DISTS$1 && used > ENOUGH_DISTS$1)) {
        return 1;
      }
      low = huff & mask;
      table[low] = (root << 24) | (curr << 16) | (next - table_index) | 0;
    }
  }
  if (huff !== 0) {
    table[next + huff] = ((len - drop) << 24) | (64 << 16) | 0;
  }
  opts.bits = root;
  return 0;
};
var inftrees = inflate_table;
var CODES = 0;
var LENS = 1;
var DISTS = 2;
var { Z_FINISH: Z_FINISH$1, Z_BLOCK, Z_TREES, Z_OK: Z_OK$1, Z_STREAM_END: Z_STREAM_END$1, Z_NEED_DICT: Z_NEED_DICT$1, Z_STREAM_ERROR: Z_STREAM_ERROR$1, Z_DATA_ERROR: Z_DATA_ERROR$1, Z_MEM_ERROR: Z_MEM_ERROR$1, Z_BUF_ERROR, Z_DEFLATED } = constants$2;
var HEAD = 16180;
var FLAGS = 16181;
var TIME = 16182;
var OS = 16183;
var EXLEN = 16184;
var EXTRA = 16185;
var NAME = 16186;
var COMMENT = 16187;
var HCRC = 16188;
var DICTID = 16189;
var DICT = 16190;
var TYPE = 16191;
var TYPEDO = 16192;
var STORED = 16193;
var COPY_ = 16194;
var COPY = 16195;
var TABLE = 16196;
var LENLENS = 16197;
var CODELENS = 16198;
var LEN_ = 16199;
var LEN = 16200;
var LENEXT = 16201;
var DIST = 16202;
var DISTEXT = 16203;
var MATCH = 16204;
var LIT = 16205;
var CHECK = 16206;
var LENGTH = 16207;
var DONE = 16208;
var BAD = 16209;
var MEM = 16210;
var SYNC = 16211;
var ENOUGH_LENS = 852;
var ENOUGH_DISTS = 592;
var MAX_WBITS = 15;
var DEF_WBITS = MAX_WBITS;
var zswap32 = (q) => {
  return ((q >>> 24) & 255) + ((q >>> 8) & 65280) + ((q & 65280) << 8) + ((q & 255) << 24);
};
var inflateStateCheck = (strm) => {
  if (!strm) {
    return 1;
  }
  const state = strm.state;
  if (!state || state.strm !== strm || state.mode < HEAD || state.mode > SYNC) {
    return 1;
  }
  return 0;
};
var inflateResetKeep = (strm) => {
  if (inflateStateCheck(strm)) {
    return Z_STREAM_ERROR$1;
  }
  const state = strm.state;
  strm.total_in = strm.total_out = state.total = 0;
  strm.msg = '';
  if (state.wrap) {
    strm.adler = state.wrap & 1;
  }
  state.mode = HEAD;
  state.last = 0;
  state.havedict = 0;
  state.flags = -1;
  state.dmax = 32768;
  state.head = null;
  state.hold = 0;
  state.bits = 0;
  state.lencode = state.lendyn = new Int32Array(ENOUGH_LENS);
  state.distcode = state.distdyn = new Int32Array(ENOUGH_DISTS);
  state.sane = 1;
  state.back = -1;
  return Z_OK$1;
};
var inflateReset = (strm) => {
  if (inflateStateCheck(strm)) {
    return Z_STREAM_ERROR$1;
  }
  const state = strm.state;
  state.wsize = 0;
  state.whave = 0;
  state.wnext = 0;
  return inflateResetKeep(strm);
};
var inflateReset2 = (strm, windowBits) => {
  let wrap;
  if (inflateStateCheck(strm)) {
    return Z_STREAM_ERROR$1;
  }
  const state = strm.state;
  if (windowBits < 0) {
    wrap = 0;
    windowBits = -windowBits;
  } else {
    wrap = (windowBits >> 4) + 5;
    if (windowBits < 48) {
      windowBits &= 15;
    }
  }
  if (windowBits && (windowBits < 8 || windowBits > 15)) {
    return Z_STREAM_ERROR$1;
  }
  if (state.window !== null && state.wbits !== windowBits) {
    state.window = null;
  }
  state.wrap = wrap;
  state.wbits = windowBits;
  return inflateReset(strm);
};
var inflateInit2 = (strm, windowBits) => {
  if (!strm) {
    return Z_STREAM_ERROR$1;
  }
  const state = new InflateState();
  strm.state = state;
  state.strm = strm;
  state.window = null;
  state.mode = HEAD;
  const ret = inflateReset2(strm, windowBits);
  if (ret !== Z_OK$1) {
    strm.state = null;
  }
  return ret;
};
var inflateInit = (strm) => {
  return inflateInit2(strm, DEF_WBITS);
};
var virgin = true;
var lenfix;
var distfix;
var fixedtables = (state) => {
  if (virgin) {
    lenfix = new Int32Array(512);
    distfix = new Int32Array(32);
    let sym = 0;
    while (sym < 144) {
      state.lens[sym++] = 8;
    }
    while (sym < 256) {
      state.lens[sym++] = 9;
    }
    while (sym < 280) {
      state.lens[sym++] = 7;
    }
    while (sym < 288) {
      state.lens[sym++] = 8;
    }
    inftrees(LENS, state.lens, 0, 288, lenfix, 0, state.work, { bits: 9 });
    sym = 0;
    while (sym < 32) {
      state.lens[sym++] = 5;
    }
    inftrees(DISTS, state.lens, 0, 32, distfix, 0, state.work, { bits: 5 });
    virgin = false;
  }
  state.lencode = lenfix;
  state.lenbits = 9;
  state.distcode = distfix;
  state.distbits = 5;
};
var updatewindow = (strm, src, end, copy) => {
  let dist;
  const state = strm.state;
  if (state.window === null) {
    state.wsize = 1 << state.wbits;
    state.wnext = 0;
    state.whave = 0;
    state.window = new Uint8Array(state.wsize);
  }
  if (copy >= state.wsize) {
    state.window.set(src.subarray(end - state.wsize, end), 0);
    state.wnext = 0;
    state.whave = state.wsize;
  } else {
    dist = state.wsize - state.wnext;
    if (dist > copy) {
      dist = copy;
    }
    state.window.set(src.subarray(end - copy, end - copy + dist), state.wnext);
    copy -= dist;
    if (copy) {
      state.window.set(src.subarray(end - copy, end), 0);
      state.wnext = copy;
      state.whave = state.wsize;
    } else {
      state.wnext += dist;
      if (state.wnext === state.wsize) {
        state.wnext = 0;
      }
      if (state.whave < state.wsize) {
        state.whave += dist;
      }
    }
  }
  return 0;
};
var inflate$2 = (strm, flush) => {
  let state;
  let input, output;
  let next;
  let put;
  let have, left;
  let hold;
  let bits;
  let _in, _out;
  let copy;
  let from;
  let from_source;
  let here = 0;
  let here_bits, here_op, here_val;
  let last_bits, last_op, last_val;
  let len;
  let ret;
  const hbuf = new Uint8Array(4);
  let opts;
  let n;
  const order = new Uint8Array([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
  if (inflateStateCheck(strm) || !strm.output || (!strm.input && strm.avail_in !== 0)) {
    return Z_STREAM_ERROR$1;
  }
  state = strm.state;
  if (state.mode === TYPE) {
    state.mode = TYPEDO;
  }
  put = strm.next_out;
  output = strm.output;
  left = strm.avail_out;
  next = strm.next_in;
  input = strm.input;
  have = strm.avail_in;
  hold = state.hold;
  bits = state.bits;
  _in = have;
  _out = left;
  ret = Z_OK$1;
  inf_leave: for (;;) {
    switch (state.mode) {
      case HEAD:
        if (state.wrap === 0) {
          state.mode = TYPEDO;
          break;
        }
        while (bits < 16) {
          if (have === 0) {
            break inf_leave;
          }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        if (state.wrap & 2 && hold === 35615) {
          if (state.wbits === 0) {
            state.wbits = 15;
          }
          state.check = 0;
          hbuf[0] = hold & 255;
          hbuf[1] = (hold >>> 8) & 255;
          state.check = crc32_1(state.check, hbuf, 2, 0);
          hold = 0;
          bits = 0;
          state.mode = FLAGS;
          break;
        }
        if (state.head) {
          state.head.done = false;
        }
        if (!(state.wrap & 1) || (((hold & 255) << 8) + (hold >> 8)) % 31) {
          strm.msg = 'incorrect header check';
          state.mode = BAD;
          break;
        }
        if ((hold & 15) !== Z_DEFLATED) {
          strm.msg = 'unknown compression method';
          state.mode = BAD;
          break;
        }
        hold >>>= 4;
        bits -= 4;
        len = (hold & 15) + 8;
        if (state.wbits === 0) {
          state.wbits = len;
        }
        if (len > 15 || len > state.wbits) {
          strm.msg = 'invalid window size';
          state.mode = BAD;
          break;
        }
        state.dmax = 1 << state.wbits;
        state.flags = 0;
        strm.adler = state.check = 1;
        state.mode = hold & 512 ? DICTID : TYPE;
        hold = 0;
        bits = 0;
        break;
      case FLAGS:
        while (bits < 16) {
          if (have === 0) {
            break inf_leave;
          }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        state.flags = hold;
        if ((state.flags & 255) !== Z_DEFLATED) {
          strm.msg = 'unknown compression method';
          state.mode = BAD;
          break;
        }
        if (state.flags & 57344) {
          strm.msg = 'unknown header flags set';
          state.mode = BAD;
          break;
        }
        if (state.head) {
          state.head.text = (hold >> 8) & 1;
        }
        if (state.flags & 512 && state.wrap & 4) {
          hbuf[0] = hold & 255;
          hbuf[1] = (hold >>> 8) & 255;
          state.check = crc32_1(state.check, hbuf, 2, 0);
        }
        hold = 0;
        bits = 0;
        state.mode = TIME;
      case TIME:
        while (bits < 32) {
          if (have === 0) {
            break inf_leave;
          }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        if (state.head) {
          state.head.time = hold;
        }
        if (state.flags & 512 && state.wrap & 4) {
          hbuf[0] = hold & 255;
          hbuf[1] = (hold >>> 8) & 255;
          hbuf[2] = (hold >>> 16) & 255;
          hbuf[3] = (hold >>> 24) & 255;
          state.check = crc32_1(state.check, hbuf, 4, 0);
        }
        hold = 0;
        bits = 0;
        state.mode = OS;
      case OS:
        while (bits < 16) {
          if (have === 0) {
            break inf_leave;
          }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        if (state.head) {
          state.head.xflags = hold & 255;
          state.head.os = hold >> 8;
        }
        if (state.flags & 512 && state.wrap & 4) {
          hbuf[0] = hold & 255;
          hbuf[1] = (hold >>> 8) & 255;
          state.check = crc32_1(state.check, hbuf, 2, 0);
        }
        hold = 0;
        bits = 0;
        state.mode = EXLEN;
      case EXLEN:
        if (state.flags & 1024) {
          while (bits < 16) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          state.length = hold;
          if (state.head) {
            state.head.extra_len = hold;
          }
          if (state.flags & 512 && state.wrap & 4) {
            hbuf[0] = hold & 255;
            hbuf[1] = (hold >>> 8) & 255;
            state.check = crc32_1(state.check, hbuf, 2, 0);
          }
          hold = 0;
          bits = 0;
        } else if (state.head) {
          state.head.extra = null;
        }
        state.mode = EXTRA;
      case EXTRA:
        if (state.flags & 1024) {
          copy = state.length;
          if (copy > have) {
            copy = have;
          }
          if (copy) {
            if (state.head) {
              len = state.head.extra_len - state.length;
              if (!state.head.extra) {
                state.head.extra = new Uint8Array(state.head.extra_len);
              }
              state.head.extra.set(input.subarray(next, next + copy), len);
            }
            if (state.flags & 512 && state.wrap & 4) {
              state.check = crc32_1(state.check, input, copy, next);
            }
            have -= copy;
            next += copy;
            state.length -= copy;
          }
          if (state.length) {
            break inf_leave;
          }
        }
        state.length = 0;
        state.mode = NAME;
      case NAME:
        if (state.flags & 2048) {
          if (have === 0) {
            break inf_leave;
          }
          copy = 0;
          do {
            len = input[next + copy++];
            if (state.head && len && state.length < 65536) {
              state.head.name += String.fromCharCode(len);
            }
          } while (len && copy < have);
          if (state.flags & 512 && state.wrap & 4) {
            state.check = crc32_1(state.check, input, copy, next);
          }
          have -= copy;
          next += copy;
          if (len) {
            break inf_leave;
          }
        } else if (state.head) {
          state.head.name = null;
        }
        state.length = 0;
        state.mode = COMMENT;
      case COMMENT:
        if (state.flags & 4096) {
          if (have === 0) {
            break inf_leave;
          }
          copy = 0;
          do {
            len = input[next + copy++];
            if (state.head && len && state.length < 65536) {
              state.head.comment += String.fromCharCode(len);
            }
          } while (len && copy < have);
          if (state.flags & 512 && state.wrap & 4) {
            state.check = crc32_1(state.check, input, copy, next);
          }
          have -= copy;
          next += copy;
          if (len) {
            break inf_leave;
          }
        } else if (state.head) {
          state.head.comment = null;
        }
        state.mode = HCRC;
      case HCRC:
        if (state.flags & 512) {
          while (bits < 16) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if (state.wrap & 4 && hold !== (state.check & 65535)) {
            strm.msg = 'header crc mismatch';
            state.mode = BAD;
            break;
          }
          hold = 0;
          bits = 0;
        }
        if (state.head) {
          state.head.hcrc = (state.flags >> 9) & 1;
          state.head.done = true;
        }
        strm.adler = state.check = 0;
        state.mode = TYPE;
        break;
      case DICTID:
        while (bits < 32) {
          if (have === 0) {
            break inf_leave;
          }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        strm.adler = state.check = zswap32(hold);
        hold = 0;
        bits = 0;
        state.mode = DICT;
      case DICT:
        if (state.havedict === 0) {
          strm.next_out = put;
          strm.avail_out = left;
          strm.next_in = next;
          strm.avail_in = have;
          state.hold = hold;
          state.bits = bits;
          return Z_NEED_DICT$1;
        }
        strm.adler = state.check = 1;
        state.mode = TYPE;
      case TYPE:
        if (flush === Z_BLOCK || flush === Z_TREES) {
          break inf_leave;
        }
      case TYPEDO:
        if (state.last) {
          hold >>>= bits & 7;
          bits -= bits & 7;
          state.mode = CHECK;
          break;
        }
        while (bits < 3) {
          if (have === 0) {
            break inf_leave;
          }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        state.last = hold & 1;
        hold >>>= 1;
        bits -= 1;
        switch (hold & 3) {
          case 0:
            state.mode = STORED;
            break;
          case 1:
            fixedtables(state);
            state.mode = LEN_;
            if (flush === Z_TREES) {
              hold >>>= 2;
              bits -= 2;
              break inf_leave;
            }
            break;
          case 2:
            state.mode = TABLE;
            break;
          case 3:
            strm.msg = 'invalid block type';
            state.mode = BAD;
        }
        hold >>>= 2;
        bits -= 2;
        break;
      case STORED:
        hold >>>= bits & 7;
        bits -= bits & 7;
        while (bits < 32) {
          if (have === 0) {
            break inf_leave;
          }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        if ((hold & 65535) !== ((hold >>> 16) ^ 65535)) {
          strm.msg = 'invalid stored block lengths';
          state.mode = BAD;
          break;
        }
        state.length = hold & 65535;
        hold = 0;
        bits = 0;
        state.mode = COPY_;
        if (flush === Z_TREES) {
          break inf_leave;
        }
      case COPY_:
        state.mode = COPY;
      case COPY:
        copy = state.length;
        if (copy) {
          if (copy > have) {
            copy = have;
          }
          if (copy > left) {
            copy = left;
          }
          if (copy === 0) {
            break inf_leave;
          }
          output.set(input.subarray(next, next + copy), put);
          have -= copy;
          next += copy;
          left -= copy;
          put += copy;
          state.length -= copy;
          break;
        }
        state.mode = TYPE;
        break;
      case TABLE:
        while (bits < 14) {
          if (have === 0) {
            break inf_leave;
          }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        state.nlen = (hold & 31) + 257;
        hold >>>= 5;
        bits -= 5;
        state.ndist = (hold & 31) + 1;
        hold >>>= 5;
        bits -= 5;
        state.ncode = (hold & 15) + 4;
        hold >>>= 4;
        bits -= 4;
        if (state.nlen > 286 || state.ndist > 30) {
          strm.msg = 'too many length or distance symbols';
          state.mode = BAD;
          break;
        }
        state.have = 0;
        state.mode = LENLENS;
      case LENLENS:
        while (state.have < state.ncode) {
          while (bits < 3) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          state.lens[order[state.have++]] = hold & 7;
          hold >>>= 3;
          bits -= 3;
        }
        while (state.have < 19) {
          state.lens[order[state.have++]] = 0;
        }
        state.lencode = state.lendyn;
        state.lenbits = 7;
        opts = { bits: state.lenbits };
        ret = inftrees(CODES, state.lens, 0, 19, state.lencode, 0, state.work, opts);
        state.lenbits = opts.bits;
        if (ret) {
          strm.msg = 'invalid code lengths set';
          state.mode = BAD;
          break;
        }
        state.have = 0;
        state.mode = CODELENS;
      case CODELENS:
        while (state.have < state.nlen + state.ndist) {
          for (;;) {
            here = state.lencode[hold & ((1 << state.lenbits) - 1)];
            here_bits = here >>> 24;
            here_op = (here >>> 16) & 255;
            here_val = here & 65535;
            if (here_bits <= bits) {
              break;
            }
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if (here_val < 16) {
            hold >>>= here_bits;
            bits -= here_bits;
            state.lens[state.have++] = here_val;
          } else {
            if (here_val === 16) {
              n = here_bits + 2;
              while (bits < n) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              hold >>>= here_bits;
              bits -= here_bits;
              if (state.have === 0) {
                strm.msg = 'invalid bit length repeat';
                state.mode = BAD;
                break;
              }
              len = state.lens[state.have - 1];
              copy = 3 + (hold & 3);
              hold >>>= 2;
              bits -= 2;
            } else if (here_val === 17) {
              n = here_bits + 3;
              while (bits < n) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              hold >>>= here_bits;
              bits -= here_bits;
              len = 0;
              copy = 3 + (hold & 7);
              hold >>>= 3;
              bits -= 3;
            } else {
              n = here_bits + 7;
              while (bits < n) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              hold >>>= here_bits;
              bits -= here_bits;
              len = 0;
              copy = 11 + (hold & 127);
              hold >>>= 7;
              bits -= 7;
            }
            if (state.have + copy > state.nlen + state.ndist) {
              strm.msg = 'invalid bit length repeat';
              state.mode = BAD;
              break;
            }
            while (copy--) {
              state.lens[state.have++] = len;
            }
          }
        }
        if (state.mode === BAD) {
          break;
        }
        if (state.lens[256] === 0) {
          strm.msg = 'invalid code -- missing end-of-block';
          state.mode = BAD;
          break;
        }
        state.lenbits = 9;
        opts = { bits: state.lenbits };
        ret = inftrees(LENS, state.lens, 0, state.nlen, state.lencode, 0, state.work, opts);
        state.lenbits = opts.bits;
        if (ret) {
          strm.msg = 'invalid literal/lengths set';
          state.mode = BAD;
          break;
        }
        state.distbits = 6;
        state.distcode = state.distdyn;
        opts = { bits: state.distbits };
        ret = inftrees(DISTS, state.lens, state.nlen, state.ndist, state.distcode, 0, state.work, opts);
        state.distbits = opts.bits;
        if (ret) {
          strm.msg = 'invalid distances set';
          state.mode = BAD;
          break;
        }
        state.mode = LEN_;
        if (flush === Z_TREES) {
          break inf_leave;
        }
      case LEN_:
        state.mode = LEN;
      case LEN:
        if (have >= 6 && left >= 258) {
          strm.next_out = put;
          strm.avail_out = left;
          strm.next_in = next;
          strm.avail_in = have;
          state.hold = hold;
          state.bits = bits;
          inffast(strm, _out);
          put = strm.next_out;
          output = strm.output;
          left = strm.avail_out;
          next = strm.next_in;
          input = strm.input;
          have = strm.avail_in;
          hold = state.hold;
          bits = state.bits;
          if (state.mode === TYPE) {
            state.back = -1;
          }
          break;
        }
        state.back = 0;
        for (;;) {
          here = state.lencode[hold & ((1 << state.lenbits) - 1)];
          here_bits = here >>> 24;
          here_op = (here >>> 16) & 255;
          here_val = here & 65535;
          if (here_bits <= bits) {
            break;
          }
          if (have === 0) {
            break inf_leave;
          }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        if (here_op && (here_op & 240) === 0) {
          last_bits = here_bits;
          last_op = here_op;
          last_val = here_val;
          for (;;) {
            here = state.lencode[last_val + ((hold & ((1 << (last_bits + last_op)) - 1)) >> last_bits)];
            here_bits = here >>> 24;
            here_op = (here >>> 16) & 255;
            here_val = here & 65535;
            if (last_bits + here_bits <= bits) {
              break;
            }
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          hold >>>= last_bits;
          bits -= last_bits;
          state.back += last_bits;
        }
        hold >>>= here_bits;
        bits -= here_bits;
        state.back += here_bits;
        state.length = here_val;
        if (here_op === 0) {
          state.mode = LIT;
          break;
        }
        if (here_op & 32) {
          state.back = -1;
          state.mode = TYPE;
          break;
        }
        if (here_op & 64) {
          strm.msg = 'invalid literal/length code';
          state.mode = BAD;
          break;
        }
        state.extra = here_op & 15;
        state.mode = LENEXT;
      case LENEXT:
        if (state.extra) {
          n = state.extra;
          while (bits < n) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          state.length += hold & ((1 << state.extra) - 1);
          hold >>>= state.extra;
          bits -= state.extra;
          state.back += state.extra;
        }
        state.was = state.length;
        state.mode = DIST;
      case DIST:
        for (;;) {
          here = state.distcode[hold & ((1 << state.distbits) - 1)];
          here_bits = here >>> 24;
          here_op = (here >>> 16) & 255;
          here_val = here & 65535;
          if (here_bits <= bits) {
            break;
          }
          if (have === 0) {
            break inf_leave;
          }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        if ((here_op & 240) === 0) {
          last_bits = here_bits;
          last_op = here_op;
          last_val = here_val;
          for (;;) {
            here = state.distcode[last_val + ((hold & ((1 << (last_bits + last_op)) - 1)) >> last_bits)];
            here_bits = here >>> 24;
            here_op = (here >>> 16) & 255;
            here_val = here & 65535;
            if (last_bits + here_bits <= bits) {
              break;
            }
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          hold >>>= last_bits;
          bits -= last_bits;
          state.back += last_bits;
        }
        hold >>>= here_bits;
        bits -= here_bits;
        state.back += here_bits;
        if (here_op & 64) {
          strm.msg = 'invalid distance code';
          state.mode = BAD;
          break;
        }
        state.offset = here_val;
        state.extra = here_op & 15;
        state.mode = DISTEXT;
      case DISTEXT:
        if (state.extra) {
          n = state.extra;
          while (bits < n) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          state.offset += hold & ((1 << state.extra) - 1);
          hold >>>= state.extra;
          bits -= state.extra;
          state.back += state.extra;
        }
        if (state.offset > state.dmax) {
          strm.msg = 'invalid distance too far back';
          state.mode = BAD;
          break;
        }
        state.mode = MATCH;
      case MATCH:
        if (left === 0) {
          break inf_leave;
        }
        copy = _out - left;
        if (state.offset > copy) {
          copy = state.offset - copy;
          if (copy > state.whave) {
            if (state.sane) {
              strm.msg = 'invalid distance too far back';
              state.mode = BAD;
              break;
            }
          }
          if (copy > state.wnext) {
            copy -= state.wnext;
            from = state.wsize - copy;
          } else {
            from = state.wnext - copy;
          }
          if (copy > state.length) {
            copy = state.length;
          }
          from_source = state.window;
        } else {
          from_source = output;
          from = put - state.offset;
          copy = state.length;
        }
        if (copy > left) {
          copy = left;
        }
        left -= copy;
        state.length -= copy;
        do {
          output[put++] = from_source[from++];
        } while (--copy);
        if (state.length === 0) {
          state.mode = LEN;
        }
        break;
      case LIT:
        if (left === 0) {
          break inf_leave;
        }
        output[put++] = state.length;
        left--;
        state.mode = LEN;
        break;
      case CHECK:
        if (state.wrap) {
          while (bits < 32) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold |= input[next++] << bits;
            bits += 8;
          }
          _out -= left;
          strm.total_out += _out;
          state.total += _out;
          if (state.wrap & 4 && _out) {
            strm.adler = state.check = state.flags ? crc32_1(state.check, output, _out, put - _out) : adler32_1(state.check, output, _out, put - _out);
          }
          _out = left;
          if (state.wrap & 4 && (state.flags ? hold : zswap32(hold)) !== state.check) {
            strm.msg = 'incorrect data check';
            state.mode = BAD;
            break;
          }
          hold = 0;
          bits = 0;
        }
        state.mode = LENGTH;
      case LENGTH:
        if (state.wrap && state.flags) {
          while (bits < 32) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if (state.wrap & 4 && hold !== (state.total & 4294967295)) {
            strm.msg = 'incorrect length check';
            state.mode = BAD;
            break;
          }
          hold = 0;
          bits = 0;
        }
        state.mode = DONE;
      case DONE:
        ret = Z_STREAM_END$1;
        break inf_leave;
      case BAD:
        ret = Z_DATA_ERROR$1;
        break inf_leave;
      case MEM:
        return Z_MEM_ERROR$1;
      case SYNC:
      default:
        return Z_STREAM_ERROR$1;
    }
  }
  strm.next_out = put;
  strm.avail_out = left;
  strm.next_in = next;
  strm.avail_in = have;
  state.hold = hold;
  state.bits = bits;
  if (state.wsize || (_out !== strm.avail_out && state.mode < BAD && (state.mode < CHECK || flush !== Z_FINISH$1))) {
    if (updatewindow(strm, strm.output, strm.next_out, _out - strm.avail_out));
  }
  _in -= strm.avail_in;
  _out -= strm.avail_out;
  strm.total_in += _in;
  strm.total_out += _out;
  state.total += _out;
  if (state.wrap & 4 && _out) {
    strm.adler = state.check = state.flags ? crc32_1(state.check, output, _out, strm.next_out - _out) : adler32_1(state.check, output, _out, strm.next_out - _out);
  }
  strm.data_type = state.bits + (state.last ? 64 : 0) + (state.mode === TYPE ? 128 : 0) + (state.mode === LEN_ || state.mode === COPY_ ? 256 : 0);
  if (((_in === 0 && _out === 0) || flush === Z_FINISH$1) && ret === Z_OK$1) {
    ret = Z_BUF_ERROR;
  }
  return ret;
};
var inflateEnd = (strm) => {
  if (inflateStateCheck(strm)) {
    return Z_STREAM_ERROR$1;
  }
  let state = strm.state;
  if (state.window) {
    state.window = null;
  }
  strm.state = null;
  return Z_OK$1;
};
var inflateGetHeader = (strm, head) => {
  if (inflateStateCheck(strm)) {
    return Z_STREAM_ERROR$1;
  }
  const state = strm.state;
  if ((state.wrap & 2) === 0) {
    return Z_STREAM_ERROR$1;
  }
  state.head = head;
  head.done = false;
  return Z_OK$1;
};
var inflateSetDictionary = (strm, dictionary) => {
  const dictLength = dictionary.length;
  let state;
  let dictid;
  let ret;
  if (inflateStateCheck(strm)) {
    return Z_STREAM_ERROR$1;
  }
  state = strm.state;
  if (state.wrap !== 0 && state.mode !== DICT) {
    return Z_STREAM_ERROR$1;
  }
  if (state.mode === DICT) {
    dictid = 1;
    dictid = adler32_1(dictid, dictionary, dictLength, 0);
    if (dictid !== state.check) {
      return Z_DATA_ERROR$1;
    }
  }
  ret = updatewindow(strm, dictionary, dictLength, dictLength);
  if (ret) {
    state.mode = MEM;
    return Z_MEM_ERROR$1;
  }
  state.havedict = 1;
  return Z_OK$1;
};
var inflateReset_1 = inflateReset;
var inflateReset2_1 = inflateReset2;
var inflateResetKeep_1 = inflateResetKeep;
var inflateInit_1 = inflateInit;
var inflateInit2_1 = inflateInit2;
var inflate_2$1 = inflate$2;
var inflateEnd_1 = inflateEnd;
var inflateGetHeader_1 = inflateGetHeader;
var inflateSetDictionary_1 = inflateSetDictionary;
var inflateInfo = 'pako inflate (from Nodeca project)';
var inflate_1$2 = {
  inflateReset: inflateReset_1,
  inflateReset2: inflateReset2_1,
  inflateResetKeep: inflateResetKeep_1,
  inflateInit: inflateInit_1,
  inflateInit2: inflateInit2_1,
  inflate: inflate_2$1,
  inflateEnd: inflateEnd_1,
  inflateGetHeader: inflateGetHeader_1,
  inflateSetDictionary: inflateSetDictionary_1,
  inflateInfo,
};
var gzheader = GZheader;
var toString = Object.prototype.toString;
var { Z_NO_FLUSH, Z_FINISH, Z_OK, Z_STREAM_END, Z_NEED_DICT, Z_STREAM_ERROR, Z_DATA_ERROR, Z_MEM_ERROR } = constants$2;
Inflate$1.prototype.push = function (data, flush_mode) {
  const strm = this.strm;
  const chunkSize = this.options.chunkSize;
  const dictionary = this.options.dictionary;
  let status, _flush_mode, last_avail_out;
  if (this.ended) return false;
  if (flush_mode === ~~flush_mode) _flush_mode = flush_mode;
  else _flush_mode = flush_mode === true ? Z_FINISH : Z_NO_FLUSH;
  if (toString.call(data) === '[object ArrayBuffer]') {
    strm.input = new Uint8Array(data);
  } else {
    strm.input = data;
  }
  strm.next_in = 0;
  strm.avail_in = strm.input.length;
  for (;;) {
    if (strm.avail_out === 0) {
      strm.output = new Uint8Array(chunkSize);
      strm.next_out = 0;
      strm.avail_out = chunkSize;
    }
    status = inflate_1$2.inflate(strm, _flush_mode);
    if (status === Z_NEED_DICT && dictionary) {
      status = inflate_1$2.inflateSetDictionary(strm, dictionary);
      if (status === Z_OK) {
        status = inflate_1$2.inflate(strm, _flush_mode);
      } else if (status === Z_DATA_ERROR) {
        status = Z_NEED_DICT;
      }
    }
    while (strm.avail_in > 0 && status === Z_STREAM_END && strm.state.wrap > 0 && data[strm.next_in] !== 0) {
      inflate_1$2.inflateReset(strm);
      status = inflate_1$2.inflate(strm, _flush_mode);
    }
    switch (status) {
      case Z_STREAM_ERROR:
      case Z_DATA_ERROR:
      case Z_NEED_DICT:
      case Z_MEM_ERROR:
        this.onEnd(status);
        this.ended = true;
        return false;
    }
    last_avail_out = strm.avail_out;
    if (strm.next_out) {
      if (strm.avail_out === 0 || status === Z_STREAM_END) {
        if (this.options.to === 'string') {
          let next_out_utf8 = strings.utf8border(strm.output, strm.next_out);
          let tail = strm.next_out - next_out_utf8;
          let utf8str = strings.buf2string(strm.output, next_out_utf8);
          strm.next_out = tail;
          strm.avail_out = chunkSize - tail;
          if (tail) strm.output.set(strm.output.subarray(next_out_utf8, next_out_utf8 + tail), 0);
          this.onData(utf8str);
        } else {
          this.onData(strm.output.length === strm.next_out ? strm.output : strm.output.subarray(0, strm.next_out));
        }
      }
    }
    if (status === Z_OK && last_avail_out === 0) continue;
    if (status === Z_STREAM_END) {
      status = inflate_1$2.inflateEnd(this.strm);
      this.onEnd(status);
      this.ended = true;
      return true;
    }
    if (strm.avail_in === 0) break;
  }
  return true;
};
Inflate$1.prototype.onData = function (chunk) {
  this.chunks.push(chunk);
};
Inflate$1.prototype.onEnd = function (status) {
  if (status === Z_OK) {
    if (this.options.to === 'string') {
      this.result = this.chunks.join('');
    } else {
      this.result = common.flattenChunks(this.chunks);
    }
  }
  this.chunks = [];
  this.err = status;
  this.msg = this.strm.msg;
};
var Inflate_1$1 = Inflate$1;
var inflate_2 = inflate$1;
var inflateRaw_1$1 = inflateRaw$1;
var ungzip$1 = inflate$1;
var constants = constants$2;
var inflate_1$1 = {
  Inflate: Inflate_1$1,
  inflate: inflate_2,
  inflateRaw: inflateRaw_1$1,
  ungzip: ungzip$1,
  constants,
};
var { Deflate, deflate, deflateRaw, gzip } = deflate_1$1;
var { Inflate, inflate, inflateRaw, ungzip } = inflate_1$1;
var Deflate_1 = Deflate;
var deflate_1 = deflate;
var deflateRaw_1 = deflateRaw;
var gzip_1 = gzip;
var Inflate_1 = Inflate;
var inflate_1 = inflate;
var inflateRaw_1 = inflateRaw;
var ungzip_1 = ungzip;
var constants_1 = constants$2;
var pako = {
  Deflate: Deflate_1,
  deflate: deflate_1,
  deflateRaw: deflateRaw_1,
  gzip: gzip_1,
  Inflate: Inflate_1,
  inflate: inflate_1,
  inflateRaw: inflateRaw_1,
  ungzip: ungzip_1,
  constants: constants_1,
};

// src/lib/png.ts
function analyzeChunk(bytes) {
  const size = new DataView(bytes.buffer).getInt32(0);
  const type = bytes.slice(4, 8);
  const [_, rest] = U8Take(bytes, 8);
  const [data, crc] = U8Take(rest, size);
  return { data, size, type, crc };
}
function compressImageData(data) {
  try {
    return pako.deflate(data);
  } catch (error) {
    ConsoleError('Error compressing IDAT data:', error);
    return;
  }
}
function createIDATchunk(data) {
  const size = U8FromUint32(data.byteLength);
  const type = U8FromString('IDAT');
  const crc = U8FromUint32(getChunkCRC(type, data));
  return U8Concat([size, type, data, crc]);
}
function createIHDRchunk({ width, height, bitDepth, colorType, compressionMethod = 0, filterMethod = 0, interlaceMethod = 0 }) {
  if (bitDepth !== 1 && bitDepth !== 2 && bitDepth !== 4 && bitDepth !== 8 && bitDepth !== 16) {
    throw new Error('Invalid bit depth. Must be one of 1, 2, 4, 8, or 16.');
  }
  if (![0, 2, 3, 4, 6].includes(colorType)) {
    throw new Error('Invalid color type. Must be one of 0, 2, 3, 4, or 6.');
  }
  if (compressionMethod !== 0) {
    throw new Error('Invalid compression method. Only method 0 is supported.');
  }
  if (filterMethod !== 0) {
    throw new Error('Invalid filter method. Only method 0 is supported.');
  }
  if (interlaceMethod !== 0 && interlaceMethod !== 1) {
    throw new Error('Invalid interlace method. Must be either 0 (no interlace) or 1 (Adam7).');
  }
  const ihdrData = new Uint8Array(13);
  ihdrData[0] = (width >> 24) & 255;
  ihdrData[1] = (width >> 16) & 255;
  ihdrData[2] = (width >> 8) & 255;
  ihdrData[3] = width & 255;
  ihdrData[4] = (height >> 24) & 255;
  ihdrData[5] = (height >> 16) & 255;
  ihdrData[6] = (height >> 8) & 255;
  ihdrData[7] = height & 255;
  ihdrData[8] = bitDepth;
  ihdrData[9] = colorType;
  ihdrData[10] = compressionMethod;
  ihdrData[11] = filterMethod;
  ihdrData[12] = interlaceMethod;
  const ihdrLength = ihdrData.length;
  const ihdrType = new TextEncoder().encode('IHDR');
  const ihdrChunk = new Uint8Array(8 + ihdrLength + 4);
  ihdrChunk[0] = (ihdrLength >> 24) & 255;
  ihdrChunk[1] = (ihdrLength >> 16) & 255;
  ihdrChunk[2] = (ihdrLength >> 8) & 255;
  ihdrChunk[3] = ihdrLength & 255;
  ihdrChunk.set(ihdrType, 4);
  ihdrChunk.set(ihdrData, 8);
  const crc = getChunkCRC(ihdrType, ihdrData);
  ihdrChunk.set(new Uint8Array([(crc >> 24) & 255, (crc >> 16) & 255, (crc >> 8) & 255, crc & 255]), 8 + ihdrLength);
  return ihdrChunk;
}
function decompressImageData(data) {
  try {
    return pako.inflate(data);
  } catch (error) {
    ConsoleError('Error decompressing IDAT data:', error);
    return;
  }
}
function extractChunk(bytes) {
  const size = new DataView(bytes.buffer).getInt32(0);
  return U8Take(bytes, 8 + size + 4);
}
function extractChunks(bytes) {
  let [chunk, rest] = extractChunk(bytes);
  const chunks = [chunk];
  while (rest.byteLength > 0) {
    [chunk, rest] = extractChunk(rest);
    chunks.push(chunk);
  }
  return chunks;
}
function getChunkCRC(type_bytes, data_bytes) {
  return CRC.Init(U8Concat([type_bytes, data_bytes]));
}
function getScanlineSize({ width, bitDepth, colorType }) {
  let samplesPerPixel;
  switch (colorType) {
    case 0:
      samplesPerPixel = 1;
      break;
    case 2:
      samplesPerPixel = 3;
      break;
    case 3:
      samplesPerPixel = 1;
      break;
    case 4:
      samplesPerPixel = 2;
      break;
    case 6:
      samplesPerPixel = 4;
      break;
    default:
      throw new Error('Unknown color type.');
  }
  const bytesPerPixel = (bitDepth * samplesPerPixel) / 8;
  const scanlineSize = 1 + width * bytesPerPixel;
  return scanlineSize;
}
function parseIHDRChunk(IHDR) {
  const data = IHDR.data;
  if (data.length !== 13) {
    throw new Error('Invalid IHDR chunk length. Expected 13 bytes.');
  }
  const width = (data[0] << 24) | (data[1] << 16) | (data[2] << 8) | data[3];
  const height = (data[4] << 24) | (data[5] << 16) | (data[6] << 8) | data[7];
  const bitDepth = data[8];
  const colorType = data[9];
  const compressionMethod = data[10];
  const filterMethod = data[11];
  const interlaceMethod = data[12];
  return {
    bitDepth,
    colorType,
    compressionMethod,
    filterMethod,
    height,
    interlaceMethod,
    width,
  };
}

class Chunk {
  bytes;
  crc;
  data;
  size;
  type;
  constructor(bytes) {
    this.bytes = bytes;
    const { crc, data, size, type } = analyzeChunk(bytes);
    this.crc = crc;
    this.data = data;
    this.size = size;
    this.type = type;
  }
}

// src/lib/png-inspect.ts
function PNGInspect(png_buffer, output) {
  const [chunkSignature, rest] = U8Take(png_buffer, 8);
  const chunks = extractChunks(rest);
  output(['Signature']);
  output([...U8ToHex(chunkSignature)]);
  output();
  let idat_datas = [];
  let total_idat_size = 0;
  let IHDR = undefined;
  for (const chunk of chunks) {
    const { data, size, type, crc } = analyzeChunk(chunk);
    if (U8ToASCII(type) === 'IDAT') {
      idat_datas.push(data);
      total_idat_size += size;
    }
    output(['Chunk']);
    if (U8ToASCII(type) === 'IHDR') {
      IHDR = new Chunk(chunk);
      output([...U8ToHex(chunk)]);
    }
    output(['size:', size]);
    output(['type:', U8ToASCII(type)]);
    output(['crc:', ...U8ToHex(crc)]);
    output(['computed crc:', ...U8ToHex(U8FromUint32(CRC.Init(U8Concat([type, data]))))]);
    output();
  }
  output(['Total IDAT Chunks:', idat_datas.length]);
  output(['Total IDAT Compressed Size:', total_idat_size]);
  const compressed_bytes = U8Concat(idat_datas);
  output(['Compressed Data Size:', compressed_bytes.byteLength]);
  output(['Decompressing Data']);
  const decompressed_bytes = decompressImageData(compressed_bytes);
  if (!decompressed_bytes) throw 'error: decompressed_bytes';
  output(['Decompressed Data Size:', decompressed_bytes.byteLength]);
  output();
  if (!IHDR) throw 'error: IHDR';
  const { bitDepth, colorType, compressionMethod, filterMethod, height, interlaceMethod, width } = parseIHDRChunk(IHDR);
  output(['Width:', width]);
  output(['Height:', height]);
  output(['BitDepth:', bitDepth]);
  output(['ColorType:', colorType]);
  output(['CompressionMethod:', compressionMethod]);
  output(['FilterMethod:', filterMethod]);
  output(['InterlaceMethod:', interlaceMethod]);
  output();
  output(['Extracting Scanlines']);
  const scanlineSize = getScanlineSize({ width, bitDepth, colorType });
  output(['Scanline Size:', scanlineSize]);
  const scanlines = U8Split(decompressed_bytes, scanlineSize);
  output([scanlines.length, 'Scanlines Extracted']);
}

// src/lib/ericchase/Algorithm/Array/Array.ts
function ArraySplit(items, count) {
  if (count > items.length) {
    return [items.slice()];
  }
  if (count > 0) {
    const parts = [];
    for (let i = 0; i < items.length; i += count) {
      parts.push(items.slice(i, i + count));
    }
    return parts;
  }
  return [items.slice()];
}

// src/lib/png-split.ts
async function PNGSplit(buffer, height_per_file = 4096, output) {
  const [signatureBytes, rest] = U8Take(buffer, 8);
  const chunks = extractChunks(rest).map((bytes) => new Chunk(bytes));
  const topChunks = [];
  const dataChunks = [];
  const botChunks = [];
  let index = 0;
  while (index < chunks.length) {
    const chunk = chunks[index];
    if (String.fromCharCode(...chunk.type) === 'IDAT') {
      break;
    }
    topChunks.push(chunk);
    index++;
  }
  while (index < chunks.length) {
    const chunk = chunks[index];
    if (String.fromCharCode(...chunk.type) !== 'IDAT') {
      break;
    }
    dataChunks.push(chunk);
    index++;
  }
  while (index < chunks.length) {
    const chunk = chunks[index];
    botChunks.push(chunk);
    index++;
  }
  output?.(['Extract IHDR and Parse']);
  const IHDR = topChunks.find((chunk) => U8ToASCII(chunk.type) === 'IHDR');
  if (!IHDR) throw 'error: IHDR';
  const { bitDepth, colorType, compressionMethod, filterMethod, height, interlaceMethod, width } = parseIHDRChunk(IHDR);
  const compressed_bytes = U8Concat(dataChunks.map((chunk) => chunk.data));
  output?.(['Compressed Data Size:', compressed_bytes.byteLength]);
  output?.(['Decompressing Data']);
  const decompressed_bytes = decompressImageData(compressed_bytes);
  if (!decompressed_bytes) throw 'error: decompressed_bytes';
  output?.(['Decompressed Data Size:', decompressed_bytes.byteLength]);
  const topChunksWithoutIHDR = topChunks.filter((chunk) => U8ToASCII(chunk.type) !== 'IHDR');
  output?.(['Extracting Scanlines']);
  const scanlineSize = getScanlineSize({ width, bitDepth, colorType });
  const scanlines = U8Split(decompressed_bytes, scanlineSize);
  output?.([scanlines.length, 'Scanlines Extracted']);
  function checkScanlineFilterBytes(decompressedData, scanlineSize2) {
    for (let i = 0; i < decompressedData.length; i += scanlineSize2) {
      const filterByte = decompressedData[i];
      if (filterByte < 0 || filterByte > 4) {
        ConsoleError(`Invalid filter byte at scanline ${i / scanlineSize2}: ${filterByte}`);
        return false;
      }
    }
    return true;
  }
  function validateScanline(scanline) {
    let samplesPerPixel;
    switch (colorType) {
      case 0:
        samplesPerPixel = 1;
        break;
      case 2:
        samplesPerPixel = 3;
        break;
      case 3:
        samplesPerPixel = 1;
        break;
      case 4:
        samplesPerPixel = 2;
        break;
      case 6:
        samplesPerPixel = 4;
        break;
      default:
        throw new Error('Unknown color type.');
    }
    const bytesPerPixel = (bitDepth * samplesPerPixel) / 8;
    const scanlineSize2 = 1 + width * bytesPerPixel;
    const filterByte = scanline[0];
    if (filterByte < 0 || filterByte > 4) {
      ConsoleError(`Invalid filter byte: ${filterByte}`);
      return false;
    }
    const expectedDataLength = width * bytesPerPixel;
    const scanlineDataLength = scanline.length - 1;
    if (scanlineDataLength !== expectedDataLength) {
      ConsoleError(`Incorrect scanline data length: expected ${expectedDataLength}, got ${scanlineDataLength}`);
      return false;
    }
    return true;
  }
  output?.(['Validating Scanlines']);
  for (const scanline of scanlines) {
    validateScanline(scanline);
  }
  output?.(['Creating New PNGs']);
  const scanline_groups = ArraySplit(scanlines, height_per_file);
  const png_out_buffers = [];
  for (let index2 = 0; index2 < scanline_groups.length; index2++) {
    output?.(['PNG', index2]);
    const group = scanline_groups[index2];
    const decompressed_data = U8Concat(group);
    checkScanlineFilterBytes(decompressed_data, scanlineSize);
    const compressed_data = compressImageData(decompressed_data);
    if (!compressed_data) throw 'error: compressed_data';
    output?.(['compressed length:', compressed_data.byteLength]);
    const newIDAT = createIDATchunk(compressed_data);
    const newIHDR = createIHDRchunk({ width, height: group.length, bitDepth, colorType, compressionMethod, filterMethod, interlaceMethod });
    output?.(['new IHDR:', ...U8ToHex(newIHDR)]);
    png_out_buffers.push(U8Concat([signatureBytes, newIHDR, ...topChunksWithoutIHDR.map((_) => _.bytes), newIDAT, ...botChunks.map((_) => _.bytes)]));
  }
  return png_out_buffers;
}

// src/index.ts
function resetViewer() {
  selected_file = undefined;
  file_picker?.classList.remove('quiet-mode');
  image_viewer?.classList.remove('image-loaded');
  image_viewer?.querySelector('img')?.remove();
  for (const gap of image_viewer_gaps ?? []) {
    gap.classList.add('remove');
  }
  for (const button of edit_buttons?.querySelectorAll('button') ?? []) {
    button.disabled = true;
  }
}
async function showImageInViewer(file, done) {
  try {
    if (file.type !== 'image/png') {
      throw `Error: Could not process "${file.name}".\nPlease upload PNG only.`;
    }
    selected_file = file;
    const img = await new Promise((resolve, reject) => {
      const img2 = document.createElement('img');
      img2.src = URL.createObjectURL(file);
      img2.addEventListener('load', () => resolve(img2));
      img2.addEventListener('error', reject);
    });
    for (const gap of image_viewer_gaps ?? []) {
      gap.classList.remove('remove');
    }
    if (image_viewer) {
      image_viewer.querySelector('img')?.remove();
      image_viewer.classList.add('image-loaded');
      image_viewer.classList.remove('remove');
      image_viewer.appendChild(img);
    }
    if (edit_buttons) {
      for (const button of edit_buttons.querySelectorAll('button')) {
        button.disabled = false;
      }
    }
  } catch (error) {
    ConsoleError(error);
    addTextsToOutput(error, true);
    resetViewer();
  }
}
async function addImagesToOutput(buffers) {
  const imgs = [];
  for (const buffer of buffers) {
    try {
      const img_url = URL.createObjectURL(new Blob([buffer], { type: 'image/png' }));
      const img = await new Promise((resolve, reject) => {
        const img2 = document.createElement('img');
        img2.src = img_url;
        img2.addEventListener('load', () => resolve(img2));
        img2.addEventListener('error', reject);
      });
      imgs.push(img);
    } catch (error) {
      ConsoleError(error);
    }
  }
  if (output_container) {
    output_container.classList.remove('remove');
    for (const gap of output_container_gaps ?? []) {
      gap.classList.remove('remove');
    }
    for (const img of imgs.reverse()) {
      output_container.prepend(img);
    }
    imgs.at(-1)?.scrollIntoView(false);
  }
  return imgs;
}
function addTextsToOutput(texts, is_error = false) {
  try {
    if (!Array.isArray(texts)) {
      texts = [texts];
    }
    if (output_container) {
      output_container.classList.remove('remove');
      for (const gap of output_container_gaps ?? []) {
        gap.classList.remove('remove');
      }
      const div_outer = document.createElement('div');
      const div_inner = document.createElement('div');
      const pre = document.createElement('pre');
      pre.textContent = texts.join('\n');
      if (is_error) {
        pre.classList.add('error-message');
        const delete_button = document.createElement('div');
        delete_button.classList.add('delete-output');
        delete_button.textContent = 'X';
        div_inner.appendChild(delete_button);
        delete_button.addEventListener('click', () => {
          div_outer.remove();
        });
      }
      div_inner.appendChild(pre);
      div_outer.appendChild(div_inner);
      output_container.prepend(div_outer);
      div_outer.scrollIntoView(false);
      return div_outer;
    }
  } catch (error) {
    ConsoleError(error);
  }
}
document.documentElement.addEventListener('dragover', (event) => event.preventDefault());
var file_picker = document.querySelector('#file-picker');
var image_viewer = document.querySelector('#image-viewer');
var image_viewer_gaps = document.querySelectorAll('.image-viewer-gap');
var edit_buttons = document.querySelector('#edit-buttons');
var btn_inspect = document.querySelector('#btn-inspect');
var btn_split = document.querySelector('#btn-split');
var output_container = document.querySelector('#output-container');
var output_container_gaps = document.querySelectorAll('.output-container-gap');
var selected_file = undefined;
if (file_picker) {
  const onDragEnd = () => {
    file_picker.classList.remove('hover');
  };
  setupDragAndDropFilePicker(
    file_picker,
    {
      onDragEnter() {
        file_picker.classList.add('hover');
      },
      onDragLeave: onDragEnd,
      onDragEnd,
      onDrop: onDragEnd,
      onUploadStart() {
        selected_file = undefined;
        file_picker.classList.add('quiet-mode');
      },
      onUploadNextFile: showImageInViewer,
      onUploadError(error) {
        addTextsToOutput(error, true);
      },
    },
    {
      accept: '.png',
    },
  );
}
if (btn_inspect instanceof HTMLButtonElement) {
  btn_inspect.disabled = true;
  btn_inspect.addEventListener('click', async () => {
    try {
      const bytes = await GetBytes(selected_file);
      const name = selected_file?.name;
      if (bytes) {
        const logs = [];
        if (name) logs.push(`"${name}"\n`);
        PNGInspect(bytes, (data = []) => {
          logs.push(data.join(' '));
        });
        addTextsToOutput(logs);
        addTextsToOutput([`Inspection report for "${name}"`]);
      }
    } catch (error) {
      ConsoleError(error);
    }
  });
}
if (btn_split instanceof HTMLButtonElement) {
  btn_split.disabled = true;
  btn_split.addEventListener('click', async () => {
    const bytes = await GetBytes(selected_file);
    const name = selected_file?.name;
    if (bytes) {
      const size_input = document.querySelector('#split-size');
      const size = size_input instanceof HTMLInputElement ? Number.parseInt(size_input.value ?? '1000') : 1000;
      const output_buffers = await PNGSplit(bytes, size);
      await addImagesToOutput(output_buffers);
      addTextsToOutput([`Split results for "${name}"`, '', `Size: ${size_input}`]);
    }
  });
}

//# debugId=FA934AF1A6A0C64B64756E2164756E21
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjXFxsaWJcXGVyaWNjaGFzZVxcQWxnb3JpdGhtXFxTbGVlcC50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxEZXNpZ24gUGF0dGVyblxcT2JzZXJ2ZXJcXFN0b3JlLnRzIiwgInNyY1xcbGliXFxlcmljY2hhc2VcXFV0aWxpdHlcXENvbnNvbGUudHMiLCAic3JjXFxsaWJcXGVyaWNjaGFzZVxcVXRpbGl0eVxcSm9iUXVldWUudHMiLCAic3JjXFxsaWJcXGVyaWNjaGFzZVxcVXRpbGl0eVxcUmVjdXJzaXZlQXN5bmNJdGVyYXRvci50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxXZWIgQVBJXFxEYXRhVHJhbnNmZXIudHMiLCAic3JjXFxsaWJcXGVyaWNjaGFzZVxcQWxnb3JpdGhtXFxBcnJheVxcVWludDhBcnJheS50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxBbGdvcml0aG1cXFN0cmVhbVxcUmVhZEFsbC50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxXZWIgQVBJXFxGaWxlLnRzIiwgInNyY1xcbGliXFxlcmljY2hhc2VcXFdlYiBBUElcXEZpbGVTeXN0ZW1fVXRpbGl0eS50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxXZWIgQVBJXFxIVE1MSW5wdXRFbGVtZW50LnRzIiwgInNyY1xcY29tcG9uZW50c1xcZHJhZy1hbmQtZHJvcC1maWxlLXBpY2tlclxcZHJhZy1hbmQtZHJvcC1maWxlLXBpY2tlci50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxBbGdvcml0aG1cXE1hdGhcXENSQy50cyIsICJub2RlX21vZHVsZXNcXHBha29cXGRpc3RcXHBha28uZXNtLm1qcyIsICJzcmNcXGxpYlxccG5nLnRzIiwgInNyY1xcbGliXFxwbmctaW5zcGVjdC50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxBbGdvcml0aG1cXEFycmF5XFxBcnJheS50cyIsICJzcmNcXGxpYlxccG5nLXNwbGl0LnRzIiwgInNyY1xcaW5kZXgudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbCiAgICAiZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIFNsZWVwKG1zOiBudW1iZXIpIHtcbiAgYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgbXMpKTtcbn1cbiIsCiAgICAiZXhwb3J0IHR5cGUgU3Vic2NyaXB0aW9uQ2FsbGJhY2s8VmFsdWU+ID0gKHZhbHVlOiBWYWx1ZSwgdW5zdWJzY3JpYmU6ICgpID0+IHZvaWQpID0+IHZvaWQ7XG5leHBvcnQgdHlwZSBVcGRhdGVDYWxsYmFjazxWYWx1ZT4gPSAodmFsdWU6IFZhbHVlKSA9PiBWYWx1ZTtcblxuZXhwb3J0IGNsYXNzIENvbnN0PFZhbHVlPiB7XG4gIHByb3RlY3RlZCBzdWJzY3JpcHRpb25TZXQgPSBuZXcgU2V0PFN1YnNjcmlwdGlvbkNhbGxiYWNrPFZhbHVlPj4oKTtcbiAgY29uc3RydWN0b3IocHJvdGVjdGVkIHZhbHVlPzogVmFsdWUpIHt9XG4gIHN1YnNjcmliZShjYWxsYmFjazogU3Vic2NyaXB0aW9uQ2FsbGJhY2s8VmFsdWU+KTogKCkgPT4gdm9pZCB7XG4gICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuYWRkKGNhbGxiYWNrKTtcbiAgICBpZiAodGhpcy52YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBjYWxsYmFjayh0aGlzLnZhbHVlLCAoKSA9PiB7XG4gICAgICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmRlbGV0ZShjYWxsYmFjayk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmRlbGV0ZShjYWxsYmFjayk7XG4gICAgfTtcbiAgfVxuICBnZXQoKTogUHJvbWlzZTxWYWx1ZT4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZTxWYWx1ZT4oKHJlc29sdmUpID0+IHtcbiAgICAgIHRoaXMuc3Vic2NyaWJlKCh2YWx1ZSwgdW5zdWJzY3JpYmUpID0+IHtcbiAgICAgICAgdW5zdWJzY3JpYmUoKTtcbiAgICAgICAgcmVzb2x2ZSh2YWx1ZSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuICBzZXQodmFsdWU6IFZhbHVlKTogdm9pZCB7XG4gICAgaWYgKHRoaXMudmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuICAgICAgZm9yIChjb25zdCBjYWxsYmFjayBvZiB0aGlzLnN1YnNjcmlwdGlvblNldCkge1xuICAgICAgICBjYWxsYmFjayh2YWx1ZSwgKCkgPT4ge1xuICAgICAgICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmRlbGV0ZShjYWxsYmFjayk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgU3RvcmU8VmFsdWU+IHtcbiAgcHJvdGVjdGVkIGN1cnJlbnRWYWx1ZTogVmFsdWU7XG4gIHByb3RlY3RlZCBzdWJzY3JpcHRpb25TZXQgPSBuZXcgU2V0PFN1YnNjcmlwdGlvbkNhbGxiYWNrPFZhbHVlPj4oKTtcbiAgY29uc3RydWN0b3IoXG4gICAgcHJvdGVjdGVkIGluaXRpYWxWYWx1ZTogVmFsdWUsXG4gICAgcHJvdGVjdGVkIG5vdGlmeU9uQ2hhbmdlT25seTogYm9vbGVhbiA9IGZhbHNlLFxuICApIHtcbiAgICB0aGlzLmN1cnJlbnRWYWx1ZSA9IGluaXRpYWxWYWx1ZTtcbiAgfVxuICBzdWJzY3JpYmUoY2FsbGJhY2s6IFN1YnNjcmlwdGlvbkNhbGxiYWNrPFZhbHVlPik6ICgpID0+IHZvaWQge1xuICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmFkZChjYWxsYmFjayk7XG4gICAgY29uc3QgdW5zdWJzY3JpYmUgPSAoKSA9PiB7XG4gICAgICB0aGlzLnN1YnNjcmlwdGlvblNldC5kZWxldGUoY2FsbGJhY2spO1xuICAgIH07XG4gICAgY2FsbGJhY2sodGhpcy5jdXJyZW50VmFsdWUsIHVuc3Vic2NyaWJlKTtcbiAgICByZXR1cm4gdW5zdWJzY3JpYmU7XG4gIH1cbiAgZ2V0KCk6IFByb21pc2U8VmFsdWU+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2U8VmFsdWU+KChyZXNvbHZlKSA9PiB7XG4gICAgICB0aGlzLnN1YnNjcmliZSgodmFsdWUsIHVuc3Vic2NyaWJlKSA9PiB7XG4gICAgICAgIHVuc3Vic2NyaWJlKCk7XG4gICAgICAgIHJlc29sdmUodmFsdWUpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbiAgc2V0KHZhbHVlOiBWYWx1ZSk6IHZvaWQge1xuICAgIGlmICh0aGlzLm5vdGlmeU9uQ2hhbmdlT25seSAmJiB0aGlzLmN1cnJlbnRWYWx1ZSA9PT0gdmFsdWUpIHJldHVybjtcbiAgICB0aGlzLmN1cnJlbnRWYWx1ZSA9IHZhbHVlO1xuICAgIGZvciAoY29uc3QgY2FsbGJhY2sgb2YgdGhpcy5zdWJzY3JpcHRpb25TZXQpIHtcbiAgICAgIGNhbGxiYWNrKHZhbHVlLCAoKSA9PiB7XG4gICAgICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmRlbGV0ZShjYWxsYmFjayk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cbiAgdXBkYXRlKGNhbGxiYWNrOiBVcGRhdGVDYWxsYmFjazxWYWx1ZT4pOiB2b2lkIHtcbiAgICB0aGlzLnNldChjYWxsYmFjayh0aGlzLmN1cnJlbnRWYWx1ZSkpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBPcHRpb25hbDxWYWx1ZT4ge1xuICBwcm90ZWN0ZWQgc3RvcmU6IFN0b3JlPFZhbHVlIHwgdW5kZWZpbmVkPjtcbiAgY29uc3RydWN0b3Iobm90aWZ5T25DaGFuZ2VPbmx5ID0gZmFsc2UpIHtcbiAgICB0aGlzLnN0b3JlID0gbmV3IFN0b3JlPFZhbHVlIHwgdW5kZWZpbmVkPih1bmRlZmluZWQsIG5vdGlmeU9uQ2hhbmdlT25seSk7XG4gIH1cbiAgc3Vic2NyaWJlKGNhbGxiYWNrOiBTdWJzY3JpcHRpb25DYWxsYmFjazxWYWx1ZSB8IHVuZGVmaW5lZD4pOiAoKSA9PiB2b2lkIHtcbiAgICByZXR1cm4gdGhpcy5zdG9yZS5zdWJzY3JpYmUoY2FsbGJhY2spO1xuICB9XG4gIGdldCgpOiBQcm9taXNlPFZhbHVlIHwgdW5kZWZpbmVkPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPFZhbHVlIHwgdW5kZWZpbmVkPigocmVzb2x2ZSkgPT4ge1xuICAgICAgdGhpcy5zdWJzY3JpYmUoKHZhbHVlLCB1bnN1YnNjcmliZSkgPT4ge1xuICAgICAgICB1bnN1YnNjcmliZSgpO1xuICAgICAgICByZXNvbHZlKHZhbHVlKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG4gIHNldCh2YWx1ZTogVmFsdWUgfCB1bmRlZmluZWQpOiB2b2lkIHtcbiAgICB0aGlzLnN0b3JlLnNldCh2YWx1ZSk7XG4gIH1cbiAgdXBkYXRlKGNhbGxiYWNrOiBVcGRhdGVDYWxsYmFjazxWYWx1ZSB8IHVuZGVmaW5lZD4pOiB2b2lkIHtcbiAgICB0aGlzLnN0b3JlLnVwZGF0ZShjYWxsYmFjayk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIENvbXBvdW5kU3Vic2NyaXB0aW9uPFQgZXh0ZW5kcyBhbnlbXT4oc3RvcmVzOiB7IFtLIGluIGtleW9mIFRdOiBTdG9yZTxUW0tdPiB8IE9wdGlvbmFsPFRbS10+IH0sIGNhbGxiYWNrOiBTdWJzY3JpcHRpb25DYWxsYmFjazx7IFtLIGluIGtleW9mIFRdOiBUW0tdIHwgdW5kZWZpbmVkIH0+KTogKCkgPT4gdm9pZCB7XG4gIGNvbnN0IHVuc3ViczogKCgpID0+IHZvaWQpW10gPSBbXTtcbiAgY29uc3QgdW5zdWJzY3JpYmUgPSAoKSA9PiB7XG4gICAgZm9yIChjb25zdCB1bnN1YiBvZiB1bnN1YnMpIHtcbiAgICAgIHVuc3ViKCk7XG4gICAgfVxuICB9O1xuICBjb25zdCB2YWx1ZXMgPSBbXSBhcyB7IFtLIGluIGtleW9mIFRdOiBUW0tdIHwgdW5kZWZpbmVkIH07XG4gIGNvbnN0IGNhbGxiYWNrX2hhbmRsZXIgPSAoKSA9PiB7XG4gICAgaWYgKHZhbHVlcy5sZW5ndGggPT09IHN0b3Jlcy5sZW5ndGgpIHtcbiAgICAgIGNhbGxiYWNrKHZhbHVlcywgdW5zdWJzY3JpYmUpO1xuICAgIH1cbiAgfTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdG9yZXMubGVuZ3RoOyBpKyspIHtcbiAgICBzdG9yZXNbaV0uc3Vic2NyaWJlKCh2YWx1ZSwgdW5zdWJzY3JpYmUpID0+IHtcbiAgICAgIHZhbHVlc1tpXSA9IHZhbHVlO1xuICAgICAgdW5zdWJzW2ldID0gdW5zdWJzY3JpYmU7XG4gICAgICBpZiAodmFsdWVzLmxlbmd0aCA9PT0gc3RvcmVzLmxlbmd0aCkge1xuICAgICAgICBjYWxsYmFja19oYW5kbGVyKCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbiAgcmV0dXJuIHVuc3Vic2NyaWJlO1xufVxuIiwKICAgICJleHBvcnQgZnVuY3Rpb24gQ29uc29sZUxvZyguLi5pdGVtczogYW55W10pIHtcbiAgY29uc29sZVsnbG9nJ10oLi4uaXRlbXMpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIENvbnNvbGVFcnJvciguLi5pdGVtczogYW55W10pIHtcbiAgY29uc29sZVsnZXJyb3InXSguLi5pdGVtcyk7XG59XG4iLAogICAgImltcG9ydCB7IFN0b3JlIH0gZnJvbSAnLi4vRGVzaWduIFBhdHRlcm4vT2JzZXJ2ZXIvU3RvcmUuanMnO1xuaW1wb3J0IHsgQ29uc29sZUxvZyB9IGZyb20gJy4vQ29uc29sZS5qcyc7XG5cbmV4cG9ydCB0eXBlIFN1YnNjcmlwdGlvbkNhbGxiYWNrPFJlc3VsdCwgVGFnPiA9IChyZXN1bHQ/OiBSZXN1bHQsIGVycm9yPzogRXJyb3IsIHRhZz86IFRhZykgPT4geyBhYm9ydDogYm9vbGVhbiB9IHwgdm9pZDtcblxuZXhwb3J0IGNsYXNzIEpvYlF1ZXVlPFJlc3VsdCA9IHZvaWQsIFRhZyA9IHZvaWQ+IHtcbiAgLyoqXG4gICAqIDA6IE5vIGRlbGF5LiAtMTogQ29uc2VjdXRpdmUuXG4gICAqL1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgZGVsYXlfbXM6IG51bWJlcikge31cbiAgLyoqXG4gICAqICEgV2F0Y2ggb3V0IGZvciBjaXJjdWxhciBjYWxscyAhXG4gICAqXG4gICAqIFNldHMgdGhlIGBhYm9ydGVkYCBzdGF0ZSBhbmQgcmVzb2x2ZXMgd2hlbiBjdXJyZW50bHkgcnVubmluZyBqb2JzIGZpbmlzaC5cbiAgICovXG4gIHB1YmxpYyBhc3luYyBhYm9ydCgpIHtcbiAgICB0aGlzLmFib3J0ZWQgPSB0cnVlO1xuICAgIGF3YWl0IHRoaXMuZG9uZTtcbiAgfVxuICBwdWJsaWMgYWRkKGZuOiAoKSA9PiBQcm9taXNlPFJlc3VsdD4sIHRhZz86IFRhZykge1xuICAgIGlmICh0aGlzLmFib3J0ZWQgPT09IGZhbHNlKSB7XG4gICAgICB0aGlzLnF1ZXVlLnB1c2goeyBmbiwgdGFnIH0pO1xuICAgICAgaWYgKHRoaXMucnVubmluZyA9PT0gZmFsc2UpIHtcbiAgICAgICAgdGhpcy5ydW5uaW5nID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5ydW4oKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgLyoqXG4gICAqIFJldHVybnMgYSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2hlbiBqb2JzIGZpbmlzaC5cbiAgICovXG4gIHB1YmxpYyBnZXQgZG9uZSgpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUpID0+IHtcbiAgICAgIHRoaXMucnVubmluZ0NvdW50LnN1YnNjcmliZSgoY291bnQpID0+IHtcbiAgICAgICAgaWYgKGNvdW50ID09PSAwKSByZXNvbHZlKCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuICAvKipcbiAgICogUmVzZXRzIHRoZSBKb2JRdWV1ZSB0byBhbiBpbml0aWFsIHN0YXRlLCBrZWVwaW5nIHN1YnNjcmlwdGlvbnMgYWxpdmUuXG4gICAqXG4gICAqIEB0aHJvd3MgSWYgY2FsbGVkIHdoZW4gam9icyBhcmUgY3VycmVudGx5IHJ1bm5pbmcuXG4gICAqL1xuICBwdWJsaWMgYXN5bmMgcmVzZXQoKSB7XG4gICAgaWYgKHRoaXMucnVubmluZyA9PT0gdHJ1ZSB8fCAoYXdhaXQgdGhpcy5ydW5uaW5nQ291bnQuZ2V0KCkpID4gMCkge1xuICAgICAgdGhyb3cgJ1dhcm5pbmc6IFdhaXQgZm9yIHJ1bm5pbmcgam9icyB0byBmaW5pc2ggYmVmb3JlIGNhbGxpbmcgcmVzZXQuIGBhd2FpdCBKb2JRdWV1ZS5kb25lO2AnO1xuICAgIH1cbiAgICB0aGlzLmFib3J0ZWQgPSBmYWxzZTtcbiAgICB0aGlzLmNvbXBsZXRpb25Db3VudCA9IDA7XG4gICAgdGhpcy5xdWV1ZS5sZW5ndGggPSAwO1xuICAgIHRoaXMucXVldWVJbmRleCA9IDA7XG4gICAgdGhpcy5yZXN1bHRzLmxlbmd0aCA9IDA7XG4gIH1cbiAgcHVibGljIHN1YnNjcmliZShjYWxsYmFjazogU3Vic2NyaXB0aW9uQ2FsbGJhY2s8UmVzdWx0LCBUYWc+KTogKCkgPT4gdm9pZCB7XG4gICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuYWRkKGNhbGxiYWNrKTtcbiAgICBmb3IgKGNvbnN0IHJlc3VsdCBvZiB0aGlzLnJlc3VsdHMpIHtcbiAgICAgIGlmIChjYWxsYmFjayhyZXN1bHQudmFsdWUsIHJlc3VsdC5lcnJvcik/LmFib3J0ID09PSB0cnVlKSB7XG4gICAgICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmRlbGV0ZShjYWxsYmFjayk7XG4gICAgICAgIHJldHVybiAoKSA9PiB7fTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmRlbGV0ZShjYWxsYmFjayk7XG4gICAgfTtcbiAgfVxuICBwcm90ZWN0ZWQgYWJvcnRlZCA9IGZhbHNlO1xuICBwcm90ZWN0ZWQgY29tcGxldGlvbkNvdW50ID0gMDtcbiAgcHJvdGVjdGVkIHF1ZXVlOiB7IGZuOiAoKSA9PiBQcm9taXNlPFJlc3VsdD47IHRhZz86IFRhZyB9W10gPSBbXTtcbiAgcHJvdGVjdGVkIHF1ZXVlSW5kZXggPSAwO1xuICBwcm90ZWN0ZWQgcmVzdWx0czogeyB2YWx1ZT86IFJlc3VsdDsgZXJyb3I/OiBFcnJvciB9W10gPSBbXTtcbiAgcHJvdGVjdGVkIHJ1bm5pbmcgPSBmYWxzZTtcbiAgcHJvdGVjdGVkIHJ1bm5pbmdDb3VudCA9IG5ldyBTdG9yZSgwKTtcbiAgcHJvdGVjdGVkIHN1YnNjcmlwdGlvblNldCA9IG5ldyBTZXQ8U3Vic2NyaXB0aW9uQ2FsbGJhY2s8UmVzdWx0LCBUYWc+PigpO1xuICBwcm90ZWN0ZWQgcnVuKCkge1xuICAgIGlmICh0aGlzLmFib3J0ZWQgPT09IGZhbHNlICYmIHRoaXMucXVldWVJbmRleCA8IHRoaXMucXVldWUubGVuZ3RoKSB7XG4gICAgICBjb25zdCB7IGZuLCB0YWcgfSA9IHRoaXMucXVldWVbdGhpcy5xdWV1ZUluZGV4KytdO1xuICAgICAgKGFzeW5jICgpID0+IHtcbiAgICAgICAgdGhpcy5ydW5uaW5nQ291bnQudXBkYXRlKChjb3VudCkgPT4ge1xuICAgICAgICAgIHJldHVybiBjb3VudCArIDE7XG4gICAgICAgIH0pO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHZhbHVlID0gYXdhaXQgZm4oKTtcbiAgICAgICAgICB0aGlzLnNlbmQoeyB2YWx1ZSwgdGFnIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgQ29uc29sZUxvZyhlcnJvcik7XG4gICAgICAgICAgdGhpcy5zZW5kKHsgZXJyb3IsIHRhZyB9KTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnJ1bm5pbmdDb3VudC51cGRhdGUoKGNvdW50KSA9PiB7XG4gICAgICAgICAgcmV0dXJuIGNvdW50IC0gMTtcbiAgICAgICAgfSk7XG4gICAgICAgIGlmICh0aGlzLmRlbGF5X21zIDwgMCkge1xuICAgICAgICAgIHRoaXMucnVuKCk7XG4gICAgICAgIH1cbiAgICAgIH0pKCk7XG4gICAgICBpZiAodGhpcy5kZWxheV9tcyA+PSAwKSB7XG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4gdGhpcy5ydW4oKSwgdGhpcy5kZWxheV9tcyk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucnVubmluZyA9IGZhbHNlO1xuICAgIH1cbiAgfVxuICBwcm90ZWN0ZWQgc2VuZChyZXN1bHQ6IHsgdmFsdWU/OiBSZXN1bHQ7IGVycm9yPzogRXJyb3I7IHRhZz86IFRhZyB9KSB7XG4gICAgaWYgKHRoaXMuYWJvcnRlZCA9PT0gZmFsc2UpIHtcbiAgICAgIHRoaXMuY29tcGxldGlvbkNvdW50Kys7XG4gICAgICB0aGlzLnJlc3VsdHMucHVzaChyZXN1bHQpO1xuICAgICAgZm9yIChjb25zdCBjYWxsYmFjayBvZiB0aGlzLnN1YnNjcmlwdGlvblNldCkge1xuICAgICAgICBpZiAoY2FsbGJhY2socmVzdWx0LnZhbHVlLCByZXN1bHQuZXJyb3IsIHJlc3VsdC50YWcpPy5hYm9ydCA9PT0gdHJ1ZSkge1xuICAgICAgICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmRlbGV0ZShjYWxsYmFjayk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiIsCiAgICAiaW1wb3J0IHR5cGUgeyBTeW5jQXN5bmNJdGVyYWJsZSB9IGZyb20gJy4vVHlwZXMuanMnO1xuXG5leHBvcnQgY2xhc3MgUmVjdXJzaXZlSXRlcmF0b3I8SW4sIE91dD4ge1xuICBjb25zdHJ1Y3Rvcihwcm90ZWN0ZWQgZm46ICh2YWx1ZTogU3luY0FzeW5jSXRlcmFibGU8SW4+LCBwdXNoOiAodmFsdWU6IFN5bmNBc3luY0l0ZXJhYmxlPEluPikgPT4gdm9pZCkgPT4gU3luY0FzeW5jSXRlcmFibGU8T3V0Pikge31cbiAgYXN5bmMgKml0ZXJhdGUoaW5pdDogU3luY0FzeW5jSXRlcmFibGU8SW4+KTogU3luY0FzeW5jSXRlcmFibGU8T3V0PiB7XG4gICAgY29uc3QgbGlzdDogU3luY0FzeW5jSXRlcmFibGU8SW4+W10gPSBbaW5pdF07XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IGZTRW50cnkgb2YgdGhpcy5mbihsaXN0W2ldLCAodmFsdWUpID0+IHtcbiAgICAgICAgbGlzdC5wdXNoKHZhbHVlKTtcbiAgICAgIH0pKSB7XG4gICAgICAgIHlpZWxkIGZTRW50cnk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iLAogICAgImltcG9ydCB0eXBlIHsgTiB9IGZyb20gJy4uL1V0aWxpdHkvVHlwZXMuanMnO1xuXG5leHBvcnQgY2xhc3MgRGF0YVRyYW5zZmVySXRlbUl0ZXJhdG9yIHtcbiAgbGlzdDogRGF0YVRyYW5zZmVySXRlbVtdID0gW107XG4gIGNvbnN0cnVjdG9yKGl0ZW1zPzogTjxEYXRhVHJhbnNmZXJJdGVtPiB8IERhdGFUcmFuc2Zlckl0ZW1MaXN0IHwgbnVsbCkge1xuICAgIGlmIChpdGVtcyBpbnN0YW5jZW9mIERhdGFUcmFuc2Zlckl0ZW0pIHtcbiAgICAgIHRoaXMubGlzdCA9IFtpdGVtc107XG4gICAgfSBlbHNlIGlmIChpdGVtcyBpbnN0YW5jZW9mIERhdGFUcmFuc2Zlckl0ZW1MaXN0KSB7XG4gICAgICB0aGlzLmxpc3QgPSBBcnJheS5mcm9tKGl0ZW1zKTtcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoaXRlbXMpKSB7XG4gICAgICB0aGlzLmxpc3QgPSBpdGVtcztcbiAgICB9XG4gIH1cbiAgKmdldEFzRW50cnkoKTogR2VuZXJhdG9yPEZpbGVTeXN0ZW1FbnRyeT4ge1xuICAgIGZvciAoY29uc3QgaXRlbSBvZiB0aGlzLmxpc3QpIHtcbiAgICAgIGNvbnN0IGVudHJ5ID0gKGl0ZW0gYXMgRGF0YVRyYW5zZmVySXRlbSAmIHsgZ2V0QXNFbnRyeT86IERhdGFUcmFuc2Zlckl0ZW1bJ3dlYmtpdEdldEFzRW50cnknXSB9KS5nZXRBc0VudHJ5Py4oKSA/PyBpdGVtLndlYmtpdEdldEFzRW50cnk/LigpO1xuICAgICAgaWYgKHR5cGVvZiBGaWxlU3lzdGVtRW50cnkgIT09ICd1bmRlZmluZWQnICYmIGVudHJ5IGluc3RhbmNlb2YgRmlsZVN5c3RlbUVudHJ5KSB7XG4gICAgICAgIHlpZWxkIGVudHJ5O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gVE9ETyBmaWd1cmUgb3V0IHdoYXQgbmVlZHMgdG8gYmUgZG9uZSB0byBndWFyZCB0aGlzIGZvciBjaHJvbWUgYW5kIG90aGVyIGJyb3dzZXJzXG4gICAgICAgIHlpZWxkIGVudHJ5IGFzIEZpbGVTeXN0ZW1FbnRyeTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgKmdldEFzRmlsZSgpOiBHZW5lcmF0b3I8RmlsZT4ge1xuICAgIGZvciAoY29uc3QgaXRlbSBvZiB0aGlzLmxpc3QpIHtcbiAgICAgIGNvbnN0IGZpbGUgPSBpdGVtLmdldEFzRmlsZT8uKCk7XG4gICAgICBpZiAoZmlsZSBpbnN0YW5jZW9mIEZpbGUpIHtcbiAgICAgICAgeWllbGQgZmlsZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgYXN5bmMgKmdldEFzU3RyaW5nKCk6IEFzeW5jR2VuZXJhdG9yPHN0cmluZz4ge1xuICAgIGZvciAoY29uc3QgaXRlbSBvZiB0aGlzLmxpc3QpIHtcbiAgICAgIHlpZWxkIGF3YWl0IG5ldyBQcm9taXNlPHN0cmluZz4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBpZiAodHlwZW9mIGl0ZW0uZ2V0QXNTdHJpbmcgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICBpdGVtLmdldEFzU3RyaW5nKHJlc29sdmUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlamVjdCgpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn1cbiIsCiAgICAiZXhwb3J0IGZ1bmN0aW9uIFU4KGZyb206IEFycmF5TGlrZTxudW1iZXI+ID0gW10pOiBVaW50OEFycmF5IHtcbiAgcmV0dXJuIFVpbnQ4QXJyYXkuZnJvbShmcm9tKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIFU4Q2xhbXBlZChmcm9tOiBBcnJheUxpa2U8bnVtYmVyPiA9IFtdKTogVWludDhBcnJheSB7XG4gIHJldHVybiBVaW50OEFycmF5LmZyb20oVWludDhDbGFtcGVkQXJyYXkuZnJvbShmcm9tKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBVOENvbmNhdChhcnJheXM6IHJlYWRvbmx5IFVpbnQ4QXJyYXlbXSk6IFVpbnQ4QXJyYXkge1xuICBsZXQgdG90YWxMZW5ndGggPSAwO1xuICBmb3IgKGNvbnN0IGFycmF5IG9mIGFycmF5cykge1xuICAgIHRvdGFsTGVuZ3RoICs9IGFycmF5Lmxlbmd0aDtcbiAgfVxuICBjb25zdCByZXN1bHQgPSBuZXcgVWludDhBcnJheSh0b3RhbExlbmd0aCk7XG4gIGxldCBvZmZzZXQgPSAwO1xuICBmb3IgKGNvbnN0IGFycmF5IG9mIGFycmF5cykge1xuICAgIHJlc3VsdC5zZXQoYXJyYXksIG9mZnNldCk7XG4gICAgb2Zmc2V0ICs9IGFycmF5Lmxlbmd0aDtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gVThDb3B5KGJ5dGVzOiBVaW50OEFycmF5LCBjb3VudDogbnVtYmVyLCBvZmZzZXQgPSAwKTogVWludDhBcnJheSB7XG4gIHJldHVybiBieXRlcy5zbGljZShvZmZzZXQsIG9mZnNldCArIGNvdW50KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIFU4RnJvbVN0cmluZyhmcm9tOiBzdHJpbmcpIHtcbiAgcmV0dXJuIG5ldyBUZXh0RW5jb2RlcigpLmVuY29kZShmcm9tKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIFU4RnJvbVVpbnQzMihmcm9tOiBudW1iZXIpOiBVaW50OEFycmF5IHtcbiAgY29uc3QgdThzID0gbmV3IFVpbnQ4QXJyYXkoNCk7XG4gIGNvbnN0IHZpZXcgPSBuZXcgRGF0YVZpZXcodThzLmJ1ZmZlcik7XG4gIHZpZXcuc2V0VWludDMyKDAsIGZyb20gPj4+IDAsIGZhbHNlKTtcbiAgcmV0dXJuIHU4cztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIFU4U3BsaXQoYnl0ZXM6IFVpbnQ4QXJyYXksIGNvdW50OiBudW1iZXIpOiBVaW50OEFycmF5W10ge1xuICBpZiAoY291bnQgPiBieXRlcy5ieXRlTGVuZ3RoKSB7XG4gICAgcmV0dXJuIFtieXRlcy5zbGljZSgpXTtcbiAgfVxuICBpZiAoY291bnQgPiAwKSB7XG4gICAgY29uc3QgcGFydHM6IFVpbnQ4QXJyYXlbXSA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYnl0ZXMubGVuZ3RoOyBpICs9IGNvdW50KSB7XG4gICAgICBwYXJ0cy5wdXNoKGJ5dGVzLnNsaWNlKGksIGkgKyBjb3VudCkpO1xuICAgIH1cbiAgICByZXR1cm4gcGFydHM7XG4gIH1cbiAgcmV0dXJuIFtieXRlcy5zbGljZSgpXTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIFU4VGFrZShieXRlczogVWludDhBcnJheSwgY291bnQ6IG51bWJlcik6IFtVaW50OEFycmF5LCBVaW50OEFycmF5XSB7XG4gIGlmIChjb3VudCA+IGJ5dGVzLmJ5dGVMZW5ndGgpIHtcbiAgICByZXR1cm4gW2J5dGVzLnNsaWNlKCksIG5ldyBVaW50OEFycmF5KCldO1xuICB9XG4gIGlmIChjb3VudCA+IDApIHtcbiAgICBjb25zdCBjaHVua0EgPSBieXRlcy5zbGljZSgwLCBjb3VudCk7XG4gICAgY29uc3QgY2h1bmtCID0gYnl0ZXMuc2xpY2UoY291bnQpO1xuICAgIHJldHVybiBbY2h1bmtBLCBjaHVua0JdO1xuICB9XG4gIHJldHVybiBbbmV3IFVpbnQ4QXJyYXkoKSwgYnl0ZXMuc2xpY2UoKV07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBVOFRha2VFbmQoYnl0ZXM6IFVpbnQ4QXJyYXksIGNvdW50OiBudW1iZXIpOiBbVWludDhBcnJheSwgVWludDhBcnJheV0ge1xuICBpZiAoY291bnQgPiBieXRlcy5ieXRlTGVuZ3RoKSB7XG4gICAgcmV0dXJuIFtieXRlcy5zbGljZSgpLCBuZXcgVWludDhBcnJheSgpXTtcbiAgfVxuICBpZiAoY291bnQgPiAwKSB7XG4gICAgY29uc3QgY2h1bmtBID0gYnl0ZXMuc2xpY2UoYnl0ZXMuYnl0ZUxlbmd0aCAtIGNvdW50KTtcbiAgICBjb25zdCBjaHVua0IgPSBieXRlcy5zbGljZSgwLCBieXRlcy5ieXRlTGVuZ3RoIC0gY291bnQpO1xuICAgIHJldHVybiBbY2h1bmtBLCBjaHVua0JdO1xuICB9XG4gIHJldHVybiBbbmV3IFVpbnQ4QXJyYXkoKSwgYnl0ZXMuc2xpY2UoKV07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBVOFRvQVNDSUkoYnl0ZXM6IFVpbnQ4QXJyYXkpOiBzdHJpbmcge1xuICByZXR1cm4gQXJyYXkuZnJvbShieXRlcylcbiAgICAubWFwKChieXRlKSA9PiBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ5dGUgPj4+IDApKVxuICAgIC5qb2luKCcnKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIFU4VG9EZWNpbWFsKGJ5dGVzOiBVaW50OEFycmF5KTogc3RyaW5nW10ge1xuICByZXR1cm4gQXJyYXkuZnJvbShieXRlcykubWFwKChieXRlKSA9PiAoYnl0ZSA+Pj4gMCkudG9TdHJpbmcoMTApKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIFU4VG9IZXgoYnl0ZXM6IFVpbnQ4QXJyYXkpOiBzdHJpbmdbXSB7XG4gIHJldHVybiBBcnJheS5mcm9tKGJ5dGVzKS5tYXAoKGJ5dGUpID0+IChieXRlID4+PiAwKS50b1N0cmluZygxNikucGFkU3RhcnQoMiwgJzAnKSk7XG59XG4iLAogICAgImltcG9ydCB7IFU4Q29uY2F0IH0gZnJvbSAnLi4vQXJyYXkvVWludDhBcnJheS5qcyc7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBVOFN0cmVhbVJlYWRBbGwoc3RyZWFtOiBSZWFkYWJsZVN0cmVhbTxVaW50OEFycmF5Pikge1xuICBjb25zdCByZWFkZXIgPSBzdHJlYW0uZ2V0UmVhZGVyKCk7XG4gIGNvbnN0IGNodW5rczogVWludDhBcnJheVtdID0gW107XG4gIHdoaWxlICh0cnVlKSB7XG4gICAgY29uc3QgeyBkb25lLCB2YWx1ZSB9ID0gYXdhaXQgcmVhZGVyLnJlYWQoKTtcbiAgICBpZiAodmFsdWUpIHtcbiAgICAgIGNodW5rcy5wdXNoKHZhbHVlKTtcbiAgICB9XG4gICAgaWYgKGRvbmUpIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuICByZXR1cm4gVThDb25jYXQoY2h1bmtzKTtcbn1cbiIsCiAgICAiaW1wb3J0IHsgVThTdHJlYW1SZWFkQWxsIH0gZnJvbSAnLi4vQWxnb3JpdGhtL1N0cmVhbS9SZWFkQWxsLmpzJztcblxuZXhwb3J0IGZ1bmN0aW9uIEdldFdlYmtpdFJlbGF0aXZlUGF0aChmaWxlOiBGaWxlKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgaWYgKHR5cGVvZiBmaWxlLndlYmtpdFJlbGF0aXZlUGF0aCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICByZXR1cm4gZmlsZS53ZWJraXRSZWxhdGl2ZVBhdGg7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIEdldEJ5dGVzKGZpbGU/OiBGaWxlKSB7XG4gIGlmIChmaWxlKSB7XG4gICAgaWYgKHR5cGVvZiBmaWxlLmJ5dGVzICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgcmV0dXJuIGZpbGUuYnl0ZXMoKTtcbiAgICB9XG4gICAgcmV0dXJuIFU4U3RyZWFtUmVhZEFsbChmaWxlLnN0cmVhbSgpKTtcbiAgfVxufVxuIiwKICAgICJleHBvcnQgY2xhc3MgRmlsZVN5c3RlbUVudHJ5SXRlcmF0b3Ige1xuICBsaXN0OiBGaWxlU3lzdGVtRW50cnlbXSA9IFtdO1xuICBjb25zdHJ1Y3RvcihlbnRyaWVzPzogRmlsZVN5c3RlbUVudHJ5IHwgRmlsZVN5c3RlbUVudHJ5W10gfCBudWxsKSB7XG4gICAgaWYgKGVudHJpZXMpIHtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KGVudHJpZXMpKSB7XG4gICAgICAgIHRoaXMubGlzdCA9IGVudHJpZXM7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmxpc3QgPSBbZW50cmllc107XG4gICAgICB9XG4gICAgfVxuICB9XG4gICpnZXREaXJlY3RvcnlFbnRyeSgpOiBHZW5lcmF0b3I8RmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5PiB7XG4gICAgZm9yIChjb25zdCBlbnRyeSBvZiB0aGlzLmxpc3QpIHtcbiAgICAgIGlmIChlbnRyeS5pc0RpcmVjdG9yeSAmJiBlbnRyeSBpbnN0YW5jZW9mIEZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeSkge1xuICAgICAgICB5aWVsZCBlbnRyeTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgKmdldEZpbGVFbnRyeSgpOiBHZW5lcmF0b3I8RmlsZVN5c3RlbUZpbGVFbnRyeT4ge1xuICAgIGZvciAoY29uc3QgZW50cnkgb2YgdGhpcy5saXN0KSB7XG4gICAgICBpZiAodHlwZW9mIEZpbGVTeXN0ZW1GaWxlRW50cnkgIT09ICd1bmRlZmluZWQnICYmIGVudHJ5LmlzRmlsZSAmJiBlbnRyeSBpbnN0YW5jZW9mIEZpbGVTeXN0ZW1GaWxlRW50cnkpIHtcbiAgICAgICAgeWllbGQgZW50cnk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB5aWVsZCBlbnRyeSBhcyBGaWxlU3lzdGVtRmlsZUVudHJ5O1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5SXRlcmF0b3Ige1xuICBsaXN0OiBGaWxlU3lzdGVtRGlyZWN0b3J5RW50cnlbXSA9IFtdO1xuICBjb25zdHJ1Y3RvcihlbnRyaWVzPzogRmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5IHwgRmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5W10gfCBudWxsKSB7XG4gICAgaWYgKGVudHJpZXMgaW5zdGFuY2VvZiBGaWxlU3lzdGVtRGlyZWN0b3J5RW50cnkpIHtcbiAgICAgIHRoaXMubGlzdCA9IFtlbnRyaWVzXTtcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoZW50cmllcykpIHtcbiAgICAgIHRoaXMubGlzdCA9IGVudHJpZXM7XG4gICAgfVxuICB9XG4gIGFzeW5jICpnZXRFbnRyeSgpOiBBc3luY0dlbmVyYXRvcjxGaWxlU3lzdGVtRW50cnk+IHtcbiAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIHRoaXMubGlzdCkge1xuICAgICAgY29uc3QgcmVhZGVyID0gZW50cnkuY3JlYXRlUmVhZGVyKCk7XG4gICAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIGF3YWl0IG5ldyBQcm9taXNlPEZpbGVTeXN0ZW1FbnRyeVtdPigocmVzb2x2ZSwgcmVqZWN0KSA9PiByZWFkZXIucmVhZEVudHJpZXMocmVzb2x2ZSwgcmVqZWN0KSkpIHtcbiAgICAgICAgeWllbGQgZW50cnk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iLAogICAgIi8vIFdlYmtpdCBHdWFyZHNcblxuZXhwb3J0IGZ1bmN0aW9uIEdldFdlYmtpdEVudHJpZXMoZWxlbWVudDogSFRNTElucHV0RWxlbWVudCk6IHJlYWRvbmx5IEZpbGVTeXN0ZW1FbnRyeVtdIHwgdW5kZWZpbmVkIHtcbiAgcmV0dXJuIGVsZW1lbnQud2Via2l0RW50cmllcyA/PyB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBTdXBwb3J0c1dlYmtpdERpcmVjdG9yeSgpOiBib29sZWFuIHtcbiAgcmV0dXJuIC9hbmRyb2lkfGlwaG9uZXxtb2JpbGUvaS50ZXN0KHdpbmRvdy5uYXZpZ2F0b3IudXNlckFnZW50KSA9PT0gdHJ1ZSA/IGZhbHNlIDogdHJ1ZTtcbn1cbiIsCiAgICAiaW1wb3J0IHsgU2xlZXAgfSBmcm9tICcuLi8uLi9saWIvZXJpY2NoYXNlL0FsZ29yaXRobS9TbGVlcC5qcyc7XG5pbXBvcnQgeyBKb2JRdWV1ZSB9IGZyb20gJy4uLy4uL2xpYi9lcmljY2hhc2UvVXRpbGl0eS9Kb2JRdWV1ZS5qcyc7XG5pbXBvcnQgeyBSZWN1cnNpdmVJdGVyYXRvciB9IGZyb20gJy4uLy4uL2xpYi9lcmljY2hhc2UvVXRpbGl0eS9SZWN1cnNpdmVBc3luY0l0ZXJhdG9yLmpzJztcbmltcG9ydCB0eXBlIHsgU3luY0FzeW5jSXRlcmFibGUgfSBmcm9tICcuLi8uLi9saWIvZXJpY2NoYXNlL1V0aWxpdHkvVHlwZXMuanMnO1xuaW1wb3J0IHsgRGF0YVRyYW5zZmVySXRlbUl0ZXJhdG9yIH0gZnJvbSAnLi4vLi4vbGliL2VyaWNjaGFzZS9XZWIgQVBJL0RhdGFUcmFuc2Zlci5qcyc7XG5pbXBvcnQgeyBHZXRXZWJraXRSZWxhdGl2ZVBhdGggfSBmcm9tICcuLi8uLi9saWIvZXJpY2NoYXNlL1dlYiBBUEkvRmlsZS5qcyc7XG5pbXBvcnQgeyBGaWxlU3lzdGVtRGlyZWN0b3J5RW50cnlJdGVyYXRvciwgRmlsZVN5c3RlbUVudHJ5SXRlcmF0b3IgfSBmcm9tICcuLi8uLi9saWIvZXJpY2NoYXNlL1dlYiBBUEkvRmlsZVN5c3RlbV9VdGlsaXR5LmpzJztcbmltcG9ydCB7IEdldFdlYmtpdEVudHJpZXMsIFN1cHBvcnRzV2Via2l0RGlyZWN0b3J5IH0gZnJvbSAnLi4vLi4vbGliL2VyaWNjaGFzZS9XZWIgQVBJL0hUTUxJbnB1dEVsZW1lbnQuanMnO1xuXG5leHBvcnQgZnVuY3Rpb24gc2V0dXBEcmFnQW5kRHJvcEZpbGVQaWNrZXIoXG4gIGNvbnRhaW5lcjogRWxlbWVudCxcbiAgZm46IHtcbiAgICBvbkRyYWdFbmQ/OiAoKSA9PiB2b2lkO1xuICAgIG9uRHJhZ0VudGVyPzogKCkgPT4gdm9pZDtcbiAgICBvbkRyYWdMZWF2ZT86ICgpID0+IHZvaWQ7XG4gICAgb25Ecm9wPzogKCkgPT4gdm9pZDtcbiAgICBvblVwbG9hZEVuZD86ICgpID0+IHZvaWQgfCBQcm9taXNlPHZvaWQ+O1xuICAgIG9uVXBsb2FkRXJyb3I/OiAoZXJyb3I6IGFueSkgPT4gdm9pZCB8IFByb21pc2U8dm9pZD47XG4gICAgb25VcGxvYWROZXh0RmlsZTogKGZpbGU6IEZpbGUsIGRvbmU6ICgpID0+IHZvaWQpID0+IFByb21pc2U8dm9pZD4gfCB2b2lkO1xuICAgIG9uVXBsb2FkU3RhcnQ/OiAoKSA9PiB2b2lkIHwgUHJvbWlzZTx2b2lkPjtcbiAgfSxcbiAgb3B0aW9ucz86IHtcbiAgICBhY2NlcHQ/OiBzdHJpbmc7XG4gICAgZGlyZWN0b3J5PzogYm9vbGVhbjtcbiAgICBtdWx0aXBsZT86IGJvb2xlYW47XG4gIH0sXG4pIHtcbiAgY29uc3QgZWxlbWVudCA9IGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yKCdpbnB1dCcpO1xuICBpZiAoIWVsZW1lbnQpIHtcbiAgICB0aHJvdyAnZHJhZy1hbmQtZHJvcC1maWxlLXBpY2tlciBpbnB1dCBlbGVtZW50IG1pc3NpbmcnO1xuICB9XG4gIGlmIChvcHRpb25zPy5hY2NlcHQpIHtcbiAgICBlbGVtZW50LnNldEF0dHJpYnV0ZSgnYWNjZXB0Jywgb3B0aW9ucy5hY2NlcHQpO1xuICB9XG4gIGlmIChvcHRpb25zPy5kaXJlY3RvcnkgPT09IHRydWUgJiYgU3VwcG9ydHNXZWJraXREaXJlY3RvcnkoKSkge1xuICAgIGVsZW1lbnQudG9nZ2xlQXR0cmlidXRlKCd3ZWJraXRkaXJlY3RvcnknLCB0cnVlKTtcbiAgfVxuICBpZiAob3B0aW9ucz8ubXVsdGlwbGUgPT09IHRydWUpIHtcbiAgICBlbGVtZW50LnRvZ2dsZUF0dHJpYnV0ZSgnbXVsdGlwbGUnLCB0cnVlKTtcbiAgfVxuXG4gIGlmIChmbi5vbkRyYWdFbmQgfHwgZm4ub25EcmFnRW50ZXIgfHwgZm4ub25EcmFnTGVhdmUpIHtcbiAgICBjb25zdCByZW1vdmVMaXN0ZW5lcnMgPSAoKSA9PiB7XG4gICAgICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdsZWF2ZScsIGRyYWdsZWF2ZUhhbmRsZXIpO1xuICAgICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdkcmFnZW5kJywgZHJhZ2VuZEhhbmRsZXIpO1xuICAgICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdkcm9wJywgZHJvcEhhbmRsZXIpO1xuICAgIH07XG4gICAgY29uc3QgZHJhZ2VuZEhhbmRsZXIgPSAoKSA9PiB7XG4gICAgICByZW1vdmVMaXN0ZW5lcnMoKTtcbiAgICAgIGZuLm9uRHJhZ0VuZD8uKCk7XG4gICAgfTtcbiAgICBjb25zdCBkcmFnbGVhdmVIYW5kbGVyID0gKCkgPT4ge1xuICAgICAgcmVtb3ZlTGlzdGVuZXJzKCk7XG4gICAgICBmbi5vbkRyYWdMZWF2ZT8uKCk7XG4gICAgfTtcbiAgICBjb25zdCBkcm9wSGFuZGxlciA9ICgpID0+IHtcbiAgICAgIHJlbW92ZUxpc3RlbmVycygpO1xuICAgICAgZm4ub25Ecm9wPy4oKTtcbiAgICB9O1xuICAgIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ2VudGVyJywgKCkgPT4ge1xuICAgICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdkcmFnbGVhdmUnLCBkcmFnbGVhdmVIYW5kbGVyKTtcbiAgICAgIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ2VuZCcsIGRyYWdlbmRIYW5kbGVyKTtcbiAgICAgIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZHJvcCcsIGRyb3BIYW5kbGVyKTtcbiAgICAgIGZuLm9uRHJhZ0VudGVyPy4oKTtcbiAgICB9KTtcbiAgfVxuXG4gIGNvbnN0IGZTRW50cnlTZXQgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgY29uc3QgZlNFbnRyeUl0ZXJhdG9yID0gbmV3IFJlY3Vyc2l2ZUl0ZXJhdG9yPEZpbGVTeXN0ZW1FbnRyeSwgRmlsZVN5c3RlbUZpbGVFbnRyeT4oYXN5bmMgZnVuY3Rpb24qIChmU0VudHJ5SXRlcmF0b3IsIHB1c2gpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGZTRW50cnkgb2YgZlNFbnRyeUl0ZXJhdG9yKSB7XG4gICAgICBjb25zdCBwYXRoID0gZlNFbnRyeS5mdWxsUGF0aC5zbGljZSgxKTtcbiAgICAgIGlmICghZlNFbnRyeVNldC5oYXMocGF0aCkpIHtcbiAgICAgICAgZlNFbnRyeVNldC5hZGQocGF0aCk7XG4gICAgICAgIGNvbnN0IGZzRW50cmllcyA9IG5ldyBGaWxlU3lzdGVtRW50cnlJdGVyYXRvcihmU0VudHJ5KTtcbiAgICAgICAgZm9yIChjb25zdCBmU0ZpbGVFbnRyeSBvZiBmc0VudHJpZXMuZ2V0RmlsZUVudHJ5KCkpIHtcbiAgICAgICAgICB5aWVsZCBmU0ZpbGVFbnRyeTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGNvbnN0IGZTRGlyZWN0b3J5RW50cnkgb2YgZnNFbnRyaWVzLmdldERpcmVjdG9yeUVudHJ5KCkpIHtcbiAgICAgICAgICBwdXNoKG5ldyBGaWxlU3lzdGVtRGlyZWN0b3J5RW50cnlJdGVyYXRvcihmU0RpcmVjdG9yeUVudHJ5KS5nZXRFbnRyeSgpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSk7XG5cbiAgY29uc3Qgam9iUXVldWUgPSBuZXcgSm9iUXVldWU8dm9pZCwgc3RyaW5nPigtMSk7XG4gIGpvYlF1ZXVlLnN1YnNjcmliZSgoXywgZXJyb3IpID0+IHtcbiAgICBpZiAoZXJyb3IpIHtcbiAgICAgIGZuPy5vblVwbG9hZEVycm9yPy4oZXJyb3IpO1xuICAgIH1cbiAgfSk7XG5cbiAgbGV0IGRvbmUgPSB0cnVlO1xuICBsZXQgcnVubmluZyA9IGZhbHNlO1xuICBjb25zdCB1cGxvYWRTdGFydCA9IGFzeW5jICgpID0+IHtcbiAgICBpZiAocnVubmluZyA9PT0gZmFsc2UpIHtcbiAgICAgIGRvbmUgPSBmYWxzZTtcbiAgICAgIHJ1bm5pbmcgPSB0cnVlO1xuICAgICAgYXdhaXQgZm4ub25VcGxvYWRTdGFydD8uKCk7XG4gICAgICAvLyBnaXZlIGJyb3dzZXIgc29tZSB0aW1lIHRvIHF1ZXVlIGJvdGggZXZlbnRzXG4gICAgICBTbGVlcCg1MDApLnRoZW4oYXN5bmMgKCkgPT4ge1xuICAgICAgICBhd2FpdCBqb2JRdWV1ZS5kb25lO1xuICAgICAgICB1cGxvYWRFbmQoKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfTtcbiAgY29uc3QgdXBsb2FkRW5kID0gYXN5bmMgKCkgPT4ge1xuICAgIGRvbmUgPSB0cnVlO1xuICAgIHJ1bm5pbmcgPSBmYWxzZTtcbiAgICBhd2FpdCBmbi5vblVwbG9hZEVuZD8uKCk7XG4gICAgam9iUXVldWUucmVzZXQoKTtcbiAgICBmU0VudHJ5U2V0LmNsZWFyKCk7XG4gIH07XG4gIGNvbnN0IGl0ZXJhdGVGU0VudHJpZXMgPSBhc3luYyAoZW50cmllczogU3luY0FzeW5jSXRlcmFibGU8RmlsZVN5c3RlbUVudHJ5PiwgZmlsZXM6IEZpbGVMaXN0KSA9PiB7XG4gICAgaWYgKGRvbmUgPT09IGZhbHNlKSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IGZTRmlsZUVudHJ5IG9mIGZTRW50cnlJdGVyYXRvci5pdGVyYXRlKGVudHJpZXMpKSB7XG4gICAgICAgIGNvbnN0IGZpbGUgPSBhd2FpdCBuZXcgUHJvbWlzZTxGaWxlPigocmVzb2x2ZSwgcmVqZWN0KSA9PiBmU0ZpbGVFbnRyeS5maWxlKHJlc29sdmUsIHJlamVjdCkpO1xuICAgICAgICBhd2FpdCBmbi5vblVwbG9hZE5leHRGaWxlKGZpbGUsICgpID0+IChkb25lID0gdHJ1ZSkpO1xuICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgIGlmIChkb25lID09PSB0cnVlKSByZXR1cm47XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcbiAgICAgICAgY29uc3QgcGF0aCA9IEdldFdlYmtpdFJlbGF0aXZlUGF0aChmaWxlKSArIGZpbGUubmFtZTtcbiAgICAgICAgaWYgKCFmU0VudHJ5U2V0LmhhcyhwYXRoKSkge1xuICAgICAgICAgIGZTRW50cnlTZXQuYWRkKHBhdGgpO1xuICAgICAgICAgIGF3YWl0IGZuLm9uVXBsb2FkTmV4dEZpbGUoZmlsZSwgKCkgPT4gKGRvbmUgPSB0cnVlKSk7XG4gICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgIGlmIChkb25lID09PSB0cnVlKSByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH07XG4gIGNvbnN0IGNoYW5nZUhhbmRsZXIgPSAoKSA9PiB7XG4gICAgam9iUXVldWUuYWRkKGFzeW5jICgpID0+IHtcbiAgICAgIGF3YWl0IHVwbG9hZFN0YXJ0KCk7XG4gICAgICBpZiAoZG9uZSA9PT0gZmFsc2UgJiYgZWxlbWVudCBpbnN0YW5jZW9mIEhUTUxJbnB1dEVsZW1lbnQgJiYgZWxlbWVudC5maWxlcykge1xuICAgICAgICBhd2FpdCBpdGVyYXRlRlNFbnRyaWVzKEdldFdlYmtpdEVudHJpZXMoZWxlbWVudCkgPz8gW10sIGVsZW1lbnQuZmlsZXMpO1xuICAgICAgfVxuICAgIH0sICdjaGFuZ2VIYW5kbGVyJyk7XG4gIH07XG4gIGNvbnN0IGRyb3BIYW5kbGVyID0gKGV2ZW50OiBEcmFnRXZlbnQpID0+IHtcbiAgICBqb2JRdWV1ZS5hZGQoYXN5bmMgKCkgPT4ge1xuICAgICAgYXdhaXQgdXBsb2FkU3RhcnQoKTtcbiAgICAgIGlmIChkb25lID09PSBmYWxzZSAmJiBldmVudC5kYXRhVHJhbnNmZXIpIHtcbiAgICAgICAgY29uc3QgZGF0YVRyYW5zZmVySXRlbXMgPSBuZXcgRGF0YVRyYW5zZmVySXRlbUl0ZXJhdG9yKGV2ZW50LmRhdGFUcmFuc2Zlci5pdGVtcyk7XG4gICAgICAgIGF3YWl0IGl0ZXJhdGVGU0VudHJpZXMoZGF0YVRyYW5zZmVySXRlbXMuZ2V0QXNFbnRyeSgpLCBldmVudC5kYXRhVHJhbnNmZXIuZmlsZXMpO1xuICAgICAgfVxuICAgIH0sICdkcm9wSGFuZGxlcicpO1xuICB9O1xuICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIGNoYW5nZUhhbmRsZXIpO1xuICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2Ryb3AnLCBkcm9wSGFuZGxlcik7XG59XG4iLAogICAgIi8qIFRhYmxlIG9mIENSQ3Mgb2YgYWxsIDgtYml0IG1lc3NhZ2VzLiAqL1xuY29uc3QgY3JjX3RhYmxlOiBVaW50MzJBcnJheSA9IG5ldyBVaW50MzJBcnJheSgyNTYpO1xuY29uc3QgY3JjX21hZ2ljOiBVaW50MzJBcnJheSA9IG5ldyBVaW50MzJBcnJheSgxKTtcbmNyY19tYWdpY1swXSA9IDB4ZWRiODgzMjA7XG5cbi8qIE1ha2UgdGhlIHRhYmxlIGZvciBhIGZhc3QgQ1JDLiAqL1xuZm9yIChsZXQgbiA9IDA7IG4gPCAyNTY7IG4rKykge1xuICBsZXQgYyA9IG4gPj4+IDA7IC8vIFVzZSB1bnNpZ25lZCAzMi1iaXQgaW50ZWdlclxuICBmb3IgKGxldCBrID0gMDsgayA8IDg7IGsrKykge1xuICAgIGlmIChjICYgMSkge1xuICAgICAgYyA9IGNyY19tYWdpY1swXSBeIChjID4+PiAxKTtcbiAgICB9IGVsc2Uge1xuICAgICAgYyA+Pj49IDE7XG4gICAgfVxuICB9XG4gIGNyY190YWJsZVtuXSA9IGM7XG59XG5cbmV4cG9ydCBjbGFzcyBDUkMge1xuICBzdGF0aWMgSW5pdChieXRlczogVWludDhBcnJheSkge1xuICAgIHJldHVybiAoQ1JDLlVwZGF0ZSgweGZmZmZmZmZmID4+PiAwLCBieXRlcykgXiAoMHhmZmZmZmZmZiA+Pj4gMCkpID4+PiAwO1xuICB9XG4gIHN0YXRpYyBVcGRhdGUoY3JjOiBudW1iZXIsIGJ5dGVzOiBVaW50OEFycmF5KSB7XG4gICAgbGV0IGMgPSBjcmMgPj4+IDA7XG4gICAgZm9yIChsZXQgbiA9IDA7IG4gPCBieXRlcy5sZW5ndGg7IG4rKykge1xuICAgICAgYyA9IGNyY190YWJsZVsoYyBeIGJ5dGVzW25dKSAmIDB4ZmZdIF4gKGMgPj4+IDgpO1xuICAgIH1cbiAgICByZXR1cm4gYyA+Pj4gMDtcbiAgfVxufVxuIiwKICAgICJcbi8qISBwYWtvIDIuMS4wIGh0dHBzOi8vZ2l0aHViLmNvbS9ub2RlY2EvcGFrbyBAbGljZW5zZSAoTUlUIEFORCBabGliKSAqL1xuLy8gKEMpIDE5OTUtMjAxMyBKZWFuLWxvdXAgR2FpbGx5IGFuZCBNYXJrIEFkbGVyXG4vLyAoQykgMjAxNC0yMDE3IFZpdGFseSBQdXpyaW4gYW5kIEFuZHJleSBUdXBpdHNpblxuLy9cbi8vIFRoaXMgc29mdHdhcmUgaXMgcHJvdmlkZWQgJ2FzLWlzJywgd2l0aG91dCBhbnkgZXhwcmVzcyBvciBpbXBsaWVkXG4vLyB3YXJyYW50eS4gSW4gbm8gZXZlbnQgd2lsbCB0aGUgYXV0aG9ycyBiZSBoZWxkIGxpYWJsZSBmb3IgYW55IGRhbWFnZXNcbi8vIGFyaXNpbmcgZnJvbSB0aGUgdXNlIG9mIHRoaXMgc29mdHdhcmUuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBncmFudGVkIHRvIGFueW9uZSB0byB1c2UgdGhpcyBzb2Z0d2FyZSBmb3IgYW55IHB1cnBvc2UsXG4vLyBpbmNsdWRpbmcgY29tbWVyY2lhbCBhcHBsaWNhdGlvbnMsIGFuZCB0byBhbHRlciBpdCBhbmQgcmVkaXN0cmlidXRlIGl0XG4vLyBmcmVlbHksIHN1YmplY3QgdG8gdGhlIGZvbGxvd2luZyByZXN0cmljdGlvbnM6XG4vL1xuLy8gMS4gVGhlIG9yaWdpbiBvZiB0aGlzIHNvZnR3YXJlIG11c3Qgbm90IGJlIG1pc3JlcHJlc2VudGVkOyB5b3UgbXVzdCBub3Rcbi8vICAgY2xhaW0gdGhhdCB5b3Ugd3JvdGUgdGhlIG9yaWdpbmFsIHNvZnR3YXJlLiBJZiB5b3UgdXNlIHRoaXMgc29mdHdhcmVcbi8vICAgaW4gYSBwcm9kdWN0LCBhbiBhY2tub3dsZWRnbWVudCBpbiB0aGUgcHJvZHVjdCBkb2N1bWVudGF0aW9uIHdvdWxkIGJlXG4vLyAgIGFwcHJlY2lhdGVkIGJ1dCBpcyBub3QgcmVxdWlyZWQuXG4vLyAyLiBBbHRlcmVkIHNvdXJjZSB2ZXJzaW9ucyBtdXN0IGJlIHBsYWlubHkgbWFya2VkIGFzIHN1Y2gsIGFuZCBtdXN0IG5vdCBiZVxuLy8gICBtaXNyZXByZXNlbnRlZCBhcyBiZWluZyB0aGUgb3JpZ2luYWwgc29mdHdhcmUuXG4vLyAzLiBUaGlzIG5vdGljZSBtYXkgbm90IGJlIHJlbW92ZWQgb3IgYWx0ZXJlZCBmcm9tIGFueSBzb3VyY2UgZGlzdHJpYnV0aW9uLlxuXG4vKiBlc2xpbnQtZGlzYWJsZSBzcGFjZS11bmFyeS1vcHMgKi9cblxuLyogUHVibGljIGNvbnN0YW50cyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Ki9cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSovXG5cblxuLy9jb25zdCBaX0ZJTFRFUkVEICAgICAgICAgID0gMTtcbi8vY29uc3QgWl9IVUZGTUFOX09OTFkgICAgICA9IDI7XG4vL2NvbnN0IFpfUkxFICAgICAgICAgICAgICAgPSAzO1xuY29uc3QgWl9GSVhFRCQxICAgICAgICAgICAgICAgPSA0O1xuLy9jb25zdCBaX0RFRkFVTFRfU1RSQVRFR1kgID0gMDtcblxuLyogUG9zc2libGUgdmFsdWVzIG9mIHRoZSBkYXRhX3R5cGUgZmllbGQgKHRob3VnaCBzZWUgaW5mbGF0ZSgpKSAqL1xuY29uc3QgWl9CSU5BUlkgICAgICAgICAgICAgID0gMDtcbmNvbnN0IFpfVEVYVCAgICAgICAgICAgICAgICA9IDE7XG4vL2NvbnN0IFpfQVNDSUkgICAgICAgICAgICAgPSAxOyAvLyA9IFpfVEVYVFxuY29uc3QgWl9VTktOT1dOJDEgICAgICAgICAgICAgPSAyO1xuXG4vKj09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0qL1xuXG5cbmZ1bmN0aW9uIHplcm8kMShidWYpIHsgbGV0IGxlbiA9IGJ1Zi5sZW5ndGg7IHdoaWxlICgtLWxlbiA+PSAwKSB7IGJ1ZltsZW5dID0gMDsgfSB9XG5cbi8vIEZyb20genV0aWwuaFxuXG5jb25zdCBTVE9SRURfQkxPQ0sgPSAwO1xuY29uc3QgU1RBVElDX1RSRUVTID0gMTtcbmNvbnN0IERZTl9UUkVFUyAgICA9IDI7XG4vKiBUaGUgdGhyZWUga2luZHMgb2YgYmxvY2sgdHlwZSAqL1xuXG5jb25zdCBNSU5fTUFUQ0gkMSAgICA9IDM7XG5jb25zdCBNQVhfTUFUQ0gkMSAgICA9IDI1ODtcbi8qIFRoZSBtaW5pbXVtIGFuZCBtYXhpbXVtIG1hdGNoIGxlbmd0aHMgKi9cblxuLy8gRnJvbSBkZWZsYXRlLmhcbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogSW50ZXJuYWwgY29tcHJlc3Npb24gc3RhdGUuXG4gKi9cblxuY29uc3QgTEVOR1RIX0NPREVTJDEgID0gMjk7XG4vKiBudW1iZXIgb2YgbGVuZ3RoIGNvZGVzLCBub3QgY291bnRpbmcgdGhlIHNwZWNpYWwgRU5EX0JMT0NLIGNvZGUgKi9cblxuY29uc3QgTElURVJBTFMkMSAgICAgID0gMjU2O1xuLyogbnVtYmVyIG9mIGxpdGVyYWwgYnl0ZXMgMC4uMjU1ICovXG5cbmNvbnN0IExfQ09ERVMkMSAgICAgICA9IExJVEVSQUxTJDEgKyAxICsgTEVOR1RIX0NPREVTJDE7XG4vKiBudW1iZXIgb2YgTGl0ZXJhbCBvciBMZW5ndGggY29kZXMsIGluY2x1ZGluZyB0aGUgRU5EX0JMT0NLIGNvZGUgKi9cblxuY29uc3QgRF9DT0RFUyQxICAgICAgID0gMzA7XG4vKiBudW1iZXIgb2YgZGlzdGFuY2UgY29kZXMgKi9cblxuY29uc3QgQkxfQ09ERVMkMSAgICAgID0gMTk7XG4vKiBudW1iZXIgb2YgY29kZXMgdXNlZCB0byB0cmFuc2ZlciB0aGUgYml0IGxlbmd0aHMgKi9cblxuY29uc3QgSEVBUF9TSVpFJDEgICAgID0gMiAqIExfQ09ERVMkMSArIDE7XG4vKiBtYXhpbXVtIGhlYXAgc2l6ZSAqL1xuXG5jb25zdCBNQVhfQklUUyQxICAgICAgPSAxNTtcbi8qIEFsbCBjb2RlcyBtdXN0IG5vdCBleGNlZWQgTUFYX0JJVFMgYml0cyAqL1xuXG5jb25zdCBCdWZfc2l6ZSAgICAgID0gMTY7XG4vKiBzaXplIG9mIGJpdCBidWZmZXIgaW4gYmlfYnVmICovXG5cblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBDb25zdGFudHNcbiAqL1xuXG5jb25zdCBNQVhfQkxfQklUUyA9IDc7XG4vKiBCaXQgbGVuZ3RoIGNvZGVzIG11c3Qgbm90IGV4Y2VlZCBNQVhfQkxfQklUUyBiaXRzICovXG5cbmNvbnN0IEVORF9CTE9DSyAgID0gMjU2O1xuLyogZW5kIG9mIGJsb2NrIGxpdGVyYWwgY29kZSAqL1xuXG5jb25zdCBSRVBfM182ICAgICA9IDE2O1xuLyogcmVwZWF0IHByZXZpb3VzIGJpdCBsZW5ndGggMy02IHRpbWVzICgyIGJpdHMgb2YgcmVwZWF0IGNvdW50KSAqL1xuXG5jb25zdCBSRVBaXzNfMTAgICA9IDE3O1xuLyogcmVwZWF0IGEgemVybyBsZW5ndGggMy0xMCB0aW1lcyAgKDMgYml0cyBvZiByZXBlYXQgY291bnQpICovXG5cbmNvbnN0IFJFUFpfMTFfMTM4ID0gMTg7XG4vKiByZXBlYXQgYSB6ZXJvIGxlbmd0aCAxMS0xMzggdGltZXMgICg3IGJpdHMgb2YgcmVwZWF0IGNvdW50KSAqL1xuXG4vKiBlc2xpbnQtZGlzYWJsZSBjb21tYS1zcGFjaW5nLGFycmF5LWJyYWNrZXQtc3BhY2luZyAqL1xuY29uc3QgZXh0cmFfbGJpdHMgPSAgIC8qIGV4dHJhIGJpdHMgZm9yIGVhY2ggbGVuZ3RoIGNvZGUgKi9cbiAgbmV3IFVpbnQ4QXJyYXkoWzAsMCwwLDAsMCwwLDAsMCwxLDEsMSwxLDIsMiwyLDIsMywzLDMsMyw0LDQsNCw0LDUsNSw1LDUsMF0pO1xuXG5jb25zdCBleHRyYV9kYml0cyA9ICAgLyogZXh0cmEgYml0cyBmb3IgZWFjaCBkaXN0YW5jZSBjb2RlICovXG4gIG5ldyBVaW50OEFycmF5KFswLDAsMCwwLDEsMSwyLDIsMywzLDQsNCw1LDUsNiw2LDcsNyw4LDgsOSw5LDEwLDEwLDExLDExLDEyLDEyLDEzLDEzXSk7XG5cbmNvbnN0IGV4dHJhX2JsYml0cyA9ICAvKiBleHRyYSBiaXRzIGZvciBlYWNoIGJpdCBsZW5ndGggY29kZSAqL1xuICBuZXcgVWludDhBcnJheShbMCwwLDAsMCwwLDAsMCwwLDAsMCwwLDAsMCwwLDAsMCwyLDMsN10pO1xuXG5jb25zdCBibF9vcmRlciA9XG4gIG5ldyBVaW50OEFycmF5KFsxNiwxNywxOCwwLDgsNyw5LDYsMTAsNSwxMSw0LDEyLDMsMTMsMiwxNCwxLDE1XSk7XG4vKiBlc2xpbnQtZW5hYmxlIGNvbW1hLXNwYWNpbmcsYXJyYXktYnJhY2tldC1zcGFjaW5nICovXG5cbi8qIFRoZSBsZW5ndGhzIG9mIHRoZSBiaXQgbGVuZ3RoIGNvZGVzIGFyZSBzZW50IGluIG9yZGVyIG9mIGRlY3JlYXNpbmdcbiAqIHByb2JhYmlsaXR5LCB0byBhdm9pZCB0cmFuc21pdHRpbmcgdGhlIGxlbmd0aHMgZm9yIHVudXNlZCBiaXQgbGVuZ3RoIGNvZGVzLlxuICovXG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogTG9jYWwgZGF0YS4gVGhlc2UgYXJlIGluaXRpYWxpemVkIG9ubHkgb25jZS5cbiAqL1xuXG4vLyBXZSBwcmUtZmlsbCBhcnJheXMgd2l0aCAwIHRvIGF2b2lkIHVuaW5pdGlhbGl6ZWQgZ2Fwc1xuXG5jb25zdCBESVNUX0NPREVfTEVOID0gNTEyOyAvKiBzZWUgZGVmaW5pdGlvbiBvZiBhcnJheSBkaXN0X2NvZGUgYmVsb3cgKi9cblxuLy8gISEhISBVc2UgZmxhdCBhcnJheSBpbnN0ZWFkIG9mIHN0cnVjdHVyZSwgRnJlcSA9IGkqMiwgTGVuID0gaSoyKzFcbmNvbnN0IHN0YXRpY19sdHJlZSAgPSBuZXcgQXJyYXkoKExfQ09ERVMkMSArIDIpICogMik7XG56ZXJvJDEoc3RhdGljX2x0cmVlKTtcbi8qIFRoZSBzdGF0aWMgbGl0ZXJhbCB0cmVlLiBTaW5jZSB0aGUgYml0IGxlbmd0aHMgYXJlIGltcG9zZWQsIHRoZXJlIGlzIG5vXG4gKiBuZWVkIGZvciB0aGUgTF9DT0RFUyBleHRyYSBjb2RlcyB1c2VkIGR1cmluZyBoZWFwIGNvbnN0cnVjdGlvbi4gSG93ZXZlclxuICogVGhlIGNvZGVzIDI4NiBhbmQgMjg3IGFyZSBuZWVkZWQgdG8gYnVpbGQgYSBjYW5vbmljYWwgdHJlZSAoc2VlIF90cl9pbml0XG4gKiBiZWxvdykuXG4gKi9cblxuY29uc3Qgc3RhdGljX2R0cmVlICA9IG5ldyBBcnJheShEX0NPREVTJDEgKiAyKTtcbnplcm8kMShzdGF0aWNfZHRyZWUpO1xuLyogVGhlIHN0YXRpYyBkaXN0YW5jZSB0cmVlLiAoQWN0dWFsbHkgYSB0cml2aWFsIHRyZWUgc2luY2UgYWxsIGNvZGVzIHVzZVxuICogNSBiaXRzLilcbiAqL1xuXG5jb25zdCBfZGlzdF9jb2RlICAgID0gbmV3IEFycmF5KERJU1RfQ09ERV9MRU4pO1xuemVybyQxKF9kaXN0X2NvZGUpO1xuLyogRGlzdGFuY2UgY29kZXMuIFRoZSBmaXJzdCAyNTYgdmFsdWVzIGNvcnJlc3BvbmQgdG8gdGhlIGRpc3RhbmNlc1xuICogMyAuLiAyNTgsIHRoZSBsYXN0IDI1NiB2YWx1ZXMgY29ycmVzcG9uZCB0byB0aGUgdG9wIDggYml0cyBvZlxuICogdGhlIDE1IGJpdCBkaXN0YW5jZXMuXG4gKi9cblxuY29uc3QgX2xlbmd0aF9jb2RlICA9IG5ldyBBcnJheShNQVhfTUFUQ0gkMSAtIE1JTl9NQVRDSCQxICsgMSk7XG56ZXJvJDEoX2xlbmd0aF9jb2RlKTtcbi8qIGxlbmd0aCBjb2RlIGZvciBlYWNoIG5vcm1hbGl6ZWQgbWF0Y2ggbGVuZ3RoICgwID09IE1JTl9NQVRDSCkgKi9cblxuY29uc3QgYmFzZV9sZW5ndGggICA9IG5ldyBBcnJheShMRU5HVEhfQ09ERVMkMSk7XG56ZXJvJDEoYmFzZV9sZW5ndGgpO1xuLyogRmlyc3Qgbm9ybWFsaXplZCBsZW5ndGggZm9yIGVhY2ggY29kZSAoMCA9IE1JTl9NQVRDSCkgKi9cblxuY29uc3QgYmFzZV9kaXN0ICAgICA9IG5ldyBBcnJheShEX0NPREVTJDEpO1xuemVybyQxKGJhc2VfZGlzdCk7XG4vKiBGaXJzdCBub3JtYWxpemVkIGRpc3RhbmNlIGZvciBlYWNoIGNvZGUgKDAgPSBkaXN0YW5jZSBvZiAxKSAqL1xuXG5cbmZ1bmN0aW9uIFN0YXRpY1RyZWVEZXNjKHN0YXRpY190cmVlLCBleHRyYV9iaXRzLCBleHRyYV9iYXNlLCBlbGVtcywgbWF4X2xlbmd0aCkge1xuXG4gIHRoaXMuc3RhdGljX3RyZWUgID0gc3RhdGljX3RyZWU7ICAvKiBzdGF0aWMgdHJlZSBvciBOVUxMICovXG4gIHRoaXMuZXh0cmFfYml0cyAgID0gZXh0cmFfYml0czsgICAvKiBleHRyYSBiaXRzIGZvciBlYWNoIGNvZGUgb3IgTlVMTCAqL1xuICB0aGlzLmV4dHJhX2Jhc2UgICA9IGV4dHJhX2Jhc2U7ICAgLyogYmFzZSBpbmRleCBmb3IgZXh0cmFfYml0cyAqL1xuICB0aGlzLmVsZW1zICAgICAgICA9IGVsZW1zOyAgICAgICAgLyogbWF4IG51bWJlciBvZiBlbGVtZW50cyBpbiB0aGUgdHJlZSAqL1xuICB0aGlzLm1heF9sZW5ndGggICA9IG1heF9sZW5ndGg7ICAgLyogbWF4IGJpdCBsZW5ndGggZm9yIHRoZSBjb2RlcyAqL1xuXG4gIC8vIHNob3cgaWYgYHN0YXRpY190cmVlYCBoYXMgZGF0YSBvciBkdW1teSAtIG5lZWRlZCBmb3IgbW9ub21vcnBoaWMgb2JqZWN0c1xuICB0aGlzLmhhc19zdHJlZSAgICA9IHN0YXRpY190cmVlICYmIHN0YXRpY190cmVlLmxlbmd0aDtcbn1cblxuXG5sZXQgc3RhdGljX2xfZGVzYztcbmxldCBzdGF0aWNfZF9kZXNjO1xubGV0IHN0YXRpY19ibF9kZXNjO1xuXG5cbmZ1bmN0aW9uIFRyZWVEZXNjKGR5bl90cmVlLCBzdGF0X2Rlc2MpIHtcbiAgdGhpcy5keW5fdHJlZSA9IGR5bl90cmVlOyAgICAgLyogdGhlIGR5bmFtaWMgdHJlZSAqL1xuICB0aGlzLm1heF9jb2RlID0gMDsgICAgICAgICAgICAvKiBsYXJnZXN0IGNvZGUgd2l0aCBub24gemVybyBmcmVxdWVuY3kgKi9cbiAgdGhpcy5zdGF0X2Rlc2MgPSBzdGF0X2Rlc2M7ICAgLyogdGhlIGNvcnJlc3BvbmRpbmcgc3RhdGljIHRyZWUgKi9cbn1cblxuXG5cbmNvbnN0IGRfY29kZSA9IChkaXN0KSA9PiB7XG5cbiAgcmV0dXJuIGRpc3QgPCAyNTYgPyBfZGlzdF9jb2RlW2Rpc3RdIDogX2Rpc3RfY29kZVsyNTYgKyAoZGlzdCA+Pj4gNyldO1xufTtcblxuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIE91dHB1dCBhIHNob3J0IExTQiBmaXJzdCBvbiB0aGUgc3RyZWFtLlxuICogSU4gYXNzZXJ0aW9uOiB0aGVyZSBpcyBlbm91Z2ggcm9vbSBpbiBwZW5kaW5nQnVmLlxuICovXG5jb25zdCBwdXRfc2hvcnQgPSAocywgdykgPT4ge1xuLy8gICAgcHV0X2J5dGUocywgKHVjaCkoKHcpICYgMHhmZikpO1xuLy8gICAgcHV0X2J5dGUocywgKHVjaCkoKHVzaCkodykgPj4gOCkpO1xuICBzLnBlbmRpbmdfYnVmW3MucGVuZGluZysrXSA9ICh3KSAmIDB4ZmY7XG4gIHMucGVuZGluZ19idWZbcy5wZW5kaW5nKytdID0gKHcgPj4+IDgpICYgMHhmZjtcbn07XG5cblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBTZW5kIGEgdmFsdWUgb24gYSBnaXZlbiBudW1iZXIgb2YgYml0cy5cbiAqIElOIGFzc2VydGlvbjogbGVuZ3RoIDw9IDE2IGFuZCB2YWx1ZSBmaXRzIGluIGxlbmd0aCBiaXRzLlxuICovXG5jb25zdCBzZW5kX2JpdHMgPSAocywgdmFsdWUsIGxlbmd0aCkgPT4ge1xuXG4gIGlmIChzLmJpX3ZhbGlkID4gKEJ1Zl9zaXplIC0gbGVuZ3RoKSkge1xuICAgIHMuYmlfYnVmIHw9ICh2YWx1ZSA8PCBzLmJpX3ZhbGlkKSAmIDB4ZmZmZjtcbiAgICBwdXRfc2hvcnQocywgcy5iaV9idWYpO1xuICAgIHMuYmlfYnVmID0gdmFsdWUgPj4gKEJ1Zl9zaXplIC0gcy5iaV92YWxpZCk7XG4gICAgcy5iaV92YWxpZCArPSBsZW5ndGggLSBCdWZfc2l6ZTtcbiAgfSBlbHNlIHtcbiAgICBzLmJpX2J1ZiB8PSAodmFsdWUgPDwgcy5iaV92YWxpZCkgJiAweGZmZmY7XG4gICAgcy5iaV92YWxpZCArPSBsZW5ndGg7XG4gIH1cbn07XG5cblxuY29uc3Qgc2VuZF9jb2RlID0gKHMsIGMsIHRyZWUpID0+IHtcblxuICBzZW5kX2JpdHMocywgdHJlZVtjICogMl0vKi5Db2RlKi8sIHRyZWVbYyAqIDIgKyAxXS8qLkxlbiovKTtcbn07XG5cblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBSZXZlcnNlIHRoZSBmaXJzdCBsZW4gYml0cyBvZiBhIGNvZGUsIHVzaW5nIHN0cmFpZ2h0Zm9yd2FyZCBjb2RlIChhIGZhc3RlclxuICogbWV0aG9kIHdvdWxkIHVzZSBhIHRhYmxlKVxuICogSU4gYXNzZXJ0aW9uOiAxIDw9IGxlbiA8PSAxNVxuICovXG5jb25zdCBiaV9yZXZlcnNlID0gKGNvZGUsIGxlbikgPT4ge1xuXG4gIGxldCByZXMgPSAwO1xuICBkbyB7XG4gICAgcmVzIHw9IGNvZGUgJiAxO1xuICAgIGNvZGUgPj4+PSAxO1xuICAgIHJlcyA8PD0gMTtcbiAgfSB3aGlsZSAoLS1sZW4gPiAwKTtcbiAgcmV0dXJuIHJlcyA+Pj4gMTtcbn07XG5cblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBGbHVzaCB0aGUgYml0IGJ1ZmZlciwga2VlcGluZyBhdCBtb3N0IDcgYml0cyBpbiBpdC5cbiAqL1xuY29uc3QgYmlfZmx1c2ggPSAocykgPT4ge1xuXG4gIGlmIChzLmJpX3ZhbGlkID09PSAxNikge1xuICAgIHB1dF9zaG9ydChzLCBzLmJpX2J1Zik7XG4gICAgcy5iaV9idWYgPSAwO1xuICAgIHMuYmlfdmFsaWQgPSAwO1xuXG4gIH0gZWxzZSBpZiAocy5iaV92YWxpZCA+PSA4KSB7XG4gICAgcy5wZW5kaW5nX2J1ZltzLnBlbmRpbmcrK10gPSBzLmJpX2J1ZiAmIDB4ZmY7XG4gICAgcy5iaV9idWYgPj49IDg7XG4gICAgcy5iaV92YWxpZCAtPSA4O1xuICB9XG59O1xuXG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogQ29tcHV0ZSB0aGUgb3B0aW1hbCBiaXQgbGVuZ3RocyBmb3IgYSB0cmVlIGFuZCB1cGRhdGUgdGhlIHRvdGFsIGJpdCBsZW5ndGhcbiAqIGZvciB0aGUgY3VycmVudCBibG9jay5cbiAqIElOIGFzc2VydGlvbjogdGhlIGZpZWxkcyBmcmVxIGFuZCBkYWQgYXJlIHNldCwgaGVhcFtoZWFwX21heF0gYW5kXG4gKiAgICBhYm92ZSBhcmUgdGhlIHRyZWUgbm9kZXMgc29ydGVkIGJ5IGluY3JlYXNpbmcgZnJlcXVlbmN5LlxuICogT1VUIGFzc2VydGlvbnM6IHRoZSBmaWVsZCBsZW4gaXMgc2V0IHRvIHRoZSBvcHRpbWFsIGJpdCBsZW5ndGgsIHRoZVxuICogICAgIGFycmF5IGJsX2NvdW50IGNvbnRhaW5zIHRoZSBmcmVxdWVuY2llcyBmb3IgZWFjaCBiaXQgbGVuZ3RoLlxuICogICAgIFRoZSBsZW5ndGggb3B0X2xlbiBpcyB1cGRhdGVkOyBzdGF0aWNfbGVuIGlzIGFsc28gdXBkYXRlZCBpZiBzdHJlZSBpc1xuICogICAgIG5vdCBudWxsLlxuICovXG5jb25zdCBnZW5fYml0bGVuID0gKHMsIGRlc2MpID0+IHtcbi8vICAgIGRlZmxhdGVfc3RhdGUgKnM7XG4vLyAgICB0cmVlX2Rlc2MgKmRlc2M7ICAgIC8qIHRoZSB0cmVlIGRlc2NyaXB0b3IgKi9cblxuICBjb25zdCB0cmVlICAgICAgICAgICAgPSBkZXNjLmR5bl90cmVlO1xuICBjb25zdCBtYXhfY29kZSAgICAgICAgPSBkZXNjLm1heF9jb2RlO1xuICBjb25zdCBzdHJlZSAgICAgICAgICAgPSBkZXNjLnN0YXRfZGVzYy5zdGF0aWNfdHJlZTtcbiAgY29uc3QgaGFzX3N0cmVlICAgICAgID0gZGVzYy5zdGF0X2Rlc2MuaGFzX3N0cmVlO1xuICBjb25zdCBleHRyYSAgICAgICAgICAgPSBkZXNjLnN0YXRfZGVzYy5leHRyYV9iaXRzO1xuICBjb25zdCBiYXNlICAgICAgICAgICAgPSBkZXNjLnN0YXRfZGVzYy5leHRyYV9iYXNlO1xuICBjb25zdCBtYXhfbGVuZ3RoICAgICAgPSBkZXNjLnN0YXRfZGVzYy5tYXhfbGVuZ3RoO1xuICBsZXQgaDsgICAgICAgICAgICAgIC8qIGhlYXAgaW5kZXggKi9cbiAgbGV0IG4sIG07ICAgICAgICAgICAvKiBpdGVyYXRlIG92ZXIgdGhlIHRyZWUgZWxlbWVudHMgKi9cbiAgbGV0IGJpdHM7ICAgICAgICAgICAvKiBiaXQgbGVuZ3RoICovXG4gIGxldCB4Yml0czsgICAgICAgICAgLyogZXh0cmEgYml0cyAqL1xuICBsZXQgZjsgICAgICAgICAgICAgIC8qIGZyZXF1ZW5jeSAqL1xuICBsZXQgb3ZlcmZsb3cgPSAwOyAgIC8qIG51bWJlciBvZiBlbGVtZW50cyB3aXRoIGJpdCBsZW5ndGggdG9vIGxhcmdlICovXG5cbiAgZm9yIChiaXRzID0gMDsgYml0cyA8PSBNQVhfQklUUyQxOyBiaXRzKyspIHtcbiAgICBzLmJsX2NvdW50W2JpdHNdID0gMDtcbiAgfVxuXG4gIC8qIEluIGEgZmlyc3QgcGFzcywgY29tcHV0ZSB0aGUgb3B0aW1hbCBiaXQgbGVuZ3RocyAod2hpY2ggbWF5XG4gICAqIG92ZXJmbG93IGluIHRoZSBjYXNlIG9mIHRoZSBiaXQgbGVuZ3RoIHRyZWUpLlxuICAgKi9cbiAgdHJlZVtzLmhlYXBbcy5oZWFwX21heF0gKiAyICsgMV0vKi5MZW4qLyA9IDA7IC8qIHJvb3Qgb2YgdGhlIGhlYXAgKi9cblxuICBmb3IgKGggPSBzLmhlYXBfbWF4ICsgMTsgaCA8IEhFQVBfU0laRSQxOyBoKyspIHtcbiAgICBuID0gcy5oZWFwW2hdO1xuICAgIGJpdHMgPSB0cmVlW3RyZWVbbiAqIDIgKyAxXS8qLkRhZCovICogMiArIDFdLyouTGVuKi8gKyAxO1xuICAgIGlmIChiaXRzID4gbWF4X2xlbmd0aCkge1xuICAgICAgYml0cyA9IG1heF9sZW5ndGg7XG4gICAgICBvdmVyZmxvdysrO1xuICAgIH1cbiAgICB0cmVlW24gKiAyICsgMV0vKi5MZW4qLyA9IGJpdHM7XG4gICAgLyogV2Ugb3ZlcndyaXRlIHRyZWVbbl0uRGFkIHdoaWNoIGlzIG5vIGxvbmdlciBuZWVkZWQgKi9cblxuICAgIGlmIChuID4gbWF4X2NvZGUpIHsgY29udGludWU7IH0gLyogbm90IGEgbGVhZiBub2RlICovXG5cbiAgICBzLmJsX2NvdW50W2JpdHNdKys7XG4gICAgeGJpdHMgPSAwO1xuICAgIGlmIChuID49IGJhc2UpIHtcbiAgICAgIHhiaXRzID0gZXh0cmFbbiAtIGJhc2VdO1xuICAgIH1cbiAgICBmID0gdHJlZVtuICogMl0vKi5GcmVxKi87XG4gICAgcy5vcHRfbGVuICs9IGYgKiAoYml0cyArIHhiaXRzKTtcbiAgICBpZiAoaGFzX3N0cmVlKSB7XG4gICAgICBzLnN0YXRpY19sZW4gKz0gZiAqIChzdHJlZVtuICogMiArIDFdLyouTGVuKi8gKyB4Yml0cyk7XG4gICAgfVxuICB9XG4gIGlmIChvdmVyZmxvdyA9PT0gMCkgeyByZXR1cm47IH1cblxuICAvLyBUcmFjZXYoKHN0ZGVycixcIlxcbmJpdCBsZW5ndGggb3ZlcmZsb3dcXG5cIikpO1xuICAvKiBUaGlzIGhhcHBlbnMgZm9yIGV4YW1wbGUgb24gb2JqMiBhbmQgcGljIG9mIHRoZSBDYWxnYXJ5IGNvcnB1cyAqL1xuXG4gIC8qIEZpbmQgdGhlIGZpcnN0IGJpdCBsZW5ndGggd2hpY2ggY291bGQgaW5jcmVhc2U6ICovXG4gIGRvIHtcbiAgICBiaXRzID0gbWF4X2xlbmd0aCAtIDE7XG4gICAgd2hpbGUgKHMuYmxfY291bnRbYml0c10gPT09IDApIHsgYml0cy0tOyB9XG4gICAgcy5ibF9jb3VudFtiaXRzXS0tOyAgICAgIC8qIG1vdmUgb25lIGxlYWYgZG93biB0aGUgdHJlZSAqL1xuICAgIHMuYmxfY291bnRbYml0cyArIDFdICs9IDI7IC8qIG1vdmUgb25lIG92ZXJmbG93IGl0ZW0gYXMgaXRzIGJyb3RoZXIgKi9cbiAgICBzLmJsX2NvdW50W21heF9sZW5ndGhdLS07XG4gICAgLyogVGhlIGJyb3RoZXIgb2YgdGhlIG92ZXJmbG93IGl0ZW0gYWxzbyBtb3ZlcyBvbmUgc3RlcCB1cCxcbiAgICAgKiBidXQgdGhpcyBkb2VzIG5vdCBhZmZlY3QgYmxfY291bnRbbWF4X2xlbmd0aF1cbiAgICAgKi9cbiAgICBvdmVyZmxvdyAtPSAyO1xuICB9IHdoaWxlIChvdmVyZmxvdyA+IDApO1xuXG4gIC8qIE5vdyByZWNvbXB1dGUgYWxsIGJpdCBsZW5ndGhzLCBzY2FubmluZyBpbiBpbmNyZWFzaW5nIGZyZXF1ZW5jeS5cbiAgICogaCBpcyBzdGlsbCBlcXVhbCB0byBIRUFQX1NJWkUuIChJdCBpcyBzaW1wbGVyIHRvIHJlY29uc3RydWN0IGFsbFxuICAgKiBsZW5ndGhzIGluc3RlYWQgb2YgZml4aW5nIG9ubHkgdGhlIHdyb25nIG9uZXMuIFRoaXMgaWRlYSBpcyB0YWtlblxuICAgKiBmcm9tICdhcicgd3JpdHRlbiBieSBIYXJ1aGlrbyBPa3VtdXJhLilcbiAgICovXG4gIGZvciAoYml0cyA9IG1heF9sZW5ndGg7IGJpdHMgIT09IDA7IGJpdHMtLSkge1xuICAgIG4gPSBzLmJsX2NvdW50W2JpdHNdO1xuICAgIHdoaWxlIChuICE9PSAwKSB7XG4gICAgICBtID0gcy5oZWFwWy0taF07XG4gICAgICBpZiAobSA+IG1heF9jb2RlKSB7IGNvbnRpbnVlOyB9XG4gICAgICBpZiAodHJlZVttICogMiArIDFdLyouTGVuKi8gIT09IGJpdHMpIHtcbiAgICAgICAgLy8gVHJhY2V2KChzdGRlcnIsXCJjb2RlICVkIGJpdHMgJWQtPiVkXFxuXCIsIG0sIHRyZWVbbV0uTGVuLCBiaXRzKSk7XG4gICAgICAgIHMub3B0X2xlbiArPSAoYml0cyAtIHRyZWVbbSAqIDIgKyAxXS8qLkxlbiovKSAqIHRyZWVbbSAqIDJdLyouRnJlcSovO1xuICAgICAgICB0cmVlW20gKiAyICsgMV0vKi5MZW4qLyA9IGJpdHM7XG4gICAgICB9XG4gICAgICBuLS07XG4gICAgfVxuICB9XG59O1xuXG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogR2VuZXJhdGUgdGhlIGNvZGVzIGZvciBhIGdpdmVuIHRyZWUgYW5kIGJpdCBjb3VudHMgKHdoaWNoIG5lZWQgbm90IGJlXG4gKiBvcHRpbWFsKS5cbiAqIElOIGFzc2VydGlvbjogdGhlIGFycmF5IGJsX2NvdW50IGNvbnRhaW5zIHRoZSBiaXQgbGVuZ3RoIHN0YXRpc3RpY3MgZm9yXG4gKiB0aGUgZ2l2ZW4gdHJlZSBhbmQgdGhlIGZpZWxkIGxlbiBpcyBzZXQgZm9yIGFsbCB0cmVlIGVsZW1lbnRzLlxuICogT1VUIGFzc2VydGlvbjogdGhlIGZpZWxkIGNvZGUgaXMgc2V0IGZvciBhbGwgdHJlZSBlbGVtZW50cyBvZiBub25cbiAqICAgICB6ZXJvIGNvZGUgbGVuZ3RoLlxuICovXG5jb25zdCBnZW5fY29kZXMgPSAodHJlZSwgbWF4X2NvZGUsIGJsX2NvdW50KSA9PiB7XG4vLyAgICBjdF9kYXRhICp0cmVlOyAgICAgICAgICAgICAvKiB0aGUgdHJlZSB0byBkZWNvcmF0ZSAqL1xuLy8gICAgaW50IG1heF9jb2RlOyAgICAgICAgICAgICAgLyogbGFyZ2VzdCBjb2RlIHdpdGggbm9uIHplcm8gZnJlcXVlbmN5ICovXG4vLyAgICB1c2hmICpibF9jb3VudDsgICAgICAgICAgICAvKiBudW1iZXIgb2YgY29kZXMgYXQgZWFjaCBiaXQgbGVuZ3RoICovXG5cbiAgY29uc3QgbmV4dF9jb2RlID0gbmV3IEFycmF5KE1BWF9CSVRTJDEgKyAxKTsgLyogbmV4dCBjb2RlIHZhbHVlIGZvciBlYWNoIGJpdCBsZW5ndGggKi9cbiAgbGV0IGNvZGUgPSAwOyAgICAgICAgICAgICAgLyogcnVubmluZyBjb2RlIHZhbHVlICovXG4gIGxldCBiaXRzOyAgICAgICAgICAgICAgICAgIC8qIGJpdCBpbmRleCAqL1xuICBsZXQgbjsgICAgICAgICAgICAgICAgICAgICAvKiBjb2RlIGluZGV4ICovXG5cbiAgLyogVGhlIGRpc3RyaWJ1dGlvbiBjb3VudHMgYXJlIGZpcnN0IHVzZWQgdG8gZ2VuZXJhdGUgdGhlIGNvZGUgdmFsdWVzXG4gICAqIHdpdGhvdXQgYml0IHJldmVyc2FsLlxuICAgKi9cbiAgZm9yIChiaXRzID0gMTsgYml0cyA8PSBNQVhfQklUUyQxOyBiaXRzKyspIHtcbiAgICBjb2RlID0gKGNvZGUgKyBibF9jb3VudFtiaXRzIC0gMV0pIDw8IDE7XG4gICAgbmV4dF9jb2RlW2JpdHNdID0gY29kZTtcbiAgfVxuICAvKiBDaGVjayB0aGF0IHRoZSBiaXQgY291bnRzIGluIGJsX2NvdW50IGFyZSBjb25zaXN0ZW50LiBUaGUgbGFzdCBjb2RlXG4gICAqIG11c3QgYmUgYWxsIG9uZXMuXG4gICAqL1xuICAvL0Fzc2VydCAoY29kZSArIGJsX2NvdW50W01BWF9CSVRTXS0xID09ICgxPDxNQVhfQklUUyktMSxcbiAgLy8gICAgICAgIFwiaW5jb25zaXN0ZW50IGJpdCBjb3VudHNcIik7XG4gIC8vVHJhY2V2KChzdGRlcnIsXCJcXG5nZW5fY29kZXM6IG1heF9jb2RlICVkIFwiLCBtYXhfY29kZSkpO1xuXG4gIGZvciAobiA9IDA7ICBuIDw9IG1heF9jb2RlOyBuKyspIHtcbiAgICBsZXQgbGVuID0gdHJlZVtuICogMiArIDFdLyouTGVuKi87XG4gICAgaWYgKGxlbiA9PT0gMCkgeyBjb250aW51ZTsgfVxuICAgIC8qIE5vdyByZXZlcnNlIHRoZSBiaXRzICovXG4gICAgdHJlZVtuICogMl0vKi5Db2RlKi8gPSBiaV9yZXZlcnNlKG5leHRfY29kZVtsZW5dKyssIGxlbik7XG5cbiAgICAvL1RyYWNlY3YodHJlZSAhPSBzdGF0aWNfbHRyZWUsIChzdGRlcnIsXCJcXG5uICUzZCAlYyBsICUyZCBjICU0eCAoJXgpIFwiLFxuICAgIC8vICAgICBuLCAoaXNncmFwaChuKSA/IG4gOiAnICcpLCBsZW4sIHRyZWVbbl0uQ29kZSwgbmV4dF9jb2RlW2xlbl0tMSkpO1xuICB9XG59O1xuXG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogSW5pdGlhbGl6ZSB0aGUgdmFyaW91cyAnY29uc3RhbnQnIHRhYmxlcy5cbiAqL1xuY29uc3QgdHJfc3RhdGljX2luaXQgPSAoKSA9PiB7XG5cbiAgbGV0IG47ICAgICAgICAvKiBpdGVyYXRlcyBvdmVyIHRyZWUgZWxlbWVudHMgKi9cbiAgbGV0IGJpdHM7ICAgICAvKiBiaXQgY291bnRlciAqL1xuICBsZXQgbGVuZ3RoOyAgIC8qIGxlbmd0aCB2YWx1ZSAqL1xuICBsZXQgY29kZTsgICAgIC8qIGNvZGUgdmFsdWUgKi9cbiAgbGV0IGRpc3Q7ICAgICAvKiBkaXN0YW5jZSBpbmRleCAqL1xuICBjb25zdCBibF9jb3VudCA9IG5ldyBBcnJheShNQVhfQklUUyQxICsgMSk7XG4gIC8qIG51bWJlciBvZiBjb2RlcyBhdCBlYWNoIGJpdCBsZW5ndGggZm9yIGFuIG9wdGltYWwgdHJlZSAqL1xuXG4gIC8vIGRvIGNoZWNrIGluIF90cl9pbml0KClcbiAgLy9pZiAoc3RhdGljX2luaXRfZG9uZSkgcmV0dXJuO1xuXG4gIC8qIEZvciBzb21lIGVtYmVkZGVkIHRhcmdldHMsIGdsb2JhbCB2YXJpYWJsZXMgYXJlIG5vdCBpbml0aWFsaXplZDogKi9cbi8qI2lmZGVmIE5PX0lOSVRfR0xPQkFMX1BPSU5URVJTXG4gIHN0YXRpY19sX2Rlc2Muc3RhdGljX3RyZWUgPSBzdGF0aWNfbHRyZWU7XG4gIHN0YXRpY19sX2Rlc2MuZXh0cmFfYml0cyA9IGV4dHJhX2xiaXRzO1xuICBzdGF0aWNfZF9kZXNjLnN0YXRpY190cmVlID0gc3RhdGljX2R0cmVlO1xuICBzdGF0aWNfZF9kZXNjLmV4dHJhX2JpdHMgPSBleHRyYV9kYml0cztcbiAgc3RhdGljX2JsX2Rlc2MuZXh0cmFfYml0cyA9IGV4dHJhX2JsYml0cztcbiNlbmRpZiovXG5cbiAgLyogSW5pdGlhbGl6ZSB0aGUgbWFwcGluZyBsZW5ndGggKDAuLjI1NSkgLT4gbGVuZ3RoIGNvZGUgKDAuLjI4KSAqL1xuICBsZW5ndGggPSAwO1xuICBmb3IgKGNvZGUgPSAwOyBjb2RlIDwgTEVOR1RIX0NPREVTJDEgLSAxOyBjb2RlKyspIHtcbiAgICBiYXNlX2xlbmd0aFtjb2RlXSA9IGxlbmd0aDtcbiAgICBmb3IgKG4gPSAwOyBuIDwgKDEgPDwgZXh0cmFfbGJpdHNbY29kZV0pOyBuKyspIHtcbiAgICAgIF9sZW5ndGhfY29kZVtsZW5ndGgrK10gPSBjb2RlO1xuICAgIH1cbiAgfVxuICAvL0Fzc2VydCAobGVuZ3RoID09IDI1NiwgXCJ0cl9zdGF0aWNfaW5pdDogbGVuZ3RoICE9IDI1NlwiKTtcbiAgLyogTm90ZSB0aGF0IHRoZSBsZW5ndGggMjU1IChtYXRjaCBsZW5ndGggMjU4KSBjYW4gYmUgcmVwcmVzZW50ZWRcbiAgICogaW4gdHdvIGRpZmZlcmVudCB3YXlzOiBjb2RlIDI4NCArIDUgYml0cyBvciBjb2RlIDI4NSwgc28gd2VcbiAgICogb3ZlcndyaXRlIGxlbmd0aF9jb2RlWzI1NV0gdG8gdXNlIHRoZSBiZXN0IGVuY29kaW5nOlxuICAgKi9cbiAgX2xlbmd0aF9jb2RlW2xlbmd0aCAtIDFdID0gY29kZTtcblxuICAvKiBJbml0aWFsaXplIHRoZSBtYXBwaW5nIGRpc3QgKDAuLjMySykgLT4gZGlzdCBjb2RlICgwLi4yOSkgKi9cbiAgZGlzdCA9IDA7XG4gIGZvciAoY29kZSA9IDA7IGNvZGUgPCAxNjsgY29kZSsrKSB7XG4gICAgYmFzZV9kaXN0W2NvZGVdID0gZGlzdDtcbiAgICBmb3IgKG4gPSAwOyBuIDwgKDEgPDwgZXh0cmFfZGJpdHNbY29kZV0pOyBuKyspIHtcbiAgICAgIF9kaXN0X2NvZGVbZGlzdCsrXSA9IGNvZGU7XG4gICAgfVxuICB9XG4gIC8vQXNzZXJ0IChkaXN0ID09IDI1NiwgXCJ0cl9zdGF0aWNfaW5pdDogZGlzdCAhPSAyNTZcIik7XG4gIGRpc3QgPj49IDc7IC8qIGZyb20gbm93IG9uLCBhbGwgZGlzdGFuY2VzIGFyZSBkaXZpZGVkIGJ5IDEyOCAqL1xuICBmb3IgKDsgY29kZSA8IERfQ09ERVMkMTsgY29kZSsrKSB7XG4gICAgYmFzZV9kaXN0W2NvZGVdID0gZGlzdCA8PCA3O1xuICAgIGZvciAobiA9IDA7IG4gPCAoMSA8PCAoZXh0cmFfZGJpdHNbY29kZV0gLSA3KSk7IG4rKykge1xuICAgICAgX2Rpc3RfY29kZVsyNTYgKyBkaXN0KytdID0gY29kZTtcbiAgICB9XG4gIH1cbiAgLy9Bc3NlcnQgKGRpc3QgPT0gMjU2LCBcInRyX3N0YXRpY19pbml0OiAyNTYrZGlzdCAhPSA1MTJcIik7XG5cbiAgLyogQ29uc3RydWN0IHRoZSBjb2RlcyBvZiB0aGUgc3RhdGljIGxpdGVyYWwgdHJlZSAqL1xuICBmb3IgKGJpdHMgPSAwOyBiaXRzIDw9IE1BWF9CSVRTJDE7IGJpdHMrKykge1xuICAgIGJsX2NvdW50W2JpdHNdID0gMDtcbiAgfVxuXG4gIG4gPSAwO1xuICB3aGlsZSAobiA8PSAxNDMpIHtcbiAgICBzdGF0aWNfbHRyZWVbbiAqIDIgKyAxXS8qLkxlbiovID0gODtcbiAgICBuKys7XG4gICAgYmxfY291bnRbOF0rKztcbiAgfVxuICB3aGlsZSAobiA8PSAyNTUpIHtcbiAgICBzdGF0aWNfbHRyZWVbbiAqIDIgKyAxXS8qLkxlbiovID0gOTtcbiAgICBuKys7XG4gICAgYmxfY291bnRbOV0rKztcbiAgfVxuICB3aGlsZSAobiA8PSAyNzkpIHtcbiAgICBzdGF0aWNfbHRyZWVbbiAqIDIgKyAxXS8qLkxlbiovID0gNztcbiAgICBuKys7XG4gICAgYmxfY291bnRbN10rKztcbiAgfVxuICB3aGlsZSAobiA8PSAyODcpIHtcbiAgICBzdGF0aWNfbHRyZWVbbiAqIDIgKyAxXS8qLkxlbiovID0gODtcbiAgICBuKys7XG4gICAgYmxfY291bnRbOF0rKztcbiAgfVxuICAvKiBDb2RlcyAyODYgYW5kIDI4NyBkbyBub3QgZXhpc3QsIGJ1dCB3ZSBtdXN0IGluY2x1ZGUgdGhlbSBpbiB0aGVcbiAgICogdHJlZSBjb25zdHJ1Y3Rpb24gdG8gZ2V0IGEgY2Fub25pY2FsIEh1ZmZtYW4gdHJlZSAobG9uZ2VzdCBjb2RlXG4gICAqIGFsbCBvbmVzKVxuICAgKi9cbiAgZ2VuX2NvZGVzKHN0YXRpY19sdHJlZSwgTF9DT0RFUyQxICsgMSwgYmxfY291bnQpO1xuXG4gIC8qIFRoZSBzdGF0aWMgZGlzdGFuY2UgdHJlZSBpcyB0cml2aWFsOiAqL1xuICBmb3IgKG4gPSAwOyBuIDwgRF9DT0RFUyQxOyBuKyspIHtcbiAgICBzdGF0aWNfZHRyZWVbbiAqIDIgKyAxXS8qLkxlbiovID0gNTtcbiAgICBzdGF0aWNfZHRyZWVbbiAqIDJdLyouQ29kZSovID0gYmlfcmV2ZXJzZShuLCA1KTtcbiAgfVxuXG4gIC8vIE5vdyBkYXRhIHJlYWR5IGFuZCB3ZSBjYW4gaW5pdCBzdGF0aWMgdHJlZXNcbiAgc3RhdGljX2xfZGVzYyA9IG5ldyBTdGF0aWNUcmVlRGVzYyhzdGF0aWNfbHRyZWUsIGV4dHJhX2xiaXRzLCBMSVRFUkFMUyQxICsgMSwgTF9DT0RFUyQxLCBNQVhfQklUUyQxKTtcbiAgc3RhdGljX2RfZGVzYyA9IG5ldyBTdGF0aWNUcmVlRGVzYyhzdGF0aWNfZHRyZWUsIGV4dHJhX2RiaXRzLCAwLCAgICAgICAgICBEX0NPREVTJDEsIE1BWF9CSVRTJDEpO1xuICBzdGF0aWNfYmxfZGVzYyA9IG5ldyBTdGF0aWNUcmVlRGVzYyhuZXcgQXJyYXkoMCksIGV4dHJhX2JsYml0cywgMCwgICAgICAgICBCTF9DT0RFUyQxLCBNQVhfQkxfQklUUyk7XG5cbiAgLy9zdGF0aWNfaW5pdF9kb25lID0gdHJ1ZTtcbn07XG5cblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBJbml0aWFsaXplIGEgbmV3IGJsb2NrLlxuICovXG5jb25zdCBpbml0X2Jsb2NrID0gKHMpID0+IHtcblxuICBsZXQgbjsgLyogaXRlcmF0ZXMgb3ZlciB0cmVlIGVsZW1lbnRzICovXG5cbiAgLyogSW5pdGlhbGl6ZSB0aGUgdHJlZXMuICovXG4gIGZvciAobiA9IDA7IG4gPCBMX0NPREVTJDE7ICBuKyspIHsgcy5keW5fbHRyZWVbbiAqIDJdLyouRnJlcSovID0gMDsgfVxuICBmb3IgKG4gPSAwOyBuIDwgRF9DT0RFUyQxOyAgbisrKSB7IHMuZHluX2R0cmVlW24gKiAyXS8qLkZyZXEqLyA9IDA7IH1cbiAgZm9yIChuID0gMDsgbiA8IEJMX0NPREVTJDE7IG4rKykgeyBzLmJsX3RyZWVbbiAqIDJdLyouRnJlcSovID0gMDsgfVxuXG4gIHMuZHluX2x0cmVlW0VORF9CTE9DSyAqIDJdLyouRnJlcSovID0gMTtcbiAgcy5vcHRfbGVuID0gcy5zdGF0aWNfbGVuID0gMDtcbiAgcy5zeW1fbmV4dCA9IHMubWF0Y2hlcyA9IDA7XG59O1xuXG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogRmx1c2ggdGhlIGJpdCBidWZmZXIgYW5kIGFsaWduIHRoZSBvdXRwdXQgb24gYSBieXRlIGJvdW5kYXJ5XG4gKi9cbmNvbnN0IGJpX3dpbmR1cCA9IChzKSA9Plxue1xuICBpZiAocy5iaV92YWxpZCA+IDgpIHtcbiAgICBwdXRfc2hvcnQocywgcy5iaV9idWYpO1xuICB9IGVsc2UgaWYgKHMuYmlfdmFsaWQgPiAwKSB7XG4gICAgLy9wdXRfYnl0ZShzLCAoQnl0ZSlzLT5iaV9idWYpO1xuICAgIHMucGVuZGluZ19idWZbcy5wZW5kaW5nKytdID0gcy5iaV9idWY7XG4gIH1cbiAgcy5iaV9idWYgPSAwO1xuICBzLmJpX3ZhbGlkID0gMDtcbn07XG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogQ29tcGFyZXMgdG8gc3VidHJlZXMsIHVzaW5nIHRoZSB0cmVlIGRlcHRoIGFzIHRpZSBicmVha2VyIHdoZW5cbiAqIHRoZSBzdWJ0cmVlcyBoYXZlIGVxdWFsIGZyZXF1ZW5jeS4gVGhpcyBtaW5pbWl6ZXMgdGhlIHdvcnN0IGNhc2UgbGVuZ3RoLlxuICovXG5jb25zdCBzbWFsbGVyID0gKHRyZWUsIG4sIG0sIGRlcHRoKSA9PiB7XG5cbiAgY29uc3QgX24yID0gbiAqIDI7XG4gIGNvbnN0IF9tMiA9IG0gKiAyO1xuICByZXR1cm4gKHRyZWVbX24yXS8qLkZyZXEqLyA8IHRyZWVbX20yXS8qLkZyZXEqLyB8fFxuICAgICAgICAgKHRyZWVbX24yXS8qLkZyZXEqLyA9PT0gdHJlZVtfbTJdLyouRnJlcSovICYmIGRlcHRoW25dIDw9IGRlcHRoW21dKSk7XG59O1xuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIFJlc3RvcmUgdGhlIGhlYXAgcHJvcGVydHkgYnkgbW92aW5nIGRvd24gdGhlIHRyZWUgc3RhcnRpbmcgYXQgbm9kZSBrLFxuICogZXhjaGFuZ2luZyBhIG5vZGUgd2l0aCB0aGUgc21hbGxlc3Qgb2YgaXRzIHR3byBzb25zIGlmIG5lY2Vzc2FyeSwgc3RvcHBpbmdcbiAqIHdoZW4gdGhlIGhlYXAgcHJvcGVydHkgaXMgcmUtZXN0YWJsaXNoZWQgKGVhY2ggZmF0aGVyIHNtYWxsZXIgdGhhbiBpdHNcbiAqIHR3byBzb25zKS5cbiAqL1xuY29uc3QgcHFkb3duaGVhcCA9IChzLCB0cmVlLCBrKSA9PiB7XG4vLyAgICBkZWZsYXRlX3N0YXRlICpzO1xuLy8gICAgY3RfZGF0YSAqdHJlZTsgIC8qIHRoZSB0cmVlIHRvIHJlc3RvcmUgKi9cbi8vICAgIGludCBrOyAgICAgICAgICAgICAgIC8qIG5vZGUgdG8gbW92ZSBkb3duICovXG5cbiAgY29uc3QgdiA9IHMuaGVhcFtrXTtcbiAgbGV0IGogPSBrIDw8IDE7ICAvKiBsZWZ0IHNvbiBvZiBrICovXG4gIHdoaWxlIChqIDw9IHMuaGVhcF9sZW4pIHtcbiAgICAvKiBTZXQgaiB0byB0aGUgc21hbGxlc3Qgb2YgdGhlIHR3byBzb25zOiAqL1xuICAgIGlmIChqIDwgcy5oZWFwX2xlbiAmJlxuICAgICAgc21hbGxlcih0cmVlLCBzLmhlYXBbaiArIDFdLCBzLmhlYXBbal0sIHMuZGVwdGgpKSB7XG4gICAgICBqKys7XG4gICAgfVxuICAgIC8qIEV4aXQgaWYgdiBpcyBzbWFsbGVyIHRoYW4gYm90aCBzb25zICovXG4gICAgaWYgKHNtYWxsZXIodHJlZSwgdiwgcy5oZWFwW2pdLCBzLmRlcHRoKSkgeyBicmVhazsgfVxuXG4gICAgLyogRXhjaGFuZ2UgdiB3aXRoIHRoZSBzbWFsbGVzdCBzb24gKi9cbiAgICBzLmhlYXBba10gPSBzLmhlYXBbal07XG4gICAgayA9IGo7XG5cbiAgICAvKiBBbmQgY29udGludWUgZG93biB0aGUgdHJlZSwgc2V0dGluZyBqIHRvIHRoZSBsZWZ0IHNvbiBvZiBrICovXG4gICAgaiA8PD0gMTtcbiAgfVxuICBzLmhlYXBba10gPSB2O1xufTtcblxuXG4vLyBpbmxpbmVkIG1hbnVhbGx5XG4vLyBjb25zdCBTTUFMTEVTVCA9IDE7XG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogU2VuZCB0aGUgYmxvY2sgZGF0YSBjb21wcmVzc2VkIHVzaW5nIHRoZSBnaXZlbiBIdWZmbWFuIHRyZWVzXG4gKi9cbmNvbnN0IGNvbXByZXNzX2Jsb2NrID0gKHMsIGx0cmVlLCBkdHJlZSkgPT4ge1xuLy8gICAgZGVmbGF0ZV9zdGF0ZSAqcztcbi8vICAgIGNvbnN0IGN0X2RhdGEgKmx0cmVlOyAvKiBsaXRlcmFsIHRyZWUgKi9cbi8vICAgIGNvbnN0IGN0X2RhdGEgKmR0cmVlOyAvKiBkaXN0YW5jZSB0cmVlICovXG5cbiAgbGV0IGRpc3Q7ICAgICAgICAgICAvKiBkaXN0YW5jZSBvZiBtYXRjaGVkIHN0cmluZyAqL1xuICBsZXQgbGM7ICAgICAgICAgICAgIC8qIG1hdGNoIGxlbmd0aCBvciB1bm1hdGNoZWQgY2hhciAoaWYgZGlzdCA9PSAwKSAqL1xuICBsZXQgc3ggPSAwOyAgICAgICAgIC8qIHJ1bm5pbmcgaW5kZXggaW4gc3ltX2J1ZiAqL1xuICBsZXQgY29kZTsgICAgICAgICAgIC8qIHRoZSBjb2RlIHRvIHNlbmQgKi9cbiAgbGV0IGV4dHJhOyAgICAgICAgICAvKiBudW1iZXIgb2YgZXh0cmEgYml0cyB0byBzZW5kICovXG5cbiAgaWYgKHMuc3ltX25leHQgIT09IDApIHtcbiAgICBkbyB7XG4gICAgICBkaXN0ID0gcy5wZW5kaW5nX2J1ZltzLnN5bV9idWYgKyBzeCsrXSAmIDB4ZmY7XG4gICAgICBkaXN0ICs9IChzLnBlbmRpbmdfYnVmW3Muc3ltX2J1ZiArIHN4KytdICYgMHhmZikgPDwgODtcbiAgICAgIGxjID0gcy5wZW5kaW5nX2J1ZltzLnN5bV9idWYgKyBzeCsrXTtcbiAgICAgIGlmIChkaXN0ID09PSAwKSB7XG4gICAgICAgIHNlbmRfY29kZShzLCBsYywgbHRyZWUpOyAvKiBzZW5kIGEgbGl0ZXJhbCBieXRlICovXG4gICAgICAgIC8vVHJhY2Vjdihpc2dyYXBoKGxjKSwgKHN0ZGVycixcIiAnJWMnIFwiLCBsYykpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLyogSGVyZSwgbGMgaXMgdGhlIG1hdGNoIGxlbmd0aCAtIE1JTl9NQVRDSCAqL1xuICAgICAgICBjb2RlID0gX2xlbmd0aF9jb2RlW2xjXTtcbiAgICAgICAgc2VuZF9jb2RlKHMsIGNvZGUgKyBMSVRFUkFMUyQxICsgMSwgbHRyZWUpOyAvKiBzZW5kIHRoZSBsZW5ndGggY29kZSAqL1xuICAgICAgICBleHRyYSA9IGV4dHJhX2xiaXRzW2NvZGVdO1xuICAgICAgICBpZiAoZXh0cmEgIT09IDApIHtcbiAgICAgICAgICBsYyAtPSBiYXNlX2xlbmd0aFtjb2RlXTtcbiAgICAgICAgICBzZW5kX2JpdHMocywgbGMsIGV4dHJhKTsgICAgICAgLyogc2VuZCB0aGUgZXh0cmEgbGVuZ3RoIGJpdHMgKi9cbiAgICAgICAgfVxuICAgICAgICBkaXN0LS07IC8qIGRpc3QgaXMgbm93IHRoZSBtYXRjaCBkaXN0YW5jZSAtIDEgKi9cbiAgICAgICAgY29kZSA9IGRfY29kZShkaXN0KTtcbiAgICAgICAgLy9Bc3NlcnQgKGNvZGUgPCBEX0NPREVTLCBcImJhZCBkX2NvZGVcIik7XG5cbiAgICAgICAgc2VuZF9jb2RlKHMsIGNvZGUsIGR0cmVlKTsgICAgICAgLyogc2VuZCB0aGUgZGlzdGFuY2UgY29kZSAqL1xuICAgICAgICBleHRyYSA9IGV4dHJhX2RiaXRzW2NvZGVdO1xuICAgICAgICBpZiAoZXh0cmEgIT09IDApIHtcbiAgICAgICAgICBkaXN0IC09IGJhc2VfZGlzdFtjb2RlXTtcbiAgICAgICAgICBzZW5kX2JpdHMocywgZGlzdCwgZXh0cmEpOyAgIC8qIHNlbmQgdGhlIGV4dHJhIGRpc3RhbmNlIGJpdHMgKi9cbiAgICAgICAgfVxuICAgICAgfSAvKiBsaXRlcmFsIG9yIG1hdGNoIHBhaXIgPyAqL1xuXG4gICAgICAvKiBDaGVjayB0aGF0IHRoZSBvdmVybGF5IGJldHdlZW4gcGVuZGluZ19idWYgYW5kIHN5bV9idWYgaXMgb2s6ICovXG4gICAgICAvL0Fzc2VydChzLT5wZW5kaW5nIDwgcy0+bGl0X2J1ZnNpemUgKyBzeCwgXCJwZW5kaW5nQnVmIG92ZXJmbG93XCIpO1xuXG4gICAgfSB3aGlsZSAoc3ggPCBzLnN5bV9uZXh0KTtcbiAgfVxuXG4gIHNlbmRfY29kZShzLCBFTkRfQkxPQ0ssIGx0cmVlKTtcbn07XG5cblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBDb25zdHJ1Y3Qgb25lIEh1ZmZtYW4gdHJlZSBhbmQgYXNzaWducyB0aGUgY29kZSBiaXQgc3RyaW5ncyBhbmQgbGVuZ3Rocy5cbiAqIFVwZGF0ZSB0aGUgdG90YWwgYml0IGxlbmd0aCBmb3IgdGhlIGN1cnJlbnQgYmxvY2suXG4gKiBJTiBhc3NlcnRpb246IHRoZSBmaWVsZCBmcmVxIGlzIHNldCBmb3IgYWxsIHRyZWUgZWxlbWVudHMuXG4gKiBPVVQgYXNzZXJ0aW9uczogdGhlIGZpZWxkcyBsZW4gYW5kIGNvZGUgYXJlIHNldCB0byB0aGUgb3B0aW1hbCBiaXQgbGVuZ3RoXG4gKiAgICAgYW5kIGNvcnJlc3BvbmRpbmcgY29kZS4gVGhlIGxlbmd0aCBvcHRfbGVuIGlzIHVwZGF0ZWQ7IHN0YXRpY19sZW4gaXNcbiAqICAgICBhbHNvIHVwZGF0ZWQgaWYgc3RyZWUgaXMgbm90IG51bGwuIFRoZSBmaWVsZCBtYXhfY29kZSBpcyBzZXQuXG4gKi9cbmNvbnN0IGJ1aWxkX3RyZWUgPSAocywgZGVzYykgPT4ge1xuLy8gICAgZGVmbGF0ZV9zdGF0ZSAqcztcbi8vICAgIHRyZWVfZGVzYyAqZGVzYzsgLyogdGhlIHRyZWUgZGVzY3JpcHRvciAqL1xuXG4gIGNvbnN0IHRyZWUgICAgID0gZGVzYy5keW5fdHJlZTtcbiAgY29uc3Qgc3RyZWUgICAgPSBkZXNjLnN0YXRfZGVzYy5zdGF0aWNfdHJlZTtcbiAgY29uc3QgaGFzX3N0cmVlID0gZGVzYy5zdGF0X2Rlc2MuaGFzX3N0cmVlO1xuICBjb25zdCBlbGVtcyAgICA9IGRlc2Muc3RhdF9kZXNjLmVsZW1zO1xuICBsZXQgbiwgbTsgICAgICAgICAgLyogaXRlcmF0ZSBvdmVyIGhlYXAgZWxlbWVudHMgKi9cbiAgbGV0IG1heF9jb2RlID0gLTE7IC8qIGxhcmdlc3QgY29kZSB3aXRoIG5vbiB6ZXJvIGZyZXF1ZW5jeSAqL1xuICBsZXQgbm9kZTsgICAgICAgICAgLyogbmV3IG5vZGUgYmVpbmcgY3JlYXRlZCAqL1xuXG4gIC8qIENvbnN0cnVjdCB0aGUgaW5pdGlhbCBoZWFwLCB3aXRoIGxlYXN0IGZyZXF1ZW50IGVsZW1lbnQgaW5cbiAgICogaGVhcFtTTUFMTEVTVF0uIFRoZSBzb25zIG9mIGhlYXBbbl0gYXJlIGhlYXBbMipuXSBhbmQgaGVhcFsyKm4rMV0uXG4gICAqIGhlYXBbMF0gaXMgbm90IHVzZWQuXG4gICAqL1xuICBzLmhlYXBfbGVuID0gMDtcbiAgcy5oZWFwX21heCA9IEhFQVBfU0laRSQxO1xuXG4gIGZvciAobiA9IDA7IG4gPCBlbGVtczsgbisrKSB7XG4gICAgaWYgKHRyZWVbbiAqIDJdLyouRnJlcSovICE9PSAwKSB7XG4gICAgICBzLmhlYXBbKytzLmhlYXBfbGVuXSA9IG1heF9jb2RlID0gbjtcbiAgICAgIHMuZGVwdGhbbl0gPSAwO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgIHRyZWVbbiAqIDIgKyAxXS8qLkxlbiovID0gMDtcbiAgICB9XG4gIH1cblxuICAvKiBUaGUgcGt6aXAgZm9ybWF0IHJlcXVpcmVzIHRoYXQgYXQgbGVhc3Qgb25lIGRpc3RhbmNlIGNvZGUgZXhpc3RzLFxuICAgKiBhbmQgdGhhdCBhdCBsZWFzdCBvbmUgYml0IHNob3VsZCBiZSBzZW50IGV2ZW4gaWYgdGhlcmUgaXMgb25seSBvbmVcbiAgICogcG9zc2libGUgY29kZS4gU28gdG8gYXZvaWQgc3BlY2lhbCBjaGVja3MgbGF0ZXIgb24gd2UgZm9yY2UgYXQgbGVhc3RcbiAgICogdHdvIGNvZGVzIG9mIG5vbiB6ZXJvIGZyZXF1ZW5jeS5cbiAgICovXG4gIHdoaWxlIChzLmhlYXBfbGVuIDwgMikge1xuICAgIG5vZGUgPSBzLmhlYXBbKytzLmhlYXBfbGVuXSA9IChtYXhfY29kZSA8IDIgPyArK21heF9jb2RlIDogMCk7XG4gICAgdHJlZVtub2RlICogMl0vKi5GcmVxKi8gPSAxO1xuICAgIHMuZGVwdGhbbm9kZV0gPSAwO1xuICAgIHMub3B0X2xlbi0tO1xuXG4gICAgaWYgKGhhc19zdHJlZSkge1xuICAgICAgcy5zdGF0aWNfbGVuIC09IHN0cmVlW25vZGUgKiAyICsgMV0vKi5MZW4qLztcbiAgICB9XG4gICAgLyogbm9kZSBpcyAwIG9yIDEgc28gaXQgZG9lcyBub3QgaGF2ZSBleHRyYSBiaXRzICovXG4gIH1cbiAgZGVzYy5tYXhfY29kZSA9IG1heF9jb2RlO1xuXG4gIC8qIFRoZSBlbGVtZW50cyBoZWFwW2hlYXBfbGVuLzIrMSAuLiBoZWFwX2xlbl0gYXJlIGxlYXZlcyBvZiB0aGUgdHJlZSxcbiAgICogZXN0YWJsaXNoIHN1Yi1oZWFwcyBvZiBpbmNyZWFzaW5nIGxlbmd0aHM6XG4gICAqL1xuICBmb3IgKG4gPSAocy5oZWFwX2xlbiA+PiAxLyppbnQgLzIqLyk7IG4gPj0gMTsgbi0tKSB7IHBxZG93bmhlYXAocywgdHJlZSwgbik7IH1cblxuICAvKiBDb25zdHJ1Y3QgdGhlIEh1ZmZtYW4gdHJlZSBieSByZXBlYXRlZGx5IGNvbWJpbmluZyB0aGUgbGVhc3QgdHdvXG4gICAqIGZyZXF1ZW50IG5vZGVzLlxuICAgKi9cbiAgbm9kZSA9IGVsZW1zOyAgICAgICAgICAgICAgLyogbmV4dCBpbnRlcm5hbCBub2RlIG9mIHRoZSB0cmVlICovXG4gIGRvIHtcbiAgICAvL3BxcmVtb3ZlKHMsIHRyZWUsIG4pOyAgLyogbiA9IG5vZGUgb2YgbGVhc3QgZnJlcXVlbmN5ICovXG4gICAgLyoqKiBwcXJlbW92ZSAqKiovXG4gICAgbiA9IHMuaGVhcFsxLypTTUFMTEVTVCovXTtcbiAgICBzLmhlYXBbMS8qU01BTExFU1QqL10gPSBzLmhlYXBbcy5oZWFwX2xlbi0tXTtcbiAgICBwcWRvd25oZWFwKHMsIHRyZWUsIDEvKlNNQUxMRVNUKi8pO1xuICAgIC8qKiovXG5cbiAgICBtID0gcy5oZWFwWzEvKlNNQUxMRVNUKi9dOyAvKiBtID0gbm9kZSBvZiBuZXh0IGxlYXN0IGZyZXF1ZW5jeSAqL1xuXG4gICAgcy5oZWFwWy0tcy5oZWFwX21heF0gPSBuOyAvKiBrZWVwIHRoZSBub2RlcyBzb3J0ZWQgYnkgZnJlcXVlbmN5ICovXG4gICAgcy5oZWFwWy0tcy5oZWFwX21heF0gPSBtO1xuXG4gICAgLyogQ3JlYXRlIGEgbmV3IG5vZGUgZmF0aGVyIG9mIG4gYW5kIG0gKi9cbiAgICB0cmVlW25vZGUgKiAyXS8qLkZyZXEqLyA9IHRyZWVbbiAqIDJdLyouRnJlcSovICsgdHJlZVttICogMl0vKi5GcmVxKi87XG4gICAgcy5kZXB0aFtub2RlXSA9IChzLmRlcHRoW25dID49IHMuZGVwdGhbbV0gPyBzLmRlcHRoW25dIDogcy5kZXB0aFttXSkgKyAxO1xuICAgIHRyZWVbbiAqIDIgKyAxXS8qLkRhZCovID0gdHJlZVttICogMiArIDFdLyouRGFkKi8gPSBub2RlO1xuXG4gICAgLyogYW5kIGluc2VydCB0aGUgbmV3IG5vZGUgaW4gdGhlIGhlYXAgKi9cbiAgICBzLmhlYXBbMS8qU01BTExFU1QqL10gPSBub2RlKys7XG4gICAgcHFkb3duaGVhcChzLCB0cmVlLCAxLypTTUFMTEVTVCovKTtcblxuICB9IHdoaWxlIChzLmhlYXBfbGVuID49IDIpO1xuXG4gIHMuaGVhcFstLXMuaGVhcF9tYXhdID0gcy5oZWFwWzEvKlNNQUxMRVNUKi9dO1xuXG4gIC8qIEF0IHRoaXMgcG9pbnQsIHRoZSBmaWVsZHMgZnJlcSBhbmQgZGFkIGFyZSBzZXQuIFdlIGNhbiBub3dcbiAgICogZ2VuZXJhdGUgdGhlIGJpdCBsZW5ndGhzLlxuICAgKi9cbiAgZ2VuX2JpdGxlbihzLCBkZXNjKTtcblxuICAvKiBUaGUgZmllbGQgbGVuIGlzIG5vdyBzZXQsIHdlIGNhbiBnZW5lcmF0ZSB0aGUgYml0IGNvZGVzICovXG4gIGdlbl9jb2Rlcyh0cmVlLCBtYXhfY29kZSwgcy5ibF9jb3VudCk7XG59O1xuXG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogU2NhbiBhIGxpdGVyYWwgb3IgZGlzdGFuY2UgdHJlZSB0byBkZXRlcm1pbmUgdGhlIGZyZXF1ZW5jaWVzIG9mIHRoZSBjb2Rlc1xuICogaW4gdGhlIGJpdCBsZW5ndGggdHJlZS5cbiAqL1xuY29uc3Qgc2Nhbl90cmVlID0gKHMsIHRyZWUsIG1heF9jb2RlKSA9PiB7XG4vLyAgICBkZWZsYXRlX3N0YXRlICpzO1xuLy8gICAgY3RfZGF0YSAqdHJlZTsgICAvKiB0aGUgdHJlZSB0byBiZSBzY2FubmVkICovXG4vLyAgICBpbnQgbWF4X2NvZGU7ICAgIC8qIGFuZCBpdHMgbGFyZ2VzdCBjb2RlIG9mIG5vbiB6ZXJvIGZyZXF1ZW5jeSAqL1xuXG4gIGxldCBuOyAgICAgICAgICAgICAgICAgICAgIC8qIGl0ZXJhdGVzIG92ZXIgYWxsIHRyZWUgZWxlbWVudHMgKi9cbiAgbGV0IHByZXZsZW4gPSAtMTsgICAgICAgICAgLyogbGFzdCBlbWl0dGVkIGxlbmd0aCAqL1xuICBsZXQgY3VybGVuOyAgICAgICAgICAgICAgICAvKiBsZW5ndGggb2YgY3VycmVudCBjb2RlICovXG5cbiAgbGV0IG5leHRsZW4gPSB0cmVlWzAgKiAyICsgMV0vKi5MZW4qLzsgLyogbGVuZ3RoIG9mIG5leHQgY29kZSAqL1xuXG4gIGxldCBjb3VudCA9IDA7ICAgICAgICAgICAgIC8qIHJlcGVhdCBjb3VudCBvZiB0aGUgY3VycmVudCBjb2RlICovXG4gIGxldCBtYXhfY291bnQgPSA3OyAgICAgICAgIC8qIG1heCByZXBlYXQgY291bnQgKi9cbiAgbGV0IG1pbl9jb3VudCA9IDQ7ICAgICAgICAgLyogbWluIHJlcGVhdCBjb3VudCAqL1xuXG4gIGlmIChuZXh0bGVuID09PSAwKSB7XG4gICAgbWF4X2NvdW50ID0gMTM4O1xuICAgIG1pbl9jb3VudCA9IDM7XG4gIH1cbiAgdHJlZVsobWF4X2NvZGUgKyAxKSAqIDIgKyAxXS8qLkxlbiovID0gMHhmZmZmOyAvKiBndWFyZCAqL1xuXG4gIGZvciAobiA9IDA7IG4gPD0gbWF4X2NvZGU7IG4rKykge1xuICAgIGN1cmxlbiA9IG5leHRsZW47XG4gICAgbmV4dGxlbiA9IHRyZWVbKG4gKyAxKSAqIDIgKyAxXS8qLkxlbiovO1xuXG4gICAgaWYgKCsrY291bnQgPCBtYXhfY291bnQgJiYgY3VybGVuID09PSBuZXh0bGVuKSB7XG4gICAgICBjb250aW51ZTtcblxuICAgIH0gZWxzZSBpZiAoY291bnQgPCBtaW5fY291bnQpIHtcbiAgICAgIHMuYmxfdHJlZVtjdXJsZW4gKiAyXS8qLkZyZXEqLyArPSBjb3VudDtcblxuICAgIH0gZWxzZSBpZiAoY3VybGVuICE9PSAwKSB7XG5cbiAgICAgIGlmIChjdXJsZW4gIT09IHByZXZsZW4pIHsgcy5ibF90cmVlW2N1cmxlbiAqIDJdLyouRnJlcSovKys7IH1cbiAgICAgIHMuYmxfdHJlZVtSRVBfM182ICogMl0vKi5GcmVxKi8rKztcblxuICAgIH0gZWxzZSBpZiAoY291bnQgPD0gMTApIHtcbiAgICAgIHMuYmxfdHJlZVtSRVBaXzNfMTAgKiAyXS8qLkZyZXEqLysrO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgIHMuYmxfdHJlZVtSRVBaXzExXzEzOCAqIDJdLyouRnJlcSovKys7XG4gICAgfVxuXG4gICAgY291bnQgPSAwO1xuICAgIHByZXZsZW4gPSBjdXJsZW47XG5cbiAgICBpZiAobmV4dGxlbiA9PT0gMCkge1xuICAgICAgbWF4X2NvdW50ID0gMTM4O1xuICAgICAgbWluX2NvdW50ID0gMztcblxuICAgIH0gZWxzZSBpZiAoY3VybGVuID09PSBuZXh0bGVuKSB7XG4gICAgICBtYXhfY291bnQgPSA2O1xuICAgICAgbWluX2NvdW50ID0gMztcblxuICAgIH0gZWxzZSB7XG4gICAgICBtYXhfY291bnQgPSA3O1xuICAgICAgbWluX2NvdW50ID0gNDtcbiAgICB9XG4gIH1cbn07XG5cblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBTZW5kIGEgbGl0ZXJhbCBvciBkaXN0YW5jZSB0cmVlIGluIGNvbXByZXNzZWQgZm9ybSwgdXNpbmcgdGhlIGNvZGVzIGluXG4gKiBibF90cmVlLlxuICovXG5jb25zdCBzZW5kX3RyZWUgPSAocywgdHJlZSwgbWF4X2NvZGUpID0+IHtcbi8vICAgIGRlZmxhdGVfc3RhdGUgKnM7XG4vLyAgICBjdF9kYXRhICp0cmVlOyAvKiB0aGUgdHJlZSB0byBiZSBzY2FubmVkICovXG4vLyAgICBpbnQgbWF4X2NvZGU7ICAgICAgIC8qIGFuZCBpdHMgbGFyZ2VzdCBjb2RlIG9mIG5vbiB6ZXJvIGZyZXF1ZW5jeSAqL1xuXG4gIGxldCBuOyAgICAgICAgICAgICAgICAgICAgIC8qIGl0ZXJhdGVzIG92ZXIgYWxsIHRyZWUgZWxlbWVudHMgKi9cbiAgbGV0IHByZXZsZW4gPSAtMTsgICAgICAgICAgLyogbGFzdCBlbWl0dGVkIGxlbmd0aCAqL1xuICBsZXQgY3VybGVuOyAgICAgICAgICAgICAgICAvKiBsZW5ndGggb2YgY3VycmVudCBjb2RlICovXG5cbiAgbGV0IG5leHRsZW4gPSB0cmVlWzAgKiAyICsgMV0vKi5MZW4qLzsgLyogbGVuZ3RoIG9mIG5leHQgY29kZSAqL1xuXG4gIGxldCBjb3VudCA9IDA7ICAgICAgICAgICAgIC8qIHJlcGVhdCBjb3VudCBvZiB0aGUgY3VycmVudCBjb2RlICovXG4gIGxldCBtYXhfY291bnQgPSA3OyAgICAgICAgIC8qIG1heCByZXBlYXQgY291bnQgKi9cbiAgbGV0IG1pbl9jb3VudCA9IDQ7ICAgICAgICAgLyogbWluIHJlcGVhdCBjb3VudCAqL1xuXG4gIC8qIHRyZWVbbWF4X2NvZGUrMV0uTGVuID0gLTE7ICovICAvKiBndWFyZCBhbHJlYWR5IHNldCAqL1xuICBpZiAobmV4dGxlbiA9PT0gMCkge1xuICAgIG1heF9jb3VudCA9IDEzODtcbiAgICBtaW5fY291bnQgPSAzO1xuICB9XG5cbiAgZm9yIChuID0gMDsgbiA8PSBtYXhfY29kZTsgbisrKSB7XG4gICAgY3VybGVuID0gbmV4dGxlbjtcbiAgICBuZXh0bGVuID0gdHJlZVsobiArIDEpICogMiArIDFdLyouTGVuKi87XG5cbiAgICBpZiAoKytjb3VudCA8IG1heF9jb3VudCAmJiBjdXJsZW4gPT09IG5leHRsZW4pIHtcbiAgICAgIGNvbnRpbnVlO1xuXG4gICAgfSBlbHNlIGlmIChjb3VudCA8IG1pbl9jb3VudCkge1xuICAgICAgZG8geyBzZW5kX2NvZGUocywgY3VybGVuLCBzLmJsX3RyZWUpOyB9IHdoaWxlICgtLWNvdW50ICE9PSAwKTtcblxuICAgIH0gZWxzZSBpZiAoY3VybGVuICE9PSAwKSB7XG4gICAgICBpZiAoY3VybGVuICE9PSBwcmV2bGVuKSB7XG4gICAgICAgIHNlbmRfY29kZShzLCBjdXJsZW4sIHMuYmxfdHJlZSk7XG4gICAgICAgIGNvdW50LS07XG4gICAgICB9XG4gICAgICAvL0Fzc2VydChjb3VudCA+PSAzICYmIGNvdW50IDw9IDYsIFwiIDNfNj9cIik7XG4gICAgICBzZW5kX2NvZGUocywgUkVQXzNfNiwgcy5ibF90cmVlKTtcbiAgICAgIHNlbmRfYml0cyhzLCBjb3VudCAtIDMsIDIpO1xuXG4gICAgfSBlbHNlIGlmIChjb3VudCA8PSAxMCkge1xuICAgICAgc2VuZF9jb2RlKHMsIFJFUFpfM18xMCwgcy5ibF90cmVlKTtcbiAgICAgIHNlbmRfYml0cyhzLCBjb3VudCAtIDMsIDMpO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgIHNlbmRfY29kZShzLCBSRVBaXzExXzEzOCwgcy5ibF90cmVlKTtcbiAgICAgIHNlbmRfYml0cyhzLCBjb3VudCAtIDExLCA3KTtcbiAgICB9XG5cbiAgICBjb3VudCA9IDA7XG4gICAgcHJldmxlbiA9IGN1cmxlbjtcbiAgICBpZiAobmV4dGxlbiA9PT0gMCkge1xuICAgICAgbWF4X2NvdW50ID0gMTM4O1xuICAgICAgbWluX2NvdW50ID0gMztcblxuICAgIH0gZWxzZSBpZiAoY3VybGVuID09PSBuZXh0bGVuKSB7XG4gICAgICBtYXhfY291bnQgPSA2O1xuICAgICAgbWluX2NvdW50ID0gMztcblxuICAgIH0gZWxzZSB7XG4gICAgICBtYXhfY291bnQgPSA3O1xuICAgICAgbWluX2NvdW50ID0gNDtcbiAgICB9XG4gIH1cbn07XG5cblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBDb25zdHJ1Y3QgdGhlIEh1ZmZtYW4gdHJlZSBmb3IgdGhlIGJpdCBsZW5ndGhzIGFuZCByZXR1cm4gdGhlIGluZGV4IGluXG4gKiBibF9vcmRlciBvZiB0aGUgbGFzdCBiaXQgbGVuZ3RoIGNvZGUgdG8gc2VuZC5cbiAqL1xuY29uc3QgYnVpbGRfYmxfdHJlZSA9IChzKSA9PiB7XG5cbiAgbGV0IG1heF9ibGluZGV4OyAgLyogaW5kZXggb2YgbGFzdCBiaXQgbGVuZ3RoIGNvZGUgb2Ygbm9uIHplcm8gZnJlcSAqL1xuXG4gIC8qIERldGVybWluZSB0aGUgYml0IGxlbmd0aCBmcmVxdWVuY2llcyBmb3IgbGl0ZXJhbCBhbmQgZGlzdGFuY2UgdHJlZXMgKi9cbiAgc2Nhbl90cmVlKHMsIHMuZHluX2x0cmVlLCBzLmxfZGVzYy5tYXhfY29kZSk7XG4gIHNjYW5fdHJlZShzLCBzLmR5bl9kdHJlZSwgcy5kX2Rlc2MubWF4X2NvZGUpO1xuXG4gIC8qIEJ1aWxkIHRoZSBiaXQgbGVuZ3RoIHRyZWU6ICovXG4gIGJ1aWxkX3RyZWUocywgcy5ibF9kZXNjKTtcbiAgLyogb3B0X2xlbiBub3cgaW5jbHVkZXMgdGhlIGxlbmd0aCBvZiB0aGUgdHJlZSByZXByZXNlbnRhdGlvbnMsIGV4Y2VwdFxuICAgKiB0aGUgbGVuZ3RocyBvZiB0aGUgYml0IGxlbmd0aHMgY29kZXMgYW5kIHRoZSA1KzUrNCBiaXRzIGZvciB0aGUgY291bnRzLlxuICAgKi9cblxuICAvKiBEZXRlcm1pbmUgdGhlIG51bWJlciBvZiBiaXQgbGVuZ3RoIGNvZGVzIHRvIHNlbmQuIFRoZSBwa3ppcCBmb3JtYXRcbiAgICogcmVxdWlyZXMgdGhhdCBhdCBsZWFzdCA0IGJpdCBsZW5ndGggY29kZXMgYmUgc2VudC4gKGFwcG5vdGUudHh0IHNheXNcbiAgICogMyBidXQgdGhlIGFjdHVhbCB2YWx1ZSB1c2VkIGlzIDQuKVxuICAgKi9cbiAgZm9yIChtYXhfYmxpbmRleCA9IEJMX0NPREVTJDEgLSAxOyBtYXhfYmxpbmRleCA+PSAzOyBtYXhfYmxpbmRleC0tKSB7XG4gICAgaWYgKHMuYmxfdHJlZVtibF9vcmRlclttYXhfYmxpbmRleF0gKiAyICsgMV0vKi5MZW4qLyAhPT0gMCkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG4gIC8qIFVwZGF0ZSBvcHRfbGVuIHRvIGluY2x1ZGUgdGhlIGJpdCBsZW5ndGggdHJlZSBhbmQgY291bnRzICovXG4gIHMub3B0X2xlbiArPSAzICogKG1heF9ibGluZGV4ICsgMSkgKyA1ICsgNSArIDQ7XG4gIC8vVHJhY2V2KChzdGRlcnIsIFwiXFxuZHluIHRyZWVzOiBkeW4gJWxkLCBzdGF0ICVsZFwiLFxuICAvLyAgICAgICAgcy0+b3B0X2xlbiwgcy0+c3RhdGljX2xlbikpO1xuXG4gIHJldHVybiBtYXhfYmxpbmRleDtcbn07XG5cblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBTZW5kIHRoZSBoZWFkZXIgZm9yIGEgYmxvY2sgdXNpbmcgZHluYW1pYyBIdWZmbWFuIHRyZWVzOiB0aGUgY291bnRzLCB0aGVcbiAqIGxlbmd0aHMgb2YgdGhlIGJpdCBsZW5ndGggY29kZXMsIHRoZSBsaXRlcmFsIHRyZWUgYW5kIHRoZSBkaXN0YW5jZSB0cmVlLlxuICogSU4gYXNzZXJ0aW9uOiBsY29kZXMgPj0gMjU3LCBkY29kZXMgPj0gMSwgYmxjb2RlcyA+PSA0LlxuICovXG5jb25zdCBzZW5kX2FsbF90cmVlcyA9IChzLCBsY29kZXMsIGRjb2RlcywgYmxjb2RlcykgPT4ge1xuLy8gICAgZGVmbGF0ZV9zdGF0ZSAqcztcbi8vICAgIGludCBsY29kZXMsIGRjb2RlcywgYmxjb2RlczsgLyogbnVtYmVyIG9mIGNvZGVzIGZvciBlYWNoIHRyZWUgKi9cblxuICBsZXQgcmFuazsgICAgICAgICAgICAgICAgICAgIC8qIGluZGV4IGluIGJsX29yZGVyICovXG5cbiAgLy9Bc3NlcnQgKGxjb2RlcyA+PSAyNTcgJiYgZGNvZGVzID49IDEgJiYgYmxjb2RlcyA+PSA0LCBcIm5vdCBlbm91Z2ggY29kZXNcIik7XG4gIC8vQXNzZXJ0IChsY29kZXMgPD0gTF9DT0RFUyAmJiBkY29kZXMgPD0gRF9DT0RFUyAmJiBibGNvZGVzIDw9IEJMX0NPREVTLFxuICAvLyAgICAgICAgXCJ0b28gbWFueSBjb2Rlc1wiKTtcbiAgLy9UcmFjZXYoKHN0ZGVyciwgXCJcXG5ibCBjb3VudHM6IFwiKSk7XG4gIHNlbmRfYml0cyhzLCBsY29kZXMgLSAyNTcsIDUpOyAvKiBub3QgKzI1NSBhcyBzdGF0ZWQgaW4gYXBwbm90ZS50eHQgKi9cbiAgc2VuZF9iaXRzKHMsIGRjb2RlcyAtIDEsICAgNSk7XG4gIHNlbmRfYml0cyhzLCBibGNvZGVzIC0gNCwgIDQpOyAvKiBub3QgLTMgYXMgc3RhdGVkIGluIGFwcG5vdGUudHh0ICovXG4gIGZvciAocmFuayA9IDA7IHJhbmsgPCBibGNvZGVzOyByYW5rKyspIHtcbiAgICAvL1RyYWNldigoc3RkZXJyLCBcIlxcbmJsIGNvZGUgJTJkIFwiLCBibF9vcmRlcltyYW5rXSkpO1xuICAgIHNlbmRfYml0cyhzLCBzLmJsX3RyZWVbYmxfb3JkZXJbcmFua10gKiAyICsgMV0vKi5MZW4qLywgMyk7XG4gIH1cbiAgLy9UcmFjZXYoKHN0ZGVyciwgXCJcXG5ibCB0cmVlOiBzZW50ICVsZFwiLCBzLT5iaXRzX3NlbnQpKTtcblxuICBzZW5kX3RyZWUocywgcy5keW5fbHRyZWUsIGxjb2RlcyAtIDEpOyAvKiBsaXRlcmFsIHRyZWUgKi9cbiAgLy9UcmFjZXYoKHN0ZGVyciwgXCJcXG5saXQgdHJlZTogc2VudCAlbGRcIiwgcy0+Yml0c19zZW50KSk7XG5cbiAgc2VuZF90cmVlKHMsIHMuZHluX2R0cmVlLCBkY29kZXMgLSAxKTsgLyogZGlzdGFuY2UgdHJlZSAqL1xuICAvL1RyYWNldigoc3RkZXJyLCBcIlxcbmRpc3QgdHJlZTogc2VudCAlbGRcIiwgcy0+Yml0c19zZW50KSk7XG59O1xuXG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogQ2hlY2sgaWYgdGhlIGRhdGEgdHlwZSBpcyBURVhUIG9yIEJJTkFSWSwgdXNpbmcgdGhlIGZvbGxvd2luZyBhbGdvcml0aG06XG4gKiAtIFRFWFQgaWYgdGhlIHR3byBjb25kaXRpb25zIGJlbG93IGFyZSBzYXRpc2ZpZWQ6XG4gKiAgICBhKSBUaGVyZSBhcmUgbm8gbm9uLXBvcnRhYmxlIGNvbnRyb2wgY2hhcmFjdGVycyBiZWxvbmdpbmcgdG8gdGhlXG4gKiAgICAgICBcImJsb2NrIGxpc3RcIiAoMC4uNiwgMTQuLjI1LCAyOC4uMzEpLlxuICogICAgYikgVGhlcmUgaXMgYXQgbGVhc3Qgb25lIHByaW50YWJsZSBjaGFyYWN0ZXIgYmVsb25naW5nIHRvIHRoZVxuICogICAgICAgXCJhbGxvdyBsaXN0XCIgKDkge1RBQn0sIDEwIHtMRn0sIDEzIHtDUn0sIDMyLi4yNTUpLlxuICogLSBCSU5BUlkgb3RoZXJ3aXNlLlxuICogLSBUaGUgZm9sbG93aW5nIHBhcnRpYWxseS1wb3J0YWJsZSBjb250cm9sIGNoYXJhY3RlcnMgZm9ybSBhXG4gKiAgIFwiZ3JheSBsaXN0XCIgdGhhdCBpcyBpZ25vcmVkIGluIHRoaXMgZGV0ZWN0aW9uIGFsZ29yaXRobTpcbiAqICAgKDcge0JFTH0sIDgge0JTfSwgMTEge1ZUfSwgMTIge0ZGfSwgMjYge1NVQn0sIDI3IHtFU0N9KS5cbiAqIElOIGFzc2VydGlvbjogdGhlIGZpZWxkcyBGcmVxIG9mIGR5bl9sdHJlZSBhcmUgc2V0LlxuICovXG5jb25zdCBkZXRlY3RfZGF0YV90eXBlID0gKHMpID0+IHtcbiAgLyogYmxvY2tfbWFzayBpcyB0aGUgYml0IG1hc2sgb2YgYmxvY2stbGlzdGVkIGJ5dGVzXG4gICAqIHNldCBiaXRzIDAuLjYsIDE0Li4yNSwgYW5kIDI4Li4zMVxuICAgKiAweGYzZmZjMDdmID0gYmluYXJ5IDExMTEwMDExMTExMTExMTExMTAwMDAwMDAxMTExMTExXG4gICAqL1xuICBsZXQgYmxvY2tfbWFzayA9IDB4ZjNmZmMwN2Y7XG4gIGxldCBuO1xuXG4gIC8qIENoZWNrIGZvciBub24tdGV4dHVhbCAoXCJibG9jay1saXN0ZWRcIikgYnl0ZXMuICovXG4gIGZvciAobiA9IDA7IG4gPD0gMzE7IG4rKywgYmxvY2tfbWFzayA+Pj49IDEpIHtcbiAgICBpZiAoKGJsb2NrX21hc2sgJiAxKSAmJiAocy5keW5fbHRyZWVbbiAqIDJdLyouRnJlcSovICE9PSAwKSkge1xuICAgICAgcmV0dXJuIFpfQklOQVJZO1xuICAgIH1cbiAgfVxuXG4gIC8qIENoZWNrIGZvciB0ZXh0dWFsIChcImFsbG93LWxpc3RlZFwiKSBieXRlcy4gKi9cbiAgaWYgKHMuZHluX2x0cmVlWzkgKiAyXS8qLkZyZXEqLyAhPT0gMCB8fCBzLmR5bl9sdHJlZVsxMCAqIDJdLyouRnJlcSovICE9PSAwIHx8XG4gICAgICBzLmR5bl9sdHJlZVsxMyAqIDJdLyouRnJlcSovICE9PSAwKSB7XG4gICAgcmV0dXJuIFpfVEVYVDtcbiAgfVxuICBmb3IgKG4gPSAzMjsgbiA8IExJVEVSQUxTJDE7IG4rKykge1xuICAgIGlmIChzLmR5bl9sdHJlZVtuICogMl0vKi5GcmVxKi8gIT09IDApIHtcbiAgICAgIHJldHVybiBaX1RFWFQ7XG4gICAgfVxuICB9XG5cbiAgLyogVGhlcmUgYXJlIG5vIFwiYmxvY2stbGlzdGVkXCIgb3IgXCJhbGxvdy1saXN0ZWRcIiBieXRlczpcbiAgICogdGhpcyBzdHJlYW0gZWl0aGVyIGlzIGVtcHR5IG9yIGhhcyB0b2xlcmF0ZWQgKFwiZ3JheS1saXN0ZWRcIikgYnl0ZXMgb25seS5cbiAgICovXG4gIHJldHVybiBaX0JJTkFSWTtcbn07XG5cblxubGV0IHN0YXRpY19pbml0X2RvbmUgPSBmYWxzZTtcblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBJbml0aWFsaXplIHRoZSB0cmVlIGRhdGEgc3RydWN0dXJlcyBmb3IgYSBuZXcgemxpYiBzdHJlYW0uXG4gKi9cbmNvbnN0IF90cl9pbml0JDEgPSAocykgPT5cbntcblxuICBpZiAoIXN0YXRpY19pbml0X2RvbmUpIHtcbiAgICB0cl9zdGF0aWNfaW5pdCgpO1xuICAgIHN0YXRpY19pbml0X2RvbmUgPSB0cnVlO1xuICB9XG5cbiAgcy5sX2Rlc2MgID0gbmV3IFRyZWVEZXNjKHMuZHluX2x0cmVlLCBzdGF0aWNfbF9kZXNjKTtcbiAgcy5kX2Rlc2MgID0gbmV3IFRyZWVEZXNjKHMuZHluX2R0cmVlLCBzdGF0aWNfZF9kZXNjKTtcbiAgcy5ibF9kZXNjID0gbmV3IFRyZWVEZXNjKHMuYmxfdHJlZSwgc3RhdGljX2JsX2Rlc2MpO1xuXG4gIHMuYmlfYnVmID0gMDtcbiAgcy5iaV92YWxpZCA9IDA7XG5cbiAgLyogSW5pdGlhbGl6ZSB0aGUgZmlyc3QgYmxvY2sgb2YgdGhlIGZpcnN0IGZpbGU6ICovXG4gIGluaXRfYmxvY2socyk7XG59O1xuXG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogU2VuZCBhIHN0b3JlZCBibG9ja1xuICovXG5jb25zdCBfdHJfc3RvcmVkX2Jsb2NrJDEgPSAocywgYnVmLCBzdG9yZWRfbGVuLCBsYXN0KSA9PiB7XG4vL0RlZmxhdGVTdGF0ZSAqcztcbi8vY2hhcmYgKmJ1ZjsgICAgICAgLyogaW5wdXQgYmxvY2sgKi9cbi8vdWxnIHN0b3JlZF9sZW47ICAgLyogbGVuZ3RoIG9mIGlucHV0IGJsb2NrICovXG4vL2ludCBsYXN0OyAgICAgICAgIC8qIG9uZSBpZiB0aGlzIGlzIHRoZSBsYXN0IGJsb2NrIGZvciBhIGZpbGUgKi9cblxuICBzZW5kX2JpdHMocywgKFNUT1JFRF9CTE9DSyA8PCAxKSArIChsYXN0ID8gMSA6IDApLCAzKTsgICAgLyogc2VuZCBibG9jayB0eXBlICovXG4gIGJpX3dpbmR1cChzKTsgICAgICAgIC8qIGFsaWduIG9uIGJ5dGUgYm91bmRhcnkgKi9cbiAgcHV0X3Nob3J0KHMsIHN0b3JlZF9sZW4pO1xuICBwdXRfc2hvcnQocywgfnN0b3JlZF9sZW4pO1xuICBpZiAoc3RvcmVkX2xlbikge1xuICAgIHMucGVuZGluZ19idWYuc2V0KHMud2luZG93LnN1YmFycmF5KGJ1ZiwgYnVmICsgc3RvcmVkX2xlbiksIHMucGVuZGluZyk7XG4gIH1cbiAgcy5wZW5kaW5nICs9IHN0b3JlZF9sZW47XG59O1xuXG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogU2VuZCBvbmUgZW1wdHkgc3RhdGljIGJsb2NrIHRvIGdpdmUgZW5vdWdoIGxvb2thaGVhZCBmb3IgaW5mbGF0ZS5cbiAqIFRoaXMgdGFrZXMgMTAgYml0cywgb2Ygd2hpY2ggNyBtYXkgcmVtYWluIGluIHRoZSBiaXQgYnVmZmVyLlxuICovXG5jb25zdCBfdHJfYWxpZ24kMSA9IChzKSA9PiB7XG4gIHNlbmRfYml0cyhzLCBTVEFUSUNfVFJFRVMgPDwgMSwgMyk7XG4gIHNlbmRfY29kZShzLCBFTkRfQkxPQ0ssIHN0YXRpY19sdHJlZSk7XG4gIGJpX2ZsdXNoKHMpO1xufTtcblxuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIERldGVybWluZSB0aGUgYmVzdCBlbmNvZGluZyBmb3IgdGhlIGN1cnJlbnQgYmxvY2s6IGR5bmFtaWMgdHJlZXMsIHN0YXRpY1xuICogdHJlZXMgb3Igc3RvcmUsIGFuZCB3cml0ZSBvdXQgdGhlIGVuY29kZWQgYmxvY2suXG4gKi9cbmNvbnN0IF90cl9mbHVzaF9ibG9jayQxID0gKHMsIGJ1Ziwgc3RvcmVkX2xlbiwgbGFzdCkgPT4ge1xuLy9EZWZsYXRlU3RhdGUgKnM7XG4vL2NoYXJmICpidWY7ICAgICAgIC8qIGlucHV0IGJsb2NrLCBvciBOVUxMIGlmIHRvbyBvbGQgKi9cbi8vdWxnIHN0b3JlZF9sZW47ICAgLyogbGVuZ3RoIG9mIGlucHV0IGJsb2NrICovXG4vL2ludCBsYXN0OyAgICAgICAgIC8qIG9uZSBpZiB0aGlzIGlzIHRoZSBsYXN0IGJsb2NrIGZvciBhIGZpbGUgKi9cblxuICBsZXQgb3B0X2xlbmIsIHN0YXRpY19sZW5iOyAgLyogb3B0X2xlbiBhbmQgc3RhdGljX2xlbiBpbiBieXRlcyAqL1xuICBsZXQgbWF4X2JsaW5kZXggPSAwOyAgICAgICAgLyogaW5kZXggb2YgbGFzdCBiaXQgbGVuZ3RoIGNvZGUgb2Ygbm9uIHplcm8gZnJlcSAqL1xuXG4gIC8qIEJ1aWxkIHRoZSBIdWZmbWFuIHRyZWVzIHVubGVzcyBhIHN0b3JlZCBibG9jayBpcyBmb3JjZWQgKi9cbiAgaWYgKHMubGV2ZWwgPiAwKSB7XG5cbiAgICAvKiBDaGVjayBpZiB0aGUgZmlsZSBpcyBiaW5hcnkgb3IgdGV4dCAqL1xuICAgIGlmIChzLnN0cm0uZGF0YV90eXBlID09PSBaX1VOS05PV04kMSkge1xuICAgICAgcy5zdHJtLmRhdGFfdHlwZSA9IGRldGVjdF9kYXRhX3R5cGUocyk7XG4gICAgfVxuXG4gICAgLyogQ29uc3RydWN0IHRoZSBsaXRlcmFsIGFuZCBkaXN0YW5jZSB0cmVlcyAqL1xuICAgIGJ1aWxkX3RyZWUocywgcy5sX2Rlc2MpO1xuICAgIC8vIFRyYWNldigoc3RkZXJyLCBcIlxcbmxpdCBkYXRhOiBkeW4gJWxkLCBzdGF0ICVsZFwiLCBzLT5vcHRfbGVuLFxuICAgIC8vICAgICAgICBzLT5zdGF0aWNfbGVuKSk7XG5cbiAgICBidWlsZF90cmVlKHMsIHMuZF9kZXNjKTtcbiAgICAvLyBUcmFjZXYoKHN0ZGVyciwgXCJcXG5kaXN0IGRhdGE6IGR5biAlbGQsIHN0YXQgJWxkXCIsIHMtPm9wdF9sZW4sXG4gICAgLy8gICAgICAgIHMtPnN0YXRpY19sZW4pKTtcbiAgICAvKiBBdCB0aGlzIHBvaW50LCBvcHRfbGVuIGFuZCBzdGF0aWNfbGVuIGFyZSB0aGUgdG90YWwgYml0IGxlbmd0aHMgb2ZcbiAgICAgKiB0aGUgY29tcHJlc3NlZCBibG9jayBkYXRhLCBleGNsdWRpbmcgdGhlIHRyZWUgcmVwcmVzZW50YXRpb25zLlxuICAgICAqL1xuXG4gICAgLyogQnVpbGQgdGhlIGJpdCBsZW5ndGggdHJlZSBmb3IgdGhlIGFib3ZlIHR3byB0cmVlcywgYW5kIGdldCB0aGUgaW5kZXhcbiAgICAgKiBpbiBibF9vcmRlciBvZiB0aGUgbGFzdCBiaXQgbGVuZ3RoIGNvZGUgdG8gc2VuZC5cbiAgICAgKi9cbiAgICBtYXhfYmxpbmRleCA9IGJ1aWxkX2JsX3RyZWUocyk7XG5cbiAgICAvKiBEZXRlcm1pbmUgdGhlIGJlc3QgZW5jb2RpbmcuIENvbXB1dGUgdGhlIGJsb2NrIGxlbmd0aHMgaW4gYnl0ZXMuICovXG4gICAgb3B0X2xlbmIgPSAocy5vcHRfbGVuICsgMyArIDcpID4+PiAzO1xuICAgIHN0YXRpY19sZW5iID0gKHMuc3RhdGljX2xlbiArIDMgKyA3KSA+Pj4gMztcblxuICAgIC8vIFRyYWNldigoc3RkZXJyLCBcIlxcbm9wdCAlbHUoJWx1KSBzdGF0ICVsdSglbHUpIHN0b3JlZCAlbHUgbGl0ICV1IFwiLFxuICAgIC8vICAgICAgICBvcHRfbGVuYiwgcy0+b3B0X2xlbiwgc3RhdGljX2xlbmIsIHMtPnN0YXRpY19sZW4sIHN0b3JlZF9sZW4sXG4gICAgLy8gICAgICAgIHMtPnN5bV9uZXh0IC8gMykpO1xuXG4gICAgaWYgKHN0YXRpY19sZW5iIDw9IG9wdF9sZW5iKSB7IG9wdF9sZW5iID0gc3RhdGljX2xlbmI7IH1cblxuICB9IGVsc2Uge1xuICAgIC8vIEFzc2VydChidWYgIT0gKGNoYXIqKTAsIFwibG9zdCBidWZcIik7XG4gICAgb3B0X2xlbmIgPSBzdGF0aWNfbGVuYiA9IHN0b3JlZF9sZW4gKyA1OyAvKiBmb3JjZSBhIHN0b3JlZCBibG9jayAqL1xuICB9XG5cbiAgaWYgKChzdG9yZWRfbGVuICsgNCA8PSBvcHRfbGVuYikgJiYgKGJ1ZiAhPT0gLTEpKSB7XG4gICAgLyogNDogdHdvIHdvcmRzIGZvciB0aGUgbGVuZ3RocyAqL1xuXG4gICAgLyogVGhlIHRlc3QgYnVmICE9IE5VTEwgaXMgb25seSBuZWNlc3NhcnkgaWYgTElUX0JVRlNJWkUgPiBXU0laRS5cbiAgICAgKiBPdGhlcndpc2Ugd2UgY2FuJ3QgaGF2ZSBwcm9jZXNzZWQgbW9yZSB0aGFuIFdTSVpFIGlucHV0IGJ5dGVzIHNpbmNlXG4gICAgICogdGhlIGxhc3QgYmxvY2sgZmx1c2gsIGJlY2F1c2UgY29tcHJlc3Npb24gd291bGQgaGF2ZSBiZWVuXG4gICAgICogc3VjY2Vzc2Z1bC4gSWYgTElUX0JVRlNJWkUgPD0gV1NJWkUsIGl0IGlzIG5ldmVyIHRvbyBsYXRlIHRvXG4gICAgICogdHJhbnNmb3JtIGEgYmxvY2sgaW50byBhIHN0b3JlZCBibG9jay5cbiAgICAgKi9cbiAgICBfdHJfc3RvcmVkX2Jsb2NrJDEocywgYnVmLCBzdG9yZWRfbGVuLCBsYXN0KTtcblxuICB9IGVsc2UgaWYgKHMuc3RyYXRlZ3kgPT09IFpfRklYRUQkMSB8fCBzdGF0aWNfbGVuYiA9PT0gb3B0X2xlbmIpIHtcblxuICAgIHNlbmRfYml0cyhzLCAoU1RBVElDX1RSRUVTIDw8IDEpICsgKGxhc3QgPyAxIDogMCksIDMpO1xuICAgIGNvbXByZXNzX2Jsb2NrKHMsIHN0YXRpY19sdHJlZSwgc3RhdGljX2R0cmVlKTtcblxuICB9IGVsc2Uge1xuICAgIHNlbmRfYml0cyhzLCAoRFlOX1RSRUVTIDw8IDEpICsgKGxhc3QgPyAxIDogMCksIDMpO1xuICAgIHNlbmRfYWxsX3RyZWVzKHMsIHMubF9kZXNjLm1heF9jb2RlICsgMSwgcy5kX2Rlc2MubWF4X2NvZGUgKyAxLCBtYXhfYmxpbmRleCArIDEpO1xuICAgIGNvbXByZXNzX2Jsb2NrKHMsIHMuZHluX2x0cmVlLCBzLmR5bl9kdHJlZSk7XG4gIH1cbiAgLy8gQXNzZXJ0IChzLT5jb21wcmVzc2VkX2xlbiA9PSBzLT5iaXRzX3NlbnQsIFwiYmFkIGNvbXByZXNzZWQgc2l6ZVwiKTtcbiAgLyogVGhlIGFib3ZlIGNoZWNrIGlzIG1hZGUgbW9kIDJeMzIsIGZvciBmaWxlcyBsYXJnZXIgdGhhbiA1MTIgTUJcbiAgICogYW5kIHVMb25nIGltcGxlbWVudGVkIG9uIDMyIGJpdHMuXG4gICAqL1xuICBpbml0X2Jsb2NrKHMpO1xuXG4gIGlmIChsYXN0KSB7XG4gICAgYmlfd2luZHVwKHMpO1xuICB9XG4gIC8vIFRyYWNldigoc3RkZXJyLFwiXFxuY29tcHJsZW4gJWx1KCVsdSkgXCIsIHMtPmNvbXByZXNzZWRfbGVuPj4zLFxuICAvLyAgICAgICBzLT5jb21wcmVzc2VkX2xlbi03Kmxhc3QpKTtcbn07XG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogU2F2ZSB0aGUgbWF0Y2ggaW5mbyBhbmQgdGFsbHkgdGhlIGZyZXF1ZW5jeSBjb3VudHMuIFJldHVybiB0cnVlIGlmXG4gKiB0aGUgY3VycmVudCBibG9jayBtdXN0IGJlIGZsdXNoZWQuXG4gKi9cbmNvbnN0IF90cl90YWxseSQxID0gKHMsIGRpc3QsIGxjKSA9PiB7XG4vLyAgICBkZWZsYXRlX3N0YXRlICpzO1xuLy8gICAgdW5zaWduZWQgZGlzdDsgIC8qIGRpc3RhbmNlIG9mIG1hdGNoZWQgc3RyaW5nICovXG4vLyAgICB1bnNpZ25lZCBsYzsgICAgLyogbWF0Y2ggbGVuZ3RoLU1JTl9NQVRDSCBvciB1bm1hdGNoZWQgY2hhciAoaWYgZGlzdD09MCkgKi9cblxuICBzLnBlbmRpbmdfYnVmW3Muc3ltX2J1ZiArIHMuc3ltX25leHQrK10gPSBkaXN0O1xuICBzLnBlbmRpbmdfYnVmW3Muc3ltX2J1ZiArIHMuc3ltX25leHQrK10gPSBkaXN0ID4+IDg7XG4gIHMucGVuZGluZ19idWZbcy5zeW1fYnVmICsgcy5zeW1fbmV4dCsrXSA9IGxjO1xuICBpZiAoZGlzdCA9PT0gMCkge1xuICAgIC8qIGxjIGlzIHRoZSB1bm1hdGNoZWQgY2hhciAqL1xuICAgIHMuZHluX2x0cmVlW2xjICogMl0vKi5GcmVxKi8rKztcbiAgfSBlbHNlIHtcbiAgICBzLm1hdGNoZXMrKztcbiAgICAvKiBIZXJlLCBsYyBpcyB0aGUgbWF0Y2ggbGVuZ3RoIC0gTUlOX01BVENIICovXG4gICAgZGlzdC0tOyAgICAgICAgICAgICAvKiBkaXN0ID0gbWF0Y2ggZGlzdGFuY2UgLSAxICovXG4gICAgLy9Bc3NlcnQoKHVzaClkaXN0IDwgKHVzaClNQVhfRElTVChzKSAmJlxuICAgIC8vICAgICAgICh1c2gpbGMgPD0gKHVzaCkoTUFYX01BVENILU1JTl9NQVRDSCkgJiZcbiAgICAvLyAgICAgICAodXNoKWRfY29kZShkaXN0KSA8ICh1c2gpRF9DT0RFUywgIFwiX3RyX3RhbGx5OiBiYWQgbWF0Y2hcIik7XG5cbiAgICBzLmR5bl9sdHJlZVsoX2xlbmd0aF9jb2RlW2xjXSArIExJVEVSQUxTJDEgKyAxKSAqIDJdLyouRnJlcSovKys7XG4gICAgcy5keW5fZHRyZWVbZF9jb2RlKGRpc3QpICogMl0vKi5GcmVxKi8rKztcbiAgfVxuXG4gIHJldHVybiAocy5zeW1fbmV4dCA9PT0gcy5zeW1fZW5kKTtcbn07XG5cbnZhciBfdHJfaW5pdF8xICA9IF90cl9pbml0JDE7XG52YXIgX3RyX3N0b3JlZF9ibG9ja18xID0gX3RyX3N0b3JlZF9ibG9jayQxO1xudmFyIF90cl9mbHVzaF9ibG9ja18xICA9IF90cl9mbHVzaF9ibG9jayQxO1xudmFyIF90cl90YWxseV8xID0gX3RyX3RhbGx5JDE7XG52YXIgX3RyX2FsaWduXzEgPSBfdHJfYWxpZ24kMTtcblxudmFyIHRyZWVzID0ge1xuXHRfdHJfaW5pdDogX3RyX2luaXRfMSxcblx0X3RyX3N0b3JlZF9ibG9jazogX3RyX3N0b3JlZF9ibG9ja18xLFxuXHRfdHJfZmx1c2hfYmxvY2s6IF90cl9mbHVzaF9ibG9ja18xLFxuXHRfdHJfdGFsbHk6IF90cl90YWxseV8xLFxuXHRfdHJfYWxpZ246IF90cl9hbGlnbl8xXG59O1xuXG4vLyBOb3RlOiBhZGxlcjMyIHRha2VzIDEyJSBmb3IgbGV2ZWwgMCBhbmQgMiUgZm9yIGxldmVsIDYuXG4vLyBJdCBpc24ndCB3b3J0aCBpdCB0byBtYWtlIGFkZGl0aW9uYWwgb3B0aW1pemF0aW9ucyBhcyBpbiBvcmlnaW5hbC5cbi8vIFNtYWxsIHNpemUgaXMgcHJlZmVyYWJsZS5cblxuLy8gKEMpIDE5OTUtMjAxMyBKZWFuLWxvdXAgR2FpbGx5IGFuZCBNYXJrIEFkbGVyXG4vLyAoQykgMjAxNC0yMDE3IFZpdGFseSBQdXpyaW4gYW5kIEFuZHJleSBUdXBpdHNpblxuLy9cbi8vIFRoaXMgc29mdHdhcmUgaXMgcHJvdmlkZWQgJ2FzLWlzJywgd2l0aG91dCBhbnkgZXhwcmVzcyBvciBpbXBsaWVkXG4vLyB3YXJyYW50eS4gSW4gbm8gZXZlbnQgd2lsbCB0aGUgYXV0aG9ycyBiZSBoZWxkIGxpYWJsZSBmb3IgYW55IGRhbWFnZXNcbi8vIGFyaXNpbmcgZnJvbSB0aGUgdXNlIG9mIHRoaXMgc29mdHdhcmUuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBncmFudGVkIHRvIGFueW9uZSB0byB1c2UgdGhpcyBzb2Z0d2FyZSBmb3IgYW55IHB1cnBvc2UsXG4vLyBpbmNsdWRpbmcgY29tbWVyY2lhbCBhcHBsaWNhdGlvbnMsIGFuZCB0byBhbHRlciBpdCBhbmQgcmVkaXN0cmlidXRlIGl0XG4vLyBmcmVlbHksIHN1YmplY3QgdG8gdGhlIGZvbGxvd2luZyByZXN0cmljdGlvbnM6XG4vL1xuLy8gMS4gVGhlIG9yaWdpbiBvZiB0aGlzIHNvZnR3YXJlIG11c3Qgbm90IGJlIG1pc3JlcHJlc2VudGVkOyB5b3UgbXVzdCBub3Rcbi8vICAgY2xhaW0gdGhhdCB5b3Ugd3JvdGUgdGhlIG9yaWdpbmFsIHNvZnR3YXJlLiBJZiB5b3UgdXNlIHRoaXMgc29mdHdhcmVcbi8vICAgaW4gYSBwcm9kdWN0LCBhbiBhY2tub3dsZWRnbWVudCBpbiB0aGUgcHJvZHVjdCBkb2N1bWVudGF0aW9uIHdvdWxkIGJlXG4vLyAgIGFwcHJlY2lhdGVkIGJ1dCBpcyBub3QgcmVxdWlyZWQuXG4vLyAyLiBBbHRlcmVkIHNvdXJjZSB2ZXJzaW9ucyBtdXN0IGJlIHBsYWlubHkgbWFya2VkIGFzIHN1Y2gsIGFuZCBtdXN0IG5vdCBiZVxuLy8gICBtaXNyZXByZXNlbnRlZCBhcyBiZWluZyB0aGUgb3JpZ2luYWwgc29mdHdhcmUuXG4vLyAzLiBUaGlzIG5vdGljZSBtYXkgbm90IGJlIHJlbW92ZWQgb3IgYWx0ZXJlZCBmcm9tIGFueSBzb3VyY2UgZGlzdHJpYnV0aW9uLlxuXG5jb25zdCBhZGxlcjMyID0gKGFkbGVyLCBidWYsIGxlbiwgcG9zKSA9PiB7XG4gIGxldCBzMSA9IChhZGxlciAmIDB4ZmZmZikgfDAsXG4gICAgICBzMiA9ICgoYWRsZXIgPj4+IDE2KSAmIDB4ZmZmZikgfDAsXG4gICAgICBuID0gMDtcblxuICB3aGlsZSAobGVuICE9PSAwKSB7XG4gICAgLy8gU2V0IGxpbWl0IH4gdHdpY2UgbGVzcyB0aGFuIDU1NTIsIHRvIGtlZXBcbiAgICAvLyBzMiBpbiAzMS1iaXRzLCBiZWNhdXNlIHdlIGZvcmNlIHNpZ25lZCBpbnRzLlxuICAgIC8vIGluIG90aGVyIGNhc2UgJT0gd2lsbCBmYWlsLlxuICAgIG4gPSBsZW4gPiAyMDAwID8gMjAwMCA6IGxlbjtcbiAgICBsZW4gLT0gbjtcblxuICAgIGRvIHtcbiAgICAgIHMxID0gKHMxICsgYnVmW3BvcysrXSkgfDA7XG4gICAgICBzMiA9IChzMiArIHMxKSB8MDtcbiAgICB9IHdoaWxlICgtLW4pO1xuXG4gICAgczEgJT0gNjU1MjE7XG4gICAgczIgJT0gNjU1MjE7XG4gIH1cblxuICByZXR1cm4gKHMxIHwgKHMyIDw8IDE2KSkgfDA7XG59O1xuXG5cbnZhciBhZGxlcjMyXzEgPSBhZGxlcjMyO1xuXG4vLyBOb3RlOiB3ZSBjYW4ndCBnZXQgc2lnbmlmaWNhbnQgc3BlZWQgYm9vc3QgaGVyZS5cbi8vIFNvIHdyaXRlIGNvZGUgdG8gbWluaW1pemUgc2l6ZSAtIG5vIHByZWdlbmVyYXRlZCB0YWJsZXNcbi8vIGFuZCBhcnJheSB0b29scyBkZXBlbmRlbmNpZXMuXG5cbi8vIChDKSAxOTk1LTIwMTMgSmVhbi1sb3VwIEdhaWxseSBhbmQgTWFyayBBZGxlclxuLy8gKEMpIDIwMTQtMjAxNyBWaXRhbHkgUHV6cmluIGFuZCBBbmRyZXkgVHVwaXRzaW5cbi8vXG4vLyBUaGlzIHNvZnR3YXJlIGlzIHByb3ZpZGVkICdhcy1pcycsIHdpdGhvdXQgYW55IGV4cHJlc3Mgb3IgaW1wbGllZFxuLy8gd2FycmFudHkuIEluIG5vIGV2ZW50IHdpbGwgdGhlIGF1dGhvcnMgYmUgaGVsZCBsaWFibGUgZm9yIGFueSBkYW1hZ2VzXG4vLyBhcmlzaW5nIGZyb20gdGhlIHVzZSBvZiB0aGlzIHNvZnR3YXJlLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgZ3JhbnRlZCB0byBhbnlvbmUgdG8gdXNlIHRoaXMgc29mdHdhcmUgZm9yIGFueSBwdXJwb3NlLFxuLy8gaW5jbHVkaW5nIGNvbW1lcmNpYWwgYXBwbGljYXRpb25zLCBhbmQgdG8gYWx0ZXIgaXQgYW5kIHJlZGlzdHJpYnV0ZSBpdFxuLy8gZnJlZWx5LCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgcmVzdHJpY3Rpb25zOlxuLy9cbi8vIDEuIFRoZSBvcmlnaW4gb2YgdGhpcyBzb2Z0d2FyZSBtdXN0IG5vdCBiZSBtaXNyZXByZXNlbnRlZDsgeW91IG11c3Qgbm90XG4vLyAgIGNsYWltIHRoYXQgeW91IHdyb3RlIHRoZSBvcmlnaW5hbCBzb2Z0d2FyZS4gSWYgeW91IHVzZSB0aGlzIHNvZnR3YXJlXG4vLyAgIGluIGEgcHJvZHVjdCwgYW4gYWNrbm93bGVkZ21lbnQgaW4gdGhlIHByb2R1Y3QgZG9jdW1lbnRhdGlvbiB3b3VsZCBiZVxuLy8gICBhcHByZWNpYXRlZCBidXQgaXMgbm90IHJlcXVpcmVkLlxuLy8gMi4gQWx0ZXJlZCBzb3VyY2UgdmVyc2lvbnMgbXVzdCBiZSBwbGFpbmx5IG1hcmtlZCBhcyBzdWNoLCBhbmQgbXVzdCBub3QgYmVcbi8vICAgbWlzcmVwcmVzZW50ZWQgYXMgYmVpbmcgdGhlIG9yaWdpbmFsIHNvZnR3YXJlLlxuLy8gMy4gVGhpcyBub3RpY2UgbWF5IG5vdCBiZSByZW1vdmVkIG9yIGFsdGVyZWQgZnJvbSBhbnkgc291cmNlIGRpc3RyaWJ1dGlvbi5cblxuLy8gVXNlIG9yZGluYXJ5IGFycmF5LCBzaW5jZSB1bnR5cGVkIG1ha2VzIG5vIGJvb3N0IGhlcmVcbmNvbnN0IG1ha2VUYWJsZSA9ICgpID0+IHtcbiAgbGV0IGMsIHRhYmxlID0gW107XG5cbiAgZm9yICh2YXIgbiA9IDA7IG4gPCAyNTY7IG4rKykge1xuICAgIGMgPSBuO1xuICAgIGZvciAodmFyIGsgPSAwOyBrIDwgODsgaysrKSB7XG4gICAgICBjID0gKChjICYgMSkgPyAoMHhFREI4ODMyMCBeIChjID4+PiAxKSkgOiAoYyA+Pj4gMSkpO1xuICAgIH1cbiAgICB0YWJsZVtuXSA9IGM7XG4gIH1cblxuICByZXR1cm4gdGFibGU7XG59O1xuXG4vLyBDcmVhdGUgdGFibGUgb24gbG9hZC4gSnVzdCAyNTUgc2lnbmVkIGxvbmdzLiBOb3QgYSBwcm9ibGVtLlxuY29uc3QgY3JjVGFibGUgPSBuZXcgVWludDMyQXJyYXkobWFrZVRhYmxlKCkpO1xuXG5cbmNvbnN0IGNyYzMyID0gKGNyYywgYnVmLCBsZW4sIHBvcykgPT4ge1xuICBjb25zdCB0ID0gY3JjVGFibGU7XG4gIGNvbnN0IGVuZCA9IHBvcyArIGxlbjtcblxuICBjcmMgXj0gLTE7XG5cbiAgZm9yIChsZXQgaSA9IHBvczsgaSA8IGVuZDsgaSsrKSB7XG4gICAgY3JjID0gKGNyYyA+Pj4gOCkgXiB0WyhjcmMgXiBidWZbaV0pICYgMHhGRl07XG4gIH1cblxuICByZXR1cm4gKGNyYyBeICgtMSkpOyAvLyA+Pj4gMDtcbn07XG5cblxudmFyIGNyYzMyXzEgPSBjcmMzMjtcblxuLy8gKEMpIDE5OTUtMjAxMyBKZWFuLWxvdXAgR2FpbGx5IGFuZCBNYXJrIEFkbGVyXG4vLyAoQykgMjAxNC0yMDE3IFZpdGFseSBQdXpyaW4gYW5kIEFuZHJleSBUdXBpdHNpblxuLy9cbi8vIFRoaXMgc29mdHdhcmUgaXMgcHJvdmlkZWQgJ2FzLWlzJywgd2l0aG91dCBhbnkgZXhwcmVzcyBvciBpbXBsaWVkXG4vLyB3YXJyYW50eS4gSW4gbm8gZXZlbnQgd2lsbCB0aGUgYXV0aG9ycyBiZSBoZWxkIGxpYWJsZSBmb3IgYW55IGRhbWFnZXNcbi8vIGFyaXNpbmcgZnJvbSB0aGUgdXNlIG9mIHRoaXMgc29mdHdhcmUuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBncmFudGVkIHRvIGFueW9uZSB0byB1c2UgdGhpcyBzb2Z0d2FyZSBmb3IgYW55IHB1cnBvc2UsXG4vLyBpbmNsdWRpbmcgY29tbWVyY2lhbCBhcHBsaWNhdGlvbnMsIGFuZCB0byBhbHRlciBpdCBhbmQgcmVkaXN0cmlidXRlIGl0XG4vLyBmcmVlbHksIHN1YmplY3QgdG8gdGhlIGZvbGxvd2luZyByZXN0cmljdGlvbnM6XG4vL1xuLy8gMS4gVGhlIG9yaWdpbiBvZiB0aGlzIHNvZnR3YXJlIG11c3Qgbm90IGJlIG1pc3JlcHJlc2VudGVkOyB5b3UgbXVzdCBub3Rcbi8vICAgY2xhaW0gdGhhdCB5b3Ugd3JvdGUgdGhlIG9yaWdpbmFsIHNvZnR3YXJlLiBJZiB5b3UgdXNlIHRoaXMgc29mdHdhcmVcbi8vICAgaW4gYSBwcm9kdWN0LCBhbiBhY2tub3dsZWRnbWVudCBpbiB0aGUgcHJvZHVjdCBkb2N1bWVudGF0aW9uIHdvdWxkIGJlXG4vLyAgIGFwcHJlY2lhdGVkIGJ1dCBpcyBub3QgcmVxdWlyZWQuXG4vLyAyLiBBbHRlcmVkIHNvdXJjZSB2ZXJzaW9ucyBtdXN0IGJlIHBsYWlubHkgbWFya2VkIGFzIHN1Y2gsIGFuZCBtdXN0IG5vdCBiZVxuLy8gICBtaXNyZXByZXNlbnRlZCBhcyBiZWluZyB0aGUgb3JpZ2luYWwgc29mdHdhcmUuXG4vLyAzLiBUaGlzIG5vdGljZSBtYXkgbm90IGJlIHJlbW92ZWQgb3IgYWx0ZXJlZCBmcm9tIGFueSBzb3VyY2UgZGlzdHJpYnV0aW9uLlxuXG52YXIgbWVzc2FnZXMgPSB7XG4gIDI6ICAgICAgJ25lZWQgZGljdGlvbmFyeScsICAgICAvKiBaX05FRURfRElDVCAgICAgICAyICAqL1xuICAxOiAgICAgICdzdHJlYW0gZW5kJywgICAgICAgICAgLyogWl9TVFJFQU1fRU5EICAgICAgMSAgKi9cbiAgMDogICAgICAnJywgICAgICAgICAgICAgICAgICAgIC8qIFpfT0sgICAgICAgICAgICAgIDAgICovXG4gICctMSc6ICAgJ2ZpbGUgZXJyb3InLCAgICAgICAgICAvKiBaX0VSUk5PICAgICAgICAgKC0xKSAqL1xuICAnLTInOiAgICdzdHJlYW0gZXJyb3InLCAgICAgICAgLyogWl9TVFJFQU1fRVJST1IgICgtMikgKi9cbiAgJy0zJzogICAnZGF0YSBlcnJvcicsICAgICAgICAgIC8qIFpfREFUQV9FUlJPUiAgICAoLTMpICovXG4gICctNCc6ICAgJ2luc3VmZmljaWVudCBtZW1vcnknLCAvKiBaX01FTV9FUlJPUiAgICAgKC00KSAqL1xuICAnLTUnOiAgICdidWZmZXIgZXJyb3InLCAgICAgICAgLyogWl9CVUZfRVJST1IgICAgICgtNSkgKi9cbiAgJy02JzogICAnaW5jb21wYXRpYmxlIHZlcnNpb24nIC8qIFpfVkVSU0lPTl9FUlJPUiAoLTYpICovXG59O1xuXG4vLyAoQykgMTk5NS0yMDEzIEplYW4tbG91cCBHYWlsbHkgYW5kIE1hcmsgQWRsZXJcbi8vIChDKSAyMDE0LTIwMTcgVml0YWx5IFB1enJpbiBhbmQgQW5kcmV5IFR1cGl0c2luXG4vL1xuLy8gVGhpcyBzb2Z0d2FyZSBpcyBwcm92aWRlZCAnYXMtaXMnLCB3aXRob3V0IGFueSBleHByZXNzIG9yIGltcGxpZWRcbi8vIHdhcnJhbnR5LiBJbiBubyBldmVudCB3aWxsIHRoZSBhdXRob3JzIGJlIGhlbGQgbGlhYmxlIGZvciBhbnkgZGFtYWdlc1xuLy8gYXJpc2luZyBmcm9tIHRoZSB1c2Ugb2YgdGhpcyBzb2Z0d2FyZS5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGdyYW50ZWQgdG8gYW55b25lIHRvIHVzZSB0aGlzIHNvZnR3YXJlIGZvciBhbnkgcHVycG9zZSxcbi8vIGluY2x1ZGluZyBjb21tZXJjaWFsIGFwcGxpY2F0aW9ucywgYW5kIHRvIGFsdGVyIGl0IGFuZCByZWRpc3RyaWJ1dGUgaXRcbi8vIGZyZWVseSwgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nIHJlc3RyaWN0aW9uczpcbi8vXG4vLyAxLiBUaGUgb3JpZ2luIG9mIHRoaXMgc29mdHdhcmUgbXVzdCBub3QgYmUgbWlzcmVwcmVzZW50ZWQ7IHlvdSBtdXN0IG5vdFxuLy8gICBjbGFpbSB0aGF0IHlvdSB3cm90ZSB0aGUgb3JpZ2luYWwgc29mdHdhcmUuIElmIHlvdSB1c2UgdGhpcyBzb2Z0d2FyZVxuLy8gICBpbiBhIHByb2R1Y3QsIGFuIGFja25vd2xlZGdtZW50IGluIHRoZSBwcm9kdWN0IGRvY3VtZW50YXRpb24gd291bGQgYmVcbi8vICAgYXBwcmVjaWF0ZWQgYnV0IGlzIG5vdCByZXF1aXJlZC5cbi8vIDIuIEFsdGVyZWQgc291cmNlIHZlcnNpb25zIG11c3QgYmUgcGxhaW5seSBtYXJrZWQgYXMgc3VjaCwgYW5kIG11c3Qgbm90IGJlXG4vLyAgIG1pc3JlcHJlc2VudGVkIGFzIGJlaW5nIHRoZSBvcmlnaW5hbCBzb2Z0d2FyZS5cbi8vIDMuIFRoaXMgbm90aWNlIG1heSBub3QgYmUgcmVtb3ZlZCBvciBhbHRlcmVkIGZyb20gYW55IHNvdXJjZSBkaXN0cmlidXRpb24uXG5cbnZhciBjb25zdGFudHMkMiA9IHtcblxuICAvKiBBbGxvd2VkIGZsdXNoIHZhbHVlczsgc2VlIGRlZmxhdGUoKSBhbmQgaW5mbGF0ZSgpIGJlbG93IGZvciBkZXRhaWxzICovXG4gIFpfTk9fRkxVU0g6ICAgICAgICAgMCxcbiAgWl9QQVJUSUFMX0ZMVVNIOiAgICAxLFxuICBaX1NZTkNfRkxVU0g6ICAgICAgIDIsXG4gIFpfRlVMTF9GTFVTSDogICAgICAgMyxcbiAgWl9GSU5JU0g6ICAgICAgICAgICA0LFxuICBaX0JMT0NLOiAgICAgICAgICAgIDUsXG4gIFpfVFJFRVM6ICAgICAgICAgICAgNixcblxuICAvKiBSZXR1cm4gY29kZXMgZm9yIHRoZSBjb21wcmVzc2lvbi9kZWNvbXByZXNzaW9uIGZ1bmN0aW9ucy4gTmVnYXRpdmUgdmFsdWVzXG4gICogYXJlIGVycm9ycywgcG9zaXRpdmUgdmFsdWVzIGFyZSB1c2VkIGZvciBzcGVjaWFsIGJ1dCBub3JtYWwgZXZlbnRzLlxuICAqL1xuICBaX09LOiAgICAgICAgICAgICAgIDAsXG4gIFpfU1RSRUFNX0VORDogICAgICAgMSxcbiAgWl9ORUVEX0RJQ1Q6ICAgICAgICAyLFxuICBaX0VSUk5POiAgICAgICAgICAgLTEsXG4gIFpfU1RSRUFNX0VSUk9SOiAgICAtMixcbiAgWl9EQVRBX0VSUk9SOiAgICAgIC0zLFxuICBaX01FTV9FUlJPUjogICAgICAgLTQsXG4gIFpfQlVGX0VSUk9SOiAgICAgICAtNSxcbiAgLy9aX1ZFUlNJT05fRVJST1I6IC02LFxuXG4gIC8qIGNvbXByZXNzaW9uIGxldmVscyAqL1xuICBaX05PX0NPTVBSRVNTSU9OOiAgICAgICAgIDAsXG4gIFpfQkVTVF9TUEVFRDogICAgICAgICAgICAgMSxcbiAgWl9CRVNUX0NPTVBSRVNTSU9OOiAgICAgICA5LFxuICBaX0RFRkFVTFRfQ09NUFJFU1NJT046ICAgLTEsXG5cblxuICBaX0ZJTFRFUkVEOiAgICAgICAgICAgICAgIDEsXG4gIFpfSFVGRk1BTl9PTkxZOiAgICAgICAgICAgMixcbiAgWl9STEU6ICAgICAgICAgICAgICAgICAgICAzLFxuICBaX0ZJWEVEOiAgICAgICAgICAgICAgICAgIDQsXG4gIFpfREVGQVVMVF9TVFJBVEVHWTogICAgICAgMCxcblxuICAvKiBQb3NzaWJsZSB2YWx1ZXMgb2YgdGhlIGRhdGFfdHlwZSBmaWVsZCAodGhvdWdoIHNlZSBpbmZsYXRlKCkpICovXG4gIFpfQklOQVJZOiAgICAgICAgICAgICAgICAgMCxcbiAgWl9URVhUOiAgICAgICAgICAgICAgICAgICAxLFxuICAvL1pfQVNDSUk6ICAgICAgICAgICAgICAgIDEsIC8vID0gWl9URVhUIChkZXByZWNhdGVkKVxuICBaX1VOS05PV046ICAgICAgICAgICAgICAgIDIsXG5cbiAgLyogVGhlIGRlZmxhdGUgY29tcHJlc3Npb24gbWV0aG9kICovXG4gIFpfREVGTEFURUQ6ICAgICAgICAgICAgICAgOFxuICAvL1pfTlVMTDogICAgICAgICAgICAgICAgIG51bGwgLy8gVXNlIC0xIG9yIG51bGwgaW5saW5lLCBkZXBlbmRpbmcgb24gdmFyIHR5cGVcbn07XG5cbi8vIChDKSAxOTk1LTIwMTMgSmVhbi1sb3VwIEdhaWxseSBhbmQgTWFyayBBZGxlclxuLy8gKEMpIDIwMTQtMjAxNyBWaXRhbHkgUHV6cmluIGFuZCBBbmRyZXkgVHVwaXRzaW5cbi8vXG4vLyBUaGlzIHNvZnR3YXJlIGlzIHByb3ZpZGVkICdhcy1pcycsIHdpdGhvdXQgYW55IGV4cHJlc3Mgb3IgaW1wbGllZFxuLy8gd2FycmFudHkuIEluIG5vIGV2ZW50IHdpbGwgdGhlIGF1dGhvcnMgYmUgaGVsZCBsaWFibGUgZm9yIGFueSBkYW1hZ2VzXG4vLyBhcmlzaW5nIGZyb20gdGhlIHVzZSBvZiB0aGlzIHNvZnR3YXJlLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgZ3JhbnRlZCB0byBhbnlvbmUgdG8gdXNlIHRoaXMgc29mdHdhcmUgZm9yIGFueSBwdXJwb3NlLFxuLy8gaW5jbHVkaW5nIGNvbW1lcmNpYWwgYXBwbGljYXRpb25zLCBhbmQgdG8gYWx0ZXIgaXQgYW5kIHJlZGlzdHJpYnV0ZSBpdFxuLy8gZnJlZWx5LCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgcmVzdHJpY3Rpb25zOlxuLy9cbi8vIDEuIFRoZSBvcmlnaW4gb2YgdGhpcyBzb2Z0d2FyZSBtdXN0IG5vdCBiZSBtaXNyZXByZXNlbnRlZDsgeW91IG11c3Qgbm90XG4vLyAgIGNsYWltIHRoYXQgeW91IHdyb3RlIHRoZSBvcmlnaW5hbCBzb2Z0d2FyZS4gSWYgeW91IHVzZSB0aGlzIHNvZnR3YXJlXG4vLyAgIGluIGEgcHJvZHVjdCwgYW4gYWNrbm93bGVkZ21lbnQgaW4gdGhlIHByb2R1Y3QgZG9jdW1lbnRhdGlvbiB3b3VsZCBiZVxuLy8gICBhcHByZWNpYXRlZCBidXQgaXMgbm90IHJlcXVpcmVkLlxuLy8gMi4gQWx0ZXJlZCBzb3VyY2UgdmVyc2lvbnMgbXVzdCBiZSBwbGFpbmx5IG1hcmtlZCBhcyBzdWNoLCBhbmQgbXVzdCBub3QgYmVcbi8vICAgbWlzcmVwcmVzZW50ZWQgYXMgYmVpbmcgdGhlIG9yaWdpbmFsIHNvZnR3YXJlLlxuLy8gMy4gVGhpcyBub3RpY2UgbWF5IG5vdCBiZSByZW1vdmVkIG9yIGFsdGVyZWQgZnJvbSBhbnkgc291cmNlIGRpc3RyaWJ1dGlvbi5cblxuY29uc3QgeyBfdHJfaW5pdCwgX3RyX3N0b3JlZF9ibG9jaywgX3RyX2ZsdXNoX2Jsb2NrLCBfdHJfdGFsbHksIF90cl9hbGlnbiB9ID0gdHJlZXM7XG5cblxuXG5cbi8qIFB1YmxpYyBjb25zdGFudHMgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSovXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0qL1xuXG5jb25zdCB7XG4gIFpfTk9fRkxVU0g6IFpfTk9fRkxVU0gkMiwgWl9QQVJUSUFMX0ZMVVNILCBaX0ZVTExfRkxVU0g6IFpfRlVMTF9GTFVTSCQxLCBaX0ZJTklTSDogWl9GSU5JU0gkMywgWl9CTE9DSzogWl9CTE9DSyQxLFxuICBaX09LOiBaX09LJDMsIFpfU1RSRUFNX0VORDogWl9TVFJFQU1fRU5EJDMsIFpfU1RSRUFNX0VSUk9SOiBaX1NUUkVBTV9FUlJPUiQyLCBaX0RBVEFfRVJST1I6IFpfREFUQV9FUlJPUiQyLCBaX0JVRl9FUlJPUjogWl9CVUZfRVJST1IkMSxcbiAgWl9ERUZBVUxUX0NPTVBSRVNTSU9OOiBaX0RFRkFVTFRfQ09NUFJFU1NJT04kMSxcbiAgWl9GSUxURVJFRCwgWl9IVUZGTUFOX09OTFksIFpfUkxFLCBaX0ZJWEVELCBaX0RFRkFVTFRfU1RSQVRFR1k6IFpfREVGQVVMVF9TVFJBVEVHWSQxLFxuICBaX1VOS05PV04sXG4gIFpfREVGTEFURUQ6IFpfREVGTEFURUQkMlxufSA9IGNvbnN0YW50cyQyO1xuXG4vKj09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0qL1xuXG5cbmNvbnN0IE1BWF9NRU1fTEVWRUwgPSA5O1xuLyogTWF4aW11bSB2YWx1ZSBmb3IgbWVtTGV2ZWwgaW4gZGVmbGF0ZUluaXQyICovXG5jb25zdCBNQVhfV0JJVFMkMSA9IDE1O1xuLyogMzJLIExaNzcgd2luZG93ICovXG5jb25zdCBERUZfTUVNX0xFVkVMID0gODtcblxuXG5jb25zdCBMRU5HVEhfQ09ERVMgID0gMjk7XG4vKiBudW1iZXIgb2YgbGVuZ3RoIGNvZGVzLCBub3QgY291bnRpbmcgdGhlIHNwZWNpYWwgRU5EX0JMT0NLIGNvZGUgKi9cbmNvbnN0IExJVEVSQUxTICAgICAgPSAyNTY7XG4vKiBudW1iZXIgb2YgbGl0ZXJhbCBieXRlcyAwLi4yNTUgKi9cbmNvbnN0IExfQ09ERVMgICAgICAgPSBMSVRFUkFMUyArIDEgKyBMRU5HVEhfQ09ERVM7XG4vKiBudW1iZXIgb2YgTGl0ZXJhbCBvciBMZW5ndGggY29kZXMsIGluY2x1ZGluZyB0aGUgRU5EX0JMT0NLIGNvZGUgKi9cbmNvbnN0IERfQ09ERVMgICAgICAgPSAzMDtcbi8qIG51bWJlciBvZiBkaXN0YW5jZSBjb2RlcyAqL1xuY29uc3QgQkxfQ09ERVMgICAgICA9IDE5O1xuLyogbnVtYmVyIG9mIGNvZGVzIHVzZWQgdG8gdHJhbnNmZXIgdGhlIGJpdCBsZW5ndGhzICovXG5jb25zdCBIRUFQX1NJWkUgICAgID0gMiAqIExfQ09ERVMgKyAxO1xuLyogbWF4aW11bSBoZWFwIHNpemUgKi9cbmNvbnN0IE1BWF9CSVRTICA9IDE1O1xuLyogQWxsIGNvZGVzIG11c3Qgbm90IGV4Y2VlZCBNQVhfQklUUyBiaXRzICovXG5cbmNvbnN0IE1JTl9NQVRDSCA9IDM7XG5jb25zdCBNQVhfTUFUQ0ggPSAyNTg7XG5jb25zdCBNSU5fTE9PS0FIRUFEID0gKE1BWF9NQVRDSCArIE1JTl9NQVRDSCArIDEpO1xuXG5jb25zdCBQUkVTRVRfRElDVCA9IDB4MjA7XG5cbmNvbnN0IElOSVRfU1RBVEUgICAgPSAgNDI7ICAgIC8qIHpsaWIgaGVhZGVyIC0+IEJVU1lfU1RBVEUgKi9cbi8vI2lmZGVmIEdaSVBcbmNvbnN0IEdaSVBfU1RBVEUgICAgPSAgNTc7ICAgIC8qIGd6aXAgaGVhZGVyIC0+IEJVU1lfU1RBVEUgfCBFWFRSQV9TVEFURSAqL1xuLy8jZW5kaWZcbmNvbnN0IEVYVFJBX1NUQVRFICAgPSAgNjk7ICAgIC8qIGd6aXAgZXh0cmEgYmxvY2sgLT4gTkFNRV9TVEFURSAqL1xuY29uc3QgTkFNRV9TVEFURSAgICA9ICA3MzsgICAgLyogZ3ppcCBmaWxlIG5hbWUgLT4gQ09NTUVOVF9TVEFURSAqL1xuY29uc3QgQ09NTUVOVF9TVEFURSA9ICA5MTsgICAgLyogZ3ppcCBjb21tZW50IC0+IEhDUkNfU1RBVEUgKi9cbmNvbnN0IEhDUkNfU1RBVEUgICAgPSAxMDM7ICAgIC8qIGd6aXAgaGVhZGVyIENSQyAtPiBCVVNZX1NUQVRFICovXG5jb25zdCBCVVNZX1NUQVRFICAgID0gMTEzOyAgICAvKiBkZWZsYXRlIC0+IEZJTklTSF9TVEFURSAqL1xuY29uc3QgRklOSVNIX1NUQVRFICA9IDY2NjsgICAgLyogc3RyZWFtIGNvbXBsZXRlICovXG5cbmNvbnN0IEJTX05FRURfTU9SRSAgICAgID0gMTsgLyogYmxvY2sgbm90IGNvbXBsZXRlZCwgbmVlZCBtb3JlIGlucHV0IG9yIG1vcmUgb3V0cHV0ICovXG5jb25zdCBCU19CTE9DS19ET05FICAgICA9IDI7IC8qIGJsb2NrIGZsdXNoIHBlcmZvcm1lZCAqL1xuY29uc3QgQlNfRklOSVNIX1NUQVJURUQgPSAzOyAvKiBmaW5pc2ggc3RhcnRlZCwgbmVlZCBvbmx5IG1vcmUgb3V0cHV0IGF0IG5leHQgZGVmbGF0ZSAqL1xuY29uc3QgQlNfRklOSVNIX0RPTkUgICAgPSA0OyAvKiBmaW5pc2ggZG9uZSwgYWNjZXB0IG5vIG1vcmUgaW5wdXQgb3Igb3V0cHV0ICovXG5cbmNvbnN0IE9TX0NPREUgPSAweDAzOyAvLyBVbml4IDopIC4gRG9uJ3QgZGV0ZWN0LCB1c2UgdGhpcyBkZWZhdWx0LlxuXG5jb25zdCBlcnIgPSAoc3RybSwgZXJyb3JDb2RlKSA9PiB7XG4gIHN0cm0ubXNnID0gbWVzc2FnZXNbZXJyb3JDb2RlXTtcbiAgcmV0dXJuIGVycm9yQ29kZTtcbn07XG5cbmNvbnN0IHJhbmsgPSAoZikgPT4ge1xuICByZXR1cm4gKChmKSAqIDIpIC0gKChmKSA+IDQgPyA5IDogMCk7XG59O1xuXG5jb25zdCB6ZXJvID0gKGJ1ZikgPT4ge1xuICBsZXQgbGVuID0gYnVmLmxlbmd0aDsgd2hpbGUgKC0tbGVuID49IDApIHsgYnVmW2xlbl0gPSAwOyB9XG59O1xuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIFNsaWRlIHRoZSBoYXNoIHRhYmxlIHdoZW4gc2xpZGluZyB0aGUgd2luZG93IGRvd24gKGNvdWxkIGJlIGF2b2lkZWQgd2l0aCAzMlxuICogYml0IHZhbHVlcyBhdCB0aGUgZXhwZW5zZSBvZiBtZW1vcnkgdXNhZ2UpLiBXZSBzbGlkZSBldmVuIHdoZW4gbGV2ZWwgPT0gMCB0b1xuICoga2VlcCB0aGUgaGFzaCB0YWJsZSBjb25zaXN0ZW50IGlmIHdlIHN3aXRjaCBiYWNrIHRvIGxldmVsID4gMCBsYXRlci5cbiAqL1xuY29uc3Qgc2xpZGVfaGFzaCA9IChzKSA9PiB7XG4gIGxldCBuLCBtO1xuICBsZXQgcDtcbiAgbGV0IHdzaXplID0gcy53X3NpemU7XG5cbiAgbiA9IHMuaGFzaF9zaXplO1xuICBwID0gbjtcbiAgZG8ge1xuICAgIG0gPSBzLmhlYWRbLS1wXTtcbiAgICBzLmhlYWRbcF0gPSAobSA+PSB3c2l6ZSA/IG0gLSB3c2l6ZSA6IDApO1xuICB9IHdoaWxlICgtLW4pO1xuICBuID0gd3NpemU7XG4vLyNpZm5kZWYgRkFTVEVTVFxuICBwID0gbjtcbiAgZG8ge1xuICAgIG0gPSBzLnByZXZbLS1wXTtcbiAgICBzLnByZXZbcF0gPSAobSA+PSB3c2l6ZSA/IG0gLSB3c2l6ZSA6IDApO1xuICAgIC8qIElmIG4gaXMgbm90IG9uIGFueSBoYXNoIGNoYWluLCBwcmV2W25dIGlzIGdhcmJhZ2UgYnV0XG4gICAgICogaXRzIHZhbHVlIHdpbGwgbmV2ZXIgYmUgdXNlZC5cbiAgICAgKi9cbiAgfSB3aGlsZSAoLS1uKTtcbi8vI2VuZGlmXG59O1xuXG4vKiBlc2xpbnQtZGlzYWJsZSBuZXctY2FwICovXG5sZXQgSEFTSF9aTElCID0gKHMsIHByZXYsIGRhdGEpID0+ICgocHJldiA8PCBzLmhhc2hfc2hpZnQpIF4gZGF0YSkgJiBzLmhhc2hfbWFzaztcbi8vIFRoaXMgaGFzaCBjYXVzZXMgbGVzcyBjb2xsaXNpb25zLCBodHRwczovL2dpdGh1Yi5jb20vbm9kZWNhL3Bha28vaXNzdWVzLzEzNVxuLy8gQnV0IGJyZWFrcyBiaW5hcnkgY29tcGF0aWJpbGl0eVxuLy9sZXQgSEFTSF9GQVNUID0gKHMsIHByZXYsIGRhdGEpID0+ICgocHJldiA8PCA4KSArIChwcmV2ID4+IDgpICsgKGRhdGEgPDwgNCkpICYgcy5oYXNoX21hc2s7XG5sZXQgSEFTSCA9IEhBU0hfWkxJQjtcblxuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBGbHVzaCBhcyBtdWNoIHBlbmRpbmcgb3V0cHV0IGFzIHBvc3NpYmxlLiBBbGwgZGVmbGF0ZSgpIG91dHB1dCwgZXhjZXB0IGZvclxuICogc29tZSBkZWZsYXRlX3N0b3JlZCgpIG91dHB1dCwgZ29lcyB0aHJvdWdoIHRoaXMgZnVuY3Rpb24gc28gc29tZVxuICogYXBwbGljYXRpb25zIG1heSB3aXNoIHRvIG1vZGlmeSBpdCB0byBhdm9pZCBhbGxvY2F0aW5nIGEgbGFyZ2VcbiAqIHN0cm0tPm5leHRfb3V0IGJ1ZmZlciBhbmQgY29weWluZyBpbnRvIGl0LiAoU2VlIGFsc28gcmVhZF9idWYoKSkuXG4gKi9cbmNvbnN0IGZsdXNoX3BlbmRpbmcgPSAoc3RybSkgPT4ge1xuICBjb25zdCBzID0gc3RybS5zdGF0ZTtcblxuICAvL190cl9mbHVzaF9iaXRzKHMpO1xuICBsZXQgbGVuID0gcy5wZW5kaW5nO1xuICBpZiAobGVuID4gc3RybS5hdmFpbF9vdXQpIHtcbiAgICBsZW4gPSBzdHJtLmF2YWlsX291dDtcbiAgfVxuICBpZiAobGVuID09PSAwKSB7IHJldHVybjsgfVxuXG4gIHN0cm0ub3V0cHV0LnNldChzLnBlbmRpbmdfYnVmLnN1YmFycmF5KHMucGVuZGluZ19vdXQsIHMucGVuZGluZ19vdXQgKyBsZW4pLCBzdHJtLm5leHRfb3V0KTtcbiAgc3RybS5uZXh0X291dCAgKz0gbGVuO1xuICBzLnBlbmRpbmdfb3V0ICArPSBsZW47XG4gIHN0cm0udG90YWxfb3V0ICs9IGxlbjtcbiAgc3RybS5hdmFpbF9vdXQgLT0gbGVuO1xuICBzLnBlbmRpbmcgICAgICAtPSBsZW47XG4gIGlmIChzLnBlbmRpbmcgPT09IDApIHtcbiAgICBzLnBlbmRpbmdfb3V0ID0gMDtcbiAgfVxufTtcblxuXG5jb25zdCBmbHVzaF9ibG9ja19vbmx5ID0gKHMsIGxhc3QpID0+IHtcbiAgX3RyX2ZsdXNoX2Jsb2NrKHMsIChzLmJsb2NrX3N0YXJ0ID49IDAgPyBzLmJsb2NrX3N0YXJ0IDogLTEpLCBzLnN0cnN0YXJ0IC0gcy5ibG9ja19zdGFydCwgbGFzdCk7XG4gIHMuYmxvY2tfc3RhcnQgPSBzLnN0cnN0YXJ0O1xuICBmbHVzaF9wZW5kaW5nKHMuc3RybSk7XG59O1xuXG5cbmNvbnN0IHB1dF9ieXRlID0gKHMsIGIpID0+IHtcbiAgcy5wZW5kaW5nX2J1ZltzLnBlbmRpbmcrK10gPSBiO1xufTtcblxuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBQdXQgYSBzaG9ydCBpbiB0aGUgcGVuZGluZyBidWZmZXIuIFRoZSAxNi1iaXQgdmFsdWUgaXMgcHV0IGluIE1TQiBvcmRlci5cbiAqIElOIGFzc2VydGlvbjogdGhlIHN0cmVhbSBzdGF0ZSBpcyBjb3JyZWN0IGFuZCB0aGVyZSBpcyBlbm91Z2ggcm9vbSBpblxuICogcGVuZGluZ19idWYuXG4gKi9cbmNvbnN0IHB1dFNob3J0TVNCID0gKHMsIGIpID0+IHtcblxuICAvLyAgcHV0X2J5dGUocywgKEJ5dGUpKGIgPj4gOCkpO1xuLy8gIHB1dF9ieXRlKHMsIChCeXRlKShiICYgMHhmZikpO1xuICBzLnBlbmRpbmdfYnVmW3MucGVuZGluZysrXSA9IChiID4+PiA4KSAmIDB4ZmY7XG4gIHMucGVuZGluZ19idWZbcy5wZW5kaW5nKytdID0gYiAmIDB4ZmY7XG59O1xuXG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogUmVhZCBhIG5ldyBidWZmZXIgZnJvbSB0aGUgY3VycmVudCBpbnB1dCBzdHJlYW0sIHVwZGF0ZSB0aGUgYWRsZXIzMlxuICogYW5kIHRvdGFsIG51bWJlciBvZiBieXRlcyByZWFkLiAgQWxsIGRlZmxhdGUoKSBpbnB1dCBnb2VzIHRocm91Z2hcbiAqIHRoaXMgZnVuY3Rpb24gc28gc29tZSBhcHBsaWNhdGlvbnMgbWF5IHdpc2ggdG8gbW9kaWZ5IGl0IHRvIGF2b2lkXG4gKiBhbGxvY2F0aW5nIGEgbGFyZ2Ugc3RybS0+aW5wdXQgYnVmZmVyIGFuZCBjb3B5aW5nIGZyb20gaXQuXG4gKiAoU2VlIGFsc28gZmx1c2hfcGVuZGluZygpKS5cbiAqL1xuY29uc3QgcmVhZF9idWYgPSAoc3RybSwgYnVmLCBzdGFydCwgc2l6ZSkgPT4ge1xuXG4gIGxldCBsZW4gPSBzdHJtLmF2YWlsX2luO1xuXG4gIGlmIChsZW4gPiBzaXplKSB7IGxlbiA9IHNpemU7IH1cbiAgaWYgKGxlbiA9PT0gMCkgeyByZXR1cm4gMDsgfVxuXG4gIHN0cm0uYXZhaWxfaW4gLT0gbGVuO1xuXG4gIC8vIHptZW1jcHkoYnVmLCBzdHJtLT5uZXh0X2luLCBsZW4pO1xuICBidWYuc2V0KHN0cm0uaW5wdXQuc3ViYXJyYXkoc3RybS5uZXh0X2luLCBzdHJtLm5leHRfaW4gKyBsZW4pLCBzdGFydCk7XG4gIGlmIChzdHJtLnN0YXRlLndyYXAgPT09IDEpIHtcbiAgICBzdHJtLmFkbGVyID0gYWRsZXIzMl8xKHN0cm0uYWRsZXIsIGJ1ZiwgbGVuLCBzdGFydCk7XG4gIH1cblxuICBlbHNlIGlmIChzdHJtLnN0YXRlLndyYXAgPT09IDIpIHtcbiAgICBzdHJtLmFkbGVyID0gY3JjMzJfMShzdHJtLmFkbGVyLCBidWYsIGxlbiwgc3RhcnQpO1xuICB9XG5cbiAgc3RybS5uZXh0X2luICs9IGxlbjtcbiAgc3RybS50b3RhbF9pbiArPSBsZW47XG5cbiAgcmV0dXJuIGxlbjtcbn07XG5cblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBTZXQgbWF0Y2hfc3RhcnQgdG8gdGhlIGxvbmdlc3QgbWF0Y2ggc3RhcnRpbmcgYXQgdGhlIGdpdmVuIHN0cmluZyBhbmRcbiAqIHJldHVybiBpdHMgbGVuZ3RoLiBNYXRjaGVzIHNob3J0ZXIgb3IgZXF1YWwgdG8gcHJldl9sZW5ndGggYXJlIGRpc2NhcmRlZCxcbiAqIGluIHdoaWNoIGNhc2UgdGhlIHJlc3VsdCBpcyBlcXVhbCB0byBwcmV2X2xlbmd0aCBhbmQgbWF0Y2hfc3RhcnQgaXNcbiAqIGdhcmJhZ2UuXG4gKiBJTiBhc3NlcnRpb25zOiBjdXJfbWF0Y2ggaXMgdGhlIGhlYWQgb2YgdGhlIGhhc2ggY2hhaW4gZm9yIHRoZSBjdXJyZW50XG4gKiAgIHN0cmluZyAoc3Ryc3RhcnQpIGFuZCBpdHMgZGlzdGFuY2UgaXMgPD0gTUFYX0RJU1QsIGFuZCBwcmV2X2xlbmd0aCA+PSAxXG4gKiBPVVQgYXNzZXJ0aW9uOiB0aGUgbWF0Y2ggbGVuZ3RoIGlzIG5vdCBncmVhdGVyIHRoYW4gcy0+bG9va2FoZWFkLlxuICovXG5jb25zdCBsb25nZXN0X21hdGNoID0gKHMsIGN1cl9tYXRjaCkgPT4ge1xuXG4gIGxldCBjaGFpbl9sZW5ndGggPSBzLm1heF9jaGFpbl9sZW5ndGg7ICAgICAgLyogbWF4IGhhc2ggY2hhaW4gbGVuZ3RoICovXG4gIGxldCBzY2FuID0gcy5zdHJzdGFydDsgLyogY3VycmVudCBzdHJpbmcgKi9cbiAgbGV0IG1hdGNoOyAgICAgICAgICAgICAgICAgICAgICAgLyogbWF0Y2hlZCBzdHJpbmcgKi9cbiAgbGV0IGxlbjsgICAgICAgICAgICAgICAgICAgICAgICAgICAvKiBsZW5ndGggb2YgY3VycmVudCBtYXRjaCAqL1xuICBsZXQgYmVzdF9sZW4gPSBzLnByZXZfbGVuZ3RoOyAgICAgICAgICAgICAgLyogYmVzdCBtYXRjaCBsZW5ndGggc28gZmFyICovXG4gIGxldCBuaWNlX21hdGNoID0gcy5uaWNlX21hdGNoOyAgICAgICAgICAgICAvKiBzdG9wIGlmIG1hdGNoIGxvbmcgZW5vdWdoICovXG4gIGNvbnN0IGxpbWl0ID0gKHMuc3Ryc3RhcnQgPiAocy53X3NpemUgLSBNSU5fTE9PS0FIRUFEKSkgP1xuICAgICAgcy5zdHJzdGFydCAtIChzLndfc2l6ZSAtIE1JTl9MT09LQUhFQUQpIDogMC8qTklMKi87XG5cbiAgY29uc3QgX3dpbiA9IHMud2luZG93OyAvLyBzaG9ydGN1dFxuXG4gIGNvbnN0IHdtYXNrID0gcy53X21hc2s7XG4gIGNvbnN0IHByZXYgID0gcy5wcmV2O1xuXG4gIC8qIFN0b3Agd2hlbiBjdXJfbWF0Y2ggYmVjb21lcyA8PSBsaW1pdC4gVG8gc2ltcGxpZnkgdGhlIGNvZGUsXG4gICAqIHdlIHByZXZlbnQgbWF0Y2hlcyB3aXRoIHRoZSBzdHJpbmcgb2Ygd2luZG93IGluZGV4IDAuXG4gICAqL1xuXG4gIGNvbnN0IHN0cmVuZCA9IHMuc3Ryc3RhcnQgKyBNQVhfTUFUQ0g7XG4gIGxldCBzY2FuX2VuZDEgID0gX3dpbltzY2FuICsgYmVzdF9sZW4gLSAxXTtcbiAgbGV0IHNjYW5fZW5kICAgPSBfd2luW3NjYW4gKyBiZXN0X2xlbl07XG5cbiAgLyogVGhlIGNvZGUgaXMgb3B0aW1pemVkIGZvciBIQVNIX0JJVFMgPj0gOCBhbmQgTUFYX01BVENILTIgbXVsdGlwbGUgb2YgMTYuXG4gICAqIEl0IGlzIGVhc3kgdG8gZ2V0IHJpZCBvZiB0aGlzIG9wdGltaXphdGlvbiBpZiBuZWNlc3NhcnkuXG4gICAqL1xuICAvLyBBc3NlcnQocy0+aGFzaF9iaXRzID49IDggJiYgTUFYX01BVENIID09IDI1OCwgXCJDb2RlIHRvbyBjbGV2ZXJcIik7XG5cbiAgLyogRG8gbm90IHdhc3RlIHRvbyBtdWNoIHRpbWUgaWYgd2UgYWxyZWFkeSBoYXZlIGEgZ29vZCBtYXRjaDogKi9cbiAgaWYgKHMucHJldl9sZW5ndGggPj0gcy5nb29kX21hdGNoKSB7XG4gICAgY2hhaW5fbGVuZ3RoID4+PSAyO1xuICB9XG4gIC8qIERvIG5vdCBsb29rIGZvciBtYXRjaGVzIGJleW9uZCB0aGUgZW5kIG9mIHRoZSBpbnB1dC4gVGhpcyBpcyBuZWNlc3NhcnlcbiAgICogdG8gbWFrZSBkZWZsYXRlIGRldGVybWluaXN0aWMuXG4gICAqL1xuICBpZiAobmljZV9tYXRjaCA+IHMubG9va2FoZWFkKSB7IG5pY2VfbWF0Y2ggPSBzLmxvb2thaGVhZDsgfVxuXG4gIC8vIEFzc2VydCgodWxnKXMtPnN0cnN0YXJ0IDw9IHMtPndpbmRvd19zaXplLU1JTl9MT09LQUhFQUQsIFwibmVlZCBsb29rYWhlYWRcIik7XG5cbiAgZG8ge1xuICAgIC8vIEFzc2VydChjdXJfbWF0Y2ggPCBzLT5zdHJzdGFydCwgXCJubyBmdXR1cmVcIik7XG4gICAgbWF0Y2ggPSBjdXJfbWF0Y2g7XG5cbiAgICAvKiBTa2lwIHRvIG5leHQgbWF0Y2ggaWYgdGhlIG1hdGNoIGxlbmd0aCBjYW5ub3QgaW5jcmVhc2VcbiAgICAgKiBvciBpZiB0aGUgbWF0Y2ggbGVuZ3RoIGlzIGxlc3MgdGhhbiAyLiAgTm90ZSB0aGF0IHRoZSBjaGVja3MgYmVsb3dcbiAgICAgKiBmb3IgaW5zdWZmaWNpZW50IGxvb2thaGVhZCBvbmx5IG9jY3VyIG9jY2FzaW9uYWxseSBmb3IgcGVyZm9ybWFuY2VcbiAgICAgKiByZWFzb25zLiAgVGhlcmVmb3JlIHVuaW5pdGlhbGl6ZWQgbWVtb3J5IHdpbGwgYmUgYWNjZXNzZWQsIGFuZFxuICAgICAqIGNvbmRpdGlvbmFsIGp1bXBzIHdpbGwgYmUgbWFkZSB0aGF0IGRlcGVuZCBvbiB0aG9zZSB2YWx1ZXMuXG4gICAgICogSG93ZXZlciB0aGUgbGVuZ3RoIG9mIHRoZSBtYXRjaCBpcyBsaW1pdGVkIHRvIHRoZSBsb29rYWhlYWQsIHNvXG4gICAgICogdGhlIG91dHB1dCBvZiBkZWZsYXRlIGlzIG5vdCBhZmZlY3RlZCBieSB0aGUgdW5pbml0aWFsaXplZCB2YWx1ZXMuXG4gICAgICovXG5cbiAgICBpZiAoX3dpblttYXRjaCArIGJlc3RfbGVuXSAgICAgIT09IHNjYW5fZW5kICB8fFxuICAgICAgICBfd2luW21hdGNoICsgYmVzdF9sZW4gLSAxXSAhPT0gc2Nhbl9lbmQxIHx8XG4gICAgICAgIF93aW5bbWF0Y2hdICAgICAgICAgICAgICAgICE9PSBfd2luW3NjYW5dIHx8XG4gICAgICAgIF93aW5bKyttYXRjaF0gICAgICAgICAgICAgICE9PSBfd2luW3NjYW4gKyAxXSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLyogVGhlIGNoZWNrIGF0IGJlc3RfbGVuLTEgY2FuIGJlIHJlbW92ZWQgYmVjYXVzZSBpdCB3aWxsIGJlIG1hZGVcbiAgICAgKiBhZ2FpbiBsYXRlci4gKFRoaXMgaGV1cmlzdGljIGlzIG5vdCBhbHdheXMgYSB3aW4uKVxuICAgICAqIEl0IGlzIG5vdCBuZWNlc3NhcnkgdG8gY29tcGFyZSBzY2FuWzJdIGFuZCBtYXRjaFsyXSBzaW5jZSB0aGV5XG4gICAgICogYXJlIGFsd2F5cyBlcXVhbCB3aGVuIHRoZSBvdGhlciBieXRlcyBtYXRjaCwgZ2l2ZW4gdGhhdFxuICAgICAqIHRoZSBoYXNoIGtleXMgYXJlIGVxdWFsIGFuZCB0aGF0IEhBU0hfQklUUyA+PSA4LlxuICAgICAqL1xuICAgIHNjYW4gKz0gMjtcbiAgICBtYXRjaCsrO1xuICAgIC8vIEFzc2VydCgqc2NhbiA9PSAqbWF0Y2gsIFwibWF0Y2hbMl0/XCIpO1xuXG4gICAgLyogV2UgY2hlY2sgZm9yIGluc3VmZmljaWVudCBsb29rYWhlYWQgb25seSBldmVyeSA4dGggY29tcGFyaXNvbjtcbiAgICAgKiB0aGUgMjU2dGggY2hlY2sgd2lsbCBiZSBtYWRlIGF0IHN0cnN0YXJ0KzI1OC5cbiAgICAgKi9cbiAgICBkbyB7XG4gICAgICAvKmpzaGludCBub2VtcHR5OmZhbHNlKi9cbiAgICB9IHdoaWxlIChfd2luWysrc2Nhbl0gPT09IF93aW5bKyttYXRjaF0gJiYgX3dpblsrK3NjYW5dID09PSBfd2luWysrbWF0Y2hdICYmXG4gICAgICAgICAgICAgX3dpblsrK3NjYW5dID09PSBfd2luWysrbWF0Y2hdICYmIF93aW5bKytzY2FuXSA9PT0gX3dpblsrK21hdGNoXSAmJlxuICAgICAgICAgICAgIF93aW5bKytzY2FuXSA9PT0gX3dpblsrK21hdGNoXSAmJiBfd2luWysrc2Nhbl0gPT09IF93aW5bKyttYXRjaF0gJiZcbiAgICAgICAgICAgICBfd2luWysrc2Nhbl0gPT09IF93aW5bKyttYXRjaF0gJiYgX3dpblsrK3NjYW5dID09PSBfd2luWysrbWF0Y2hdICYmXG4gICAgICAgICAgICAgc2NhbiA8IHN0cmVuZCk7XG5cbiAgICAvLyBBc3NlcnQoc2NhbiA8PSBzLT53aW5kb3crKHVuc2lnbmVkKShzLT53aW5kb3dfc2l6ZS0xKSwgXCJ3aWxkIHNjYW5cIik7XG5cbiAgICBsZW4gPSBNQVhfTUFUQ0ggLSAoc3RyZW5kIC0gc2Nhbik7XG4gICAgc2NhbiA9IHN0cmVuZCAtIE1BWF9NQVRDSDtcblxuICAgIGlmIChsZW4gPiBiZXN0X2xlbikge1xuICAgICAgcy5tYXRjaF9zdGFydCA9IGN1cl9tYXRjaDtcbiAgICAgIGJlc3RfbGVuID0gbGVuO1xuICAgICAgaWYgKGxlbiA+PSBuaWNlX21hdGNoKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgc2Nhbl9lbmQxICA9IF93aW5bc2NhbiArIGJlc3RfbGVuIC0gMV07XG4gICAgICBzY2FuX2VuZCAgID0gX3dpbltzY2FuICsgYmVzdF9sZW5dO1xuICAgIH1cbiAgfSB3aGlsZSAoKGN1cl9tYXRjaCA9IHByZXZbY3VyX21hdGNoICYgd21hc2tdKSA+IGxpbWl0ICYmIC0tY2hhaW5fbGVuZ3RoICE9PSAwKTtcblxuICBpZiAoYmVzdF9sZW4gPD0gcy5sb29rYWhlYWQpIHtcbiAgICByZXR1cm4gYmVzdF9sZW47XG4gIH1cbiAgcmV0dXJuIHMubG9va2FoZWFkO1xufTtcblxuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIEZpbGwgdGhlIHdpbmRvdyB3aGVuIHRoZSBsb29rYWhlYWQgYmVjb21lcyBpbnN1ZmZpY2llbnQuXG4gKiBVcGRhdGVzIHN0cnN0YXJ0IGFuZCBsb29rYWhlYWQuXG4gKlxuICogSU4gYXNzZXJ0aW9uOiBsb29rYWhlYWQgPCBNSU5fTE9PS0FIRUFEXG4gKiBPVVQgYXNzZXJ0aW9uczogc3Ryc3RhcnQgPD0gd2luZG93X3NpemUtTUlOX0xPT0tBSEVBRFxuICogICAgQXQgbGVhc3Qgb25lIGJ5dGUgaGFzIGJlZW4gcmVhZCwgb3IgYXZhaWxfaW4gPT0gMDsgcmVhZHMgYXJlXG4gKiAgICBwZXJmb3JtZWQgZm9yIGF0IGxlYXN0IHR3byBieXRlcyAocmVxdWlyZWQgZm9yIHRoZSB6aXAgdHJhbnNsYXRlX2VvbFxuICogICAgb3B0aW9uIC0tIG5vdCBzdXBwb3J0ZWQgaGVyZSkuXG4gKi9cbmNvbnN0IGZpbGxfd2luZG93ID0gKHMpID0+IHtcblxuICBjb25zdCBfd19zaXplID0gcy53X3NpemU7XG4gIGxldCBuLCBtb3JlLCBzdHI7XG5cbiAgLy9Bc3NlcnQocy0+bG9va2FoZWFkIDwgTUlOX0xPT0tBSEVBRCwgXCJhbHJlYWR5IGVub3VnaCBsb29rYWhlYWRcIik7XG5cbiAgZG8ge1xuICAgIG1vcmUgPSBzLndpbmRvd19zaXplIC0gcy5sb29rYWhlYWQgLSBzLnN0cnN0YXJ0O1xuXG4gICAgLy8gSlMgaW50cyBoYXZlIDMyIGJpdCwgYmxvY2sgYmVsb3cgbm90IG5lZWRlZFxuICAgIC8qIERlYWwgd2l0aCAhQCMkJSA2NEsgbGltaXQ6ICovXG4gICAgLy9pZiAoc2l6ZW9mKGludCkgPD0gMikge1xuICAgIC8vICAgIGlmIChtb3JlID09IDAgJiYgcy0+c3Ryc3RhcnQgPT0gMCAmJiBzLT5sb29rYWhlYWQgPT0gMCkge1xuICAgIC8vICAgICAgICBtb3JlID0gd3NpemU7XG4gICAgLy9cbiAgICAvLyAgfSBlbHNlIGlmIChtb3JlID09ICh1bnNpZ25lZCkoLTEpKSB7XG4gICAgLy8gICAgICAgIC8qIFZlcnkgdW5saWtlbHksIGJ1dCBwb3NzaWJsZSBvbiAxNiBiaXQgbWFjaGluZSBpZlxuICAgIC8vICAgICAgICAgKiBzdHJzdGFydCA9PSAwICYmIGxvb2thaGVhZCA9PSAxIChpbnB1dCBkb25lIGEgYnl0ZSBhdCB0aW1lKVxuICAgIC8vICAgICAgICAgKi9cbiAgICAvLyAgICAgICAgbW9yZS0tO1xuICAgIC8vICAgIH1cbiAgICAvL31cblxuXG4gICAgLyogSWYgdGhlIHdpbmRvdyBpcyBhbG1vc3QgZnVsbCBhbmQgdGhlcmUgaXMgaW5zdWZmaWNpZW50IGxvb2thaGVhZCxcbiAgICAgKiBtb3ZlIHRoZSB1cHBlciBoYWxmIHRvIHRoZSBsb3dlciBvbmUgdG8gbWFrZSByb29tIGluIHRoZSB1cHBlciBoYWxmLlxuICAgICAqL1xuICAgIGlmIChzLnN0cnN0YXJ0ID49IF93X3NpemUgKyAoX3dfc2l6ZSAtIE1JTl9MT09LQUhFQUQpKSB7XG5cbiAgICAgIHMud2luZG93LnNldChzLndpbmRvdy5zdWJhcnJheShfd19zaXplLCBfd19zaXplICsgX3dfc2l6ZSAtIG1vcmUpLCAwKTtcbiAgICAgIHMubWF0Y2hfc3RhcnQgLT0gX3dfc2l6ZTtcbiAgICAgIHMuc3Ryc3RhcnQgLT0gX3dfc2l6ZTtcbiAgICAgIC8qIHdlIG5vdyBoYXZlIHN0cnN0YXJ0ID49IE1BWF9ESVNUICovXG4gICAgICBzLmJsb2NrX3N0YXJ0IC09IF93X3NpemU7XG4gICAgICBpZiAocy5pbnNlcnQgPiBzLnN0cnN0YXJ0KSB7XG4gICAgICAgIHMuaW5zZXJ0ID0gcy5zdHJzdGFydDtcbiAgICAgIH1cbiAgICAgIHNsaWRlX2hhc2gocyk7XG4gICAgICBtb3JlICs9IF93X3NpemU7XG4gICAgfVxuICAgIGlmIChzLnN0cm0uYXZhaWxfaW4gPT09IDApIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIC8qIElmIHRoZXJlIHdhcyBubyBzbGlkaW5nOlxuICAgICAqICAgIHN0cnN0YXJ0IDw9IFdTSVpFK01BWF9ESVNULTEgJiYgbG9va2FoZWFkIDw9IE1JTl9MT09LQUhFQUQgLSAxICYmXG4gICAgICogICAgbW9yZSA9PSB3aW5kb3dfc2l6ZSAtIGxvb2thaGVhZCAtIHN0cnN0YXJ0XG4gICAgICogPT4gbW9yZSA+PSB3aW5kb3dfc2l6ZSAtIChNSU5fTE9PS0FIRUFELTEgKyBXU0laRSArIE1BWF9ESVNULTEpXG4gICAgICogPT4gbW9yZSA+PSB3aW5kb3dfc2l6ZSAtIDIqV1NJWkUgKyAyXG4gICAgICogSW4gdGhlIEJJR19NRU0gb3IgTU1BUCBjYXNlIChub3QgeWV0IHN1cHBvcnRlZCksXG4gICAgICogICB3aW5kb3dfc2l6ZSA9PSBpbnB1dF9zaXplICsgTUlOX0xPT0tBSEVBRCAgJiZcbiAgICAgKiAgIHN0cnN0YXJ0ICsgcy0+bG9va2FoZWFkIDw9IGlucHV0X3NpemUgPT4gbW9yZSA+PSBNSU5fTE9PS0FIRUFELlxuICAgICAqIE90aGVyd2lzZSwgd2luZG93X3NpemUgPT0gMipXU0laRSBzbyBtb3JlID49IDIuXG4gICAgICogSWYgdGhlcmUgd2FzIHNsaWRpbmcsIG1vcmUgPj0gV1NJWkUuIFNvIGluIGFsbCBjYXNlcywgbW9yZSA+PSAyLlxuICAgICAqL1xuICAgIC8vQXNzZXJ0KG1vcmUgPj0gMiwgXCJtb3JlIDwgMlwiKTtcbiAgICBuID0gcmVhZF9idWYocy5zdHJtLCBzLndpbmRvdywgcy5zdHJzdGFydCArIHMubG9va2FoZWFkLCBtb3JlKTtcbiAgICBzLmxvb2thaGVhZCArPSBuO1xuXG4gICAgLyogSW5pdGlhbGl6ZSB0aGUgaGFzaCB2YWx1ZSBub3cgdGhhdCB3ZSBoYXZlIHNvbWUgaW5wdXQ6ICovXG4gICAgaWYgKHMubG9va2FoZWFkICsgcy5pbnNlcnQgPj0gTUlOX01BVENIKSB7XG4gICAgICBzdHIgPSBzLnN0cnN0YXJ0IC0gcy5pbnNlcnQ7XG4gICAgICBzLmluc19oID0gcy53aW5kb3dbc3RyXTtcblxuICAgICAgLyogVVBEQVRFX0hBU0gocywgcy0+aW5zX2gsIHMtPndpbmRvd1tzdHIgKyAxXSk7ICovXG4gICAgICBzLmluc19oID0gSEFTSChzLCBzLmluc19oLCBzLndpbmRvd1tzdHIgKyAxXSk7XG4vLyNpZiBNSU5fTUFUQ0ggIT0gM1xuLy8gICAgICAgIENhbGwgdXBkYXRlX2hhc2goKSBNSU5fTUFUQ0gtMyBtb3JlIHRpbWVzXG4vLyNlbmRpZlxuICAgICAgd2hpbGUgKHMuaW5zZXJ0KSB7XG4gICAgICAgIC8qIFVQREFURV9IQVNIKHMsIHMtPmluc19oLCBzLT53aW5kb3dbc3RyICsgTUlOX01BVENILTFdKTsgKi9cbiAgICAgICAgcy5pbnNfaCA9IEhBU0gocywgcy5pbnNfaCwgcy53aW5kb3dbc3RyICsgTUlOX01BVENIIC0gMV0pO1xuXG4gICAgICAgIHMucHJldltzdHIgJiBzLndfbWFza10gPSBzLmhlYWRbcy5pbnNfaF07XG4gICAgICAgIHMuaGVhZFtzLmluc19oXSA9IHN0cjtcbiAgICAgICAgc3RyKys7XG4gICAgICAgIHMuaW5zZXJ0LS07XG4gICAgICAgIGlmIChzLmxvb2thaGVhZCArIHMuaW5zZXJ0IDwgTUlOX01BVENIKSB7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgLyogSWYgdGhlIHdob2xlIGlucHV0IGhhcyBsZXNzIHRoYW4gTUlOX01BVENIIGJ5dGVzLCBpbnNfaCBpcyBnYXJiYWdlLFxuICAgICAqIGJ1dCB0aGlzIGlzIG5vdCBpbXBvcnRhbnQgc2luY2Ugb25seSBsaXRlcmFsIGJ5dGVzIHdpbGwgYmUgZW1pdHRlZC5cbiAgICAgKi9cblxuICB9IHdoaWxlIChzLmxvb2thaGVhZCA8IE1JTl9MT09LQUhFQUQgJiYgcy5zdHJtLmF2YWlsX2luICE9PSAwKTtcblxuICAvKiBJZiB0aGUgV0lOX0lOSVQgYnl0ZXMgYWZ0ZXIgdGhlIGVuZCBvZiB0aGUgY3VycmVudCBkYXRhIGhhdmUgbmV2ZXIgYmVlblxuICAgKiB3cml0dGVuLCB0aGVuIHplcm8gdGhvc2UgYnl0ZXMgaW4gb3JkZXIgdG8gYXZvaWQgbWVtb3J5IGNoZWNrIHJlcG9ydHMgb2ZcbiAgICogdGhlIHVzZSBvZiB1bmluaXRpYWxpemVkIChvciB1bmluaXRpYWxpc2VkIGFzIEp1bGlhbiB3cml0ZXMpIGJ5dGVzIGJ5XG4gICAqIHRoZSBsb25nZXN0IG1hdGNoIHJvdXRpbmVzLiAgVXBkYXRlIHRoZSBoaWdoIHdhdGVyIG1hcmsgZm9yIHRoZSBuZXh0XG4gICAqIHRpbWUgdGhyb3VnaCBoZXJlLiAgV0lOX0lOSVQgaXMgc2V0IHRvIE1BWF9NQVRDSCBzaW5jZSB0aGUgbG9uZ2VzdCBtYXRjaFxuICAgKiByb3V0aW5lcyBhbGxvdyBzY2FubmluZyB0byBzdHJzdGFydCArIE1BWF9NQVRDSCwgaWdub3JpbmcgbG9va2FoZWFkLlxuICAgKi9cbi8vICBpZiAocy5oaWdoX3dhdGVyIDwgcy53aW5kb3dfc2l6ZSkge1xuLy8gICAgY29uc3QgY3VyciA9IHMuc3Ryc3RhcnQgKyBzLmxvb2thaGVhZDtcbi8vICAgIGxldCBpbml0ID0gMDtcbi8vXG4vLyAgICBpZiAocy5oaWdoX3dhdGVyIDwgY3Vycikge1xuLy8gICAgICAvKiBQcmV2aW91cyBoaWdoIHdhdGVyIG1hcmsgYmVsb3cgY3VycmVudCBkYXRhIC0tIHplcm8gV0lOX0lOSVRcbi8vICAgICAgICogYnl0ZXMgb3IgdXAgdG8gZW5kIG9mIHdpbmRvdywgd2hpY2hldmVyIGlzIGxlc3MuXG4vLyAgICAgICAqL1xuLy8gICAgICBpbml0ID0gcy53aW5kb3dfc2l6ZSAtIGN1cnI7XG4vLyAgICAgIGlmIChpbml0ID4gV0lOX0lOSVQpXG4vLyAgICAgICAgaW5pdCA9IFdJTl9JTklUO1xuLy8gICAgICB6bWVtemVybyhzLT53aW5kb3cgKyBjdXJyLCAodW5zaWduZWQpaW5pdCk7XG4vLyAgICAgIHMtPmhpZ2hfd2F0ZXIgPSBjdXJyICsgaW5pdDtcbi8vICAgIH1cbi8vICAgIGVsc2UgaWYgKHMtPmhpZ2hfd2F0ZXIgPCAodWxnKWN1cnIgKyBXSU5fSU5JVCkge1xuLy8gICAgICAvKiBIaWdoIHdhdGVyIG1hcmsgYXQgb3IgYWJvdmUgY3VycmVudCBkYXRhLCBidXQgYmVsb3cgY3VycmVudCBkYXRhXG4vLyAgICAgICAqIHBsdXMgV0lOX0lOSVQgLS0gemVybyBvdXQgdG8gY3VycmVudCBkYXRhIHBsdXMgV0lOX0lOSVQsIG9yIHVwXG4vLyAgICAgICAqIHRvIGVuZCBvZiB3aW5kb3csIHdoaWNoZXZlciBpcyBsZXNzLlxuLy8gICAgICAgKi9cbi8vICAgICAgaW5pdCA9ICh1bGcpY3VyciArIFdJTl9JTklUIC0gcy0+aGlnaF93YXRlcjtcbi8vICAgICAgaWYgKGluaXQgPiBzLT53aW5kb3dfc2l6ZSAtIHMtPmhpZ2hfd2F0ZXIpXG4vLyAgICAgICAgaW5pdCA9IHMtPndpbmRvd19zaXplIC0gcy0+aGlnaF93YXRlcjtcbi8vICAgICAgem1lbXplcm8ocy0+d2luZG93ICsgcy0+aGlnaF93YXRlciwgKHVuc2lnbmVkKWluaXQpO1xuLy8gICAgICBzLT5oaWdoX3dhdGVyICs9IGluaXQ7XG4vLyAgICB9XG4vLyAgfVxuLy9cbi8vICBBc3NlcnQoKHVsZylzLT5zdHJzdGFydCA8PSBzLT53aW5kb3dfc2l6ZSAtIE1JTl9MT09LQUhFQUQsXG4vLyAgICBcIm5vdCBlbm91Z2ggcm9vbSBmb3Igc2VhcmNoXCIpO1xufTtcblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBDb3B5IHdpdGhvdXQgY29tcHJlc3Npb24gYXMgbXVjaCBhcyBwb3NzaWJsZSBmcm9tIHRoZSBpbnB1dCBzdHJlYW0sIHJldHVyblxuICogdGhlIGN1cnJlbnQgYmxvY2sgc3RhdGUuXG4gKlxuICogSW4gY2FzZSBkZWZsYXRlUGFyYW1zKCkgaXMgdXNlZCB0byBsYXRlciBzd2l0Y2ggdG8gYSBub24temVybyBjb21wcmVzc2lvblxuICogbGV2ZWwsIHMtPm1hdGNoZXMgKG90aGVyd2lzZSB1bnVzZWQgd2hlbiBzdG9yaW5nKSBrZWVwcyB0cmFjayBvZiB0aGUgbnVtYmVyXG4gKiBvZiBoYXNoIHRhYmxlIHNsaWRlcyB0byBwZXJmb3JtLiBJZiBzLT5tYXRjaGVzIGlzIDEsIHRoZW4gb25lIGhhc2ggdGFibGVcbiAqIHNsaWRlIHdpbGwgYmUgZG9uZSB3aGVuIHN3aXRjaGluZy4gSWYgcy0+bWF0Y2hlcyBpcyAyLCB0aGUgbWF4aW11bSB2YWx1ZVxuICogYWxsb3dlZCBoZXJlLCB0aGVuIHRoZSBoYXNoIHRhYmxlIHdpbGwgYmUgY2xlYXJlZCwgc2luY2UgdHdvIG9yIG1vcmUgc2xpZGVzXG4gKiBpcyB0aGUgc2FtZSBhcyBhIGNsZWFyLlxuICpcbiAqIGRlZmxhdGVfc3RvcmVkKCkgaXMgd3JpdHRlbiB0byBtaW5pbWl6ZSB0aGUgbnVtYmVyIG9mIHRpbWVzIGFuIGlucHV0IGJ5dGUgaXNcbiAqIGNvcGllZC4gSXQgaXMgbW9zdCBlZmZpY2llbnQgd2l0aCBsYXJnZSBpbnB1dCBhbmQgb3V0cHV0IGJ1ZmZlcnMsIHdoaWNoXG4gKiBtYXhpbWl6ZXMgdGhlIG9wcG9ydHVuaXRlcyB0byBoYXZlIGEgc2luZ2xlIGNvcHkgZnJvbSBuZXh0X2luIHRvIG5leHRfb3V0LlxuICovXG5jb25zdCBkZWZsYXRlX3N0b3JlZCA9IChzLCBmbHVzaCkgPT4ge1xuXG4gIC8qIFNtYWxsZXN0IHdvcnRoeSBibG9jayBzaXplIHdoZW4gbm90IGZsdXNoaW5nIG9yIGZpbmlzaGluZy4gQnkgZGVmYXVsdFxuICAgKiB0aGlzIGlzIDMySy4gVGhpcyBjYW4gYmUgYXMgc21hbGwgYXMgNTA3IGJ5dGVzIGZvciBtZW1MZXZlbCA9PSAxLiBGb3JcbiAgICogbGFyZ2UgaW5wdXQgYW5kIG91dHB1dCBidWZmZXJzLCB0aGUgc3RvcmVkIGJsb2NrIHNpemUgd2lsbCBiZSBsYXJnZXIuXG4gICAqL1xuICBsZXQgbWluX2Jsb2NrID0gcy5wZW5kaW5nX2J1Zl9zaXplIC0gNSA+IHMud19zaXplID8gcy53X3NpemUgOiBzLnBlbmRpbmdfYnVmX3NpemUgLSA1O1xuXG4gIC8qIENvcHkgYXMgbWFueSBtaW5fYmxvY2sgb3IgbGFyZ2VyIHN0b3JlZCBibG9ja3MgZGlyZWN0bHkgdG8gbmV4dF9vdXQgYXNcbiAgICogcG9zc2libGUuIElmIGZsdXNoaW5nLCBjb3B5IHRoZSByZW1haW5pbmcgYXZhaWxhYmxlIGlucHV0IHRvIG5leHRfb3V0IGFzXG4gICAqIHN0b3JlZCBibG9ja3MsIGlmIHRoZXJlIGlzIGVub3VnaCBzcGFjZS5cbiAgICovXG4gIGxldCBsZW4sIGxlZnQsIGhhdmUsIGxhc3QgPSAwO1xuICBsZXQgdXNlZCA9IHMuc3RybS5hdmFpbF9pbjtcbiAgZG8ge1xuICAgIC8qIFNldCBsZW4gdG8gdGhlIG1heGltdW0gc2l6ZSBibG9jayB0aGF0IHdlIGNhbiBjb3B5IGRpcmVjdGx5IHdpdGggdGhlXG4gICAgICogYXZhaWxhYmxlIGlucHV0IGRhdGEgYW5kIG91dHB1dCBzcGFjZS4gU2V0IGxlZnQgdG8gaG93IG11Y2ggb2YgdGhhdFxuICAgICAqIHdvdWxkIGJlIGNvcGllZCBmcm9tIHdoYXQncyBsZWZ0IGluIHRoZSB3aW5kb3cuXG4gICAgICovXG4gICAgbGVuID0gNjU1MzUvKiBNQVhfU1RPUkVEICovOyAgICAgLyogbWF4aW11bSBkZWZsYXRlIHN0b3JlZCBibG9jayBsZW5ndGggKi9cbiAgICBoYXZlID0gKHMuYmlfdmFsaWQgKyA0MikgPj4gMzsgICAgIC8qIG51bWJlciBvZiBoZWFkZXIgYnl0ZXMgKi9cbiAgICBpZiAocy5zdHJtLmF2YWlsX291dCA8IGhhdmUpIHsgICAgICAgICAvKiBuZWVkIHJvb20gZm9yIGhlYWRlciAqL1xuICAgICAgYnJlYWs7XG4gICAgfVxuICAgICAgLyogbWF4aW11bSBzdG9yZWQgYmxvY2sgbGVuZ3RoIHRoYXQgd2lsbCBmaXQgaW4gYXZhaWxfb3V0OiAqL1xuICAgIGhhdmUgPSBzLnN0cm0uYXZhaWxfb3V0IC0gaGF2ZTtcbiAgICBsZWZ0ID0gcy5zdHJzdGFydCAtIHMuYmxvY2tfc3RhcnQ7ICAvKiBieXRlcyBsZWZ0IGluIHdpbmRvdyAqL1xuICAgIGlmIChsZW4gPiBsZWZ0ICsgcy5zdHJtLmF2YWlsX2luKSB7XG4gICAgICBsZW4gPSBsZWZ0ICsgcy5zdHJtLmF2YWlsX2luOyAgIC8qIGxpbWl0IGxlbiB0byB0aGUgaW5wdXQgKi9cbiAgICB9XG4gICAgaWYgKGxlbiA+IGhhdmUpIHtcbiAgICAgIGxlbiA9IGhhdmU7ICAgICAgICAgICAgIC8qIGxpbWl0IGxlbiB0byB0aGUgb3V0cHV0ICovXG4gICAgfVxuXG4gICAgLyogSWYgdGhlIHN0b3JlZCBibG9jayB3b3VsZCBiZSBsZXNzIHRoYW4gbWluX2Jsb2NrIGluIGxlbmd0aCwgb3IgaWZcbiAgICAgKiB1bmFibGUgdG8gY29weSBhbGwgb2YgdGhlIGF2YWlsYWJsZSBpbnB1dCB3aGVuIGZsdXNoaW5nLCB0aGVuIHRyeVxuICAgICAqIGNvcHlpbmcgdG8gdGhlIHdpbmRvdyBhbmQgdGhlIHBlbmRpbmcgYnVmZmVyIGluc3RlYWQuIEFsc28gZG9uJ3RcbiAgICAgKiB3cml0ZSBhbiBlbXB0eSBibG9jayB3aGVuIGZsdXNoaW5nIC0tIGRlZmxhdGUoKSBkb2VzIHRoYXQuXG4gICAgICovXG4gICAgaWYgKGxlbiA8IG1pbl9ibG9jayAmJiAoKGxlbiA9PT0gMCAmJiBmbHVzaCAhPT0gWl9GSU5JU0gkMykgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZsdXNoID09PSBaX05PX0ZMVVNIJDIgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgIGxlbiAhPT0gbGVmdCArIHMuc3RybS5hdmFpbF9pbikpIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIC8qIE1ha2UgYSBkdW1teSBzdG9yZWQgYmxvY2sgaW4gcGVuZGluZyB0byBnZXQgdGhlIGhlYWRlciBieXRlcyxcbiAgICAgKiBpbmNsdWRpbmcgYW55IHBlbmRpbmcgYml0cy4gVGhpcyBhbHNvIHVwZGF0ZXMgdGhlIGRlYnVnZ2luZyBjb3VudHMuXG4gICAgICovXG4gICAgbGFzdCA9IGZsdXNoID09PSBaX0ZJTklTSCQzICYmIGxlbiA9PT0gbGVmdCArIHMuc3RybS5hdmFpbF9pbiA/IDEgOiAwO1xuICAgIF90cl9zdG9yZWRfYmxvY2socywgMCwgMCwgbGFzdCk7XG5cbiAgICAvKiBSZXBsYWNlIHRoZSBsZW5ndGhzIGluIHRoZSBkdW1teSBzdG9yZWQgYmxvY2sgd2l0aCBsZW4uICovXG4gICAgcy5wZW5kaW5nX2J1ZltzLnBlbmRpbmcgLSA0XSA9IGxlbjtcbiAgICBzLnBlbmRpbmdfYnVmW3MucGVuZGluZyAtIDNdID0gbGVuID4+IDg7XG4gICAgcy5wZW5kaW5nX2J1ZltzLnBlbmRpbmcgLSAyXSA9IH5sZW47XG4gICAgcy5wZW5kaW5nX2J1ZltzLnBlbmRpbmcgLSAxXSA9IH5sZW4gPj4gODtcblxuICAgIC8qIFdyaXRlIHRoZSBzdG9yZWQgYmxvY2sgaGVhZGVyIGJ5dGVzLiAqL1xuICAgIGZsdXNoX3BlbmRpbmcocy5zdHJtKTtcblxuLy8jaWZkZWYgWkxJQl9ERUJVR1xuLy8gICAgLyogVXBkYXRlIGRlYnVnZ2luZyBjb3VudHMgZm9yIHRoZSBkYXRhIGFib3V0IHRvIGJlIGNvcGllZC4gKi9cbi8vICAgIHMtPmNvbXByZXNzZWRfbGVuICs9IGxlbiA8PCAzO1xuLy8gICAgcy0+Yml0c19zZW50ICs9IGxlbiA8PCAzO1xuLy8jZW5kaWZcblxuICAgIC8qIENvcHkgdW5jb21wcmVzc2VkIGJ5dGVzIGZyb20gdGhlIHdpbmRvdyB0byBuZXh0X291dC4gKi9cbiAgICBpZiAobGVmdCkge1xuICAgICAgaWYgKGxlZnQgPiBsZW4pIHtcbiAgICAgICAgbGVmdCA9IGxlbjtcbiAgICAgIH1cbiAgICAgIC8vem1lbWNweShzLT5zdHJtLT5uZXh0X291dCwgcy0+d2luZG93ICsgcy0+YmxvY2tfc3RhcnQsIGxlZnQpO1xuICAgICAgcy5zdHJtLm91dHB1dC5zZXQocy53aW5kb3cuc3ViYXJyYXkocy5ibG9ja19zdGFydCwgcy5ibG9ja19zdGFydCArIGxlZnQpLCBzLnN0cm0ubmV4dF9vdXQpO1xuICAgICAgcy5zdHJtLm5leHRfb3V0ICs9IGxlZnQ7XG4gICAgICBzLnN0cm0uYXZhaWxfb3V0IC09IGxlZnQ7XG4gICAgICBzLnN0cm0udG90YWxfb3V0ICs9IGxlZnQ7XG4gICAgICBzLmJsb2NrX3N0YXJ0ICs9IGxlZnQ7XG4gICAgICBsZW4gLT0gbGVmdDtcbiAgICB9XG5cbiAgICAvKiBDb3B5IHVuY29tcHJlc3NlZCBieXRlcyBkaXJlY3RseSBmcm9tIG5leHRfaW4gdG8gbmV4dF9vdXQsIHVwZGF0aW5nXG4gICAgICogdGhlIGNoZWNrIHZhbHVlLlxuICAgICAqL1xuICAgIGlmIChsZW4pIHtcbiAgICAgIHJlYWRfYnVmKHMuc3RybSwgcy5zdHJtLm91dHB1dCwgcy5zdHJtLm5leHRfb3V0LCBsZW4pO1xuICAgICAgcy5zdHJtLm5leHRfb3V0ICs9IGxlbjtcbiAgICAgIHMuc3RybS5hdmFpbF9vdXQgLT0gbGVuO1xuICAgICAgcy5zdHJtLnRvdGFsX291dCArPSBsZW47XG4gICAgfVxuICB9IHdoaWxlIChsYXN0ID09PSAwKTtcblxuICAvKiBVcGRhdGUgdGhlIHNsaWRpbmcgd2luZG93IHdpdGggdGhlIGxhc3Qgcy0+d19zaXplIGJ5dGVzIG9mIHRoZSBjb3BpZWRcbiAgICogZGF0YSwgb3IgYXBwZW5kIGFsbCBvZiB0aGUgY29waWVkIGRhdGEgdG8gdGhlIGV4aXN0aW5nIHdpbmRvdyBpZiBsZXNzXG4gICAqIHRoYW4gcy0+d19zaXplIGJ5dGVzIHdlcmUgY29waWVkLiBBbHNvIHVwZGF0ZSB0aGUgbnVtYmVyIG9mIGJ5dGVzIHRvXG4gICAqIGluc2VydCBpbiB0aGUgaGFzaCB0YWJsZXMsIGluIHRoZSBldmVudCB0aGF0IGRlZmxhdGVQYXJhbXMoKSBzd2l0Y2hlcyB0b1xuICAgKiBhIG5vbi16ZXJvIGNvbXByZXNzaW9uIGxldmVsLlxuICAgKi9cbiAgdXNlZCAtPSBzLnN0cm0uYXZhaWxfaW47ICAgIC8qIG51bWJlciBvZiBpbnB1dCBieXRlcyBkaXJlY3RseSBjb3BpZWQgKi9cbiAgaWYgKHVzZWQpIHtcbiAgICAvKiBJZiBhbnkgaW5wdXQgd2FzIHVzZWQsIHRoZW4gbm8gdW51c2VkIGlucHV0IHJlbWFpbnMgaW4gdGhlIHdpbmRvdyxcbiAgICAgKiB0aGVyZWZvcmUgcy0+YmxvY2tfc3RhcnQgPT0gcy0+c3Ryc3RhcnQuXG4gICAgICovXG4gICAgaWYgKHVzZWQgPj0gcy53X3NpemUpIHsgIC8qIHN1cHBsYW50IHRoZSBwcmV2aW91cyBoaXN0b3J5ICovXG4gICAgICBzLm1hdGNoZXMgPSAyOyAgICAgLyogY2xlYXIgaGFzaCAqL1xuICAgICAgLy96bWVtY3B5KHMtPndpbmRvdywgcy0+c3RybS0+bmV4dF9pbiAtIHMtPndfc2l6ZSwgcy0+d19zaXplKTtcbiAgICAgIHMud2luZG93LnNldChzLnN0cm0uaW5wdXQuc3ViYXJyYXkocy5zdHJtLm5leHRfaW4gLSBzLndfc2l6ZSwgcy5zdHJtLm5leHRfaW4pLCAwKTtcbiAgICAgIHMuc3Ryc3RhcnQgPSBzLndfc2l6ZTtcbiAgICAgIHMuaW5zZXJ0ID0gcy5zdHJzdGFydDtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBpZiAocy53aW5kb3dfc2l6ZSAtIHMuc3Ryc3RhcnQgPD0gdXNlZCkge1xuICAgICAgICAvKiBTbGlkZSB0aGUgd2luZG93IGRvd24uICovXG4gICAgICAgIHMuc3Ryc3RhcnQgLT0gcy53X3NpemU7XG4gICAgICAgIC8vem1lbWNweShzLT53aW5kb3csIHMtPndpbmRvdyArIHMtPndfc2l6ZSwgcy0+c3Ryc3RhcnQpO1xuICAgICAgICBzLndpbmRvdy5zZXQocy53aW5kb3cuc3ViYXJyYXkocy53X3NpemUsIHMud19zaXplICsgcy5zdHJzdGFydCksIDApO1xuICAgICAgICBpZiAocy5tYXRjaGVzIDwgMikge1xuICAgICAgICAgIHMubWF0Y2hlcysrOyAgIC8qIGFkZCBhIHBlbmRpbmcgc2xpZGVfaGFzaCgpICovXG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMuaW5zZXJ0ID4gcy5zdHJzdGFydCkge1xuICAgICAgICAgIHMuaW5zZXJ0ID0gcy5zdHJzdGFydDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy96bWVtY3B5KHMtPndpbmRvdyArIHMtPnN0cnN0YXJ0LCBzLT5zdHJtLT5uZXh0X2luIC0gdXNlZCwgdXNlZCk7XG4gICAgICBzLndpbmRvdy5zZXQocy5zdHJtLmlucHV0LnN1YmFycmF5KHMuc3RybS5uZXh0X2luIC0gdXNlZCwgcy5zdHJtLm5leHRfaW4pLCBzLnN0cnN0YXJ0KTtcbiAgICAgIHMuc3Ryc3RhcnQgKz0gdXNlZDtcbiAgICAgIHMuaW5zZXJ0ICs9IHVzZWQgPiBzLndfc2l6ZSAtIHMuaW5zZXJ0ID8gcy53X3NpemUgLSBzLmluc2VydCA6IHVzZWQ7XG4gICAgfVxuICAgIHMuYmxvY2tfc3RhcnQgPSBzLnN0cnN0YXJ0O1xuICB9XG4gIGlmIChzLmhpZ2hfd2F0ZXIgPCBzLnN0cnN0YXJ0KSB7XG4gICAgcy5oaWdoX3dhdGVyID0gcy5zdHJzdGFydDtcbiAgfVxuXG4gIC8qIElmIHRoZSBsYXN0IGJsb2NrIHdhcyB3cml0dGVuIHRvIG5leHRfb3V0LCB0aGVuIGRvbmUuICovXG4gIGlmIChsYXN0KSB7XG4gICAgcmV0dXJuIEJTX0ZJTklTSF9ET05FO1xuICB9XG5cbiAgLyogSWYgZmx1c2hpbmcgYW5kIGFsbCBpbnB1dCBoYXMgYmVlbiBjb25zdW1lZCwgdGhlbiBkb25lLiAqL1xuICBpZiAoZmx1c2ggIT09IFpfTk9fRkxVU0gkMiAmJiBmbHVzaCAhPT0gWl9GSU5JU0gkMyAmJlxuICAgIHMuc3RybS5hdmFpbF9pbiA9PT0gMCAmJiBzLnN0cnN0YXJ0ID09PSBzLmJsb2NrX3N0YXJ0KSB7XG4gICAgcmV0dXJuIEJTX0JMT0NLX0RPTkU7XG4gIH1cblxuICAvKiBGaWxsIHRoZSB3aW5kb3cgd2l0aCBhbnkgcmVtYWluaW5nIGlucHV0LiAqL1xuICBoYXZlID0gcy53aW5kb3dfc2l6ZSAtIHMuc3Ryc3RhcnQ7XG4gIGlmIChzLnN0cm0uYXZhaWxfaW4gPiBoYXZlICYmIHMuYmxvY2tfc3RhcnQgPj0gcy53X3NpemUpIHtcbiAgICAvKiBTbGlkZSB0aGUgd2luZG93IGRvd24uICovXG4gICAgcy5ibG9ja19zdGFydCAtPSBzLndfc2l6ZTtcbiAgICBzLnN0cnN0YXJ0IC09IHMud19zaXplO1xuICAgIC8vem1lbWNweShzLT53aW5kb3csIHMtPndpbmRvdyArIHMtPndfc2l6ZSwgcy0+c3Ryc3RhcnQpO1xuICAgIHMud2luZG93LnNldChzLndpbmRvdy5zdWJhcnJheShzLndfc2l6ZSwgcy53X3NpemUgKyBzLnN0cnN0YXJ0KSwgMCk7XG4gICAgaWYgKHMubWF0Y2hlcyA8IDIpIHtcbiAgICAgIHMubWF0Y2hlcysrOyAgICAgICAvKiBhZGQgYSBwZW5kaW5nIHNsaWRlX2hhc2goKSAqL1xuICAgIH1cbiAgICBoYXZlICs9IHMud19zaXplOyAgICAgIC8qIG1vcmUgc3BhY2Ugbm93ICovXG4gICAgaWYgKHMuaW5zZXJ0ID4gcy5zdHJzdGFydCkge1xuICAgICAgcy5pbnNlcnQgPSBzLnN0cnN0YXJ0O1xuICAgIH1cbiAgfVxuICBpZiAoaGF2ZSA+IHMuc3RybS5hdmFpbF9pbikge1xuICAgIGhhdmUgPSBzLnN0cm0uYXZhaWxfaW47XG4gIH1cbiAgaWYgKGhhdmUpIHtcbiAgICByZWFkX2J1ZihzLnN0cm0sIHMud2luZG93LCBzLnN0cnN0YXJ0LCBoYXZlKTtcbiAgICBzLnN0cnN0YXJ0ICs9IGhhdmU7XG4gICAgcy5pbnNlcnQgKz0gaGF2ZSA+IHMud19zaXplIC0gcy5pbnNlcnQgPyBzLndfc2l6ZSAtIHMuaW5zZXJ0IDogaGF2ZTtcbiAgfVxuICBpZiAocy5oaWdoX3dhdGVyIDwgcy5zdHJzdGFydCkge1xuICAgIHMuaGlnaF93YXRlciA9IHMuc3Ryc3RhcnQ7XG4gIH1cblxuICAvKiBUaGVyZSB3YXMgbm90IGVub3VnaCBhdmFpbF9vdXQgdG8gd3JpdGUgYSBjb21wbGV0ZSB3b3J0aHkgb3IgZmx1c2hlZFxuICAgKiBzdG9yZWQgYmxvY2sgdG8gbmV4dF9vdXQuIFdyaXRlIGEgc3RvcmVkIGJsb2NrIHRvIHBlbmRpbmcgaW5zdGVhZCwgaWYgd2VcbiAgICogaGF2ZSBlbm91Z2ggaW5wdXQgZm9yIGEgd29ydGh5IGJsb2NrLCBvciBpZiBmbHVzaGluZyBhbmQgdGhlcmUgaXMgZW5vdWdoXG4gICAqIHJvb20gZm9yIHRoZSByZW1haW5pbmcgaW5wdXQgYXMgYSBzdG9yZWQgYmxvY2sgaW4gdGhlIHBlbmRpbmcgYnVmZmVyLlxuICAgKi9cbiAgaGF2ZSA9IChzLmJpX3ZhbGlkICsgNDIpID4+IDM7ICAgICAvKiBudW1iZXIgb2YgaGVhZGVyIGJ5dGVzICovXG4gICAgLyogbWF4aW11bSBzdG9yZWQgYmxvY2sgbGVuZ3RoIHRoYXQgd2lsbCBmaXQgaW4gcGVuZGluZzogKi9cbiAgaGF2ZSA9IHMucGVuZGluZ19idWZfc2l6ZSAtIGhhdmUgPiA2NTUzNS8qIE1BWF9TVE9SRUQgKi8gPyA2NTUzNS8qIE1BWF9TVE9SRUQgKi8gOiBzLnBlbmRpbmdfYnVmX3NpemUgLSBoYXZlO1xuICBtaW5fYmxvY2sgPSBoYXZlID4gcy53X3NpemUgPyBzLndfc2l6ZSA6IGhhdmU7XG4gIGxlZnQgPSBzLnN0cnN0YXJ0IC0gcy5ibG9ja19zdGFydDtcbiAgaWYgKGxlZnQgPj0gbWluX2Jsb2NrIHx8XG4gICAgICgobGVmdCB8fCBmbHVzaCA9PT0gWl9GSU5JU0gkMykgJiYgZmx1c2ggIT09IFpfTk9fRkxVU0gkMiAmJlxuICAgICBzLnN0cm0uYXZhaWxfaW4gPT09IDAgJiYgbGVmdCA8PSBoYXZlKSkge1xuICAgIGxlbiA9IGxlZnQgPiBoYXZlID8gaGF2ZSA6IGxlZnQ7XG4gICAgbGFzdCA9IGZsdXNoID09PSBaX0ZJTklTSCQzICYmIHMuc3RybS5hdmFpbF9pbiA9PT0gMCAmJlxuICAgICAgICAgbGVuID09PSBsZWZ0ID8gMSA6IDA7XG4gICAgX3RyX3N0b3JlZF9ibG9jayhzLCBzLmJsb2NrX3N0YXJ0LCBsZW4sIGxhc3QpO1xuICAgIHMuYmxvY2tfc3RhcnQgKz0gbGVuO1xuICAgIGZsdXNoX3BlbmRpbmcocy5zdHJtKTtcbiAgfVxuXG4gIC8qIFdlJ3ZlIGRvbmUgYWxsIHdlIGNhbiB3aXRoIHRoZSBhdmFpbGFibGUgaW5wdXQgYW5kIG91dHB1dC4gKi9cbiAgcmV0dXJuIGxhc3QgPyBCU19GSU5JU0hfU1RBUlRFRCA6IEJTX05FRURfTU9SRTtcbn07XG5cblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBDb21wcmVzcyBhcyBtdWNoIGFzIHBvc3NpYmxlIGZyb20gdGhlIGlucHV0IHN0cmVhbSwgcmV0dXJuIHRoZSBjdXJyZW50XG4gKiBibG9jayBzdGF0ZS5cbiAqIFRoaXMgZnVuY3Rpb24gZG9lcyBub3QgcGVyZm9ybSBsYXp5IGV2YWx1YXRpb24gb2YgbWF0Y2hlcyBhbmQgaW5zZXJ0c1xuICogbmV3IHN0cmluZ3MgaW4gdGhlIGRpY3Rpb25hcnkgb25seSBmb3IgdW5tYXRjaGVkIHN0cmluZ3Mgb3IgZm9yIHNob3J0XG4gKiBtYXRjaGVzLiBJdCBpcyB1c2VkIG9ubHkgZm9yIHRoZSBmYXN0IGNvbXByZXNzaW9uIG9wdGlvbnMuXG4gKi9cbmNvbnN0IGRlZmxhdGVfZmFzdCA9IChzLCBmbHVzaCkgPT4ge1xuXG4gIGxldCBoYXNoX2hlYWQ7ICAgICAgICAvKiBoZWFkIG9mIHRoZSBoYXNoIGNoYWluICovXG4gIGxldCBiZmx1c2g7ICAgICAgICAgICAvKiBzZXQgaWYgY3VycmVudCBibG9jayBtdXN0IGJlIGZsdXNoZWQgKi9cblxuICBmb3IgKDs7KSB7XG4gICAgLyogTWFrZSBzdXJlIHRoYXQgd2UgYWx3YXlzIGhhdmUgZW5vdWdoIGxvb2thaGVhZCwgZXhjZXB0XG4gICAgICogYXQgdGhlIGVuZCBvZiB0aGUgaW5wdXQgZmlsZS4gV2UgbmVlZCBNQVhfTUFUQ0ggYnl0ZXNcbiAgICAgKiBmb3IgdGhlIG5leHQgbWF0Y2gsIHBsdXMgTUlOX01BVENIIGJ5dGVzIHRvIGluc2VydCB0aGVcbiAgICAgKiBzdHJpbmcgZm9sbG93aW5nIHRoZSBuZXh0IG1hdGNoLlxuICAgICAqL1xuICAgIGlmIChzLmxvb2thaGVhZCA8IE1JTl9MT09LQUhFQUQpIHtcbiAgICAgIGZpbGxfd2luZG93KHMpO1xuICAgICAgaWYgKHMubG9va2FoZWFkIDwgTUlOX0xPT0tBSEVBRCAmJiBmbHVzaCA9PT0gWl9OT19GTFVTSCQyKSB7XG4gICAgICAgIHJldHVybiBCU19ORUVEX01PUkU7XG4gICAgICB9XG4gICAgICBpZiAocy5sb29rYWhlYWQgPT09IDApIHtcbiAgICAgICAgYnJlYWs7IC8qIGZsdXNoIHRoZSBjdXJyZW50IGJsb2NrICovXG4gICAgICB9XG4gICAgfVxuXG4gICAgLyogSW5zZXJ0IHRoZSBzdHJpbmcgd2luZG93W3N0cnN0YXJ0IC4uIHN0cnN0YXJ0KzJdIGluIHRoZVxuICAgICAqIGRpY3Rpb25hcnksIGFuZCBzZXQgaGFzaF9oZWFkIHRvIHRoZSBoZWFkIG9mIHRoZSBoYXNoIGNoYWluOlxuICAgICAqL1xuICAgIGhhc2hfaGVhZCA9IDAvKk5JTCovO1xuICAgIGlmIChzLmxvb2thaGVhZCA+PSBNSU5fTUFUQ0gpIHtcbiAgICAgIC8qKiogSU5TRVJUX1NUUklORyhzLCBzLnN0cnN0YXJ0LCBoYXNoX2hlYWQpOyAqKiovXG4gICAgICBzLmluc19oID0gSEFTSChzLCBzLmluc19oLCBzLndpbmRvd1tzLnN0cnN0YXJ0ICsgTUlOX01BVENIIC0gMV0pO1xuICAgICAgaGFzaF9oZWFkID0gcy5wcmV2W3Muc3Ryc3RhcnQgJiBzLndfbWFza10gPSBzLmhlYWRbcy5pbnNfaF07XG4gICAgICBzLmhlYWRbcy5pbnNfaF0gPSBzLnN0cnN0YXJ0O1xuICAgICAgLyoqKi9cbiAgICB9XG5cbiAgICAvKiBGaW5kIHRoZSBsb25nZXN0IG1hdGNoLCBkaXNjYXJkaW5nIHRob3NlIDw9IHByZXZfbGVuZ3RoLlxuICAgICAqIEF0IHRoaXMgcG9pbnQgd2UgaGF2ZSBhbHdheXMgbWF0Y2hfbGVuZ3RoIDwgTUlOX01BVENIXG4gICAgICovXG4gICAgaWYgKGhhc2hfaGVhZCAhPT0gMC8qTklMKi8gJiYgKChzLnN0cnN0YXJ0IC0gaGFzaF9oZWFkKSA8PSAocy53X3NpemUgLSBNSU5fTE9PS0FIRUFEKSkpIHtcbiAgICAgIC8qIFRvIHNpbXBsaWZ5IHRoZSBjb2RlLCB3ZSBwcmV2ZW50IG1hdGNoZXMgd2l0aCB0aGUgc3RyaW5nXG4gICAgICAgKiBvZiB3aW5kb3cgaW5kZXggMCAoaW4gcGFydGljdWxhciB3ZSBoYXZlIHRvIGF2b2lkIGEgbWF0Y2hcbiAgICAgICAqIG9mIHRoZSBzdHJpbmcgd2l0aCBpdHNlbGYgYXQgdGhlIHN0YXJ0IG9mIHRoZSBpbnB1dCBmaWxlKS5cbiAgICAgICAqL1xuICAgICAgcy5tYXRjaF9sZW5ndGggPSBsb25nZXN0X21hdGNoKHMsIGhhc2hfaGVhZCk7XG4gICAgICAvKiBsb25nZXN0X21hdGNoKCkgc2V0cyBtYXRjaF9zdGFydCAqL1xuICAgIH1cbiAgICBpZiAocy5tYXRjaF9sZW5ndGggPj0gTUlOX01BVENIKSB7XG4gICAgICAvLyBjaGVja19tYXRjaChzLCBzLnN0cnN0YXJ0LCBzLm1hdGNoX3N0YXJ0LCBzLm1hdGNoX2xlbmd0aCk7IC8vIGZvciBkZWJ1ZyBvbmx5XG5cbiAgICAgIC8qKiogX3RyX3RhbGx5X2Rpc3Qocywgcy5zdHJzdGFydCAtIHMubWF0Y2hfc3RhcnQsXG4gICAgICAgICAgICAgICAgICAgICBzLm1hdGNoX2xlbmd0aCAtIE1JTl9NQVRDSCwgYmZsdXNoKTsgKioqL1xuICAgICAgYmZsdXNoID0gX3RyX3RhbGx5KHMsIHMuc3Ryc3RhcnQgLSBzLm1hdGNoX3N0YXJ0LCBzLm1hdGNoX2xlbmd0aCAtIE1JTl9NQVRDSCk7XG5cbiAgICAgIHMubG9va2FoZWFkIC09IHMubWF0Y2hfbGVuZ3RoO1xuXG4gICAgICAvKiBJbnNlcnQgbmV3IHN0cmluZ3MgaW4gdGhlIGhhc2ggdGFibGUgb25seSBpZiB0aGUgbWF0Y2ggbGVuZ3RoXG4gICAgICAgKiBpcyBub3QgdG9vIGxhcmdlLiBUaGlzIHNhdmVzIHRpbWUgYnV0IGRlZ3JhZGVzIGNvbXByZXNzaW9uLlxuICAgICAgICovXG4gICAgICBpZiAocy5tYXRjaF9sZW5ndGggPD0gcy5tYXhfbGF6eV9tYXRjaC8qbWF4X2luc2VydF9sZW5ndGgqLyAmJiBzLmxvb2thaGVhZCA+PSBNSU5fTUFUQ0gpIHtcbiAgICAgICAgcy5tYXRjaF9sZW5ndGgtLTsgLyogc3RyaW5nIGF0IHN0cnN0YXJ0IGFscmVhZHkgaW4gdGFibGUgKi9cbiAgICAgICAgZG8ge1xuICAgICAgICAgIHMuc3Ryc3RhcnQrKztcbiAgICAgICAgICAvKioqIElOU0VSVF9TVFJJTkcocywgcy5zdHJzdGFydCwgaGFzaF9oZWFkKTsgKioqL1xuICAgICAgICAgIHMuaW5zX2ggPSBIQVNIKHMsIHMuaW5zX2gsIHMud2luZG93W3Muc3Ryc3RhcnQgKyBNSU5fTUFUQ0ggLSAxXSk7XG4gICAgICAgICAgaGFzaF9oZWFkID0gcy5wcmV2W3Muc3Ryc3RhcnQgJiBzLndfbWFza10gPSBzLmhlYWRbcy5pbnNfaF07XG4gICAgICAgICAgcy5oZWFkW3MuaW5zX2hdID0gcy5zdHJzdGFydDtcbiAgICAgICAgICAvKioqL1xuICAgICAgICAgIC8qIHN0cnN0YXJ0IG5ldmVyIGV4Y2VlZHMgV1NJWkUtTUFYX01BVENILCBzbyB0aGVyZSBhcmVcbiAgICAgICAgICAgKiBhbHdheXMgTUlOX01BVENIIGJ5dGVzIGFoZWFkLlxuICAgICAgICAgICAqL1xuICAgICAgICB9IHdoaWxlICgtLXMubWF0Y2hfbGVuZ3RoICE9PSAwKTtcbiAgICAgICAgcy5zdHJzdGFydCsrO1xuICAgICAgfSBlbHNlXG4gICAgICB7XG4gICAgICAgIHMuc3Ryc3RhcnQgKz0gcy5tYXRjaF9sZW5ndGg7XG4gICAgICAgIHMubWF0Y2hfbGVuZ3RoID0gMDtcbiAgICAgICAgcy5pbnNfaCA9IHMud2luZG93W3Muc3Ryc3RhcnRdO1xuICAgICAgICAvKiBVUERBVEVfSEFTSChzLCBzLmluc19oLCBzLndpbmRvd1tzLnN0cnN0YXJ0KzFdKTsgKi9cbiAgICAgICAgcy5pbnNfaCA9IEhBU0gocywgcy5pbnNfaCwgcy53aW5kb3dbcy5zdHJzdGFydCArIDFdKTtcblxuLy8jaWYgTUlOX01BVENIICE9IDNcbi8vICAgICAgICAgICAgICAgIENhbGwgVVBEQVRFX0hBU0goKSBNSU5fTUFUQ0gtMyBtb3JlIHRpbWVzXG4vLyNlbmRpZlxuICAgICAgICAvKiBJZiBsb29rYWhlYWQgPCBNSU5fTUFUQ0gsIGluc19oIGlzIGdhcmJhZ2UsIGJ1dCBpdCBkb2VzIG5vdFxuICAgICAgICAgKiBtYXR0ZXIgc2luY2UgaXQgd2lsbCBiZSByZWNvbXB1dGVkIGF0IG5leHQgZGVmbGF0ZSBjYWxsLlxuICAgICAgICAgKi9cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLyogTm8gbWF0Y2gsIG91dHB1dCBhIGxpdGVyYWwgYnl0ZSAqL1xuICAgICAgLy9UcmFjZXZ2KChzdGRlcnIsXCIlY1wiLCBzLndpbmRvd1tzLnN0cnN0YXJ0XSkpO1xuICAgICAgLyoqKiBfdHJfdGFsbHlfbGl0KHMsIHMud2luZG93W3Muc3Ryc3RhcnRdLCBiZmx1c2gpOyAqKiovXG4gICAgICBiZmx1c2ggPSBfdHJfdGFsbHkocywgMCwgcy53aW5kb3dbcy5zdHJzdGFydF0pO1xuXG4gICAgICBzLmxvb2thaGVhZC0tO1xuICAgICAgcy5zdHJzdGFydCsrO1xuICAgIH1cbiAgICBpZiAoYmZsdXNoKSB7XG4gICAgICAvKioqIEZMVVNIX0JMT0NLKHMsIDApOyAqKiovXG4gICAgICBmbHVzaF9ibG9ja19vbmx5KHMsIGZhbHNlKTtcbiAgICAgIGlmIChzLnN0cm0uYXZhaWxfb3V0ID09PSAwKSB7XG4gICAgICAgIHJldHVybiBCU19ORUVEX01PUkU7XG4gICAgICB9XG4gICAgICAvKioqL1xuICAgIH1cbiAgfVxuICBzLmluc2VydCA9ICgocy5zdHJzdGFydCA8IChNSU5fTUFUQ0ggLSAxKSkgPyBzLnN0cnN0YXJ0IDogTUlOX01BVENIIC0gMSk7XG4gIGlmIChmbHVzaCA9PT0gWl9GSU5JU0gkMykge1xuICAgIC8qKiogRkxVU0hfQkxPQ0socywgMSk7ICoqKi9cbiAgICBmbHVzaF9ibG9ja19vbmx5KHMsIHRydWUpO1xuICAgIGlmIChzLnN0cm0uYXZhaWxfb3V0ID09PSAwKSB7XG4gICAgICByZXR1cm4gQlNfRklOSVNIX1NUQVJURUQ7XG4gICAgfVxuICAgIC8qKiovXG4gICAgcmV0dXJuIEJTX0ZJTklTSF9ET05FO1xuICB9XG4gIGlmIChzLnN5bV9uZXh0KSB7XG4gICAgLyoqKiBGTFVTSF9CTE9DSyhzLCAwKTsgKioqL1xuICAgIGZsdXNoX2Jsb2NrX29ubHkocywgZmFsc2UpO1xuICAgIGlmIChzLnN0cm0uYXZhaWxfb3V0ID09PSAwKSB7XG4gICAgICByZXR1cm4gQlNfTkVFRF9NT1JFO1xuICAgIH1cbiAgICAvKioqL1xuICB9XG4gIHJldHVybiBCU19CTE9DS19ET05FO1xufTtcblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBTYW1lIGFzIGFib3ZlLCBidXQgYWNoaWV2ZXMgYmV0dGVyIGNvbXByZXNzaW9uLiBXZSB1c2UgYSBsYXp5XG4gKiBldmFsdWF0aW9uIGZvciBtYXRjaGVzOiBhIG1hdGNoIGlzIGZpbmFsbHkgYWRvcHRlZCBvbmx5IGlmIHRoZXJlIGlzXG4gKiBubyBiZXR0ZXIgbWF0Y2ggYXQgdGhlIG5leHQgd2luZG93IHBvc2l0aW9uLlxuICovXG5jb25zdCBkZWZsYXRlX3Nsb3cgPSAocywgZmx1c2gpID0+IHtcblxuICBsZXQgaGFzaF9oZWFkOyAgICAgICAgICAvKiBoZWFkIG9mIGhhc2ggY2hhaW4gKi9cbiAgbGV0IGJmbHVzaDsgICAgICAgICAgICAgIC8qIHNldCBpZiBjdXJyZW50IGJsb2NrIG11c3QgYmUgZmx1c2hlZCAqL1xuXG4gIGxldCBtYXhfaW5zZXJ0O1xuXG4gIC8qIFByb2Nlc3MgdGhlIGlucHV0IGJsb2NrLiAqL1xuICBmb3IgKDs7KSB7XG4gICAgLyogTWFrZSBzdXJlIHRoYXQgd2UgYWx3YXlzIGhhdmUgZW5vdWdoIGxvb2thaGVhZCwgZXhjZXB0XG4gICAgICogYXQgdGhlIGVuZCBvZiB0aGUgaW5wdXQgZmlsZS4gV2UgbmVlZCBNQVhfTUFUQ0ggYnl0ZXNcbiAgICAgKiBmb3IgdGhlIG5leHQgbWF0Y2gsIHBsdXMgTUlOX01BVENIIGJ5dGVzIHRvIGluc2VydCB0aGVcbiAgICAgKiBzdHJpbmcgZm9sbG93aW5nIHRoZSBuZXh0IG1hdGNoLlxuICAgICAqL1xuICAgIGlmIChzLmxvb2thaGVhZCA8IE1JTl9MT09LQUhFQUQpIHtcbiAgICAgIGZpbGxfd2luZG93KHMpO1xuICAgICAgaWYgKHMubG9va2FoZWFkIDwgTUlOX0xPT0tBSEVBRCAmJiBmbHVzaCA9PT0gWl9OT19GTFVTSCQyKSB7XG4gICAgICAgIHJldHVybiBCU19ORUVEX01PUkU7XG4gICAgICB9XG4gICAgICBpZiAocy5sb29rYWhlYWQgPT09IDApIHsgYnJlYWs7IH0gLyogZmx1c2ggdGhlIGN1cnJlbnQgYmxvY2sgKi9cbiAgICB9XG5cbiAgICAvKiBJbnNlcnQgdGhlIHN0cmluZyB3aW5kb3dbc3Ryc3RhcnQgLi4gc3Ryc3RhcnQrMl0gaW4gdGhlXG4gICAgICogZGljdGlvbmFyeSwgYW5kIHNldCBoYXNoX2hlYWQgdG8gdGhlIGhlYWQgb2YgdGhlIGhhc2ggY2hhaW46XG4gICAgICovXG4gICAgaGFzaF9oZWFkID0gMC8qTklMKi87XG4gICAgaWYgKHMubG9va2FoZWFkID49IE1JTl9NQVRDSCkge1xuICAgICAgLyoqKiBJTlNFUlRfU1RSSU5HKHMsIHMuc3Ryc3RhcnQsIGhhc2hfaGVhZCk7ICoqKi9cbiAgICAgIHMuaW5zX2ggPSBIQVNIKHMsIHMuaW5zX2gsIHMud2luZG93W3Muc3Ryc3RhcnQgKyBNSU5fTUFUQ0ggLSAxXSk7XG4gICAgICBoYXNoX2hlYWQgPSBzLnByZXZbcy5zdHJzdGFydCAmIHMud19tYXNrXSA9IHMuaGVhZFtzLmluc19oXTtcbiAgICAgIHMuaGVhZFtzLmluc19oXSA9IHMuc3Ryc3RhcnQ7XG4gICAgICAvKioqL1xuICAgIH1cblxuICAgIC8qIEZpbmQgdGhlIGxvbmdlc3QgbWF0Y2gsIGRpc2NhcmRpbmcgdGhvc2UgPD0gcHJldl9sZW5ndGguXG4gICAgICovXG4gICAgcy5wcmV2X2xlbmd0aCA9IHMubWF0Y2hfbGVuZ3RoO1xuICAgIHMucHJldl9tYXRjaCA9IHMubWF0Y2hfc3RhcnQ7XG4gICAgcy5tYXRjaF9sZW5ndGggPSBNSU5fTUFUQ0ggLSAxO1xuXG4gICAgaWYgKGhhc2hfaGVhZCAhPT0gMC8qTklMKi8gJiYgcy5wcmV2X2xlbmd0aCA8IHMubWF4X2xhenlfbWF0Y2ggJiZcbiAgICAgICAgcy5zdHJzdGFydCAtIGhhc2hfaGVhZCA8PSAocy53X3NpemUgLSBNSU5fTE9PS0FIRUFEKS8qTUFYX0RJU1QocykqLykge1xuICAgICAgLyogVG8gc2ltcGxpZnkgdGhlIGNvZGUsIHdlIHByZXZlbnQgbWF0Y2hlcyB3aXRoIHRoZSBzdHJpbmdcbiAgICAgICAqIG9mIHdpbmRvdyBpbmRleCAwIChpbiBwYXJ0aWN1bGFyIHdlIGhhdmUgdG8gYXZvaWQgYSBtYXRjaFxuICAgICAgICogb2YgdGhlIHN0cmluZyB3aXRoIGl0c2VsZiBhdCB0aGUgc3RhcnQgb2YgdGhlIGlucHV0IGZpbGUpLlxuICAgICAgICovXG4gICAgICBzLm1hdGNoX2xlbmd0aCA9IGxvbmdlc3RfbWF0Y2gocywgaGFzaF9oZWFkKTtcbiAgICAgIC8qIGxvbmdlc3RfbWF0Y2goKSBzZXRzIG1hdGNoX3N0YXJ0ICovXG5cbiAgICAgIGlmIChzLm1hdGNoX2xlbmd0aCA8PSA1ICYmXG4gICAgICAgICAocy5zdHJhdGVneSA9PT0gWl9GSUxURVJFRCB8fCAocy5tYXRjaF9sZW5ndGggPT09IE1JTl9NQVRDSCAmJiBzLnN0cnN0YXJ0IC0gcy5tYXRjaF9zdGFydCA+IDQwOTYvKlRPT19GQVIqLykpKSB7XG5cbiAgICAgICAgLyogSWYgcHJldl9tYXRjaCBpcyBhbHNvIE1JTl9NQVRDSCwgbWF0Y2hfc3RhcnQgaXMgZ2FyYmFnZVxuICAgICAgICAgKiBidXQgd2Ugd2lsbCBpZ25vcmUgdGhlIGN1cnJlbnQgbWF0Y2ggYW55d2F5LlxuICAgICAgICAgKi9cbiAgICAgICAgcy5tYXRjaF9sZW5ndGggPSBNSU5fTUFUQ0ggLSAxO1xuICAgICAgfVxuICAgIH1cbiAgICAvKiBJZiB0aGVyZSB3YXMgYSBtYXRjaCBhdCB0aGUgcHJldmlvdXMgc3RlcCBhbmQgdGhlIGN1cnJlbnRcbiAgICAgKiBtYXRjaCBpcyBub3QgYmV0dGVyLCBvdXRwdXQgdGhlIHByZXZpb3VzIG1hdGNoOlxuICAgICAqL1xuICAgIGlmIChzLnByZXZfbGVuZ3RoID49IE1JTl9NQVRDSCAmJiBzLm1hdGNoX2xlbmd0aCA8PSBzLnByZXZfbGVuZ3RoKSB7XG4gICAgICBtYXhfaW5zZXJ0ID0gcy5zdHJzdGFydCArIHMubG9va2FoZWFkIC0gTUlOX01BVENIO1xuICAgICAgLyogRG8gbm90IGluc2VydCBzdHJpbmdzIGluIGhhc2ggdGFibGUgYmV5b25kIHRoaXMuICovXG5cbiAgICAgIC8vY2hlY2tfbWF0Y2gocywgcy5zdHJzdGFydC0xLCBzLnByZXZfbWF0Y2gsIHMucHJldl9sZW5ndGgpO1xuXG4gICAgICAvKioqX3RyX3RhbGx5X2Rpc3Qocywgcy5zdHJzdGFydCAtIDEgLSBzLnByZXZfbWF0Y2gsXG4gICAgICAgICAgICAgICAgICAgICBzLnByZXZfbGVuZ3RoIC0gTUlOX01BVENILCBiZmx1c2gpOyoqKi9cbiAgICAgIGJmbHVzaCA9IF90cl90YWxseShzLCBzLnN0cnN0YXJ0IC0gMSAtIHMucHJldl9tYXRjaCwgcy5wcmV2X2xlbmd0aCAtIE1JTl9NQVRDSCk7XG4gICAgICAvKiBJbnNlcnQgaW4gaGFzaCB0YWJsZSBhbGwgc3RyaW5ncyB1cCB0byB0aGUgZW5kIG9mIHRoZSBtYXRjaC5cbiAgICAgICAqIHN0cnN0YXJ0LTEgYW5kIHN0cnN0YXJ0IGFyZSBhbHJlYWR5IGluc2VydGVkLiBJZiB0aGVyZSBpcyBub3RcbiAgICAgICAqIGVub3VnaCBsb29rYWhlYWQsIHRoZSBsYXN0IHR3byBzdHJpbmdzIGFyZSBub3QgaW5zZXJ0ZWQgaW5cbiAgICAgICAqIHRoZSBoYXNoIHRhYmxlLlxuICAgICAgICovXG4gICAgICBzLmxvb2thaGVhZCAtPSBzLnByZXZfbGVuZ3RoIC0gMTtcbiAgICAgIHMucHJldl9sZW5ndGggLT0gMjtcbiAgICAgIGRvIHtcbiAgICAgICAgaWYgKCsrcy5zdHJzdGFydCA8PSBtYXhfaW5zZXJ0KSB7XG4gICAgICAgICAgLyoqKiBJTlNFUlRfU1RSSU5HKHMsIHMuc3Ryc3RhcnQsIGhhc2hfaGVhZCk7ICoqKi9cbiAgICAgICAgICBzLmluc19oID0gSEFTSChzLCBzLmluc19oLCBzLndpbmRvd1tzLnN0cnN0YXJ0ICsgTUlOX01BVENIIC0gMV0pO1xuICAgICAgICAgIGhhc2hfaGVhZCA9IHMucHJldltzLnN0cnN0YXJ0ICYgcy53X21hc2tdID0gcy5oZWFkW3MuaW5zX2hdO1xuICAgICAgICAgIHMuaGVhZFtzLmluc19oXSA9IHMuc3Ryc3RhcnQ7XG4gICAgICAgICAgLyoqKi9cbiAgICAgICAgfVxuICAgICAgfSB3aGlsZSAoLS1zLnByZXZfbGVuZ3RoICE9PSAwKTtcbiAgICAgIHMubWF0Y2hfYXZhaWxhYmxlID0gMDtcbiAgICAgIHMubWF0Y2hfbGVuZ3RoID0gTUlOX01BVENIIC0gMTtcbiAgICAgIHMuc3Ryc3RhcnQrKztcblxuICAgICAgaWYgKGJmbHVzaCkge1xuICAgICAgICAvKioqIEZMVVNIX0JMT0NLKHMsIDApOyAqKiovXG4gICAgICAgIGZsdXNoX2Jsb2NrX29ubHkocywgZmFsc2UpO1xuICAgICAgICBpZiAocy5zdHJtLmF2YWlsX291dCA9PT0gMCkge1xuICAgICAgICAgIHJldHVybiBCU19ORUVEX01PUkU7XG4gICAgICAgIH1cbiAgICAgICAgLyoqKi9cbiAgICAgIH1cblxuICAgIH0gZWxzZSBpZiAocy5tYXRjaF9hdmFpbGFibGUpIHtcbiAgICAgIC8qIElmIHRoZXJlIHdhcyBubyBtYXRjaCBhdCB0aGUgcHJldmlvdXMgcG9zaXRpb24sIG91dHB1dCBhXG4gICAgICAgKiBzaW5nbGUgbGl0ZXJhbC4gSWYgdGhlcmUgd2FzIGEgbWF0Y2ggYnV0IHRoZSBjdXJyZW50IG1hdGNoXG4gICAgICAgKiBpcyBsb25nZXIsIHRydW5jYXRlIHRoZSBwcmV2aW91cyBtYXRjaCB0byBhIHNpbmdsZSBsaXRlcmFsLlxuICAgICAgICovXG4gICAgICAvL1RyYWNldnYoKHN0ZGVycixcIiVjXCIsIHMtPndpbmRvd1tzLT5zdHJzdGFydC0xXSkpO1xuICAgICAgLyoqKiBfdHJfdGFsbHlfbGl0KHMsIHMud2luZG93W3Muc3Ryc3RhcnQtMV0sIGJmbHVzaCk7ICoqKi9cbiAgICAgIGJmbHVzaCA9IF90cl90YWxseShzLCAwLCBzLndpbmRvd1tzLnN0cnN0YXJ0IC0gMV0pO1xuXG4gICAgICBpZiAoYmZsdXNoKSB7XG4gICAgICAgIC8qKiogRkxVU0hfQkxPQ0tfT05MWShzLCAwKSAqKiovXG4gICAgICAgIGZsdXNoX2Jsb2NrX29ubHkocywgZmFsc2UpO1xuICAgICAgICAvKioqL1xuICAgICAgfVxuICAgICAgcy5zdHJzdGFydCsrO1xuICAgICAgcy5sb29rYWhlYWQtLTtcbiAgICAgIGlmIChzLnN0cm0uYXZhaWxfb3V0ID09PSAwKSB7XG4gICAgICAgIHJldHVybiBCU19ORUVEX01PUkU7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8qIFRoZXJlIGlzIG5vIHByZXZpb3VzIG1hdGNoIHRvIGNvbXBhcmUgd2l0aCwgd2FpdCBmb3JcbiAgICAgICAqIHRoZSBuZXh0IHN0ZXAgdG8gZGVjaWRlLlxuICAgICAgICovXG4gICAgICBzLm1hdGNoX2F2YWlsYWJsZSA9IDE7XG4gICAgICBzLnN0cnN0YXJ0Kys7XG4gICAgICBzLmxvb2thaGVhZC0tO1xuICAgIH1cbiAgfVxuICAvL0Fzc2VydCAoZmx1c2ggIT0gWl9OT19GTFVTSCwgXCJubyBmbHVzaD9cIik7XG4gIGlmIChzLm1hdGNoX2F2YWlsYWJsZSkge1xuICAgIC8vVHJhY2V2digoc3RkZXJyLFwiJWNcIiwgcy0+d2luZG93W3MtPnN0cnN0YXJ0LTFdKSk7XG4gICAgLyoqKiBfdHJfdGFsbHlfbGl0KHMsIHMud2luZG93W3Muc3Ryc3RhcnQtMV0sIGJmbHVzaCk7ICoqKi9cbiAgICBiZmx1c2ggPSBfdHJfdGFsbHkocywgMCwgcy53aW5kb3dbcy5zdHJzdGFydCAtIDFdKTtcblxuICAgIHMubWF0Y2hfYXZhaWxhYmxlID0gMDtcbiAgfVxuICBzLmluc2VydCA9IHMuc3Ryc3RhcnQgPCBNSU5fTUFUQ0ggLSAxID8gcy5zdHJzdGFydCA6IE1JTl9NQVRDSCAtIDE7XG4gIGlmIChmbHVzaCA9PT0gWl9GSU5JU0gkMykge1xuICAgIC8qKiogRkxVU0hfQkxPQ0socywgMSk7ICoqKi9cbiAgICBmbHVzaF9ibG9ja19vbmx5KHMsIHRydWUpO1xuICAgIGlmIChzLnN0cm0uYXZhaWxfb3V0ID09PSAwKSB7XG4gICAgICByZXR1cm4gQlNfRklOSVNIX1NUQVJURUQ7XG4gICAgfVxuICAgIC8qKiovXG4gICAgcmV0dXJuIEJTX0ZJTklTSF9ET05FO1xuICB9XG4gIGlmIChzLnN5bV9uZXh0KSB7XG4gICAgLyoqKiBGTFVTSF9CTE9DSyhzLCAwKTsgKioqL1xuICAgIGZsdXNoX2Jsb2NrX29ubHkocywgZmFsc2UpO1xuICAgIGlmIChzLnN0cm0uYXZhaWxfb3V0ID09PSAwKSB7XG4gICAgICByZXR1cm4gQlNfTkVFRF9NT1JFO1xuICAgIH1cbiAgICAvKioqL1xuICB9XG5cbiAgcmV0dXJuIEJTX0JMT0NLX0RPTkU7XG59O1xuXG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogRm9yIFpfUkxFLCBzaW1wbHkgbG9vayBmb3IgcnVucyBvZiBieXRlcywgZ2VuZXJhdGUgbWF0Y2hlcyBvbmx5IG9mIGRpc3RhbmNlXG4gKiBvbmUuICBEbyBub3QgbWFpbnRhaW4gYSBoYXNoIHRhYmxlLiAgKEl0IHdpbGwgYmUgcmVnZW5lcmF0ZWQgaWYgdGhpcyBydW4gb2ZcbiAqIGRlZmxhdGUgc3dpdGNoZXMgYXdheSBmcm9tIFpfUkxFLilcbiAqL1xuY29uc3QgZGVmbGF0ZV9ybGUgPSAocywgZmx1c2gpID0+IHtcblxuICBsZXQgYmZsdXNoOyAgICAgICAgICAgIC8qIHNldCBpZiBjdXJyZW50IGJsb2NrIG11c3QgYmUgZmx1c2hlZCAqL1xuICBsZXQgcHJldjsgICAgICAgICAgICAgIC8qIGJ5dGUgYXQgZGlzdGFuY2Ugb25lIHRvIG1hdGNoICovXG4gIGxldCBzY2FuLCBzdHJlbmQ7ICAgICAgLyogc2NhbiBnb2VzIHVwIHRvIHN0cmVuZCBmb3IgbGVuZ3RoIG9mIHJ1biAqL1xuXG4gIGNvbnN0IF93aW4gPSBzLndpbmRvdztcblxuICBmb3IgKDs7KSB7XG4gICAgLyogTWFrZSBzdXJlIHRoYXQgd2UgYWx3YXlzIGhhdmUgZW5vdWdoIGxvb2thaGVhZCwgZXhjZXB0XG4gICAgICogYXQgdGhlIGVuZCBvZiB0aGUgaW5wdXQgZmlsZS4gV2UgbmVlZCBNQVhfTUFUQ0ggYnl0ZXNcbiAgICAgKiBmb3IgdGhlIGxvbmdlc3QgcnVuLCBwbHVzIG9uZSBmb3IgdGhlIHVucm9sbGVkIGxvb3AuXG4gICAgICovXG4gICAgaWYgKHMubG9va2FoZWFkIDw9IE1BWF9NQVRDSCkge1xuICAgICAgZmlsbF93aW5kb3cocyk7XG4gICAgICBpZiAocy5sb29rYWhlYWQgPD0gTUFYX01BVENIICYmIGZsdXNoID09PSBaX05PX0ZMVVNIJDIpIHtcbiAgICAgICAgcmV0dXJuIEJTX05FRURfTU9SRTtcbiAgICAgIH1cbiAgICAgIGlmIChzLmxvb2thaGVhZCA9PT0gMCkgeyBicmVhazsgfSAvKiBmbHVzaCB0aGUgY3VycmVudCBibG9jayAqL1xuICAgIH1cblxuICAgIC8qIFNlZSBob3cgbWFueSB0aW1lcyB0aGUgcHJldmlvdXMgYnl0ZSByZXBlYXRzICovXG4gICAgcy5tYXRjaF9sZW5ndGggPSAwO1xuICAgIGlmIChzLmxvb2thaGVhZCA+PSBNSU5fTUFUQ0ggJiYgcy5zdHJzdGFydCA+IDApIHtcbiAgICAgIHNjYW4gPSBzLnN0cnN0YXJ0IC0gMTtcbiAgICAgIHByZXYgPSBfd2luW3NjYW5dO1xuICAgICAgaWYgKHByZXYgPT09IF93aW5bKytzY2FuXSAmJiBwcmV2ID09PSBfd2luWysrc2Nhbl0gJiYgcHJldiA9PT0gX3dpblsrK3NjYW5dKSB7XG4gICAgICAgIHN0cmVuZCA9IHMuc3Ryc3RhcnQgKyBNQVhfTUFUQ0g7XG4gICAgICAgIGRvIHtcbiAgICAgICAgICAvKmpzaGludCBub2VtcHR5OmZhbHNlKi9cbiAgICAgICAgfSB3aGlsZSAocHJldiA9PT0gX3dpblsrK3NjYW5dICYmIHByZXYgPT09IF93aW5bKytzY2FuXSAmJlxuICAgICAgICAgICAgICAgICBwcmV2ID09PSBfd2luWysrc2Nhbl0gJiYgcHJldiA9PT0gX3dpblsrK3NjYW5dICYmXG4gICAgICAgICAgICAgICAgIHByZXYgPT09IF93aW5bKytzY2FuXSAmJiBwcmV2ID09PSBfd2luWysrc2Nhbl0gJiZcbiAgICAgICAgICAgICAgICAgcHJldiA9PT0gX3dpblsrK3NjYW5dICYmIHByZXYgPT09IF93aW5bKytzY2FuXSAmJlxuICAgICAgICAgICAgICAgICBzY2FuIDwgc3RyZW5kKTtcbiAgICAgICAgcy5tYXRjaF9sZW5ndGggPSBNQVhfTUFUQ0ggLSAoc3RyZW5kIC0gc2Nhbik7XG4gICAgICAgIGlmIChzLm1hdGNoX2xlbmd0aCA+IHMubG9va2FoZWFkKSB7XG4gICAgICAgICAgcy5tYXRjaF9sZW5ndGggPSBzLmxvb2thaGVhZDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy9Bc3NlcnQoc2NhbiA8PSBzLT53aW5kb3crKHVJbnQpKHMtPndpbmRvd19zaXplLTEpLCBcIndpbGQgc2NhblwiKTtcbiAgICB9XG5cbiAgICAvKiBFbWl0IG1hdGNoIGlmIGhhdmUgcnVuIG9mIE1JTl9NQVRDSCBvciBsb25nZXIsIGVsc2UgZW1pdCBsaXRlcmFsICovXG4gICAgaWYgKHMubWF0Y2hfbGVuZ3RoID49IE1JTl9NQVRDSCkge1xuICAgICAgLy9jaGVja19tYXRjaChzLCBzLnN0cnN0YXJ0LCBzLnN0cnN0YXJ0IC0gMSwgcy5tYXRjaF9sZW5ndGgpO1xuXG4gICAgICAvKioqIF90cl90YWxseV9kaXN0KHMsIDEsIHMubWF0Y2hfbGVuZ3RoIC0gTUlOX01BVENILCBiZmx1c2gpOyAqKiovXG4gICAgICBiZmx1c2ggPSBfdHJfdGFsbHkocywgMSwgcy5tYXRjaF9sZW5ndGggLSBNSU5fTUFUQ0gpO1xuXG4gICAgICBzLmxvb2thaGVhZCAtPSBzLm1hdGNoX2xlbmd0aDtcbiAgICAgIHMuc3Ryc3RhcnQgKz0gcy5tYXRjaF9sZW5ndGg7XG4gICAgICBzLm1hdGNoX2xlbmd0aCA9IDA7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8qIE5vIG1hdGNoLCBvdXRwdXQgYSBsaXRlcmFsIGJ5dGUgKi9cbiAgICAgIC8vVHJhY2V2digoc3RkZXJyLFwiJWNcIiwgcy0+d2luZG93W3MtPnN0cnN0YXJ0XSkpO1xuICAgICAgLyoqKiBfdHJfdGFsbHlfbGl0KHMsIHMud2luZG93W3Muc3Ryc3RhcnRdLCBiZmx1c2gpOyAqKiovXG4gICAgICBiZmx1c2ggPSBfdHJfdGFsbHkocywgMCwgcy53aW5kb3dbcy5zdHJzdGFydF0pO1xuXG4gICAgICBzLmxvb2thaGVhZC0tO1xuICAgICAgcy5zdHJzdGFydCsrO1xuICAgIH1cbiAgICBpZiAoYmZsdXNoKSB7XG4gICAgICAvKioqIEZMVVNIX0JMT0NLKHMsIDApOyAqKiovXG4gICAgICBmbHVzaF9ibG9ja19vbmx5KHMsIGZhbHNlKTtcbiAgICAgIGlmIChzLnN0cm0uYXZhaWxfb3V0ID09PSAwKSB7XG4gICAgICAgIHJldHVybiBCU19ORUVEX01PUkU7XG4gICAgICB9XG4gICAgICAvKioqL1xuICAgIH1cbiAgfVxuICBzLmluc2VydCA9IDA7XG4gIGlmIChmbHVzaCA9PT0gWl9GSU5JU0gkMykge1xuICAgIC8qKiogRkxVU0hfQkxPQ0socywgMSk7ICoqKi9cbiAgICBmbHVzaF9ibG9ja19vbmx5KHMsIHRydWUpO1xuICAgIGlmIChzLnN0cm0uYXZhaWxfb3V0ID09PSAwKSB7XG4gICAgICByZXR1cm4gQlNfRklOSVNIX1NUQVJURUQ7XG4gICAgfVxuICAgIC8qKiovXG4gICAgcmV0dXJuIEJTX0ZJTklTSF9ET05FO1xuICB9XG4gIGlmIChzLnN5bV9uZXh0KSB7XG4gICAgLyoqKiBGTFVTSF9CTE9DSyhzLCAwKTsgKioqL1xuICAgIGZsdXNoX2Jsb2NrX29ubHkocywgZmFsc2UpO1xuICAgIGlmIChzLnN0cm0uYXZhaWxfb3V0ID09PSAwKSB7XG4gICAgICByZXR1cm4gQlNfTkVFRF9NT1JFO1xuICAgIH1cbiAgICAvKioqL1xuICB9XG4gIHJldHVybiBCU19CTE9DS19ET05FO1xufTtcblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBGb3IgWl9IVUZGTUFOX09OTFksIGRvIG5vdCBsb29rIGZvciBtYXRjaGVzLiAgRG8gbm90IG1haW50YWluIGEgaGFzaCB0YWJsZS5cbiAqIChJdCB3aWxsIGJlIHJlZ2VuZXJhdGVkIGlmIHRoaXMgcnVuIG9mIGRlZmxhdGUgc3dpdGNoZXMgYXdheSBmcm9tIEh1ZmZtYW4uKVxuICovXG5jb25zdCBkZWZsYXRlX2h1ZmYgPSAocywgZmx1c2gpID0+IHtcblxuICBsZXQgYmZsdXNoOyAgICAgICAgICAgICAvKiBzZXQgaWYgY3VycmVudCBibG9jayBtdXN0IGJlIGZsdXNoZWQgKi9cblxuICBmb3IgKDs7KSB7XG4gICAgLyogTWFrZSBzdXJlIHRoYXQgd2UgaGF2ZSBhIGxpdGVyYWwgdG8gd3JpdGUuICovXG4gICAgaWYgKHMubG9va2FoZWFkID09PSAwKSB7XG4gICAgICBmaWxsX3dpbmRvdyhzKTtcbiAgICAgIGlmIChzLmxvb2thaGVhZCA9PT0gMCkge1xuICAgICAgICBpZiAoZmx1c2ggPT09IFpfTk9fRkxVU0gkMikge1xuICAgICAgICAgIHJldHVybiBCU19ORUVEX01PUkU7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7ICAgICAgLyogZmx1c2ggdGhlIGN1cnJlbnQgYmxvY2sgKi9cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvKiBPdXRwdXQgYSBsaXRlcmFsIGJ5dGUgKi9cbiAgICBzLm1hdGNoX2xlbmd0aCA9IDA7XG4gICAgLy9UcmFjZXZ2KChzdGRlcnIsXCIlY1wiLCBzLT53aW5kb3dbcy0+c3Ryc3RhcnRdKSk7XG4gICAgLyoqKiBfdHJfdGFsbHlfbGl0KHMsIHMud2luZG93W3Muc3Ryc3RhcnRdLCBiZmx1c2gpOyAqKiovXG4gICAgYmZsdXNoID0gX3RyX3RhbGx5KHMsIDAsIHMud2luZG93W3Muc3Ryc3RhcnRdKTtcbiAgICBzLmxvb2thaGVhZC0tO1xuICAgIHMuc3Ryc3RhcnQrKztcbiAgICBpZiAoYmZsdXNoKSB7XG4gICAgICAvKioqIEZMVVNIX0JMT0NLKHMsIDApOyAqKiovXG4gICAgICBmbHVzaF9ibG9ja19vbmx5KHMsIGZhbHNlKTtcbiAgICAgIGlmIChzLnN0cm0uYXZhaWxfb3V0ID09PSAwKSB7XG4gICAgICAgIHJldHVybiBCU19ORUVEX01PUkU7XG4gICAgICB9XG4gICAgICAvKioqL1xuICAgIH1cbiAgfVxuICBzLmluc2VydCA9IDA7XG4gIGlmIChmbHVzaCA9PT0gWl9GSU5JU0gkMykge1xuICAgIC8qKiogRkxVU0hfQkxPQ0socywgMSk7ICoqKi9cbiAgICBmbHVzaF9ibG9ja19vbmx5KHMsIHRydWUpO1xuICAgIGlmIChzLnN0cm0uYXZhaWxfb3V0ID09PSAwKSB7XG4gICAgICByZXR1cm4gQlNfRklOSVNIX1NUQVJURUQ7XG4gICAgfVxuICAgIC8qKiovXG4gICAgcmV0dXJuIEJTX0ZJTklTSF9ET05FO1xuICB9XG4gIGlmIChzLnN5bV9uZXh0KSB7XG4gICAgLyoqKiBGTFVTSF9CTE9DSyhzLCAwKTsgKioqL1xuICAgIGZsdXNoX2Jsb2NrX29ubHkocywgZmFsc2UpO1xuICAgIGlmIChzLnN0cm0uYXZhaWxfb3V0ID09PSAwKSB7XG4gICAgICByZXR1cm4gQlNfTkVFRF9NT1JFO1xuICAgIH1cbiAgICAvKioqL1xuICB9XG4gIHJldHVybiBCU19CTE9DS19ET05FO1xufTtcblxuLyogVmFsdWVzIGZvciBtYXhfbGF6eV9tYXRjaCwgZ29vZF9tYXRjaCBhbmQgbWF4X2NoYWluX2xlbmd0aCwgZGVwZW5kaW5nIG9uXG4gKiB0aGUgZGVzaXJlZCBwYWNrIGxldmVsICgwLi45KS4gVGhlIHZhbHVlcyBnaXZlbiBiZWxvdyBoYXZlIGJlZW4gdHVuZWQgdG9cbiAqIGV4Y2x1ZGUgd29yc3QgY2FzZSBwZXJmb3JtYW5jZSBmb3IgcGF0aG9sb2dpY2FsIGZpbGVzLiBCZXR0ZXIgdmFsdWVzIG1heSBiZVxuICogZm91bmQgZm9yIHNwZWNpZmljIGZpbGVzLlxuICovXG5mdW5jdGlvbiBDb25maWcoZ29vZF9sZW5ndGgsIG1heF9sYXp5LCBuaWNlX2xlbmd0aCwgbWF4X2NoYWluLCBmdW5jKSB7XG5cbiAgdGhpcy5nb29kX2xlbmd0aCA9IGdvb2RfbGVuZ3RoO1xuICB0aGlzLm1heF9sYXp5ID0gbWF4X2xhenk7XG4gIHRoaXMubmljZV9sZW5ndGggPSBuaWNlX2xlbmd0aDtcbiAgdGhpcy5tYXhfY2hhaW4gPSBtYXhfY2hhaW47XG4gIHRoaXMuZnVuYyA9IGZ1bmM7XG59XG5cbmNvbnN0IGNvbmZpZ3VyYXRpb25fdGFibGUgPSBbXG4gIC8qICAgICAgZ29vZCBsYXp5IG5pY2UgY2hhaW4gKi9cbiAgbmV3IENvbmZpZygwLCAwLCAwLCAwLCBkZWZsYXRlX3N0b3JlZCksICAgICAgICAgIC8qIDAgc3RvcmUgb25seSAqL1xuICBuZXcgQ29uZmlnKDQsIDQsIDgsIDQsIGRlZmxhdGVfZmFzdCksICAgICAgICAgICAgLyogMSBtYXggc3BlZWQsIG5vIGxhenkgbWF0Y2hlcyAqL1xuICBuZXcgQ29uZmlnKDQsIDUsIDE2LCA4LCBkZWZsYXRlX2Zhc3QpLCAgICAgICAgICAgLyogMiAqL1xuICBuZXcgQ29uZmlnKDQsIDYsIDMyLCAzMiwgZGVmbGF0ZV9mYXN0KSwgICAgICAgICAgLyogMyAqL1xuXG4gIG5ldyBDb25maWcoNCwgNCwgMTYsIDE2LCBkZWZsYXRlX3Nsb3cpLCAgICAgICAgICAvKiA0IGxhenkgbWF0Y2hlcyAqL1xuICBuZXcgQ29uZmlnKDgsIDE2LCAzMiwgMzIsIGRlZmxhdGVfc2xvdyksICAgICAgICAgLyogNSAqL1xuICBuZXcgQ29uZmlnKDgsIDE2LCAxMjgsIDEyOCwgZGVmbGF0ZV9zbG93KSwgICAgICAgLyogNiAqL1xuICBuZXcgQ29uZmlnKDgsIDMyLCAxMjgsIDI1NiwgZGVmbGF0ZV9zbG93KSwgICAgICAgLyogNyAqL1xuICBuZXcgQ29uZmlnKDMyLCAxMjgsIDI1OCwgMTAyNCwgZGVmbGF0ZV9zbG93KSwgICAgLyogOCAqL1xuICBuZXcgQ29uZmlnKDMyLCAyNTgsIDI1OCwgNDA5NiwgZGVmbGF0ZV9zbG93KSAgICAgLyogOSBtYXggY29tcHJlc3Npb24gKi9cbl07XG5cblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBJbml0aWFsaXplIHRoZSBcImxvbmdlc3QgbWF0Y2hcIiByb3V0aW5lcyBmb3IgYSBuZXcgemxpYiBzdHJlYW1cbiAqL1xuY29uc3QgbG1faW5pdCA9IChzKSA9PiB7XG5cbiAgcy53aW5kb3dfc2l6ZSA9IDIgKiBzLndfc2l6ZTtcblxuICAvKioqIENMRUFSX0hBU0gocyk7ICoqKi9cbiAgemVybyhzLmhlYWQpOyAvLyBGaWxsIHdpdGggTklMICg9IDApO1xuXG4gIC8qIFNldCB0aGUgZGVmYXVsdCBjb25maWd1cmF0aW9uIHBhcmFtZXRlcnM6XG4gICAqL1xuICBzLm1heF9sYXp5X21hdGNoID0gY29uZmlndXJhdGlvbl90YWJsZVtzLmxldmVsXS5tYXhfbGF6eTtcbiAgcy5nb29kX21hdGNoID0gY29uZmlndXJhdGlvbl90YWJsZVtzLmxldmVsXS5nb29kX2xlbmd0aDtcbiAgcy5uaWNlX21hdGNoID0gY29uZmlndXJhdGlvbl90YWJsZVtzLmxldmVsXS5uaWNlX2xlbmd0aDtcbiAgcy5tYXhfY2hhaW5fbGVuZ3RoID0gY29uZmlndXJhdGlvbl90YWJsZVtzLmxldmVsXS5tYXhfY2hhaW47XG5cbiAgcy5zdHJzdGFydCA9IDA7XG4gIHMuYmxvY2tfc3RhcnQgPSAwO1xuICBzLmxvb2thaGVhZCA9IDA7XG4gIHMuaW5zZXJ0ID0gMDtcbiAgcy5tYXRjaF9sZW5ndGggPSBzLnByZXZfbGVuZ3RoID0gTUlOX01BVENIIC0gMTtcbiAgcy5tYXRjaF9hdmFpbGFibGUgPSAwO1xuICBzLmluc19oID0gMDtcbn07XG5cblxuZnVuY3Rpb24gRGVmbGF0ZVN0YXRlKCkge1xuICB0aGlzLnN0cm0gPSBudWxsOyAgICAgICAgICAgIC8qIHBvaW50ZXIgYmFjayB0byB0aGlzIHpsaWIgc3RyZWFtICovXG4gIHRoaXMuc3RhdHVzID0gMDsgICAgICAgICAgICAvKiBhcyB0aGUgbmFtZSBpbXBsaWVzICovXG4gIHRoaXMucGVuZGluZ19idWYgPSBudWxsOyAgICAgIC8qIG91dHB1dCBzdGlsbCBwZW5kaW5nICovXG4gIHRoaXMucGVuZGluZ19idWZfc2l6ZSA9IDA7ICAvKiBzaXplIG9mIHBlbmRpbmdfYnVmICovXG4gIHRoaXMucGVuZGluZ19vdXQgPSAwOyAgICAgICAvKiBuZXh0IHBlbmRpbmcgYnl0ZSB0byBvdXRwdXQgdG8gdGhlIHN0cmVhbSAqL1xuICB0aGlzLnBlbmRpbmcgPSAwOyAgICAgICAgICAgLyogbmIgb2YgYnl0ZXMgaW4gdGhlIHBlbmRpbmcgYnVmZmVyICovXG4gIHRoaXMud3JhcCA9IDA7ICAgICAgICAgICAgICAvKiBiaXQgMCB0cnVlIGZvciB6bGliLCBiaXQgMSB0cnVlIGZvciBnemlwICovXG4gIHRoaXMuZ3poZWFkID0gbnVsbDsgICAgICAgICAvKiBnemlwIGhlYWRlciBpbmZvcm1hdGlvbiB0byB3cml0ZSAqL1xuICB0aGlzLmd6aW5kZXggPSAwOyAgICAgICAgICAgLyogd2hlcmUgaW4gZXh0cmEsIG5hbWUsIG9yIGNvbW1lbnQgKi9cbiAgdGhpcy5tZXRob2QgPSBaX0RFRkxBVEVEJDI7IC8qIGNhbiBvbmx5IGJlIERFRkxBVEVEICovXG4gIHRoaXMubGFzdF9mbHVzaCA9IC0xOyAgIC8qIHZhbHVlIG9mIGZsdXNoIHBhcmFtIGZvciBwcmV2aW91cyBkZWZsYXRlIGNhbGwgKi9cblxuICB0aGlzLndfc2l6ZSA9IDA7ICAvKiBMWjc3IHdpbmRvdyBzaXplICgzMksgYnkgZGVmYXVsdCkgKi9cbiAgdGhpcy53X2JpdHMgPSAwOyAgLyogbG9nMih3X3NpemUpICAoOC4uMTYpICovXG4gIHRoaXMud19tYXNrID0gMDsgIC8qIHdfc2l6ZSAtIDEgKi9cblxuICB0aGlzLndpbmRvdyA9IG51bGw7XG4gIC8qIFNsaWRpbmcgd2luZG93LiBJbnB1dCBieXRlcyBhcmUgcmVhZCBpbnRvIHRoZSBzZWNvbmQgaGFsZiBvZiB0aGUgd2luZG93LFxuICAgKiBhbmQgbW92ZSB0byB0aGUgZmlyc3QgaGFsZiBsYXRlciB0byBrZWVwIGEgZGljdGlvbmFyeSBvZiBhdCBsZWFzdCB3U2l6ZVxuICAgKiBieXRlcy4gV2l0aCB0aGlzIG9yZ2FuaXphdGlvbiwgbWF0Y2hlcyBhcmUgbGltaXRlZCB0byBhIGRpc3RhbmNlIG9mXG4gICAqIHdTaXplLU1BWF9NQVRDSCBieXRlcywgYnV0IHRoaXMgZW5zdXJlcyB0aGF0IElPIGlzIGFsd2F5c1xuICAgKiBwZXJmb3JtZWQgd2l0aCBhIGxlbmd0aCBtdWx0aXBsZSBvZiB0aGUgYmxvY2sgc2l6ZS5cbiAgICovXG5cbiAgdGhpcy53aW5kb3dfc2l6ZSA9IDA7XG4gIC8qIEFjdHVhbCBzaXplIG9mIHdpbmRvdzogMip3U2l6ZSwgZXhjZXB0IHdoZW4gdGhlIHVzZXIgaW5wdXQgYnVmZmVyXG4gICAqIGlzIGRpcmVjdGx5IHVzZWQgYXMgc2xpZGluZyB3aW5kb3cuXG4gICAqL1xuXG4gIHRoaXMucHJldiA9IG51bGw7XG4gIC8qIExpbmsgdG8gb2xkZXIgc3RyaW5nIHdpdGggc2FtZSBoYXNoIGluZGV4LiBUbyBsaW1pdCB0aGUgc2l6ZSBvZiB0aGlzXG4gICAqIGFycmF5IHRvIDY0SywgdGhpcyBsaW5rIGlzIG1haW50YWluZWQgb25seSBmb3IgdGhlIGxhc3QgMzJLIHN0cmluZ3MuXG4gICAqIEFuIGluZGV4IGluIHRoaXMgYXJyYXkgaXMgdGh1cyBhIHdpbmRvdyBpbmRleCBtb2R1bG8gMzJLLlxuICAgKi9cblxuICB0aGlzLmhlYWQgPSBudWxsOyAgIC8qIEhlYWRzIG9mIHRoZSBoYXNoIGNoYWlucyBvciBOSUwuICovXG5cbiAgdGhpcy5pbnNfaCA9IDA7ICAgICAgIC8qIGhhc2ggaW5kZXggb2Ygc3RyaW5nIHRvIGJlIGluc2VydGVkICovXG4gIHRoaXMuaGFzaF9zaXplID0gMDsgICAvKiBudW1iZXIgb2YgZWxlbWVudHMgaW4gaGFzaCB0YWJsZSAqL1xuICB0aGlzLmhhc2hfYml0cyA9IDA7ICAgLyogbG9nMihoYXNoX3NpemUpICovXG4gIHRoaXMuaGFzaF9tYXNrID0gMDsgICAvKiBoYXNoX3NpemUtMSAqL1xuXG4gIHRoaXMuaGFzaF9zaGlmdCA9IDA7XG4gIC8qIE51bWJlciBvZiBiaXRzIGJ5IHdoaWNoIGluc19oIG11c3QgYmUgc2hpZnRlZCBhdCBlYWNoIGlucHV0XG4gICAqIHN0ZXAuIEl0IG11c3QgYmUgc3VjaCB0aGF0IGFmdGVyIE1JTl9NQVRDSCBzdGVwcywgdGhlIG9sZGVzdFxuICAgKiBieXRlIG5vIGxvbmdlciB0YWtlcyBwYXJ0IGluIHRoZSBoYXNoIGtleSwgdGhhdCBpczpcbiAgICogICBoYXNoX3NoaWZ0ICogTUlOX01BVENIID49IGhhc2hfYml0c1xuICAgKi9cblxuICB0aGlzLmJsb2NrX3N0YXJ0ID0gMDtcbiAgLyogV2luZG93IHBvc2l0aW9uIGF0IHRoZSBiZWdpbm5pbmcgb2YgdGhlIGN1cnJlbnQgb3V0cHV0IGJsb2NrLiBHZXRzXG4gICAqIG5lZ2F0aXZlIHdoZW4gdGhlIHdpbmRvdyBpcyBtb3ZlZCBiYWNrd2FyZHMuXG4gICAqL1xuXG4gIHRoaXMubWF0Y2hfbGVuZ3RoID0gMDsgICAgICAvKiBsZW5ndGggb2YgYmVzdCBtYXRjaCAqL1xuICB0aGlzLnByZXZfbWF0Y2ggPSAwOyAgICAgICAgLyogcHJldmlvdXMgbWF0Y2ggKi9cbiAgdGhpcy5tYXRjaF9hdmFpbGFibGUgPSAwOyAgIC8qIHNldCBpZiBwcmV2aW91cyBtYXRjaCBleGlzdHMgKi9cbiAgdGhpcy5zdHJzdGFydCA9IDA7ICAgICAgICAgIC8qIHN0YXJ0IG9mIHN0cmluZyB0byBpbnNlcnQgKi9cbiAgdGhpcy5tYXRjaF9zdGFydCA9IDA7ICAgICAgIC8qIHN0YXJ0IG9mIG1hdGNoaW5nIHN0cmluZyAqL1xuICB0aGlzLmxvb2thaGVhZCA9IDA7ICAgICAgICAgLyogbnVtYmVyIG9mIHZhbGlkIGJ5dGVzIGFoZWFkIGluIHdpbmRvdyAqL1xuXG4gIHRoaXMucHJldl9sZW5ndGggPSAwO1xuICAvKiBMZW5ndGggb2YgdGhlIGJlc3QgbWF0Y2ggYXQgcHJldmlvdXMgc3RlcC4gTWF0Y2hlcyBub3QgZ3JlYXRlciB0aGFuIHRoaXNcbiAgICogYXJlIGRpc2NhcmRlZC4gVGhpcyBpcyB1c2VkIGluIHRoZSBsYXp5IG1hdGNoIGV2YWx1YXRpb24uXG4gICAqL1xuXG4gIHRoaXMubWF4X2NoYWluX2xlbmd0aCA9IDA7XG4gIC8qIFRvIHNwZWVkIHVwIGRlZmxhdGlvbiwgaGFzaCBjaGFpbnMgYXJlIG5ldmVyIHNlYXJjaGVkIGJleW9uZCB0aGlzXG4gICAqIGxlbmd0aC4gIEEgaGlnaGVyIGxpbWl0IGltcHJvdmVzIGNvbXByZXNzaW9uIHJhdGlvIGJ1dCBkZWdyYWRlcyB0aGVcbiAgICogc3BlZWQuXG4gICAqL1xuXG4gIHRoaXMubWF4X2xhenlfbWF0Y2ggPSAwO1xuICAvKiBBdHRlbXB0IHRvIGZpbmQgYSBiZXR0ZXIgbWF0Y2ggb25seSB3aGVuIHRoZSBjdXJyZW50IG1hdGNoIGlzIHN0cmljdGx5XG4gICAqIHNtYWxsZXIgdGhhbiB0aGlzIHZhbHVlLiBUaGlzIG1lY2hhbmlzbSBpcyB1c2VkIG9ubHkgZm9yIGNvbXByZXNzaW9uXG4gICAqIGxldmVscyA+PSA0LlxuICAgKi9cbiAgLy8gVGhhdCdzIGFsaWFzIHRvIG1heF9sYXp5X21hdGNoLCBkb24ndCB1c2UgZGlyZWN0bHlcbiAgLy90aGlzLm1heF9pbnNlcnRfbGVuZ3RoID0gMDtcbiAgLyogSW5zZXJ0IG5ldyBzdHJpbmdzIGluIHRoZSBoYXNoIHRhYmxlIG9ubHkgaWYgdGhlIG1hdGNoIGxlbmd0aCBpcyBub3RcbiAgICogZ3JlYXRlciB0aGFuIHRoaXMgbGVuZ3RoLiBUaGlzIHNhdmVzIHRpbWUgYnV0IGRlZ3JhZGVzIGNvbXByZXNzaW9uLlxuICAgKiBtYXhfaW5zZXJ0X2xlbmd0aCBpcyB1c2VkIG9ubHkgZm9yIGNvbXByZXNzaW9uIGxldmVscyA8PSAzLlxuICAgKi9cblxuICB0aGlzLmxldmVsID0gMDsgICAgIC8qIGNvbXByZXNzaW9uIGxldmVsICgxLi45KSAqL1xuICB0aGlzLnN0cmF0ZWd5ID0gMDsgIC8qIGZhdm9yIG9yIGZvcmNlIEh1ZmZtYW4gY29kaW5nKi9cblxuICB0aGlzLmdvb2RfbWF0Y2ggPSAwO1xuICAvKiBVc2UgYSBmYXN0ZXIgc2VhcmNoIHdoZW4gdGhlIHByZXZpb3VzIG1hdGNoIGlzIGxvbmdlciB0aGFuIHRoaXMgKi9cblxuICB0aGlzLm5pY2VfbWF0Y2ggPSAwOyAvKiBTdG9wIHNlYXJjaGluZyB3aGVuIGN1cnJlbnQgbWF0Y2ggZXhjZWVkcyB0aGlzICovXG5cbiAgICAgICAgICAgICAgLyogdXNlZCBieSB0cmVlcy5jOiAqL1xuXG4gIC8qIERpZG4ndCB1c2UgY3RfZGF0YSB0eXBlZGVmIGJlbG93IHRvIHN1cHByZXNzIGNvbXBpbGVyIHdhcm5pbmcgKi9cblxuICAvLyBzdHJ1Y3QgY3RfZGF0YV9zIGR5bl9sdHJlZVtIRUFQX1NJWkVdOyAgIC8qIGxpdGVyYWwgYW5kIGxlbmd0aCB0cmVlICovXG4gIC8vIHN0cnVjdCBjdF9kYXRhX3MgZHluX2R0cmVlWzIqRF9DT0RFUysxXTsgLyogZGlzdGFuY2UgdHJlZSAqL1xuICAvLyBzdHJ1Y3QgY3RfZGF0YV9zIGJsX3RyZWVbMipCTF9DT0RFUysxXTsgIC8qIEh1ZmZtYW4gdHJlZSBmb3IgYml0IGxlbmd0aHMgKi9cblxuICAvLyBVc2UgZmxhdCBhcnJheSBvZiBET1VCTEUgc2l6ZSwgd2l0aCBpbnRlcmxlYXZlZCBmYXRhLFxuICAvLyBiZWNhdXNlIEpTIGRvZXMgbm90IHN1cHBvcnQgZWZmZWN0aXZlXG4gIHRoaXMuZHluX2x0cmVlICA9IG5ldyBVaW50MTZBcnJheShIRUFQX1NJWkUgKiAyKTtcbiAgdGhpcy5keW5fZHRyZWUgID0gbmV3IFVpbnQxNkFycmF5KCgyICogRF9DT0RFUyArIDEpICogMik7XG4gIHRoaXMuYmxfdHJlZSAgICA9IG5ldyBVaW50MTZBcnJheSgoMiAqIEJMX0NPREVTICsgMSkgKiAyKTtcbiAgemVybyh0aGlzLmR5bl9sdHJlZSk7XG4gIHplcm8odGhpcy5keW5fZHRyZWUpO1xuICB6ZXJvKHRoaXMuYmxfdHJlZSk7XG5cbiAgdGhpcy5sX2Rlc2MgICA9IG51bGw7ICAgICAgICAgLyogZGVzYy4gZm9yIGxpdGVyYWwgdHJlZSAqL1xuICB0aGlzLmRfZGVzYyAgID0gbnVsbDsgICAgICAgICAvKiBkZXNjLiBmb3IgZGlzdGFuY2UgdHJlZSAqL1xuICB0aGlzLmJsX2Rlc2MgID0gbnVsbDsgICAgICAgICAvKiBkZXNjLiBmb3IgYml0IGxlbmd0aCB0cmVlICovXG5cbiAgLy91c2ggYmxfY291bnRbTUFYX0JJVFMrMV07XG4gIHRoaXMuYmxfY291bnQgPSBuZXcgVWludDE2QXJyYXkoTUFYX0JJVFMgKyAxKTtcbiAgLyogbnVtYmVyIG9mIGNvZGVzIGF0IGVhY2ggYml0IGxlbmd0aCBmb3IgYW4gb3B0aW1hbCB0cmVlICovXG5cbiAgLy9pbnQgaGVhcFsyKkxfQ09ERVMrMV07ICAgICAgLyogaGVhcCB1c2VkIHRvIGJ1aWxkIHRoZSBIdWZmbWFuIHRyZWVzICovXG4gIHRoaXMuaGVhcCA9IG5ldyBVaW50MTZBcnJheSgyICogTF9DT0RFUyArIDEpOyAgLyogaGVhcCB1c2VkIHRvIGJ1aWxkIHRoZSBIdWZmbWFuIHRyZWVzICovXG4gIHplcm8odGhpcy5oZWFwKTtcblxuICB0aGlzLmhlYXBfbGVuID0gMDsgICAgICAgICAgICAgICAvKiBudW1iZXIgb2YgZWxlbWVudHMgaW4gdGhlIGhlYXAgKi9cbiAgdGhpcy5oZWFwX21heCA9IDA7ICAgICAgICAgICAgICAgLyogZWxlbWVudCBvZiBsYXJnZXN0IGZyZXF1ZW5jeSAqL1xuICAvKiBUaGUgc29ucyBvZiBoZWFwW25dIGFyZSBoZWFwWzIqbl0gYW5kIGhlYXBbMipuKzFdLiBoZWFwWzBdIGlzIG5vdCB1c2VkLlxuICAgKiBUaGUgc2FtZSBoZWFwIGFycmF5IGlzIHVzZWQgdG8gYnVpbGQgYWxsIHRyZWVzLlxuICAgKi9cblxuICB0aGlzLmRlcHRoID0gbmV3IFVpbnQxNkFycmF5KDIgKiBMX0NPREVTICsgMSk7IC8vdWNoIGRlcHRoWzIqTF9DT0RFUysxXTtcbiAgemVybyh0aGlzLmRlcHRoKTtcbiAgLyogRGVwdGggb2YgZWFjaCBzdWJ0cmVlIHVzZWQgYXMgdGllIGJyZWFrZXIgZm9yIHRyZWVzIG9mIGVxdWFsIGZyZXF1ZW5jeVxuICAgKi9cblxuICB0aGlzLnN5bV9idWYgPSAwOyAgICAgICAgLyogYnVmZmVyIGZvciBkaXN0YW5jZXMgYW5kIGxpdGVyYWxzL2xlbmd0aHMgKi9cblxuICB0aGlzLmxpdF9idWZzaXplID0gMDtcbiAgLyogU2l6ZSBvZiBtYXRjaCBidWZmZXIgZm9yIGxpdGVyYWxzL2xlbmd0aHMuICBUaGVyZSBhcmUgNCByZWFzb25zIGZvclxuICAgKiBsaW1pdGluZyBsaXRfYnVmc2l6ZSB0byA2NEs6XG4gICAqICAgLSBmcmVxdWVuY2llcyBjYW4gYmUga2VwdCBpbiAxNiBiaXQgY291bnRlcnNcbiAgICogICAtIGlmIGNvbXByZXNzaW9uIGlzIG5vdCBzdWNjZXNzZnVsIGZvciB0aGUgZmlyc3QgYmxvY2ssIGFsbCBpbnB1dFxuICAgKiAgICAgZGF0YSBpcyBzdGlsbCBpbiB0aGUgd2luZG93IHNvIHdlIGNhbiBzdGlsbCBlbWl0IGEgc3RvcmVkIGJsb2NrIGV2ZW5cbiAgICogICAgIHdoZW4gaW5wdXQgY29tZXMgZnJvbSBzdGFuZGFyZCBpbnB1dC4gIChUaGlzIGNhbiBhbHNvIGJlIGRvbmUgZm9yXG4gICAqICAgICBhbGwgYmxvY2tzIGlmIGxpdF9idWZzaXplIGlzIG5vdCBncmVhdGVyIHRoYW4gMzJLLilcbiAgICogICAtIGlmIGNvbXByZXNzaW9uIGlzIG5vdCBzdWNjZXNzZnVsIGZvciBhIGZpbGUgc21hbGxlciB0aGFuIDY0Sywgd2UgY2FuXG4gICAqICAgICBldmVuIGVtaXQgYSBzdG9yZWQgZmlsZSBpbnN0ZWFkIG9mIGEgc3RvcmVkIGJsb2NrIChzYXZpbmcgNSBieXRlcykuXG4gICAqICAgICBUaGlzIGlzIGFwcGxpY2FibGUgb25seSBmb3IgemlwIChub3QgZ3ppcCBvciB6bGliKS5cbiAgICogICAtIGNyZWF0aW5nIG5ldyBIdWZmbWFuIHRyZWVzIGxlc3MgZnJlcXVlbnRseSBtYXkgbm90IHByb3ZpZGUgZmFzdFxuICAgKiAgICAgYWRhcHRhdGlvbiB0byBjaGFuZ2VzIGluIHRoZSBpbnB1dCBkYXRhIHN0YXRpc3RpY3MuIChUYWtlIGZvclxuICAgKiAgICAgZXhhbXBsZSBhIGJpbmFyeSBmaWxlIHdpdGggcG9vcmx5IGNvbXByZXNzaWJsZSBjb2RlIGZvbGxvd2VkIGJ5XG4gICAqICAgICBhIGhpZ2hseSBjb21wcmVzc2libGUgc3RyaW5nIHRhYmxlLikgU21hbGxlciBidWZmZXIgc2l6ZXMgZ2l2ZVxuICAgKiAgICAgZmFzdCBhZGFwdGF0aW9uIGJ1dCBoYXZlIG9mIGNvdXJzZSB0aGUgb3ZlcmhlYWQgb2YgdHJhbnNtaXR0aW5nXG4gICAqICAgICB0cmVlcyBtb3JlIGZyZXF1ZW50bHkuXG4gICAqICAgLSBJIGNhbid0IGNvdW50IGFib3ZlIDRcbiAgICovXG5cbiAgdGhpcy5zeW1fbmV4dCA9IDA7ICAgICAgLyogcnVubmluZyBpbmRleCBpbiBzeW1fYnVmICovXG4gIHRoaXMuc3ltX2VuZCA9IDA7ICAgICAgIC8qIHN5bWJvbCB0YWJsZSBmdWxsIHdoZW4gc3ltX25leHQgcmVhY2hlcyB0aGlzICovXG5cbiAgdGhpcy5vcHRfbGVuID0gMDsgICAgICAgLyogYml0IGxlbmd0aCBvZiBjdXJyZW50IGJsb2NrIHdpdGggb3B0aW1hbCB0cmVlcyAqL1xuICB0aGlzLnN0YXRpY19sZW4gPSAwOyAgICAvKiBiaXQgbGVuZ3RoIG9mIGN1cnJlbnQgYmxvY2sgd2l0aCBzdGF0aWMgdHJlZXMgKi9cbiAgdGhpcy5tYXRjaGVzID0gMDsgICAgICAgLyogbnVtYmVyIG9mIHN0cmluZyBtYXRjaGVzIGluIGN1cnJlbnQgYmxvY2sgKi9cbiAgdGhpcy5pbnNlcnQgPSAwOyAgICAgICAgLyogYnl0ZXMgYXQgZW5kIG9mIHdpbmRvdyBsZWZ0IHRvIGluc2VydCAqL1xuXG5cbiAgdGhpcy5iaV9idWYgPSAwO1xuICAvKiBPdXRwdXQgYnVmZmVyLiBiaXRzIGFyZSBpbnNlcnRlZCBzdGFydGluZyBhdCB0aGUgYm90dG9tIChsZWFzdFxuICAgKiBzaWduaWZpY2FudCBiaXRzKS5cbiAgICovXG4gIHRoaXMuYmlfdmFsaWQgPSAwO1xuICAvKiBOdW1iZXIgb2YgdmFsaWQgYml0cyBpbiBiaV9idWYuICBBbGwgYml0cyBhYm92ZSB0aGUgbGFzdCB2YWxpZCBiaXRcbiAgICogYXJlIGFsd2F5cyB6ZXJvLlxuICAgKi9cblxuICAvLyBVc2VkIGZvciB3aW5kb3cgbWVtb3J5IGluaXQuIFdlIHNhZmVseSBpZ25vcmUgaXQgZm9yIEpTLiBUaGF0IG1ha2VzXG4gIC8vIHNlbnNlIG9ubHkgZm9yIHBvaW50ZXJzIGFuZCBtZW1vcnkgY2hlY2sgdG9vbHMuXG4gIC8vdGhpcy5oaWdoX3dhdGVyID0gMDtcbiAgLyogSGlnaCB3YXRlciBtYXJrIG9mZnNldCBpbiB3aW5kb3cgZm9yIGluaXRpYWxpemVkIGJ5dGVzIC0tIGJ5dGVzIGFib3ZlXG4gICAqIHRoaXMgYXJlIHNldCB0byB6ZXJvIGluIG9yZGVyIHRvIGF2b2lkIG1lbW9yeSBjaGVjayB3YXJuaW5ncyB3aGVuXG4gICAqIGxvbmdlc3QgbWF0Y2ggcm91dGluZXMgYWNjZXNzIGJ5dGVzIHBhc3QgdGhlIGlucHV0LiAgVGhpcyBpcyB0aGVuXG4gICAqIHVwZGF0ZWQgdG8gdGhlIG5ldyBoaWdoIHdhdGVyIG1hcmsuXG4gICAqL1xufVxuXG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIENoZWNrIGZvciBhIHZhbGlkIGRlZmxhdGUgc3RyZWFtIHN0YXRlLiBSZXR1cm4gMCBpZiBvaywgMSBpZiBub3QuXG4gKi9cbmNvbnN0IGRlZmxhdGVTdGF0ZUNoZWNrID0gKHN0cm0pID0+IHtcblxuICBpZiAoIXN0cm0pIHtcbiAgICByZXR1cm4gMTtcbiAgfVxuICBjb25zdCBzID0gc3RybS5zdGF0ZTtcbiAgaWYgKCFzIHx8IHMuc3RybSAhPT0gc3RybSB8fCAocy5zdGF0dXMgIT09IElOSVRfU1RBVEUgJiZcbi8vI2lmZGVmIEdaSVBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcy5zdGF0dXMgIT09IEdaSVBfU1RBVEUgJiZcbi8vI2VuZGlmXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHMuc3RhdHVzICE9PSBFWFRSQV9TVEFURSAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzLnN0YXR1cyAhPT0gTkFNRV9TVEFURSAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzLnN0YXR1cyAhPT0gQ09NTUVOVF9TVEFURSAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzLnN0YXR1cyAhPT0gSENSQ19TVEFURSAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzLnN0YXR1cyAhPT0gQlVTWV9TVEFURSAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzLnN0YXR1cyAhPT0gRklOSVNIX1NUQVRFKSkge1xuICAgIHJldHVybiAxO1xuICB9XG4gIHJldHVybiAwO1xufTtcblxuXG5jb25zdCBkZWZsYXRlUmVzZXRLZWVwID0gKHN0cm0pID0+IHtcblxuICBpZiAoZGVmbGF0ZVN0YXRlQ2hlY2soc3RybSkpIHtcbiAgICByZXR1cm4gZXJyKHN0cm0sIFpfU1RSRUFNX0VSUk9SJDIpO1xuICB9XG5cbiAgc3RybS50b3RhbF9pbiA9IHN0cm0udG90YWxfb3V0ID0gMDtcbiAgc3RybS5kYXRhX3R5cGUgPSBaX1VOS05PV047XG5cbiAgY29uc3QgcyA9IHN0cm0uc3RhdGU7XG4gIHMucGVuZGluZyA9IDA7XG4gIHMucGVuZGluZ19vdXQgPSAwO1xuXG4gIGlmIChzLndyYXAgPCAwKSB7XG4gICAgcy53cmFwID0gLXMud3JhcDtcbiAgICAvKiB3YXMgbWFkZSBuZWdhdGl2ZSBieSBkZWZsYXRlKC4uLiwgWl9GSU5JU0gpOyAqL1xuICB9XG4gIHMuc3RhdHVzID1cbi8vI2lmZGVmIEdaSVBcbiAgICBzLndyYXAgPT09IDIgPyBHWklQX1NUQVRFIDpcbi8vI2VuZGlmXG4gICAgcy53cmFwID8gSU5JVF9TVEFURSA6IEJVU1lfU1RBVEU7XG4gIHN0cm0uYWRsZXIgPSAocy53cmFwID09PSAyKSA/XG4gICAgMCAgLy8gY3JjMzIoMCwgWl9OVUxMLCAwKVxuICA6XG4gICAgMTsgLy8gYWRsZXIzMigwLCBaX05VTEwsIDApXG4gIHMubGFzdF9mbHVzaCA9IC0yO1xuICBfdHJfaW5pdChzKTtcbiAgcmV0dXJuIFpfT0skMztcbn07XG5cblxuY29uc3QgZGVmbGF0ZVJlc2V0ID0gKHN0cm0pID0+IHtcblxuICBjb25zdCByZXQgPSBkZWZsYXRlUmVzZXRLZWVwKHN0cm0pO1xuICBpZiAocmV0ID09PSBaX09LJDMpIHtcbiAgICBsbV9pbml0KHN0cm0uc3RhdGUpO1xuICB9XG4gIHJldHVybiByZXQ7XG59O1xuXG5cbmNvbnN0IGRlZmxhdGVTZXRIZWFkZXIgPSAoc3RybSwgaGVhZCkgPT4ge1xuXG4gIGlmIChkZWZsYXRlU3RhdGVDaGVjayhzdHJtKSB8fCBzdHJtLnN0YXRlLndyYXAgIT09IDIpIHtcbiAgICByZXR1cm4gWl9TVFJFQU1fRVJST1IkMjtcbiAgfVxuICBzdHJtLnN0YXRlLmd6aGVhZCA9IGhlYWQ7XG4gIHJldHVybiBaX09LJDM7XG59O1xuXG5cbmNvbnN0IGRlZmxhdGVJbml0MiA9IChzdHJtLCBsZXZlbCwgbWV0aG9kLCB3aW5kb3dCaXRzLCBtZW1MZXZlbCwgc3RyYXRlZ3kpID0+IHtcblxuICBpZiAoIXN0cm0pIHsgLy8gPT09IFpfTlVMTFxuICAgIHJldHVybiBaX1NUUkVBTV9FUlJPUiQyO1xuICB9XG4gIGxldCB3cmFwID0gMTtcblxuICBpZiAobGV2ZWwgPT09IFpfREVGQVVMVF9DT01QUkVTU0lPTiQxKSB7XG4gICAgbGV2ZWwgPSA2O1xuICB9XG5cbiAgaWYgKHdpbmRvd0JpdHMgPCAwKSB7IC8qIHN1cHByZXNzIHpsaWIgd3JhcHBlciAqL1xuICAgIHdyYXAgPSAwO1xuICAgIHdpbmRvd0JpdHMgPSAtd2luZG93Qml0cztcbiAgfVxuXG4gIGVsc2UgaWYgKHdpbmRvd0JpdHMgPiAxNSkge1xuICAgIHdyYXAgPSAyOyAgICAgICAgICAgLyogd3JpdGUgZ3ppcCB3cmFwcGVyIGluc3RlYWQgKi9cbiAgICB3aW5kb3dCaXRzIC09IDE2O1xuICB9XG5cblxuICBpZiAobWVtTGV2ZWwgPCAxIHx8IG1lbUxldmVsID4gTUFYX01FTV9MRVZFTCB8fCBtZXRob2QgIT09IFpfREVGTEFURUQkMiB8fFxuICAgIHdpbmRvd0JpdHMgPCA4IHx8IHdpbmRvd0JpdHMgPiAxNSB8fCBsZXZlbCA8IDAgfHwgbGV2ZWwgPiA5IHx8XG4gICAgc3RyYXRlZ3kgPCAwIHx8IHN0cmF0ZWd5ID4gWl9GSVhFRCB8fCAod2luZG93Qml0cyA9PT0gOCAmJiB3cmFwICE9PSAxKSkge1xuICAgIHJldHVybiBlcnIoc3RybSwgWl9TVFJFQU1fRVJST1IkMik7XG4gIH1cblxuXG4gIGlmICh3aW5kb3dCaXRzID09PSA4KSB7XG4gICAgd2luZG93Qml0cyA9IDk7XG4gIH1cbiAgLyogdW50aWwgMjU2LWJ5dGUgd2luZG93IGJ1ZyBmaXhlZCAqL1xuXG4gIGNvbnN0IHMgPSBuZXcgRGVmbGF0ZVN0YXRlKCk7XG5cbiAgc3RybS5zdGF0ZSA9IHM7XG4gIHMuc3RybSA9IHN0cm07XG4gIHMuc3RhdHVzID0gSU5JVF9TVEFURTsgICAgIC8qIHRvIHBhc3Mgc3RhdGUgdGVzdCBpbiBkZWZsYXRlUmVzZXQoKSAqL1xuXG4gIHMud3JhcCA9IHdyYXA7XG4gIHMuZ3poZWFkID0gbnVsbDtcbiAgcy53X2JpdHMgPSB3aW5kb3dCaXRzO1xuICBzLndfc2l6ZSA9IDEgPDwgcy53X2JpdHM7XG4gIHMud19tYXNrID0gcy53X3NpemUgLSAxO1xuXG4gIHMuaGFzaF9iaXRzID0gbWVtTGV2ZWwgKyA3O1xuICBzLmhhc2hfc2l6ZSA9IDEgPDwgcy5oYXNoX2JpdHM7XG4gIHMuaGFzaF9tYXNrID0gcy5oYXNoX3NpemUgLSAxO1xuICBzLmhhc2hfc2hpZnQgPSB+figocy5oYXNoX2JpdHMgKyBNSU5fTUFUQ0ggLSAxKSAvIE1JTl9NQVRDSCk7XG5cbiAgcy53aW5kb3cgPSBuZXcgVWludDhBcnJheShzLndfc2l6ZSAqIDIpO1xuICBzLmhlYWQgPSBuZXcgVWludDE2QXJyYXkocy5oYXNoX3NpemUpO1xuICBzLnByZXYgPSBuZXcgVWludDE2QXJyYXkocy53X3NpemUpO1xuXG4gIC8vIERvbid0IG5lZWQgbWVtIGluaXQgbWFnaWMgZm9yIEpTLlxuICAvL3MuaGlnaF93YXRlciA9IDA7ICAvKiBub3RoaW5nIHdyaXR0ZW4gdG8gcy0+d2luZG93IHlldCAqL1xuXG4gIHMubGl0X2J1ZnNpemUgPSAxIDw8IChtZW1MZXZlbCArIDYpOyAvKiAxNksgZWxlbWVudHMgYnkgZGVmYXVsdCAqL1xuXG4gIC8qIFdlIG92ZXJsYXkgcGVuZGluZ19idWYgYW5kIHN5bV9idWYuIFRoaXMgd29ya3Mgc2luY2UgdGhlIGF2ZXJhZ2Ugc2l6ZVxuICAgKiBmb3IgbGVuZ3RoL2Rpc3RhbmNlIHBhaXJzIG92ZXIgYW55IGNvbXByZXNzZWQgYmxvY2sgaXMgYXNzdXJlZCB0byBiZSAzMVxuICAgKiBiaXRzIG9yIGxlc3MuXG4gICAqXG4gICAqIEFuYWx5c2lzOiBUaGUgbG9uZ2VzdCBmaXhlZCBjb2RlcyBhcmUgYSBsZW5ndGggY29kZSBvZiA4IGJpdHMgcGx1cyA1XG4gICAqIGV4dHJhIGJpdHMsIGZvciBsZW5ndGhzIDEzMSB0byAyNTcuIFRoZSBsb25nZXN0IGZpeGVkIGRpc3RhbmNlIGNvZGVzIGFyZVxuICAgKiA1IGJpdHMgcGx1cyAxMyBleHRyYSBiaXRzLCBmb3IgZGlzdGFuY2VzIDE2Mzg1IHRvIDMyNzY4LiBUaGUgbG9uZ2VzdFxuICAgKiBwb3NzaWJsZSBmaXhlZC1jb2RlcyBsZW5ndGgvZGlzdGFuY2UgcGFpciBpcyB0aGVuIDMxIGJpdHMgdG90YWwuXG4gICAqXG4gICAqIHN5bV9idWYgc3RhcnRzIG9uZS1mb3VydGggb2YgdGhlIHdheSBpbnRvIHBlbmRpbmdfYnVmLiBTbyB0aGVyZSBhcmVcbiAgICogdGhyZWUgYnl0ZXMgaW4gc3ltX2J1ZiBmb3IgZXZlcnkgZm91ciBieXRlcyBpbiBwZW5kaW5nX2J1Zi4gRWFjaCBzeW1ib2xcbiAgICogaW4gc3ltX2J1ZiBpcyB0aHJlZSBieXRlcyAtLSB0d28gZm9yIHRoZSBkaXN0YW5jZSBhbmQgb25lIGZvciB0aGVcbiAgICogbGl0ZXJhbC9sZW5ndGguIEFzIGVhY2ggc3ltYm9sIGlzIGNvbnN1bWVkLCB0aGUgcG9pbnRlciB0byB0aGUgbmV4dFxuICAgKiBzeW1fYnVmIHZhbHVlIHRvIHJlYWQgbW92ZXMgZm9yd2FyZCB0aHJlZSBieXRlcy4gRnJvbSB0aGF0IHN5bWJvbCwgdXAgdG9cbiAgICogMzEgYml0cyBhcmUgd3JpdHRlbiB0byBwZW5kaW5nX2J1Zi4gVGhlIGNsb3Nlc3QgdGhlIHdyaXR0ZW4gcGVuZGluZ19idWZcbiAgICogYml0cyBnZXRzIHRvIHRoZSBuZXh0IHN5bV9idWYgc3ltYm9sIHRvIHJlYWQgaXMganVzdCBiZWZvcmUgdGhlIGxhc3RcbiAgICogY29kZSBpcyB3cml0dGVuLiBBdCB0aGF0IHRpbWUsIDMxKihuLTIpIGJpdHMgaGF2ZSBiZWVuIHdyaXR0ZW4sIGp1c3RcbiAgICogYWZ0ZXIgMjQqKG4tMikgYml0cyBoYXZlIGJlZW4gY29uc3VtZWQgZnJvbSBzeW1fYnVmLiBzeW1fYnVmIHN0YXJ0cyBhdFxuICAgKiA4Km4gYml0cyBpbnRvIHBlbmRpbmdfYnVmLiAoTm90ZSB0aGF0IHRoZSBzeW1ib2wgYnVmZmVyIGZpbGxzIHdoZW4gbi0xXG4gICAqIHN5bWJvbHMgYXJlIHdyaXR0ZW4uKSBUaGUgY2xvc2VzdCB0aGUgd3JpdGluZyBnZXRzIHRvIHdoYXQgaXMgdW5yZWFkIGlzXG4gICAqIHRoZW4gbisxNCBiaXRzLiBIZXJlIG4gaXMgbGl0X2J1ZnNpemUsIHdoaWNoIGlzIDE2Mzg0IGJ5IGRlZmF1bHQsIGFuZFxuICAgKiBjYW4gcmFuZ2UgZnJvbSAxMjggdG8gMzI3NjguXG4gICAqXG4gICAqIFRoZXJlZm9yZSwgYXQgYSBtaW5pbXVtLCB0aGVyZSBhcmUgMTQyIGJpdHMgb2Ygc3BhY2UgYmV0d2VlbiB3aGF0IGlzXG4gICAqIHdyaXR0ZW4gYW5kIHdoYXQgaXMgcmVhZCBpbiB0aGUgb3ZlcmxhaW4gYnVmZmVycywgc28gdGhlIHN5bWJvbHMgY2Fubm90XG4gICAqIGJlIG92ZXJ3cml0dGVuIGJ5IHRoZSBjb21wcmVzc2VkIGRhdGEuIFRoYXQgc3BhY2UgaXMgYWN0dWFsbHkgMTM5IGJpdHMsXG4gICAqIGR1ZSB0byB0aGUgdGhyZWUtYml0IGZpeGVkLWNvZGUgYmxvY2sgaGVhZGVyLlxuICAgKlxuICAgKiBUaGF0IGNvdmVycyB0aGUgY2FzZSB3aGVyZSBlaXRoZXIgWl9GSVhFRCBpcyBzcGVjaWZpZWQsIGZvcmNpbmcgZml4ZWRcbiAgICogY29kZXMsIG9yIHdoZW4gdGhlIHVzZSBvZiBmaXhlZCBjb2RlcyBpcyBjaG9zZW4sIGJlY2F1c2UgdGhhdCBjaG9pY2VcbiAgICogcmVzdWx0cyBpbiBhIHNtYWxsZXIgY29tcHJlc3NlZCBibG9jayB0aGFuIGR5bmFtaWMgY29kZXMuIFRoYXQgbGF0dGVyXG4gICAqIGNvbmRpdGlvbiB0aGVuIGFzc3VyZXMgdGhhdCB0aGUgYWJvdmUgYW5hbHlzaXMgYWxzbyBjb3ZlcnMgYWxsIGR5bmFtaWNcbiAgICogYmxvY2tzLiBBIGR5bmFtaWMtY29kZSBibG9jayB3aWxsIG9ubHkgYmUgY2hvc2VuIHRvIGJlIGVtaXR0ZWQgaWYgaXQgaGFzXG4gICAqIGZld2VyIGJpdHMgdGhhbiBhIGZpeGVkLWNvZGUgYmxvY2sgd291bGQgZm9yIHRoZSBzYW1lIHNldCBvZiBzeW1ib2xzLlxuICAgKiBUaGVyZWZvcmUgaXRzIGF2ZXJhZ2Ugc3ltYm9sIGxlbmd0aCBpcyBhc3N1cmVkIHRvIGJlIGxlc3MgdGhhbiAzMS4gU29cbiAgICogdGhlIGNvbXByZXNzZWQgZGF0YSBmb3IgYSBkeW5hbWljIGJsb2NrIGFsc28gY2Fubm90IG92ZXJ3cml0ZSB0aGVcbiAgICogc3ltYm9scyBmcm9tIHdoaWNoIGl0IGlzIGJlaW5nIGNvbnN0cnVjdGVkLlxuICAgKi9cblxuICBzLnBlbmRpbmdfYnVmX3NpemUgPSBzLmxpdF9idWZzaXplICogNDtcbiAgcy5wZW5kaW5nX2J1ZiA9IG5ldyBVaW50OEFycmF5KHMucGVuZGluZ19idWZfc2l6ZSk7XG5cbiAgLy8gSXQgaXMgb2Zmc2V0IGZyb20gYHMucGVuZGluZ19idWZgIChzaXplIGlzIGBzLmxpdF9idWZzaXplICogMmApXG4gIC8vcy0+c3ltX2J1ZiA9IHMtPnBlbmRpbmdfYnVmICsgcy0+bGl0X2J1ZnNpemU7XG4gIHMuc3ltX2J1ZiA9IHMubGl0X2J1ZnNpemU7XG5cbiAgLy9zLT5zeW1fZW5kID0gKHMtPmxpdF9idWZzaXplIC0gMSkgKiAzO1xuICBzLnN5bV9lbmQgPSAocy5saXRfYnVmc2l6ZSAtIDEpICogMztcbiAgLyogV2UgYXZvaWQgZXF1YWxpdHkgd2l0aCBsaXRfYnVmc2l6ZSozIGJlY2F1c2Ugb2Ygd3JhcGFyb3VuZCBhdCA2NEtcbiAgICogb24gMTYgYml0IG1hY2hpbmVzIGFuZCBiZWNhdXNlIHN0b3JlZCBibG9ja3MgYXJlIHJlc3RyaWN0ZWQgdG9cbiAgICogNjRLLTEgYnl0ZXMuXG4gICAqL1xuXG4gIHMubGV2ZWwgPSBsZXZlbDtcbiAgcy5zdHJhdGVneSA9IHN0cmF0ZWd5O1xuICBzLm1ldGhvZCA9IG1ldGhvZDtcblxuICByZXR1cm4gZGVmbGF0ZVJlc2V0KHN0cm0pO1xufTtcblxuY29uc3QgZGVmbGF0ZUluaXQgPSAoc3RybSwgbGV2ZWwpID0+IHtcblxuICByZXR1cm4gZGVmbGF0ZUluaXQyKHN0cm0sIGxldmVsLCBaX0RFRkxBVEVEJDIsIE1BWF9XQklUUyQxLCBERUZfTUVNX0xFVkVMLCBaX0RFRkFVTFRfU1RSQVRFR1kkMSk7XG59O1xuXG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cbmNvbnN0IGRlZmxhdGUkMiA9IChzdHJtLCBmbHVzaCkgPT4ge1xuXG4gIGlmIChkZWZsYXRlU3RhdGVDaGVjayhzdHJtKSB8fCBmbHVzaCA+IFpfQkxPQ0skMSB8fCBmbHVzaCA8IDApIHtcbiAgICByZXR1cm4gc3RybSA/IGVycihzdHJtLCBaX1NUUkVBTV9FUlJPUiQyKSA6IFpfU1RSRUFNX0VSUk9SJDI7XG4gIH1cblxuICBjb25zdCBzID0gc3RybS5zdGF0ZTtcblxuICBpZiAoIXN0cm0ub3V0cHV0IHx8XG4gICAgICAoc3RybS5hdmFpbF9pbiAhPT0gMCAmJiAhc3RybS5pbnB1dCkgfHxcbiAgICAgIChzLnN0YXR1cyA9PT0gRklOSVNIX1NUQVRFICYmIGZsdXNoICE9PSBaX0ZJTklTSCQzKSkge1xuICAgIHJldHVybiBlcnIoc3RybSwgKHN0cm0uYXZhaWxfb3V0ID09PSAwKSA/IFpfQlVGX0VSUk9SJDEgOiBaX1NUUkVBTV9FUlJPUiQyKTtcbiAgfVxuXG4gIGNvbnN0IG9sZF9mbHVzaCA9IHMubGFzdF9mbHVzaDtcbiAgcy5sYXN0X2ZsdXNoID0gZmx1c2g7XG5cbiAgLyogRmx1c2ggYXMgbXVjaCBwZW5kaW5nIG91dHB1dCBhcyBwb3NzaWJsZSAqL1xuICBpZiAocy5wZW5kaW5nICE9PSAwKSB7XG4gICAgZmx1c2hfcGVuZGluZyhzdHJtKTtcbiAgICBpZiAoc3RybS5hdmFpbF9vdXQgPT09IDApIHtcbiAgICAgIC8qIFNpbmNlIGF2YWlsX291dCBpcyAwLCBkZWZsYXRlIHdpbGwgYmUgY2FsbGVkIGFnYWluIHdpdGhcbiAgICAgICAqIG1vcmUgb3V0cHV0IHNwYWNlLCBidXQgcG9zc2libHkgd2l0aCBib3RoIHBlbmRpbmcgYW5kXG4gICAgICAgKiBhdmFpbF9pbiBlcXVhbCB0byB6ZXJvLiBUaGVyZSB3b24ndCBiZSBhbnl0aGluZyB0byBkbyxcbiAgICAgICAqIGJ1dCB0aGlzIGlzIG5vdCBhbiBlcnJvciBzaXR1YXRpb24gc28gbWFrZSBzdXJlIHdlXG4gICAgICAgKiByZXR1cm4gT0sgaW5zdGVhZCBvZiBCVUZfRVJST1IgYXQgbmV4dCBjYWxsIG9mIGRlZmxhdGU6XG4gICAgICAgKi9cbiAgICAgIHMubGFzdF9mbHVzaCA9IC0xO1xuICAgICAgcmV0dXJuIFpfT0skMztcbiAgICB9XG5cbiAgICAvKiBNYWtlIHN1cmUgdGhlcmUgaXMgc29tZXRoaW5nIHRvIGRvIGFuZCBhdm9pZCBkdXBsaWNhdGUgY29uc2VjdXRpdmVcbiAgICAgKiBmbHVzaGVzLiBGb3IgcmVwZWF0ZWQgYW5kIHVzZWxlc3MgY2FsbHMgd2l0aCBaX0ZJTklTSCwgd2Uga2VlcFxuICAgICAqIHJldHVybmluZyBaX1NUUkVBTV9FTkQgaW5zdGVhZCBvZiBaX0JVRl9FUlJPUi5cbiAgICAgKi9cbiAgfSBlbHNlIGlmIChzdHJtLmF2YWlsX2luID09PSAwICYmIHJhbmsoZmx1c2gpIDw9IHJhbmsob2xkX2ZsdXNoKSAmJlxuICAgIGZsdXNoICE9PSBaX0ZJTklTSCQzKSB7XG4gICAgcmV0dXJuIGVycihzdHJtLCBaX0JVRl9FUlJPUiQxKTtcbiAgfVxuXG4gIC8qIFVzZXIgbXVzdCBub3QgcHJvdmlkZSBtb3JlIGlucHV0IGFmdGVyIHRoZSBmaXJzdCBGSU5JU0g6ICovXG4gIGlmIChzLnN0YXR1cyA9PT0gRklOSVNIX1NUQVRFICYmIHN0cm0uYXZhaWxfaW4gIT09IDApIHtcbiAgICByZXR1cm4gZXJyKHN0cm0sIFpfQlVGX0VSUk9SJDEpO1xuICB9XG5cbiAgLyogV3JpdGUgdGhlIGhlYWRlciAqL1xuICBpZiAocy5zdGF0dXMgPT09IElOSVRfU1RBVEUgJiYgcy53cmFwID09PSAwKSB7XG4gICAgcy5zdGF0dXMgPSBCVVNZX1NUQVRFO1xuICB9XG4gIGlmIChzLnN0YXR1cyA9PT0gSU5JVF9TVEFURSkge1xuICAgIC8qIHpsaWIgaGVhZGVyICovXG4gICAgbGV0IGhlYWRlciA9IChaX0RFRkxBVEVEJDIgKyAoKHMud19iaXRzIC0gOCkgPDwgNCkpIDw8IDg7XG4gICAgbGV0IGxldmVsX2ZsYWdzID0gLTE7XG5cbiAgICBpZiAocy5zdHJhdGVneSA+PSBaX0hVRkZNQU5fT05MWSB8fCBzLmxldmVsIDwgMikge1xuICAgICAgbGV2ZWxfZmxhZ3MgPSAwO1xuICAgIH0gZWxzZSBpZiAocy5sZXZlbCA8IDYpIHtcbiAgICAgIGxldmVsX2ZsYWdzID0gMTtcbiAgICB9IGVsc2UgaWYgKHMubGV2ZWwgPT09IDYpIHtcbiAgICAgIGxldmVsX2ZsYWdzID0gMjtcbiAgICB9IGVsc2Uge1xuICAgICAgbGV2ZWxfZmxhZ3MgPSAzO1xuICAgIH1cbiAgICBoZWFkZXIgfD0gKGxldmVsX2ZsYWdzIDw8IDYpO1xuICAgIGlmIChzLnN0cnN0YXJ0ICE9PSAwKSB7IGhlYWRlciB8PSBQUkVTRVRfRElDVDsgfVxuICAgIGhlYWRlciArPSAzMSAtIChoZWFkZXIgJSAzMSk7XG5cbiAgICBwdXRTaG9ydE1TQihzLCBoZWFkZXIpO1xuXG4gICAgLyogU2F2ZSB0aGUgYWRsZXIzMiBvZiB0aGUgcHJlc2V0IGRpY3Rpb25hcnk6ICovXG4gICAgaWYgKHMuc3Ryc3RhcnQgIT09IDApIHtcbiAgICAgIHB1dFNob3J0TVNCKHMsIHN0cm0uYWRsZXIgPj4+IDE2KTtcbiAgICAgIHB1dFNob3J0TVNCKHMsIHN0cm0uYWRsZXIgJiAweGZmZmYpO1xuICAgIH1cbiAgICBzdHJtLmFkbGVyID0gMTsgLy8gYWRsZXIzMigwTCwgWl9OVUxMLCAwKTtcbiAgICBzLnN0YXR1cyA9IEJVU1lfU1RBVEU7XG5cbiAgICAvKiBDb21wcmVzc2lvbiBtdXN0IHN0YXJ0IHdpdGggYW4gZW1wdHkgcGVuZGluZyBidWZmZXIgKi9cbiAgICBmbHVzaF9wZW5kaW5nKHN0cm0pO1xuICAgIGlmIChzLnBlbmRpbmcgIT09IDApIHtcbiAgICAgIHMubGFzdF9mbHVzaCA9IC0xO1xuICAgICAgcmV0dXJuIFpfT0skMztcbiAgICB9XG4gIH1cbi8vI2lmZGVmIEdaSVBcbiAgaWYgKHMuc3RhdHVzID09PSBHWklQX1NUQVRFKSB7XG4gICAgLyogZ3ppcCBoZWFkZXIgKi9cbiAgICBzdHJtLmFkbGVyID0gMDsgIC8vY3JjMzIoMEwsIFpfTlVMTCwgMCk7XG4gICAgcHV0X2J5dGUocywgMzEpO1xuICAgIHB1dF9ieXRlKHMsIDEzOSk7XG4gICAgcHV0X2J5dGUocywgOCk7XG4gICAgaWYgKCFzLmd6aGVhZCkgeyAvLyBzLT5nemhlYWQgPT0gWl9OVUxMXG4gICAgICBwdXRfYnl0ZShzLCAwKTtcbiAgICAgIHB1dF9ieXRlKHMsIDApO1xuICAgICAgcHV0X2J5dGUocywgMCk7XG4gICAgICBwdXRfYnl0ZShzLCAwKTtcbiAgICAgIHB1dF9ieXRlKHMsIDApO1xuICAgICAgcHV0X2J5dGUocywgcy5sZXZlbCA9PT0gOSA/IDIgOlxuICAgICAgICAgICAgICAgICAgKHMuc3RyYXRlZ3kgPj0gWl9IVUZGTUFOX09OTFkgfHwgcy5sZXZlbCA8IDIgP1xuICAgICAgICAgICAgICAgICAgIDQgOiAwKSk7XG4gICAgICBwdXRfYnl0ZShzLCBPU19DT0RFKTtcbiAgICAgIHMuc3RhdHVzID0gQlVTWV9TVEFURTtcblxuICAgICAgLyogQ29tcHJlc3Npb24gbXVzdCBzdGFydCB3aXRoIGFuIGVtcHR5IHBlbmRpbmcgYnVmZmVyICovXG4gICAgICBmbHVzaF9wZW5kaW5nKHN0cm0pO1xuICAgICAgaWYgKHMucGVuZGluZyAhPT0gMCkge1xuICAgICAgICBzLmxhc3RfZmx1c2ggPSAtMTtcbiAgICAgICAgcmV0dXJuIFpfT0skMztcbiAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBwdXRfYnl0ZShzLCAocy5nemhlYWQudGV4dCA/IDEgOiAwKSArXG4gICAgICAgICAgICAgICAgICAocy5nemhlYWQuaGNyYyA/IDIgOiAwKSArXG4gICAgICAgICAgICAgICAgICAoIXMuZ3poZWFkLmV4dHJhID8gMCA6IDQpICtcbiAgICAgICAgICAgICAgICAgICghcy5nemhlYWQubmFtZSA/IDAgOiA4KSArXG4gICAgICAgICAgICAgICAgICAoIXMuZ3poZWFkLmNvbW1lbnQgPyAwIDogMTYpXG4gICAgICApO1xuICAgICAgcHV0X2J5dGUocywgcy5nemhlYWQudGltZSAmIDB4ZmYpO1xuICAgICAgcHV0X2J5dGUocywgKHMuZ3poZWFkLnRpbWUgPj4gOCkgJiAweGZmKTtcbiAgICAgIHB1dF9ieXRlKHMsIChzLmd6aGVhZC50aW1lID4+IDE2KSAmIDB4ZmYpO1xuICAgICAgcHV0X2J5dGUocywgKHMuZ3poZWFkLnRpbWUgPj4gMjQpICYgMHhmZik7XG4gICAgICBwdXRfYnl0ZShzLCBzLmxldmVsID09PSA5ID8gMiA6XG4gICAgICAgICAgICAgICAgICAocy5zdHJhdGVneSA+PSBaX0hVRkZNQU5fT05MWSB8fCBzLmxldmVsIDwgMiA/XG4gICAgICAgICAgICAgICAgICAgNCA6IDApKTtcbiAgICAgIHB1dF9ieXRlKHMsIHMuZ3poZWFkLm9zICYgMHhmZik7XG4gICAgICBpZiAocy5nemhlYWQuZXh0cmEgJiYgcy5nemhlYWQuZXh0cmEubGVuZ3RoKSB7XG4gICAgICAgIHB1dF9ieXRlKHMsIHMuZ3poZWFkLmV4dHJhLmxlbmd0aCAmIDB4ZmYpO1xuICAgICAgICBwdXRfYnl0ZShzLCAocy5nemhlYWQuZXh0cmEubGVuZ3RoID4+IDgpICYgMHhmZik7XG4gICAgICB9XG4gICAgICBpZiAocy5nemhlYWQuaGNyYykge1xuICAgICAgICBzdHJtLmFkbGVyID0gY3JjMzJfMShzdHJtLmFkbGVyLCBzLnBlbmRpbmdfYnVmLCBzLnBlbmRpbmcsIDApO1xuICAgICAgfVxuICAgICAgcy5nemluZGV4ID0gMDtcbiAgICAgIHMuc3RhdHVzID0gRVhUUkFfU1RBVEU7XG4gICAgfVxuICB9XG4gIGlmIChzLnN0YXR1cyA9PT0gRVhUUkFfU1RBVEUpIHtcbiAgICBpZiAocy5nemhlYWQuZXh0cmEvKiAhPSBaX05VTEwqLykge1xuICAgICAgbGV0IGJlZyA9IHMucGVuZGluZzsgICAvKiBzdGFydCBvZiBieXRlcyB0byB1cGRhdGUgY3JjICovXG4gICAgICBsZXQgbGVmdCA9IChzLmd6aGVhZC5leHRyYS5sZW5ndGggJiAweGZmZmYpIC0gcy5nemluZGV4O1xuICAgICAgd2hpbGUgKHMucGVuZGluZyArIGxlZnQgPiBzLnBlbmRpbmdfYnVmX3NpemUpIHtcbiAgICAgICAgbGV0IGNvcHkgPSBzLnBlbmRpbmdfYnVmX3NpemUgLSBzLnBlbmRpbmc7XG4gICAgICAgIC8vIHptZW1jcHkocy5wZW5kaW5nX2J1ZiArIHMucGVuZGluZyxcbiAgICAgICAgLy8gICAgcy5nemhlYWQuZXh0cmEgKyBzLmd6aW5kZXgsIGNvcHkpO1xuICAgICAgICBzLnBlbmRpbmdfYnVmLnNldChzLmd6aGVhZC5leHRyYS5zdWJhcnJheShzLmd6aW5kZXgsIHMuZ3ppbmRleCArIGNvcHkpLCBzLnBlbmRpbmcpO1xuICAgICAgICBzLnBlbmRpbmcgPSBzLnBlbmRpbmdfYnVmX3NpemU7XG4gICAgICAgIC8vLS0tIEhDUkNfVVBEQVRFKGJlZykgLS0tLy9cbiAgICAgICAgaWYgKHMuZ3poZWFkLmhjcmMgJiYgcy5wZW5kaW5nID4gYmVnKSB7XG4gICAgICAgICAgc3RybS5hZGxlciA9IGNyYzMyXzEoc3RybS5hZGxlciwgcy5wZW5kaW5nX2J1Ziwgcy5wZW5kaW5nIC0gYmVnLCBiZWcpO1xuICAgICAgICB9XG4gICAgICAgIC8vLS0tLy9cbiAgICAgICAgcy5nemluZGV4ICs9IGNvcHk7XG4gICAgICAgIGZsdXNoX3BlbmRpbmcoc3RybSk7XG4gICAgICAgIGlmIChzLnBlbmRpbmcgIT09IDApIHtcbiAgICAgICAgICBzLmxhc3RfZmx1c2ggPSAtMTtcbiAgICAgICAgICByZXR1cm4gWl9PSyQzO1xuICAgICAgICB9XG4gICAgICAgIGJlZyA9IDA7XG4gICAgICAgIGxlZnQgLT0gY29weTtcbiAgICAgIH1cbiAgICAgIC8vIEpTIHNwZWNpZmljOiBzLmd6aGVhZC5leHRyYSBtYXkgYmUgVHlwZWRBcnJheSBvciBBcnJheSBmb3IgYmFja3dhcmQgY29tcGF0aWJpbGl0eVxuICAgICAgLy8gICAgICAgICAgICAgIFR5cGVkQXJyYXkuc2xpY2UgYW5kIFR5cGVkQXJyYXkuZnJvbSBkb24ndCBleGlzdCBpbiBJRTEwLUlFMTFcbiAgICAgIGxldCBnemhlYWRfZXh0cmEgPSBuZXcgVWludDhBcnJheShzLmd6aGVhZC5leHRyYSk7XG4gICAgICAvLyB6bWVtY3B5KHMtPnBlbmRpbmdfYnVmICsgcy0+cGVuZGluZyxcbiAgICAgIC8vICAgICBzLT5nemhlYWQtPmV4dHJhICsgcy0+Z3ppbmRleCwgbGVmdCk7XG4gICAgICBzLnBlbmRpbmdfYnVmLnNldChnemhlYWRfZXh0cmEuc3ViYXJyYXkocy5nemluZGV4LCBzLmd6aW5kZXggKyBsZWZ0KSwgcy5wZW5kaW5nKTtcbiAgICAgIHMucGVuZGluZyArPSBsZWZ0O1xuICAgICAgLy8tLS0gSENSQ19VUERBVEUoYmVnKSAtLS0vL1xuICAgICAgaWYgKHMuZ3poZWFkLmhjcmMgJiYgcy5wZW5kaW5nID4gYmVnKSB7XG4gICAgICAgIHN0cm0uYWRsZXIgPSBjcmMzMl8xKHN0cm0uYWRsZXIsIHMucGVuZGluZ19idWYsIHMucGVuZGluZyAtIGJlZywgYmVnKTtcbiAgICAgIH1cbiAgICAgIC8vLS0tLy9cbiAgICAgIHMuZ3ppbmRleCA9IDA7XG4gICAgfVxuICAgIHMuc3RhdHVzID0gTkFNRV9TVEFURTtcbiAgfVxuICBpZiAocy5zdGF0dXMgPT09IE5BTUVfU1RBVEUpIHtcbiAgICBpZiAocy5nemhlYWQubmFtZS8qICE9IFpfTlVMTCovKSB7XG4gICAgICBsZXQgYmVnID0gcy5wZW5kaW5nOyAgIC8qIHN0YXJ0IG9mIGJ5dGVzIHRvIHVwZGF0ZSBjcmMgKi9cbiAgICAgIGxldCB2YWw7XG4gICAgICBkbyB7XG4gICAgICAgIGlmIChzLnBlbmRpbmcgPT09IHMucGVuZGluZ19idWZfc2l6ZSkge1xuICAgICAgICAgIC8vLS0tIEhDUkNfVVBEQVRFKGJlZykgLS0tLy9cbiAgICAgICAgICBpZiAocy5nemhlYWQuaGNyYyAmJiBzLnBlbmRpbmcgPiBiZWcpIHtcbiAgICAgICAgICAgIHN0cm0uYWRsZXIgPSBjcmMzMl8xKHN0cm0uYWRsZXIsIHMucGVuZGluZ19idWYsIHMucGVuZGluZyAtIGJlZywgYmVnKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8tLS0vL1xuICAgICAgICAgIGZsdXNoX3BlbmRpbmcoc3RybSk7XG4gICAgICAgICAgaWYgKHMucGVuZGluZyAhPT0gMCkge1xuICAgICAgICAgICAgcy5sYXN0X2ZsdXNoID0gLTE7XG4gICAgICAgICAgICByZXR1cm4gWl9PSyQzO1xuICAgICAgICAgIH1cbiAgICAgICAgICBiZWcgPSAwO1xuICAgICAgICB9XG4gICAgICAgIC8vIEpTIHNwZWNpZmljOiBsaXR0bGUgbWFnaWMgdG8gYWRkIHplcm8gdGVybWluYXRvciB0byBlbmQgb2Ygc3RyaW5nXG4gICAgICAgIGlmIChzLmd6aW5kZXggPCBzLmd6aGVhZC5uYW1lLmxlbmd0aCkge1xuICAgICAgICAgIHZhbCA9IHMuZ3poZWFkLm5hbWUuY2hhckNvZGVBdChzLmd6aW5kZXgrKykgJiAweGZmO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhbCA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgcHV0X2J5dGUocywgdmFsKTtcbiAgICAgIH0gd2hpbGUgKHZhbCAhPT0gMCk7XG4gICAgICAvLy0tLSBIQ1JDX1VQREFURShiZWcpIC0tLS8vXG4gICAgICBpZiAocy5nemhlYWQuaGNyYyAmJiBzLnBlbmRpbmcgPiBiZWcpIHtcbiAgICAgICAgc3RybS5hZGxlciA9IGNyYzMyXzEoc3RybS5hZGxlciwgcy5wZW5kaW5nX2J1Ziwgcy5wZW5kaW5nIC0gYmVnLCBiZWcpO1xuICAgICAgfVxuICAgICAgLy8tLS0vL1xuICAgICAgcy5nemluZGV4ID0gMDtcbiAgICB9XG4gICAgcy5zdGF0dXMgPSBDT01NRU5UX1NUQVRFO1xuICB9XG4gIGlmIChzLnN0YXR1cyA9PT0gQ09NTUVOVF9TVEFURSkge1xuICAgIGlmIChzLmd6aGVhZC5jb21tZW50LyogIT0gWl9OVUxMKi8pIHtcbiAgICAgIGxldCBiZWcgPSBzLnBlbmRpbmc7ICAgLyogc3RhcnQgb2YgYnl0ZXMgdG8gdXBkYXRlIGNyYyAqL1xuICAgICAgbGV0IHZhbDtcbiAgICAgIGRvIHtcbiAgICAgICAgaWYgKHMucGVuZGluZyA9PT0gcy5wZW5kaW5nX2J1Zl9zaXplKSB7XG4gICAgICAgICAgLy8tLS0gSENSQ19VUERBVEUoYmVnKSAtLS0vL1xuICAgICAgICAgIGlmIChzLmd6aGVhZC5oY3JjICYmIHMucGVuZGluZyA+IGJlZykge1xuICAgICAgICAgICAgc3RybS5hZGxlciA9IGNyYzMyXzEoc3RybS5hZGxlciwgcy5wZW5kaW5nX2J1Ziwgcy5wZW5kaW5nIC0gYmVnLCBiZWcpO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLy0tLS8vXG4gICAgICAgICAgZmx1c2hfcGVuZGluZyhzdHJtKTtcbiAgICAgICAgICBpZiAocy5wZW5kaW5nICE9PSAwKSB7XG4gICAgICAgICAgICBzLmxhc3RfZmx1c2ggPSAtMTtcbiAgICAgICAgICAgIHJldHVybiBaX09LJDM7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJlZyA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgLy8gSlMgc3BlY2lmaWM6IGxpdHRsZSBtYWdpYyB0byBhZGQgemVybyB0ZXJtaW5hdG9yIHRvIGVuZCBvZiBzdHJpbmdcbiAgICAgICAgaWYgKHMuZ3ppbmRleCA8IHMuZ3poZWFkLmNvbW1lbnQubGVuZ3RoKSB7XG4gICAgICAgICAgdmFsID0gcy5nemhlYWQuY29tbWVudC5jaGFyQ29kZUF0KHMuZ3ppbmRleCsrKSAmIDB4ZmY7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFsID0gMDtcbiAgICAgICAgfVxuICAgICAgICBwdXRfYnl0ZShzLCB2YWwpO1xuICAgICAgfSB3aGlsZSAodmFsICE9PSAwKTtcbiAgICAgIC8vLS0tIEhDUkNfVVBEQVRFKGJlZykgLS0tLy9cbiAgICAgIGlmIChzLmd6aGVhZC5oY3JjICYmIHMucGVuZGluZyA+IGJlZykge1xuICAgICAgICBzdHJtLmFkbGVyID0gY3JjMzJfMShzdHJtLmFkbGVyLCBzLnBlbmRpbmdfYnVmLCBzLnBlbmRpbmcgLSBiZWcsIGJlZyk7XG4gICAgICB9XG4gICAgICAvLy0tLS8vXG4gICAgfVxuICAgIHMuc3RhdHVzID0gSENSQ19TVEFURTtcbiAgfVxuICBpZiAocy5zdGF0dXMgPT09IEhDUkNfU1RBVEUpIHtcbiAgICBpZiAocy5nemhlYWQuaGNyYykge1xuICAgICAgaWYgKHMucGVuZGluZyArIDIgPiBzLnBlbmRpbmdfYnVmX3NpemUpIHtcbiAgICAgICAgZmx1c2hfcGVuZGluZyhzdHJtKTtcbiAgICAgICAgaWYgKHMucGVuZGluZyAhPT0gMCkge1xuICAgICAgICAgIHMubGFzdF9mbHVzaCA9IC0xO1xuICAgICAgICAgIHJldHVybiBaX09LJDM7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHB1dF9ieXRlKHMsIHN0cm0uYWRsZXIgJiAweGZmKTtcbiAgICAgIHB1dF9ieXRlKHMsIChzdHJtLmFkbGVyID4+IDgpICYgMHhmZik7XG4gICAgICBzdHJtLmFkbGVyID0gMDsgLy9jcmMzMigwTCwgWl9OVUxMLCAwKTtcbiAgICB9XG4gICAgcy5zdGF0dXMgPSBCVVNZX1NUQVRFO1xuXG4gICAgLyogQ29tcHJlc3Npb24gbXVzdCBzdGFydCB3aXRoIGFuIGVtcHR5IHBlbmRpbmcgYnVmZmVyICovXG4gICAgZmx1c2hfcGVuZGluZyhzdHJtKTtcbiAgICBpZiAocy5wZW5kaW5nICE9PSAwKSB7XG4gICAgICBzLmxhc3RfZmx1c2ggPSAtMTtcbiAgICAgIHJldHVybiBaX09LJDM7XG4gICAgfVxuICB9XG4vLyNlbmRpZlxuXG4gIC8qIFN0YXJ0IGEgbmV3IGJsb2NrIG9yIGNvbnRpbnVlIHRoZSBjdXJyZW50IG9uZS5cbiAgICovXG4gIGlmIChzdHJtLmF2YWlsX2luICE9PSAwIHx8IHMubG9va2FoZWFkICE9PSAwIHx8XG4gICAgKGZsdXNoICE9PSBaX05PX0ZMVVNIJDIgJiYgcy5zdGF0dXMgIT09IEZJTklTSF9TVEFURSkpIHtcbiAgICBsZXQgYnN0YXRlID0gcy5sZXZlbCA9PT0gMCA/IGRlZmxhdGVfc3RvcmVkKHMsIGZsdXNoKSA6XG4gICAgICAgICAgICAgICAgIHMuc3RyYXRlZ3kgPT09IFpfSFVGRk1BTl9PTkxZID8gZGVmbGF0ZV9odWZmKHMsIGZsdXNoKSA6XG4gICAgICAgICAgICAgICAgIHMuc3RyYXRlZ3kgPT09IFpfUkxFID8gZGVmbGF0ZV9ybGUocywgZmx1c2gpIDpcbiAgICAgICAgICAgICAgICAgY29uZmlndXJhdGlvbl90YWJsZVtzLmxldmVsXS5mdW5jKHMsIGZsdXNoKTtcblxuICAgIGlmIChic3RhdGUgPT09IEJTX0ZJTklTSF9TVEFSVEVEIHx8IGJzdGF0ZSA9PT0gQlNfRklOSVNIX0RPTkUpIHtcbiAgICAgIHMuc3RhdHVzID0gRklOSVNIX1NUQVRFO1xuICAgIH1cbiAgICBpZiAoYnN0YXRlID09PSBCU19ORUVEX01PUkUgfHwgYnN0YXRlID09PSBCU19GSU5JU0hfU1RBUlRFRCkge1xuICAgICAgaWYgKHN0cm0uYXZhaWxfb3V0ID09PSAwKSB7XG4gICAgICAgIHMubGFzdF9mbHVzaCA9IC0xO1xuICAgICAgICAvKiBhdm9pZCBCVUZfRVJST1IgbmV4dCBjYWxsLCBzZWUgYWJvdmUgKi9cbiAgICAgIH1cbiAgICAgIHJldHVybiBaX09LJDM7XG4gICAgICAvKiBJZiBmbHVzaCAhPSBaX05PX0ZMVVNIICYmIGF2YWlsX291dCA9PSAwLCB0aGUgbmV4dCBjYWxsXG4gICAgICAgKiBvZiBkZWZsYXRlIHNob3VsZCB1c2UgdGhlIHNhbWUgZmx1c2ggcGFyYW1ldGVyIHRvIG1ha2Ugc3VyZVxuICAgICAgICogdGhhdCB0aGUgZmx1c2ggaXMgY29tcGxldGUuIFNvIHdlIGRvbid0IGhhdmUgdG8gb3V0cHV0IGFuXG4gICAgICAgKiBlbXB0eSBibG9jayBoZXJlLCB0aGlzIHdpbGwgYmUgZG9uZSBhdCBuZXh0IGNhbGwuIFRoaXMgYWxzb1xuICAgICAgICogZW5zdXJlcyB0aGF0IGZvciBhIHZlcnkgc21hbGwgb3V0cHV0IGJ1ZmZlciwgd2UgZW1pdCBhdCBtb3N0XG4gICAgICAgKiBvbmUgZW1wdHkgYmxvY2suXG4gICAgICAgKi9cbiAgICB9XG4gICAgaWYgKGJzdGF0ZSA9PT0gQlNfQkxPQ0tfRE9ORSkge1xuICAgICAgaWYgKGZsdXNoID09PSBaX1BBUlRJQUxfRkxVU0gpIHtcbiAgICAgICAgX3RyX2FsaWduKHMpO1xuICAgICAgfVxuICAgICAgZWxzZSBpZiAoZmx1c2ggIT09IFpfQkxPQ0skMSkgeyAvKiBGVUxMX0ZMVVNIIG9yIFNZTkNfRkxVU0ggKi9cblxuICAgICAgICBfdHJfc3RvcmVkX2Jsb2NrKHMsIDAsIDAsIGZhbHNlKTtcbiAgICAgICAgLyogRm9yIGEgZnVsbCBmbHVzaCwgdGhpcyBlbXB0eSBibG9jayB3aWxsIGJlIHJlY29nbml6ZWRcbiAgICAgICAgICogYXMgYSBzcGVjaWFsIG1hcmtlciBieSBpbmZsYXRlX3N5bmMoKS5cbiAgICAgICAgICovXG4gICAgICAgIGlmIChmbHVzaCA9PT0gWl9GVUxMX0ZMVVNIJDEpIHtcbiAgICAgICAgICAvKioqIENMRUFSX0hBU0gocyk7ICoqKi8gICAgICAgICAgICAgLyogZm9yZ2V0IGhpc3RvcnkgKi9cbiAgICAgICAgICB6ZXJvKHMuaGVhZCk7IC8vIEZpbGwgd2l0aCBOSUwgKD0gMCk7XG5cbiAgICAgICAgICBpZiAocy5sb29rYWhlYWQgPT09IDApIHtcbiAgICAgICAgICAgIHMuc3Ryc3RhcnQgPSAwO1xuICAgICAgICAgICAgcy5ibG9ja19zdGFydCA9IDA7XG4gICAgICAgICAgICBzLmluc2VydCA9IDA7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBmbHVzaF9wZW5kaW5nKHN0cm0pO1xuICAgICAgaWYgKHN0cm0uYXZhaWxfb3V0ID09PSAwKSB7XG4gICAgICAgIHMubGFzdF9mbHVzaCA9IC0xOyAvKiBhdm9pZCBCVUZfRVJST1IgYXQgbmV4dCBjYWxsLCBzZWUgYWJvdmUgKi9cbiAgICAgICAgcmV0dXJuIFpfT0skMztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBpZiAoZmx1c2ggIT09IFpfRklOSVNIJDMpIHsgcmV0dXJuIFpfT0skMzsgfVxuICBpZiAocy53cmFwIDw9IDApIHsgcmV0dXJuIFpfU1RSRUFNX0VORCQzOyB9XG5cbiAgLyogV3JpdGUgdGhlIHRyYWlsZXIgKi9cbiAgaWYgKHMud3JhcCA9PT0gMikge1xuICAgIHB1dF9ieXRlKHMsIHN0cm0uYWRsZXIgJiAweGZmKTtcbiAgICBwdXRfYnl0ZShzLCAoc3RybS5hZGxlciA+PiA4KSAmIDB4ZmYpO1xuICAgIHB1dF9ieXRlKHMsIChzdHJtLmFkbGVyID4+IDE2KSAmIDB4ZmYpO1xuICAgIHB1dF9ieXRlKHMsIChzdHJtLmFkbGVyID4+IDI0KSAmIDB4ZmYpO1xuICAgIHB1dF9ieXRlKHMsIHN0cm0udG90YWxfaW4gJiAweGZmKTtcbiAgICBwdXRfYnl0ZShzLCAoc3RybS50b3RhbF9pbiA+PiA4KSAmIDB4ZmYpO1xuICAgIHB1dF9ieXRlKHMsIChzdHJtLnRvdGFsX2luID4+IDE2KSAmIDB4ZmYpO1xuICAgIHB1dF9ieXRlKHMsIChzdHJtLnRvdGFsX2luID4+IDI0KSAmIDB4ZmYpO1xuICB9XG4gIGVsc2VcbiAge1xuICAgIHB1dFNob3J0TVNCKHMsIHN0cm0uYWRsZXIgPj4+IDE2KTtcbiAgICBwdXRTaG9ydE1TQihzLCBzdHJtLmFkbGVyICYgMHhmZmZmKTtcbiAgfVxuXG4gIGZsdXNoX3BlbmRpbmcoc3RybSk7XG4gIC8qIElmIGF2YWlsX291dCBpcyB6ZXJvLCB0aGUgYXBwbGljYXRpb24gd2lsbCBjYWxsIGRlZmxhdGUgYWdhaW5cbiAgICogdG8gZmx1c2ggdGhlIHJlc3QuXG4gICAqL1xuICBpZiAocy53cmFwID4gMCkgeyBzLndyYXAgPSAtcy53cmFwOyB9XG4gIC8qIHdyaXRlIHRoZSB0cmFpbGVyIG9ubHkgb25jZSEgKi9cbiAgcmV0dXJuIHMucGVuZGluZyAhPT0gMCA/IFpfT0skMyA6IFpfU1RSRUFNX0VORCQzO1xufTtcblxuXG5jb25zdCBkZWZsYXRlRW5kID0gKHN0cm0pID0+IHtcblxuICBpZiAoZGVmbGF0ZVN0YXRlQ2hlY2soc3RybSkpIHtcbiAgICByZXR1cm4gWl9TVFJFQU1fRVJST1IkMjtcbiAgfVxuXG4gIGNvbnN0IHN0YXR1cyA9IHN0cm0uc3RhdGUuc3RhdHVzO1xuXG4gIHN0cm0uc3RhdGUgPSBudWxsO1xuXG4gIHJldHVybiBzdGF0dXMgPT09IEJVU1lfU1RBVEUgPyBlcnIoc3RybSwgWl9EQVRBX0VSUk9SJDIpIDogWl9PSyQzO1xufTtcblxuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBJbml0aWFsaXplcyB0aGUgY29tcHJlc3Npb24gZGljdGlvbmFyeSBmcm9tIHRoZSBnaXZlbiBieXRlXG4gKiBzZXF1ZW5jZSB3aXRob3V0IHByb2R1Y2luZyBhbnkgY29tcHJlc3NlZCBvdXRwdXQuXG4gKi9cbmNvbnN0IGRlZmxhdGVTZXREaWN0aW9uYXJ5ID0gKHN0cm0sIGRpY3Rpb25hcnkpID0+IHtcblxuICBsZXQgZGljdExlbmd0aCA9IGRpY3Rpb25hcnkubGVuZ3RoO1xuXG4gIGlmIChkZWZsYXRlU3RhdGVDaGVjayhzdHJtKSkge1xuICAgIHJldHVybiBaX1NUUkVBTV9FUlJPUiQyO1xuICB9XG5cbiAgY29uc3QgcyA9IHN0cm0uc3RhdGU7XG4gIGNvbnN0IHdyYXAgPSBzLndyYXA7XG5cbiAgaWYgKHdyYXAgPT09IDIgfHwgKHdyYXAgPT09IDEgJiYgcy5zdGF0dXMgIT09IElOSVRfU1RBVEUpIHx8IHMubG9va2FoZWFkKSB7XG4gICAgcmV0dXJuIFpfU1RSRUFNX0VSUk9SJDI7XG4gIH1cblxuICAvKiB3aGVuIHVzaW5nIHpsaWIgd3JhcHBlcnMsIGNvbXB1dGUgQWRsZXItMzIgZm9yIHByb3ZpZGVkIGRpY3Rpb25hcnkgKi9cbiAgaWYgKHdyYXAgPT09IDEpIHtcbiAgICAvKiBhZGxlcjMyKHN0cm0tPmFkbGVyLCBkaWN0aW9uYXJ5LCBkaWN0TGVuZ3RoKTsgKi9cbiAgICBzdHJtLmFkbGVyID0gYWRsZXIzMl8xKHN0cm0uYWRsZXIsIGRpY3Rpb25hcnksIGRpY3RMZW5ndGgsIDApO1xuICB9XG5cbiAgcy53cmFwID0gMDsgICAvKiBhdm9pZCBjb21wdXRpbmcgQWRsZXItMzIgaW4gcmVhZF9idWYgKi9cblxuICAvKiBpZiBkaWN0aW9uYXJ5IHdvdWxkIGZpbGwgd2luZG93LCBqdXN0IHJlcGxhY2UgdGhlIGhpc3RvcnkgKi9cbiAgaWYgKGRpY3RMZW5ndGggPj0gcy53X3NpemUpIHtcbiAgICBpZiAod3JhcCA9PT0gMCkgeyAgICAgICAgICAgIC8qIGFscmVhZHkgZW1wdHkgb3RoZXJ3aXNlICovXG4gICAgICAvKioqIENMRUFSX0hBU0gocyk7ICoqKi9cbiAgICAgIHplcm8ocy5oZWFkKTsgLy8gRmlsbCB3aXRoIE5JTCAoPSAwKTtcbiAgICAgIHMuc3Ryc3RhcnQgPSAwO1xuICAgICAgcy5ibG9ja19zdGFydCA9IDA7XG4gICAgICBzLmluc2VydCA9IDA7XG4gICAgfVxuICAgIC8qIHVzZSB0aGUgdGFpbCAqL1xuICAgIC8vIGRpY3Rpb25hcnkgPSBkaWN0aW9uYXJ5LnNsaWNlKGRpY3RMZW5ndGggLSBzLndfc2l6ZSk7XG4gICAgbGV0IHRtcERpY3QgPSBuZXcgVWludDhBcnJheShzLndfc2l6ZSk7XG4gICAgdG1wRGljdC5zZXQoZGljdGlvbmFyeS5zdWJhcnJheShkaWN0TGVuZ3RoIC0gcy53X3NpemUsIGRpY3RMZW5ndGgpLCAwKTtcbiAgICBkaWN0aW9uYXJ5ID0gdG1wRGljdDtcbiAgICBkaWN0TGVuZ3RoID0gcy53X3NpemU7XG4gIH1cbiAgLyogaW5zZXJ0IGRpY3Rpb25hcnkgaW50byB3aW5kb3cgYW5kIGhhc2ggKi9cbiAgY29uc3QgYXZhaWwgPSBzdHJtLmF2YWlsX2luO1xuICBjb25zdCBuZXh0ID0gc3RybS5uZXh0X2luO1xuICBjb25zdCBpbnB1dCA9IHN0cm0uaW5wdXQ7XG4gIHN0cm0uYXZhaWxfaW4gPSBkaWN0TGVuZ3RoO1xuICBzdHJtLm5leHRfaW4gPSAwO1xuICBzdHJtLmlucHV0ID0gZGljdGlvbmFyeTtcbiAgZmlsbF93aW5kb3cocyk7XG4gIHdoaWxlIChzLmxvb2thaGVhZCA+PSBNSU5fTUFUQ0gpIHtcbiAgICBsZXQgc3RyID0gcy5zdHJzdGFydDtcbiAgICBsZXQgbiA9IHMubG9va2FoZWFkIC0gKE1JTl9NQVRDSCAtIDEpO1xuICAgIGRvIHtcbiAgICAgIC8qIFVQREFURV9IQVNIKHMsIHMtPmluc19oLCBzLT53aW5kb3dbc3RyICsgTUlOX01BVENILTFdKTsgKi9cbiAgICAgIHMuaW5zX2ggPSBIQVNIKHMsIHMuaW5zX2gsIHMud2luZG93W3N0ciArIE1JTl9NQVRDSCAtIDFdKTtcblxuICAgICAgcy5wcmV2W3N0ciAmIHMud19tYXNrXSA9IHMuaGVhZFtzLmluc19oXTtcblxuICAgICAgcy5oZWFkW3MuaW5zX2hdID0gc3RyO1xuICAgICAgc3RyKys7XG4gICAgfSB3aGlsZSAoLS1uKTtcbiAgICBzLnN0cnN0YXJ0ID0gc3RyO1xuICAgIHMubG9va2FoZWFkID0gTUlOX01BVENIIC0gMTtcbiAgICBmaWxsX3dpbmRvdyhzKTtcbiAgfVxuICBzLnN0cnN0YXJ0ICs9IHMubG9va2FoZWFkO1xuICBzLmJsb2NrX3N0YXJ0ID0gcy5zdHJzdGFydDtcbiAgcy5pbnNlcnQgPSBzLmxvb2thaGVhZDtcbiAgcy5sb29rYWhlYWQgPSAwO1xuICBzLm1hdGNoX2xlbmd0aCA9IHMucHJldl9sZW5ndGggPSBNSU5fTUFUQ0ggLSAxO1xuICBzLm1hdGNoX2F2YWlsYWJsZSA9IDA7XG4gIHN0cm0ubmV4dF9pbiA9IG5leHQ7XG4gIHN0cm0uaW5wdXQgPSBpbnB1dDtcbiAgc3RybS5hdmFpbF9pbiA9IGF2YWlsO1xuICBzLndyYXAgPSB3cmFwO1xuICByZXR1cm4gWl9PSyQzO1xufTtcblxuXG52YXIgZGVmbGF0ZUluaXRfMSA9IGRlZmxhdGVJbml0O1xudmFyIGRlZmxhdGVJbml0Ml8xID0gZGVmbGF0ZUluaXQyO1xudmFyIGRlZmxhdGVSZXNldF8xID0gZGVmbGF0ZVJlc2V0O1xudmFyIGRlZmxhdGVSZXNldEtlZXBfMSA9IGRlZmxhdGVSZXNldEtlZXA7XG52YXIgZGVmbGF0ZVNldEhlYWRlcl8xID0gZGVmbGF0ZVNldEhlYWRlcjtcbnZhciBkZWZsYXRlXzIkMSA9IGRlZmxhdGUkMjtcbnZhciBkZWZsYXRlRW5kXzEgPSBkZWZsYXRlRW5kO1xudmFyIGRlZmxhdGVTZXREaWN0aW9uYXJ5XzEgPSBkZWZsYXRlU2V0RGljdGlvbmFyeTtcbnZhciBkZWZsYXRlSW5mbyA9ICdwYWtvIGRlZmxhdGUgKGZyb20gTm9kZWNhIHByb2plY3QpJztcblxuLyogTm90IGltcGxlbWVudGVkXG5tb2R1bGUuZXhwb3J0cy5kZWZsYXRlQm91bmQgPSBkZWZsYXRlQm91bmQ7XG5tb2R1bGUuZXhwb3J0cy5kZWZsYXRlQ29weSA9IGRlZmxhdGVDb3B5O1xubW9kdWxlLmV4cG9ydHMuZGVmbGF0ZUdldERpY3Rpb25hcnkgPSBkZWZsYXRlR2V0RGljdGlvbmFyeTtcbm1vZHVsZS5leHBvcnRzLmRlZmxhdGVQYXJhbXMgPSBkZWZsYXRlUGFyYW1zO1xubW9kdWxlLmV4cG9ydHMuZGVmbGF0ZVBlbmRpbmcgPSBkZWZsYXRlUGVuZGluZztcbm1vZHVsZS5leHBvcnRzLmRlZmxhdGVQcmltZSA9IGRlZmxhdGVQcmltZTtcbm1vZHVsZS5leHBvcnRzLmRlZmxhdGVUdW5lID0gZGVmbGF0ZVR1bmU7XG4qL1xuXG52YXIgZGVmbGF0ZV8xJDIgPSB7XG5cdGRlZmxhdGVJbml0OiBkZWZsYXRlSW5pdF8xLFxuXHRkZWZsYXRlSW5pdDI6IGRlZmxhdGVJbml0Ml8xLFxuXHRkZWZsYXRlUmVzZXQ6IGRlZmxhdGVSZXNldF8xLFxuXHRkZWZsYXRlUmVzZXRLZWVwOiBkZWZsYXRlUmVzZXRLZWVwXzEsXG5cdGRlZmxhdGVTZXRIZWFkZXI6IGRlZmxhdGVTZXRIZWFkZXJfMSxcblx0ZGVmbGF0ZTogZGVmbGF0ZV8yJDEsXG5cdGRlZmxhdGVFbmQ6IGRlZmxhdGVFbmRfMSxcblx0ZGVmbGF0ZVNldERpY3Rpb25hcnk6IGRlZmxhdGVTZXREaWN0aW9uYXJ5XzEsXG5cdGRlZmxhdGVJbmZvOiBkZWZsYXRlSW5mb1xufTtcblxuY29uc3QgX2hhcyA9IChvYmosIGtleSkgPT4ge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwga2V5KTtcbn07XG5cbnZhciBhc3NpZ24gPSBmdW5jdGlvbiAob2JqIC8qZnJvbTEsIGZyb20yLCBmcm9tMywgLi4uKi8pIHtcbiAgY29uc3Qgc291cmNlcyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gIHdoaWxlIChzb3VyY2VzLmxlbmd0aCkge1xuICAgIGNvbnN0IHNvdXJjZSA9IHNvdXJjZXMuc2hpZnQoKTtcbiAgICBpZiAoIXNvdXJjZSkgeyBjb250aW51ZTsgfVxuXG4gICAgaWYgKHR5cGVvZiBzb3VyY2UgIT09ICdvYmplY3QnKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKHNvdXJjZSArICdtdXN0IGJlIG5vbi1vYmplY3QnKTtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IHAgaW4gc291cmNlKSB7XG4gICAgICBpZiAoX2hhcyhzb3VyY2UsIHApKSB7XG4gICAgICAgIG9ialtwXSA9IHNvdXJjZVtwXTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gb2JqO1xufTtcblxuXG4vLyBKb2luIGFycmF5IG9mIGNodW5rcyB0byBzaW5nbGUgYXJyYXkuXG52YXIgZmxhdHRlbkNodW5rcyA9IChjaHVua3MpID0+IHtcbiAgLy8gY2FsY3VsYXRlIGRhdGEgbGVuZ3RoXG4gIGxldCBsZW4gPSAwO1xuXG4gIGZvciAobGV0IGkgPSAwLCBsID0gY2h1bmtzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgIGxlbiArPSBjaHVua3NbaV0ubGVuZ3RoO1xuICB9XG5cbiAgLy8gam9pbiBjaHVua3NcbiAgY29uc3QgcmVzdWx0ID0gbmV3IFVpbnQ4QXJyYXkobGVuKTtcblxuICBmb3IgKGxldCBpID0gMCwgcG9zID0gMCwgbCA9IGNodW5rcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICBsZXQgY2h1bmsgPSBjaHVua3NbaV07XG4gICAgcmVzdWx0LnNldChjaHVuaywgcG9zKTtcbiAgICBwb3MgKz0gY2h1bmsubGVuZ3RoO1xuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbnZhciBjb21tb24gPSB7XG5cdGFzc2lnbjogYXNzaWduLFxuXHRmbGF0dGVuQ2h1bmtzOiBmbGF0dGVuQ2h1bmtzXG59O1xuXG4vLyBTdHJpbmcgZW5jb2RlL2RlY29kZSBoZWxwZXJzXG5cblxuLy8gUXVpY2sgY2hlY2sgaWYgd2UgY2FuIHVzZSBmYXN0IGFycmF5IHRvIGJpbiBzdHJpbmcgY29udmVyc2lvblxuLy9cbi8vIC0gYXBwbHkoQXJyYXkpIGNhbiBmYWlsIG9uIEFuZHJvaWQgMi4yXG4vLyAtIGFwcGx5KFVpbnQ4QXJyYXkpIGNhbiBmYWlsIG9uIGlPUyA1LjEgU2FmYXJpXG4vL1xubGV0IFNUUl9BUFBMWV9VSUFfT0sgPSB0cnVlO1xuXG50cnkgeyBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KG51bGwsIG5ldyBVaW50OEFycmF5KDEpKTsgfSBjYXRjaCAoX18pIHsgU1RSX0FQUExZX1VJQV9PSyA9IGZhbHNlOyB9XG5cblxuLy8gVGFibGUgd2l0aCB1dGY4IGxlbmd0aHMgKGNhbGN1bGF0ZWQgYnkgZmlyc3QgYnl0ZSBvZiBzZXF1ZW5jZSlcbi8vIE5vdGUsIHRoYXQgNSAmIDYtYnl0ZSB2YWx1ZXMgYW5kIHNvbWUgNC1ieXRlIHZhbHVlcyBjYW4gbm90IGJlIHJlcHJlc2VudGVkIGluIEpTLFxuLy8gYmVjYXVzZSBtYXggcG9zc2libGUgY29kZXBvaW50IGlzIDB4MTBmZmZmXG5jb25zdCBfdXRmOGxlbiA9IG5ldyBVaW50OEFycmF5KDI1Nik7XG5mb3IgKGxldCBxID0gMDsgcSA8IDI1NjsgcSsrKSB7XG4gIF91dGY4bGVuW3FdID0gKHEgPj0gMjUyID8gNiA6IHEgPj0gMjQ4ID8gNSA6IHEgPj0gMjQwID8gNCA6IHEgPj0gMjI0ID8gMyA6IHEgPj0gMTkyID8gMiA6IDEpO1xufVxuX3V0ZjhsZW5bMjU0XSA9IF91dGY4bGVuWzI1NF0gPSAxOyAvLyBJbnZhbGlkIHNlcXVlbmNlIHN0YXJ0XG5cblxuLy8gY29udmVydCBzdHJpbmcgdG8gYXJyYXkgKHR5cGVkLCB3aGVuIHBvc3NpYmxlKVxudmFyIHN0cmluZzJidWYgPSAoc3RyKSA9PiB7XG4gIGlmICh0eXBlb2YgVGV4dEVuY29kZXIgPT09ICdmdW5jdGlvbicgJiYgVGV4dEVuY29kZXIucHJvdG90eXBlLmVuY29kZSkge1xuICAgIHJldHVybiBuZXcgVGV4dEVuY29kZXIoKS5lbmNvZGUoc3RyKTtcbiAgfVxuXG4gIGxldCBidWYsIGMsIGMyLCBtX3BvcywgaSwgc3RyX2xlbiA9IHN0ci5sZW5ndGgsIGJ1Zl9sZW4gPSAwO1xuXG4gIC8vIGNvdW50IGJpbmFyeSBzaXplXG4gIGZvciAobV9wb3MgPSAwOyBtX3BvcyA8IHN0cl9sZW47IG1fcG9zKyspIHtcbiAgICBjID0gc3RyLmNoYXJDb2RlQXQobV9wb3MpO1xuICAgIGlmICgoYyAmIDB4ZmMwMCkgPT09IDB4ZDgwMCAmJiAobV9wb3MgKyAxIDwgc3RyX2xlbikpIHtcbiAgICAgIGMyID0gc3RyLmNoYXJDb2RlQXQobV9wb3MgKyAxKTtcbiAgICAgIGlmICgoYzIgJiAweGZjMDApID09PSAweGRjMDApIHtcbiAgICAgICAgYyA9IDB4MTAwMDAgKyAoKGMgLSAweGQ4MDApIDw8IDEwKSArIChjMiAtIDB4ZGMwMCk7XG4gICAgICAgIG1fcG9zKys7XG4gICAgICB9XG4gICAgfVxuICAgIGJ1Zl9sZW4gKz0gYyA8IDB4ODAgPyAxIDogYyA8IDB4ODAwID8gMiA6IGMgPCAweDEwMDAwID8gMyA6IDQ7XG4gIH1cblxuICAvLyBhbGxvY2F0ZSBidWZmZXJcbiAgYnVmID0gbmV3IFVpbnQ4QXJyYXkoYnVmX2xlbik7XG5cbiAgLy8gY29udmVydFxuICBmb3IgKGkgPSAwLCBtX3BvcyA9IDA7IGkgPCBidWZfbGVuOyBtX3BvcysrKSB7XG4gICAgYyA9IHN0ci5jaGFyQ29kZUF0KG1fcG9zKTtcbiAgICBpZiAoKGMgJiAweGZjMDApID09PSAweGQ4MDAgJiYgKG1fcG9zICsgMSA8IHN0cl9sZW4pKSB7XG4gICAgICBjMiA9IHN0ci5jaGFyQ29kZUF0KG1fcG9zICsgMSk7XG4gICAgICBpZiAoKGMyICYgMHhmYzAwKSA9PT0gMHhkYzAwKSB7XG4gICAgICAgIGMgPSAweDEwMDAwICsgKChjIC0gMHhkODAwKSA8PCAxMCkgKyAoYzIgLSAweGRjMDApO1xuICAgICAgICBtX3BvcysrO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoYyA8IDB4ODApIHtcbiAgICAgIC8qIG9uZSBieXRlICovXG4gICAgICBidWZbaSsrXSA9IGM7XG4gICAgfSBlbHNlIGlmIChjIDwgMHg4MDApIHtcbiAgICAgIC8qIHR3byBieXRlcyAqL1xuICAgICAgYnVmW2krK10gPSAweEMwIHwgKGMgPj4+IDYpO1xuICAgICAgYnVmW2krK10gPSAweDgwIHwgKGMgJiAweDNmKTtcbiAgICB9IGVsc2UgaWYgKGMgPCAweDEwMDAwKSB7XG4gICAgICAvKiB0aHJlZSBieXRlcyAqL1xuICAgICAgYnVmW2krK10gPSAweEUwIHwgKGMgPj4+IDEyKTtcbiAgICAgIGJ1ZltpKytdID0gMHg4MCB8IChjID4+PiA2ICYgMHgzZik7XG4gICAgICBidWZbaSsrXSA9IDB4ODAgfCAoYyAmIDB4M2YpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvKiBmb3VyIGJ5dGVzICovXG4gICAgICBidWZbaSsrXSA9IDB4ZjAgfCAoYyA+Pj4gMTgpO1xuICAgICAgYnVmW2krK10gPSAweDgwIHwgKGMgPj4+IDEyICYgMHgzZik7XG4gICAgICBidWZbaSsrXSA9IDB4ODAgfCAoYyA+Pj4gNiAmIDB4M2YpO1xuICAgICAgYnVmW2krK10gPSAweDgwIHwgKGMgJiAweDNmKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYnVmO1xufTtcblxuLy8gSGVscGVyXG5jb25zdCBidWYyYmluc3RyaW5nID0gKGJ1ZiwgbGVuKSA9PiB7XG4gIC8vIE9uIENocm9tZSwgdGhlIGFyZ3VtZW50cyBpbiBhIGZ1bmN0aW9uIGNhbGwgdGhhdCBhcmUgYWxsb3dlZCBpcyBgNjU1MzRgLlxuICAvLyBJZiB0aGUgbGVuZ3RoIG9mIHRoZSBidWZmZXIgaXMgc21hbGxlciB0aGFuIHRoYXQsIHdlIGNhbiB1c2UgdGhpcyBvcHRpbWl6YXRpb24sXG4gIC8vIG90aGVyd2lzZSB3ZSB3aWxsIHRha2UgYSBzbG93ZXIgcGF0aC5cbiAgaWYgKGxlbiA8IDY1NTM0KSB7XG4gICAgaWYgKGJ1Zi5zdWJhcnJheSAmJiBTVFJfQVBQTFlfVUlBX09LKSB7XG4gICAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBidWYubGVuZ3RoID09PSBsZW4gPyBidWYgOiBidWYuc3ViYXJyYXkoMCwgbGVuKSk7XG4gICAgfVxuICB9XG5cbiAgbGV0IHJlc3VsdCA9ICcnO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgcmVzdWx0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnVmW2ldKTtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufTtcblxuXG4vLyBjb252ZXJ0IGFycmF5IHRvIHN0cmluZ1xudmFyIGJ1ZjJzdHJpbmcgPSAoYnVmLCBtYXgpID0+IHtcbiAgY29uc3QgbGVuID0gbWF4IHx8IGJ1Zi5sZW5ndGg7XG5cbiAgaWYgKHR5cGVvZiBUZXh0RGVjb2RlciA9PT0gJ2Z1bmN0aW9uJyAmJiBUZXh0RGVjb2Rlci5wcm90b3R5cGUuZGVjb2RlKSB7XG4gICAgcmV0dXJuIG5ldyBUZXh0RGVjb2RlcigpLmRlY29kZShidWYuc3ViYXJyYXkoMCwgbWF4KSk7XG4gIH1cblxuICBsZXQgaSwgb3V0O1xuXG4gIC8vIFJlc2VydmUgbWF4IHBvc3NpYmxlIGxlbmd0aCAoMiB3b3JkcyBwZXIgY2hhcilcbiAgLy8gTkI6IGJ5IHVua25vd24gcmVhc29ucywgQXJyYXkgaXMgc2lnbmlmaWNhbnRseSBmYXN0ZXIgZm9yXG4gIC8vICAgICBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5IHRoYW4gVWludDE2QXJyYXkuXG4gIGNvbnN0IHV0ZjE2YnVmID0gbmV3IEFycmF5KGxlbiAqIDIpO1xuXG4gIGZvciAob3V0ID0gMCwgaSA9IDA7IGkgPCBsZW47KSB7XG4gICAgbGV0IGMgPSBidWZbaSsrXTtcbiAgICAvLyBxdWljayBwcm9jZXNzIGFzY2lpXG4gICAgaWYgKGMgPCAweDgwKSB7IHV0ZjE2YnVmW291dCsrXSA9IGM7IGNvbnRpbnVlOyB9XG5cbiAgICBsZXQgY19sZW4gPSBfdXRmOGxlbltjXTtcbiAgICAvLyBza2lwIDUgJiA2IGJ5dGUgY29kZXNcbiAgICBpZiAoY19sZW4gPiA0KSB7IHV0ZjE2YnVmW291dCsrXSA9IDB4ZmZmZDsgaSArPSBjX2xlbiAtIDE7IGNvbnRpbnVlOyB9XG5cbiAgICAvLyBhcHBseSBtYXNrIG9uIGZpcnN0IGJ5dGVcbiAgICBjICY9IGNfbGVuID09PSAyID8gMHgxZiA6IGNfbGVuID09PSAzID8gMHgwZiA6IDB4MDc7XG4gICAgLy8gam9pbiB0aGUgcmVzdFxuICAgIHdoaWxlIChjX2xlbiA+IDEgJiYgaSA8IGxlbikge1xuICAgICAgYyA9IChjIDw8IDYpIHwgKGJ1ZltpKytdICYgMHgzZik7XG4gICAgICBjX2xlbi0tO1xuICAgIH1cblxuICAgIC8vIHRlcm1pbmF0ZWQgYnkgZW5kIG9mIHN0cmluZz9cbiAgICBpZiAoY19sZW4gPiAxKSB7IHV0ZjE2YnVmW291dCsrXSA9IDB4ZmZmZDsgY29udGludWU7IH1cblxuICAgIGlmIChjIDwgMHgxMDAwMCkge1xuICAgICAgdXRmMTZidWZbb3V0KytdID0gYztcbiAgICB9IGVsc2Uge1xuICAgICAgYyAtPSAweDEwMDAwO1xuICAgICAgdXRmMTZidWZbb3V0KytdID0gMHhkODAwIHwgKChjID4+IDEwKSAmIDB4M2ZmKTtcbiAgICAgIHV0ZjE2YnVmW291dCsrXSA9IDB4ZGMwMCB8IChjICYgMHgzZmYpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBidWYyYmluc3RyaW5nKHV0ZjE2YnVmLCBvdXQpO1xufTtcblxuXG4vLyBDYWxjdWxhdGUgbWF4IHBvc3NpYmxlIHBvc2l0aW9uIGluIHV0ZjggYnVmZmVyLFxuLy8gdGhhdCB3aWxsIG5vdCBicmVhayBzZXF1ZW5jZS4gSWYgdGhhdCdzIG5vdCBwb3NzaWJsZVxuLy8gLSAodmVyeSBzbWFsbCBsaW1pdHMpIHJldHVybiBtYXggc2l6ZSBhcyBpcy5cbi8vXG4vLyBidWZbXSAtIHV0ZjggYnl0ZXMgYXJyYXlcbi8vIG1heCAgIC0gbGVuZ3RoIGxpbWl0IChtYW5kYXRvcnkpO1xudmFyIHV0Zjhib3JkZXIgPSAoYnVmLCBtYXgpID0+IHtcblxuICBtYXggPSBtYXggfHwgYnVmLmxlbmd0aDtcbiAgaWYgKG1heCA+IGJ1Zi5sZW5ndGgpIHsgbWF4ID0gYnVmLmxlbmd0aDsgfVxuXG4gIC8vIGdvIGJhY2sgZnJvbSBsYXN0IHBvc2l0aW9uLCB1bnRpbCBzdGFydCBvZiBzZXF1ZW5jZSBmb3VuZFxuICBsZXQgcG9zID0gbWF4IC0gMTtcbiAgd2hpbGUgKHBvcyA+PSAwICYmIChidWZbcG9zXSAmIDB4QzApID09PSAweDgwKSB7IHBvcy0tOyB9XG5cbiAgLy8gVmVyeSBzbWFsbCBhbmQgYnJva2VuIHNlcXVlbmNlLFxuICAvLyByZXR1cm4gbWF4LCBiZWNhdXNlIHdlIHNob3VsZCByZXR1cm4gc29tZXRoaW5nIGFueXdheS5cbiAgaWYgKHBvcyA8IDApIHsgcmV0dXJuIG1heDsgfVxuXG4gIC8vIElmIHdlIGNhbWUgdG8gc3RhcnQgb2YgYnVmZmVyIC0gdGhhdCBtZWFucyBidWZmZXIgaXMgdG9vIHNtYWxsLFxuICAvLyByZXR1cm4gbWF4IHRvby5cbiAgaWYgKHBvcyA9PT0gMCkgeyByZXR1cm4gbWF4OyB9XG5cbiAgcmV0dXJuIChwb3MgKyBfdXRmOGxlbltidWZbcG9zXV0gPiBtYXgpID8gcG9zIDogbWF4O1xufTtcblxudmFyIHN0cmluZ3MgPSB7XG5cdHN0cmluZzJidWY6IHN0cmluZzJidWYsXG5cdGJ1ZjJzdHJpbmc6IGJ1ZjJzdHJpbmcsXG5cdHV0Zjhib3JkZXI6IHV0Zjhib3JkZXJcbn07XG5cbi8vIChDKSAxOTk1LTIwMTMgSmVhbi1sb3VwIEdhaWxseSBhbmQgTWFyayBBZGxlclxuLy8gKEMpIDIwMTQtMjAxNyBWaXRhbHkgUHV6cmluIGFuZCBBbmRyZXkgVHVwaXRzaW5cbi8vXG4vLyBUaGlzIHNvZnR3YXJlIGlzIHByb3ZpZGVkICdhcy1pcycsIHdpdGhvdXQgYW55IGV4cHJlc3Mgb3IgaW1wbGllZFxuLy8gd2FycmFudHkuIEluIG5vIGV2ZW50IHdpbGwgdGhlIGF1dGhvcnMgYmUgaGVsZCBsaWFibGUgZm9yIGFueSBkYW1hZ2VzXG4vLyBhcmlzaW5nIGZyb20gdGhlIHVzZSBvZiB0aGlzIHNvZnR3YXJlLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgZ3JhbnRlZCB0byBhbnlvbmUgdG8gdXNlIHRoaXMgc29mdHdhcmUgZm9yIGFueSBwdXJwb3NlLFxuLy8gaW5jbHVkaW5nIGNvbW1lcmNpYWwgYXBwbGljYXRpb25zLCBhbmQgdG8gYWx0ZXIgaXQgYW5kIHJlZGlzdHJpYnV0ZSBpdFxuLy8gZnJlZWx5LCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgcmVzdHJpY3Rpb25zOlxuLy9cbi8vIDEuIFRoZSBvcmlnaW4gb2YgdGhpcyBzb2Z0d2FyZSBtdXN0IG5vdCBiZSBtaXNyZXByZXNlbnRlZDsgeW91IG11c3Qgbm90XG4vLyAgIGNsYWltIHRoYXQgeW91IHdyb3RlIHRoZSBvcmlnaW5hbCBzb2Z0d2FyZS4gSWYgeW91IHVzZSB0aGlzIHNvZnR3YXJlXG4vLyAgIGluIGEgcHJvZHVjdCwgYW4gYWNrbm93bGVkZ21lbnQgaW4gdGhlIHByb2R1Y3QgZG9jdW1lbnRhdGlvbiB3b3VsZCBiZVxuLy8gICBhcHByZWNpYXRlZCBidXQgaXMgbm90IHJlcXVpcmVkLlxuLy8gMi4gQWx0ZXJlZCBzb3VyY2UgdmVyc2lvbnMgbXVzdCBiZSBwbGFpbmx5IG1hcmtlZCBhcyBzdWNoLCBhbmQgbXVzdCBub3QgYmVcbi8vICAgbWlzcmVwcmVzZW50ZWQgYXMgYmVpbmcgdGhlIG9yaWdpbmFsIHNvZnR3YXJlLlxuLy8gMy4gVGhpcyBub3RpY2UgbWF5IG5vdCBiZSByZW1vdmVkIG9yIGFsdGVyZWQgZnJvbSBhbnkgc291cmNlIGRpc3RyaWJ1dGlvbi5cblxuZnVuY3Rpb24gWlN0cmVhbSgpIHtcbiAgLyogbmV4dCBpbnB1dCBieXRlICovXG4gIHRoaXMuaW5wdXQgPSBudWxsOyAvLyBKUyBzcGVjaWZpYywgYmVjYXVzZSB3ZSBoYXZlIG5vIHBvaW50ZXJzXG4gIHRoaXMubmV4dF9pbiA9IDA7XG4gIC8qIG51bWJlciBvZiBieXRlcyBhdmFpbGFibGUgYXQgaW5wdXQgKi9cbiAgdGhpcy5hdmFpbF9pbiA9IDA7XG4gIC8qIHRvdGFsIG51bWJlciBvZiBpbnB1dCBieXRlcyByZWFkIHNvIGZhciAqL1xuICB0aGlzLnRvdGFsX2luID0gMDtcbiAgLyogbmV4dCBvdXRwdXQgYnl0ZSBzaG91bGQgYmUgcHV0IHRoZXJlICovXG4gIHRoaXMub3V0cHV0ID0gbnVsbDsgLy8gSlMgc3BlY2lmaWMsIGJlY2F1c2Ugd2UgaGF2ZSBubyBwb2ludGVyc1xuICB0aGlzLm5leHRfb3V0ID0gMDtcbiAgLyogcmVtYWluaW5nIGZyZWUgc3BhY2UgYXQgb3V0cHV0ICovXG4gIHRoaXMuYXZhaWxfb3V0ID0gMDtcbiAgLyogdG90YWwgbnVtYmVyIG9mIGJ5dGVzIG91dHB1dCBzbyBmYXIgKi9cbiAgdGhpcy50b3RhbF9vdXQgPSAwO1xuICAvKiBsYXN0IGVycm9yIG1lc3NhZ2UsIE5VTEwgaWYgbm8gZXJyb3IgKi9cbiAgdGhpcy5tc2cgPSAnJy8qWl9OVUxMKi87XG4gIC8qIG5vdCB2aXNpYmxlIGJ5IGFwcGxpY2F0aW9ucyAqL1xuICB0aGlzLnN0YXRlID0gbnVsbDtcbiAgLyogYmVzdCBndWVzcyBhYm91dCB0aGUgZGF0YSB0eXBlOiBiaW5hcnkgb3IgdGV4dCAqL1xuICB0aGlzLmRhdGFfdHlwZSA9IDIvKlpfVU5LTk9XTiovO1xuICAvKiBhZGxlcjMyIHZhbHVlIG9mIHRoZSB1bmNvbXByZXNzZWQgZGF0YSAqL1xuICB0aGlzLmFkbGVyID0gMDtcbn1cblxudmFyIHpzdHJlYW0gPSBaU3RyZWFtO1xuXG5jb25zdCB0b1N0cmluZyQxID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcblxuLyogUHVibGljIGNvbnN0YW50cyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Ki9cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSovXG5cbmNvbnN0IHtcbiAgWl9OT19GTFVTSDogWl9OT19GTFVTSCQxLCBaX1NZTkNfRkxVU0gsIFpfRlVMTF9GTFVTSCwgWl9GSU5JU0g6IFpfRklOSVNIJDIsXG4gIFpfT0s6IFpfT0skMiwgWl9TVFJFQU1fRU5EOiBaX1NUUkVBTV9FTkQkMixcbiAgWl9ERUZBVUxUX0NPTVBSRVNTSU9OLFxuICBaX0RFRkFVTFRfU1RSQVRFR1ksXG4gIFpfREVGTEFURUQ6IFpfREVGTEFURUQkMVxufSA9IGNvbnN0YW50cyQyO1xuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0qL1xuXG5cbi8qKlxuICogY2xhc3MgRGVmbGF0ZVxuICpcbiAqIEdlbmVyaWMgSlMtc3R5bGUgd3JhcHBlciBmb3IgemxpYiBjYWxscy4gSWYgeW91IGRvbid0IG5lZWRcbiAqIHN0cmVhbWluZyBiZWhhdmlvdXIgLSB1c2UgbW9yZSBzaW1wbGUgZnVuY3Rpb25zOiBbW2RlZmxhdGVdXSxcbiAqIFtbZGVmbGF0ZVJhd11dIGFuZCBbW2d6aXBdXS5cbiAqKi9cblxuLyogaW50ZXJuYWxcbiAqIERlZmxhdGUuY2h1bmtzIC0+IEFycmF5XG4gKlxuICogQ2h1bmtzIG9mIG91dHB1dCBkYXRhLCBpZiBbW0RlZmxhdGUjb25EYXRhXV0gbm90IG92ZXJyaWRkZW4uXG4gKiovXG5cbi8qKlxuICogRGVmbGF0ZS5yZXN1bHQgLT4gVWludDhBcnJheVxuICpcbiAqIENvbXByZXNzZWQgcmVzdWx0LCBnZW5lcmF0ZWQgYnkgZGVmYXVsdCBbW0RlZmxhdGUjb25EYXRhXV1cbiAqIGFuZCBbW0RlZmxhdGUjb25FbmRdXSBoYW5kbGVycy4gRmlsbGVkIGFmdGVyIHlvdSBwdXNoIGxhc3QgY2h1bmtcbiAqIChjYWxsIFtbRGVmbGF0ZSNwdXNoXV0gd2l0aCBgWl9GSU5JU0hgIC8gYHRydWVgIHBhcmFtKS5cbiAqKi9cblxuLyoqXG4gKiBEZWZsYXRlLmVyciAtPiBOdW1iZXJcbiAqXG4gKiBFcnJvciBjb2RlIGFmdGVyIGRlZmxhdGUgZmluaXNoZWQuIDAgKFpfT0spIG9uIHN1Y2Nlc3MuXG4gKiBZb3Ugd2lsbCBub3QgbmVlZCBpdCBpbiByZWFsIGxpZmUsIGJlY2F1c2UgZGVmbGF0ZSBlcnJvcnNcbiAqIGFyZSBwb3NzaWJsZSBvbmx5IG9uIHdyb25nIG9wdGlvbnMgb3IgYmFkIGBvbkRhdGFgIC8gYG9uRW5kYFxuICogY3VzdG9tIGhhbmRsZXJzLlxuICoqL1xuXG4vKipcbiAqIERlZmxhdGUubXNnIC0+IFN0cmluZ1xuICpcbiAqIEVycm9yIG1lc3NhZ2UsIGlmIFtbRGVmbGF0ZS5lcnJdXSAhPSAwXG4gKiovXG5cblxuLyoqXG4gKiBuZXcgRGVmbGF0ZShvcHRpb25zKVxuICogLSBvcHRpb25zIChPYmplY3QpOiB6bGliIGRlZmxhdGUgb3B0aW9ucy5cbiAqXG4gKiBDcmVhdGVzIG5ldyBkZWZsYXRvciBpbnN0YW5jZSB3aXRoIHNwZWNpZmllZCBwYXJhbXMuIFRocm93cyBleGNlcHRpb25cbiAqIG9uIGJhZCBwYXJhbXMuIFN1cHBvcnRlZCBvcHRpb25zOlxuICpcbiAqIC0gYGxldmVsYFxuICogLSBgd2luZG93Qml0c2BcbiAqIC0gYG1lbUxldmVsYFxuICogLSBgc3RyYXRlZ3lgXG4gKiAtIGBkaWN0aW9uYXJ5YFxuICpcbiAqIFtodHRwOi8vemxpYi5uZXQvbWFudWFsLmh0bWwjQWR2YW5jZWRdKGh0dHA6Ly96bGliLm5ldC9tYW51YWwuaHRtbCNBZHZhbmNlZClcbiAqIGZvciBtb3JlIGluZm9ybWF0aW9uIG9uIHRoZXNlLlxuICpcbiAqIEFkZGl0aW9uYWwgb3B0aW9ucywgZm9yIGludGVybmFsIG5lZWRzOlxuICpcbiAqIC0gYGNodW5rU2l6ZWAgLSBzaXplIG9mIGdlbmVyYXRlZCBkYXRhIGNodW5rcyAoMTZLIGJ5IGRlZmF1bHQpXG4gKiAtIGByYXdgIChCb29sZWFuKSAtIGRvIHJhdyBkZWZsYXRlXG4gKiAtIGBnemlwYCAoQm9vbGVhbikgLSBjcmVhdGUgZ3ppcCB3cmFwcGVyXG4gKiAtIGBoZWFkZXJgIChPYmplY3QpIC0gY3VzdG9tIGhlYWRlciBmb3IgZ3ppcFxuICogICAtIGB0ZXh0YCAoQm9vbGVhbikgLSB0cnVlIGlmIGNvbXByZXNzZWQgZGF0YSBiZWxpZXZlZCB0byBiZSB0ZXh0XG4gKiAgIC0gYHRpbWVgIChOdW1iZXIpIC0gbW9kaWZpY2F0aW9uIHRpbWUsIHVuaXggdGltZXN0YW1wXG4gKiAgIC0gYG9zYCAoTnVtYmVyKSAtIG9wZXJhdGlvbiBzeXN0ZW0gY29kZVxuICogICAtIGBleHRyYWAgKEFycmF5KSAtIGFycmF5IG9mIGJ5dGVzIHdpdGggZXh0cmEgZGF0YSAobWF4IDY1NTM2KVxuICogICAtIGBuYW1lYCAoU3RyaW5nKSAtIGZpbGUgbmFtZSAoYmluYXJ5IHN0cmluZylcbiAqICAgLSBgY29tbWVudGAgKFN0cmluZykgLSBjb21tZW50IChiaW5hcnkgc3RyaW5nKVxuICogICAtIGBoY3JjYCAoQm9vbGVhbikgLSB0cnVlIGlmIGhlYWRlciBjcmMgc2hvdWxkIGJlIGFkZGVkXG4gKlxuICogIyMjIyMgRXhhbXBsZTpcbiAqXG4gKiBgYGBqYXZhc2NyaXB0XG4gKiBjb25zdCBwYWtvID0gcmVxdWlyZSgncGFrbycpXG4gKiAgICwgY2h1bmsxID0gbmV3IFVpbnQ4QXJyYXkoWzEsMiwzLDQsNSw2LDcsOCw5XSlcbiAqICAgLCBjaHVuazIgPSBuZXcgVWludDhBcnJheShbMTAsMTEsMTIsMTMsMTQsMTUsMTYsMTcsMTgsMTldKTtcbiAqXG4gKiBjb25zdCBkZWZsYXRlID0gbmV3IHBha28uRGVmbGF0ZSh7IGxldmVsOiAzfSk7XG4gKlxuICogZGVmbGF0ZS5wdXNoKGNodW5rMSwgZmFsc2UpO1xuICogZGVmbGF0ZS5wdXNoKGNodW5rMiwgdHJ1ZSk7ICAvLyB0cnVlIC0+IGxhc3QgY2h1bmtcbiAqXG4gKiBpZiAoZGVmbGF0ZS5lcnIpIHsgdGhyb3cgbmV3IEVycm9yKGRlZmxhdGUuZXJyKTsgfVxuICpcbiAqIGNvbnNvbGUubG9nKGRlZmxhdGUucmVzdWx0KTtcbiAqIGBgYFxuICoqL1xuZnVuY3Rpb24gRGVmbGF0ZSQxKG9wdGlvbnMpIHtcbiAgdGhpcy5vcHRpb25zID0gY29tbW9uLmFzc2lnbih7XG4gICAgbGV2ZWw6IFpfREVGQVVMVF9DT01QUkVTU0lPTixcbiAgICBtZXRob2Q6IFpfREVGTEFURUQkMSxcbiAgICBjaHVua1NpemU6IDE2Mzg0LFxuICAgIHdpbmRvd0JpdHM6IDE1LFxuICAgIG1lbUxldmVsOiA4LFxuICAgIHN0cmF0ZWd5OiBaX0RFRkFVTFRfU1RSQVRFR1lcbiAgfSwgb3B0aW9ucyB8fCB7fSk7XG5cbiAgbGV0IG9wdCA9IHRoaXMub3B0aW9ucztcblxuICBpZiAob3B0LnJhdyAmJiAob3B0LndpbmRvd0JpdHMgPiAwKSkge1xuICAgIG9wdC53aW5kb3dCaXRzID0gLW9wdC53aW5kb3dCaXRzO1xuICB9XG5cbiAgZWxzZSBpZiAob3B0Lmd6aXAgJiYgKG9wdC53aW5kb3dCaXRzID4gMCkgJiYgKG9wdC53aW5kb3dCaXRzIDwgMTYpKSB7XG4gICAgb3B0LndpbmRvd0JpdHMgKz0gMTY7XG4gIH1cblxuICB0aGlzLmVyciAgICA9IDA7ICAgICAgLy8gZXJyb3IgY29kZSwgaWYgaGFwcGVucyAoMCA9IFpfT0spXG4gIHRoaXMubXNnICAgID0gJyc7ICAgICAvLyBlcnJvciBtZXNzYWdlXG4gIHRoaXMuZW5kZWQgID0gZmFsc2U7ICAvLyB1c2VkIHRvIGF2b2lkIG11bHRpcGxlIG9uRW5kKCkgY2FsbHNcbiAgdGhpcy5jaHVua3MgPSBbXTsgICAgIC8vIGNodW5rcyBvZiBjb21wcmVzc2VkIGRhdGFcblxuICB0aGlzLnN0cm0gPSBuZXcgenN0cmVhbSgpO1xuICB0aGlzLnN0cm0uYXZhaWxfb3V0ID0gMDtcblxuICBsZXQgc3RhdHVzID0gZGVmbGF0ZV8xJDIuZGVmbGF0ZUluaXQyKFxuICAgIHRoaXMuc3RybSxcbiAgICBvcHQubGV2ZWwsXG4gICAgb3B0Lm1ldGhvZCxcbiAgICBvcHQud2luZG93Qml0cyxcbiAgICBvcHQubWVtTGV2ZWwsXG4gICAgb3B0LnN0cmF0ZWd5XG4gICk7XG5cbiAgaWYgKHN0YXR1cyAhPT0gWl9PSyQyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKG1lc3NhZ2VzW3N0YXR1c10pO1xuICB9XG5cbiAgaWYgKG9wdC5oZWFkZXIpIHtcbiAgICBkZWZsYXRlXzEkMi5kZWZsYXRlU2V0SGVhZGVyKHRoaXMuc3RybSwgb3B0LmhlYWRlcik7XG4gIH1cblxuICBpZiAob3B0LmRpY3Rpb25hcnkpIHtcbiAgICBsZXQgZGljdDtcbiAgICAvLyBDb252ZXJ0IGRhdGEgaWYgbmVlZGVkXG4gICAgaWYgKHR5cGVvZiBvcHQuZGljdGlvbmFyeSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIC8vIElmIHdlIG5lZWQgdG8gY29tcHJlc3MgdGV4dCwgY2hhbmdlIGVuY29kaW5nIHRvIHV0ZjguXG4gICAgICBkaWN0ID0gc3RyaW5ncy5zdHJpbmcyYnVmKG9wdC5kaWN0aW9uYXJ5KTtcbiAgICB9IGVsc2UgaWYgKHRvU3RyaW5nJDEuY2FsbChvcHQuZGljdGlvbmFyeSkgPT09ICdbb2JqZWN0IEFycmF5QnVmZmVyXScpIHtcbiAgICAgIGRpY3QgPSBuZXcgVWludDhBcnJheShvcHQuZGljdGlvbmFyeSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGRpY3QgPSBvcHQuZGljdGlvbmFyeTtcbiAgICB9XG5cbiAgICBzdGF0dXMgPSBkZWZsYXRlXzEkMi5kZWZsYXRlU2V0RGljdGlvbmFyeSh0aGlzLnN0cm0sIGRpY3QpO1xuXG4gICAgaWYgKHN0YXR1cyAhPT0gWl9PSyQyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IobWVzc2FnZXNbc3RhdHVzXSk7XG4gICAgfVxuXG4gICAgdGhpcy5fZGljdF9zZXQgPSB0cnVlO1xuICB9XG59XG5cbi8qKlxuICogRGVmbGF0ZSNwdXNoKGRhdGFbLCBmbHVzaF9tb2RlXSkgLT4gQm9vbGVhblxuICogLSBkYXRhIChVaW50OEFycmF5fEFycmF5QnVmZmVyfFN0cmluZyk6IGlucHV0IGRhdGEuIFN0cmluZ3Mgd2lsbCBiZVxuICogICBjb252ZXJ0ZWQgdG8gdXRmOCBieXRlIHNlcXVlbmNlLlxuICogLSBmbHVzaF9tb2RlIChOdW1iZXJ8Qm9vbGVhbik6IDAuLjYgZm9yIGNvcnJlc3BvbmRpbmcgWl9OT19GTFVTSC4uWl9UUkVFIG1vZGVzLlxuICogICBTZWUgY29uc3RhbnRzLiBTa2lwcGVkIG9yIGBmYWxzZWAgbWVhbnMgWl9OT19GTFVTSCwgYHRydWVgIG1lYW5zIFpfRklOSVNILlxuICpcbiAqIFNlbmRzIGlucHV0IGRhdGEgdG8gZGVmbGF0ZSBwaXBlLCBnZW5lcmF0aW5nIFtbRGVmbGF0ZSNvbkRhdGFdXSBjYWxscyB3aXRoXG4gKiBuZXcgY29tcHJlc3NlZCBjaHVua3MuIFJldHVybnMgYHRydWVgIG9uIHN1Y2Nlc3MuIFRoZSBsYXN0IGRhdGEgYmxvY2sgbXVzdFxuICogaGF2ZSBgZmx1c2hfbW9kZWAgWl9GSU5JU0ggKG9yIGB0cnVlYCkuIFRoYXQgd2lsbCBmbHVzaCBpbnRlcm5hbCBwZW5kaW5nXG4gKiBidWZmZXJzIGFuZCBjYWxsIFtbRGVmbGF0ZSNvbkVuZF1dLlxuICpcbiAqIE9uIGZhaWwgY2FsbCBbW0RlZmxhdGUjb25FbmRdXSB3aXRoIGVycm9yIGNvZGUgYW5kIHJldHVybiBmYWxzZS5cbiAqXG4gKiAjIyMjIyBFeGFtcGxlXG4gKlxuICogYGBgamF2YXNjcmlwdFxuICogcHVzaChjaHVuaywgZmFsc2UpOyAvLyBwdXNoIG9uZSBvZiBkYXRhIGNodW5rc1xuICogLi4uXG4gKiBwdXNoKGNodW5rLCB0cnVlKTsgIC8vIHB1c2ggbGFzdCBjaHVua1xuICogYGBgXG4gKiovXG5EZWZsYXRlJDEucHJvdG90eXBlLnB1c2ggPSBmdW5jdGlvbiAoZGF0YSwgZmx1c2hfbW9kZSkge1xuICBjb25zdCBzdHJtID0gdGhpcy5zdHJtO1xuICBjb25zdCBjaHVua1NpemUgPSB0aGlzLm9wdGlvbnMuY2h1bmtTaXplO1xuICBsZXQgc3RhdHVzLCBfZmx1c2hfbW9kZTtcblxuICBpZiAodGhpcy5lbmRlZCkgeyByZXR1cm4gZmFsc2U7IH1cblxuICBpZiAoZmx1c2hfbW9kZSA9PT0gfn5mbHVzaF9tb2RlKSBfZmx1c2hfbW9kZSA9IGZsdXNoX21vZGU7XG4gIGVsc2UgX2ZsdXNoX21vZGUgPSBmbHVzaF9tb2RlID09PSB0cnVlID8gWl9GSU5JU0gkMiA6IFpfTk9fRkxVU0gkMTtcblxuICAvLyBDb252ZXJ0IGRhdGEgaWYgbmVlZGVkXG4gIGlmICh0eXBlb2YgZGF0YSA9PT0gJ3N0cmluZycpIHtcbiAgICAvLyBJZiB3ZSBuZWVkIHRvIGNvbXByZXNzIHRleHQsIGNoYW5nZSBlbmNvZGluZyB0byB1dGY4LlxuICAgIHN0cm0uaW5wdXQgPSBzdHJpbmdzLnN0cmluZzJidWYoZGF0YSk7XG4gIH0gZWxzZSBpZiAodG9TdHJpbmckMS5jYWxsKGRhdGEpID09PSAnW29iamVjdCBBcnJheUJ1ZmZlcl0nKSB7XG4gICAgc3RybS5pbnB1dCA9IG5ldyBVaW50OEFycmF5KGRhdGEpO1xuICB9IGVsc2Uge1xuICAgIHN0cm0uaW5wdXQgPSBkYXRhO1xuICB9XG5cbiAgc3RybS5uZXh0X2luID0gMDtcbiAgc3RybS5hdmFpbF9pbiA9IHN0cm0uaW5wdXQubGVuZ3RoO1xuXG4gIGZvciAoOzspIHtcbiAgICBpZiAoc3RybS5hdmFpbF9vdXQgPT09IDApIHtcbiAgICAgIHN0cm0ub3V0cHV0ID0gbmV3IFVpbnQ4QXJyYXkoY2h1bmtTaXplKTtcbiAgICAgIHN0cm0ubmV4dF9vdXQgPSAwO1xuICAgICAgc3RybS5hdmFpbF9vdXQgPSBjaHVua1NpemU7XG4gICAgfVxuXG4gICAgLy8gTWFrZSBzdXJlIGF2YWlsX291dCA+IDYgdG8gYXZvaWQgcmVwZWF0aW5nIG1hcmtlcnNcbiAgICBpZiAoKF9mbHVzaF9tb2RlID09PSBaX1NZTkNfRkxVU0ggfHwgX2ZsdXNoX21vZGUgPT09IFpfRlVMTF9GTFVTSCkgJiYgc3RybS5hdmFpbF9vdXQgPD0gNikge1xuICAgICAgdGhpcy5vbkRhdGEoc3RybS5vdXRwdXQuc3ViYXJyYXkoMCwgc3RybS5uZXh0X291dCkpO1xuICAgICAgc3RybS5hdmFpbF9vdXQgPSAwO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgc3RhdHVzID0gZGVmbGF0ZV8xJDIuZGVmbGF0ZShzdHJtLCBfZmx1c2hfbW9kZSk7XG5cbiAgICAvLyBFbmRlZCA9PiBmbHVzaCBhbmQgZmluaXNoXG4gICAgaWYgKHN0YXR1cyA9PT0gWl9TVFJFQU1fRU5EJDIpIHtcbiAgICAgIGlmIChzdHJtLm5leHRfb3V0ID4gMCkge1xuICAgICAgICB0aGlzLm9uRGF0YShzdHJtLm91dHB1dC5zdWJhcnJheSgwLCBzdHJtLm5leHRfb3V0KSk7XG4gICAgICB9XG4gICAgICBzdGF0dXMgPSBkZWZsYXRlXzEkMi5kZWZsYXRlRW5kKHRoaXMuc3RybSk7XG4gICAgICB0aGlzLm9uRW5kKHN0YXR1cyk7XG4gICAgICB0aGlzLmVuZGVkID0gdHJ1ZTtcbiAgICAgIHJldHVybiBzdGF0dXMgPT09IFpfT0skMjtcbiAgICB9XG5cbiAgICAvLyBGbHVzaCBpZiBvdXQgYnVmZmVyIGZ1bGxcbiAgICBpZiAoc3RybS5hdmFpbF9vdXQgPT09IDApIHtcbiAgICAgIHRoaXMub25EYXRhKHN0cm0ub3V0cHV0KTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIEZsdXNoIGlmIHJlcXVlc3RlZCBhbmQgaGFzIGRhdGFcbiAgICBpZiAoX2ZsdXNoX21vZGUgPiAwICYmIHN0cm0ubmV4dF9vdXQgPiAwKSB7XG4gICAgICB0aGlzLm9uRGF0YShzdHJtLm91dHB1dC5zdWJhcnJheSgwLCBzdHJtLm5leHRfb3V0KSk7XG4gICAgICBzdHJtLmF2YWlsX291dCA9IDA7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBpZiAoc3RybS5hdmFpbF9pbiA9PT0gMCkgYnJlYWs7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cblxuLyoqXG4gKiBEZWZsYXRlI29uRGF0YShjaHVuaykgLT4gVm9pZFxuICogLSBjaHVuayAoVWludDhBcnJheSk6IG91dHB1dCBkYXRhLlxuICpcbiAqIEJ5IGRlZmF1bHQsIHN0b3JlcyBkYXRhIGJsb2NrcyBpbiBgY2h1bmtzW11gIHByb3BlcnR5IGFuZCBnbHVlXG4gKiB0aG9zZSBpbiBgb25FbmRgLiBPdmVycmlkZSB0aGlzIGhhbmRsZXIsIGlmIHlvdSBuZWVkIGFub3RoZXIgYmVoYXZpb3VyLlxuICoqL1xuRGVmbGF0ZSQxLnByb3RvdHlwZS5vbkRhdGEgPSBmdW5jdGlvbiAoY2h1bmspIHtcbiAgdGhpcy5jaHVua3MucHVzaChjaHVuayk7XG59O1xuXG5cbi8qKlxuICogRGVmbGF0ZSNvbkVuZChzdGF0dXMpIC0+IFZvaWRcbiAqIC0gc3RhdHVzIChOdW1iZXIpOiBkZWZsYXRlIHN0YXR1cy4gMCAoWl9PSykgb24gc3VjY2VzcyxcbiAqICAgb3RoZXIgaWYgbm90LlxuICpcbiAqIENhbGxlZCBvbmNlIGFmdGVyIHlvdSB0ZWxsIGRlZmxhdGUgdGhhdCB0aGUgaW5wdXQgc3RyZWFtIGlzXG4gKiBjb21wbGV0ZSAoWl9GSU5JU0gpLiBCeSBkZWZhdWx0IC0gam9pbiBjb2xsZWN0ZWQgY2h1bmtzLFxuICogZnJlZSBtZW1vcnkgYW5kIGZpbGwgYHJlc3VsdHNgIC8gYGVycmAgcHJvcGVydGllcy5cbiAqKi9cbkRlZmxhdGUkMS5wcm90b3R5cGUub25FbmQgPSBmdW5jdGlvbiAoc3RhdHVzKSB7XG4gIC8vIE9uIHN1Y2Nlc3MgLSBqb2luXG4gIGlmIChzdGF0dXMgPT09IFpfT0skMikge1xuICAgIHRoaXMucmVzdWx0ID0gY29tbW9uLmZsYXR0ZW5DaHVua3ModGhpcy5jaHVua3MpO1xuICB9XG4gIHRoaXMuY2h1bmtzID0gW107XG4gIHRoaXMuZXJyID0gc3RhdHVzO1xuICB0aGlzLm1zZyA9IHRoaXMuc3RybS5tc2c7XG59O1xuXG5cbi8qKlxuICogZGVmbGF0ZShkYXRhWywgb3B0aW9uc10pIC0+IFVpbnQ4QXJyYXlcbiAqIC0gZGF0YSAoVWludDhBcnJheXxBcnJheUJ1ZmZlcnxTdHJpbmcpOiBpbnB1dCBkYXRhIHRvIGNvbXByZXNzLlxuICogLSBvcHRpb25zIChPYmplY3QpOiB6bGliIGRlZmxhdGUgb3B0aW9ucy5cbiAqXG4gKiBDb21wcmVzcyBgZGF0YWAgd2l0aCBkZWZsYXRlIGFsZ29yaXRobSBhbmQgYG9wdGlvbnNgLlxuICpcbiAqIFN1cHBvcnRlZCBvcHRpb25zIGFyZTpcbiAqXG4gKiAtIGxldmVsXG4gKiAtIHdpbmRvd0JpdHNcbiAqIC0gbWVtTGV2ZWxcbiAqIC0gc3RyYXRlZ3lcbiAqIC0gZGljdGlvbmFyeVxuICpcbiAqIFtodHRwOi8vemxpYi5uZXQvbWFudWFsLmh0bWwjQWR2YW5jZWRdKGh0dHA6Ly96bGliLm5ldC9tYW51YWwuaHRtbCNBZHZhbmNlZClcbiAqIGZvciBtb3JlIGluZm9ybWF0aW9uIG9uIHRoZXNlLlxuICpcbiAqIFN1Z2FyIChvcHRpb25zKTpcbiAqXG4gKiAtIGByYXdgIChCb29sZWFuKSAtIHNheSB0aGF0IHdlIHdvcmsgd2l0aCByYXcgc3RyZWFtLCBpZiB5b3UgZG9uJ3Qgd2lzaCB0byBzcGVjaWZ5XG4gKiAgIG5lZ2F0aXZlIHdpbmRvd0JpdHMgaW1wbGljaXRseS5cbiAqXG4gKiAjIyMjIyBFeGFtcGxlOlxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqIGNvbnN0IHBha28gPSByZXF1aXJlKCdwYWtvJylcbiAqIGNvbnN0IGRhdGEgPSBuZXcgVWludDhBcnJheShbMSwyLDMsNCw1LDYsNyw4LDldKTtcbiAqXG4gKiBjb25zb2xlLmxvZyhwYWtvLmRlZmxhdGUoZGF0YSkpO1xuICogYGBgXG4gKiovXG5mdW5jdGlvbiBkZWZsYXRlJDEoaW5wdXQsIG9wdGlvbnMpIHtcbiAgY29uc3QgZGVmbGF0b3IgPSBuZXcgRGVmbGF0ZSQxKG9wdGlvbnMpO1xuXG4gIGRlZmxhdG9yLnB1c2goaW5wdXQsIHRydWUpO1xuXG4gIC8vIFRoYXQgd2lsbCBuZXZlciBoYXBwZW5zLCBpZiB5b3UgZG9uJ3QgY2hlYXQgd2l0aCBvcHRpb25zIDopXG4gIGlmIChkZWZsYXRvci5lcnIpIHsgdGhyb3cgZGVmbGF0b3IubXNnIHx8IG1lc3NhZ2VzW2RlZmxhdG9yLmVycl07IH1cblxuICByZXR1cm4gZGVmbGF0b3IucmVzdWx0O1xufVxuXG5cbi8qKlxuICogZGVmbGF0ZVJhdyhkYXRhWywgb3B0aW9uc10pIC0+IFVpbnQ4QXJyYXlcbiAqIC0gZGF0YSAoVWludDhBcnJheXxBcnJheUJ1ZmZlcnxTdHJpbmcpOiBpbnB1dCBkYXRhIHRvIGNvbXByZXNzLlxuICogLSBvcHRpb25zIChPYmplY3QpOiB6bGliIGRlZmxhdGUgb3B0aW9ucy5cbiAqXG4gKiBUaGUgc2FtZSBhcyBbW2RlZmxhdGVdXSwgYnV0IGNyZWF0ZXMgcmF3IGRhdGEsIHdpdGhvdXQgd3JhcHBlclxuICogKGhlYWRlciBhbmQgYWRsZXIzMiBjcmMpLlxuICoqL1xuZnVuY3Rpb24gZGVmbGF0ZVJhdyQxKGlucHV0LCBvcHRpb25zKSB7XG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICBvcHRpb25zLnJhdyA9IHRydWU7XG4gIHJldHVybiBkZWZsYXRlJDEoaW5wdXQsIG9wdGlvbnMpO1xufVxuXG5cbi8qKlxuICogZ3ppcChkYXRhWywgb3B0aW9uc10pIC0+IFVpbnQ4QXJyYXlcbiAqIC0gZGF0YSAoVWludDhBcnJheXxBcnJheUJ1ZmZlcnxTdHJpbmcpOiBpbnB1dCBkYXRhIHRvIGNvbXByZXNzLlxuICogLSBvcHRpb25zIChPYmplY3QpOiB6bGliIGRlZmxhdGUgb3B0aW9ucy5cbiAqXG4gKiBUaGUgc2FtZSBhcyBbW2RlZmxhdGVdXSwgYnV0IGNyZWF0ZSBnemlwIHdyYXBwZXIgaW5zdGVhZCBvZlxuICogZGVmbGF0ZSBvbmUuXG4gKiovXG5mdW5jdGlvbiBnemlwJDEoaW5wdXQsIG9wdGlvbnMpIHtcbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gIG9wdGlvbnMuZ3ppcCA9IHRydWU7XG4gIHJldHVybiBkZWZsYXRlJDEoaW5wdXQsIG9wdGlvbnMpO1xufVxuXG5cbnZhciBEZWZsYXRlXzEkMSA9IERlZmxhdGUkMTtcbnZhciBkZWZsYXRlXzIgPSBkZWZsYXRlJDE7XG52YXIgZGVmbGF0ZVJhd18xJDEgPSBkZWZsYXRlUmF3JDE7XG52YXIgZ3ppcF8xJDEgPSBnemlwJDE7XG52YXIgY29uc3RhbnRzJDEgPSBjb25zdGFudHMkMjtcblxudmFyIGRlZmxhdGVfMSQxID0ge1xuXHREZWZsYXRlOiBEZWZsYXRlXzEkMSxcblx0ZGVmbGF0ZTogZGVmbGF0ZV8yLFxuXHRkZWZsYXRlUmF3OiBkZWZsYXRlUmF3XzEkMSxcblx0Z3ppcDogZ3ppcF8xJDEsXG5cdGNvbnN0YW50czogY29uc3RhbnRzJDFcbn07XG5cbi8vIChDKSAxOTk1LTIwMTMgSmVhbi1sb3VwIEdhaWxseSBhbmQgTWFyayBBZGxlclxuLy8gKEMpIDIwMTQtMjAxNyBWaXRhbHkgUHV6cmluIGFuZCBBbmRyZXkgVHVwaXRzaW5cbi8vXG4vLyBUaGlzIHNvZnR3YXJlIGlzIHByb3ZpZGVkICdhcy1pcycsIHdpdGhvdXQgYW55IGV4cHJlc3Mgb3IgaW1wbGllZFxuLy8gd2FycmFudHkuIEluIG5vIGV2ZW50IHdpbGwgdGhlIGF1dGhvcnMgYmUgaGVsZCBsaWFibGUgZm9yIGFueSBkYW1hZ2VzXG4vLyBhcmlzaW5nIGZyb20gdGhlIHVzZSBvZiB0aGlzIHNvZnR3YXJlLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgZ3JhbnRlZCB0byBhbnlvbmUgdG8gdXNlIHRoaXMgc29mdHdhcmUgZm9yIGFueSBwdXJwb3NlLFxuLy8gaW5jbHVkaW5nIGNvbW1lcmNpYWwgYXBwbGljYXRpb25zLCBhbmQgdG8gYWx0ZXIgaXQgYW5kIHJlZGlzdHJpYnV0ZSBpdFxuLy8gZnJlZWx5LCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgcmVzdHJpY3Rpb25zOlxuLy9cbi8vIDEuIFRoZSBvcmlnaW4gb2YgdGhpcyBzb2Z0d2FyZSBtdXN0IG5vdCBiZSBtaXNyZXByZXNlbnRlZDsgeW91IG11c3Qgbm90XG4vLyAgIGNsYWltIHRoYXQgeW91IHdyb3RlIHRoZSBvcmlnaW5hbCBzb2Z0d2FyZS4gSWYgeW91IHVzZSB0aGlzIHNvZnR3YXJlXG4vLyAgIGluIGEgcHJvZHVjdCwgYW4gYWNrbm93bGVkZ21lbnQgaW4gdGhlIHByb2R1Y3QgZG9jdW1lbnRhdGlvbiB3b3VsZCBiZVxuLy8gICBhcHByZWNpYXRlZCBidXQgaXMgbm90IHJlcXVpcmVkLlxuLy8gMi4gQWx0ZXJlZCBzb3VyY2UgdmVyc2lvbnMgbXVzdCBiZSBwbGFpbmx5IG1hcmtlZCBhcyBzdWNoLCBhbmQgbXVzdCBub3QgYmVcbi8vICAgbWlzcmVwcmVzZW50ZWQgYXMgYmVpbmcgdGhlIG9yaWdpbmFsIHNvZnR3YXJlLlxuLy8gMy4gVGhpcyBub3RpY2UgbWF5IG5vdCBiZSByZW1vdmVkIG9yIGFsdGVyZWQgZnJvbSBhbnkgc291cmNlIGRpc3RyaWJ1dGlvbi5cblxuLy8gU2VlIHN0YXRlIGRlZnMgZnJvbSBpbmZsYXRlLmpzXG5jb25zdCBCQUQkMSA9IDE2MjA5OyAgICAgICAvKiBnb3QgYSBkYXRhIGVycm9yIC0tIHJlbWFpbiBoZXJlIHVudGlsIHJlc2V0ICovXG5jb25zdCBUWVBFJDEgPSAxNjE5MTsgICAgICAvKiBpOiB3YWl0aW5nIGZvciB0eXBlIGJpdHMsIGluY2x1ZGluZyBsYXN0LWZsYWcgYml0ICovXG5cbi8qXG4gICBEZWNvZGUgbGl0ZXJhbCwgbGVuZ3RoLCBhbmQgZGlzdGFuY2UgY29kZXMgYW5kIHdyaXRlIG91dCB0aGUgcmVzdWx0aW5nXG4gICBsaXRlcmFsIGFuZCBtYXRjaCBieXRlcyB1bnRpbCBlaXRoZXIgbm90IGVub3VnaCBpbnB1dCBvciBvdXRwdXQgaXNcbiAgIGF2YWlsYWJsZSwgYW4gZW5kLW9mLWJsb2NrIGlzIGVuY291bnRlcmVkLCBvciBhIGRhdGEgZXJyb3IgaXMgZW5jb3VudGVyZWQuXG4gICBXaGVuIGxhcmdlIGVub3VnaCBpbnB1dCBhbmQgb3V0cHV0IGJ1ZmZlcnMgYXJlIHN1cHBsaWVkIHRvIGluZmxhdGUoKSwgZm9yXG4gICBleGFtcGxlLCBhIDE2SyBpbnB1dCBidWZmZXIgYW5kIGEgNjRLIG91dHB1dCBidWZmZXIsIG1vcmUgdGhhbiA5NSUgb2YgdGhlXG4gICBpbmZsYXRlIGV4ZWN1dGlvbiB0aW1lIGlzIHNwZW50IGluIHRoaXMgcm91dGluZS5cblxuICAgRW50cnkgYXNzdW1wdGlvbnM6XG5cbiAgICAgICAgc3RhdGUubW9kZSA9PT0gTEVOXG4gICAgICAgIHN0cm0uYXZhaWxfaW4gPj0gNlxuICAgICAgICBzdHJtLmF2YWlsX291dCA+PSAyNThcbiAgICAgICAgc3RhcnQgPj0gc3RybS5hdmFpbF9vdXRcbiAgICAgICAgc3RhdGUuYml0cyA8IDhcblxuICAgT24gcmV0dXJuLCBzdGF0ZS5tb2RlIGlzIG9uZSBvZjpcblxuICAgICAgICBMRU4gLS0gcmFuIG91dCBvZiBlbm91Z2ggb3V0cHV0IHNwYWNlIG9yIGVub3VnaCBhdmFpbGFibGUgaW5wdXRcbiAgICAgICAgVFlQRSAtLSByZWFjaGVkIGVuZCBvZiBibG9jayBjb2RlLCBpbmZsYXRlKCkgdG8gaW50ZXJwcmV0IG5leHQgYmxvY2tcbiAgICAgICAgQkFEIC0tIGVycm9yIGluIGJsb2NrIGRhdGFcblxuICAgTm90ZXM6XG5cbiAgICAtIFRoZSBtYXhpbXVtIGlucHV0IGJpdHMgdXNlZCBieSBhIGxlbmd0aC9kaXN0YW5jZSBwYWlyIGlzIDE1IGJpdHMgZm9yIHRoZVxuICAgICAgbGVuZ3RoIGNvZGUsIDUgYml0cyBmb3IgdGhlIGxlbmd0aCBleHRyYSwgMTUgYml0cyBmb3IgdGhlIGRpc3RhbmNlIGNvZGUsXG4gICAgICBhbmQgMTMgYml0cyBmb3IgdGhlIGRpc3RhbmNlIGV4dHJhLiAgVGhpcyB0b3RhbHMgNDggYml0cywgb3Igc2l4IGJ5dGVzLlxuICAgICAgVGhlcmVmb3JlIGlmIHN0cm0uYXZhaWxfaW4gPj0gNiwgdGhlbiB0aGVyZSBpcyBlbm91Z2ggaW5wdXQgdG8gYXZvaWRcbiAgICAgIGNoZWNraW5nIGZvciBhdmFpbGFibGUgaW5wdXQgd2hpbGUgZGVjb2RpbmcuXG5cbiAgICAtIFRoZSBtYXhpbXVtIGJ5dGVzIHRoYXQgYSBzaW5nbGUgbGVuZ3RoL2Rpc3RhbmNlIHBhaXIgY2FuIG91dHB1dCBpcyAyNThcbiAgICAgIGJ5dGVzLCB3aGljaCBpcyB0aGUgbWF4aW11bSBsZW5ndGggdGhhdCBjYW4gYmUgY29kZWQuICBpbmZsYXRlX2Zhc3QoKVxuICAgICAgcmVxdWlyZXMgc3RybS5hdmFpbF9vdXQgPj0gMjU4IGZvciBlYWNoIGxvb3AgdG8gYXZvaWQgY2hlY2tpbmcgZm9yXG4gICAgICBvdXRwdXQgc3BhY2UuXG4gKi9cbnZhciBpbmZmYXN0ID0gZnVuY3Rpb24gaW5mbGF0ZV9mYXN0KHN0cm0sIHN0YXJ0KSB7XG4gIGxldCBfaW47ICAgICAgICAgICAgICAgICAgICAvKiBsb2NhbCBzdHJtLmlucHV0ICovXG4gIGxldCBsYXN0OyAgICAgICAgICAgICAgICAgICAvKiBoYXZlIGVub3VnaCBpbnB1dCB3aGlsZSBpbiA8IGxhc3QgKi9cbiAgbGV0IF9vdXQ7ICAgICAgICAgICAgICAgICAgIC8qIGxvY2FsIHN0cm0ub3V0cHV0ICovXG4gIGxldCBiZWc7ICAgICAgICAgICAgICAgICAgICAvKiBpbmZsYXRlKCkncyBpbml0aWFsIHN0cm0ub3V0cHV0ICovXG4gIGxldCBlbmQ7ICAgICAgICAgICAgICAgICAgICAvKiB3aGlsZSBvdXQgPCBlbmQsIGVub3VnaCBzcGFjZSBhdmFpbGFibGUgKi9cbi8vI2lmZGVmIElORkxBVEVfU1RSSUNUXG4gIGxldCBkbWF4OyAgICAgICAgICAgICAgICAgICAvKiBtYXhpbXVtIGRpc3RhbmNlIGZyb20gemxpYiBoZWFkZXIgKi9cbi8vI2VuZGlmXG4gIGxldCB3c2l6ZTsgICAgICAgICAgICAgICAgICAvKiB3aW5kb3cgc2l6ZSBvciB6ZXJvIGlmIG5vdCB1c2luZyB3aW5kb3cgKi9cbiAgbGV0IHdoYXZlOyAgICAgICAgICAgICAgICAgIC8qIHZhbGlkIGJ5dGVzIGluIHRoZSB3aW5kb3cgKi9cbiAgbGV0IHduZXh0OyAgICAgICAgICAgICAgICAgIC8qIHdpbmRvdyB3cml0ZSBpbmRleCAqL1xuICAvLyBVc2UgYHNfd2luZG93YCBpbnN0ZWFkIGB3aW5kb3dgLCBhdm9pZCBjb25mbGljdCB3aXRoIGluc3RydW1lbnRhdGlvbiB0b29sc1xuICBsZXQgc193aW5kb3c7ICAgICAgICAgICAgICAgLyogYWxsb2NhdGVkIHNsaWRpbmcgd2luZG93LCBpZiB3c2l6ZSAhPSAwICovXG4gIGxldCBob2xkOyAgICAgICAgICAgICAgICAgICAvKiBsb2NhbCBzdHJtLmhvbGQgKi9cbiAgbGV0IGJpdHM7ICAgICAgICAgICAgICAgICAgIC8qIGxvY2FsIHN0cm0uYml0cyAqL1xuICBsZXQgbGNvZGU7ICAgICAgICAgICAgICAgICAgLyogbG9jYWwgc3RybS5sZW5jb2RlICovXG4gIGxldCBkY29kZTsgICAgICAgICAgICAgICAgICAvKiBsb2NhbCBzdHJtLmRpc3Rjb2RlICovXG4gIGxldCBsbWFzazsgICAgICAgICAgICAgICAgICAvKiBtYXNrIGZvciBmaXJzdCBsZXZlbCBvZiBsZW5ndGggY29kZXMgKi9cbiAgbGV0IGRtYXNrOyAgICAgICAgICAgICAgICAgIC8qIG1hc2sgZm9yIGZpcnN0IGxldmVsIG9mIGRpc3RhbmNlIGNvZGVzICovXG4gIGxldCBoZXJlOyAgICAgICAgICAgICAgICAgICAvKiByZXRyaWV2ZWQgdGFibGUgZW50cnkgKi9cbiAgbGV0IG9wOyAgICAgICAgICAgICAgICAgICAgIC8qIGNvZGUgYml0cywgb3BlcmF0aW9uLCBleHRyYSBiaXRzLCBvciAqL1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLyogIHdpbmRvdyBwb3NpdGlvbiwgd2luZG93IGJ5dGVzIHRvIGNvcHkgKi9cbiAgbGV0IGxlbjsgICAgICAgICAgICAgICAgICAgIC8qIG1hdGNoIGxlbmd0aCwgdW51c2VkIGJ5dGVzICovXG4gIGxldCBkaXN0OyAgICAgICAgICAgICAgICAgICAvKiBtYXRjaCBkaXN0YW5jZSAqL1xuICBsZXQgZnJvbTsgICAgICAgICAgICAgICAgICAgLyogd2hlcmUgdG8gY29weSBtYXRjaCBmcm9tICovXG4gIGxldCBmcm9tX3NvdXJjZTtcblxuXG4gIGxldCBpbnB1dCwgb3V0cHV0OyAvLyBKUyBzcGVjaWZpYywgYmVjYXVzZSB3ZSBoYXZlIG5vIHBvaW50ZXJzXG5cbiAgLyogY29weSBzdGF0ZSB0byBsb2NhbCB2YXJpYWJsZXMgKi9cbiAgY29uc3Qgc3RhdGUgPSBzdHJtLnN0YXRlO1xuICAvL2hlcmUgPSBzdGF0ZS5oZXJlO1xuICBfaW4gPSBzdHJtLm5leHRfaW47XG4gIGlucHV0ID0gc3RybS5pbnB1dDtcbiAgbGFzdCA9IF9pbiArIChzdHJtLmF2YWlsX2luIC0gNSk7XG4gIF9vdXQgPSBzdHJtLm5leHRfb3V0O1xuICBvdXRwdXQgPSBzdHJtLm91dHB1dDtcbiAgYmVnID0gX291dCAtIChzdGFydCAtIHN0cm0uYXZhaWxfb3V0KTtcbiAgZW5kID0gX291dCArIChzdHJtLmF2YWlsX291dCAtIDI1Nyk7XG4vLyNpZmRlZiBJTkZMQVRFX1NUUklDVFxuICBkbWF4ID0gc3RhdGUuZG1heDtcbi8vI2VuZGlmXG4gIHdzaXplID0gc3RhdGUud3NpemU7XG4gIHdoYXZlID0gc3RhdGUud2hhdmU7XG4gIHduZXh0ID0gc3RhdGUud25leHQ7XG4gIHNfd2luZG93ID0gc3RhdGUud2luZG93O1xuICBob2xkID0gc3RhdGUuaG9sZDtcbiAgYml0cyA9IHN0YXRlLmJpdHM7XG4gIGxjb2RlID0gc3RhdGUubGVuY29kZTtcbiAgZGNvZGUgPSBzdGF0ZS5kaXN0Y29kZTtcbiAgbG1hc2sgPSAoMSA8PCBzdGF0ZS5sZW5iaXRzKSAtIDE7XG4gIGRtYXNrID0gKDEgPDwgc3RhdGUuZGlzdGJpdHMpIC0gMTtcblxuXG4gIC8qIGRlY29kZSBsaXRlcmFscyBhbmQgbGVuZ3RoL2Rpc3RhbmNlcyB1bnRpbCBlbmQtb2YtYmxvY2sgb3Igbm90IGVub3VnaFxuICAgICBpbnB1dCBkYXRhIG9yIG91dHB1dCBzcGFjZSAqL1xuXG4gIHRvcDpcbiAgZG8ge1xuICAgIGlmIChiaXRzIDwgMTUpIHtcbiAgICAgIGhvbGQgKz0gaW5wdXRbX2luKytdIDw8IGJpdHM7XG4gICAgICBiaXRzICs9IDg7XG4gICAgICBob2xkICs9IGlucHV0W19pbisrXSA8PCBiaXRzO1xuICAgICAgYml0cyArPSA4O1xuICAgIH1cblxuICAgIGhlcmUgPSBsY29kZVtob2xkICYgbG1hc2tdO1xuXG4gICAgZG9sZW46XG4gICAgZm9yICg7OykgeyAvLyBHb3RvIGVtdWxhdGlvblxuICAgICAgb3AgPSBoZXJlID4+PiAyNC8qaGVyZS5iaXRzKi87XG4gICAgICBob2xkID4+Pj0gb3A7XG4gICAgICBiaXRzIC09IG9wO1xuICAgICAgb3AgPSAoaGVyZSA+Pj4gMTYpICYgMHhmZi8qaGVyZS5vcCovO1xuICAgICAgaWYgKG9wID09PSAwKSB7ICAgICAgICAgICAgICAgICAgICAgICAgICAvKiBsaXRlcmFsICovXG4gICAgICAgIC8vVHJhY2V2digoc3RkZXJyLCBoZXJlLnZhbCA+PSAweDIwICYmIGhlcmUudmFsIDwgMHg3ZiA/XG4gICAgICAgIC8vICAgICAgICBcImluZmxhdGU6ICAgICAgICAgbGl0ZXJhbCAnJWMnXFxuXCIgOlxuICAgICAgICAvLyAgICAgICAgXCJpbmZsYXRlOiAgICAgICAgIGxpdGVyYWwgMHglMDJ4XFxuXCIsIGhlcmUudmFsKSk7XG4gICAgICAgIG91dHB1dFtfb3V0KytdID0gaGVyZSAmIDB4ZmZmZi8qaGVyZS52YWwqLztcbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKG9wICYgMTYpIHsgICAgICAgICAgICAgICAgICAgICAvKiBsZW5ndGggYmFzZSAqL1xuICAgICAgICBsZW4gPSBoZXJlICYgMHhmZmZmLypoZXJlLnZhbCovO1xuICAgICAgICBvcCAmPSAxNTsgICAgICAgICAgICAgICAgICAgICAgICAgICAvKiBudW1iZXIgb2YgZXh0cmEgYml0cyAqL1xuICAgICAgICBpZiAob3ApIHtcbiAgICAgICAgICBpZiAoYml0cyA8IG9wKSB7XG4gICAgICAgICAgICBob2xkICs9IGlucHV0W19pbisrXSA8PCBiaXRzO1xuICAgICAgICAgICAgYml0cyArPSA4O1xuICAgICAgICAgIH1cbiAgICAgICAgICBsZW4gKz0gaG9sZCAmICgoMSA8PCBvcCkgLSAxKTtcbiAgICAgICAgICBob2xkID4+Pj0gb3A7XG4gICAgICAgICAgYml0cyAtPSBvcDtcbiAgICAgICAgfVxuICAgICAgICAvL1RyYWNldnYoKHN0ZGVyciwgXCJpbmZsYXRlOiAgICAgICAgIGxlbmd0aCAldVxcblwiLCBsZW4pKTtcbiAgICAgICAgaWYgKGJpdHMgPCAxNSkge1xuICAgICAgICAgIGhvbGQgKz0gaW5wdXRbX2luKytdIDw8IGJpdHM7XG4gICAgICAgICAgYml0cyArPSA4O1xuICAgICAgICAgIGhvbGQgKz0gaW5wdXRbX2luKytdIDw8IGJpdHM7XG4gICAgICAgICAgYml0cyArPSA4O1xuICAgICAgICB9XG4gICAgICAgIGhlcmUgPSBkY29kZVtob2xkICYgZG1hc2tdO1xuXG4gICAgICAgIGRvZGlzdDpcbiAgICAgICAgZm9yICg7OykgeyAvLyBnb3RvIGVtdWxhdGlvblxuICAgICAgICAgIG9wID0gaGVyZSA+Pj4gMjQvKmhlcmUuYml0cyovO1xuICAgICAgICAgIGhvbGQgPj4+PSBvcDtcbiAgICAgICAgICBiaXRzIC09IG9wO1xuICAgICAgICAgIG9wID0gKGhlcmUgPj4+IDE2KSAmIDB4ZmYvKmhlcmUub3AqLztcblxuICAgICAgICAgIGlmIChvcCAmIDE2KSB7ICAgICAgICAgICAgICAgICAgICAgIC8qIGRpc3RhbmNlIGJhc2UgKi9cbiAgICAgICAgICAgIGRpc3QgPSBoZXJlICYgMHhmZmZmLypoZXJlLnZhbCovO1xuICAgICAgICAgICAgb3AgJj0gMTU7ICAgICAgICAgICAgICAgICAgICAgICAvKiBudW1iZXIgb2YgZXh0cmEgYml0cyAqL1xuICAgICAgICAgICAgaWYgKGJpdHMgPCBvcCkge1xuICAgICAgICAgICAgICBob2xkICs9IGlucHV0W19pbisrXSA8PCBiaXRzO1xuICAgICAgICAgICAgICBiaXRzICs9IDg7XG4gICAgICAgICAgICAgIGlmIChiaXRzIDwgb3ApIHtcbiAgICAgICAgICAgICAgICBob2xkICs9IGlucHV0W19pbisrXSA8PCBiaXRzO1xuICAgICAgICAgICAgICAgIGJpdHMgKz0gODtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZGlzdCArPSBob2xkICYgKCgxIDw8IG9wKSAtIDEpO1xuLy8jaWZkZWYgSU5GTEFURV9TVFJJQ1RcbiAgICAgICAgICAgIGlmIChkaXN0ID4gZG1heCkge1xuICAgICAgICAgICAgICBzdHJtLm1zZyA9ICdpbnZhbGlkIGRpc3RhbmNlIHRvbyBmYXIgYmFjayc7XG4gICAgICAgICAgICAgIHN0YXRlLm1vZGUgPSBCQUQkMTtcbiAgICAgICAgICAgICAgYnJlYWsgdG9wO1xuICAgICAgICAgICAgfVxuLy8jZW5kaWZcbiAgICAgICAgICAgIGhvbGQgPj4+PSBvcDtcbiAgICAgICAgICAgIGJpdHMgLT0gb3A7XG4gICAgICAgICAgICAvL1RyYWNldnYoKHN0ZGVyciwgXCJpbmZsYXRlOiAgICAgICAgIGRpc3RhbmNlICV1XFxuXCIsIGRpc3QpKTtcbiAgICAgICAgICAgIG9wID0gX291dCAtIGJlZzsgICAgICAgICAgICAgICAgLyogbWF4IGRpc3RhbmNlIGluIG91dHB1dCAqL1xuICAgICAgICAgICAgaWYgKGRpc3QgPiBvcCkgeyAgICAgICAgICAgICAgICAvKiBzZWUgaWYgY29weSBmcm9tIHdpbmRvdyAqL1xuICAgICAgICAgICAgICBvcCA9IGRpc3QgLSBvcDsgICAgICAgICAgICAgICAvKiBkaXN0YW5jZSBiYWNrIGluIHdpbmRvdyAqL1xuICAgICAgICAgICAgICBpZiAob3AgPiB3aGF2ZSkge1xuICAgICAgICAgICAgICAgIGlmIChzdGF0ZS5zYW5lKSB7XG4gICAgICAgICAgICAgICAgICBzdHJtLm1zZyA9ICdpbnZhbGlkIGRpc3RhbmNlIHRvbyBmYXIgYmFjayc7XG4gICAgICAgICAgICAgICAgICBzdGF0ZS5tb2RlID0gQkFEJDE7XG4gICAgICAgICAgICAgICAgICBicmVhayB0b3A7XG4gICAgICAgICAgICAgICAgfVxuXG4vLyAoISkgVGhpcyBibG9jayBpcyBkaXNhYmxlZCBpbiB6bGliIGRlZmF1bHRzLFxuLy8gZG9uJ3QgZW5hYmxlIGl0IGZvciBiaW5hcnkgY29tcGF0aWJpbGl0eVxuLy8jaWZkZWYgSU5GTEFURV9BTExPV19JTlZBTElEX0RJU1RBTkNFX1RPT0ZBUl9BUlJSXG4vLyAgICAgICAgICAgICAgICBpZiAobGVuIDw9IG9wIC0gd2hhdmUpIHtcbi8vICAgICAgICAgICAgICAgICAgZG8ge1xuLy8gICAgICAgICAgICAgICAgICAgIG91dHB1dFtfb3V0KytdID0gMDtcbi8vICAgICAgICAgICAgICAgICAgfSB3aGlsZSAoLS1sZW4pO1xuLy8gICAgICAgICAgICAgICAgICBjb250aW51ZSB0b3A7XG4vLyAgICAgICAgICAgICAgICB9XG4vLyAgICAgICAgICAgICAgICBsZW4gLT0gb3AgLSB3aGF2ZTtcbi8vICAgICAgICAgICAgICAgIGRvIHtcbi8vICAgICAgICAgICAgICAgICAgb3V0cHV0W19vdXQrK10gPSAwO1xuLy8gICAgICAgICAgICAgICAgfSB3aGlsZSAoLS1vcCA+IHdoYXZlKTtcbi8vICAgICAgICAgICAgICAgIGlmIChvcCA9PT0gMCkge1xuLy8gICAgICAgICAgICAgICAgICBmcm9tID0gX291dCAtIGRpc3Q7XG4vLyAgICAgICAgICAgICAgICAgIGRvIHtcbi8vICAgICAgICAgICAgICAgICAgICBvdXRwdXRbX291dCsrXSA9IG91dHB1dFtmcm9tKytdO1xuLy8gICAgICAgICAgICAgICAgICB9IHdoaWxlICgtLWxlbik7XG4vLyAgICAgICAgICAgICAgICAgIGNvbnRpbnVlIHRvcDtcbi8vICAgICAgICAgICAgICAgIH1cbi8vI2VuZGlmXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgZnJvbSA9IDA7IC8vIHdpbmRvdyBpbmRleFxuICAgICAgICAgICAgICBmcm9tX3NvdXJjZSA9IHNfd2luZG93O1xuICAgICAgICAgICAgICBpZiAod25leHQgPT09IDApIHsgICAgICAgICAgIC8qIHZlcnkgY29tbW9uIGNhc2UgKi9cbiAgICAgICAgICAgICAgICBmcm9tICs9IHdzaXplIC0gb3A7XG4gICAgICAgICAgICAgICAgaWYgKG9wIDwgbGVuKSB7ICAgICAgICAgLyogc29tZSBmcm9tIHdpbmRvdyAqL1xuICAgICAgICAgICAgICAgICAgbGVuIC09IG9wO1xuICAgICAgICAgICAgICAgICAgZG8ge1xuICAgICAgICAgICAgICAgICAgICBvdXRwdXRbX291dCsrXSA9IHNfd2luZG93W2Zyb20rK107XG4gICAgICAgICAgICAgICAgICB9IHdoaWxlICgtLW9wKTtcbiAgICAgICAgICAgICAgICAgIGZyb20gPSBfb3V0IC0gZGlzdDsgIC8qIHJlc3QgZnJvbSBvdXRwdXQgKi9cbiAgICAgICAgICAgICAgICAgIGZyb21fc291cmNlID0gb3V0cHV0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBlbHNlIGlmICh3bmV4dCA8IG9wKSB7ICAgICAgLyogd3JhcCBhcm91bmQgd2luZG93ICovXG4gICAgICAgICAgICAgICAgZnJvbSArPSB3c2l6ZSArIHduZXh0IC0gb3A7XG4gICAgICAgICAgICAgICAgb3AgLT0gd25leHQ7XG4gICAgICAgICAgICAgICAgaWYgKG9wIDwgbGVuKSB7ICAgICAgICAgLyogc29tZSBmcm9tIGVuZCBvZiB3aW5kb3cgKi9cbiAgICAgICAgICAgICAgICAgIGxlbiAtPSBvcDtcbiAgICAgICAgICAgICAgICAgIGRvIHtcbiAgICAgICAgICAgICAgICAgICAgb3V0cHV0W19vdXQrK10gPSBzX3dpbmRvd1tmcm9tKytdO1xuICAgICAgICAgICAgICAgICAgfSB3aGlsZSAoLS1vcCk7XG4gICAgICAgICAgICAgICAgICBmcm9tID0gMDtcbiAgICAgICAgICAgICAgICAgIGlmICh3bmV4dCA8IGxlbikgeyAgLyogc29tZSBmcm9tIHN0YXJ0IG9mIHdpbmRvdyAqL1xuICAgICAgICAgICAgICAgICAgICBvcCA9IHduZXh0O1xuICAgICAgICAgICAgICAgICAgICBsZW4gLT0gb3A7XG4gICAgICAgICAgICAgICAgICAgIGRvIHtcbiAgICAgICAgICAgICAgICAgICAgICBvdXRwdXRbX291dCsrXSA9IHNfd2luZG93W2Zyb20rK107XG4gICAgICAgICAgICAgICAgICAgIH0gd2hpbGUgKC0tb3ApO1xuICAgICAgICAgICAgICAgICAgICBmcm9tID0gX291dCAtIGRpc3Q7ICAgICAgLyogcmVzdCBmcm9tIG91dHB1dCAqL1xuICAgICAgICAgICAgICAgICAgICBmcm9tX3NvdXJjZSA9IG91dHB1dDtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgZWxzZSB7ICAgICAgICAgICAgICAgICAgICAgIC8qIGNvbnRpZ3VvdXMgaW4gd2luZG93ICovXG4gICAgICAgICAgICAgICAgZnJvbSArPSB3bmV4dCAtIG9wO1xuICAgICAgICAgICAgICAgIGlmIChvcCA8IGxlbikgeyAgICAgICAgIC8qIHNvbWUgZnJvbSB3aW5kb3cgKi9cbiAgICAgICAgICAgICAgICAgIGxlbiAtPSBvcDtcbiAgICAgICAgICAgICAgICAgIGRvIHtcbiAgICAgICAgICAgICAgICAgICAgb3V0cHV0W19vdXQrK10gPSBzX3dpbmRvd1tmcm9tKytdO1xuICAgICAgICAgICAgICAgICAgfSB3aGlsZSAoLS1vcCk7XG4gICAgICAgICAgICAgICAgICBmcm9tID0gX291dCAtIGRpc3Q7ICAvKiByZXN0IGZyb20gb3V0cHV0ICovXG4gICAgICAgICAgICAgICAgICBmcm9tX3NvdXJjZSA9IG91dHB1dDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgd2hpbGUgKGxlbiA+IDIpIHtcbiAgICAgICAgICAgICAgICBvdXRwdXRbX291dCsrXSA9IGZyb21fc291cmNlW2Zyb20rK107XG4gICAgICAgICAgICAgICAgb3V0cHV0W19vdXQrK10gPSBmcm9tX3NvdXJjZVtmcm9tKytdO1xuICAgICAgICAgICAgICAgIG91dHB1dFtfb3V0KytdID0gZnJvbV9zb3VyY2VbZnJvbSsrXTtcbiAgICAgICAgICAgICAgICBsZW4gLT0gMztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAobGVuKSB7XG4gICAgICAgICAgICAgICAgb3V0cHV0W19vdXQrK10gPSBmcm9tX3NvdXJjZVtmcm9tKytdO1xuICAgICAgICAgICAgICAgIGlmIChsZW4gPiAxKSB7XG4gICAgICAgICAgICAgICAgICBvdXRwdXRbX291dCsrXSA9IGZyb21fc291cmNlW2Zyb20rK107XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgZnJvbSA9IF9vdXQgLSBkaXN0OyAgICAgICAgICAvKiBjb3B5IGRpcmVjdCBmcm9tIG91dHB1dCAqL1xuICAgICAgICAgICAgICBkbyB7ICAgICAgICAgICAgICAgICAgICAgICAgLyogbWluaW11bSBsZW5ndGggaXMgdGhyZWUgKi9cbiAgICAgICAgICAgICAgICBvdXRwdXRbX291dCsrXSA9IG91dHB1dFtmcm9tKytdO1xuICAgICAgICAgICAgICAgIG91dHB1dFtfb3V0KytdID0gb3V0cHV0W2Zyb20rK107XG4gICAgICAgICAgICAgICAgb3V0cHV0W19vdXQrK10gPSBvdXRwdXRbZnJvbSsrXTtcbiAgICAgICAgICAgICAgICBsZW4gLT0gMztcbiAgICAgICAgICAgICAgfSB3aGlsZSAobGVuID4gMik7XG4gICAgICAgICAgICAgIGlmIChsZW4pIHtcbiAgICAgICAgICAgICAgICBvdXRwdXRbX291dCsrXSA9IG91dHB1dFtmcm9tKytdO1xuICAgICAgICAgICAgICAgIGlmIChsZW4gPiAxKSB7XG4gICAgICAgICAgICAgICAgICBvdXRwdXRbX291dCsrXSA9IG91dHB1dFtmcm9tKytdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIGlmICgob3AgJiA2NCkgPT09IDApIHsgICAgICAgICAgLyogMm5kIGxldmVsIGRpc3RhbmNlIGNvZGUgKi9cbiAgICAgICAgICAgIGhlcmUgPSBkY29kZVsoaGVyZSAmIDB4ZmZmZikvKmhlcmUudmFsKi8gKyAoaG9sZCAmICgoMSA8PCBvcCkgLSAxKSldO1xuICAgICAgICAgICAgY29udGludWUgZG9kaXN0O1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHN0cm0ubXNnID0gJ2ludmFsaWQgZGlzdGFuY2UgY29kZSc7XG4gICAgICAgICAgICBzdGF0ZS5tb2RlID0gQkFEJDE7XG4gICAgICAgICAgICBicmVhayB0b3A7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgYnJlYWs7IC8vIG5lZWQgdG8gZW11bGF0ZSBnb3RvIHZpYSBcImNvbnRpbnVlXCJcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZWxzZSBpZiAoKG9wICYgNjQpID09PSAwKSB7ICAgICAgICAgICAgICAvKiAybmQgbGV2ZWwgbGVuZ3RoIGNvZGUgKi9cbiAgICAgICAgaGVyZSA9IGxjb2RlWyhoZXJlICYgMHhmZmZmKS8qaGVyZS52YWwqLyArIChob2xkICYgKCgxIDw8IG9wKSAtIDEpKV07XG4gICAgICAgIGNvbnRpbnVlIGRvbGVuO1xuICAgICAgfVxuICAgICAgZWxzZSBpZiAob3AgJiAzMikgeyAgICAgICAgICAgICAgICAgICAgIC8qIGVuZC1vZi1ibG9jayAqL1xuICAgICAgICAvL1RyYWNldnYoKHN0ZGVyciwgXCJpbmZsYXRlOiAgICAgICAgIGVuZCBvZiBibG9ja1xcblwiKSk7XG4gICAgICAgIHN0YXRlLm1vZGUgPSBUWVBFJDE7XG4gICAgICAgIGJyZWFrIHRvcDtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBzdHJtLm1zZyA9ICdpbnZhbGlkIGxpdGVyYWwvbGVuZ3RoIGNvZGUnO1xuICAgICAgICBzdGF0ZS5tb2RlID0gQkFEJDE7XG4gICAgICAgIGJyZWFrIHRvcDtcbiAgICAgIH1cblxuICAgICAgYnJlYWs7IC8vIG5lZWQgdG8gZW11bGF0ZSBnb3RvIHZpYSBcImNvbnRpbnVlXCJcbiAgICB9XG4gIH0gd2hpbGUgKF9pbiA8IGxhc3QgJiYgX291dCA8IGVuZCk7XG5cbiAgLyogcmV0dXJuIHVudXNlZCBieXRlcyAob24gZW50cnksIGJpdHMgPCA4LCBzbyBpbiB3b24ndCBnbyB0b28gZmFyIGJhY2spICovXG4gIGxlbiA9IGJpdHMgPj4gMztcbiAgX2luIC09IGxlbjtcbiAgYml0cyAtPSBsZW4gPDwgMztcbiAgaG9sZCAmPSAoMSA8PCBiaXRzKSAtIDE7XG5cbiAgLyogdXBkYXRlIHN0YXRlIGFuZCByZXR1cm4gKi9cbiAgc3RybS5uZXh0X2luID0gX2luO1xuICBzdHJtLm5leHRfb3V0ID0gX291dDtcbiAgc3RybS5hdmFpbF9pbiA9IChfaW4gPCBsYXN0ID8gNSArIChsYXN0IC0gX2luKSA6IDUgLSAoX2luIC0gbGFzdCkpO1xuICBzdHJtLmF2YWlsX291dCA9IChfb3V0IDwgZW5kID8gMjU3ICsgKGVuZCAtIF9vdXQpIDogMjU3IC0gKF9vdXQgLSBlbmQpKTtcbiAgc3RhdGUuaG9sZCA9IGhvbGQ7XG4gIHN0YXRlLmJpdHMgPSBiaXRzO1xuICByZXR1cm47XG59O1xuXG4vLyAoQykgMTk5NS0yMDEzIEplYW4tbG91cCBHYWlsbHkgYW5kIE1hcmsgQWRsZXJcbi8vIChDKSAyMDE0LTIwMTcgVml0YWx5IFB1enJpbiBhbmQgQW5kcmV5IFR1cGl0c2luXG4vL1xuLy8gVGhpcyBzb2Z0d2FyZSBpcyBwcm92aWRlZCAnYXMtaXMnLCB3aXRob3V0IGFueSBleHByZXNzIG9yIGltcGxpZWRcbi8vIHdhcnJhbnR5LiBJbiBubyBldmVudCB3aWxsIHRoZSBhdXRob3JzIGJlIGhlbGQgbGlhYmxlIGZvciBhbnkgZGFtYWdlc1xuLy8gYXJpc2luZyBmcm9tIHRoZSB1c2Ugb2YgdGhpcyBzb2Z0d2FyZS5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGdyYW50ZWQgdG8gYW55b25lIHRvIHVzZSB0aGlzIHNvZnR3YXJlIGZvciBhbnkgcHVycG9zZSxcbi8vIGluY2x1ZGluZyBjb21tZXJjaWFsIGFwcGxpY2F0aW9ucywgYW5kIHRvIGFsdGVyIGl0IGFuZCByZWRpc3RyaWJ1dGUgaXRcbi8vIGZyZWVseSwgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nIHJlc3RyaWN0aW9uczpcbi8vXG4vLyAxLiBUaGUgb3JpZ2luIG9mIHRoaXMgc29mdHdhcmUgbXVzdCBub3QgYmUgbWlzcmVwcmVzZW50ZWQ7IHlvdSBtdXN0IG5vdFxuLy8gICBjbGFpbSB0aGF0IHlvdSB3cm90ZSB0aGUgb3JpZ2luYWwgc29mdHdhcmUuIElmIHlvdSB1c2UgdGhpcyBzb2Z0d2FyZVxuLy8gICBpbiBhIHByb2R1Y3QsIGFuIGFja25vd2xlZGdtZW50IGluIHRoZSBwcm9kdWN0IGRvY3VtZW50YXRpb24gd291bGQgYmVcbi8vICAgYXBwcmVjaWF0ZWQgYnV0IGlzIG5vdCByZXF1aXJlZC5cbi8vIDIuIEFsdGVyZWQgc291cmNlIHZlcnNpb25zIG11c3QgYmUgcGxhaW5seSBtYXJrZWQgYXMgc3VjaCwgYW5kIG11c3Qgbm90IGJlXG4vLyAgIG1pc3JlcHJlc2VudGVkIGFzIGJlaW5nIHRoZSBvcmlnaW5hbCBzb2Z0d2FyZS5cbi8vIDMuIFRoaXMgbm90aWNlIG1heSBub3QgYmUgcmVtb3ZlZCBvciBhbHRlcmVkIGZyb20gYW55IHNvdXJjZSBkaXN0cmlidXRpb24uXG5cbmNvbnN0IE1BWEJJVFMgPSAxNTtcbmNvbnN0IEVOT1VHSF9MRU5TJDEgPSA4NTI7XG5jb25zdCBFTk9VR0hfRElTVFMkMSA9IDU5Mjtcbi8vY29uc3QgRU5PVUdIID0gKEVOT1VHSF9MRU5TK0VOT1VHSF9ESVNUUyk7XG5cbmNvbnN0IENPREVTJDEgPSAwO1xuY29uc3QgTEVOUyQxID0gMTtcbmNvbnN0IERJU1RTJDEgPSAyO1xuXG5jb25zdCBsYmFzZSA9IG5ldyBVaW50MTZBcnJheShbIC8qIExlbmd0aCBjb2RlcyAyNTcuLjI4NSBiYXNlICovXG4gIDMsIDQsIDUsIDYsIDcsIDgsIDksIDEwLCAxMSwgMTMsIDE1LCAxNywgMTksIDIzLCAyNywgMzEsXG4gIDM1LCA0MywgNTEsIDU5LCA2NywgODMsIDk5LCAxMTUsIDEzMSwgMTYzLCAxOTUsIDIyNywgMjU4LCAwLCAwXG5dKTtcblxuY29uc3QgbGV4dCA9IG5ldyBVaW50OEFycmF5KFsgLyogTGVuZ3RoIGNvZGVzIDI1Ny4uMjg1IGV4dHJhICovXG4gIDE2LCAxNiwgMTYsIDE2LCAxNiwgMTYsIDE2LCAxNiwgMTcsIDE3LCAxNywgMTcsIDE4LCAxOCwgMTgsIDE4LFxuICAxOSwgMTksIDE5LCAxOSwgMjAsIDIwLCAyMCwgMjAsIDIxLCAyMSwgMjEsIDIxLCAxNiwgNzIsIDc4XG5dKTtcblxuY29uc3QgZGJhc2UgPSBuZXcgVWludDE2QXJyYXkoWyAvKiBEaXN0YW5jZSBjb2RlcyAwLi4yOSBiYXNlICovXG4gIDEsIDIsIDMsIDQsIDUsIDcsIDksIDEzLCAxNywgMjUsIDMzLCA0OSwgNjUsIDk3LCAxMjksIDE5MyxcbiAgMjU3LCAzODUsIDUxMywgNzY5LCAxMDI1LCAxNTM3LCAyMDQ5LCAzMDczLCA0MDk3LCA2MTQ1LFxuICA4MTkzLCAxMjI4OSwgMTYzODUsIDI0NTc3LCAwLCAwXG5dKTtcblxuY29uc3QgZGV4dCA9IG5ldyBVaW50OEFycmF5KFsgLyogRGlzdGFuY2UgY29kZXMgMC4uMjkgZXh0cmEgKi9cbiAgMTYsIDE2LCAxNiwgMTYsIDE3LCAxNywgMTgsIDE4LCAxOSwgMTksIDIwLCAyMCwgMjEsIDIxLCAyMiwgMjIsXG4gIDIzLCAyMywgMjQsIDI0LCAyNSwgMjUsIDI2LCAyNiwgMjcsIDI3LFxuICAyOCwgMjgsIDI5LCAyOSwgNjQsIDY0XG5dKTtcblxuY29uc3QgaW5mbGF0ZV90YWJsZSA9ICh0eXBlLCBsZW5zLCBsZW5zX2luZGV4LCBjb2RlcywgdGFibGUsIHRhYmxlX2luZGV4LCB3b3JrLCBvcHRzKSA9Plxue1xuICBjb25zdCBiaXRzID0gb3B0cy5iaXRzO1xuICAgICAgLy9oZXJlID0gb3B0cy5oZXJlOyAvKiB0YWJsZSBlbnRyeSBmb3IgZHVwbGljYXRpb24gKi9cblxuICBsZXQgbGVuID0gMDsgICAgICAgICAgICAgICAvKiBhIGNvZGUncyBsZW5ndGggaW4gYml0cyAqL1xuICBsZXQgc3ltID0gMDsgICAgICAgICAgICAgICAvKiBpbmRleCBvZiBjb2RlIHN5bWJvbHMgKi9cbiAgbGV0IG1pbiA9IDAsIG1heCA9IDA7ICAgICAgICAgIC8qIG1pbmltdW0gYW5kIG1heGltdW0gY29kZSBsZW5ndGhzICovXG4gIGxldCByb290ID0gMDsgICAgICAgICAgICAgIC8qIG51bWJlciBvZiBpbmRleCBiaXRzIGZvciByb290IHRhYmxlICovXG4gIGxldCBjdXJyID0gMDsgICAgICAgICAgICAgIC8qIG51bWJlciBvZiBpbmRleCBiaXRzIGZvciBjdXJyZW50IHRhYmxlICovXG4gIGxldCBkcm9wID0gMDsgICAgICAgICAgICAgIC8qIGNvZGUgYml0cyB0byBkcm9wIGZvciBzdWItdGFibGUgKi9cbiAgbGV0IGxlZnQgPSAwOyAgICAgICAgICAgICAgICAgICAvKiBudW1iZXIgb2YgcHJlZml4IGNvZGVzIGF2YWlsYWJsZSAqL1xuICBsZXQgdXNlZCA9IDA7ICAgICAgICAgICAgICAvKiBjb2RlIGVudHJpZXMgaW4gdGFibGUgdXNlZCAqL1xuICBsZXQgaHVmZiA9IDA7ICAgICAgICAgICAgICAvKiBIdWZmbWFuIGNvZGUgKi9cbiAgbGV0IGluY3I7ICAgICAgICAgICAgICAvKiBmb3IgaW5jcmVtZW50aW5nIGNvZGUsIGluZGV4ICovXG4gIGxldCBmaWxsOyAgICAgICAgICAgICAgLyogaW5kZXggZm9yIHJlcGxpY2F0aW5nIGVudHJpZXMgKi9cbiAgbGV0IGxvdzsgICAgICAgICAgICAgICAvKiBsb3cgYml0cyBmb3IgY3VycmVudCByb290IGVudHJ5ICovXG4gIGxldCBtYXNrOyAgICAgICAgICAgICAgLyogbWFzayBmb3IgbG93IHJvb3QgYml0cyAqL1xuICBsZXQgbmV4dDsgICAgICAgICAgICAgLyogbmV4dCBhdmFpbGFibGUgc3BhY2UgaW4gdGFibGUgKi9cbiAgbGV0IGJhc2UgPSBudWxsOyAgICAgLyogYmFzZSB2YWx1ZSB0YWJsZSB0byB1c2UgKi9cbi8vICBsZXQgc2hvZXh0cmE7ICAgIC8qIGV4dHJhIGJpdHMgdGFibGUgdG8gdXNlICovXG4gIGxldCBtYXRjaDsgICAgICAgICAgICAgICAgICAvKiB1c2UgYmFzZSBhbmQgZXh0cmEgZm9yIHN5bWJvbCA+PSBtYXRjaCAqL1xuICBjb25zdCBjb3VudCA9IG5ldyBVaW50MTZBcnJheShNQVhCSVRTICsgMSk7IC8vW01BWEJJVFMrMV07ICAgIC8qIG51bWJlciBvZiBjb2RlcyBvZiBlYWNoIGxlbmd0aCAqL1xuICBjb25zdCBvZmZzID0gbmV3IFVpbnQxNkFycmF5KE1BWEJJVFMgKyAxKTsgLy9bTUFYQklUUysxXTsgICAgIC8qIG9mZnNldHMgaW4gdGFibGUgZm9yIGVhY2ggbGVuZ3RoICovXG4gIGxldCBleHRyYSA9IG51bGw7XG5cbiAgbGV0IGhlcmVfYml0cywgaGVyZV9vcCwgaGVyZV92YWw7XG5cbiAgLypcbiAgIFByb2Nlc3MgYSBzZXQgb2YgY29kZSBsZW5ndGhzIHRvIGNyZWF0ZSBhIGNhbm9uaWNhbCBIdWZmbWFuIGNvZGUuICBUaGVcbiAgIGNvZGUgbGVuZ3RocyBhcmUgbGVuc1swLi5jb2Rlcy0xXS4gIEVhY2ggbGVuZ3RoIGNvcnJlc3BvbmRzIHRvIHRoZVxuICAgc3ltYm9scyAwLi5jb2Rlcy0xLiAgVGhlIEh1ZmZtYW4gY29kZSBpcyBnZW5lcmF0ZWQgYnkgZmlyc3Qgc29ydGluZyB0aGVcbiAgIHN5bWJvbHMgYnkgbGVuZ3RoIGZyb20gc2hvcnQgdG8gbG9uZywgYW5kIHJldGFpbmluZyB0aGUgc3ltYm9sIG9yZGVyXG4gICBmb3IgY29kZXMgd2l0aCBlcXVhbCBsZW5ndGhzLiAgVGhlbiB0aGUgY29kZSBzdGFydHMgd2l0aCBhbGwgemVybyBiaXRzXG4gICBmb3IgdGhlIGZpcnN0IGNvZGUgb2YgdGhlIHNob3J0ZXN0IGxlbmd0aCwgYW5kIHRoZSBjb2RlcyBhcmUgaW50ZWdlclxuICAgaW5jcmVtZW50cyBmb3IgdGhlIHNhbWUgbGVuZ3RoLCBhbmQgemVyb3MgYXJlIGFwcGVuZGVkIGFzIHRoZSBsZW5ndGhcbiAgIGluY3JlYXNlcy4gIEZvciB0aGUgZGVmbGF0ZSBmb3JtYXQsIHRoZXNlIGJpdHMgYXJlIHN0b3JlZCBiYWNrd2FyZHNcbiAgIGZyb20gdGhlaXIgbW9yZSBuYXR1cmFsIGludGVnZXIgaW5jcmVtZW50IG9yZGVyaW5nLCBhbmQgc28gd2hlbiB0aGVcbiAgIGRlY29kaW5nIHRhYmxlcyBhcmUgYnVpbHQgaW4gdGhlIGxhcmdlIGxvb3AgYmVsb3csIHRoZSBpbnRlZ2VyIGNvZGVzXG4gICBhcmUgaW5jcmVtZW50ZWQgYmFja3dhcmRzLlxuXG4gICBUaGlzIHJvdXRpbmUgYXNzdW1lcywgYnV0IGRvZXMgbm90IGNoZWNrLCB0aGF0IGFsbCBvZiB0aGUgZW50cmllcyBpblxuICAgbGVuc1tdIGFyZSBpbiB0aGUgcmFuZ2UgMC4uTUFYQklUUy4gIFRoZSBjYWxsZXIgbXVzdCBhc3N1cmUgdGhpcy5cbiAgIDEuLk1BWEJJVFMgaXMgaW50ZXJwcmV0ZWQgYXMgdGhhdCBjb2RlIGxlbmd0aC4gIHplcm8gbWVhbnMgdGhhdCB0aGF0XG4gICBzeW1ib2wgZG9lcyBub3Qgb2NjdXIgaW4gdGhpcyBjb2RlLlxuXG4gICBUaGUgY29kZXMgYXJlIHNvcnRlZCBieSBjb21wdXRpbmcgYSBjb3VudCBvZiBjb2RlcyBmb3IgZWFjaCBsZW5ndGgsXG4gICBjcmVhdGluZyBmcm9tIHRoYXQgYSB0YWJsZSBvZiBzdGFydGluZyBpbmRpY2VzIGZvciBlYWNoIGxlbmd0aCBpbiB0aGVcbiAgIHNvcnRlZCB0YWJsZSwgYW5kIHRoZW4gZW50ZXJpbmcgdGhlIHN5bWJvbHMgaW4gb3JkZXIgaW4gdGhlIHNvcnRlZFxuICAgdGFibGUuICBUaGUgc29ydGVkIHRhYmxlIGlzIHdvcmtbXSwgd2l0aCB0aGF0IHNwYWNlIGJlaW5nIHByb3ZpZGVkIGJ5XG4gICB0aGUgY2FsbGVyLlxuXG4gICBUaGUgbGVuZ3RoIGNvdW50cyBhcmUgdXNlZCBmb3Igb3RoZXIgcHVycG9zZXMgYXMgd2VsbCwgaS5lLiBmaW5kaW5nXG4gICB0aGUgbWluaW11bSBhbmQgbWF4aW11bSBsZW5ndGggY29kZXMsIGRldGVybWluaW5nIGlmIHRoZXJlIGFyZSBhbnlcbiAgIGNvZGVzIGF0IGFsbCwgY2hlY2tpbmcgZm9yIGEgdmFsaWQgc2V0IG9mIGxlbmd0aHMsIGFuZCBsb29raW5nIGFoZWFkXG4gICBhdCBsZW5ndGggY291bnRzIHRvIGRldGVybWluZSBzdWItdGFibGUgc2l6ZXMgd2hlbiBidWlsZGluZyB0aGVcbiAgIGRlY29kaW5nIHRhYmxlcy5cbiAgICovXG5cbiAgLyogYWNjdW11bGF0ZSBsZW5ndGhzIGZvciBjb2RlcyAoYXNzdW1lcyBsZW5zW10gYWxsIGluIDAuLk1BWEJJVFMpICovXG4gIGZvciAobGVuID0gMDsgbGVuIDw9IE1BWEJJVFM7IGxlbisrKSB7XG4gICAgY291bnRbbGVuXSA9IDA7XG4gIH1cbiAgZm9yIChzeW0gPSAwOyBzeW0gPCBjb2Rlczsgc3ltKyspIHtcbiAgICBjb3VudFtsZW5zW2xlbnNfaW5kZXggKyBzeW1dXSsrO1xuICB9XG5cbiAgLyogYm91bmQgY29kZSBsZW5ndGhzLCBmb3JjZSByb290IHRvIGJlIHdpdGhpbiBjb2RlIGxlbmd0aHMgKi9cbiAgcm9vdCA9IGJpdHM7XG4gIGZvciAobWF4ID0gTUFYQklUUzsgbWF4ID49IDE7IG1heC0tKSB7XG4gICAgaWYgKGNvdW50W21heF0gIT09IDApIHsgYnJlYWs7IH1cbiAgfVxuICBpZiAocm9vdCA+IG1heCkge1xuICAgIHJvb3QgPSBtYXg7XG4gIH1cbiAgaWYgKG1heCA9PT0gMCkgeyAgICAgICAgICAgICAgICAgICAgIC8qIG5vIHN5bWJvbHMgdG8gY29kZSBhdCBhbGwgKi9cbiAgICAvL3RhYmxlLm9wW29wdHMudGFibGVfaW5kZXhdID0gNjQ7ICAvL2hlcmUub3AgPSAodmFyIGNoYXIpNjQ7ICAgIC8qIGludmFsaWQgY29kZSBtYXJrZXIgKi9cbiAgICAvL3RhYmxlLmJpdHNbb3B0cy50YWJsZV9pbmRleF0gPSAxOyAgIC8vaGVyZS5iaXRzID0gKHZhciBjaGFyKTE7XG4gICAgLy90YWJsZS52YWxbb3B0cy50YWJsZV9pbmRleCsrXSA9IDA7ICAgLy9oZXJlLnZhbCA9ICh2YXIgc2hvcnQpMDtcbiAgICB0YWJsZVt0YWJsZV9pbmRleCsrXSA9ICgxIDw8IDI0KSB8ICg2NCA8PCAxNikgfCAwO1xuXG5cbiAgICAvL3RhYmxlLm9wW29wdHMudGFibGVfaW5kZXhdID0gNjQ7XG4gICAgLy90YWJsZS5iaXRzW29wdHMudGFibGVfaW5kZXhdID0gMTtcbiAgICAvL3RhYmxlLnZhbFtvcHRzLnRhYmxlX2luZGV4KytdID0gMDtcbiAgICB0YWJsZVt0YWJsZV9pbmRleCsrXSA9ICgxIDw8IDI0KSB8ICg2NCA8PCAxNikgfCAwO1xuXG4gICAgb3B0cy5iaXRzID0gMTtcbiAgICByZXR1cm4gMDsgICAgIC8qIG5vIHN5bWJvbHMsIGJ1dCB3YWl0IGZvciBkZWNvZGluZyB0byByZXBvcnQgZXJyb3IgKi9cbiAgfVxuICBmb3IgKG1pbiA9IDE7IG1pbiA8IG1heDsgbWluKyspIHtcbiAgICBpZiAoY291bnRbbWluXSAhPT0gMCkgeyBicmVhazsgfVxuICB9XG4gIGlmIChyb290IDwgbWluKSB7XG4gICAgcm9vdCA9IG1pbjtcbiAgfVxuXG4gIC8qIGNoZWNrIGZvciBhbiBvdmVyLXN1YnNjcmliZWQgb3IgaW5jb21wbGV0ZSBzZXQgb2YgbGVuZ3RocyAqL1xuICBsZWZ0ID0gMTtcbiAgZm9yIChsZW4gPSAxOyBsZW4gPD0gTUFYQklUUzsgbGVuKyspIHtcbiAgICBsZWZ0IDw8PSAxO1xuICAgIGxlZnQgLT0gY291bnRbbGVuXTtcbiAgICBpZiAobGVmdCA8IDApIHtcbiAgICAgIHJldHVybiAtMTtcbiAgICB9ICAgICAgICAvKiBvdmVyLXN1YnNjcmliZWQgKi9cbiAgfVxuICBpZiAobGVmdCA+IDAgJiYgKHR5cGUgPT09IENPREVTJDEgfHwgbWF4ICE9PSAxKSkge1xuICAgIHJldHVybiAtMTsgICAgICAgICAgICAgICAgICAgICAgLyogaW5jb21wbGV0ZSBzZXQgKi9cbiAgfVxuXG4gIC8qIGdlbmVyYXRlIG9mZnNldHMgaW50byBzeW1ib2wgdGFibGUgZm9yIGVhY2ggbGVuZ3RoIGZvciBzb3J0aW5nICovXG4gIG9mZnNbMV0gPSAwO1xuICBmb3IgKGxlbiA9IDE7IGxlbiA8IE1BWEJJVFM7IGxlbisrKSB7XG4gICAgb2Zmc1tsZW4gKyAxXSA9IG9mZnNbbGVuXSArIGNvdW50W2xlbl07XG4gIH1cblxuICAvKiBzb3J0IHN5bWJvbHMgYnkgbGVuZ3RoLCBieSBzeW1ib2wgb3JkZXIgd2l0aGluIGVhY2ggbGVuZ3RoICovXG4gIGZvciAoc3ltID0gMDsgc3ltIDwgY29kZXM7IHN5bSsrKSB7XG4gICAgaWYgKGxlbnNbbGVuc19pbmRleCArIHN5bV0gIT09IDApIHtcbiAgICAgIHdvcmtbb2Zmc1tsZW5zW2xlbnNfaW5kZXggKyBzeW1dXSsrXSA9IHN5bTtcbiAgICB9XG4gIH1cblxuICAvKlxuICAgQ3JlYXRlIGFuZCBmaWxsIGluIGRlY29kaW5nIHRhYmxlcy4gIEluIHRoaXMgbG9vcCwgdGhlIHRhYmxlIGJlaW5nXG4gICBmaWxsZWQgaXMgYXQgbmV4dCBhbmQgaGFzIGN1cnIgaW5kZXggYml0cy4gIFRoZSBjb2RlIGJlaW5nIHVzZWQgaXMgaHVmZlxuICAgd2l0aCBsZW5ndGggbGVuLiAgVGhhdCBjb2RlIGlzIGNvbnZlcnRlZCB0byBhbiBpbmRleCBieSBkcm9wcGluZyBkcm9wXG4gICBiaXRzIG9mZiBvZiB0aGUgYm90dG9tLiAgRm9yIGNvZGVzIHdoZXJlIGxlbiBpcyBsZXNzIHRoYW4gZHJvcCArIGN1cnIsXG4gICB0aG9zZSB0b3AgZHJvcCArIGN1cnIgLSBsZW4gYml0cyBhcmUgaW5jcmVtZW50ZWQgdGhyb3VnaCBhbGwgdmFsdWVzIHRvXG4gICBmaWxsIHRoZSB0YWJsZSB3aXRoIHJlcGxpY2F0ZWQgZW50cmllcy5cblxuICAgcm9vdCBpcyB0aGUgbnVtYmVyIG9mIGluZGV4IGJpdHMgZm9yIHRoZSByb290IHRhYmxlLiAgV2hlbiBsZW4gZXhjZWVkc1xuICAgcm9vdCwgc3ViLXRhYmxlcyBhcmUgY3JlYXRlZCBwb2ludGVkIHRvIGJ5IHRoZSByb290IGVudHJ5IHdpdGggYW4gaW5kZXhcbiAgIG9mIHRoZSBsb3cgcm9vdCBiaXRzIG9mIGh1ZmYuICBUaGlzIGlzIHNhdmVkIGluIGxvdyB0byBjaGVjayBmb3Igd2hlbiBhXG4gICBuZXcgc3ViLXRhYmxlIHNob3VsZCBiZSBzdGFydGVkLiAgZHJvcCBpcyB6ZXJvIHdoZW4gdGhlIHJvb3QgdGFibGUgaXNcbiAgIGJlaW5nIGZpbGxlZCwgYW5kIGRyb3AgaXMgcm9vdCB3aGVuIHN1Yi10YWJsZXMgYXJlIGJlaW5nIGZpbGxlZC5cblxuICAgV2hlbiBhIG5ldyBzdWItdGFibGUgaXMgbmVlZGVkLCBpdCBpcyBuZWNlc3NhcnkgdG8gbG9vayBhaGVhZCBpbiB0aGVcbiAgIGNvZGUgbGVuZ3RocyB0byBkZXRlcm1pbmUgd2hhdCBzaXplIHN1Yi10YWJsZSBpcyBuZWVkZWQuICBUaGUgbGVuZ3RoXG4gICBjb3VudHMgYXJlIHVzZWQgZm9yIHRoaXMsIGFuZCBzbyBjb3VudFtdIGlzIGRlY3JlbWVudGVkIGFzIGNvZGVzIGFyZVxuICAgZW50ZXJlZCBpbiB0aGUgdGFibGVzLlxuXG4gICB1c2VkIGtlZXBzIHRyYWNrIG9mIGhvdyBtYW55IHRhYmxlIGVudHJpZXMgaGF2ZSBiZWVuIGFsbG9jYXRlZCBmcm9tIHRoZVxuICAgcHJvdmlkZWQgKnRhYmxlIHNwYWNlLiAgSXQgaXMgY2hlY2tlZCBmb3IgTEVOUyBhbmQgRElTVCB0YWJsZXMgYWdhaW5zdFxuICAgdGhlIGNvbnN0YW50cyBFTk9VR0hfTEVOUyBhbmQgRU5PVUdIX0RJU1RTIHRvIGd1YXJkIGFnYWluc3QgY2hhbmdlcyBpblxuICAgdGhlIGluaXRpYWwgcm9vdCB0YWJsZSBzaXplIGNvbnN0YW50cy4gIFNlZSB0aGUgY29tbWVudHMgaW4gaW5mdHJlZXMuaFxuICAgZm9yIG1vcmUgaW5mb3JtYXRpb24uXG5cbiAgIHN5bSBpbmNyZW1lbnRzIHRocm91Z2ggYWxsIHN5bWJvbHMsIGFuZCB0aGUgbG9vcCB0ZXJtaW5hdGVzIHdoZW5cbiAgIGFsbCBjb2RlcyBvZiBsZW5ndGggbWF4LCBpLmUuIGFsbCBjb2RlcywgaGF2ZSBiZWVuIHByb2Nlc3NlZC4gIFRoaXNcbiAgIHJvdXRpbmUgcGVybWl0cyBpbmNvbXBsZXRlIGNvZGVzLCBzbyBhbm90aGVyIGxvb3AgYWZ0ZXIgdGhpcyBvbmUgZmlsbHNcbiAgIGluIHRoZSByZXN0IG9mIHRoZSBkZWNvZGluZyB0YWJsZXMgd2l0aCBpbnZhbGlkIGNvZGUgbWFya2Vycy5cbiAgICovXG5cbiAgLyogc2V0IHVwIGZvciBjb2RlIHR5cGUgKi9cbiAgLy8gcG9vciBtYW4gb3B0aW1pemF0aW9uIC0gdXNlIGlmLWVsc2UgaW5zdGVhZCBvZiBzd2l0Y2gsXG4gIC8vIHRvIGF2b2lkIGRlb3B0cyBpbiBvbGQgdjhcbiAgaWYgKHR5cGUgPT09IENPREVTJDEpIHtcbiAgICBiYXNlID0gZXh0cmEgPSB3b3JrOyAgICAvKiBkdW1teSB2YWx1ZS0tbm90IHVzZWQgKi9cbiAgICBtYXRjaCA9IDIwO1xuXG4gIH0gZWxzZSBpZiAodHlwZSA9PT0gTEVOUyQxKSB7XG4gICAgYmFzZSA9IGxiYXNlO1xuICAgIGV4dHJhID0gbGV4dDtcbiAgICBtYXRjaCA9IDI1NztcblxuICB9IGVsc2UgeyAgICAgICAgICAgICAgICAgICAgLyogRElTVFMgKi9cbiAgICBiYXNlID0gZGJhc2U7XG4gICAgZXh0cmEgPSBkZXh0O1xuICAgIG1hdGNoID0gMDtcbiAgfVxuXG4gIC8qIGluaXRpYWxpemUgb3B0cyBmb3IgbG9vcCAqL1xuICBodWZmID0gMDsgICAgICAgICAgICAgICAgICAgLyogc3RhcnRpbmcgY29kZSAqL1xuICBzeW0gPSAwOyAgICAgICAgICAgICAgICAgICAgLyogc3RhcnRpbmcgY29kZSBzeW1ib2wgKi9cbiAgbGVuID0gbWluOyAgICAgICAgICAgICAgICAgIC8qIHN0YXJ0aW5nIGNvZGUgbGVuZ3RoICovXG4gIG5leHQgPSB0YWJsZV9pbmRleDsgICAgICAgICAgICAgIC8qIGN1cnJlbnQgdGFibGUgdG8gZmlsbCBpbiAqL1xuICBjdXJyID0gcm9vdDsgICAgICAgICAgICAgICAgLyogY3VycmVudCB0YWJsZSBpbmRleCBiaXRzICovXG4gIGRyb3AgPSAwOyAgICAgICAgICAgICAgICAgICAvKiBjdXJyZW50IGJpdHMgdG8gZHJvcCBmcm9tIGNvZGUgZm9yIGluZGV4ICovXG4gIGxvdyA9IC0xOyAgICAgICAgICAgICAgICAgICAvKiB0cmlnZ2VyIG5ldyBzdWItdGFibGUgd2hlbiBsZW4gPiByb290ICovXG4gIHVzZWQgPSAxIDw8IHJvb3Q7ICAgICAgICAgIC8qIHVzZSByb290IHRhYmxlIGVudHJpZXMgKi9cbiAgbWFzayA9IHVzZWQgLSAxOyAgICAgICAgICAgIC8qIG1hc2sgZm9yIGNvbXBhcmluZyBsb3cgKi9cblxuICAvKiBjaGVjayBhdmFpbGFibGUgdGFibGUgc3BhY2UgKi9cbiAgaWYgKCh0eXBlID09PSBMRU5TJDEgJiYgdXNlZCA+IEVOT1VHSF9MRU5TJDEpIHx8XG4gICAgKHR5cGUgPT09IERJU1RTJDEgJiYgdXNlZCA+IEVOT1VHSF9ESVNUUyQxKSkge1xuICAgIHJldHVybiAxO1xuICB9XG5cbiAgLyogcHJvY2VzcyBhbGwgY29kZXMgYW5kIG1ha2UgdGFibGUgZW50cmllcyAqL1xuICBmb3IgKDs7KSB7XG4gICAgLyogY3JlYXRlIHRhYmxlIGVudHJ5ICovXG4gICAgaGVyZV9iaXRzID0gbGVuIC0gZHJvcDtcbiAgICBpZiAod29ya1tzeW1dICsgMSA8IG1hdGNoKSB7XG4gICAgICBoZXJlX29wID0gMDtcbiAgICAgIGhlcmVfdmFsID0gd29ya1tzeW1dO1xuICAgIH1cbiAgICBlbHNlIGlmICh3b3JrW3N5bV0gPj0gbWF0Y2gpIHtcbiAgICAgIGhlcmVfb3AgPSBleHRyYVt3b3JrW3N5bV0gLSBtYXRjaF07XG4gICAgICBoZXJlX3ZhbCA9IGJhc2Vbd29ya1tzeW1dIC0gbWF0Y2hdO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGhlcmVfb3AgPSAzMiArIDY0OyAgICAgICAgIC8qIGVuZCBvZiBibG9jayAqL1xuICAgICAgaGVyZV92YWwgPSAwO1xuICAgIH1cblxuICAgIC8qIHJlcGxpY2F0ZSBmb3IgdGhvc2UgaW5kaWNlcyB3aXRoIGxvdyBsZW4gYml0cyBlcXVhbCB0byBodWZmICovXG4gICAgaW5jciA9IDEgPDwgKGxlbiAtIGRyb3ApO1xuICAgIGZpbGwgPSAxIDw8IGN1cnI7XG4gICAgbWluID0gZmlsbDsgICAgICAgICAgICAgICAgIC8qIHNhdmUgb2Zmc2V0IHRvIG5leHQgdGFibGUgKi9cbiAgICBkbyB7XG4gICAgICBmaWxsIC09IGluY3I7XG4gICAgICB0YWJsZVtuZXh0ICsgKGh1ZmYgPj4gZHJvcCkgKyBmaWxsXSA9IChoZXJlX2JpdHMgPDwgMjQpIHwgKGhlcmVfb3AgPDwgMTYpIHwgaGVyZV92YWwgfDA7XG4gICAgfSB3aGlsZSAoZmlsbCAhPT0gMCk7XG5cbiAgICAvKiBiYWNrd2FyZHMgaW5jcmVtZW50IHRoZSBsZW4tYml0IGNvZGUgaHVmZiAqL1xuICAgIGluY3IgPSAxIDw8IChsZW4gLSAxKTtcbiAgICB3aGlsZSAoaHVmZiAmIGluY3IpIHtcbiAgICAgIGluY3IgPj49IDE7XG4gICAgfVxuICAgIGlmIChpbmNyICE9PSAwKSB7XG4gICAgICBodWZmICY9IGluY3IgLSAxO1xuICAgICAgaHVmZiArPSBpbmNyO1xuICAgIH0gZWxzZSB7XG4gICAgICBodWZmID0gMDtcbiAgICB9XG5cbiAgICAvKiBnbyB0byBuZXh0IHN5bWJvbCwgdXBkYXRlIGNvdW50LCBsZW4gKi9cbiAgICBzeW0rKztcbiAgICBpZiAoLS1jb3VudFtsZW5dID09PSAwKSB7XG4gICAgICBpZiAobGVuID09PSBtYXgpIHsgYnJlYWs7IH1cbiAgICAgIGxlbiA9IGxlbnNbbGVuc19pbmRleCArIHdvcmtbc3ltXV07XG4gICAgfVxuXG4gICAgLyogY3JlYXRlIG5ldyBzdWItdGFibGUgaWYgbmVlZGVkICovXG4gICAgaWYgKGxlbiA+IHJvb3QgJiYgKGh1ZmYgJiBtYXNrKSAhPT0gbG93KSB7XG4gICAgICAvKiBpZiBmaXJzdCB0aW1lLCB0cmFuc2l0aW9uIHRvIHN1Yi10YWJsZXMgKi9cbiAgICAgIGlmIChkcm9wID09PSAwKSB7XG4gICAgICAgIGRyb3AgPSByb290O1xuICAgICAgfVxuXG4gICAgICAvKiBpbmNyZW1lbnQgcGFzdCBsYXN0IHRhYmxlICovXG4gICAgICBuZXh0ICs9IG1pbjsgICAgICAgICAgICAvKiBoZXJlIG1pbiBpcyAxIDw8IGN1cnIgKi9cblxuICAgICAgLyogZGV0ZXJtaW5lIGxlbmd0aCBvZiBuZXh0IHRhYmxlICovXG4gICAgICBjdXJyID0gbGVuIC0gZHJvcDtcbiAgICAgIGxlZnQgPSAxIDw8IGN1cnI7XG4gICAgICB3aGlsZSAoY3VyciArIGRyb3AgPCBtYXgpIHtcbiAgICAgICAgbGVmdCAtPSBjb3VudFtjdXJyICsgZHJvcF07XG4gICAgICAgIGlmIChsZWZ0IDw9IDApIHsgYnJlYWs7IH1cbiAgICAgICAgY3VycisrO1xuICAgICAgICBsZWZ0IDw8PSAxO1xuICAgICAgfVxuXG4gICAgICAvKiBjaGVjayBmb3IgZW5vdWdoIHNwYWNlICovXG4gICAgICB1c2VkICs9IDEgPDwgY3VycjtcbiAgICAgIGlmICgodHlwZSA9PT0gTEVOUyQxICYmIHVzZWQgPiBFTk9VR0hfTEVOUyQxKSB8fFxuICAgICAgICAodHlwZSA9PT0gRElTVFMkMSAmJiB1c2VkID4gRU5PVUdIX0RJU1RTJDEpKSB7XG4gICAgICAgIHJldHVybiAxO1xuICAgICAgfVxuXG4gICAgICAvKiBwb2ludCBlbnRyeSBpbiByb290IHRhYmxlIHRvIHN1Yi10YWJsZSAqL1xuICAgICAgbG93ID0gaHVmZiAmIG1hc2s7XG4gICAgICAvKnRhYmxlLm9wW2xvd10gPSBjdXJyO1xuICAgICAgdGFibGUuYml0c1tsb3ddID0gcm9vdDtcbiAgICAgIHRhYmxlLnZhbFtsb3ddID0gbmV4dCAtIG9wdHMudGFibGVfaW5kZXg7Ki9cbiAgICAgIHRhYmxlW2xvd10gPSAocm9vdCA8PCAyNCkgfCAoY3VyciA8PCAxNikgfCAobmV4dCAtIHRhYmxlX2luZGV4KSB8MDtcbiAgICB9XG4gIH1cblxuICAvKiBmaWxsIGluIHJlbWFpbmluZyB0YWJsZSBlbnRyeSBpZiBjb2RlIGlzIGluY29tcGxldGUgKGd1YXJhbnRlZWQgdG8gaGF2ZVxuICAgYXQgbW9zdCBvbmUgcmVtYWluaW5nIGVudHJ5LCBzaW5jZSBpZiB0aGUgY29kZSBpcyBpbmNvbXBsZXRlLCB0aGVcbiAgIG1heGltdW0gY29kZSBsZW5ndGggdGhhdCB3YXMgYWxsb3dlZCB0byBnZXQgdGhpcyBmYXIgaXMgb25lIGJpdCkgKi9cbiAgaWYgKGh1ZmYgIT09IDApIHtcbiAgICAvL3RhYmxlLm9wW25leHQgKyBodWZmXSA9IDY0OyAgICAgICAgICAgIC8qIGludmFsaWQgY29kZSBtYXJrZXIgKi9cbiAgICAvL3RhYmxlLmJpdHNbbmV4dCArIGh1ZmZdID0gbGVuIC0gZHJvcDtcbiAgICAvL3RhYmxlLnZhbFtuZXh0ICsgaHVmZl0gPSAwO1xuICAgIHRhYmxlW25leHQgKyBodWZmXSA9ICgobGVuIC0gZHJvcCkgPDwgMjQpIHwgKDY0IDw8IDE2KSB8MDtcbiAgfVxuXG4gIC8qIHNldCByZXR1cm4gcGFyYW1ldGVycyAqL1xuICAvL29wdHMudGFibGVfaW5kZXggKz0gdXNlZDtcbiAgb3B0cy5iaXRzID0gcm9vdDtcbiAgcmV0dXJuIDA7XG59O1xuXG5cbnZhciBpbmZ0cmVlcyA9IGluZmxhdGVfdGFibGU7XG5cbi8vIChDKSAxOTk1LTIwMTMgSmVhbi1sb3VwIEdhaWxseSBhbmQgTWFyayBBZGxlclxuLy8gKEMpIDIwMTQtMjAxNyBWaXRhbHkgUHV6cmluIGFuZCBBbmRyZXkgVHVwaXRzaW5cbi8vXG4vLyBUaGlzIHNvZnR3YXJlIGlzIHByb3ZpZGVkICdhcy1pcycsIHdpdGhvdXQgYW55IGV4cHJlc3Mgb3IgaW1wbGllZFxuLy8gd2FycmFudHkuIEluIG5vIGV2ZW50IHdpbGwgdGhlIGF1dGhvcnMgYmUgaGVsZCBsaWFibGUgZm9yIGFueSBkYW1hZ2VzXG4vLyBhcmlzaW5nIGZyb20gdGhlIHVzZSBvZiB0aGlzIHNvZnR3YXJlLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgZ3JhbnRlZCB0byBhbnlvbmUgdG8gdXNlIHRoaXMgc29mdHdhcmUgZm9yIGFueSBwdXJwb3NlLFxuLy8gaW5jbHVkaW5nIGNvbW1lcmNpYWwgYXBwbGljYXRpb25zLCBhbmQgdG8gYWx0ZXIgaXQgYW5kIHJlZGlzdHJpYnV0ZSBpdFxuLy8gZnJlZWx5LCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgcmVzdHJpY3Rpb25zOlxuLy9cbi8vIDEuIFRoZSBvcmlnaW4gb2YgdGhpcyBzb2Z0d2FyZSBtdXN0IG5vdCBiZSBtaXNyZXByZXNlbnRlZDsgeW91IG11c3Qgbm90XG4vLyAgIGNsYWltIHRoYXQgeW91IHdyb3RlIHRoZSBvcmlnaW5hbCBzb2Z0d2FyZS4gSWYgeW91IHVzZSB0aGlzIHNvZnR3YXJlXG4vLyAgIGluIGEgcHJvZHVjdCwgYW4gYWNrbm93bGVkZ21lbnQgaW4gdGhlIHByb2R1Y3QgZG9jdW1lbnRhdGlvbiB3b3VsZCBiZVxuLy8gICBhcHByZWNpYXRlZCBidXQgaXMgbm90IHJlcXVpcmVkLlxuLy8gMi4gQWx0ZXJlZCBzb3VyY2UgdmVyc2lvbnMgbXVzdCBiZSBwbGFpbmx5IG1hcmtlZCBhcyBzdWNoLCBhbmQgbXVzdCBub3QgYmVcbi8vICAgbWlzcmVwcmVzZW50ZWQgYXMgYmVpbmcgdGhlIG9yaWdpbmFsIHNvZnR3YXJlLlxuLy8gMy4gVGhpcyBub3RpY2UgbWF5IG5vdCBiZSByZW1vdmVkIG9yIGFsdGVyZWQgZnJvbSBhbnkgc291cmNlIGRpc3RyaWJ1dGlvbi5cblxuXG5cblxuXG5cbmNvbnN0IENPREVTID0gMDtcbmNvbnN0IExFTlMgPSAxO1xuY29uc3QgRElTVFMgPSAyO1xuXG4vKiBQdWJsaWMgY29uc3RhbnRzID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0qL1xuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Ki9cblxuY29uc3Qge1xuICBaX0ZJTklTSDogWl9GSU5JU0gkMSwgWl9CTE9DSywgWl9UUkVFUyxcbiAgWl9PSzogWl9PSyQxLCBaX1NUUkVBTV9FTkQ6IFpfU1RSRUFNX0VORCQxLCBaX05FRURfRElDVDogWl9ORUVEX0RJQ1QkMSwgWl9TVFJFQU1fRVJST1I6IFpfU1RSRUFNX0VSUk9SJDEsIFpfREFUQV9FUlJPUjogWl9EQVRBX0VSUk9SJDEsIFpfTUVNX0VSUk9SOiBaX01FTV9FUlJPUiQxLCBaX0JVRl9FUlJPUixcbiAgWl9ERUZMQVRFRFxufSA9IGNvbnN0YW50cyQyO1xuXG5cbi8qIFNUQVRFUyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSovXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0qL1xuXG5cbmNvbnN0ICAgIEhFQUQgPSAxNjE4MDsgICAgICAgLyogaTogd2FpdGluZyBmb3IgbWFnaWMgaGVhZGVyICovXG5jb25zdCAgICBGTEFHUyA9IDE2MTgxOyAgICAgIC8qIGk6IHdhaXRpbmcgZm9yIG1ldGhvZCBhbmQgZmxhZ3MgKGd6aXApICovXG5jb25zdCAgICBUSU1FID0gMTYxODI7ICAgICAgIC8qIGk6IHdhaXRpbmcgZm9yIG1vZGlmaWNhdGlvbiB0aW1lIChnemlwKSAqL1xuY29uc3QgICAgT1MgPSAxNjE4MzsgICAgICAgICAvKiBpOiB3YWl0aW5nIGZvciBleHRyYSBmbGFncyBhbmQgb3BlcmF0aW5nIHN5c3RlbSAoZ3ppcCkgKi9cbmNvbnN0ICAgIEVYTEVOID0gMTYxODQ7ICAgICAgLyogaTogd2FpdGluZyBmb3IgZXh0cmEgbGVuZ3RoIChnemlwKSAqL1xuY29uc3QgICAgRVhUUkEgPSAxNjE4NTsgICAgICAvKiBpOiB3YWl0aW5nIGZvciBleHRyYSBieXRlcyAoZ3ppcCkgKi9cbmNvbnN0ICAgIE5BTUUgPSAxNjE4NjsgICAgICAgLyogaTogd2FpdGluZyBmb3IgZW5kIG9mIGZpbGUgbmFtZSAoZ3ppcCkgKi9cbmNvbnN0ICAgIENPTU1FTlQgPSAxNjE4NzsgICAgLyogaTogd2FpdGluZyBmb3IgZW5kIG9mIGNvbW1lbnQgKGd6aXApICovXG5jb25zdCAgICBIQ1JDID0gMTYxODg7ICAgICAgIC8qIGk6IHdhaXRpbmcgZm9yIGhlYWRlciBjcmMgKGd6aXApICovXG5jb25zdCAgICBESUNUSUQgPSAxNjE4OTsgICAgLyogaTogd2FpdGluZyBmb3IgZGljdGlvbmFyeSBjaGVjayB2YWx1ZSAqL1xuY29uc3QgICAgRElDVCA9IDE2MTkwOyAgICAgIC8qIHdhaXRpbmcgZm9yIGluZmxhdGVTZXREaWN0aW9uYXJ5KCkgY2FsbCAqL1xuY29uc3QgICAgICAgIFRZUEUgPSAxNjE5MTsgICAgICAvKiBpOiB3YWl0aW5nIGZvciB0eXBlIGJpdHMsIGluY2x1ZGluZyBsYXN0LWZsYWcgYml0ICovXG5jb25zdCAgICAgICAgVFlQRURPID0gMTYxOTI7ICAgIC8qIGk6IHNhbWUsIGJ1dCBza2lwIGNoZWNrIHRvIGV4aXQgaW5mbGF0ZSBvbiBuZXcgYmxvY2sgKi9cbmNvbnN0ICAgICAgICBTVE9SRUQgPSAxNjE5MzsgICAgLyogaTogd2FpdGluZyBmb3Igc3RvcmVkIHNpemUgKGxlbmd0aCBhbmQgY29tcGxlbWVudCkgKi9cbmNvbnN0ICAgICAgICBDT1BZXyA9IDE2MTk0OyAgICAgLyogaS9vOiBzYW1lIGFzIENPUFkgYmVsb3csIGJ1dCBvbmx5IGZpcnN0IHRpbWUgaW4gKi9cbmNvbnN0ICAgICAgICBDT1BZID0gMTYxOTU7ICAgICAgLyogaS9vOiB3YWl0aW5nIGZvciBpbnB1dCBvciBvdXRwdXQgdG8gY29weSBzdG9yZWQgYmxvY2sgKi9cbmNvbnN0ICAgICAgICBUQUJMRSA9IDE2MTk2OyAgICAgLyogaTogd2FpdGluZyBmb3IgZHluYW1pYyBibG9jayB0YWJsZSBsZW5ndGhzICovXG5jb25zdCAgICAgICAgTEVOTEVOUyA9IDE2MTk3OyAgIC8qIGk6IHdhaXRpbmcgZm9yIGNvZGUgbGVuZ3RoIGNvZGUgbGVuZ3RocyAqL1xuY29uc3QgICAgICAgIENPREVMRU5TID0gMTYxOTg7ICAvKiBpOiB3YWl0aW5nIGZvciBsZW5ndGgvbGl0IGFuZCBkaXN0YW5jZSBjb2RlIGxlbmd0aHMgKi9cbmNvbnN0ICAgICAgICAgICAgTEVOXyA9IDE2MTk5OyAgICAgIC8qIGk6IHNhbWUgYXMgTEVOIGJlbG93LCBidXQgb25seSBmaXJzdCB0aW1lIGluICovXG5jb25zdCAgICAgICAgICAgIExFTiA9IDE2MjAwOyAgICAgICAvKiBpOiB3YWl0aW5nIGZvciBsZW5ndGgvbGl0L2VvYiBjb2RlICovXG5jb25zdCAgICAgICAgICAgIExFTkVYVCA9IDE2MjAxOyAgICAvKiBpOiB3YWl0aW5nIGZvciBsZW5ndGggZXh0cmEgYml0cyAqL1xuY29uc3QgICAgICAgICAgICBESVNUID0gMTYyMDI7ICAgICAgLyogaTogd2FpdGluZyBmb3IgZGlzdGFuY2UgY29kZSAqL1xuY29uc3QgICAgICAgICAgICBESVNURVhUID0gMTYyMDM7ICAgLyogaTogd2FpdGluZyBmb3IgZGlzdGFuY2UgZXh0cmEgYml0cyAqL1xuY29uc3QgICAgICAgICAgICBNQVRDSCA9IDE2MjA0OyAgICAgLyogbzogd2FpdGluZyBmb3Igb3V0cHV0IHNwYWNlIHRvIGNvcHkgc3RyaW5nICovXG5jb25zdCAgICAgICAgICAgIExJVCA9IDE2MjA1OyAgICAgICAvKiBvOiB3YWl0aW5nIGZvciBvdXRwdXQgc3BhY2UgdG8gd3JpdGUgbGl0ZXJhbCAqL1xuY29uc3QgICAgQ0hFQ0sgPSAxNjIwNjsgICAgIC8qIGk6IHdhaXRpbmcgZm9yIDMyLWJpdCBjaGVjayB2YWx1ZSAqL1xuY29uc3QgICAgTEVOR1RIID0gMTYyMDc7ICAgIC8qIGk6IHdhaXRpbmcgZm9yIDMyLWJpdCBsZW5ndGggKGd6aXApICovXG5jb25zdCAgICBET05FID0gMTYyMDg7ICAgICAgLyogZmluaXNoZWQgY2hlY2ssIGRvbmUgLS0gcmVtYWluIGhlcmUgdW50aWwgcmVzZXQgKi9cbmNvbnN0ICAgIEJBRCA9IDE2MjA5OyAgICAgICAvKiBnb3QgYSBkYXRhIGVycm9yIC0tIHJlbWFpbiBoZXJlIHVudGlsIHJlc2V0ICovXG5jb25zdCAgICBNRU0gPSAxNjIxMDsgICAgICAgLyogZ290IGFuIGluZmxhdGUoKSBtZW1vcnkgZXJyb3IgLS0gcmVtYWluIGhlcmUgdW50aWwgcmVzZXQgKi9cbmNvbnN0ICAgIFNZTkMgPSAxNjIxMTsgICAgICAvKiBsb29raW5nIGZvciBzeW5jaHJvbml6YXRpb24gYnl0ZXMgdG8gcmVzdGFydCBpbmZsYXRlKCkgKi9cblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Ki9cblxuXG5cbmNvbnN0IEVOT1VHSF9MRU5TID0gODUyO1xuY29uc3QgRU5PVUdIX0RJU1RTID0gNTkyO1xuLy9jb25zdCBFTk9VR0ggPSAgKEVOT1VHSF9MRU5TK0VOT1VHSF9ESVNUUyk7XG5cbmNvbnN0IE1BWF9XQklUUyA9IDE1O1xuLyogMzJLIExaNzcgd2luZG93ICovXG5jb25zdCBERUZfV0JJVFMgPSBNQVhfV0JJVFM7XG5cblxuY29uc3QgenN3YXAzMiA9IChxKSA9PiB7XG5cbiAgcmV0dXJuICAoKChxID4+PiAyNCkgJiAweGZmKSArXG4gICAgICAgICAgKChxID4+PiA4KSAmIDB4ZmYwMCkgK1xuICAgICAgICAgICgocSAmIDB4ZmYwMCkgPDwgOCkgK1xuICAgICAgICAgICgocSAmIDB4ZmYpIDw8IDI0KSk7XG59O1xuXG5cbmZ1bmN0aW9uIEluZmxhdGVTdGF0ZSgpIHtcbiAgdGhpcy5zdHJtID0gbnVsbDsgICAgICAgICAgIC8qIHBvaW50ZXIgYmFjayB0byB0aGlzIHpsaWIgc3RyZWFtICovXG4gIHRoaXMubW9kZSA9IDA7ICAgICAgICAgICAgICAvKiBjdXJyZW50IGluZmxhdGUgbW9kZSAqL1xuICB0aGlzLmxhc3QgPSBmYWxzZTsgICAgICAgICAgLyogdHJ1ZSBpZiBwcm9jZXNzaW5nIGxhc3QgYmxvY2sgKi9cbiAgdGhpcy53cmFwID0gMDsgICAgICAgICAgICAgIC8qIGJpdCAwIHRydWUgZm9yIHpsaWIsIGJpdCAxIHRydWUgZm9yIGd6aXAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBiaXQgMiB0cnVlIHRvIHZhbGlkYXRlIGNoZWNrIHZhbHVlICovXG4gIHRoaXMuaGF2ZWRpY3QgPSBmYWxzZTsgICAgICAvKiB0cnVlIGlmIGRpY3Rpb25hcnkgcHJvdmlkZWQgKi9cbiAgdGhpcy5mbGFncyA9IDA7ICAgICAgICAgICAgIC8qIGd6aXAgaGVhZGVyIG1ldGhvZCBhbmQgZmxhZ3MgKDAgaWYgemxpYiksIG9yXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAtMSBpZiByYXcgb3Igbm8gaGVhZGVyIHlldCAqL1xuICB0aGlzLmRtYXggPSAwOyAgICAgICAgICAgICAgLyogemxpYiBoZWFkZXIgbWF4IGRpc3RhbmNlIChJTkZMQVRFX1NUUklDVCkgKi9cbiAgdGhpcy5jaGVjayA9IDA7ICAgICAgICAgICAgIC8qIHByb3RlY3RlZCBjb3B5IG9mIGNoZWNrIHZhbHVlICovXG4gIHRoaXMudG90YWwgPSAwOyAgICAgICAgICAgICAvKiBwcm90ZWN0ZWQgY29weSBvZiBvdXRwdXQgY291bnQgKi9cbiAgLy8gVE9ETzogbWF5IGJlIHt9XG4gIHRoaXMuaGVhZCA9IG51bGw7ICAgICAgICAgICAvKiB3aGVyZSB0byBzYXZlIGd6aXAgaGVhZGVyIGluZm9ybWF0aW9uICovXG5cbiAgLyogc2xpZGluZyB3aW5kb3cgKi9cbiAgdGhpcy53Yml0cyA9IDA7ICAgICAgICAgICAgIC8qIGxvZyBiYXNlIDIgb2YgcmVxdWVzdGVkIHdpbmRvdyBzaXplICovXG4gIHRoaXMud3NpemUgPSAwOyAgICAgICAgICAgICAvKiB3aW5kb3cgc2l6ZSBvciB6ZXJvIGlmIG5vdCB1c2luZyB3aW5kb3cgKi9cbiAgdGhpcy53aGF2ZSA9IDA7ICAgICAgICAgICAgIC8qIHZhbGlkIGJ5dGVzIGluIHRoZSB3aW5kb3cgKi9cbiAgdGhpcy53bmV4dCA9IDA7ICAgICAgICAgICAgIC8qIHdpbmRvdyB3cml0ZSBpbmRleCAqL1xuICB0aGlzLndpbmRvdyA9IG51bGw7ICAgICAgICAgLyogYWxsb2NhdGVkIHNsaWRpbmcgd2luZG93LCBpZiBuZWVkZWQgKi9cblxuICAvKiBiaXQgYWNjdW11bGF0b3IgKi9cbiAgdGhpcy5ob2xkID0gMDsgICAgICAgICAgICAgIC8qIGlucHV0IGJpdCBhY2N1bXVsYXRvciAqL1xuICB0aGlzLmJpdHMgPSAwOyAgICAgICAgICAgICAgLyogbnVtYmVyIG9mIGJpdHMgaW4gXCJpblwiICovXG5cbiAgLyogZm9yIHN0cmluZyBhbmQgc3RvcmVkIGJsb2NrIGNvcHlpbmcgKi9cbiAgdGhpcy5sZW5ndGggPSAwOyAgICAgICAgICAgIC8qIGxpdGVyYWwgb3IgbGVuZ3RoIG9mIGRhdGEgdG8gY29weSAqL1xuICB0aGlzLm9mZnNldCA9IDA7ICAgICAgICAgICAgLyogZGlzdGFuY2UgYmFjayB0byBjb3B5IHN0cmluZyBmcm9tICovXG5cbiAgLyogZm9yIHRhYmxlIGFuZCBjb2RlIGRlY29kaW5nICovXG4gIHRoaXMuZXh0cmEgPSAwOyAgICAgICAgICAgICAvKiBleHRyYSBiaXRzIG5lZWRlZCAqL1xuXG4gIC8qIGZpeGVkIGFuZCBkeW5hbWljIGNvZGUgdGFibGVzICovXG4gIHRoaXMubGVuY29kZSA9IG51bGw7ICAgICAgICAgIC8qIHN0YXJ0aW5nIHRhYmxlIGZvciBsZW5ndGgvbGl0ZXJhbCBjb2RlcyAqL1xuICB0aGlzLmRpc3Rjb2RlID0gbnVsbDsgICAgICAgICAvKiBzdGFydGluZyB0YWJsZSBmb3IgZGlzdGFuY2UgY29kZXMgKi9cbiAgdGhpcy5sZW5iaXRzID0gMDsgICAgICAgICAgIC8qIGluZGV4IGJpdHMgZm9yIGxlbmNvZGUgKi9cbiAgdGhpcy5kaXN0Yml0cyA9IDA7ICAgICAgICAgIC8qIGluZGV4IGJpdHMgZm9yIGRpc3Rjb2RlICovXG5cbiAgLyogZHluYW1pYyB0YWJsZSBidWlsZGluZyAqL1xuICB0aGlzLm5jb2RlID0gMDsgICAgICAgICAgICAgLyogbnVtYmVyIG9mIGNvZGUgbGVuZ3RoIGNvZGUgbGVuZ3RocyAqL1xuICB0aGlzLm5sZW4gPSAwOyAgICAgICAgICAgICAgLyogbnVtYmVyIG9mIGxlbmd0aCBjb2RlIGxlbmd0aHMgKi9cbiAgdGhpcy5uZGlzdCA9IDA7ICAgICAgICAgICAgIC8qIG51bWJlciBvZiBkaXN0YW5jZSBjb2RlIGxlbmd0aHMgKi9cbiAgdGhpcy5oYXZlID0gMDsgICAgICAgICAgICAgIC8qIG51bWJlciBvZiBjb2RlIGxlbmd0aHMgaW4gbGVuc1tdICovXG4gIHRoaXMubmV4dCA9IG51bGw7ICAgICAgICAgICAgICAvKiBuZXh0IGF2YWlsYWJsZSBzcGFjZSBpbiBjb2Rlc1tdICovXG5cbiAgdGhpcy5sZW5zID0gbmV3IFVpbnQxNkFycmF5KDMyMCk7IC8qIHRlbXBvcmFyeSBzdG9yYWdlIGZvciBjb2RlIGxlbmd0aHMgKi9cbiAgdGhpcy53b3JrID0gbmV3IFVpbnQxNkFycmF5KDI4OCk7IC8qIHdvcmsgYXJlYSBmb3IgY29kZSB0YWJsZSBidWlsZGluZyAqL1xuXG4gIC8qXG4gICBiZWNhdXNlIHdlIGRvbid0IGhhdmUgcG9pbnRlcnMgaW4ganMsIHdlIHVzZSBsZW5jb2RlIGFuZCBkaXN0Y29kZSBkaXJlY3RseVxuICAgYXMgYnVmZmVycyBzbyB3ZSBkb24ndCBuZWVkIGNvZGVzXG4gICovXG4gIC8vdGhpcy5jb2RlcyA9IG5ldyBJbnQzMkFycmF5KEVOT1VHSCk7ICAgICAgIC8qIHNwYWNlIGZvciBjb2RlIHRhYmxlcyAqL1xuICB0aGlzLmxlbmR5biA9IG51bGw7ICAgICAgICAgICAgICAvKiBkeW5hbWljIHRhYmxlIGZvciBsZW5ndGgvbGl0ZXJhbCBjb2RlcyAoSlMgc3BlY2lmaWMpICovXG4gIHRoaXMuZGlzdGR5biA9IG51bGw7ICAgICAgICAgICAgIC8qIGR5bmFtaWMgdGFibGUgZm9yIGRpc3RhbmNlIGNvZGVzIChKUyBzcGVjaWZpYykgKi9cbiAgdGhpcy5zYW5lID0gMDsgICAgICAgICAgICAgICAgICAgLyogaWYgZmFsc2UsIGFsbG93IGludmFsaWQgZGlzdGFuY2UgdG9vIGZhciAqL1xuICB0aGlzLmJhY2sgPSAwOyAgICAgICAgICAgICAgICAgICAvKiBiaXRzIGJhY2sgb2YgbGFzdCB1bnByb2Nlc3NlZCBsZW5ndGgvbGl0ICovXG4gIHRoaXMud2FzID0gMDsgICAgICAgICAgICAgICAgICAgIC8qIGluaXRpYWwgbGVuZ3RoIG9mIG1hdGNoICovXG59XG5cblxuY29uc3QgaW5mbGF0ZVN0YXRlQ2hlY2sgPSAoc3RybSkgPT4ge1xuXG4gIGlmICghc3RybSkge1xuICAgIHJldHVybiAxO1xuICB9XG4gIGNvbnN0IHN0YXRlID0gc3RybS5zdGF0ZTtcbiAgaWYgKCFzdGF0ZSB8fCBzdGF0ZS5zdHJtICE9PSBzdHJtIHx8XG4gICAgc3RhdGUubW9kZSA8IEhFQUQgfHwgc3RhdGUubW9kZSA+IFNZTkMpIHtcbiAgICByZXR1cm4gMTtcbiAgfVxuICByZXR1cm4gMDtcbn07XG5cblxuY29uc3QgaW5mbGF0ZVJlc2V0S2VlcCA9IChzdHJtKSA9PiB7XG5cbiAgaWYgKGluZmxhdGVTdGF0ZUNoZWNrKHN0cm0pKSB7IHJldHVybiBaX1NUUkVBTV9FUlJPUiQxOyB9XG4gIGNvbnN0IHN0YXRlID0gc3RybS5zdGF0ZTtcbiAgc3RybS50b3RhbF9pbiA9IHN0cm0udG90YWxfb3V0ID0gc3RhdGUudG90YWwgPSAwO1xuICBzdHJtLm1zZyA9ICcnOyAvKlpfTlVMTCovXG4gIGlmIChzdGF0ZS53cmFwKSB7ICAgICAgIC8qIHRvIHN1cHBvcnQgaWxsLWNvbmNlaXZlZCBKYXZhIHRlc3Qgc3VpdGUgKi9cbiAgICBzdHJtLmFkbGVyID0gc3RhdGUud3JhcCAmIDE7XG4gIH1cbiAgc3RhdGUubW9kZSA9IEhFQUQ7XG4gIHN0YXRlLmxhc3QgPSAwO1xuICBzdGF0ZS5oYXZlZGljdCA9IDA7XG4gIHN0YXRlLmZsYWdzID0gLTE7XG4gIHN0YXRlLmRtYXggPSAzMjc2ODtcbiAgc3RhdGUuaGVhZCA9IG51bGwvKlpfTlVMTCovO1xuICBzdGF0ZS5ob2xkID0gMDtcbiAgc3RhdGUuYml0cyA9IDA7XG4gIC8vc3RhdGUubGVuY29kZSA9IHN0YXRlLmRpc3Rjb2RlID0gc3RhdGUubmV4dCA9IHN0YXRlLmNvZGVzO1xuICBzdGF0ZS5sZW5jb2RlID0gc3RhdGUubGVuZHluID0gbmV3IEludDMyQXJyYXkoRU5PVUdIX0xFTlMpO1xuICBzdGF0ZS5kaXN0Y29kZSA9IHN0YXRlLmRpc3RkeW4gPSBuZXcgSW50MzJBcnJheShFTk9VR0hfRElTVFMpO1xuXG4gIHN0YXRlLnNhbmUgPSAxO1xuICBzdGF0ZS5iYWNrID0gLTE7XG4gIC8vVHJhY2V2KChzdGRlcnIsIFwiaW5mbGF0ZTogcmVzZXRcXG5cIikpO1xuICByZXR1cm4gWl9PSyQxO1xufTtcblxuXG5jb25zdCBpbmZsYXRlUmVzZXQgPSAoc3RybSkgPT4ge1xuXG4gIGlmIChpbmZsYXRlU3RhdGVDaGVjayhzdHJtKSkgeyByZXR1cm4gWl9TVFJFQU1fRVJST1IkMTsgfVxuICBjb25zdCBzdGF0ZSA9IHN0cm0uc3RhdGU7XG4gIHN0YXRlLndzaXplID0gMDtcbiAgc3RhdGUud2hhdmUgPSAwO1xuICBzdGF0ZS53bmV4dCA9IDA7XG4gIHJldHVybiBpbmZsYXRlUmVzZXRLZWVwKHN0cm0pO1xuXG59O1xuXG5cbmNvbnN0IGluZmxhdGVSZXNldDIgPSAoc3RybSwgd2luZG93Qml0cykgPT4ge1xuICBsZXQgd3JhcDtcblxuICAvKiBnZXQgdGhlIHN0YXRlICovXG4gIGlmIChpbmZsYXRlU3RhdGVDaGVjayhzdHJtKSkgeyByZXR1cm4gWl9TVFJFQU1fRVJST1IkMTsgfVxuICBjb25zdCBzdGF0ZSA9IHN0cm0uc3RhdGU7XG5cbiAgLyogZXh0cmFjdCB3cmFwIHJlcXVlc3QgZnJvbSB3aW5kb3dCaXRzIHBhcmFtZXRlciAqL1xuICBpZiAod2luZG93Qml0cyA8IDApIHtcbiAgICB3cmFwID0gMDtcbiAgICB3aW5kb3dCaXRzID0gLXdpbmRvd0JpdHM7XG4gIH1cbiAgZWxzZSB7XG4gICAgd3JhcCA9ICh3aW5kb3dCaXRzID4+IDQpICsgNTtcbiAgICBpZiAod2luZG93Qml0cyA8IDQ4KSB7XG4gICAgICB3aW5kb3dCaXRzICY9IDE1O1xuICAgIH1cbiAgfVxuXG4gIC8qIHNldCBudW1iZXIgb2Ygd2luZG93IGJpdHMsIGZyZWUgd2luZG93IGlmIGRpZmZlcmVudCAqL1xuICBpZiAod2luZG93Qml0cyAmJiAod2luZG93Qml0cyA8IDggfHwgd2luZG93Qml0cyA+IDE1KSkge1xuICAgIHJldHVybiBaX1NUUkVBTV9FUlJPUiQxO1xuICB9XG4gIGlmIChzdGF0ZS53aW5kb3cgIT09IG51bGwgJiYgc3RhdGUud2JpdHMgIT09IHdpbmRvd0JpdHMpIHtcbiAgICBzdGF0ZS53aW5kb3cgPSBudWxsO1xuICB9XG5cbiAgLyogdXBkYXRlIHN0YXRlIGFuZCByZXNldCB0aGUgcmVzdCBvZiBpdCAqL1xuICBzdGF0ZS53cmFwID0gd3JhcDtcbiAgc3RhdGUud2JpdHMgPSB3aW5kb3dCaXRzO1xuICByZXR1cm4gaW5mbGF0ZVJlc2V0KHN0cm0pO1xufTtcblxuXG5jb25zdCBpbmZsYXRlSW5pdDIgPSAoc3RybSwgd2luZG93Qml0cykgPT4ge1xuXG4gIGlmICghc3RybSkgeyByZXR1cm4gWl9TVFJFQU1fRVJST1IkMTsgfVxuICAvL3N0cm0ubXNnID0gWl9OVUxMOyAgICAgICAgICAgICAgICAgLyogaW4gY2FzZSB3ZSByZXR1cm4gYW4gZXJyb3IgKi9cblxuICBjb25zdCBzdGF0ZSA9IG5ldyBJbmZsYXRlU3RhdGUoKTtcblxuICAvL2lmIChzdGF0ZSA9PT0gWl9OVUxMKSByZXR1cm4gWl9NRU1fRVJST1I7XG4gIC8vVHJhY2V2KChzdGRlcnIsIFwiaW5mbGF0ZTogYWxsb2NhdGVkXFxuXCIpKTtcbiAgc3RybS5zdGF0ZSA9IHN0YXRlO1xuICBzdGF0ZS5zdHJtID0gc3RybTtcbiAgc3RhdGUud2luZG93ID0gbnVsbC8qWl9OVUxMKi87XG4gIHN0YXRlLm1vZGUgPSBIRUFEOyAgICAgLyogdG8gcGFzcyBzdGF0ZSB0ZXN0IGluIGluZmxhdGVSZXNldDIoKSAqL1xuICBjb25zdCByZXQgPSBpbmZsYXRlUmVzZXQyKHN0cm0sIHdpbmRvd0JpdHMpO1xuICBpZiAocmV0ICE9PSBaX09LJDEpIHtcbiAgICBzdHJtLnN0YXRlID0gbnVsbC8qWl9OVUxMKi87XG4gIH1cbiAgcmV0dXJuIHJldDtcbn07XG5cblxuY29uc3QgaW5mbGF0ZUluaXQgPSAoc3RybSkgPT4ge1xuXG4gIHJldHVybiBpbmZsYXRlSW5pdDIoc3RybSwgREVGX1dCSVRTKTtcbn07XG5cblxuLypcbiBSZXR1cm4gc3RhdGUgd2l0aCBsZW5ndGggYW5kIGRpc3RhbmNlIGRlY29kaW5nIHRhYmxlcyBhbmQgaW5kZXggc2l6ZXMgc2V0IHRvXG4gZml4ZWQgY29kZSBkZWNvZGluZy4gIE5vcm1hbGx5IHRoaXMgcmV0dXJucyBmaXhlZCB0YWJsZXMgZnJvbSBpbmZmaXhlZC5oLlxuIElmIEJVSUxERklYRUQgaXMgZGVmaW5lZCwgdGhlbiBpbnN0ZWFkIHRoaXMgcm91dGluZSBidWlsZHMgdGhlIHRhYmxlcyB0aGVcbiBmaXJzdCB0aW1lIGl0J3MgY2FsbGVkLCBhbmQgcmV0dXJucyB0aG9zZSB0YWJsZXMgdGhlIGZpcnN0IHRpbWUgYW5kXG4gdGhlcmVhZnRlci4gIFRoaXMgcmVkdWNlcyB0aGUgc2l6ZSBvZiB0aGUgY29kZSBieSBhYm91dCAySyBieXRlcywgaW5cbiBleGNoYW5nZSBmb3IgYSBsaXR0bGUgZXhlY3V0aW9uIHRpbWUuICBIb3dldmVyLCBCVUlMREZJWEVEIHNob3VsZCBub3QgYmVcbiB1c2VkIGZvciB0aHJlYWRlZCBhcHBsaWNhdGlvbnMsIHNpbmNlIHRoZSByZXdyaXRpbmcgb2YgdGhlIHRhYmxlcyBhbmQgdmlyZ2luXG4gbWF5IG5vdCBiZSB0aHJlYWQtc2FmZS5cbiAqL1xubGV0IHZpcmdpbiA9IHRydWU7XG5cbmxldCBsZW5maXgsIGRpc3RmaXg7IC8vIFdlIGhhdmUgbm8gcG9pbnRlcnMgaW4gSlMsIHNvIGtlZXAgdGFibGVzIHNlcGFyYXRlXG5cblxuY29uc3QgZml4ZWR0YWJsZXMgPSAoc3RhdGUpID0+IHtcblxuICAvKiBidWlsZCBmaXhlZCBodWZmbWFuIHRhYmxlcyBpZiBmaXJzdCBjYWxsIChtYXkgbm90IGJlIHRocmVhZCBzYWZlKSAqL1xuICBpZiAodmlyZ2luKSB7XG4gICAgbGVuZml4ID0gbmV3IEludDMyQXJyYXkoNTEyKTtcbiAgICBkaXN0Zml4ID0gbmV3IEludDMyQXJyYXkoMzIpO1xuXG4gICAgLyogbGl0ZXJhbC9sZW5ndGggdGFibGUgKi9cbiAgICBsZXQgc3ltID0gMDtcbiAgICB3aGlsZSAoc3ltIDwgMTQ0KSB7IHN0YXRlLmxlbnNbc3ltKytdID0gODsgfVxuICAgIHdoaWxlIChzeW0gPCAyNTYpIHsgc3RhdGUubGVuc1tzeW0rK10gPSA5OyB9XG4gICAgd2hpbGUgKHN5bSA8IDI4MCkgeyBzdGF0ZS5sZW5zW3N5bSsrXSA9IDc7IH1cbiAgICB3aGlsZSAoc3ltIDwgMjg4KSB7IHN0YXRlLmxlbnNbc3ltKytdID0gODsgfVxuXG4gICAgaW5mdHJlZXMoTEVOUywgIHN0YXRlLmxlbnMsIDAsIDI4OCwgbGVuZml4LCAgIDAsIHN0YXRlLndvcmssIHsgYml0czogOSB9KTtcblxuICAgIC8qIGRpc3RhbmNlIHRhYmxlICovXG4gICAgc3ltID0gMDtcbiAgICB3aGlsZSAoc3ltIDwgMzIpIHsgc3RhdGUubGVuc1tzeW0rK10gPSA1OyB9XG5cbiAgICBpbmZ0cmVlcyhESVNUUywgc3RhdGUubGVucywgMCwgMzIsICAgZGlzdGZpeCwgMCwgc3RhdGUud29yaywgeyBiaXRzOiA1IH0pO1xuXG4gICAgLyogZG8gdGhpcyBqdXN0IG9uY2UgKi9cbiAgICB2aXJnaW4gPSBmYWxzZTtcbiAgfVxuXG4gIHN0YXRlLmxlbmNvZGUgPSBsZW5maXg7XG4gIHN0YXRlLmxlbmJpdHMgPSA5O1xuICBzdGF0ZS5kaXN0Y29kZSA9IGRpc3RmaXg7XG4gIHN0YXRlLmRpc3RiaXRzID0gNTtcbn07XG5cblxuLypcbiBVcGRhdGUgdGhlIHdpbmRvdyB3aXRoIHRoZSBsYXN0IHdzaXplIChub3JtYWxseSAzMkspIGJ5dGVzIHdyaXR0ZW4gYmVmb3JlXG4gcmV0dXJuaW5nLiAgSWYgd2luZG93IGRvZXMgbm90IGV4aXN0IHlldCwgY3JlYXRlIGl0LiAgVGhpcyBpcyBvbmx5IGNhbGxlZFxuIHdoZW4gYSB3aW5kb3cgaXMgYWxyZWFkeSBpbiB1c2UsIG9yIHdoZW4gb3V0cHV0IGhhcyBiZWVuIHdyaXR0ZW4gZHVyaW5nIHRoaXNcbiBpbmZsYXRlIGNhbGwsIGJ1dCB0aGUgZW5kIG9mIHRoZSBkZWZsYXRlIHN0cmVhbSBoYXMgbm90IGJlZW4gcmVhY2hlZCB5ZXQuXG4gSXQgaXMgYWxzbyBjYWxsZWQgdG8gY3JlYXRlIGEgd2luZG93IGZvciBkaWN0aW9uYXJ5IGRhdGEgd2hlbiBhIGRpY3Rpb25hcnlcbiBpcyBsb2FkZWQuXG5cbiBQcm92aWRpbmcgb3V0cHV0IGJ1ZmZlcnMgbGFyZ2VyIHRoYW4gMzJLIHRvIGluZmxhdGUoKSBzaG91bGQgcHJvdmlkZSBhIHNwZWVkXG4gYWR2YW50YWdlLCBzaW5jZSBvbmx5IHRoZSBsYXN0IDMySyBvZiBvdXRwdXQgaXMgY29waWVkIHRvIHRoZSBzbGlkaW5nIHdpbmRvd1xuIHVwb24gcmV0dXJuIGZyb20gaW5mbGF0ZSgpLCBhbmQgc2luY2UgYWxsIGRpc3RhbmNlcyBhZnRlciB0aGUgZmlyc3QgMzJLIG9mXG4gb3V0cHV0IHdpbGwgZmFsbCBpbiB0aGUgb3V0cHV0IGRhdGEsIG1ha2luZyBtYXRjaCBjb3BpZXMgc2ltcGxlciBhbmQgZmFzdGVyLlxuIFRoZSBhZHZhbnRhZ2UgbWF5IGJlIGRlcGVuZGVudCBvbiB0aGUgc2l6ZSBvZiB0aGUgcHJvY2Vzc29yJ3MgZGF0YSBjYWNoZXMuXG4gKi9cbmNvbnN0IHVwZGF0ZXdpbmRvdyA9IChzdHJtLCBzcmMsIGVuZCwgY29weSkgPT4ge1xuXG4gIGxldCBkaXN0O1xuICBjb25zdCBzdGF0ZSA9IHN0cm0uc3RhdGU7XG5cbiAgLyogaWYgaXQgaGFzbid0IGJlZW4gZG9uZSBhbHJlYWR5LCBhbGxvY2F0ZSBzcGFjZSBmb3IgdGhlIHdpbmRvdyAqL1xuICBpZiAoc3RhdGUud2luZG93ID09PSBudWxsKSB7XG4gICAgc3RhdGUud3NpemUgPSAxIDw8IHN0YXRlLndiaXRzO1xuICAgIHN0YXRlLnduZXh0ID0gMDtcbiAgICBzdGF0ZS53aGF2ZSA9IDA7XG5cbiAgICBzdGF0ZS53aW5kb3cgPSBuZXcgVWludDhBcnJheShzdGF0ZS53c2l6ZSk7XG4gIH1cblxuICAvKiBjb3B5IHN0YXRlLT53c2l6ZSBvciBsZXNzIG91dHB1dCBieXRlcyBpbnRvIHRoZSBjaXJjdWxhciB3aW5kb3cgKi9cbiAgaWYgKGNvcHkgPj0gc3RhdGUud3NpemUpIHtcbiAgICBzdGF0ZS53aW5kb3cuc2V0KHNyYy5zdWJhcnJheShlbmQgLSBzdGF0ZS53c2l6ZSwgZW5kKSwgMCk7XG4gICAgc3RhdGUud25leHQgPSAwO1xuICAgIHN0YXRlLndoYXZlID0gc3RhdGUud3NpemU7XG4gIH1cbiAgZWxzZSB7XG4gICAgZGlzdCA9IHN0YXRlLndzaXplIC0gc3RhdGUud25leHQ7XG4gICAgaWYgKGRpc3QgPiBjb3B5KSB7XG4gICAgICBkaXN0ID0gY29weTtcbiAgICB9XG4gICAgLy96bWVtY3B5KHN0YXRlLT53aW5kb3cgKyBzdGF0ZS0+d25leHQsIGVuZCAtIGNvcHksIGRpc3QpO1xuICAgIHN0YXRlLndpbmRvdy5zZXQoc3JjLnN1YmFycmF5KGVuZCAtIGNvcHksIGVuZCAtIGNvcHkgKyBkaXN0KSwgc3RhdGUud25leHQpO1xuICAgIGNvcHkgLT0gZGlzdDtcbiAgICBpZiAoY29weSkge1xuICAgICAgLy96bWVtY3B5KHN0YXRlLT53aW5kb3csIGVuZCAtIGNvcHksIGNvcHkpO1xuICAgICAgc3RhdGUud2luZG93LnNldChzcmMuc3ViYXJyYXkoZW5kIC0gY29weSwgZW5kKSwgMCk7XG4gICAgICBzdGF0ZS53bmV4dCA9IGNvcHk7XG4gICAgICBzdGF0ZS53aGF2ZSA9IHN0YXRlLndzaXplO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHN0YXRlLnduZXh0ICs9IGRpc3Q7XG4gICAgICBpZiAoc3RhdGUud25leHQgPT09IHN0YXRlLndzaXplKSB7IHN0YXRlLnduZXh0ID0gMDsgfVxuICAgICAgaWYgKHN0YXRlLndoYXZlIDwgc3RhdGUud3NpemUpIHsgc3RhdGUud2hhdmUgKz0gZGlzdDsgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gMDtcbn07XG5cblxuY29uc3QgaW5mbGF0ZSQyID0gKHN0cm0sIGZsdXNoKSA9PiB7XG5cbiAgbGV0IHN0YXRlO1xuICBsZXQgaW5wdXQsIG91dHB1dDsgICAgICAgICAgLy8gaW5wdXQvb3V0cHV0IGJ1ZmZlcnNcbiAgbGV0IG5leHQ7ICAgICAgICAgICAgICAgICAgIC8qIG5leHQgaW5wdXQgSU5ERVggKi9cbiAgbGV0IHB1dDsgICAgICAgICAgICAgICAgICAgIC8qIG5leHQgb3V0cHV0IElOREVYICovXG4gIGxldCBoYXZlLCBsZWZ0OyAgICAgICAgICAgICAvKiBhdmFpbGFibGUgaW5wdXQgYW5kIG91dHB1dCAqL1xuICBsZXQgaG9sZDsgICAgICAgICAgICAgICAgICAgLyogYml0IGJ1ZmZlciAqL1xuICBsZXQgYml0czsgICAgICAgICAgICAgICAgICAgLyogYml0cyBpbiBiaXQgYnVmZmVyICovXG4gIGxldCBfaW4sIF9vdXQ7ICAgICAgICAgICAgICAvKiBzYXZlIHN0YXJ0aW5nIGF2YWlsYWJsZSBpbnB1dCBhbmQgb3V0cHV0ICovXG4gIGxldCBjb3B5OyAgICAgICAgICAgICAgICAgICAvKiBudW1iZXIgb2Ygc3RvcmVkIG9yIG1hdGNoIGJ5dGVzIHRvIGNvcHkgKi9cbiAgbGV0IGZyb207ICAgICAgICAgICAgICAgICAgIC8qIHdoZXJlIHRvIGNvcHkgbWF0Y2ggYnl0ZXMgZnJvbSAqL1xuICBsZXQgZnJvbV9zb3VyY2U7XG4gIGxldCBoZXJlID0gMDsgICAgICAgICAgICAgICAvKiBjdXJyZW50IGRlY29kaW5nIHRhYmxlIGVudHJ5ICovXG4gIGxldCBoZXJlX2JpdHMsIGhlcmVfb3AsIGhlcmVfdmFsOyAvLyBwYWtlZCBcImhlcmVcIiBkZW5vcm1hbGl6ZWQgKEpTIHNwZWNpZmljKVxuICAvL2xldCBsYXN0OyAgICAgICAgICAgICAgICAgICAvKiBwYXJlbnQgdGFibGUgZW50cnkgKi9cbiAgbGV0IGxhc3RfYml0cywgbGFzdF9vcCwgbGFzdF92YWw7IC8vIHBha2VkIFwibGFzdFwiIGRlbm9ybWFsaXplZCAoSlMgc3BlY2lmaWMpXG4gIGxldCBsZW47ICAgICAgICAgICAgICAgICAgICAvKiBsZW5ndGggdG8gY29weSBmb3IgcmVwZWF0cywgYml0cyB0byBkcm9wICovXG4gIGxldCByZXQ7ICAgICAgICAgICAgICAgICAgICAvKiByZXR1cm4gY29kZSAqL1xuICBjb25zdCBoYnVmID0gbmV3IFVpbnQ4QXJyYXkoNCk7ICAgIC8qIGJ1ZmZlciBmb3IgZ3ppcCBoZWFkZXIgY3JjIGNhbGN1bGF0aW9uICovXG4gIGxldCBvcHRzO1xuXG4gIGxldCBuOyAvLyB0ZW1wb3JhcnkgdmFyaWFibGUgZm9yIE5FRURfQklUU1xuXG4gIGNvbnN0IG9yZGVyID0gLyogcGVybXV0YXRpb24gb2YgY29kZSBsZW5ndGhzICovXG4gICAgbmV3IFVpbnQ4QXJyYXkoWyAxNiwgMTcsIDE4LCAwLCA4LCA3LCA5LCA2LCAxMCwgNSwgMTEsIDQsIDEyLCAzLCAxMywgMiwgMTQsIDEsIDE1IF0pO1xuXG5cbiAgaWYgKGluZmxhdGVTdGF0ZUNoZWNrKHN0cm0pIHx8ICFzdHJtLm91dHB1dCB8fFxuICAgICAgKCFzdHJtLmlucHV0ICYmIHN0cm0uYXZhaWxfaW4gIT09IDApKSB7XG4gICAgcmV0dXJuIFpfU1RSRUFNX0VSUk9SJDE7XG4gIH1cblxuICBzdGF0ZSA9IHN0cm0uc3RhdGU7XG4gIGlmIChzdGF0ZS5tb2RlID09PSBUWVBFKSB7IHN0YXRlLm1vZGUgPSBUWVBFRE87IH0gICAgLyogc2tpcCBjaGVjayAqL1xuXG5cbiAgLy8tLS0gTE9BRCgpIC0tLVxuICBwdXQgPSBzdHJtLm5leHRfb3V0O1xuICBvdXRwdXQgPSBzdHJtLm91dHB1dDtcbiAgbGVmdCA9IHN0cm0uYXZhaWxfb3V0O1xuICBuZXh0ID0gc3RybS5uZXh0X2luO1xuICBpbnB1dCA9IHN0cm0uaW5wdXQ7XG4gIGhhdmUgPSBzdHJtLmF2YWlsX2luO1xuICBob2xkID0gc3RhdGUuaG9sZDtcbiAgYml0cyA9IHN0YXRlLmJpdHM7XG4gIC8vLS0tXG5cbiAgX2luID0gaGF2ZTtcbiAgX291dCA9IGxlZnQ7XG4gIHJldCA9IFpfT0skMTtcblxuICBpbmZfbGVhdmU6IC8vIGdvdG8gZW11bGF0aW9uXG4gIGZvciAoOzspIHtcbiAgICBzd2l0Y2ggKHN0YXRlLm1vZGUpIHtcbiAgICAgIGNhc2UgSEVBRDpcbiAgICAgICAgaWYgKHN0YXRlLndyYXAgPT09IDApIHtcbiAgICAgICAgICBzdGF0ZS5tb2RlID0gVFlQRURPO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIC8vPT09IE5FRURCSVRTKDE2KTtcbiAgICAgICAgd2hpbGUgKGJpdHMgPCAxNikge1xuICAgICAgICAgIGlmIChoYXZlID09PSAwKSB7IGJyZWFrIGluZl9sZWF2ZTsgfVxuICAgICAgICAgIGhhdmUtLTtcbiAgICAgICAgICBob2xkICs9IGlucHV0W25leHQrK10gPDwgYml0cztcbiAgICAgICAgICBiaXRzICs9IDg7XG4gICAgICAgIH1cbiAgICAgICAgLy89PT0vL1xuICAgICAgICBpZiAoKHN0YXRlLndyYXAgJiAyKSAmJiBob2xkID09PSAweDhiMWYpIHsgIC8qIGd6aXAgaGVhZGVyICovXG4gICAgICAgICAgaWYgKHN0YXRlLndiaXRzID09PSAwKSB7XG4gICAgICAgICAgICBzdGF0ZS53Yml0cyA9IDE1O1xuICAgICAgICAgIH1cbiAgICAgICAgICBzdGF0ZS5jaGVjayA9IDAvKmNyYzMyKDBMLCBaX05VTEwsIDApKi87XG4gICAgICAgICAgLy89PT0gQ1JDMihzdGF0ZS5jaGVjaywgaG9sZCk7XG4gICAgICAgICAgaGJ1ZlswXSA9IGhvbGQgJiAweGZmO1xuICAgICAgICAgIGhidWZbMV0gPSAoaG9sZCA+Pj4gOCkgJiAweGZmO1xuICAgICAgICAgIHN0YXRlLmNoZWNrID0gY3JjMzJfMShzdGF0ZS5jaGVjaywgaGJ1ZiwgMiwgMCk7XG4gICAgICAgICAgLy89PT0vL1xuXG4gICAgICAgICAgLy89PT0gSU5JVEJJVFMoKTtcbiAgICAgICAgICBob2xkID0gMDtcbiAgICAgICAgICBiaXRzID0gMDtcbiAgICAgICAgICAvLz09PS8vXG4gICAgICAgICAgc3RhdGUubW9kZSA9IEZMQUdTO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzdGF0ZS5oZWFkKSB7XG4gICAgICAgICAgc3RhdGUuaGVhZC5kb25lID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCEoc3RhdGUud3JhcCAmIDEpIHx8ICAgLyogY2hlY2sgaWYgemxpYiBoZWFkZXIgYWxsb3dlZCAqL1xuICAgICAgICAgICgoKGhvbGQgJiAweGZmKS8qQklUUyg4KSovIDw8IDgpICsgKGhvbGQgPj4gOCkpICUgMzEpIHtcbiAgICAgICAgICBzdHJtLm1zZyA9ICdpbmNvcnJlY3QgaGVhZGVyIGNoZWNrJztcbiAgICAgICAgICBzdGF0ZS5tb2RlID0gQkFEO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGlmICgoaG9sZCAmIDB4MGYpLypCSVRTKDQpKi8gIT09IFpfREVGTEFURUQpIHtcbiAgICAgICAgICBzdHJtLm1zZyA9ICd1bmtub3duIGNvbXByZXNzaW9uIG1ldGhvZCc7XG4gICAgICAgICAgc3RhdGUubW9kZSA9IEJBRDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICAvLy0tLSBEUk9QQklUUyg0KSAtLS0vL1xuICAgICAgICBob2xkID4+Pj0gNDtcbiAgICAgICAgYml0cyAtPSA0O1xuICAgICAgICAvLy0tLS8vXG4gICAgICAgIGxlbiA9IChob2xkICYgMHgwZikvKkJJVFMoNCkqLyArIDg7XG4gICAgICAgIGlmIChzdGF0ZS53Yml0cyA9PT0gMCkge1xuICAgICAgICAgIHN0YXRlLndiaXRzID0gbGVuO1xuICAgICAgICB9XG4gICAgICAgIGlmIChsZW4gPiAxNSB8fCBsZW4gPiBzdGF0ZS53Yml0cykge1xuICAgICAgICAgIHN0cm0ubXNnID0gJ2ludmFsaWQgd2luZG93IHNpemUnO1xuICAgICAgICAgIHN0YXRlLm1vZGUgPSBCQUQ7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICAvLyAhISEgcGFrbyBwYXRjaC4gRm9yY2UgdXNlIGBvcHRpb25zLndpbmRvd0JpdHNgIGlmIHBhc3NlZC5cbiAgICAgICAgLy8gUmVxdWlyZWQgdG8gYWx3YXlzIHVzZSBtYXggd2luZG93IHNpemUgYnkgZGVmYXVsdC5cbiAgICAgICAgc3RhdGUuZG1heCA9IDEgPDwgc3RhdGUud2JpdHM7XG4gICAgICAgIC8vc3RhdGUuZG1heCA9IDEgPDwgbGVuO1xuXG4gICAgICAgIHN0YXRlLmZsYWdzID0gMDsgICAgICAgICAgICAgICAvKiBpbmRpY2F0ZSB6bGliIGhlYWRlciAqL1xuICAgICAgICAvL1RyYWNldigoc3RkZXJyLCBcImluZmxhdGU6ICAgemxpYiBoZWFkZXIgb2tcXG5cIikpO1xuICAgICAgICBzdHJtLmFkbGVyID0gc3RhdGUuY2hlY2sgPSAxLyphZGxlcjMyKDBMLCBaX05VTEwsIDApKi87XG4gICAgICAgIHN0YXRlLm1vZGUgPSBob2xkICYgMHgyMDAgPyBESUNUSUQgOiBUWVBFO1xuICAgICAgICAvLz09PSBJTklUQklUUygpO1xuICAgICAgICBob2xkID0gMDtcbiAgICAgICAgYml0cyA9IDA7XG4gICAgICAgIC8vPT09Ly9cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEZMQUdTOlxuICAgICAgICAvLz09PSBORUVEQklUUygxNik7ICovXG4gICAgICAgIHdoaWxlIChiaXRzIDwgMTYpIHtcbiAgICAgICAgICBpZiAoaGF2ZSA9PT0gMCkgeyBicmVhayBpbmZfbGVhdmU7IH1cbiAgICAgICAgICBoYXZlLS07XG4gICAgICAgICAgaG9sZCArPSBpbnB1dFtuZXh0KytdIDw8IGJpdHM7XG4gICAgICAgICAgYml0cyArPSA4O1xuICAgICAgICB9XG4gICAgICAgIC8vPT09Ly9cbiAgICAgICAgc3RhdGUuZmxhZ3MgPSBob2xkO1xuICAgICAgICBpZiAoKHN0YXRlLmZsYWdzICYgMHhmZikgIT09IFpfREVGTEFURUQpIHtcbiAgICAgICAgICBzdHJtLm1zZyA9ICd1bmtub3duIGNvbXByZXNzaW9uIG1ldGhvZCc7XG4gICAgICAgICAgc3RhdGUubW9kZSA9IEJBRDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBpZiAoc3RhdGUuZmxhZ3MgJiAweGUwMDApIHtcbiAgICAgICAgICBzdHJtLm1zZyA9ICd1bmtub3duIGhlYWRlciBmbGFncyBzZXQnO1xuICAgICAgICAgIHN0YXRlLm1vZGUgPSBCQUQ7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHN0YXRlLmhlYWQpIHtcbiAgICAgICAgICBzdGF0ZS5oZWFkLnRleHQgPSAoKGhvbGQgPj4gOCkgJiAxKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoKHN0YXRlLmZsYWdzICYgMHgwMjAwKSAmJiAoc3RhdGUud3JhcCAmIDQpKSB7XG4gICAgICAgICAgLy89PT0gQ1JDMihzdGF0ZS5jaGVjaywgaG9sZCk7XG4gICAgICAgICAgaGJ1ZlswXSA9IGhvbGQgJiAweGZmO1xuICAgICAgICAgIGhidWZbMV0gPSAoaG9sZCA+Pj4gOCkgJiAweGZmO1xuICAgICAgICAgIHN0YXRlLmNoZWNrID0gY3JjMzJfMShzdGF0ZS5jaGVjaywgaGJ1ZiwgMiwgMCk7XG4gICAgICAgICAgLy89PT0vL1xuICAgICAgICB9XG4gICAgICAgIC8vPT09IElOSVRCSVRTKCk7XG4gICAgICAgIGhvbGQgPSAwO1xuICAgICAgICBiaXRzID0gMDtcbiAgICAgICAgLy89PT0vL1xuICAgICAgICBzdGF0ZS5tb2RlID0gVElNRTtcbiAgICAgICAgLyogZmFsbHMgdGhyb3VnaCAqL1xuICAgICAgY2FzZSBUSU1FOlxuICAgICAgICAvLz09PSBORUVEQklUUygzMik7ICovXG4gICAgICAgIHdoaWxlIChiaXRzIDwgMzIpIHtcbiAgICAgICAgICBpZiAoaGF2ZSA9PT0gMCkgeyBicmVhayBpbmZfbGVhdmU7IH1cbiAgICAgICAgICBoYXZlLS07XG4gICAgICAgICAgaG9sZCArPSBpbnB1dFtuZXh0KytdIDw8IGJpdHM7XG4gICAgICAgICAgYml0cyArPSA4O1xuICAgICAgICB9XG4gICAgICAgIC8vPT09Ly9cbiAgICAgICAgaWYgKHN0YXRlLmhlYWQpIHtcbiAgICAgICAgICBzdGF0ZS5oZWFkLnRpbWUgPSBob2xkO1xuICAgICAgICB9XG4gICAgICAgIGlmICgoc3RhdGUuZmxhZ3MgJiAweDAyMDApICYmIChzdGF0ZS53cmFwICYgNCkpIHtcbiAgICAgICAgICAvLz09PSBDUkM0KHN0YXRlLmNoZWNrLCBob2xkKVxuICAgICAgICAgIGhidWZbMF0gPSBob2xkICYgMHhmZjtcbiAgICAgICAgICBoYnVmWzFdID0gKGhvbGQgPj4+IDgpICYgMHhmZjtcbiAgICAgICAgICBoYnVmWzJdID0gKGhvbGQgPj4+IDE2KSAmIDB4ZmY7XG4gICAgICAgICAgaGJ1ZlszXSA9IChob2xkID4+PiAyNCkgJiAweGZmO1xuICAgICAgICAgIHN0YXRlLmNoZWNrID0gY3JjMzJfMShzdGF0ZS5jaGVjaywgaGJ1ZiwgNCwgMCk7XG4gICAgICAgICAgLy89PT1cbiAgICAgICAgfVxuICAgICAgICAvLz09PSBJTklUQklUUygpO1xuICAgICAgICBob2xkID0gMDtcbiAgICAgICAgYml0cyA9IDA7XG4gICAgICAgIC8vPT09Ly9cbiAgICAgICAgc3RhdGUubW9kZSA9IE9TO1xuICAgICAgICAvKiBmYWxscyB0aHJvdWdoICovXG4gICAgICBjYXNlIE9TOlxuICAgICAgICAvLz09PSBORUVEQklUUygxNik7ICovXG4gICAgICAgIHdoaWxlIChiaXRzIDwgMTYpIHtcbiAgICAgICAgICBpZiAoaGF2ZSA9PT0gMCkgeyBicmVhayBpbmZfbGVhdmU7IH1cbiAgICAgICAgICBoYXZlLS07XG4gICAgICAgICAgaG9sZCArPSBpbnB1dFtuZXh0KytdIDw8IGJpdHM7XG4gICAgICAgICAgYml0cyArPSA4O1xuICAgICAgICB9XG4gICAgICAgIC8vPT09Ly9cbiAgICAgICAgaWYgKHN0YXRlLmhlYWQpIHtcbiAgICAgICAgICBzdGF0ZS5oZWFkLnhmbGFncyA9IChob2xkICYgMHhmZik7XG4gICAgICAgICAgc3RhdGUuaGVhZC5vcyA9IChob2xkID4+IDgpO1xuICAgICAgICB9XG4gICAgICAgIGlmICgoc3RhdGUuZmxhZ3MgJiAweDAyMDApICYmIChzdGF0ZS53cmFwICYgNCkpIHtcbiAgICAgICAgICAvLz09PSBDUkMyKHN0YXRlLmNoZWNrLCBob2xkKTtcbiAgICAgICAgICBoYnVmWzBdID0gaG9sZCAmIDB4ZmY7XG4gICAgICAgICAgaGJ1ZlsxXSA9IChob2xkID4+PiA4KSAmIDB4ZmY7XG4gICAgICAgICAgc3RhdGUuY2hlY2sgPSBjcmMzMl8xKHN0YXRlLmNoZWNrLCBoYnVmLCAyLCAwKTtcbiAgICAgICAgICAvLz09PS8vXG4gICAgICAgIH1cbiAgICAgICAgLy89PT0gSU5JVEJJVFMoKTtcbiAgICAgICAgaG9sZCA9IDA7XG4gICAgICAgIGJpdHMgPSAwO1xuICAgICAgICAvLz09PS8vXG4gICAgICAgIHN0YXRlLm1vZGUgPSBFWExFTjtcbiAgICAgICAgLyogZmFsbHMgdGhyb3VnaCAqL1xuICAgICAgY2FzZSBFWExFTjpcbiAgICAgICAgaWYgKHN0YXRlLmZsYWdzICYgMHgwNDAwKSB7XG4gICAgICAgICAgLy89PT0gTkVFREJJVFMoMTYpOyAqL1xuICAgICAgICAgIHdoaWxlIChiaXRzIDwgMTYpIHtcbiAgICAgICAgICAgIGlmIChoYXZlID09PSAwKSB7IGJyZWFrIGluZl9sZWF2ZTsgfVxuICAgICAgICAgICAgaGF2ZS0tO1xuICAgICAgICAgICAgaG9sZCArPSBpbnB1dFtuZXh0KytdIDw8IGJpdHM7XG4gICAgICAgICAgICBiaXRzICs9IDg7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vPT09Ly9cbiAgICAgICAgICBzdGF0ZS5sZW5ndGggPSBob2xkO1xuICAgICAgICAgIGlmIChzdGF0ZS5oZWFkKSB7XG4gICAgICAgICAgICBzdGF0ZS5oZWFkLmV4dHJhX2xlbiA9IGhvbGQ7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICgoc3RhdGUuZmxhZ3MgJiAweDAyMDApICYmIChzdGF0ZS53cmFwICYgNCkpIHtcbiAgICAgICAgICAgIC8vPT09IENSQzIoc3RhdGUuY2hlY2ssIGhvbGQpO1xuICAgICAgICAgICAgaGJ1ZlswXSA9IGhvbGQgJiAweGZmO1xuICAgICAgICAgICAgaGJ1ZlsxXSA9IChob2xkID4+PiA4KSAmIDB4ZmY7XG4gICAgICAgICAgICBzdGF0ZS5jaGVjayA9IGNyYzMyXzEoc3RhdGUuY2hlY2ssIGhidWYsIDIsIDApO1xuICAgICAgICAgICAgLy89PT0vL1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLz09PSBJTklUQklUUygpO1xuICAgICAgICAgIGhvbGQgPSAwO1xuICAgICAgICAgIGJpdHMgPSAwO1xuICAgICAgICAgIC8vPT09Ly9cbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChzdGF0ZS5oZWFkKSB7XG4gICAgICAgICAgc3RhdGUuaGVhZC5leHRyYSA9IG51bGwvKlpfTlVMTCovO1xuICAgICAgICB9XG4gICAgICAgIHN0YXRlLm1vZGUgPSBFWFRSQTtcbiAgICAgICAgLyogZmFsbHMgdGhyb3VnaCAqL1xuICAgICAgY2FzZSBFWFRSQTpcbiAgICAgICAgaWYgKHN0YXRlLmZsYWdzICYgMHgwNDAwKSB7XG4gICAgICAgICAgY29weSA9IHN0YXRlLmxlbmd0aDtcbiAgICAgICAgICBpZiAoY29weSA+IGhhdmUpIHsgY29weSA9IGhhdmU7IH1cbiAgICAgICAgICBpZiAoY29weSkge1xuICAgICAgICAgICAgaWYgKHN0YXRlLmhlYWQpIHtcbiAgICAgICAgICAgICAgbGVuID0gc3RhdGUuaGVhZC5leHRyYV9sZW4gLSBzdGF0ZS5sZW5ndGg7XG4gICAgICAgICAgICAgIGlmICghc3RhdGUuaGVhZC5leHRyYSkge1xuICAgICAgICAgICAgICAgIC8vIFVzZSB1bnR5cGVkIGFycmF5IGZvciBtb3JlIGNvbnZlbmllbnQgcHJvY2Vzc2luZyBsYXRlclxuICAgICAgICAgICAgICAgIHN0YXRlLmhlYWQuZXh0cmEgPSBuZXcgVWludDhBcnJheShzdGF0ZS5oZWFkLmV4dHJhX2xlbik7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgc3RhdGUuaGVhZC5leHRyYS5zZXQoXG4gICAgICAgICAgICAgICAgaW5wdXQuc3ViYXJyYXkoXG4gICAgICAgICAgICAgICAgICBuZXh0LFxuICAgICAgICAgICAgICAgICAgLy8gZXh0cmEgZmllbGQgaXMgbGltaXRlZCB0byA2NTUzNiBieXRlc1xuICAgICAgICAgICAgICAgICAgLy8gLSBubyBuZWVkIGZvciBhZGRpdGlvbmFsIHNpemUgY2hlY2tcbiAgICAgICAgICAgICAgICAgIG5leHQgKyBjb3B5XG4gICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgICAvKmxlbiArIGNvcHkgPiBzdGF0ZS5oZWFkLmV4dHJhX21heCAtIGxlbiA/IHN0YXRlLmhlYWQuZXh0cmFfbWF4IDogY29weSwqL1xuICAgICAgICAgICAgICAgIGxlblxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAvL3ptZW1jcHkoc3RhdGUuaGVhZC5leHRyYSArIGxlbiwgbmV4dCxcbiAgICAgICAgICAgICAgLy8gICAgICAgIGxlbiArIGNvcHkgPiBzdGF0ZS5oZWFkLmV4dHJhX21heCA/XG4gICAgICAgICAgICAgIC8vICAgICAgICBzdGF0ZS5oZWFkLmV4dHJhX21heCAtIGxlbiA6IGNvcHkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKChzdGF0ZS5mbGFncyAmIDB4MDIwMCkgJiYgKHN0YXRlLndyYXAgJiA0KSkge1xuICAgICAgICAgICAgICBzdGF0ZS5jaGVjayA9IGNyYzMyXzEoc3RhdGUuY2hlY2ssIGlucHV0LCBjb3B5LCBuZXh0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGhhdmUgLT0gY29weTtcbiAgICAgICAgICAgIG5leHQgKz0gY29weTtcbiAgICAgICAgICAgIHN0YXRlLmxlbmd0aCAtPSBjb3B5O1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoc3RhdGUubGVuZ3RoKSB7IGJyZWFrIGluZl9sZWF2ZTsgfVxuICAgICAgICB9XG4gICAgICAgIHN0YXRlLmxlbmd0aCA9IDA7XG4gICAgICAgIHN0YXRlLm1vZGUgPSBOQU1FO1xuICAgICAgICAvKiBmYWxscyB0aHJvdWdoICovXG4gICAgICBjYXNlIE5BTUU6XG4gICAgICAgIGlmIChzdGF0ZS5mbGFncyAmIDB4MDgwMCkge1xuICAgICAgICAgIGlmIChoYXZlID09PSAwKSB7IGJyZWFrIGluZl9sZWF2ZTsgfVxuICAgICAgICAgIGNvcHkgPSAwO1xuICAgICAgICAgIGRvIHtcbiAgICAgICAgICAgIC8vIFRPRE86IDIgb3IgMSBieXRlcz9cbiAgICAgICAgICAgIGxlbiA9IGlucHV0W25leHQgKyBjb3B5KytdO1xuICAgICAgICAgICAgLyogdXNlIGNvbnN0YW50IGxpbWl0IGJlY2F1c2UgaW4ganMgd2Ugc2hvdWxkIG5vdCBwcmVhbGxvY2F0ZSBtZW1vcnkgKi9cbiAgICAgICAgICAgIGlmIChzdGF0ZS5oZWFkICYmIGxlbiAmJlxuICAgICAgICAgICAgICAgIChzdGF0ZS5sZW5ndGggPCA2NTUzNiAvKnN0YXRlLmhlYWQubmFtZV9tYXgqLykpIHtcbiAgICAgICAgICAgICAgc3RhdGUuaGVhZC5uYW1lICs9IFN0cmluZy5mcm9tQ2hhckNvZGUobGVuKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IHdoaWxlIChsZW4gJiYgY29weSA8IGhhdmUpO1xuXG4gICAgICAgICAgaWYgKChzdGF0ZS5mbGFncyAmIDB4MDIwMCkgJiYgKHN0YXRlLndyYXAgJiA0KSkge1xuICAgICAgICAgICAgc3RhdGUuY2hlY2sgPSBjcmMzMl8xKHN0YXRlLmNoZWNrLCBpbnB1dCwgY29weSwgbmV4dCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGhhdmUgLT0gY29weTtcbiAgICAgICAgICBuZXh0ICs9IGNvcHk7XG4gICAgICAgICAgaWYgKGxlbikgeyBicmVhayBpbmZfbGVhdmU7IH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChzdGF0ZS5oZWFkKSB7XG4gICAgICAgICAgc3RhdGUuaGVhZC5uYW1lID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBzdGF0ZS5sZW5ndGggPSAwO1xuICAgICAgICBzdGF0ZS5tb2RlID0gQ09NTUVOVDtcbiAgICAgICAgLyogZmFsbHMgdGhyb3VnaCAqL1xuICAgICAgY2FzZSBDT01NRU5UOlxuICAgICAgICBpZiAoc3RhdGUuZmxhZ3MgJiAweDEwMDApIHtcbiAgICAgICAgICBpZiAoaGF2ZSA9PT0gMCkgeyBicmVhayBpbmZfbGVhdmU7IH1cbiAgICAgICAgICBjb3B5ID0gMDtcbiAgICAgICAgICBkbyB7XG4gICAgICAgICAgICBsZW4gPSBpbnB1dFtuZXh0ICsgY29weSsrXTtcbiAgICAgICAgICAgIC8qIHVzZSBjb25zdGFudCBsaW1pdCBiZWNhdXNlIGluIGpzIHdlIHNob3VsZCBub3QgcHJlYWxsb2NhdGUgbWVtb3J5ICovXG4gICAgICAgICAgICBpZiAoc3RhdGUuaGVhZCAmJiBsZW4gJiZcbiAgICAgICAgICAgICAgICAoc3RhdGUubGVuZ3RoIDwgNjU1MzYgLypzdGF0ZS5oZWFkLmNvbW1fbWF4Ki8pKSB7XG4gICAgICAgICAgICAgIHN0YXRlLmhlYWQuY29tbWVudCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGxlbik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSB3aGlsZSAobGVuICYmIGNvcHkgPCBoYXZlKTtcbiAgICAgICAgICBpZiAoKHN0YXRlLmZsYWdzICYgMHgwMjAwKSAmJiAoc3RhdGUud3JhcCAmIDQpKSB7XG4gICAgICAgICAgICBzdGF0ZS5jaGVjayA9IGNyYzMyXzEoc3RhdGUuY2hlY2ssIGlucHV0LCBjb3B5LCBuZXh0KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaGF2ZSAtPSBjb3B5O1xuICAgICAgICAgIG5leHQgKz0gY29weTtcbiAgICAgICAgICBpZiAobGVuKSB7IGJyZWFrIGluZl9sZWF2ZTsgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHN0YXRlLmhlYWQpIHtcbiAgICAgICAgICBzdGF0ZS5oZWFkLmNvbW1lbnQgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIHN0YXRlLm1vZGUgPSBIQ1JDO1xuICAgICAgICAvKiBmYWxscyB0aHJvdWdoICovXG4gICAgICBjYXNlIEhDUkM6XG4gICAgICAgIGlmIChzdGF0ZS5mbGFncyAmIDB4MDIwMCkge1xuICAgICAgICAgIC8vPT09IE5FRURCSVRTKDE2KTsgKi9cbiAgICAgICAgICB3aGlsZSAoYml0cyA8IDE2KSB7XG4gICAgICAgICAgICBpZiAoaGF2ZSA9PT0gMCkgeyBicmVhayBpbmZfbGVhdmU7IH1cbiAgICAgICAgICAgIGhhdmUtLTtcbiAgICAgICAgICAgIGhvbGQgKz0gaW5wdXRbbmV4dCsrXSA8PCBiaXRzO1xuICAgICAgICAgICAgYml0cyArPSA4O1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLz09PS8vXG4gICAgICAgICAgaWYgKChzdGF0ZS53cmFwICYgNCkgJiYgaG9sZCAhPT0gKHN0YXRlLmNoZWNrICYgMHhmZmZmKSkge1xuICAgICAgICAgICAgc3RybS5tc2cgPSAnaGVhZGVyIGNyYyBtaXNtYXRjaCc7XG4gICAgICAgICAgICBzdGF0ZS5tb2RlID0gQkFEO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vPT09IElOSVRCSVRTKCk7XG4gICAgICAgICAgaG9sZCA9IDA7XG4gICAgICAgICAgYml0cyA9IDA7XG4gICAgICAgICAgLy89PT0vL1xuICAgICAgICB9XG4gICAgICAgIGlmIChzdGF0ZS5oZWFkKSB7XG4gICAgICAgICAgc3RhdGUuaGVhZC5oY3JjID0gKChzdGF0ZS5mbGFncyA+PiA5KSAmIDEpO1xuICAgICAgICAgIHN0YXRlLmhlYWQuZG9uZSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgc3RybS5hZGxlciA9IHN0YXRlLmNoZWNrID0gMDtcbiAgICAgICAgc3RhdGUubW9kZSA9IFRZUEU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBESUNUSUQ6XG4gICAgICAgIC8vPT09IE5FRURCSVRTKDMyKTsgKi9cbiAgICAgICAgd2hpbGUgKGJpdHMgPCAzMikge1xuICAgICAgICAgIGlmIChoYXZlID09PSAwKSB7IGJyZWFrIGluZl9sZWF2ZTsgfVxuICAgICAgICAgIGhhdmUtLTtcbiAgICAgICAgICBob2xkICs9IGlucHV0W25leHQrK10gPDwgYml0cztcbiAgICAgICAgICBiaXRzICs9IDg7XG4gICAgICAgIH1cbiAgICAgICAgLy89PT0vL1xuICAgICAgICBzdHJtLmFkbGVyID0gc3RhdGUuY2hlY2sgPSB6c3dhcDMyKGhvbGQpO1xuICAgICAgICAvLz09PSBJTklUQklUUygpO1xuICAgICAgICBob2xkID0gMDtcbiAgICAgICAgYml0cyA9IDA7XG4gICAgICAgIC8vPT09Ly9cbiAgICAgICAgc3RhdGUubW9kZSA9IERJQ1Q7XG4gICAgICAgIC8qIGZhbGxzIHRocm91Z2ggKi9cbiAgICAgIGNhc2UgRElDVDpcbiAgICAgICAgaWYgKHN0YXRlLmhhdmVkaWN0ID09PSAwKSB7XG4gICAgICAgICAgLy8tLS0gUkVTVE9SRSgpIC0tLVxuICAgICAgICAgIHN0cm0ubmV4dF9vdXQgPSBwdXQ7XG4gICAgICAgICAgc3RybS5hdmFpbF9vdXQgPSBsZWZ0O1xuICAgICAgICAgIHN0cm0ubmV4dF9pbiA9IG5leHQ7XG4gICAgICAgICAgc3RybS5hdmFpbF9pbiA9IGhhdmU7XG4gICAgICAgICAgc3RhdGUuaG9sZCA9IGhvbGQ7XG4gICAgICAgICAgc3RhdGUuYml0cyA9IGJpdHM7XG4gICAgICAgICAgLy8tLS1cbiAgICAgICAgICByZXR1cm4gWl9ORUVEX0RJQ1QkMTtcbiAgICAgICAgfVxuICAgICAgICBzdHJtLmFkbGVyID0gc3RhdGUuY2hlY2sgPSAxLyphZGxlcjMyKDBMLCBaX05VTEwsIDApKi87XG4gICAgICAgIHN0YXRlLm1vZGUgPSBUWVBFO1xuICAgICAgICAvKiBmYWxscyB0aHJvdWdoICovXG4gICAgICBjYXNlIFRZUEU6XG4gICAgICAgIGlmIChmbHVzaCA9PT0gWl9CTE9DSyB8fCBmbHVzaCA9PT0gWl9UUkVFUykgeyBicmVhayBpbmZfbGVhdmU7IH1cbiAgICAgICAgLyogZmFsbHMgdGhyb3VnaCAqL1xuICAgICAgY2FzZSBUWVBFRE86XG4gICAgICAgIGlmIChzdGF0ZS5sYXN0KSB7XG4gICAgICAgICAgLy8tLS0gQllURUJJVFMoKSAtLS0vL1xuICAgICAgICAgIGhvbGQgPj4+PSBiaXRzICYgNztcbiAgICAgICAgICBiaXRzIC09IGJpdHMgJiA3O1xuICAgICAgICAgIC8vLS0tLy9cbiAgICAgICAgICBzdGF0ZS5tb2RlID0gQ0hFQ0s7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgLy89PT0gTkVFREJJVFMoMyk7ICovXG4gICAgICAgIHdoaWxlIChiaXRzIDwgMykge1xuICAgICAgICAgIGlmIChoYXZlID09PSAwKSB7IGJyZWFrIGluZl9sZWF2ZTsgfVxuICAgICAgICAgIGhhdmUtLTtcbiAgICAgICAgICBob2xkICs9IGlucHV0W25leHQrK10gPDwgYml0cztcbiAgICAgICAgICBiaXRzICs9IDg7XG4gICAgICAgIH1cbiAgICAgICAgLy89PT0vL1xuICAgICAgICBzdGF0ZS5sYXN0ID0gKGhvbGQgJiAweDAxKS8qQklUUygxKSovO1xuICAgICAgICAvLy0tLSBEUk9QQklUUygxKSAtLS0vL1xuICAgICAgICBob2xkID4+Pj0gMTtcbiAgICAgICAgYml0cyAtPSAxO1xuICAgICAgICAvLy0tLS8vXG5cbiAgICAgICAgc3dpdGNoICgoaG9sZCAmIDB4MDMpLypCSVRTKDIpKi8pIHtcbiAgICAgICAgICBjYXNlIDA6ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvKiBzdG9yZWQgYmxvY2sgKi9cbiAgICAgICAgICAgIC8vVHJhY2V2KChzdGRlcnIsIFwiaW5mbGF0ZTogICAgIHN0b3JlZCBibG9jayVzXFxuXCIsXG4gICAgICAgICAgICAvLyAgICAgICAgc3RhdGUubGFzdCA/IFwiIChsYXN0KVwiIDogXCJcIikpO1xuICAgICAgICAgICAgc3RhdGUubW9kZSA9IFNUT1JFRDtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgMTogICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8qIGZpeGVkIGJsb2NrICovXG4gICAgICAgICAgICBmaXhlZHRhYmxlcyhzdGF0ZSk7XG4gICAgICAgICAgICAvL1RyYWNldigoc3RkZXJyLCBcImluZmxhdGU6ICAgICBmaXhlZCBjb2RlcyBibG9jayVzXFxuXCIsXG4gICAgICAgICAgICAvLyAgICAgICAgc3RhdGUubGFzdCA/IFwiIChsYXN0KVwiIDogXCJcIikpO1xuICAgICAgICAgICAgc3RhdGUubW9kZSA9IExFTl87ICAgICAgICAgICAgIC8qIGRlY29kZSBjb2RlcyAqL1xuICAgICAgICAgICAgaWYgKGZsdXNoID09PSBaX1RSRUVTKSB7XG4gICAgICAgICAgICAgIC8vLS0tIERST1BCSVRTKDIpIC0tLS8vXG4gICAgICAgICAgICAgIGhvbGQgPj4+PSAyO1xuICAgICAgICAgICAgICBiaXRzIC09IDI7XG4gICAgICAgICAgICAgIC8vLS0tLy9cbiAgICAgICAgICAgICAgYnJlYWsgaW5mX2xlYXZlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAyOiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLyogZHluYW1pYyBibG9jayAqL1xuICAgICAgICAgICAgLy9UcmFjZXYoKHN0ZGVyciwgXCJpbmZsYXRlOiAgICAgZHluYW1pYyBjb2RlcyBibG9jayVzXFxuXCIsXG4gICAgICAgICAgICAvLyAgICAgICAgc3RhdGUubGFzdCA/IFwiIChsYXN0KVwiIDogXCJcIikpO1xuICAgICAgICAgICAgc3RhdGUubW9kZSA9IFRBQkxFO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAzOlxuICAgICAgICAgICAgc3RybS5tc2cgPSAnaW52YWxpZCBibG9jayB0eXBlJztcbiAgICAgICAgICAgIHN0YXRlLm1vZGUgPSBCQUQ7XG4gICAgICAgIH1cbiAgICAgICAgLy8tLS0gRFJPUEJJVFMoMikgLS0tLy9cbiAgICAgICAgaG9sZCA+Pj49IDI7XG4gICAgICAgIGJpdHMgLT0gMjtcbiAgICAgICAgLy8tLS0vL1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgU1RPUkVEOlxuICAgICAgICAvLy0tLSBCWVRFQklUUygpIC0tLS8vIC8qIGdvIHRvIGJ5dGUgYm91bmRhcnkgKi9cbiAgICAgICAgaG9sZCA+Pj49IGJpdHMgJiA3O1xuICAgICAgICBiaXRzIC09IGJpdHMgJiA3O1xuICAgICAgICAvLy0tLS8vXG4gICAgICAgIC8vPT09IE5FRURCSVRTKDMyKTsgKi9cbiAgICAgICAgd2hpbGUgKGJpdHMgPCAzMikge1xuICAgICAgICAgIGlmIChoYXZlID09PSAwKSB7IGJyZWFrIGluZl9sZWF2ZTsgfVxuICAgICAgICAgIGhhdmUtLTtcbiAgICAgICAgICBob2xkICs9IGlucHV0W25leHQrK10gPDwgYml0cztcbiAgICAgICAgICBiaXRzICs9IDg7XG4gICAgICAgIH1cbiAgICAgICAgLy89PT0vL1xuICAgICAgICBpZiAoKGhvbGQgJiAweGZmZmYpICE9PSAoKGhvbGQgPj4+IDE2KSBeIDB4ZmZmZikpIHtcbiAgICAgICAgICBzdHJtLm1zZyA9ICdpbnZhbGlkIHN0b3JlZCBibG9jayBsZW5ndGhzJztcbiAgICAgICAgICBzdGF0ZS5tb2RlID0gQkFEO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIHN0YXRlLmxlbmd0aCA9IGhvbGQgJiAweGZmZmY7XG4gICAgICAgIC8vVHJhY2V2KChzdGRlcnIsIFwiaW5mbGF0ZTogICAgICAgc3RvcmVkIGxlbmd0aCAldVxcblwiLFxuICAgICAgICAvLyAgICAgICAgc3RhdGUubGVuZ3RoKSk7XG4gICAgICAgIC8vPT09IElOSVRCSVRTKCk7XG4gICAgICAgIGhvbGQgPSAwO1xuICAgICAgICBiaXRzID0gMDtcbiAgICAgICAgLy89PT0vL1xuICAgICAgICBzdGF0ZS5tb2RlID0gQ09QWV87XG4gICAgICAgIGlmIChmbHVzaCA9PT0gWl9UUkVFUykgeyBicmVhayBpbmZfbGVhdmU7IH1cbiAgICAgICAgLyogZmFsbHMgdGhyb3VnaCAqL1xuICAgICAgY2FzZSBDT1BZXzpcbiAgICAgICAgc3RhdGUubW9kZSA9IENPUFk7XG4gICAgICAgIC8qIGZhbGxzIHRocm91Z2ggKi9cbiAgICAgIGNhc2UgQ09QWTpcbiAgICAgICAgY29weSA9IHN0YXRlLmxlbmd0aDtcbiAgICAgICAgaWYgKGNvcHkpIHtcbiAgICAgICAgICBpZiAoY29weSA+IGhhdmUpIHsgY29weSA9IGhhdmU7IH1cbiAgICAgICAgICBpZiAoY29weSA+IGxlZnQpIHsgY29weSA9IGxlZnQ7IH1cbiAgICAgICAgICBpZiAoY29weSA9PT0gMCkgeyBicmVhayBpbmZfbGVhdmU7IH1cbiAgICAgICAgICAvLy0tLSB6bWVtY3B5KHB1dCwgbmV4dCwgY29weSk7IC0tLVxuICAgICAgICAgIG91dHB1dC5zZXQoaW5wdXQuc3ViYXJyYXkobmV4dCwgbmV4dCArIGNvcHkpLCBwdXQpO1xuICAgICAgICAgIC8vLS0tLy9cbiAgICAgICAgICBoYXZlIC09IGNvcHk7XG4gICAgICAgICAgbmV4dCArPSBjb3B5O1xuICAgICAgICAgIGxlZnQgLT0gY29weTtcbiAgICAgICAgICBwdXQgKz0gY29weTtcbiAgICAgICAgICBzdGF0ZS5sZW5ndGggLT0gY29weTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICAvL1RyYWNldigoc3RkZXJyLCBcImluZmxhdGU6ICAgICAgIHN0b3JlZCBlbmRcXG5cIikpO1xuICAgICAgICBzdGF0ZS5tb2RlID0gVFlQRTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFRBQkxFOlxuICAgICAgICAvLz09PSBORUVEQklUUygxNCk7ICovXG4gICAgICAgIHdoaWxlIChiaXRzIDwgMTQpIHtcbiAgICAgICAgICBpZiAoaGF2ZSA9PT0gMCkgeyBicmVhayBpbmZfbGVhdmU7IH1cbiAgICAgICAgICBoYXZlLS07XG4gICAgICAgICAgaG9sZCArPSBpbnB1dFtuZXh0KytdIDw8IGJpdHM7XG4gICAgICAgICAgYml0cyArPSA4O1xuICAgICAgICB9XG4gICAgICAgIC8vPT09Ly9cbiAgICAgICAgc3RhdGUubmxlbiA9IChob2xkICYgMHgxZikvKkJJVFMoNSkqLyArIDI1NztcbiAgICAgICAgLy8tLS0gRFJPUEJJVFMoNSkgLS0tLy9cbiAgICAgICAgaG9sZCA+Pj49IDU7XG4gICAgICAgIGJpdHMgLT0gNTtcbiAgICAgICAgLy8tLS0vL1xuICAgICAgICBzdGF0ZS5uZGlzdCA9IChob2xkICYgMHgxZikvKkJJVFMoNSkqLyArIDE7XG4gICAgICAgIC8vLS0tIERST1BCSVRTKDUpIC0tLS8vXG4gICAgICAgIGhvbGQgPj4+PSA1O1xuICAgICAgICBiaXRzIC09IDU7XG4gICAgICAgIC8vLS0tLy9cbiAgICAgICAgc3RhdGUubmNvZGUgPSAoaG9sZCAmIDB4MGYpLypCSVRTKDQpKi8gKyA0O1xuICAgICAgICAvLy0tLSBEUk9QQklUUyg0KSAtLS0vL1xuICAgICAgICBob2xkID4+Pj0gNDtcbiAgICAgICAgYml0cyAtPSA0O1xuICAgICAgICAvLy0tLS8vXG4vLyNpZm5kZWYgUEtaSVBfQlVHX1dPUktBUk9VTkRcbiAgICAgICAgaWYgKHN0YXRlLm5sZW4gPiAyODYgfHwgc3RhdGUubmRpc3QgPiAzMCkge1xuICAgICAgICAgIHN0cm0ubXNnID0gJ3RvbyBtYW55IGxlbmd0aCBvciBkaXN0YW5jZSBzeW1ib2xzJztcbiAgICAgICAgICBzdGF0ZS5tb2RlID0gQkFEO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4vLyNlbmRpZlxuICAgICAgICAvL1RyYWNldigoc3RkZXJyLCBcImluZmxhdGU6ICAgICAgIHRhYmxlIHNpemVzIG9rXFxuXCIpKTtcbiAgICAgICAgc3RhdGUuaGF2ZSA9IDA7XG4gICAgICAgIHN0YXRlLm1vZGUgPSBMRU5MRU5TO1xuICAgICAgICAvKiBmYWxscyB0aHJvdWdoICovXG4gICAgICBjYXNlIExFTkxFTlM6XG4gICAgICAgIHdoaWxlIChzdGF0ZS5oYXZlIDwgc3RhdGUubmNvZGUpIHtcbiAgICAgICAgICAvLz09PSBORUVEQklUUygzKTtcbiAgICAgICAgICB3aGlsZSAoYml0cyA8IDMpIHtcbiAgICAgICAgICAgIGlmIChoYXZlID09PSAwKSB7IGJyZWFrIGluZl9sZWF2ZTsgfVxuICAgICAgICAgICAgaGF2ZS0tO1xuICAgICAgICAgICAgaG9sZCArPSBpbnB1dFtuZXh0KytdIDw8IGJpdHM7XG4gICAgICAgICAgICBiaXRzICs9IDg7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vPT09Ly9cbiAgICAgICAgICBzdGF0ZS5sZW5zW29yZGVyW3N0YXRlLmhhdmUrK11dID0gKGhvbGQgJiAweDA3KTsvL0JJVFMoMyk7XG4gICAgICAgICAgLy8tLS0gRFJPUEJJVFMoMykgLS0tLy9cbiAgICAgICAgICBob2xkID4+Pj0gMztcbiAgICAgICAgICBiaXRzIC09IDM7XG4gICAgICAgICAgLy8tLS0vL1xuICAgICAgICB9XG4gICAgICAgIHdoaWxlIChzdGF0ZS5oYXZlIDwgMTkpIHtcbiAgICAgICAgICBzdGF0ZS5sZW5zW29yZGVyW3N0YXRlLmhhdmUrK11dID0gMDtcbiAgICAgICAgfVxuICAgICAgICAvLyBXZSBoYXZlIHNlcGFyYXRlIHRhYmxlcyAmIG5vIHBvaW50ZXJzLiAyIGNvbW1lbnRlZCBsaW5lcyBiZWxvdyBub3QgbmVlZGVkLlxuICAgICAgICAvL3N0YXRlLm5leHQgPSBzdGF0ZS5jb2RlcztcbiAgICAgICAgLy9zdGF0ZS5sZW5jb2RlID0gc3RhdGUubmV4dDtcbiAgICAgICAgLy8gU3dpdGNoIHRvIHVzZSBkeW5hbWljIHRhYmxlXG4gICAgICAgIHN0YXRlLmxlbmNvZGUgPSBzdGF0ZS5sZW5keW47XG4gICAgICAgIHN0YXRlLmxlbmJpdHMgPSA3O1xuXG4gICAgICAgIG9wdHMgPSB7IGJpdHM6IHN0YXRlLmxlbmJpdHMgfTtcbiAgICAgICAgcmV0ID0gaW5mdHJlZXMoQ09ERVMsIHN0YXRlLmxlbnMsIDAsIDE5LCBzdGF0ZS5sZW5jb2RlLCAwLCBzdGF0ZS53b3JrLCBvcHRzKTtcbiAgICAgICAgc3RhdGUubGVuYml0cyA9IG9wdHMuYml0cztcblxuICAgICAgICBpZiAocmV0KSB7XG4gICAgICAgICAgc3RybS5tc2cgPSAnaW52YWxpZCBjb2RlIGxlbmd0aHMgc2V0JztcbiAgICAgICAgICBzdGF0ZS5tb2RlID0gQkFEO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIC8vVHJhY2V2KChzdGRlcnIsIFwiaW5mbGF0ZTogICAgICAgY29kZSBsZW5ndGhzIG9rXFxuXCIpKTtcbiAgICAgICAgc3RhdGUuaGF2ZSA9IDA7XG4gICAgICAgIHN0YXRlLm1vZGUgPSBDT0RFTEVOUztcbiAgICAgICAgLyogZmFsbHMgdGhyb3VnaCAqL1xuICAgICAgY2FzZSBDT0RFTEVOUzpcbiAgICAgICAgd2hpbGUgKHN0YXRlLmhhdmUgPCBzdGF0ZS5ubGVuICsgc3RhdGUubmRpc3QpIHtcbiAgICAgICAgICBmb3IgKDs7KSB7XG4gICAgICAgICAgICBoZXJlID0gc3RhdGUubGVuY29kZVtob2xkICYgKCgxIDw8IHN0YXRlLmxlbmJpdHMpIC0gMSldOy8qQklUUyhzdGF0ZS5sZW5iaXRzKSovXG4gICAgICAgICAgICBoZXJlX2JpdHMgPSBoZXJlID4+PiAyNDtcbiAgICAgICAgICAgIGhlcmVfb3AgPSAoaGVyZSA+Pj4gMTYpICYgMHhmZjtcbiAgICAgICAgICAgIGhlcmVfdmFsID0gaGVyZSAmIDB4ZmZmZjtcblxuICAgICAgICAgICAgaWYgKChoZXJlX2JpdHMpIDw9IGJpdHMpIHsgYnJlYWs7IH1cbiAgICAgICAgICAgIC8vLS0tIFBVTExCWVRFKCkgLS0tLy9cbiAgICAgICAgICAgIGlmIChoYXZlID09PSAwKSB7IGJyZWFrIGluZl9sZWF2ZTsgfVxuICAgICAgICAgICAgaGF2ZS0tO1xuICAgICAgICAgICAgaG9sZCArPSBpbnB1dFtuZXh0KytdIDw8IGJpdHM7XG4gICAgICAgICAgICBiaXRzICs9IDg7XG4gICAgICAgICAgICAvLy0tLS8vXG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChoZXJlX3ZhbCA8IDE2KSB7XG4gICAgICAgICAgICAvLy0tLSBEUk9QQklUUyhoZXJlLmJpdHMpIC0tLS8vXG4gICAgICAgICAgICBob2xkID4+Pj0gaGVyZV9iaXRzO1xuICAgICAgICAgICAgYml0cyAtPSBoZXJlX2JpdHM7XG4gICAgICAgICAgICAvLy0tLS8vXG4gICAgICAgICAgICBzdGF0ZS5sZW5zW3N0YXRlLmhhdmUrK10gPSBoZXJlX3ZhbDtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBpZiAoaGVyZV92YWwgPT09IDE2KSB7XG4gICAgICAgICAgICAgIC8vPT09IE5FRURCSVRTKGhlcmUuYml0cyArIDIpO1xuICAgICAgICAgICAgICBuID0gaGVyZV9iaXRzICsgMjtcbiAgICAgICAgICAgICAgd2hpbGUgKGJpdHMgPCBuKSB7XG4gICAgICAgICAgICAgICAgaWYgKGhhdmUgPT09IDApIHsgYnJlYWsgaW5mX2xlYXZlOyB9XG4gICAgICAgICAgICAgICAgaGF2ZS0tO1xuICAgICAgICAgICAgICAgIGhvbGQgKz0gaW5wdXRbbmV4dCsrXSA8PCBiaXRzO1xuICAgICAgICAgICAgICAgIGJpdHMgKz0gODtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAvLz09PS8vXG4gICAgICAgICAgICAgIC8vLS0tIERST1BCSVRTKGhlcmUuYml0cykgLS0tLy9cbiAgICAgICAgICAgICAgaG9sZCA+Pj49IGhlcmVfYml0cztcbiAgICAgICAgICAgICAgYml0cyAtPSBoZXJlX2JpdHM7XG4gICAgICAgICAgICAgIC8vLS0tLy9cbiAgICAgICAgICAgICAgaWYgKHN0YXRlLmhhdmUgPT09IDApIHtcbiAgICAgICAgICAgICAgICBzdHJtLm1zZyA9ICdpbnZhbGlkIGJpdCBsZW5ndGggcmVwZWF0JztcbiAgICAgICAgICAgICAgICBzdGF0ZS5tb2RlID0gQkFEO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGxlbiA9IHN0YXRlLmxlbnNbc3RhdGUuaGF2ZSAtIDFdO1xuICAgICAgICAgICAgICBjb3B5ID0gMyArIChob2xkICYgMHgwMyk7Ly9CSVRTKDIpO1xuICAgICAgICAgICAgICAvLy0tLSBEUk9QQklUUygyKSAtLS0vL1xuICAgICAgICAgICAgICBob2xkID4+Pj0gMjtcbiAgICAgICAgICAgICAgYml0cyAtPSAyO1xuICAgICAgICAgICAgICAvLy0tLS8vXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChoZXJlX3ZhbCA9PT0gMTcpIHtcbiAgICAgICAgICAgICAgLy89PT0gTkVFREJJVFMoaGVyZS5iaXRzICsgMyk7XG4gICAgICAgICAgICAgIG4gPSBoZXJlX2JpdHMgKyAzO1xuICAgICAgICAgICAgICB3aGlsZSAoYml0cyA8IG4pIHtcbiAgICAgICAgICAgICAgICBpZiAoaGF2ZSA9PT0gMCkgeyBicmVhayBpbmZfbGVhdmU7IH1cbiAgICAgICAgICAgICAgICBoYXZlLS07XG4gICAgICAgICAgICAgICAgaG9sZCArPSBpbnB1dFtuZXh0KytdIDw8IGJpdHM7XG4gICAgICAgICAgICAgICAgYml0cyArPSA4O1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIC8vPT09Ly9cbiAgICAgICAgICAgICAgLy8tLS0gRFJPUEJJVFMoaGVyZS5iaXRzKSAtLS0vL1xuICAgICAgICAgICAgICBob2xkID4+Pj0gaGVyZV9iaXRzO1xuICAgICAgICAgICAgICBiaXRzIC09IGhlcmVfYml0cztcbiAgICAgICAgICAgICAgLy8tLS0vL1xuICAgICAgICAgICAgICBsZW4gPSAwO1xuICAgICAgICAgICAgICBjb3B5ID0gMyArIChob2xkICYgMHgwNyk7Ly9CSVRTKDMpO1xuICAgICAgICAgICAgICAvLy0tLSBEUk9QQklUUygzKSAtLS0vL1xuICAgICAgICAgICAgICBob2xkID4+Pj0gMztcbiAgICAgICAgICAgICAgYml0cyAtPSAzO1xuICAgICAgICAgICAgICAvLy0tLS8vXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgLy89PT0gTkVFREJJVFMoaGVyZS5iaXRzICsgNyk7XG4gICAgICAgICAgICAgIG4gPSBoZXJlX2JpdHMgKyA3O1xuICAgICAgICAgICAgICB3aGlsZSAoYml0cyA8IG4pIHtcbiAgICAgICAgICAgICAgICBpZiAoaGF2ZSA9PT0gMCkgeyBicmVhayBpbmZfbGVhdmU7IH1cbiAgICAgICAgICAgICAgICBoYXZlLS07XG4gICAgICAgICAgICAgICAgaG9sZCArPSBpbnB1dFtuZXh0KytdIDw8IGJpdHM7XG4gICAgICAgICAgICAgICAgYml0cyArPSA4O1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIC8vPT09Ly9cbiAgICAgICAgICAgICAgLy8tLS0gRFJPUEJJVFMoaGVyZS5iaXRzKSAtLS0vL1xuICAgICAgICAgICAgICBob2xkID4+Pj0gaGVyZV9iaXRzO1xuICAgICAgICAgICAgICBiaXRzIC09IGhlcmVfYml0cztcbiAgICAgICAgICAgICAgLy8tLS0vL1xuICAgICAgICAgICAgICBsZW4gPSAwO1xuICAgICAgICAgICAgICBjb3B5ID0gMTEgKyAoaG9sZCAmIDB4N2YpOy8vQklUUyg3KTtcbiAgICAgICAgICAgICAgLy8tLS0gRFJPUEJJVFMoNykgLS0tLy9cbiAgICAgICAgICAgICAgaG9sZCA+Pj49IDc7XG4gICAgICAgICAgICAgIGJpdHMgLT0gNztcbiAgICAgICAgICAgICAgLy8tLS0vL1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHN0YXRlLmhhdmUgKyBjb3B5ID4gc3RhdGUubmxlbiArIHN0YXRlLm5kaXN0KSB7XG4gICAgICAgICAgICAgIHN0cm0ubXNnID0gJ2ludmFsaWQgYml0IGxlbmd0aCByZXBlYXQnO1xuICAgICAgICAgICAgICBzdGF0ZS5tb2RlID0gQkFEO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHdoaWxlIChjb3B5LS0pIHtcbiAgICAgICAgICAgICAgc3RhdGUubGVuc1tzdGF0ZS5oYXZlKytdID0gbGVuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8qIGhhbmRsZSBlcnJvciBicmVha3MgaW4gd2hpbGUgKi9cbiAgICAgICAgaWYgKHN0YXRlLm1vZGUgPT09IEJBRCkgeyBicmVhazsgfVxuXG4gICAgICAgIC8qIGNoZWNrIGZvciBlbmQtb2YtYmxvY2sgY29kZSAoYmV0dGVyIGhhdmUgb25lKSAqL1xuICAgICAgICBpZiAoc3RhdGUubGVuc1syNTZdID09PSAwKSB7XG4gICAgICAgICAgc3RybS5tc2cgPSAnaW52YWxpZCBjb2RlIC0tIG1pc3NpbmcgZW5kLW9mLWJsb2NrJztcbiAgICAgICAgICBzdGF0ZS5tb2RlID0gQkFEO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgLyogYnVpbGQgY29kZSB0YWJsZXMgLS0gbm90ZTogZG8gbm90IGNoYW5nZSB0aGUgbGVuYml0cyBvciBkaXN0Yml0c1xuICAgICAgICAgICB2YWx1ZXMgaGVyZSAoOSBhbmQgNikgd2l0aG91dCByZWFkaW5nIHRoZSBjb21tZW50cyBpbiBpbmZ0cmVlcy5oXG4gICAgICAgICAgIGNvbmNlcm5pbmcgdGhlIEVOT1VHSCBjb25zdGFudHMsIHdoaWNoIGRlcGVuZCBvbiB0aG9zZSB2YWx1ZXMgKi9cbiAgICAgICAgc3RhdGUubGVuYml0cyA9IDk7XG5cbiAgICAgICAgb3B0cyA9IHsgYml0czogc3RhdGUubGVuYml0cyB9O1xuICAgICAgICByZXQgPSBpbmZ0cmVlcyhMRU5TLCBzdGF0ZS5sZW5zLCAwLCBzdGF0ZS5ubGVuLCBzdGF0ZS5sZW5jb2RlLCAwLCBzdGF0ZS53b3JrLCBvcHRzKTtcbiAgICAgICAgLy8gV2UgaGF2ZSBzZXBhcmF0ZSB0YWJsZXMgJiBubyBwb2ludGVycy4gMiBjb21tZW50ZWQgbGluZXMgYmVsb3cgbm90IG5lZWRlZC5cbiAgICAgICAgLy8gc3RhdGUubmV4dF9pbmRleCA9IG9wdHMudGFibGVfaW5kZXg7XG4gICAgICAgIHN0YXRlLmxlbmJpdHMgPSBvcHRzLmJpdHM7XG4gICAgICAgIC8vIHN0YXRlLmxlbmNvZGUgPSBzdGF0ZS5uZXh0O1xuXG4gICAgICAgIGlmIChyZXQpIHtcbiAgICAgICAgICBzdHJtLm1zZyA9ICdpbnZhbGlkIGxpdGVyYWwvbGVuZ3RocyBzZXQnO1xuICAgICAgICAgIHN0YXRlLm1vZGUgPSBCQUQ7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICBzdGF0ZS5kaXN0Yml0cyA9IDY7XG4gICAgICAgIC8vc3RhdGUuZGlzdGNvZGUuY29weShzdGF0ZS5jb2Rlcyk7XG4gICAgICAgIC8vIFN3aXRjaCB0byB1c2UgZHluYW1pYyB0YWJsZVxuICAgICAgICBzdGF0ZS5kaXN0Y29kZSA9IHN0YXRlLmRpc3RkeW47XG4gICAgICAgIG9wdHMgPSB7IGJpdHM6IHN0YXRlLmRpc3RiaXRzIH07XG4gICAgICAgIHJldCA9IGluZnRyZWVzKERJU1RTLCBzdGF0ZS5sZW5zLCBzdGF0ZS5ubGVuLCBzdGF0ZS5uZGlzdCwgc3RhdGUuZGlzdGNvZGUsIDAsIHN0YXRlLndvcmssIG9wdHMpO1xuICAgICAgICAvLyBXZSBoYXZlIHNlcGFyYXRlIHRhYmxlcyAmIG5vIHBvaW50ZXJzLiAyIGNvbW1lbnRlZCBsaW5lcyBiZWxvdyBub3QgbmVlZGVkLlxuICAgICAgICAvLyBzdGF0ZS5uZXh0X2luZGV4ID0gb3B0cy50YWJsZV9pbmRleDtcbiAgICAgICAgc3RhdGUuZGlzdGJpdHMgPSBvcHRzLmJpdHM7XG4gICAgICAgIC8vIHN0YXRlLmRpc3Rjb2RlID0gc3RhdGUubmV4dDtcblxuICAgICAgICBpZiAocmV0KSB7XG4gICAgICAgICAgc3RybS5tc2cgPSAnaW52YWxpZCBkaXN0YW5jZXMgc2V0JztcbiAgICAgICAgICBzdGF0ZS5tb2RlID0gQkFEO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIC8vVHJhY2V2KChzdGRlcnIsICdpbmZsYXRlOiAgICAgICBjb2RlcyBva1xcbicpKTtcbiAgICAgICAgc3RhdGUubW9kZSA9IExFTl87XG4gICAgICAgIGlmIChmbHVzaCA9PT0gWl9UUkVFUykgeyBicmVhayBpbmZfbGVhdmU7IH1cbiAgICAgICAgLyogZmFsbHMgdGhyb3VnaCAqL1xuICAgICAgY2FzZSBMRU5fOlxuICAgICAgICBzdGF0ZS5tb2RlID0gTEVOO1xuICAgICAgICAvKiBmYWxscyB0aHJvdWdoICovXG4gICAgICBjYXNlIExFTjpcbiAgICAgICAgaWYgKGhhdmUgPj0gNiAmJiBsZWZ0ID49IDI1OCkge1xuICAgICAgICAgIC8vLS0tIFJFU1RPUkUoKSAtLS1cbiAgICAgICAgICBzdHJtLm5leHRfb3V0ID0gcHV0O1xuICAgICAgICAgIHN0cm0uYXZhaWxfb3V0ID0gbGVmdDtcbiAgICAgICAgICBzdHJtLm5leHRfaW4gPSBuZXh0O1xuICAgICAgICAgIHN0cm0uYXZhaWxfaW4gPSBoYXZlO1xuICAgICAgICAgIHN0YXRlLmhvbGQgPSBob2xkO1xuICAgICAgICAgIHN0YXRlLmJpdHMgPSBiaXRzO1xuICAgICAgICAgIC8vLS0tXG4gICAgICAgICAgaW5mZmFzdChzdHJtLCBfb3V0KTtcbiAgICAgICAgICAvLy0tLSBMT0FEKCkgLS0tXG4gICAgICAgICAgcHV0ID0gc3RybS5uZXh0X291dDtcbiAgICAgICAgICBvdXRwdXQgPSBzdHJtLm91dHB1dDtcbiAgICAgICAgICBsZWZ0ID0gc3RybS5hdmFpbF9vdXQ7XG4gICAgICAgICAgbmV4dCA9IHN0cm0ubmV4dF9pbjtcbiAgICAgICAgICBpbnB1dCA9IHN0cm0uaW5wdXQ7XG4gICAgICAgICAgaGF2ZSA9IHN0cm0uYXZhaWxfaW47XG4gICAgICAgICAgaG9sZCA9IHN0YXRlLmhvbGQ7XG4gICAgICAgICAgYml0cyA9IHN0YXRlLmJpdHM7XG4gICAgICAgICAgLy8tLS1cblxuICAgICAgICAgIGlmIChzdGF0ZS5tb2RlID09PSBUWVBFKSB7XG4gICAgICAgICAgICBzdGF0ZS5iYWNrID0gLTE7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIHN0YXRlLmJhY2sgPSAwO1xuICAgICAgICBmb3IgKDs7KSB7XG4gICAgICAgICAgaGVyZSA9IHN0YXRlLmxlbmNvZGVbaG9sZCAmICgoMSA8PCBzdGF0ZS5sZW5iaXRzKSAtIDEpXTsgIC8qQklUUyhzdGF0ZS5sZW5iaXRzKSovXG4gICAgICAgICAgaGVyZV9iaXRzID0gaGVyZSA+Pj4gMjQ7XG4gICAgICAgICAgaGVyZV9vcCA9IChoZXJlID4+PiAxNikgJiAweGZmO1xuICAgICAgICAgIGhlcmVfdmFsID0gaGVyZSAmIDB4ZmZmZjtcblxuICAgICAgICAgIGlmIChoZXJlX2JpdHMgPD0gYml0cykgeyBicmVhazsgfVxuICAgICAgICAgIC8vLS0tIFBVTExCWVRFKCkgLS0tLy9cbiAgICAgICAgICBpZiAoaGF2ZSA9PT0gMCkgeyBicmVhayBpbmZfbGVhdmU7IH1cbiAgICAgICAgICBoYXZlLS07XG4gICAgICAgICAgaG9sZCArPSBpbnB1dFtuZXh0KytdIDw8IGJpdHM7XG4gICAgICAgICAgYml0cyArPSA4O1xuICAgICAgICAgIC8vLS0tLy9cbiAgICAgICAgfVxuICAgICAgICBpZiAoaGVyZV9vcCAmJiAoaGVyZV9vcCAmIDB4ZjApID09PSAwKSB7XG4gICAgICAgICAgbGFzdF9iaXRzID0gaGVyZV9iaXRzO1xuICAgICAgICAgIGxhc3Rfb3AgPSBoZXJlX29wO1xuICAgICAgICAgIGxhc3RfdmFsID0gaGVyZV92YWw7XG4gICAgICAgICAgZm9yICg7Oykge1xuICAgICAgICAgICAgaGVyZSA9IHN0YXRlLmxlbmNvZGVbbGFzdF92YWwgK1xuICAgICAgICAgICAgICAgICAgICAoKGhvbGQgJiAoKDEgPDwgKGxhc3RfYml0cyArIGxhc3Rfb3ApKSAtIDEpKS8qQklUUyhsYXN0LmJpdHMgKyBsYXN0Lm9wKSovID4+IGxhc3RfYml0cyldO1xuICAgICAgICAgICAgaGVyZV9iaXRzID0gaGVyZSA+Pj4gMjQ7XG4gICAgICAgICAgICBoZXJlX29wID0gKGhlcmUgPj4+IDE2KSAmIDB4ZmY7XG4gICAgICAgICAgICBoZXJlX3ZhbCA9IGhlcmUgJiAweGZmZmY7XG5cbiAgICAgICAgICAgIGlmICgobGFzdF9iaXRzICsgaGVyZV9iaXRzKSA8PSBiaXRzKSB7IGJyZWFrOyB9XG4gICAgICAgICAgICAvLy0tLSBQVUxMQllURSgpIC0tLS8vXG4gICAgICAgICAgICBpZiAoaGF2ZSA9PT0gMCkgeyBicmVhayBpbmZfbGVhdmU7IH1cbiAgICAgICAgICAgIGhhdmUtLTtcbiAgICAgICAgICAgIGhvbGQgKz0gaW5wdXRbbmV4dCsrXSA8PCBiaXRzO1xuICAgICAgICAgICAgYml0cyArPSA4O1xuICAgICAgICAgICAgLy8tLS0vL1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLy0tLSBEUk9QQklUUyhsYXN0LmJpdHMpIC0tLS8vXG4gICAgICAgICAgaG9sZCA+Pj49IGxhc3RfYml0cztcbiAgICAgICAgICBiaXRzIC09IGxhc3RfYml0cztcbiAgICAgICAgICAvLy0tLS8vXG4gICAgICAgICAgc3RhdGUuYmFjayArPSBsYXN0X2JpdHM7XG4gICAgICAgIH1cbiAgICAgICAgLy8tLS0gRFJPUEJJVFMoaGVyZS5iaXRzKSAtLS0vL1xuICAgICAgICBob2xkID4+Pj0gaGVyZV9iaXRzO1xuICAgICAgICBiaXRzIC09IGhlcmVfYml0cztcbiAgICAgICAgLy8tLS0vL1xuICAgICAgICBzdGF0ZS5iYWNrICs9IGhlcmVfYml0cztcbiAgICAgICAgc3RhdGUubGVuZ3RoID0gaGVyZV92YWw7XG4gICAgICAgIGlmIChoZXJlX29wID09PSAwKSB7XG4gICAgICAgICAgLy9UcmFjZXZ2KChzdGRlcnIsIGhlcmUudmFsID49IDB4MjAgJiYgaGVyZS52YWwgPCAweDdmID9cbiAgICAgICAgICAvLyAgICAgICAgXCJpbmZsYXRlOiAgICAgICAgIGxpdGVyYWwgJyVjJ1xcblwiIDpcbiAgICAgICAgICAvLyAgICAgICAgXCJpbmZsYXRlOiAgICAgICAgIGxpdGVyYWwgMHglMDJ4XFxuXCIsIGhlcmUudmFsKSk7XG4gICAgICAgICAgc3RhdGUubW9kZSA9IExJVDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBpZiAoaGVyZV9vcCAmIDMyKSB7XG4gICAgICAgICAgLy9UcmFjZXZ2KChzdGRlcnIsIFwiaW5mbGF0ZTogICAgICAgICBlbmQgb2YgYmxvY2tcXG5cIikpO1xuICAgICAgICAgIHN0YXRlLmJhY2sgPSAtMTtcbiAgICAgICAgICBzdGF0ZS5tb2RlID0gVFlQRTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBpZiAoaGVyZV9vcCAmIDY0KSB7XG4gICAgICAgICAgc3RybS5tc2cgPSAnaW52YWxpZCBsaXRlcmFsL2xlbmd0aCBjb2RlJztcbiAgICAgICAgICBzdGF0ZS5tb2RlID0gQkFEO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIHN0YXRlLmV4dHJhID0gaGVyZV9vcCAmIDE1O1xuICAgICAgICBzdGF0ZS5tb2RlID0gTEVORVhUO1xuICAgICAgICAvKiBmYWxscyB0aHJvdWdoICovXG4gICAgICBjYXNlIExFTkVYVDpcbiAgICAgICAgaWYgKHN0YXRlLmV4dHJhKSB7XG4gICAgICAgICAgLy89PT0gTkVFREJJVFMoc3RhdGUuZXh0cmEpO1xuICAgICAgICAgIG4gPSBzdGF0ZS5leHRyYTtcbiAgICAgICAgICB3aGlsZSAoYml0cyA8IG4pIHtcbiAgICAgICAgICAgIGlmIChoYXZlID09PSAwKSB7IGJyZWFrIGluZl9sZWF2ZTsgfVxuICAgICAgICAgICAgaGF2ZS0tO1xuICAgICAgICAgICAgaG9sZCArPSBpbnB1dFtuZXh0KytdIDw8IGJpdHM7XG4gICAgICAgICAgICBiaXRzICs9IDg7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vPT09Ly9cbiAgICAgICAgICBzdGF0ZS5sZW5ndGggKz0gaG9sZCAmICgoMSA8PCBzdGF0ZS5leHRyYSkgLSAxKS8qQklUUyhzdGF0ZS5leHRyYSkqLztcbiAgICAgICAgICAvLy0tLSBEUk9QQklUUyhzdGF0ZS5leHRyYSkgLS0tLy9cbiAgICAgICAgICBob2xkID4+Pj0gc3RhdGUuZXh0cmE7XG4gICAgICAgICAgYml0cyAtPSBzdGF0ZS5leHRyYTtcbiAgICAgICAgICAvLy0tLS8vXG4gICAgICAgICAgc3RhdGUuYmFjayArPSBzdGF0ZS5leHRyYTtcbiAgICAgICAgfVxuICAgICAgICAvL1RyYWNldnYoKHN0ZGVyciwgXCJpbmZsYXRlOiAgICAgICAgIGxlbmd0aCAldVxcblwiLCBzdGF0ZS5sZW5ndGgpKTtcbiAgICAgICAgc3RhdGUud2FzID0gc3RhdGUubGVuZ3RoO1xuICAgICAgICBzdGF0ZS5tb2RlID0gRElTVDtcbiAgICAgICAgLyogZmFsbHMgdGhyb3VnaCAqL1xuICAgICAgY2FzZSBESVNUOlxuICAgICAgICBmb3IgKDs7KSB7XG4gICAgICAgICAgaGVyZSA9IHN0YXRlLmRpc3Rjb2RlW2hvbGQgJiAoKDEgPDwgc3RhdGUuZGlzdGJpdHMpIC0gMSldOy8qQklUUyhzdGF0ZS5kaXN0Yml0cykqL1xuICAgICAgICAgIGhlcmVfYml0cyA9IGhlcmUgPj4+IDI0O1xuICAgICAgICAgIGhlcmVfb3AgPSAoaGVyZSA+Pj4gMTYpICYgMHhmZjtcbiAgICAgICAgICBoZXJlX3ZhbCA9IGhlcmUgJiAweGZmZmY7XG5cbiAgICAgICAgICBpZiAoKGhlcmVfYml0cykgPD0gYml0cykgeyBicmVhazsgfVxuICAgICAgICAgIC8vLS0tIFBVTExCWVRFKCkgLS0tLy9cbiAgICAgICAgICBpZiAoaGF2ZSA9PT0gMCkgeyBicmVhayBpbmZfbGVhdmU7IH1cbiAgICAgICAgICBoYXZlLS07XG4gICAgICAgICAgaG9sZCArPSBpbnB1dFtuZXh0KytdIDw8IGJpdHM7XG4gICAgICAgICAgYml0cyArPSA4O1xuICAgICAgICAgIC8vLS0tLy9cbiAgICAgICAgfVxuICAgICAgICBpZiAoKGhlcmVfb3AgJiAweGYwKSA9PT0gMCkge1xuICAgICAgICAgIGxhc3RfYml0cyA9IGhlcmVfYml0cztcbiAgICAgICAgICBsYXN0X29wID0gaGVyZV9vcDtcbiAgICAgICAgICBsYXN0X3ZhbCA9IGhlcmVfdmFsO1xuICAgICAgICAgIGZvciAoOzspIHtcbiAgICAgICAgICAgIGhlcmUgPSBzdGF0ZS5kaXN0Y29kZVtsYXN0X3ZhbCArXG4gICAgICAgICAgICAgICAgICAgICgoaG9sZCAmICgoMSA8PCAobGFzdF9iaXRzICsgbGFzdF9vcCkpIC0gMSkpLypCSVRTKGxhc3QuYml0cyArIGxhc3Qub3ApKi8gPj4gbGFzdF9iaXRzKV07XG4gICAgICAgICAgICBoZXJlX2JpdHMgPSBoZXJlID4+PiAyNDtcbiAgICAgICAgICAgIGhlcmVfb3AgPSAoaGVyZSA+Pj4gMTYpICYgMHhmZjtcbiAgICAgICAgICAgIGhlcmVfdmFsID0gaGVyZSAmIDB4ZmZmZjtcblxuICAgICAgICAgICAgaWYgKChsYXN0X2JpdHMgKyBoZXJlX2JpdHMpIDw9IGJpdHMpIHsgYnJlYWs7IH1cbiAgICAgICAgICAgIC8vLS0tIFBVTExCWVRFKCkgLS0tLy9cbiAgICAgICAgICAgIGlmIChoYXZlID09PSAwKSB7IGJyZWFrIGluZl9sZWF2ZTsgfVxuICAgICAgICAgICAgaGF2ZS0tO1xuICAgICAgICAgICAgaG9sZCArPSBpbnB1dFtuZXh0KytdIDw8IGJpdHM7XG4gICAgICAgICAgICBiaXRzICs9IDg7XG4gICAgICAgICAgICAvLy0tLS8vXG4gICAgICAgICAgfVxuICAgICAgICAgIC8vLS0tIERST1BCSVRTKGxhc3QuYml0cykgLS0tLy9cbiAgICAgICAgICBob2xkID4+Pj0gbGFzdF9iaXRzO1xuICAgICAgICAgIGJpdHMgLT0gbGFzdF9iaXRzO1xuICAgICAgICAgIC8vLS0tLy9cbiAgICAgICAgICBzdGF0ZS5iYWNrICs9IGxhc3RfYml0cztcbiAgICAgICAgfVxuICAgICAgICAvLy0tLSBEUk9QQklUUyhoZXJlLmJpdHMpIC0tLS8vXG4gICAgICAgIGhvbGQgPj4+PSBoZXJlX2JpdHM7XG4gICAgICAgIGJpdHMgLT0gaGVyZV9iaXRzO1xuICAgICAgICAvLy0tLS8vXG4gICAgICAgIHN0YXRlLmJhY2sgKz0gaGVyZV9iaXRzO1xuICAgICAgICBpZiAoaGVyZV9vcCAmIDY0KSB7XG4gICAgICAgICAgc3RybS5tc2cgPSAnaW52YWxpZCBkaXN0YW5jZSBjb2RlJztcbiAgICAgICAgICBzdGF0ZS5tb2RlID0gQkFEO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIHN0YXRlLm9mZnNldCA9IGhlcmVfdmFsO1xuICAgICAgICBzdGF0ZS5leHRyYSA9IChoZXJlX29wKSAmIDE1O1xuICAgICAgICBzdGF0ZS5tb2RlID0gRElTVEVYVDtcbiAgICAgICAgLyogZmFsbHMgdGhyb3VnaCAqL1xuICAgICAgY2FzZSBESVNURVhUOlxuICAgICAgICBpZiAoc3RhdGUuZXh0cmEpIHtcbiAgICAgICAgICAvLz09PSBORUVEQklUUyhzdGF0ZS5leHRyYSk7XG4gICAgICAgICAgbiA9IHN0YXRlLmV4dHJhO1xuICAgICAgICAgIHdoaWxlIChiaXRzIDwgbikge1xuICAgICAgICAgICAgaWYgKGhhdmUgPT09IDApIHsgYnJlYWsgaW5mX2xlYXZlOyB9XG4gICAgICAgICAgICBoYXZlLS07XG4gICAgICAgICAgICBob2xkICs9IGlucHV0W25leHQrK10gPDwgYml0cztcbiAgICAgICAgICAgIGJpdHMgKz0gODtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy89PT0vL1xuICAgICAgICAgIHN0YXRlLm9mZnNldCArPSBob2xkICYgKCgxIDw8IHN0YXRlLmV4dHJhKSAtIDEpLypCSVRTKHN0YXRlLmV4dHJhKSovO1xuICAgICAgICAgIC8vLS0tIERST1BCSVRTKHN0YXRlLmV4dHJhKSAtLS0vL1xuICAgICAgICAgIGhvbGQgPj4+PSBzdGF0ZS5leHRyYTtcbiAgICAgICAgICBiaXRzIC09IHN0YXRlLmV4dHJhO1xuICAgICAgICAgIC8vLS0tLy9cbiAgICAgICAgICBzdGF0ZS5iYWNrICs9IHN0YXRlLmV4dHJhO1xuICAgICAgICB9XG4vLyNpZmRlZiBJTkZMQVRFX1NUUklDVFxuICAgICAgICBpZiAoc3RhdGUub2Zmc2V0ID4gc3RhdGUuZG1heCkge1xuICAgICAgICAgIHN0cm0ubXNnID0gJ2ludmFsaWQgZGlzdGFuY2UgdG9vIGZhciBiYWNrJztcbiAgICAgICAgICBzdGF0ZS5tb2RlID0gQkFEO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4vLyNlbmRpZlxuICAgICAgICAvL1RyYWNldnYoKHN0ZGVyciwgXCJpbmZsYXRlOiAgICAgICAgIGRpc3RhbmNlICV1XFxuXCIsIHN0YXRlLm9mZnNldCkpO1xuICAgICAgICBzdGF0ZS5tb2RlID0gTUFUQ0g7XG4gICAgICAgIC8qIGZhbGxzIHRocm91Z2ggKi9cbiAgICAgIGNhc2UgTUFUQ0g6XG4gICAgICAgIGlmIChsZWZ0ID09PSAwKSB7IGJyZWFrIGluZl9sZWF2ZTsgfVxuICAgICAgICBjb3B5ID0gX291dCAtIGxlZnQ7XG4gICAgICAgIGlmIChzdGF0ZS5vZmZzZXQgPiBjb3B5KSB7ICAgICAgICAgLyogY29weSBmcm9tIHdpbmRvdyAqL1xuICAgICAgICAgIGNvcHkgPSBzdGF0ZS5vZmZzZXQgLSBjb3B5O1xuICAgICAgICAgIGlmIChjb3B5ID4gc3RhdGUud2hhdmUpIHtcbiAgICAgICAgICAgIGlmIChzdGF0ZS5zYW5lKSB7XG4gICAgICAgICAgICAgIHN0cm0ubXNnID0gJ2ludmFsaWQgZGlzdGFuY2UgdG9vIGZhciBiYWNrJztcbiAgICAgICAgICAgICAgc3RhdGUubW9kZSA9IEJBRDtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4vLyAoISkgVGhpcyBibG9jayBpcyBkaXNhYmxlZCBpbiB6bGliIGRlZmF1bHRzLFxuLy8gZG9uJ3QgZW5hYmxlIGl0IGZvciBiaW5hcnkgY29tcGF0aWJpbGl0eVxuLy8jaWZkZWYgSU5GTEFURV9BTExPV19JTlZBTElEX0RJU1RBTkNFX1RPT0ZBUl9BUlJSXG4vLyAgICAgICAgICBUcmFjZSgoc3RkZXJyLCBcImluZmxhdGUuYyB0b28gZmFyXFxuXCIpKTtcbi8vICAgICAgICAgIGNvcHkgLT0gc3RhdGUud2hhdmU7XG4vLyAgICAgICAgICBpZiAoY29weSA+IHN0YXRlLmxlbmd0aCkgeyBjb3B5ID0gc3RhdGUubGVuZ3RoOyB9XG4vLyAgICAgICAgICBpZiAoY29weSA+IGxlZnQpIHsgY29weSA9IGxlZnQ7IH1cbi8vICAgICAgICAgIGxlZnQgLT0gY29weTtcbi8vICAgICAgICAgIHN0YXRlLmxlbmd0aCAtPSBjb3B5O1xuLy8gICAgICAgICAgZG8ge1xuLy8gICAgICAgICAgICBvdXRwdXRbcHV0KytdID0gMDtcbi8vICAgICAgICAgIH0gd2hpbGUgKC0tY29weSk7XG4vLyAgICAgICAgICBpZiAoc3RhdGUubGVuZ3RoID09PSAwKSB7IHN0YXRlLm1vZGUgPSBMRU47IH1cbi8vICAgICAgICAgIGJyZWFrO1xuLy8jZW5kaWZcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGNvcHkgPiBzdGF0ZS53bmV4dCkge1xuICAgICAgICAgICAgY29weSAtPSBzdGF0ZS53bmV4dDtcbiAgICAgICAgICAgIGZyb20gPSBzdGF0ZS53c2l6ZSAtIGNvcHk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgZnJvbSA9IHN0YXRlLnduZXh0IC0gY29weTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGNvcHkgPiBzdGF0ZS5sZW5ndGgpIHsgY29weSA9IHN0YXRlLmxlbmd0aDsgfVxuICAgICAgICAgIGZyb21fc291cmNlID0gc3RhdGUud2luZG93O1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgeyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8qIGNvcHkgZnJvbSBvdXRwdXQgKi9cbiAgICAgICAgICBmcm9tX3NvdXJjZSA9IG91dHB1dDtcbiAgICAgICAgICBmcm9tID0gcHV0IC0gc3RhdGUub2Zmc2V0O1xuICAgICAgICAgIGNvcHkgPSBzdGF0ZS5sZW5ndGg7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvcHkgPiBsZWZ0KSB7IGNvcHkgPSBsZWZ0OyB9XG4gICAgICAgIGxlZnQgLT0gY29weTtcbiAgICAgICAgc3RhdGUubGVuZ3RoIC09IGNvcHk7XG4gICAgICAgIGRvIHtcbiAgICAgICAgICBvdXRwdXRbcHV0KytdID0gZnJvbV9zb3VyY2VbZnJvbSsrXTtcbiAgICAgICAgfSB3aGlsZSAoLS1jb3B5KTtcbiAgICAgICAgaWYgKHN0YXRlLmxlbmd0aCA9PT0gMCkgeyBzdGF0ZS5tb2RlID0gTEVOOyB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBMSVQ6XG4gICAgICAgIGlmIChsZWZ0ID09PSAwKSB7IGJyZWFrIGluZl9sZWF2ZTsgfVxuICAgICAgICBvdXRwdXRbcHV0KytdID0gc3RhdGUubGVuZ3RoO1xuICAgICAgICBsZWZ0LS07XG4gICAgICAgIHN0YXRlLm1vZGUgPSBMRU47XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBDSEVDSzpcbiAgICAgICAgaWYgKHN0YXRlLndyYXApIHtcbiAgICAgICAgICAvLz09PSBORUVEQklUUygzMik7XG4gICAgICAgICAgd2hpbGUgKGJpdHMgPCAzMikge1xuICAgICAgICAgICAgaWYgKGhhdmUgPT09IDApIHsgYnJlYWsgaW5mX2xlYXZlOyB9XG4gICAgICAgICAgICBoYXZlLS07XG4gICAgICAgICAgICAvLyBVc2UgJ3wnIGluc3RlYWQgb2YgJysnIHRvIG1ha2Ugc3VyZSB0aGF0IHJlc3VsdCBpcyBzaWduZWRcbiAgICAgICAgICAgIGhvbGQgfD0gaW5wdXRbbmV4dCsrXSA8PCBiaXRzO1xuICAgICAgICAgICAgYml0cyArPSA4O1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLz09PS8vXG4gICAgICAgICAgX291dCAtPSBsZWZ0O1xuICAgICAgICAgIHN0cm0udG90YWxfb3V0ICs9IF9vdXQ7XG4gICAgICAgICAgc3RhdGUudG90YWwgKz0gX291dDtcbiAgICAgICAgICBpZiAoKHN0YXRlLndyYXAgJiA0KSAmJiBfb3V0KSB7XG4gICAgICAgICAgICBzdHJtLmFkbGVyID0gc3RhdGUuY2hlY2sgPVxuICAgICAgICAgICAgICAgIC8qVVBEQVRFX0NIRUNLKHN0YXRlLmNoZWNrLCBwdXQgLSBfb3V0LCBfb3V0KTsqL1xuICAgICAgICAgICAgICAgIChzdGF0ZS5mbGFncyA/IGNyYzMyXzEoc3RhdGUuY2hlY2ssIG91dHB1dCwgX291dCwgcHV0IC0gX291dCkgOiBhZGxlcjMyXzEoc3RhdGUuY2hlY2ssIG91dHB1dCwgX291dCwgcHV0IC0gX291dCkpO1xuXG4gICAgICAgICAgfVxuICAgICAgICAgIF9vdXQgPSBsZWZ0O1xuICAgICAgICAgIC8vIE5COiBjcmMzMiBzdG9yZWQgYXMgc2lnbmVkIDMyLWJpdCBpbnQsIHpzd2FwMzIgcmV0dXJucyBzaWduZWQgdG9vXG4gICAgICAgICAgaWYgKChzdGF0ZS53cmFwICYgNCkgJiYgKHN0YXRlLmZsYWdzID8gaG9sZCA6IHpzd2FwMzIoaG9sZCkpICE9PSBzdGF0ZS5jaGVjaykge1xuICAgICAgICAgICAgc3RybS5tc2cgPSAnaW5jb3JyZWN0IGRhdGEgY2hlY2snO1xuICAgICAgICAgICAgc3RhdGUubW9kZSA9IEJBRDtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLz09PSBJTklUQklUUygpO1xuICAgICAgICAgIGhvbGQgPSAwO1xuICAgICAgICAgIGJpdHMgPSAwO1xuICAgICAgICAgIC8vPT09Ly9cbiAgICAgICAgICAvL1RyYWNldigoc3RkZXJyLCBcImluZmxhdGU6ICAgY2hlY2sgbWF0Y2hlcyB0cmFpbGVyXFxuXCIpKTtcbiAgICAgICAgfVxuICAgICAgICBzdGF0ZS5tb2RlID0gTEVOR1RIO1xuICAgICAgICAvKiBmYWxscyB0aHJvdWdoICovXG4gICAgICBjYXNlIExFTkdUSDpcbiAgICAgICAgaWYgKHN0YXRlLndyYXAgJiYgc3RhdGUuZmxhZ3MpIHtcbiAgICAgICAgICAvLz09PSBORUVEQklUUygzMik7XG4gICAgICAgICAgd2hpbGUgKGJpdHMgPCAzMikge1xuICAgICAgICAgICAgaWYgKGhhdmUgPT09IDApIHsgYnJlYWsgaW5mX2xlYXZlOyB9XG4gICAgICAgICAgICBoYXZlLS07XG4gICAgICAgICAgICBob2xkICs9IGlucHV0W25leHQrK10gPDwgYml0cztcbiAgICAgICAgICAgIGJpdHMgKz0gODtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy89PT0vL1xuICAgICAgICAgIGlmICgoc3RhdGUud3JhcCAmIDQpICYmIGhvbGQgIT09IChzdGF0ZS50b3RhbCAmIDB4ZmZmZmZmZmYpKSB7XG4gICAgICAgICAgICBzdHJtLm1zZyA9ICdpbmNvcnJlY3QgbGVuZ3RoIGNoZWNrJztcbiAgICAgICAgICAgIHN0YXRlLm1vZGUgPSBCQUQ7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgICAgLy89PT0gSU5JVEJJVFMoKTtcbiAgICAgICAgICBob2xkID0gMDtcbiAgICAgICAgICBiaXRzID0gMDtcbiAgICAgICAgICAvLz09PS8vXG4gICAgICAgICAgLy9UcmFjZXYoKHN0ZGVyciwgXCJpbmZsYXRlOiAgIGxlbmd0aCBtYXRjaGVzIHRyYWlsZXJcXG5cIikpO1xuICAgICAgICB9XG4gICAgICAgIHN0YXRlLm1vZGUgPSBET05FO1xuICAgICAgICAvKiBmYWxscyB0aHJvdWdoICovXG4gICAgICBjYXNlIERPTkU6XG4gICAgICAgIHJldCA9IFpfU1RSRUFNX0VORCQxO1xuICAgICAgICBicmVhayBpbmZfbGVhdmU7XG4gICAgICBjYXNlIEJBRDpcbiAgICAgICAgcmV0ID0gWl9EQVRBX0VSUk9SJDE7XG4gICAgICAgIGJyZWFrIGluZl9sZWF2ZTtcbiAgICAgIGNhc2UgTUVNOlxuICAgICAgICByZXR1cm4gWl9NRU1fRVJST1IkMTtcbiAgICAgIGNhc2UgU1lOQzpcbiAgICAgICAgLyogZmFsbHMgdGhyb3VnaCAqL1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIFpfU1RSRUFNX0VSUk9SJDE7XG4gICAgfVxuICB9XG5cbiAgLy8gaW5mX2xlYXZlIDwtIGhlcmUgaXMgcmVhbCBwbGFjZSBmb3IgXCJnb3RvIGluZl9sZWF2ZVwiLCBlbXVsYXRlZCB2aWEgXCJicmVhayBpbmZfbGVhdmVcIlxuXG4gIC8qXG4gICAgIFJldHVybiBmcm9tIGluZmxhdGUoKSwgdXBkYXRpbmcgdGhlIHRvdGFsIGNvdW50cyBhbmQgdGhlIGNoZWNrIHZhbHVlLlxuICAgICBJZiB0aGVyZSB3YXMgbm8gcHJvZ3Jlc3MgZHVyaW5nIHRoZSBpbmZsYXRlKCkgY2FsbCwgcmV0dXJuIGEgYnVmZmVyXG4gICAgIGVycm9yLiAgQ2FsbCB1cGRhdGV3aW5kb3coKSB0byBjcmVhdGUgYW5kL29yIHVwZGF0ZSB0aGUgd2luZG93IHN0YXRlLlxuICAgICBOb3RlOiBhIG1lbW9yeSBlcnJvciBmcm9tIGluZmxhdGUoKSBpcyBub24tcmVjb3ZlcmFibGUuXG4gICAqL1xuXG4gIC8vLS0tIFJFU1RPUkUoKSAtLS1cbiAgc3RybS5uZXh0X291dCA9IHB1dDtcbiAgc3RybS5hdmFpbF9vdXQgPSBsZWZ0O1xuICBzdHJtLm5leHRfaW4gPSBuZXh0O1xuICBzdHJtLmF2YWlsX2luID0gaGF2ZTtcbiAgc3RhdGUuaG9sZCA9IGhvbGQ7XG4gIHN0YXRlLmJpdHMgPSBiaXRzO1xuICAvLy0tLVxuXG4gIGlmIChzdGF0ZS53c2l6ZSB8fCAoX291dCAhPT0gc3RybS5hdmFpbF9vdXQgJiYgc3RhdGUubW9kZSA8IEJBRCAmJlxuICAgICAgICAgICAgICAgICAgICAgIChzdGF0ZS5tb2RlIDwgQ0hFQ0sgfHwgZmx1c2ggIT09IFpfRklOSVNIJDEpKSkge1xuICAgIGlmICh1cGRhdGV3aW5kb3coc3RybSwgc3RybS5vdXRwdXQsIHN0cm0ubmV4dF9vdXQsIF9vdXQgLSBzdHJtLmF2YWlsX291dCkpIDtcbiAgfVxuICBfaW4gLT0gc3RybS5hdmFpbF9pbjtcbiAgX291dCAtPSBzdHJtLmF2YWlsX291dDtcbiAgc3RybS50b3RhbF9pbiArPSBfaW47XG4gIHN0cm0udG90YWxfb3V0ICs9IF9vdXQ7XG4gIHN0YXRlLnRvdGFsICs9IF9vdXQ7XG4gIGlmICgoc3RhdGUud3JhcCAmIDQpICYmIF9vdXQpIHtcbiAgICBzdHJtLmFkbGVyID0gc3RhdGUuY2hlY2sgPSAvKlVQREFURV9DSEVDSyhzdGF0ZS5jaGVjaywgc3RybS5uZXh0X291dCAtIF9vdXQsIF9vdXQpOyovXG4gICAgICAoc3RhdGUuZmxhZ3MgPyBjcmMzMl8xKHN0YXRlLmNoZWNrLCBvdXRwdXQsIF9vdXQsIHN0cm0ubmV4dF9vdXQgLSBfb3V0KSA6IGFkbGVyMzJfMShzdGF0ZS5jaGVjaywgb3V0cHV0LCBfb3V0LCBzdHJtLm5leHRfb3V0IC0gX291dCkpO1xuICB9XG4gIHN0cm0uZGF0YV90eXBlID0gc3RhdGUuYml0cyArIChzdGF0ZS5sYXN0ID8gNjQgOiAwKSArXG4gICAgICAgICAgICAgICAgICAgIChzdGF0ZS5tb2RlID09PSBUWVBFID8gMTI4IDogMCkgK1xuICAgICAgICAgICAgICAgICAgICAoc3RhdGUubW9kZSA9PT0gTEVOXyB8fCBzdGF0ZS5tb2RlID09PSBDT1BZXyA/IDI1NiA6IDApO1xuICBpZiAoKChfaW4gPT09IDAgJiYgX291dCA9PT0gMCkgfHwgZmx1c2ggPT09IFpfRklOSVNIJDEpICYmIHJldCA9PT0gWl9PSyQxKSB7XG4gICAgcmV0ID0gWl9CVUZfRVJST1I7XG4gIH1cbiAgcmV0dXJuIHJldDtcbn07XG5cblxuY29uc3QgaW5mbGF0ZUVuZCA9IChzdHJtKSA9PiB7XG5cbiAgaWYgKGluZmxhdGVTdGF0ZUNoZWNrKHN0cm0pKSB7XG4gICAgcmV0dXJuIFpfU1RSRUFNX0VSUk9SJDE7XG4gIH1cblxuICBsZXQgc3RhdGUgPSBzdHJtLnN0YXRlO1xuICBpZiAoc3RhdGUud2luZG93KSB7XG4gICAgc3RhdGUud2luZG93ID0gbnVsbDtcbiAgfVxuICBzdHJtLnN0YXRlID0gbnVsbDtcbiAgcmV0dXJuIFpfT0skMTtcbn07XG5cblxuY29uc3QgaW5mbGF0ZUdldEhlYWRlciA9IChzdHJtLCBoZWFkKSA9PiB7XG5cbiAgLyogY2hlY2sgc3RhdGUgKi9cbiAgaWYgKGluZmxhdGVTdGF0ZUNoZWNrKHN0cm0pKSB7IHJldHVybiBaX1NUUkVBTV9FUlJPUiQxOyB9XG4gIGNvbnN0IHN0YXRlID0gc3RybS5zdGF0ZTtcbiAgaWYgKChzdGF0ZS53cmFwICYgMikgPT09IDApIHsgcmV0dXJuIFpfU1RSRUFNX0VSUk9SJDE7IH1cblxuICAvKiBzYXZlIGhlYWRlciBzdHJ1Y3R1cmUgKi9cbiAgc3RhdGUuaGVhZCA9IGhlYWQ7XG4gIGhlYWQuZG9uZSA9IGZhbHNlO1xuICByZXR1cm4gWl9PSyQxO1xufTtcblxuXG5jb25zdCBpbmZsYXRlU2V0RGljdGlvbmFyeSA9IChzdHJtLCBkaWN0aW9uYXJ5KSA9PiB7XG4gIGNvbnN0IGRpY3RMZW5ndGggPSBkaWN0aW9uYXJ5Lmxlbmd0aDtcblxuICBsZXQgc3RhdGU7XG4gIGxldCBkaWN0aWQ7XG4gIGxldCByZXQ7XG5cbiAgLyogY2hlY2sgc3RhdGUgKi9cbiAgaWYgKGluZmxhdGVTdGF0ZUNoZWNrKHN0cm0pKSB7IHJldHVybiBaX1NUUkVBTV9FUlJPUiQxOyB9XG4gIHN0YXRlID0gc3RybS5zdGF0ZTtcblxuICBpZiAoc3RhdGUud3JhcCAhPT0gMCAmJiBzdGF0ZS5tb2RlICE9PSBESUNUKSB7XG4gICAgcmV0dXJuIFpfU1RSRUFNX0VSUk9SJDE7XG4gIH1cblxuICAvKiBjaGVjayBmb3IgY29ycmVjdCBkaWN0aW9uYXJ5IGlkZW50aWZpZXIgKi9cbiAgaWYgKHN0YXRlLm1vZGUgPT09IERJQ1QpIHtcbiAgICBkaWN0aWQgPSAxOyAvKiBhZGxlcjMyKDAsIG51bGwsIDApKi9cbiAgICAvKiBkaWN0aWQgPSBhZGxlcjMyKGRpY3RpZCwgZGljdGlvbmFyeSwgZGljdExlbmd0aCk7ICovXG4gICAgZGljdGlkID0gYWRsZXIzMl8xKGRpY3RpZCwgZGljdGlvbmFyeSwgZGljdExlbmd0aCwgMCk7XG4gICAgaWYgKGRpY3RpZCAhPT0gc3RhdGUuY2hlY2spIHtcbiAgICAgIHJldHVybiBaX0RBVEFfRVJST1IkMTtcbiAgICB9XG4gIH1cbiAgLyogY29weSBkaWN0aW9uYXJ5IHRvIHdpbmRvdyB1c2luZyB1cGRhdGV3aW5kb3coKSwgd2hpY2ggd2lsbCBhbWVuZCB0aGVcbiAgIGV4aXN0aW5nIGRpY3Rpb25hcnkgaWYgYXBwcm9wcmlhdGUgKi9cbiAgcmV0ID0gdXBkYXRld2luZG93KHN0cm0sIGRpY3Rpb25hcnksIGRpY3RMZW5ndGgsIGRpY3RMZW5ndGgpO1xuICBpZiAocmV0KSB7XG4gICAgc3RhdGUubW9kZSA9IE1FTTtcbiAgICByZXR1cm4gWl9NRU1fRVJST1IkMTtcbiAgfVxuICBzdGF0ZS5oYXZlZGljdCA9IDE7XG4gIC8vIFRyYWNldigoc3RkZXJyLCBcImluZmxhdGU6ICAgZGljdGlvbmFyeSBzZXRcXG5cIikpO1xuICByZXR1cm4gWl9PSyQxO1xufTtcblxuXG52YXIgaW5mbGF0ZVJlc2V0XzEgPSBpbmZsYXRlUmVzZXQ7XG52YXIgaW5mbGF0ZVJlc2V0Ml8xID0gaW5mbGF0ZVJlc2V0MjtcbnZhciBpbmZsYXRlUmVzZXRLZWVwXzEgPSBpbmZsYXRlUmVzZXRLZWVwO1xudmFyIGluZmxhdGVJbml0XzEgPSBpbmZsYXRlSW5pdDtcbnZhciBpbmZsYXRlSW5pdDJfMSA9IGluZmxhdGVJbml0MjtcbnZhciBpbmZsYXRlXzIkMSA9IGluZmxhdGUkMjtcbnZhciBpbmZsYXRlRW5kXzEgPSBpbmZsYXRlRW5kO1xudmFyIGluZmxhdGVHZXRIZWFkZXJfMSA9IGluZmxhdGVHZXRIZWFkZXI7XG52YXIgaW5mbGF0ZVNldERpY3Rpb25hcnlfMSA9IGluZmxhdGVTZXREaWN0aW9uYXJ5O1xudmFyIGluZmxhdGVJbmZvID0gJ3Bha28gaW5mbGF0ZSAoZnJvbSBOb2RlY2EgcHJvamVjdCknO1xuXG4vKiBOb3QgaW1wbGVtZW50ZWRcbm1vZHVsZS5leHBvcnRzLmluZmxhdGVDb2Rlc1VzZWQgPSBpbmZsYXRlQ29kZXNVc2VkO1xubW9kdWxlLmV4cG9ydHMuaW5mbGF0ZUNvcHkgPSBpbmZsYXRlQ29weTtcbm1vZHVsZS5leHBvcnRzLmluZmxhdGVHZXREaWN0aW9uYXJ5ID0gaW5mbGF0ZUdldERpY3Rpb25hcnk7XG5tb2R1bGUuZXhwb3J0cy5pbmZsYXRlTWFyayA9IGluZmxhdGVNYXJrO1xubW9kdWxlLmV4cG9ydHMuaW5mbGF0ZVByaW1lID0gaW5mbGF0ZVByaW1lO1xubW9kdWxlLmV4cG9ydHMuaW5mbGF0ZVN5bmMgPSBpbmZsYXRlU3luYztcbm1vZHVsZS5leHBvcnRzLmluZmxhdGVTeW5jUG9pbnQgPSBpbmZsYXRlU3luY1BvaW50O1xubW9kdWxlLmV4cG9ydHMuaW5mbGF0ZVVuZGVybWluZSA9IGluZmxhdGVVbmRlcm1pbmU7XG5tb2R1bGUuZXhwb3J0cy5pbmZsYXRlVmFsaWRhdGUgPSBpbmZsYXRlVmFsaWRhdGU7XG4qL1xuXG52YXIgaW5mbGF0ZV8xJDIgPSB7XG5cdGluZmxhdGVSZXNldDogaW5mbGF0ZVJlc2V0XzEsXG5cdGluZmxhdGVSZXNldDI6IGluZmxhdGVSZXNldDJfMSxcblx0aW5mbGF0ZVJlc2V0S2VlcDogaW5mbGF0ZVJlc2V0S2VlcF8xLFxuXHRpbmZsYXRlSW5pdDogaW5mbGF0ZUluaXRfMSxcblx0aW5mbGF0ZUluaXQyOiBpbmZsYXRlSW5pdDJfMSxcblx0aW5mbGF0ZTogaW5mbGF0ZV8yJDEsXG5cdGluZmxhdGVFbmQ6IGluZmxhdGVFbmRfMSxcblx0aW5mbGF0ZUdldEhlYWRlcjogaW5mbGF0ZUdldEhlYWRlcl8xLFxuXHRpbmZsYXRlU2V0RGljdGlvbmFyeTogaW5mbGF0ZVNldERpY3Rpb25hcnlfMSxcblx0aW5mbGF0ZUluZm86IGluZmxhdGVJbmZvXG59O1xuXG4vLyAoQykgMTk5NS0yMDEzIEplYW4tbG91cCBHYWlsbHkgYW5kIE1hcmsgQWRsZXJcbi8vIChDKSAyMDE0LTIwMTcgVml0YWx5IFB1enJpbiBhbmQgQW5kcmV5IFR1cGl0c2luXG4vL1xuLy8gVGhpcyBzb2Z0d2FyZSBpcyBwcm92aWRlZCAnYXMtaXMnLCB3aXRob3V0IGFueSBleHByZXNzIG9yIGltcGxpZWRcbi8vIHdhcnJhbnR5LiBJbiBubyBldmVudCB3aWxsIHRoZSBhdXRob3JzIGJlIGhlbGQgbGlhYmxlIGZvciBhbnkgZGFtYWdlc1xuLy8gYXJpc2luZyBmcm9tIHRoZSB1c2Ugb2YgdGhpcyBzb2Z0d2FyZS5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGdyYW50ZWQgdG8gYW55b25lIHRvIHVzZSB0aGlzIHNvZnR3YXJlIGZvciBhbnkgcHVycG9zZSxcbi8vIGluY2x1ZGluZyBjb21tZXJjaWFsIGFwcGxpY2F0aW9ucywgYW5kIHRvIGFsdGVyIGl0IGFuZCByZWRpc3RyaWJ1dGUgaXRcbi8vIGZyZWVseSwgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nIHJlc3RyaWN0aW9uczpcbi8vXG4vLyAxLiBUaGUgb3JpZ2luIG9mIHRoaXMgc29mdHdhcmUgbXVzdCBub3QgYmUgbWlzcmVwcmVzZW50ZWQ7IHlvdSBtdXN0IG5vdFxuLy8gICBjbGFpbSB0aGF0IHlvdSB3cm90ZSB0aGUgb3JpZ2luYWwgc29mdHdhcmUuIElmIHlvdSB1c2UgdGhpcyBzb2Z0d2FyZVxuLy8gICBpbiBhIHByb2R1Y3QsIGFuIGFja25vd2xlZGdtZW50IGluIHRoZSBwcm9kdWN0IGRvY3VtZW50YXRpb24gd291bGQgYmVcbi8vICAgYXBwcmVjaWF0ZWQgYnV0IGlzIG5vdCByZXF1aXJlZC5cbi8vIDIuIEFsdGVyZWQgc291cmNlIHZlcnNpb25zIG11c3QgYmUgcGxhaW5seSBtYXJrZWQgYXMgc3VjaCwgYW5kIG11c3Qgbm90IGJlXG4vLyAgIG1pc3JlcHJlc2VudGVkIGFzIGJlaW5nIHRoZSBvcmlnaW5hbCBzb2Z0d2FyZS5cbi8vIDMuIFRoaXMgbm90aWNlIG1heSBub3QgYmUgcmVtb3ZlZCBvciBhbHRlcmVkIGZyb20gYW55IHNvdXJjZSBkaXN0cmlidXRpb24uXG5cbmZ1bmN0aW9uIEdaaGVhZGVyKCkge1xuICAvKiB0cnVlIGlmIGNvbXByZXNzZWQgZGF0YSBiZWxpZXZlZCB0byBiZSB0ZXh0ICovXG4gIHRoaXMudGV4dCAgICAgICA9IDA7XG4gIC8qIG1vZGlmaWNhdGlvbiB0aW1lICovXG4gIHRoaXMudGltZSAgICAgICA9IDA7XG4gIC8qIGV4dHJhIGZsYWdzIChub3QgdXNlZCB3aGVuIHdyaXRpbmcgYSBnemlwIGZpbGUpICovXG4gIHRoaXMueGZsYWdzICAgICA9IDA7XG4gIC8qIG9wZXJhdGluZyBzeXN0ZW0gKi9cbiAgdGhpcy5vcyAgICAgICAgID0gMDtcbiAgLyogcG9pbnRlciB0byBleHRyYSBmaWVsZCBvciBaX05VTEwgaWYgbm9uZSAqL1xuICB0aGlzLmV4dHJhICAgICAgPSBudWxsO1xuICAvKiBleHRyYSBmaWVsZCBsZW5ndGggKHZhbGlkIGlmIGV4dHJhICE9IFpfTlVMTCkgKi9cbiAgdGhpcy5leHRyYV9sZW4gID0gMDsgLy8gQWN0dWFsbHksIHdlIGRvbid0IG5lZWQgaXQgaW4gSlMsXG4gICAgICAgICAgICAgICAgICAgICAgIC8vIGJ1dCBsZWF2ZSBmb3IgZmV3IGNvZGUgbW9kaWZpY2F0aW9uc1xuXG4gIC8vXG4gIC8vIFNldHVwIGxpbWl0cyBpcyBub3QgbmVjZXNzYXJ5IGJlY2F1c2UgaW4ganMgd2Ugc2hvdWxkIG5vdCBwcmVhbGxvY2F0ZSBtZW1vcnlcbiAgLy8gZm9yIGluZmxhdGUgdXNlIGNvbnN0YW50IGxpbWl0IGluIDY1NTM2IGJ5dGVzXG4gIC8vXG5cbiAgLyogc3BhY2UgYXQgZXh0cmEgKG9ubHkgd2hlbiByZWFkaW5nIGhlYWRlcikgKi9cbiAgLy8gdGhpcy5leHRyYV9tYXggID0gMDtcbiAgLyogcG9pbnRlciB0byB6ZXJvLXRlcm1pbmF0ZWQgZmlsZSBuYW1lIG9yIFpfTlVMTCAqL1xuICB0aGlzLm5hbWUgICAgICAgPSAnJztcbiAgLyogc3BhY2UgYXQgbmFtZSAob25seSB3aGVuIHJlYWRpbmcgaGVhZGVyKSAqL1xuICAvLyB0aGlzLm5hbWVfbWF4ICAgPSAwO1xuICAvKiBwb2ludGVyIHRvIHplcm8tdGVybWluYXRlZCBjb21tZW50IG9yIFpfTlVMTCAqL1xuICB0aGlzLmNvbW1lbnQgICAgPSAnJztcbiAgLyogc3BhY2UgYXQgY29tbWVudCAob25seSB3aGVuIHJlYWRpbmcgaGVhZGVyKSAqL1xuICAvLyB0aGlzLmNvbW1fbWF4ICAgPSAwO1xuICAvKiB0cnVlIGlmIHRoZXJlIHdhcyBvciB3aWxsIGJlIGEgaGVhZGVyIGNyYyAqL1xuICB0aGlzLmhjcmMgICAgICAgPSAwO1xuICAvKiB0cnVlIHdoZW4gZG9uZSByZWFkaW5nIGd6aXAgaGVhZGVyIChub3QgdXNlZCB3aGVuIHdyaXRpbmcgYSBnemlwIGZpbGUpICovXG4gIHRoaXMuZG9uZSAgICAgICA9IGZhbHNlO1xufVxuXG52YXIgZ3poZWFkZXIgPSBHWmhlYWRlcjtcblxuY29uc3QgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xuXG4vKiBQdWJsaWMgY29uc3RhbnRzID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0qL1xuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Ki9cblxuY29uc3Qge1xuICBaX05PX0ZMVVNILCBaX0ZJTklTSCxcbiAgWl9PSywgWl9TVFJFQU1fRU5ELCBaX05FRURfRElDVCwgWl9TVFJFQU1fRVJST1IsIFpfREFUQV9FUlJPUiwgWl9NRU1fRVJST1Jcbn0gPSBjb25zdGFudHMkMjtcblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Ki9cblxuXG4vKipcbiAqIGNsYXNzIEluZmxhdGVcbiAqXG4gKiBHZW5lcmljIEpTLXN0eWxlIHdyYXBwZXIgZm9yIHpsaWIgY2FsbHMuIElmIHlvdSBkb24ndCBuZWVkXG4gKiBzdHJlYW1pbmcgYmVoYXZpb3VyIC0gdXNlIG1vcmUgc2ltcGxlIGZ1bmN0aW9uczogW1tpbmZsYXRlXV1cbiAqIGFuZCBbW2luZmxhdGVSYXddXS5cbiAqKi9cblxuLyogaW50ZXJuYWxcbiAqIGluZmxhdGUuY2h1bmtzIC0+IEFycmF5XG4gKlxuICogQ2h1bmtzIG9mIG91dHB1dCBkYXRhLCBpZiBbW0luZmxhdGUjb25EYXRhXV0gbm90IG92ZXJyaWRkZW4uXG4gKiovXG5cbi8qKlxuICogSW5mbGF0ZS5yZXN1bHQgLT4gVWludDhBcnJheXxTdHJpbmdcbiAqXG4gKiBVbmNvbXByZXNzZWQgcmVzdWx0LCBnZW5lcmF0ZWQgYnkgZGVmYXVsdCBbW0luZmxhdGUjb25EYXRhXV1cbiAqIGFuZCBbW0luZmxhdGUjb25FbmRdXSBoYW5kbGVycy4gRmlsbGVkIGFmdGVyIHlvdSBwdXNoIGxhc3QgY2h1bmtcbiAqIChjYWxsIFtbSW5mbGF0ZSNwdXNoXV0gd2l0aCBgWl9GSU5JU0hgIC8gYHRydWVgIHBhcmFtKS5cbiAqKi9cblxuLyoqXG4gKiBJbmZsYXRlLmVyciAtPiBOdW1iZXJcbiAqXG4gKiBFcnJvciBjb2RlIGFmdGVyIGluZmxhdGUgZmluaXNoZWQuIDAgKFpfT0spIG9uIHN1Y2Nlc3MuXG4gKiBTaG91bGQgYmUgY2hlY2tlZCBpZiBicm9rZW4gZGF0YSBwb3NzaWJsZS5cbiAqKi9cblxuLyoqXG4gKiBJbmZsYXRlLm1zZyAtPiBTdHJpbmdcbiAqXG4gKiBFcnJvciBtZXNzYWdlLCBpZiBbW0luZmxhdGUuZXJyXV0gIT0gMFxuICoqL1xuXG5cbi8qKlxuICogbmV3IEluZmxhdGUob3B0aW9ucylcbiAqIC0gb3B0aW9ucyAoT2JqZWN0KTogemxpYiBpbmZsYXRlIG9wdGlvbnMuXG4gKlxuICogQ3JlYXRlcyBuZXcgaW5mbGF0b3IgaW5zdGFuY2Ugd2l0aCBzcGVjaWZpZWQgcGFyYW1zLiBUaHJvd3MgZXhjZXB0aW9uXG4gKiBvbiBiYWQgcGFyYW1zLiBTdXBwb3J0ZWQgb3B0aW9uczpcbiAqXG4gKiAtIGB3aW5kb3dCaXRzYFxuICogLSBgZGljdGlvbmFyeWBcbiAqXG4gKiBbaHR0cDovL3psaWIubmV0L21hbnVhbC5odG1sI0FkdmFuY2VkXShodHRwOi8vemxpYi5uZXQvbWFudWFsLmh0bWwjQWR2YW5jZWQpXG4gKiBmb3IgbW9yZSBpbmZvcm1hdGlvbiBvbiB0aGVzZS5cbiAqXG4gKiBBZGRpdGlvbmFsIG9wdGlvbnMsIGZvciBpbnRlcm5hbCBuZWVkczpcbiAqXG4gKiAtIGBjaHVua1NpemVgIC0gc2l6ZSBvZiBnZW5lcmF0ZWQgZGF0YSBjaHVua3MgKDE2SyBieSBkZWZhdWx0KVxuICogLSBgcmF3YCAoQm9vbGVhbikgLSBkbyByYXcgaW5mbGF0ZVxuICogLSBgdG9gIChTdHJpbmcpIC0gaWYgZXF1YWwgdG8gJ3N0cmluZycsIHRoZW4gcmVzdWx0IHdpbGwgYmUgY29udmVydGVkXG4gKiAgIGZyb20gdXRmOCB0byB1dGYxNiAoamF2YXNjcmlwdCkgc3RyaW5nLiBXaGVuIHN0cmluZyBvdXRwdXQgcmVxdWVzdGVkLFxuICogICBjaHVuayBsZW5ndGggY2FuIGRpZmZlciBmcm9tIGBjaHVua1NpemVgLCBkZXBlbmRpbmcgb24gY29udGVudC5cbiAqXG4gKiBCeSBkZWZhdWx0LCB3aGVuIG5vIG9wdGlvbnMgc2V0LCBhdXRvZGV0ZWN0IGRlZmxhdGUvZ3ppcCBkYXRhIGZvcm1hdCB2aWFcbiAqIHdyYXBwZXIgaGVhZGVyLlxuICpcbiAqICMjIyMjIEV4YW1wbGU6XG4gKlxuICogYGBgamF2YXNjcmlwdFxuICogY29uc3QgcGFrbyA9IHJlcXVpcmUoJ3Bha28nKVxuICogY29uc3QgY2h1bmsxID0gbmV3IFVpbnQ4QXJyYXkoWzEsMiwzLDQsNSw2LDcsOCw5XSlcbiAqIGNvbnN0IGNodW5rMiA9IG5ldyBVaW50OEFycmF5KFsxMCwxMSwxMiwxMywxNCwxNSwxNiwxNywxOCwxOV0pO1xuICpcbiAqIGNvbnN0IGluZmxhdGUgPSBuZXcgcGFrby5JbmZsYXRlKHsgbGV2ZWw6IDN9KTtcbiAqXG4gKiBpbmZsYXRlLnB1c2goY2h1bmsxLCBmYWxzZSk7XG4gKiBpbmZsYXRlLnB1c2goY2h1bmsyLCB0cnVlKTsgIC8vIHRydWUgLT4gbGFzdCBjaHVua1xuICpcbiAqIGlmIChpbmZsYXRlLmVycikgeyB0aHJvdyBuZXcgRXJyb3IoaW5mbGF0ZS5lcnIpOyB9XG4gKlxuICogY29uc29sZS5sb2coaW5mbGF0ZS5yZXN1bHQpO1xuICogYGBgXG4gKiovXG5mdW5jdGlvbiBJbmZsYXRlJDEob3B0aW9ucykge1xuICB0aGlzLm9wdGlvbnMgPSBjb21tb24uYXNzaWduKHtcbiAgICBjaHVua1NpemU6IDEwMjQgKiA2NCxcbiAgICB3aW5kb3dCaXRzOiAxNSxcbiAgICB0bzogJydcbiAgfSwgb3B0aW9ucyB8fCB7fSk7XG5cbiAgY29uc3Qgb3B0ID0gdGhpcy5vcHRpb25zO1xuXG4gIC8vIEZvcmNlIHdpbmRvdyBzaXplIGZvciBgcmF3YCBkYXRhLCBpZiBub3Qgc2V0IGRpcmVjdGx5LFxuICAvLyBiZWNhdXNlIHdlIGhhdmUgbm8gaGVhZGVyIGZvciBhdXRvZGV0ZWN0LlxuICBpZiAob3B0LnJhdyAmJiAob3B0LndpbmRvd0JpdHMgPj0gMCkgJiYgKG9wdC53aW5kb3dCaXRzIDwgMTYpKSB7XG4gICAgb3B0LndpbmRvd0JpdHMgPSAtb3B0LndpbmRvd0JpdHM7XG4gICAgaWYgKG9wdC53aW5kb3dCaXRzID09PSAwKSB7IG9wdC53aW5kb3dCaXRzID0gLTE1OyB9XG4gIH1cblxuICAvLyBJZiBgd2luZG93Qml0c2Agbm90IGRlZmluZWQgKGFuZCBtb2RlIG5vdCByYXcpIC0gc2V0IGF1dG9kZXRlY3QgZmxhZyBmb3IgZ3ppcC9kZWZsYXRlXG4gIGlmICgob3B0LndpbmRvd0JpdHMgPj0gMCkgJiYgKG9wdC53aW5kb3dCaXRzIDwgMTYpICYmXG4gICAgICAhKG9wdGlvbnMgJiYgb3B0aW9ucy53aW5kb3dCaXRzKSkge1xuICAgIG9wdC53aW5kb3dCaXRzICs9IDMyO1xuICB9XG5cbiAgLy8gR3ppcCBoZWFkZXIgaGFzIG5vIGluZm8gYWJvdXQgd2luZG93cyBzaXplLCB3ZSBjYW4gZG8gYXV0b2RldGVjdCBvbmx5XG4gIC8vIGZvciBkZWZsYXRlLiBTbywgaWYgd2luZG93IHNpemUgbm90IHNldCwgZm9yY2UgaXQgdG8gbWF4IHdoZW4gZ3ppcCBwb3NzaWJsZVxuICBpZiAoKG9wdC53aW5kb3dCaXRzID4gMTUpICYmIChvcHQud2luZG93Qml0cyA8IDQ4KSkge1xuICAgIC8vIGJpdCAzICgxNikgLT4gZ3ppcHBlZCBkYXRhXG4gICAgLy8gYml0IDQgKDMyKSAtPiBhdXRvZGV0ZWN0IGd6aXAvZGVmbGF0ZVxuICAgIGlmICgob3B0LndpbmRvd0JpdHMgJiAxNSkgPT09IDApIHtcbiAgICAgIG9wdC53aW5kb3dCaXRzIHw9IDE1O1xuICAgIH1cbiAgfVxuXG4gIHRoaXMuZXJyICAgID0gMDsgICAgICAvLyBlcnJvciBjb2RlLCBpZiBoYXBwZW5zICgwID0gWl9PSylcbiAgdGhpcy5tc2cgICAgPSAnJzsgICAgIC8vIGVycm9yIG1lc3NhZ2VcbiAgdGhpcy5lbmRlZCAgPSBmYWxzZTsgIC8vIHVzZWQgdG8gYXZvaWQgbXVsdGlwbGUgb25FbmQoKSBjYWxsc1xuICB0aGlzLmNodW5rcyA9IFtdOyAgICAgLy8gY2h1bmtzIG9mIGNvbXByZXNzZWQgZGF0YVxuXG4gIHRoaXMuc3RybSAgID0gbmV3IHpzdHJlYW0oKTtcbiAgdGhpcy5zdHJtLmF2YWlsX291dCA9IDA7XG5cbiAgbGV0IHN0YXR1cyAgPSBpbmZsYXRlXzEkMi5pbmZsYXRlSW5pdDIoXG4gICAgdGhpcy5zdHJtLFxuICAgIG9wdC53aW5kb3dCaXRzXG4gICk7XG5cbiAgaWYgKHN0YXR1cyAhPT0gWl9PSykge1xuICAgIHRocm93IG5ldyBFcnJvcihtZXNzYWdlc1tzdGF0dXNdKTtcbiAgfVxuXG4gIHRoaXMuaGVhZGVyID0gbmV3IGd6aGVhZGVyKCk7XG5cbiAgaW5mbGF0ZV8xJDIuaW5mbGF0ZUdldEhlYWRlcih0aGlzLnN0cm0sIHRoaXMuaGVhZGVyKTtcblxuICAvLyBTZXR1cCBkaWN0aW9uYXJ5XG4gIGlmIChvcHQuZGljdGlvbmFyeSkge1xuICAgIC8vIENvbnZlcnQgZGF0YSBpZiBuZWVkZWRcbiAgICBpZiAodHlwZW9mIG9wdC5kaWN0aW9uYXJ5ID09PSAnc3RyaW5nJykge1xuICAgICAgb3B0LmRpY3Rpb25hcnkgPSBzdHJpbmdzLnN0cmluZzJidWYob3B0LmRpY3Rpb25hcnkpO1xuICAgIH0gZWxzZSBpZiAodG9TdHJpbmcuY2FsbChvcHQuZGljdGlvbmFyeSkgPT09ICdbb2JqZWN0IEFycmF5QnVmZmVyXScpIHtcbiAgICAgIG9wdC5kaWN0aW9uYXJ5ID0gbmV3IFVpbnQ4QXJyYXkob3B0LmRpY3Rpb25hcnkpO1xuICAgIH1cbiAgICBpZiAob3B0LnJhdykgeyAvL0luIHJhdyBtb2RlIHdlIG5lZWQgdG8gc2V0IHRoZSBkaWN0aW9uYXJ5IGVhcmx5XG4gICAgICBzdGF0dXMgPSBpbmZsYXRlXzEkMi5pbmZsYXRlU2V0RGljdGlvbmFyeSh0aGlzLnN0cm0sIG9wdC5kaWN0aW9uYXJ5KTtcbiAgICAgIGlmIChzdGF0dXMgIT09IFpfT0spIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKG1lc3NhZ2VzW3N0YXR1c10pO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIEluZmxhdGUjcHVzaChkYXRhWywgZmx1c2hfbW9kZV0pIC0+IEJvb2xlYW5cbiAqIC0gZGF0YSAoVWludDhBcnJheXxBcnJheUJ1ZmZlcik6IGlucHV0IGRhdGFcbiAqIC0gZmx1c2hfbW9kZSAoTnVtYmVyfEJvb2xlYW4pOiAwLi42IGZvciBjb3JyZXNwb25kaW5nIFpfTk9fRkxVU0guLlpfVFJFRVxuICogICBmbHVzaCBtb2Rlcy4gU2VlIGNvbnN0YW50cy4gU2tpcHBlZCBvciBgZmFsc2VgIG1lYW5zIFpfTk9fRkxVU0gsXG4gKiAgIGB0cnVlYCBtZWFucyBaX0ZJTklTSC5cbiAqXG4gKiBTZW5kcyBpbnB1dCBkYXRhIHRvIGluZmxhdGUgcGlwZSwgZ2VuZXJhdGluZyBbW0luZmxhdGUjb25EYXRhXV0gY2FsbHMgd2l0aFxuICogbmV3IG91dHB1dCBjaHVua3MuIFJldHVybnMgYHRydWVgIG9uIHN1Y2Nlc3MuIElmIGVuZCBvZiBzdHJlYW0gZGV0ZWN0ZWQsXG4gKiBbW0luZmxhdGUjb25FbmRdXSB3aWxsIGJlIGNhbGxlZC5cbiAqXG4gKiBgZmx1c2hfbW9kZWAgaXMgbm90IG5lZWRlZCBmb3Igbm9ybWFsIG9wZXJhdGlvbiwgYmVjYXVzZSBlbmQgb2Ygc3RyZWFtXG4gKiBkZXRlY3RlZCBhdXRvbWF0aWNhbGx5LiBZb3UgbWF5IHRyeSB0byB1c2UgaXQgZm9yIGFkdmFuY2VkIHRoaW5ncywgYnV0XG4gKiB0aGlzIGZ1bmN0aW9uYWxpdHkgd2FzIG5vdCB0ZXN0ZWQuXG4gKlxuICogT24gZmFpbCBjYWxsIFtbSW5mbGF0ZSNvbkVuZF1dIHdpdGggZXJyb3IgY29kZSBhbmQgcmV0dXJuIGZhbHNlLlxuICpcbiAqICMjIyMjIEV4YW1wbGVcbiAqXG4gKiBgYGBqYXZhc2NyaXB0XG4gKiBwdXNoKGNodW5rLCBmYWxzZSk7IC8vIHB1c2ggb25lIG9mIGRhdGEgY2h1bmtzXG4gKiAuLi5cbiAqIHB1c2goY2h1bmssIHRydWUpOyAgLy8gcHVzaCBsYXN0IGNodW5rXG4gKiBgYGBcbiAqKi9cbkluZmxhdGUkMS5wcm90b3R5cGUucHVzaCA9IGZ1bmN0aW9uIChkYXRhLCBmbHVzaF9tb2RlKSB7XG4gIGNvbnN0IHN0cm0gPSB0aGlzLnN0cm07XG4gIGNvbnN0IGNodW5rU2l6ZSA9IHRoaXMub3B0aW9ucy5jaHVua1NpemU7XG4gIGNvbnN0IGRpY3Rpb25hcnkgPSB0aGlzLm9wdGlvbnMuZGljdGlvbmFyeTtcbiAgbGV0IHN0YXR1cywgX2ZsdXNoX21vZGUsIGxhc3RfYXZhaWxfb3V0O1xuXG4gIGlmICh0aGlzLmVuZGVkKSByZXR1cm4gZmFsc2U7XG5cbiAgaWYgKGZsdXNoX21vZGUgPT09IH5+Zmx1c2hfbW9kZSkgX2ZsdXNoX21vZGUgPSBmbHVzaF9tb2RlO1xuICBlbHNlIF9mbHVzaF9tb2RlID0gZmx1c2hfbW9kZSA9PT0gdHJ1ZSA/IFpfRklOSVNIIDogWl9OT19GTFVTSDtcblxuICAvLyBDb252ZXJ0IGRhdGEgaWYgbmVlZGVkXG4gIGlmICh0b1N0cmluZy5jYWxsKGRhdGEpID09PSAnW29iamVjdCBBcnJheUJ1ZmZlcl0nKSB7XG4gICAgc3RybS5pbnB1dCA9IG5ldyBVaW50OEFycmF5KGRhdGEpO1xuICB9IGVsc2Uge1xuICAgIHN0cm0uaW5wdXQgPSBkYXRhO1xuICB9XG5cbiAgc3RybS5uZXh0X2luID0gMDtcbiAgc3RybS5hdmFpbF9pbiA9IHN0cm0uaW5wdXQubGVuZ3RoO1xuXG4gIGZvciAoOzspIHtcbiAgICBpZiAoc3RybS5hdmFpbF9vdXQgPT09IDApIHtcbiAgICAgIHN0cm0ub3V0cHV0ID0gbmV3IFVpbnQ4QXJyYXkoY2h1bmtTaXplKTtcbiAgICAgIHN0cm0ubmV4dF9vdXQgPSAwO1xuICAgICAgc3RybS5hdmFpbF9vdXQgPSBjaHVua1NpemU7XG4gICAgfVxuXG4gICAgc3RhdHVzID0gaW5mbGF0ZV8xJDIuaW5mbGF0ZShzdHJtLCBfZmx1c2hfbW9kZSk7XG5cbiAgICBpZiAoc3RhdHVzID09PSBaX05FRURfRElDVCAmJiBkaWN0aW9uYXJ5KSB7XG4gICAgICBzdGF0dXMgPSBpbmZsYXRlXzEkMi5pbmZsYXRlU2V0RGljdGlvbmFyeShzdHJtLCBkaWN0aW9uYXJ5KTtcblxuICAgICAgaWYgKHN0YXR1cyA9PT0gWl9PSykge1xuICAgICAgICBzdGF0dXMgPSBpbmZsYXRlXzEkMi5pbmZsYXRlKHN0cm0sIF9mbHVzaF9tb2RlKTtcbiAgICAgIH0gZWxzZSBpZiAoc3RhdHVzID09PSBaX0RBVEFfRVJST1IpIHtcbiAgICAgICAgLy8gUmVwbGFjZSBjb2RlIHdpdGggbW9yZSB2ZXJib3NlXG4gICAgICAgIHN0YXR1cyA9IFpfTkVFRF9ESUNUO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFNraXAgc255YyBtYXJrZXJzIGlmIG1vcmUgZGF0YSBmb2xsb3dzIGFuZCBub3QgcmF3IG1vZGVcbiAgICB3aGlsZSAoc3RybS5hdmFpbF9pbiA+IDAgJiZcbiAgICAgICAgICAgc3RhdHVzID09PSBaX1NUUkVBTV9FTkQgJiZcbiAgICAgICAgICAgc3RybS5zdGF0ZS53cmFwID4gMCAmJlxuICAgICAgICAgICBkYXRhW3N0cm0ubmV4dF9pbl0gIT09IDApXG4gICAge1xuICAgICAgaW5mbGF0ZV8xJDIuaW5mbGF0ZVJlc2V0KHN0cm0pO1xuICAgICAgc3RhdHVzID0gaW5mbGF0ZV8xJDIuaW5mbGF0ZShzdHJtLCBfZmx1c2hfbW9kZSk7XG4gICAgfVxuXG4gICAgc3dpdGNoIChzdGF0dXMpIHtcbiAgICAgIGNhc2UgWl9TVFJFQU1fRVJST1I6XG4gICAgICBjYXNlIFpfREFUQV9FUlJPUjpcbiAgICAgIGNhc2UgWl9ORUVEX0RJQ1Q6XG4gICAgICBjYXNlIFpfTUVNX0VSUk9SOlxuICAgICAgICB0aGlzLm9uRW5kKHN0YXR1cyk7XG4gICAgICAgIHRoaXMuZW5kZWQgPSB0cnVlO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gUmVtZW1iZXIgcmVhbCBgYXZhaWxfb3V0YCB2YWx1ZSwgYmVjYXVzZSB3ZSBtYXkgcGF0Y2ggb3V0IGJ1ZmZlciBjb250ZW50XG4gICAgLy8gdG8gYWxpZ24gdXRmOCBzdHJpbmdzIGJvdW5kYXJpZXMuXG4gICAgbGFzdF9hdmFpbF9vdXQgPSBzdHJtLmF2YWlsX291dDtcblxuICAgIGlmIChzdHJtLm5leHRfb3V0KSB7XG4gICAgICBpZiAoc3RybS5hdmFpbF9vdXQgPT09IDAgfHwgc3RhdHVzID09PSBaX1NUUkVBTV9FTkQpIHtcblxuICAgICAgICBpZiAodGhpcy5vcHRpb25zLnRvID09PSAnc3RyaW5nJykge1xuXG4gICAgICAgICAgbGV0IG5leHRfb3V0X3V0ZjggPSBzdHJpbmdzLnV0Zjhib3JkZXIoc3RybS5vdXRwdXQsIHN0cm0ubmV4dF9vdXQpO1xuXG4gICAgICAgICAgbGV0IHRhaWwgPSBzdHJtLm5leHRfb3V0IC0gbmV4dF9vdXRfdXRmODtcbiAgICAgICAgICBsZXQgdXRmOHN0ciA9IHN0cmluZ3MuYnVmMnN0cmluZyhzdHJtLm91dHB1dCwgbmV4dF9vdXRfdXRmOCk7XG5cbiAgICAgICAgICAvLyBtb3ZlIHRhaWwgJiByZWFsaWduIGNvdW50ZXJzXG4gICAgICAgICAgc3RybS5uZXh0X291dCA9IHRhaWw7XG4gICAgICAgICAgc3RybS5hdmFpbF9vdXQgPSBjaHVua1NpemUgLSB0YWlsO1xuICAgICAgICAgIGlmICh0YWlsKSBzdHJtLm91dHB1dC5zZXQoc3RybS5vdXRwdXQuc3ViYXJyYXkobmV4dF9vdXRfdXRmOCwgbmV4dF9vdXRfdXRmOCArIHRhaWwpLCAwKTtcblxuICAgICAgICAgIHRoaXMub25EYXRhKHV0ZjhzdHIpO1xuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5vbkRhdGEoc3RybS5vdXRwdXQubGVuZ3RoID09PSBzdHJtLm5leHRfb3V0ID8gc3RybS5vdXRwdXQgOiBzdHJtLm91dHB1dC5zdWJhcnJheSgwLCBzdHJtLm5leHRfb3V0KSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBNdXN0IHJlcGVhdCBpdGVyYXRpb24gaWYgb3V0IGJ1ZmZlciBpcyBmdWxsXG4gICAgaWYgKHN0YXR1cyA9PT0gWl9PSyAmJiBsYXN0X2F2YWlsX291dCA9PT0gMCkgY29udGludWU7XG5cbiAgICAvLyBGaW5hbGl6ZSBpZiBlbmQgb2Ygc3RyZWFtIHJlYWNoZWQuXG4gICAgaWYgKHN0YXR1cyA9PT0gWl9TVFJFQU1fRU5EKSB7XG4gICAgICBzdGF0dXMgPSBpbmZsYXRlXzEkMi5pbmZsYXRlRW5kKHRoaXMuc3RybSk7XG4gICAgICB0aGlzLm9uRW5kKHN0YXR1cyk7XG4gICAgICB0aGlzLmVuZGVkID0gdHJ1ZTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGlmIChzdHJtLmF2YWlsX2luID09PSAwKSBicmVhaztcbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufTtcblxuXG4vKipcbiAqIEluZmxhdGUjb25EYXRhKGNodW5rKSAtPiBWb2lkXG4gKiAtIGNodW5rIChVaW50OEFycmF5fFN0cmluZyk6IG91dHB1dCBkYXRhLiBXaGVuIHN0cmluZyBvdXRwdXQgcmVxdWVzdGVkLFxuICogICBlYWNoIGNodW5rIHdpbGwgYmUgc3RyaW5nLlxuICpcbiAqIEJ5IGRlZmF1bHQsIHN0b3JlcyBkYXRhIGJsb2NrcyBpbiBgY2h1bmtzW11gIHByb3BlcnR5IGFuZCBnbHVlXG4gKiB0aG9zZSBpbiBgb25FbmRgLiBPdmVycmlkZSB0aGlzIGhhbmRsZXIsIGlmIHlvdSBuZWVkIGFub3RoZXIgYmVoYXZpb3VyLlxuICoqL1xuSW5mbGF0ZSQxLnByb3RvdHlwZS5vbkRhdGEgPSBmdW5jdGlvbiAoY2h1bmspIHtcbiAgdGhpcy5jaHVua3MucHVzaChjaHVuayk7XG59O1xuXG5cbi8qKlxuICogSW5mbGF0ZSNvbkVuZChzdGF0dXMpIC0+IFZvaWRcbiAqIC0gc3RhdHVzIChOdW1iZXIpOiBpbmZsYXRlIHN0YXR1cy4gMCAoWl9PSykgb24gc3VjY2VzcyxcbiAqICAgb3RoZXIgaWYgbm90LlxuICpcbiAqIENhbGxlZCBlaXRoZXIgYWZ0ZXIgeW91IHRlbGwgaW5mbGF0ZSB0aGF0IHRoZSBpbnB1dCBzdHJlYW0gaXNcbiAqIGNvbXBsZXRlIChaX0ZJTklTSCkuIEJ5IGRlZmF1bHQgLSBqb2luIGNvbGxlY3RlZCBjaHVua3MsXG4gKiBmcmVlIG1lbW9yeSBhbmQgZmlsbCBgcmVzdWx0c2AgLyBgZXJyYCBwcm9wZXJ0aWVzLlxuICoqL1xuSW5mbGF0ZSQxLnByb3RvdHlwZS5vbkVuZCA9IGZ1bmN0aW9uIChzdGF0dXMpIHtcbiAgLy8gT24gc3VjY2VzcyAtIGpvaW5cbiAgaWYgKHN0YXR1cyA9PT0gWl9PSykge1xuICAgIGlmICh0aGlzLm9wdGlvbnMudG8gPT09ICdzdHJpbmcnKSB7XG4gICAgICB0aGlzLnJlc3VsdCA9IHRoaXMuY2h1bmtzLmpvaW4oJycpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnJlc3VsdCA9IGNvbW1vbi5mbGF0dGVuQ2h1bmtzKHRoaXMuY2h1bmtzKTtcbiAgICB9XG4gIH1cbiAgdGhpcy5jaHVua3MgPSBbXTtcbiAgdGhpcy5lcnIgPSBzdGF0dXM7XG4gIHRoaXMubXNnID0gdGhpcy5zdHJtLm1zZztcbn07XG5cblxuLyoqXG4gKiBpbmZsYXRlKGRhdGFbLCBvcHRpb25zXSkgLT4gVWludDhBcnJheXxTdHJpbmdcbiAqIC0gZGF0YSAoVWludDhBcnJheXxBcnJheUJ1ZmZlcik6IGlucHV0IGRhdGEgdG8gZGVjb21wcmVzcy5cbiAqIC0gb3B0aW9ucyAoT2JqZWN0KTogemxpYiBpbmZsYXRlIG9wdGlvbnMuXG4gKlxuICogRGVjb21wcmVzcyBgZGF0YWAgd2l0aCBpbmZsYXRlL3VuZ3ppcCBhbmQgYG9wdGlvbnNgLiBBdXRvZGV0ZWN0XG4gKiBmb3JtYXQgdmlhIHdyYXBwZXIgaGVhZGVyIGJ5IGRlZmF1bHQuIFRoYXQncyB3aHkgd2UgZG9uJ3QgcHJvdmlkZVxuICogc2VwYXJhdGUgYHVuZ3ppcGAgbWV0aG9kLlxuICpcbiAqIFN1cHBvcnRlZCBvcHRpb25zIGFyZTpcbiAqXG4gKiAtIHdpbmRvd0JpdHNcbiAqXG4gKiBbaHR0cDovL3psaWIubmV0L21hbnVhbC5odG1sI0FkdmFuY2VkXShodHRwOi8vemxpYi5uZXQvbWFudWFsLmh0bWwjQWR2YW5jZWQpXG4gKiBmb3IgbW9yZSBpbmZvcm1hdGlvbi5cbiAqXG4gKiBTdWdhciAob3B0aW9ucyk6XG4gKlxuICogLSBgcmF3YCAoQm9vbGVhbikgLSBzYXkgdGhhdCB3ZSB3b3JrIHdpdGggcmF3IHN0cmVhbSwgaWYgeW91IGRvbid0IHdpc2ggdG8gc3BlY2lmeVxuICogICBuZWdhdGl2ZSB3aW5kb3dCaXRzIGltcGxpY2l0bHkuXG4gKiAtIGB0b2AgKFN0cmluZykgLSBpZiBlcXVhbCB0byAnc3RyaW5nJywgdGhlbiByZXN1bHQgd2lsbCBiZSBjb252ZXJ0ZWRcbiAqICAgZnJvbSB1dGY4IHRvIHV0ZjE2IChqYXZhc2NyaXB0KSBzdHJpbmcuIFdoZW4gc3RyaW5nIG91dHB1dCByZXF1ZXN0ZWQsXG4gKiAgIGNodW5rIGxlbmd0aCBjYW4gZGlmZmVyIGZyb20gYGNodW5rU2l6ZWAsIGRlcGVuZGluZyBvbiBjb250ZW50LlxuICpcbiAqXG4gKiAjIyMjIyBFeGFtcGxlOlxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqIGNvbnN0IHBha28gPSByZXF1aXJlKCdwYWtvJyk7XG4gKiBjb25zdCBpbnB1dCA9IHBha28uZGVmbGF0ZShuZXcgVWludDhBcnJheShbMSwyLDMsNCw1LDYsNyw4LDldKSk7XG4gKiBsZXQgb3V0cHV0O1xuICpcbiAqIHRyeSB7XG4gKiAgIG91dHB1dCA9IHBha28uaW5mbGF0ZShpbnB1dCk7XG4gKiB9IGNhdGNoIChlcnIpIHtcbiAqICAgY29uc29sZS5sb2coZXJyKTtcbiAqIH1cbiAqIGBgYFxuICoqL1xuZnVuY3Rpb24gaW5mbGF0ZSQxKGlucHV0LCBvcHRpb25zKSB7XG4gIGNvbnN0IGluZmxhdG9yID0gbmV3IEluZmxhdGUkMShvcHRpb25zKTtcblxuICBpbmZsYXRvci5wdXNoKGlucHV0KTtcblxuICAvLyBUaGF0IHdpbGwgbmV2ZXIgaGFwcGVucywgaWYgeW91IGRvbid0IGNoZWF0IHdpdGggb3B0aW9ucyA6KVxuICBpZiAoaW5mbGF0b3IuZXJyKSB0aHJvdyBpbmZsYXRvci5tc2cgfHwgbWVzc2FnZXNbaW5mbGF0b3IuZXJyXTtcblxuICByZXR1cm4gaW5mbGF0b3IucmVzdWx0O1xufVxuXG5cbi8qKlxuICogaW5mbGF0ZVJhdyhkYXRhWywgb3B0aW9uc10pIC0+IFVpbnQ4QXJyYXl8U3RyaW5nXG4gKiAtIGRhdGEgKFVpbnQ4QXJyYXl8QXJyYXlCdWZmZXIpOiBpbnB1dCBkYXRhIHRvIGRlY29tcHJlc3MuXG4gKiAtIG9wdGlvbnMgKE9iamVjdCk6IHpsaWIgaW5mbGF0ZSBvcHRpb25zLlxuICpcbiAqIFRoZSBzYW1lIGFzIFtbaW5mbGF0ZV1dLCBidXQgY3JlYXRlcyByYXcgZGF0YSwgd2l0aG91dCB3cmFwcGVyXG4gKiAoaGVhZGVyIGFuZCBhZGxlcjMyIGNyYykuXG4gKiovXG5mdW5jdGlvbiBpbmZsYXRlUmF3JDEoaW5wdXQsIG9wdGlvbnMpIHtcbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gIG9wdGlvbnMucmF3ID0gdHJ1ZTtcbiAgcmV0dXJuIGluZmxhdGUkMShpbnB1dCwgb3B0aW9ucyk7XG59XG5cblxuLyoqXG4gKiB1bmd6aXAoZGF0YVssIG9wdGlvbnNdKSAtPiBVaW50OEFycmF5fFN0cmluZ1xuICogLSBkYXRhIChVaW50OEFycmF5fEFycmF5QnVmZmVyKTogaW5wdXQgZGF0YSB0byBkZWNvbXByZXNzLlxuICogLSBvcHRpb25zIChPYmplY3QpOiB6bGliIGluZmxhdGUgb3B0aW9ucy5cbiAqXG4gKiBKdXN0IHNob3J0Y3V0IHRvIFtbaW5mbGF0ZV1dLCBiZWNhdXNlIGl0IGF1dG9kZXRlY3RzIGZvcm1hdFxuICogYnkgaGVhZGVyLmNvbnRlbnQuIERvbmUgZm9yIGNvbnZlbmllbmNlLlxuICoqL1xuXG5cbnZhciBJbmZsYXRlXzEkMSA9IEluZmxhdGUkMTtcbnZhciBpbmZsYXRlXzIgPSBpbmZsYXRlJDE7XG52YXIgaW5mbGF0ZVJhd18xJDEgPSBpbmZsYXRlUmF3JDE7XG52YXIgdW5nemlwJDEgPSBpbmZsYXRlJDE7XG52YXIgY29uc3RhbnRzID0gY29uc3RhbnRzJDI7XG5cbnZhciBpbmZsYXRlXzEkMSA9IHtcblx0SW5mbGF0ZTogSW5mbGF0ZV8xJDEsXG5cdGluZmxhdGU6IGluZmxhdGVfMixcblx0aW5mbGF0ZVJhdzogaW5mbGF0ZVJhd18xJDEsXG5cdHVuZ3ppcDogdW5nemlwJDEsXG5cdGNvbnN0YW50czogY29uc3RhbnRzXG59O1xuXG5jb25zdCB7IERlZmxhdGUsIGRlZmxhdGUsIGRlZmxhdGVSYXcsIGd6aXAgfSA9IGRlZmxhdGVfMSQxO1xuXG5jb25zdCB7IEluZmxhdGUsIGluZmxhdGUsIGluZmxhdGVSYXcsIHVuZ3ppcCB9ID0gaW5mbGF0ZV8xJDE7XG5cblxuXG52YXIgRGVmbGF0ZV8xID0gRGVmbGF0ZTtcbnZhciBkZWZsYXRlXzEgPSBkZWZsYXRlO1xudmFyIGRlZmxhdGVSYXdfMSA9IGRlZmxhdGVSYXc7XG52YXIgZ3ppcF8xID0gZ3ppcDtcbnZhciBJbmZsYXRlXzEgPSBJbmZsYXRlO1xudmFyIGluZmxhdGVfMSA9IGluZmxhdGU7XG52YXIgaW5mbGF0ZVJhd18xID0gaW5mbGF0ZVJhdztcbnZhciB1bmd6aXBfMSA9IHVuZ3ppcDtcbnZhciBjb25zdGFudHNfMSA9IGNvbnN0YW50cyQyO1xuXG52YXIgcGFrbyA9IHtcblx0RGVmbGF0ZTogRGVmbGF0ZV8xLFxuXHRkZWZsYXRlOiBkZWZsYXRlXzEsXG5cdGRlZmxhdGVSYXc6IGRlZmxhdGVSYXdfMSxcblx0Z3ppcDogZ3ppcF8xLFxuXHRJbmZsYXRlOiBJbmZsYXRlXzEsXG5cdGluZmxhdGU6IGluZmxhdGVfMSxcblx0aW5mbGF0ZVJhdzogaW5mbGF0ZVJhd18xLFxuXHR1bmd6aXA6IHVuZ3ppcF8xLFxuXHRjb25zdGFudHM6IGNvbnN0YW50c18xXG59O1xuXG5leHBvcnQgeyBEZWZsYXRlXzEgYXMgRGVmbGF0ZSwgSW5mbGF0ZV8xIGFzIEluZmxhdGUsIGNvbnN0YW50c18xIGFzIGNvbnN0YW50cywgcGFrbyBhcyBkZWZhdWx0LCBkZWZsYXRlXzEgYXMgZGVmbGF0ZSwgZGVmbGF0ZVJhd18xIGFzIGRlZmxhdGVSYXcsIGd6aXBfMSBhcyBnemlwLCBpbmZsYXRlXzEgYXMgaW5mbGF0ZSwgaW5mbGF0ZVJhd18xIGFzIGluZmxhdGVSYXcsIHVuZ3ppcF8xIGFzIHVuZ3ppcCB9O1xuIiwKICAgICJpbXBvcnQgcGFrbyBmcm9tICdwYWtvJztcbmltcG9ydCB7IFVpbnQzMlRvSGV4IH0gZnJvbSAnLi9lcmljY2hhc2UvQWxnb3JpdGhtL0FycmF5L1VpbnQzMkFycmF5LmpzJztcbmltcG9ydCB7IFU4Q29uY2F0LCBVOEZyb21TdHJpbmcsIFU4RnJvbVVpbnQzMiwgVThUYWtlIH0gZnJvbSAnLi9lcmljY2hhc2UvQWxnb3JpdGhtL0FycmF5L1VpbnQ4QXJyYXkuanMnO1xuaW1wb3J0IHsgQ1JDIH0gZnJvbSAnLi9lcmljY2hhc2UvQWxnb3JpdGhtL01hdGgvQ1JDLmpzJztcbmltcG9ydCB7IENvbnNvbGVFcnJvciB9IGZyb20gJy4vZXJpY2NoYXNlL1V0aWxpdHkvQ29uc29sZS5qcyc7XG5cbmV4cG9ydCBjbGFzcyBDaHVuayB7XG4gIHJlYWRvbmx5IGNyYzogVWludDhBcnJheTtcbiAgcmVhZG9ubHkgZGF0YTogVWludDhBcnJheTtcbiAgcmVhZG9ubHkgc2l6ZTogbnVtYmVyO1xuICByZWFkb25seSB0eXBlOiBVaW50OEFycmF5O1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgcmVhZG9ubHkgYnl0ZXM6IFVpbnQ4QXJyYXkpIHtcbiAgICBjb25zdCB7IGNyYywgZGF0YSwgc2l6ZSwgdHlwZSB9ID0gYW5hbHl6ZUNodW5rKGJ5dGVzKTtcbiAgICB0aGlzLmNyYyA9IGNyYztcbiAgICB0aGlzLmRhdGEgPSBkYXRhO1xuICAgIHRoaXMuc2l6ZSA9IHNpemU7XG4gICAgdGhpcy50eXBlID0gdHlwZTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gYW5hbHl6ZUNodW5rKGJ5dGVzOiBVaW50OEFycmF5KSB7XG4gIGNvbnN0IHNpemUgPSBuZXcgRGF0YVZpZXcoYnl0ZXMuYnVmZmVyKS5nZXRJbnQzMigwKTtcbiAgY29uc3QgdHlwZSA9IGJ5dGVzLnNsaWNlKDQsIDgpO1xuICBjb25zdCBbXywgcmVzdF0gPSBVOFRha2UoYnl0ZXMsIDgpO1xuICBjb25zdCBbZGF0YSwgY3JjXSA9IFU4VGFrZShyZXN0LCBzaXplKTtcbiAgcmV0dXJuIHsgZGF0YSwgc2l6ZSwgdHlwZSwgY3JjIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21wcmVzc0ltYWdlRGF0YShkYXRhOiBVaW50OEFycmF5KSB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIHBha28uZGVmbGF0ZShkYXRhKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBDb25zb2xlRXJyb3IoJ0Vycm9yIGNvbXByZXNzaW5nIElEQVQgZGF0YTonLCBlcnJvcik7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlSURBVGNodW5rKGRhdGE6IFVpbnQ4QXJyYXkpIHtcbiAgY29uc3Qgc2l6ZSA9IFU4RnJvbVVpbnQzMihkYXRhLmJ5dGVMZW5ndGgpO1xuICBjb25zdCB0eXBlID0gVThGcm9tU3RyaW5nKCdJREFUJyk7XG4gIGNvbnN0IGNyYyA9IFU4RnJvbVVpbnQzMihnZXRDaHVua0NSQyh0eXBlLCBkYXRhKSk7XG4gIHJldHVybiBVOENvbmNhdChbc2l6ZSwgdHlwZSwgZGF0YSwgY3JjXSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVJSERSY2h1bmsoeyB3aWR0aCwgaGVpZ2h0LCBiaXREZXB0aCwgY29sb3JUeXBlLCBjb21wcmVzc2lvbk1ldGhvZCA9IDAsIGZpbHRlck1ldGhvZCA9IDAsIGludGVybGFjZU1ldGhvZCA9IDAgfTogeyB3aWR0aDogbnVtYmVyOyBoZWlnaHQ6IG51bWJlcjsgYml0RGVwdGg6IG51bWJlcjsgY29sb3JUeXBlOiBudW1iZXI7IGNvbXByZXNzaW9uTWV0aG9kPzogbnVtYmVyOyBmaWx0ZXJNZXRob2Q/OiBudW1iZXI7IGludGVybGFjZU1ldGhvZD86IG51bWJlciB9KSB7XG4gIC8vIFZhbGlkYXRlIGlucHV0IHZhbHVlc1xuICBpZiAoYml0RGVwdGggIT09IDEgJiYgYml0RGVwdGggIT09IDIgJiYgYml0RGVwdGggIT09IDQgJiYgYml0RGVwdGggIT09IDggJiYgYml0RGVwdGggIT09IDE2KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGJpdCBkZXB0aC4gTXVzdCBiZSBvbmUgb2YgMSwgMiwgNCwgOCwgb3IgMTYuJyk7XG4gIH1cbiAgaWYgKCFbMCwgMiwgMywgNCwgNl0uaW5jbHVkZXMoY29sb3JUeXBlKSkge1xuICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBjb2xvciB0eXBlLiBNdXN0IGJlIG9uZSBvZiAwLCAyLCAzLCA0LCBvciA2LicpO1xuICB9XG4gIGlmIChjb21wcmVzc2lvbk1ldGhvZCAhPT0gMCkge1xuICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBjb21wcmVzc2lvbiBtZXRob2QuIE9ubHkgbWV0aG9kIDAgaXMgc3VwcG9ydGVkLicpO1xuICB9XG4gIGlmIChmaWx0ZXJNZXRob2QgIT09IDApIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgZmlsdGVyIG1ldGhvZC4gT25seSBtZXRob2QgMCBpcyBzdXBwb3J0ZWQuJyk7XG4gIH1cbiAgaWYgKGludGVybGFjZU1ldGhvZCAhPT0gMCAmJiBpbnRlcmxhY2VNZXRob2QgIT09IDEpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgaW50ZXJsYWNlIG1ldGhvZC4gTXVzdCBiZSBlaXRoZXIgMCAobm8gaW50ZXJsYWNlKSBvciAxIChBZGFtNykuJyk7XG4gIH1cblxuICAvLyBDcmVhdGUgdGhlIElIRFIgZGF0YSBhcnJheVxuICBjb25zdCBpaGRyRGF0YSA9IG5ldyBVaW50OEFycmF5KDEzKTtcblxuICAvLyBXcml0ZSB3aWR0aCAoNCBieXRlcywgYmlnLWVuZGlhbilcbiAgaWhkckRhdGFbMF0gPSAod2lkdGggPj4gMjQpICYgMHhmZjtcbiAgaWhkckRhdGFbMV0gPSAod2lkdGggPj4gMTYpICYgMHhmZjtcbiAgaWhkckRhdGFbMl0gPSAod2lkdGggPj4gOCkgJiAweGZmO1xuICBpaGRyRGF0YVszXSA9IHdpZHRoICYgMHhmZjtcblxuICAvLyBXcml0ZSBoZWlnaHQgKDQgYnl0ZXMsIGJpZy1lbmRpYW4pXG4gIGloZHJEYXRhWzRdID0gKGhlaWdodCA+PiAyNCkgJiAweGZmO1xuICBpaGRyRGF0YVs1XSA9IChoZWlnaHQgPj4gMTYpICYgMHhmZjtcbiAgaWhkckRhdGFbNl0gPSAoaGVpZ2h0ID4+IDgpICYgMHhmZjtcbiAgaWhkckRhdGFbN10gPSBoZWlnaHQgJiAweGZmO1xuXG4gIC8vIFdyaXRlIGJpdCBkZXB0aCAoMSBieXRlKVxuICBpaGRyRGF0YVs4XSA9IGJpdERlcHRoO1xuXG4gIC8vIFdyaXRlIGNvbG9yIHR5cGUgKDEgYnl0ZSlcbiAgaWhkckRhdGFbOV0gPSBjb2xvclR5cGU7XG5cbiAgLy8gV3JpdGUgY29tcHJlc3Npb24gbWV0aG9kICgxIGJ5dGUsIG11c3QgYmUgMClcbiAgaWhkckRhdGFbMTBdID0gY29tcHJlc3Npb25NZXRob2Q7XG5cbiAgLy8gV3JpdGUgZmlsdGVyIG1ldGhvZCAoMSBieXRlLCBtdXN0IGJlIDApXG4gIGloZHJEYXRhWzExXSA9IGZpbHRlck1ldGhvZDtcblxuICAvLyBXcml0ZSBpbnRlcmxhY2UgbWV0aG9kICgxIGJ5dGUsIGVpdGhlciAwIG9yIDEpXG4gIGloZHJEYXRhWzEyXSA9IGludGVybGFjZU1ldGhvZDtcblxuICAvLyBDcmVhdGUgdGhlIElIRFIgY2h1bmtcbiAgY29uc3QgaWhkckxlbmd0aCA9IGloZHJEYXRhLmxlbmd0aDtcbiAgY29uc3QgaWhkclR5cGUgPSBuZXcgVGV4dEVuY29kZXIoKS5lbmNvZGUoJ0lIRFInKTtcbiAgY29uc3QgaWhkckNodW5rID0gbmV3IFVpbnQ4QXJyYXkoOCArIGloZHJMZW5ndGggKyA0KTsgLy8gTGVuZ3RoLCBUeXBlLCBEYXRhLCBDUkNcblxuICAvLyBXcml0ZSBsZW5ndGggb2YgSUhEUiBkYXRhICg0IGJ5dGVzLCBiaWctZW5kaWFuKVxuICBpaGRyQ2h1bmtbMF0gPSAoaWhkckxlbmd0aCA+PiAyNCkgJiAweGZmO1xuICBpaGRyQ2h1bmtbMV0gPSAoaWhkckxlbmd0aCA+PiAxNikgJiAweGZmO1xuICBpaGRyQ2h1bmtbMl0gPSAoaWhkckxlbmd0aCA+PiA4KSAmIDB4ZmY7XG4gIGloZHJDaHVua1szXSA9IGloZHJMZW5ndGggJiAweGZmO1xuXG4gIC8vIFdyaXRlIFwiSUhEUlwiIHR5cGUgKDQgYnl0ZXMpXG4gIGloZHJDaHVuay5zZXQoaWhkclR5cGUsIDQpO1xuXG4gIC8vIFdyaXRlIElIRFIgZGF0YSAoMTMgYnl0ZXMpXG4gIGloZHJDaHVuay5zZXQoaWhkckRhdGEsIDgpO1xuXG4gIC8vIENhbGN1bGF0ZSBDUkMgZm9yIElIRFIgY2h1bmsgdHlwZSBhbmQgZGF0YVxuICBjb25zdCBjcmMgPSBnZXRDaHVua0NSQyhpaGRyVHlwZSwgaWhkckRhdGEpOyAvLyBVc2UgeW91ciBDUkMgY2FsY3VsYXRpb24gZnVuY3Rpb25cbiAgaWhkckNodW5rLnNldChuZXcgVWludDhBcnJheShbKGNyYyA+PiAyNCkgJiAweGZmLCAoY3JjID4+IDE2KSAmIDB4ZmYsIChjcmMgPj4gOCkgJiAweGZmLCBjcmMgJiAweGZmXSksIDggKyBpaGRyTGVuZ3RoKTtcblxuICByZXR1cm4gaWhkckNodW5rO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVjb21wcmVzc0ltYWdlRGF0YShkYXRhOiBVaW50OEFycmF5KSB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIHBha28uaW5mbGF0ZShkYXRhKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBDb25zb2xlRXJyb3IoJ0Vycm9yIGRlY29tcHJlc3NpbmcgSURBVCBkYXRhOicsIGVycm9yKTtcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBleHRyYWN0Q2h1bmsoYnl0ZXM6IFVpbnQ4QXJyYXkpIHtcbiAgY29uc3Qgc2l6ZSA9IG5ldyBEYXRhVmlldyhieXRlcy5idWZmZXIpLmdldEludDMyKDApO1xuICByZXR1cm4gVThUYWtlKGJ5dGVzLCA4ICsgc2l6ZSArIDQpOyAvLyBzaXplLHR5cGUsZGF0YSxjcmNcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGV4dHJhY3RDaHVua3MoYnl0ZXM6IFVpbnQ4QXJyYXkpIHtcbiAgbGV0IFtjaHVuaywgcmVzdF0gPSBleHRyYWN0Q2h1bmsoYnl0ZXMpO1xuICBjb25zdCBjaHVua3MgPSBbY2h1bmtdO1xuICB3aGlsZSAocmVzdC5ieXRlTGVuZ3RoID4gMCkge1xuICAgIFtjaHVuaywgcmVzdF0gPSBleHRyYWN0Q2h1bmsocmVzdCk7XG4gICAgY2h1bmtzLnB1c2goY2h1bmspO1xuICB9XG4gIHJldHVybiBjaHVua3M7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRDaHVua0NSQyh0eXBlX2J5dGVzOiBVaW50OEFycmF5LCBkYXRhX2J5dGVzOiBVaW50OEFycmF5KSB7XG4gIHJldHVybiBDUkMuSW5pdChVOENvbmNhdChbdHlwZV9ieXRlcywgZGF0YV9ieXRlc10pKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldENodW5rQ1JDSGV4KHR5cGVfYnl0ZXM6IFVpbnQ4QXJyYXksIGRhdGFfYnl0ZXM6IFVpbnQ4QXJyYXkpIHtcbiAgcmV0dXJuIFVpbnQzMlRvSGV4KENSQy5Jbml0KFU4Q29uY2F0KFt0eXBlX2J5dGVzLCBkYXRhX2J5dGVzXSkpKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFNjYW5saW5lU2l6ZSh7IHdpZHRoLCBiaXREZXB0aCwgY29sb3JUeXBlIH06IHsgd2lkdGg6IG51bWJlcjsgYml0RGVwdGg6IG51bWJlcjsgY29sb3JUeXBlOiBudW1iZXIgfSkge1xuICAvLyBDYWxjdWxhdGUgYnl0ZXMgcGVyIHBpeGVsIGJhc2VkIG9uIGNvbG9yIHR5cGUgYW5kIGJpdCBkZXB0aFxuICBsZXQgc2FtcGxlc1BlclBpeGVsOiBudW1iZXI7XG4gIHN3aXRjaCAoY29sb3JUeXBlKSB7XG4gICAgY2FzZSAwOiAvLyBHcmF5c2NhbGVcbiAgICAgIHNhbXBsZXNQZXJQaXhlbCA9IDE7XG4gICAgICBicmVhaztcbiAgICBjYXNlIDI6IC8vIFRydWVjb2xvciAoUkdCKVxuICAgICAgc2FtcGxlc1BlclBpeGVsID0gMztcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgMzogLy8gSW5kZXhlZC1jb2xvciAocGFsZXR0ZSlcbiAgICAgIHNhbXBsZXNQZXJQaXhlbCA9IDE7IC8vIFVzZXMgYSBwYWxldHRlLCBzbyBvbmx5IDEgYnl0ZSBwZXIgcGl4ZWwgaW5kZXhcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgNDogLy8gR3JheXNjYWxlIHdpdGggYWxwaGFcbiAgICAgIHNhbXBsZXNQZXJQaXhlbCA9IDI7XG4gICAgICBicmVhaztcbiAgICBjYXNlIDY6IC8vIFRydWVjb2xvciB3aXRoIGFscGhhIChSR0JBKVxuICAgICAgc2FtcGxlc1BlclBpeGVsID0gNDtcbiAgICAgIGJyZWFrO1xuICAgIGRlZmF1bHQ6XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gY29sb3IgdHlwZS4nKTtcbiAgfVxuXG4gIC8vIENhbGN1bGF0ZSBieXRlcyBwZXIgcGl4ZWxcbiAgY29uc3QgYnl0ZXNQZXJQaXhlbCA9IChiaXREZXB0aCAqIHNhbXBsZXNQZXJQaXhlbCkgLyA4O1xuICBjb25zdCBzY2FubGluZVNpemUgPSAxICsgd2lkdGggKiBieXRlc1BlclBpeGVsO1xuXG4gIHJldHVybiBzY2FubGluZVNpemU7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUlIRFJDaHVuayhJSERSOiBDaHVuaykge1xuICBjb25zdCBkYXRhID0gSUhEUi5kYXRhO1xuXG4gIGlmIChkYXRhLmxlbmd0aCAhPT0gMTMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgSUhEUiBjaHVuayBsZW5ndGguIEV4cGVjdGVkIDEzIGJ5dGVzLicpO1xuICB9XG5cbiAgLy8gRXh0cmFjdCB3aWR0aCAoNCBieXRlcylcbiAgY29uc3Qgd2lkdGggPSAoZGF0YVswXSA8PCAyNCkgfCAoZGF0YVsxXSA8PCAxNikgfCAoZGF0YVsyXSA8PCA4KSB8IGRhdGFbM107XG5cbiAgLy8gRXh0cmFjdCBoZWlnaHQgKDQgYnl0ZXMpXG4gIGNvbnN0IGhlaWdodCA9IChkYXRhWzRdIDw8IDI0KSB8IChkYXRhWzVdIDw8IDE2KSB8IChkYXRhWzZdIDw8IDgpIHwgZGF0YVs3XTtcblxuICAvLyBFeHRyYWN0IGJpdCBkZXB0aCAoMSBieXRlKVxuICBjb25zdCBiaXREZXB0aCA9IGRhdGFbOF07XG5cbiAgLy8gRXh0cmFjdCBjb2xvciB0eXBlICgxIGJ5dGUpXG4gIGNvbnN0IGNvbG9yVHlwZSA9IGRhdGFbOV07XG5cbiAgLy8gRXh0cmFjdCBjb21wcmVzc2lvbiBtZXRob2QgKDEgYnl0ZSlcbiAgY29uc3QgY29tcHJlc3Npb25NZXRob2QgPSBkYXRhWzEwXTtcblxuICAvLyBFeHRyYWN0IGZpbHRlciBtZXRob2QgKDEgYnl0ZSlcbiAgY29uc3QgZmlsdGVyTWV0aG9kID0gZGF0YVsxMV07XG5cbiAgLy8gRXh0cmFjdCBpbnRlcmxhY2UgbWV0aG9kICgxIGJ5dGUpXG4gIGNvbnN0IGludGVybGFjZU1ldGhvZCA9IGRhdGFbMTJdO1xuXG4gIHJldHVybiB7XG4gICAgYml0RGVwdGgsXG4gICAgY29sb3JUeXBlLFxuICAgIGNvbXByZXNzaW9uTWV0aG9kLFxuICAgIGZpbHRlck1ldGhvZCxcbiAgICBoZWlnaHQsXG4gICAgaW50ZXJsYWNlTWV0aG9kLFxuICAgIHdpZHRoLFxuICB9O1xufVxuIiwKICAgICJpbXBvcnQgeyBVOENvbmNhdCwgVThGcm9tVWludDMyLCBVOFNwbGl0LCBVOFRha2UsIFU4VG9BU0NJSSwgVThUb0hleCB9IGZyb20gJy4vZXJpY2NoYXNlL0FsZ29yaXRobS9BcnJheS9VaW50OEFycmF5LmpzJztcbmltcG9ydCB7IENSQyB9IGZyb20gJy4vZXJpY2NoYXNlL0FsZ29yaXRobS9NYXRoL0NSQy5qcyc7XG5pbXBvcnQgeyBDaHVuaywgYW5hbHl6ZUNodW5rLCBkZWNvbXByZXNzSW1hZ2VEYXRhLCBleHRyYWN0Q2h1bmtzLCBnZXRTY2FubGluZVNpemUsIHBhcnNlSUhEUkNodW5rIH0gZnJvbSAnLi9wbmcuanMnO1xuXG4vLyBjb25zdCBbLCAsIHBhdGhdID0gQnVuLmFyZ3Y7XG4vLyBjb25zdCBidWZmZXIgPSBhd2FpdCBCdW4uZmlsZShwYXRoKS5ieXRlcygpO1xuXG5leHBvcnQgZnVuY3Rpb24gUE5HSW5zcGVjdChwbmdfYnVmZmVyOiBVaW50OEFycmF5LCBvdXRwdXQ6IChkYXRhPzogYW55W10pID0+IHZvaWQpIHtcbiAgY29uc3QgW2NodW5rU2lnbmF0dXJlLCByZXN0XSA9IFU4VGFrZShwbmdfYnVmZmVyLCA4KTtcbiAgY29uc3QgY2h1bmtzID0gZXh0cmFjdENodW5rcyhyZXN0KTtcblxuICBvdXRwdXQoWydTaWduYXR1cmUnXSk7XG4gIG91dHB1dChbLi4uVThUb0hleChjaHVua1NpZ25hdHVyZSldKTtcbiAgb3V0cHV0KCk7XG5cbiAgbGV0IGlkYXRfZGF0YXM6IFVpbnQ4QXJyYXlbXSA9IFtdO1xuICBsZXQgdG90YWxfaWRhdF9zaXplID0gMDtcbiAgbGV0IElIRFI6IENodW5rIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG4gIGZvciAoY29uc3QgY2h1bmsgb2YgY2h1bmtzKSB7XG4gICAgY29uc3QgeyBkYXRhLCBzaXplLCB0eXBlLCBjcmMgfSA9IGFuYWx5emVDaHVuayhjaHVuayk7XG4gICAgaWYgKFU4VG9BU0NJSSh0eXBlKSA9PT0gJ0lEQVQnKSB7XG4gICAgICBpZGF0X2RhdGFzLnB1c2goZGF0YSk7XG4gICAgICB0b3RhbF9pZGF0X3NpemUgKz0gc2l6ZTtcbiAgICB9XG4gICAgb3V0cHV0KFsnQ2h1bmsnXSk7XG4gICAgaWYgKFU4VG9BU0NJSSh0eXBlKSA9PT0gJ0lIRFInKSB7XG4gICAgICBJSERSID0gbmV3IENodW5rKGNodW5rKTtcbiAgICAgIG91dHB1dChbLi4uVThUb0hleChjaHVuayldKTtcbiAgICB9XG4gICAgb3V0cHV0KFsnc2l6ZTonLCBzaXplXSk7XG4gICAgb3V0cHV0KFsndHlwZTonLCBVOFRvQVNDSUkodHlwZSldKTtcbiAgICAvLyBvdXRwdXQoWydkYXRhOicsIC4uLnRvSGV4KGRhdGEpXSk7XG4gICAgb3V0cHV0KFsnY3JjOicsIC4uLlU4VG9IZXgoY3JjKV0pO1xuICAgIG91dHB1dChbJ2NvbXB1dGVkIGNyYzonLCAuLi5VOFRvSGV4KFU4RnJvbVVpbnQzMihDUkMuSW5pdChVOENvbmNhdChbdHlwZSwgZGF0YV0pKSkpXSk7XG4gICAgb3V0cHV0KCk7XG4gIH1cblxuICBvdXRwdXQoWydUb3RhbCBJREFUIENodW5rczonLCBpZGF0X2RhdGFzLmxlbmd0aF0pO1xuICBvdXRwdXQoWydUb3RhbCBJREFUIENvbXByZXNzZWQgU2l6ZTonLCB0b3RhbF9pZGF0X3NpemVdKTtcblxuICAvLyBDb21iaW5lIElEQVRzLCBEZWNvbXByZXNzLCBTcGxpdCBEZWNvbXByZXNzZWQgRGF0YSBpbnRvIFNjYW5saW5lcywgR3JvdXAgU2NhbmxpbmVzLCBDb21wcmVzcyBHcm91cHMsIENyZWF0ZSBOZXcgUG5nc1xuICBjb25zdCBjb21wcmVzc2VkX2J5dGVzID0gVThDb25jYXQoaWRhdF9kYXRhcyk7XG4gIG91dHB1dChbJ0NvbXByZXNzZWQgRGF0YSBTaXplOicsIGNvbXByZXNzZWRfYnl0ZXMuYnl0ZUxlbmd0aF0pO1xuXG4gIG91dHB1dChbJ0RlY29tcHJlc3NpbmcgRGF0YSddKTtcbiAgY29uc3QgZGVjb21wcmVzc2VkX2J5dGVzID0gZGVjb21wcmVzc0ltYWdlRGF0YShjb21wcmVzc2VkX2J5dGVzKTtcbiAgaWYgKCFkZWNvbXByZXNzZWRfYnl0ZXMpIHRocm93ICdlcnJvcjogZGVjb21wcmVzc2VkX2J5dGVzJztcbiAgb3V0cHV0KFsnRGVjb21wcmVzc2VkIERhdGEgU2l6ZTonLCBkZWNvbXByZXNzZWRfYnl0ZXMuYnl0ZUxlbmd0aF0pO1xuICAvLyBvdXRwdXQoWydEZWNvbXByZXNzZWQgQnl0ZXM6JywgZGVjb21wcmVzc2VkX2J5dGVzXSk7XG4gIG91dHB1dCgpO1xuXG4gIGlmICghSUhEUikgdGhyb3cgJ2Vycm9yOiBJSERSJztcbiAgY29uc3QgeyBiaXREZXB0aCwgY29sb3JUeXBlLCBjb21wcmVzc2lvbk1ldGhvZCwgZmlsdGVyTWV0aG9kLCBoZWlnaHQsIGludGVybGFjZU1ldGhvZCwgd2lkdGggfSA9IHBhcnNlSUhEUkNodW5rKElIRFIpO1xuXG4gIG91dHB1dChbJ1dpZHRoOicsIHdpZHRoXSk7XG4gIG91dHB1dChbJ0hlaWdodDonLCBoZWlnaHRdKTtcbiAgb3V0cHV0KFsnQml0RGVwdGg6JywgYml0RGVwdGhdKTtcbiAgb3V0cHV0KFsnQ29sb3JUeXBlOicsIGNvbG9yVHlwZV0pO1xuICBvdXRwdXQoWydDb21wcmVzc2lvbk1ldGhvZDonLCBjb21wcmVzc2lvbk1ldGhvZF0pO1xuICBvdXRwdXQoWydGaWx0ZXJNZXRob2Q6JywgZmlsdGVyTWV0aG9kXSk7XG4gIG91dHB1dChbJ0ludGVybGFjZU1ldGhvZDonLCBpbnRlcmxhY2VNZXRob2RdKTtcbiAgb3V0cHV0KCk7XG5cbiAgb3V0cHV0KFsnRXh0cmFjdGluZyBTY2FubGluZXMnXSk7XG4gIGNvbnN0IHNjYW5saW5lU2l6ZSA9IGdldFNjYW5saW5lU2l6ZSh7IHdpZHRoLCBiaXREZXB0aCwgY29sb3JUeXBlIH0pO1xuICBvdXRwdXQoWydTY2FubGluZSBTaXplOicsIHNjYW5saW5lU2l6ZV0pO1xuICBjb25zdCBzY2FubGluZXMgPSBVOFNwbGl0KGRlY29tcHJlc3NlZF9ieXRlcywgc2NhbmxpbmVTaXplKTtcbiAgb3V0cHV0KFtzY2FubGluZXMubGVuZ3RoLCAnU2NhbmxpbmVzIEV4dHJhY3RlZCddKTtcbn1cbiIsCiAgICAiZXhwb3J0IGZ1bmN0aW9uIEFycmF5RXF1YWxzKGE6IEFycmF5TGlrZTxhbnk+LCBiOiBBcnJheUxpa2U8YW55Pik6IGJvb2xlYW4ge1xuICBpZiAoYS5sZW5ndGggIT09IGIubGVuZ3RoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgYS5sZW5ndGg7IGkrKykge1xuICAgIGlmIChhW2ldICE9PSBiW2ldKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24qIEFycmF5R2V0Qnl0ZXMoYnVmZmVyOiBBcnJheUJ1ZmZlckxpa2UpOiBHZW5lcmF0b3I8bnVtYmVyPiB7XG4gIGNvbnN0IHZpZXcgPSBuZXcgRGF0YVZpZXcoYnVmZmVyKTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCB2aWV3LmJ5dGVMZW5ndGg7IGkrKykge1xuICAgIHlpZWxkIHZpZXcuZ2V0VWludDgoaSkgPj4+IDA7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIEFycmF5U3BsaXQ8VD4oaXRlbXM6IFRbXSwgY291bnQ6IG51bWJlcik6IFRbXVtdIHtcbiAgaWYgKGNvdW50ID4gaXRlbXMubGVuZ3RoKSB7XG4gICAgcmV0dXJuIFtpdGVtcy5zbGljZSgpXTtcbiAgfVxuICBpZiAoY291bnQgPiAwKSB7XG4gICAgY29uc3QgcGFydHM6IFRbXVtdID0gW107XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpdGVtcy5sZW5ndGg7IGkgKz0gY291bnQpIHtcbiAgICAgIHBhcnRzLnB1c2goaXRlbXMuc2xpY2UoaSwgaSArIGNvdW50KSk7XG4gICAgfVxuICAgIHJldHVybiBwYXJ0cztcbiAgfVxuICByZXR1cm4gW2l0ZW1zLnNsaWNlKCldO1xufVxuIiwKICAgICIvLyBjb25zdCBwYXRoID0gQnVuLmFyZ3ZbMl07XG4vLyBjb25zdCBtYXhfaGVpZ2h0X3Blcl9maWxlID0gQnVuLmFyZ3ZbM10gPT09IHVuZGVmaW5lZCA/IDQwOTYgOiBOdW1iZXIucGFyc2VJbnQoQnVuLmFyZ3ZbM10pO1xuLy8gY29uc3QgYnVmZmVyID0gYXdhaXQgQnVuLmZpbGUocGF0aCkuYnl0ZXMoKTtcblxuaW1wb3J0IHsgQXJyYXlTcGxpdCB9IGZyb20gJy4vZXJpY2NoYXNlL0FsZ29yaXRobS9BcnJheS9BcnJheS5qcyc7XG5pbXBvcnQgeyBVOENvbmNhdCwgVThTcGxpdCwgVThUYWtlLCBVOFRvQVNDSUksIFU4VG9IZXggfSBmcm9tICcuL2VyaWNjaGFzZS9BbGdvcml0aG0vQXJyYXkvVWludDhBcnJheS5qcyc7XG5pbXBvcnQgeyBDb25zb2xlRXJyb3IgfSBmcm9tICcuL2VyaWNjaGFzZS9VdGlsaXR5L0NvbnNvbGUuanMnO1xuaW1wb3J0IHsgQ2h1bmssIGNvbXByZXNzSW1hZ2VEYXRhLCBjcmVhdGVJREFUY2h1bmssIGNyZWF0ZUlIRFJjaHVuaywgZGVjb21wcmVzc0ltYWdlRGF0YSwgZXh0cmFjdENodW5rcywgZ2V0U2NhbmxpbmVTaXplLCBwYXJzZUlIRFJDaHVuayB9IGZyb20gJy4vcG5nLmpzJztcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIFBOR1NwbGl0KGJ1ZmZlcjogVWludDhBcnJheSwgaGVpZ2h0X3Blcl9maWxlID0gNDA5Niwgb3V0cHV0PzogKGRhdGE/OiBhbnlbXSkgPT4gdm9pZCk6IFByb21pc2U8VWludDhBcnJheVtdPiB7XG4gIC8vIEV4dHJhY3QgdGhlIFNpZ25hdHVyZVxuICBjb25zdCBbc2lnbmF0dXJlQnl0ZXMsIHJlc3RdID0gVThUYWtlKGJ1ZmZlciwgOCk7XG4gIGNvbnN0IGNodW5rcyA9IGV4dHJhY3RDaHVua3MocmVzdCkubWFwKChieXRlcykgPT4gbmV3IENodW5rKGJ5dGVzKSk7XG5cbiAgLy8gRXh0cmFjdCBBbGwgdGhlIENodW5rc1xuICBjb25zdCB0b3BDaHVua3M6IENodW5rW10gPSBbXTtcbiAgY29uc3QgZGF0YUNodW5rczogQ2h1bmtbXSA9IFtdO1xuICBjb25zdCBib3RDaHVua3M6IENodW5rW10gPSBbXTtcbiAgbGV0IGluZGV4ID0gMDtcbiAgd2hpbGUgKGluZGV4IDwgY2h1bmtzLmxlbmd0aCkge1xuICAgIGNvbnN0IGNodW5rID0gY2h1bmtzW2luZGV4XTtcbiAgICAvLyBjb25zdCB7IHR5cGUgfSA9IGFuYWx5emVDaHVuayhjaHVua3NbaW5kZXhdKTtcbiAgICBpZiAoU3RyaW5nLmZyb21DaGFyQ29kZSguLi5jaHVuay50eXBlKSA9PT0gJ0lEQVQnKSB7XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgdG9wQ2h1bmtzLnB1c2goY2h1bmspO1xuICAgIGluZGV4Kys7XG4gIH1cbiAgd2hpbGUgKGluZGV4IDwgY2h1bmtzLmxlbmd0aCkge1xuICAgIGNvbnN0IGNodW5rID0gY2h1bmtzW2luZGV4XTtcbiAgICBpZiAoU3RyaW5nLmZyb21DaGFyQ29kZSguLi5jaHVuay50eXBlKSAhPT0gJ0lEQVQnKSB7XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgZGF0YUNodW5rcy5wdXNoKGNodW5rKTtcbiAgICBpbmRleCsrO1xuICB9XG4gIHdoaWxlIChpbmRleCA8IGNodW5rcy5sZW5ndGgpIHtcbiAgICBjb25zdCBjaHVuayA9IGNodW5rc1tpbmRleF07XG4gICAgYm90Q2h1bmtzLnB1c2goY2h1bmspO1xuICAgIGluZGV4Kys7XG4gIH1cblxuICBvdXRwdXQ/LihbJ0V4dHJhY3QgSUhEUiBhbmQgUGFyc2UnXSk7XG4gIGNvbnN0IElIRFIgPSB0b3BDaHVua3MuZmluZCgoY2h1bmspID0+IFU4VG9BU0NJSShjaHVuay50eXBlKSA9PT0gJ0lIRFInKTtcbiAgaWYgKCFJSERSKSB0aHJvdyAnZXJyb3I6IElIRFInO1xuICBjb25zdCB7IGJpdERlcHRoLCBjb2xvclR5cGUsIGNvbXByZXNzaW9uTWV0aG9kLCBmaWx0ZXJNZXRob2QsIGhlaWdodCwgaW50ZXJsYWNlTWV0aG9kLCB3aWR0aCB9ID0gcGFyc2VJSERSQ2h1bmsoSUhEUik7XG5cbiAgLy8gQ29tYmluZSBJREFUcywgRGVjb21wcmVzcywgU3BsaXQgRGVjb21wcmVzc2VkIERhdGEgaW50byBTY2FubGluZXMsIEdyb3VwIFNjYW5saW5lcywgQ29tcHJlc3MgR3JvdXBzLCBDcmVhdGUgTmV3IFBuZ3NcbiAgY29uc3QgY29tcHJlc3NlZF9ieXRlcyA9IFU4Q29uY2F0KGRhdGFDaHVua3MubWFwKChjaHVuaykgPT4gY2h1bmsuZGF0YSkpO1xuICBvdXRwdXQ/LihbJ0NvbXByZXNzZWQgRGF0YSBTaXplOicsIGNvbXByZXNzZWRfYnl0ZXMuYnl0ZUxlbmd0aF0pO1xuXG4gIG91dHB1dD8uKFsnRGVjb21wcmVzc2luZyBEYXRhJ10pO1xuICBjb25zdCBkZWNvbXByZXNzZWRfYnl0ZXMgPSBkZWNvbXByZXNzSW1hZ2VEYXRhKGNvbXByZXNzZWRfYnl0ZXMpO1xuICBpZiAoIWRlY29tcHJlc3NlZF9ieXRlcykgdGhyb3cgJ2Vycm9yOiBkZWNvbXByZXNzZWRfYnl0ZXMnO1xuICBvdXRwdXQ/LihbJ0RlY29tcHJlc3NlZCBEYXRhIFNpemU6JywgZGVjb21wcmVzc2VkX2J5dGVzLmJ5dGVMZW5ndGhdKTtcblxuICAvLyBHZXQgdG9wIGNodW5rcyB3aXRob3V0IElIRFJcbiAgY29uc3QgdG9wQ2h1bmtzV2l0aG91dElIRFIgPSB0b3BDaHVua3MuZmlsdGVyKChjaHVuaykgPT4gVThUb0FTQ0lJKGNodW5rLnR5cGUpICE9PSAnSUhEUicpO1xuXG4gIG91dHB1dD8uKFsnRXh0cmFjdGluZyBTY2FubGluZXMnXSk7XG4gIGNvbnN0IHNjYW5saW5lU2l6ZSA9IGdldFNjYW5saW5lU2l6ZSh7IHdpZHRoLCBiaXREZXB0aCwgY29sb3JUeXBlIH0pO1xuICBjb25zdCBzY2FubGluZXMgPSBVOFNwbGl0KGRlY29tcHJlc3NlZF9ieXRlcywgc2NhbmxpbmVTaXplKTtcbiAgb3V0cHV0Py4oW3NjYW5saW5lcy5sZW5ndGgsICdTY2FubGluZXMgRXh0cmFjdGVkJ10pO1xuXG4gIC8vIGNvbnN0IHJlY29tcHJlc3NlZF9ieXRlcyA9IGNvbXByZXNzSURBVGRhdGEoZGVjb21wcmVzc2VkX2J5dGVzKTtcbiAgLy8gaWYgKCFyZWNvbXByZXNzZWRfYnl0ZXMpIHRocm93ICdlcnJvcjogcmVjb21wcmVzc2VkX2J5dGVzJztcbiAgLy8gY29uc3QgbmV3SURBVCA9IGNyZWF0ZUlEQVQocmVjb21wcmVzc2VkX2J5dGVzKTtcbiAgLy8gY29uc3Qgb3V0cGF0aCA9IHBhdGggKyAnX19zcGxpdDAwLnBuZyc7XG4gIC8vIG91dHB1dD8uKFsnV3JpdGluZycsIG91dHBhdGhdKTtcbiAgLy8gYXdhaXQgQnVuLndyaXRlKG91dHBhdGgsIFU4Q29uY2F0KFtzaWduYXR1cmVCeXRlcywgLi4udG9wQ2h1bmtzLm1hcCgoXykgPT4gXy5ieXRlcyksIG5ld0lEQVQsIC4uLmJvdENodW5rcy5tYXAoKF8pID0+IF8uYnl0ZXMpXSkpO1xuXG4gIC8vIHRoZSBpbmRpdmlkdWFsIGZpbGVzIHByb2R1Y2VkIGZyb20gdGhpcyBsb29wIGhhdmUgaXNzdWVzXG5cbiAgZnVuY3Rpb24gY2hlY2tTY2FubGluZUZpbHRlckJ5dGVzKGRlY29tcHJlc3NlZERhdGE6IFVpbnQ4QXJyYXksIHNjYW5saW5lU2l6ZTogbnVtYmVyKSB7XG4gICAgLy8gSXRlcmF0ZSB0aHJvdWdoIGVhY2ggc2NhbmxpbmVcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRlY29tcHJlc3NlZERhdGEubGVuZ3RoOyBpICs9IHNjYW5saW5lU2l6ZSkge1xuICAgICAgY29uc3QgZmlsdGVyQnl0ZSA9IGRlY29tcHJlc3NlZERhdGFbaV07XG5cbiAgICAgIC8vIENoZWNrIGlmIHRoZSBmaWx0ZXIgYnl0ZSBpcyB3aXRoaW4gdGhlIHZhbGlkIHJhbmdlIFswLCA0XVxuICAgICAgaWYgKGZpbHRlckJ5dGUgPCAwIHx8IGZpbHRlckJ5dGUgPiA0KSB7XG4gICAgICAgIENvbnNvbGVFcnJvcihgSW52YWxpZCBmaWx0ZXIgYnl0ZSBhdCBzY2FubGluZSAke2kgLyBzY2FubGluZVNpemV9OiAke2ZpbHRlckJ5dGV9YCk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHZhbGlkYXRlU2NhbmxpbmUoc2NhbmxpbmU6IFVpbnQ4QXJyYXkpIHtcbiAgICAvLyBDYWxjdWxhdGUgYnl0ZXMgcGVyIHBpeGVsIGJhc2VkIG9uIGNvbG9yIHR5cGUgYW5kIGJpdCBkZXB0aFxuICAgIGxldCBzYW1wbGVzUGVyUGl4ZWw6IG51bWJlcjtcbiAgICBzd2l0Y2ggKGNvbG9yVHlwZSkge1xuICAgICAgY2FzZSAwOiAvLyBHcmF5c2NhbGVcbiAgICAgICAgc2FtcGxlc1BlclBpeGVsID0gMTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6IC8vIFRydWVjb2xvciAoUkdCKVxuICAgICAgICBzYW1wbGVzUGVyUGl4ZWwgPSAzO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzogLy8gSW5kZXhlZC1jb2xvciAocGFsZXR0ZSlcbiAgICAgICAgc2FtcGxlc1BlclBpeGVsID0gMTsgLy8gVXNlcyBhIHBhbGV0dGUsIHNvIG9ubHkgMSBieXRlIHBlciBwaXhlbCBpbmRleFxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgNDogLy8gR3JheXNjYWxlIHdpdGggYWxwaGFcbiAgICAgICAgc2FtcGxlc1BlclBpeGVsID0gMjtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDY6IC8vIFRydWVjb2xvciB3aXRoIGFscGhhIChSR0JBKVxuICAgICAgICBzYW1wbGVzUGVyUGl4ZWwgPSA0O1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBjb2xvciB0eXBlLicpO1xuICAgIH1cblxuICAgIC8vIENhbGN1bGF0ZSBieXRlcyBwZXIgcGl4ZWxcbiAgICBjb25zdCBieXRlc1BlclBpeGVsID0gKGJpdERlcHRoICogc2FtcGxlc1BlclBpeGVsKSAvIDg7XG4gICAgY29uc3Qgc2NhbmxpbmVTaXplID0gMSArIHdpZHRoICogYnl0ZXNQZXJQaXhlbDtcblxuICAgIC8vIFRoZSBzY2FubGluZSBzaG91bGQgc3RhcnQgd2l0aCBhIGZpbHRlciBieXRlXG4gICAgY29uc3QgZmlsdGVyQnl0ZSA9IHNjYW5saW5lWzBdO1xuXG4gICAgLy8gVmFsaWRhdGUgdGhlIGZpbHRlciBieXRlIChtdXN0IGJlIGJldHdlZW4gMCBhbmQgNClcbiAgICBpZiAoZmlsdGVyQnl0ZSA8IDAgfHwgZmlsdGVyQnl0ZSA+IDQpIHtcbiAgICAgIENvbnNvbGVFcnJvcihgSW52YWxpZCBmaWx0ZXIgYnl0ZTogJHtmaWx0ZXJCeXRlfWApO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8vIFZhbGlkYXRlIHRoZSBsZW5ndGggb2YgdGhlIHNjYW5saW5lIGRhdGEgKGV4Y2x1ZGluZyB0aGUgZmlsdGVyIGJ5dGUpXG4gICAgY29uc3QgZXhwZWN0ZWREYXRhTGVuZ3RoID0gd2lkdGggKiBieXRlc1BlclBpeGVsO1xuICAgIGNvbnN0IHNjYW5saW5lRGF0YUxlbmd0aCA9IHNjYW5saW5lLmxlbmd0aCAtIDE7IC8vIEV4Y2x1ZGluZyB0aGUgZmlsdGVyIGJ5dGVcblxuICAgIGlmIChzY2FubGluZURhdGFMZW5ndGggIT09IGV4cGVjdGVkRGF0YUxlbmd0aCkge1xuICAgICAgQ29uc29sZUVycm9yKGBJbmNvcnJlY3Qgc2NhbmxpbmUgZGF0YSBsZW5ndGg6IGV4cGVjdGVkICR7ZXhwZWN0ZWREYXRhTGVuZ3RofSwgZ290ICR7c2NhbmxpbmVEYXRhTGVuZ3RofWApO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLy8gLy8gU3BsaXR0aW5nIHNjYW5saW5lcyBiYXNlZCBvbiBtYXggZGVjb21wcmVzc2VkIGRhdGEgc2l6ZVxuICAvLyBjb25zdCBzY2FubGluZV9ncm91cHM6IFVpbnQ4QXJyYXlbXSA9IFtdO1xuICAvLyBsZXQgZ3JvdXA6IFVpbnQ4QXJyYXlbXSA9IFtdO1xuICAvLyBsZXQgZ3JvdXBzaXplID0gMDtcbiAgLy8gZm9yIChjb25zdCBzY2FubGluZSBvZiBzY2FubGluZXMpIHtcbiAgLy8gICB2YWxpZGF0ZVNjYW5saW5lKHNjYW5saW5lKTtcbiAgLy8gICBpZiAoZ3JvdXBzaXplICsgc2NhbmxpbmUuYnl0ZUxlbmd0aCA8IG1heF9oZWlnaHRfcGVyX2ZpbGUpIHtcbiAgLy8gICAgIGdyb3VwLnB1c2goc2NhbmxpbmUpO1xuICAvLyAgICAgZ3JvdXBzaXplICs9IHNjYW5saW5lLmJ5dGVMZW5ndGg7XG4gIC8vICAgfSBlbHNlIHtcbiAgLy8gICAgIHNjYW5saW5lX2dyb3Vwcy5wdXNoKFU4Q29uY2F0KGdyb3VwKSk7XG4gIC8vICAgICBncm91cCA9IFtdO1xuICAvLyAgICAgZ3JvdXBzaXplID0gMDtcbiAgLy8gICB9XG4gIC8vIH1cbiAgLy8gb3V0cHV0Py4oWydHcm91cCBDb3VudDonLCBzY2FubGluZV9ncm91cHMubGVuZ3RoXSk7XG5cbiAgb3V0cHV0Py4oWydWYWxpZGF0aW5nIFNjYW5saW5lcyddKTtcbiAgZm9yIChjb25zdCBzY2FubGluZSBvZiBzY2FubGluZXMpIHtcbiAgICB2YWxpZGF0ZVNjYW5saW5lKHNjYW5saW5lKTtcbiAgfVxuXG4gIG91dHB1dD8uKFsnQ3JlYXRpbmcgTmV3IFBOR3MnXSk7XG4gIC8vIGxldCB0ZXN0OiBVaW50OEFycmF5W10gPSBbXTtcbiAgY29uc3Qgc2NhbmxpbmVfZ3JvdXBzID0gQXJyYXlTcGxpdChzY2FubGluZXMsIGhlaWdodF9wZXJfZmlsZSk7XG4gIGNvbnN0IHBuZ19vdXRfYnVmZmVyczogVWludDhBcnJheVtdID0gW107XG4gIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBzY2FubGluZV9ncm91cHMubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgb3V0cHV0Py4oWydQTkcnLCBpbmRleF0pO1xuICAgIGNvbnN0IGdyb3VwID0gc2NhbmxpbmVfZ3JvdXBzW2luZGV4XTtcbiAgICBjb25zdCBkZWNvbXByZXNzZWRfZGF0YSA9IFU4Q29uY2F0KGdyb3VwKTtcbiAgICBjaGVja1NjYW5saW5lRmlsdGVyQnl0ZXMoZGVjb21wcmVzc2VkX2RhdGEsIHNjYW5saW5lU2l6ZSk7XG4gICAgLy8gdGVzdC5wdXNoKGRlY29tcHJlc3NlZF9kYXRhKTtcbiAgICBjb25zdCBjb21wcmVzc2VkX2RhdGEgPSBjb21wcmVzc0ltYWdlRGF0YShkZWNvbXByZXNzZWRfZGF0YSk7XG4gICAgaWYgKCFjb21wcmVzc2VkX2RhdGEpIHRocm93ICdlcnJvcjogY29tcHJlc3NlZF9kYXRhJztcbiAgICBvdXRwdXQ/LihbJ2NvbXByZXNzZWQgbGVuZ3RoOicsIGNvbXByZXNzZWRfZGF0YS5ieXRlTGVuZ3RoXSk7XG4gICAgLy8gQ3JlYXRlIHRoZSBuZXcgSURBVFxuICAgIGNvbnN0IG5ld0lEQVQgPSBjcmVhdGVJREFUY2h1bmsoY29tcHJlc3NlZF9kYXRhKTtcbiAgICAvLyBDcmVhdGUgdGhlIG5ldyBJSERSXG4gICAgY29uc3QgbmV3SUhEUiA9IGNyZWF0ZUlIRFJjaHVuayh7IHdpZHRoLCBoZWlnaHQ6IGdyb3VwLmxlbmd0aCwgYml0RGVwdGgsIGNvbG9yVHlwZSwgY29tcHJlc3Npb25NZXRob2QsIGZpbHRlck1ldGhvZCwgaW50ZXJsYWNlTWV0aG9kIH0pO1xuICAgIG91dHB1dD8uKFsnbmV3IElIRFI6JywgLi4uVThUb0hleChuZXdJSERSKV0pO1xuICAgIHBuZ19vdXRfYnVmZmVycy5wdXNoKFU4Q29uY2F0KFtzaWduYXR1cmVCeXRlcywgbmV3SUhEUiwgLi4udG9wQ2h1bmtzV2l0aG91dElIRFIubWFwKChfKSA9PiBfLmJ5dGVzKSwgbmV3SURBVCwgLi4uYm90Q2h1bmtzLm1hcCgoXykgPT4gXy5ieXRlcyldKSk7XG4gICAgLy8gY29uc3Qgb3V0cGF0aCA9IHBhdGggKyAnX19zcGxpdCcgKyBpbmRleC50b1N0cmluZygxMCkucGFkU3RhcnQoMiwgJzAnKSArICcucG5nJztcbiAgICAvLyBvdXRwdXQ/LihbJ1dyaXRpbmcnLCBvdXRwYXRoXSk7XG4gICAgLy8gYXdhaXQgQnVuLndyaXRlKG91dHBhdGgsIFU4Q29uY2F0KFtzaWduYXR1cmVCeXRlcywgbmV3SUhEUiwgLi4udG9wQ2h1bmtzV2l0aG91dElIRFIubWFwKChfKSA9PiBfLmJ5dGVzKSwgbmV3SURBVCwgLi4uYm90Q2h1bmtzLm1hcCgoXykgPT4gXy5ieXRlcyldKSk7XG4gIH1cblxuICAvLyAvLyB0aGlzIG5ldyBzaW5nbGUgZmlsZSBpcyBwZXJmZWN0XG5cbiAgLy8gY29uc3QgZGVjb21wcmVzc2VkX3RvdGFsID0gVThDb25jYXQodGVzdCk7XG4gIC8vIG91dHB1dD8uKFsnRXF1YWw6JywgQXJyYXlFcXVhbHMoZGVjb21wcmVzc2VkX3RvdGFsLCBkZWNvbXByZXNzZWRfYnl0ZXMpXSk7XG4gIC8vIGNvbnN0IGNvbXByZXNzZWRfdG90YWwgPSBjb21wcmVzc0ltYWdlRGF0YShkZWNvbXByZXNzZWRfdG90YWwpO1xuICAvLyBpZiAoIWNvbXByZXNzZWRfdG90YWwpIHRocm93ICdlcnJvcjogY29tcHJlc3NlZF90b3RhbCc7XG4gIC8vIGNvbnN0IG5ld0lEQVQgPSBjcmVhdGVJREFUY2h1bmsoY29tcHJlc3NlZF90b3RhbCk7XG4gIC8vIGF3YWl0IEJ1bi53cml0ZShwYXRoICsgJ19fc3BsaXQtdGVzdC5wbmcnLCBVOENvbmNhdChbc2lnbmF0dXJlQnl0ZXMsIElIRFIuYnl0ZXMsIC4uLnRvcENodW5rc1dpdGhvdXRJSERSLm1hcCgoXykgPT4gXy5ieXRlcyksIG5ld0lEQVQsIC4uLmJvdENodW5rcy5tYXAoKF8pID0+IF8uYnl0ZXMpXSkpO1xuXG4gIHJldHVybiBwbmdfb3V0X2J1ZmZlcnM7XG59XG4iLAogICAgImltcG9ydCB7IHNldHVwRHJhZ0FuZERyb3BGaWxlUGlja2VyIH0gZnJvbSAnLi9jb21wb25lbnRzL2RyYWctYW5kLWRyb3AtZmlsZS1waWNrZXIvZHJhZy1hbmQtZHJvcC1maWxlLXBpY2tlci5qcyc7XG5pbXBvcnQgeyBDb25zb2xlRXJyb3IgfSBmcm9tICcuL2xpYi9lcmljY2hhc2UvVXRpbGl0eS9Db25zb2xlLmpzJztcbmltcG9ydCB0eXBlIHsgTiB9IGZyb20gJy4vbGliL2VyaWNjaGFzZS9VdGlsaXR5L1R5cGVzLmpzJztcbmltcG9ydCB7IEdldEJ5dGVzIH0gZnJvbSAnLi9saWIvZXJpY2NoYXNlL1dlYiBBUEkvRmlsZS5qcyc7XG5pbXBvcnQgeyBQTkdJbnNwZWN0IH0gZnJvbSAnLi9saWIvcG5nLWluc3BlY3QuanMnO1xuaW1wb3J0IHsgUE5HU3BsaXQgfSBmcm9tICcuL2xpYi9wbmctc3BsaXQuanMnO1xuXG4vLyAvLyBFeHRyZW1lbHkgVXNlZnVsIEZ1bmN0aW9uIFRvIFByaW50IExvZ3MgVG8gUGFnZXNcbi8vIGV4cG9ydCBmdW5jdGlvbiBsb2coaXRlbTogYW55KSB7XG4vLyAgIGNvbnN0IGVudHJ5X3BvaW50ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmVudHJ5LXBvaW50Jyk7XG4vLyAgIGlmIChBcnJheS5pc0FycmF5KGl0ZW0pKSB7XG4vLyAgICAgZm9yIChjb25zdCBrZXkgaW4gaXRlbSkge1xuLy8gICAgICAgaWYgKEFycmF5LmlzQXJyYXkoaXRlbVtrZXldKSkge1xuLy8gICAgICAgICBmb3IgKGNvbnN0IGtleTIgaW4gaXRlbVtrZXldKSB7XG4vLyAgICAgICAgICAgY29uc3QgZGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4vLyAgICAgICAgICAgZGl2LnRleHRDb250ZW50ID0gYCR7a2V5Mn06ICR7aXRlbVtrZXldW2tleTJdfWA7XG4vLyAgICAgICAgICAgZW50cnlfcG9pbnQ/LmFwcGVuZENoaWxkKGRpdik7XG4vLyAgICAgICAgIH1cbi8vICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGl0ZW1ba2V5XSAhPT0gJ2Z1bmN0aW9uJykge1xuLy8gICAgICAgICBjb25zdCBkaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbi8vICAgICAgICAgZGl2LnRleHRDb250ZW50ID0gYCR7a2V5fTogJHtpdGVtW2tleV19YDtcbi8vICAgICAgICAgZW50cnlfcG9pbnQ/LmFwcGVuZENoaWxkKGRpdik7XG4vLyAgICAgICB9XG4vLyAgICAgfVxuLy8gICB9IGVsc2Uge1xuLy8gICAgIGNvbnN0IGRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuLy8gICAgIGRpdi50ZXh0Q29udGVudCA9IGl0ZW07XG4vLyAgICAgZW50cnlfcG9pbnQ/LmFwcGVuZENoaWxkKGRpdik7XG4vLyAgIH1cbi8vIH1cblxuLy8gISBvbmUgZGF5IHVzZSBFdmVudE1hbmFnZXJcbmRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdkcmFnb3ZlcicsIChldmVudCkgPT4gZXZlbnQucHJldmVudERlZmF1bHQoKSk7XG5cbmNvbnN0IGZpbGVfcGlja2VyID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2ZpbGUtcGlja2VyJyk7XG5jb25zdCBpbWFnZV92aWV3ZXIgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjaW1hZ2Utdmlld2VyJyk7XG5jb25zdCBpbWFnZV92aWV3ZXJfZ2FwcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5pbWFnZS12aWV3ZXItZ2FwJyk7XG5jb25zdCBlZGl0X2J1dHRvbnMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjZWRpdC1idXR0b25zJyk7XG5cbmNvbnN0IGJ0bl9pbnNwZWN0ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2J0bi1pbnNwZWN0Jyk7XG5jb25zdCBidG5fc3BsaXQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjYnRuLXNwbGl0Jyk7XG5jb25zdCBvdXRwdXRfY29udGFpbmVyID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI291dHB1dC1jb250YWluZXInKTtcbmNvbnN0IG91dHB1dF9jb250YWluZXJfZ2FwcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5vdXRwdXQtY29udGFpbmVyLWdhcCcpO1xuXG5sZXQgc2VsZWN0ZWRfZmlsZTogRmlsZSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuaWYgKGZpbGVfcGlja2VyKSB7XG4gIGNvbnN0IG9uRHJhZ0VuZCA9ICgpID0+IHtcbiAgICBmaWxlX3BpY2tlci5jbGFzc0xpc3QucmVtb3ZlKCdob3ZlcicpO1xuICB9O1xuICBzZXR1cERyYWdBbmREcm9wRmlsZVBpY2tlcihcbiAgICBmaWxlX3BpY2tlcixcbiAgICB7XG4gICAgICBvbkRyYWdFbnRlcigpIHtcbiAgICAgICAgZmlsZV9waWNrZXIuY2xhc3NMaXN0LmFkZCgnaG92ZXInKTtcbiAgICAgIH0sXG4gICAgICBvbkRyYWdMZWF2ZTogb25EcmFnRW5kLFxuICAgICAgb25EcmFnRW5kOiBvbkRyYWdFbmQsXG4gICAgICBvbkRyb3A6IG9uRHJhZ0VuZCxcbiAgICAgIG9uVXBsb2FkU3RhcnQoKSB7XG4gICAgICAgIHNlbGVjdGVkX2ZpbGUgPSB1bmRlZmluZWQ7XG4gICAgICAgIGZpbGVfcGlja2VyLmNsYXNzTGlzdC5hZGQoJ3F1aWV0LW1vZGUnKTtcbiAgICAgIH0sXG4gICAgICBvblVwbG9hZE5leHRGaWxlOiBzaG93SW1hZ2VJblZpZXdlcixcbiAgICAgIG9uVXBsb2FkRXJyb3IoZXJyb3IpIHtcbiAgICAgICAgYWRkVGV4dHNUb091dHB1dChlcnJvciwgdHJ1ZSk7XG4gICAgICB9LFxuICAgIH0sXG4gICAge1xuICAgICAgYWNjZXB0OiAnLnBuZycsIC8vIHdvbid0IHdvcmsgb24gbW9iaWxlXG4gICAgfSxcbiAgKTtcbn1cblxuZnVuY3Rpb24gcmVzZXRWaWV3ZXIoKSB7XG4gIHNlbGVjdGVkX2ZpbGUgPSB1bmRlZmluZWQ7XG4gIGZpbGVfcGlja2VyPy5jbGFzc0xpc3QucmVtb3ZlKCdxdWlldC1tb2RlJyk7XG4gIGltYWdlX3ZpZXdlcj8uY2xhc3NMaXN0LnJlbW92ZSgnaW1hZ2UtbG9hZGVkJyk7XG4gIGltYWdlX3ZpZXdlcj8ucXVlcnlTZWxlY3RvcignaW1nJyk/LnJlbW92ZSgpO1xuICBmb3IgKGNvbnN0IGdhcCBvZiBpbWFnZV92aWV3ZXJfZ2FwcyA/PyBbXSkge1xuICAgIGdhcC5jbGFzc0xpc3QuYWRkKCdyZW1vdmUnKTtcbiAgfVxuICBmb3IgKGNvbnN0IGJ1dHRvbiBvZiBlZGl0X2J1dHRvbnM/LnF1ZXJ5U2VsZWN0b3JBbGwoJ2J1dHRvbicpID8/IFtdKSB7XG4gICAgYnV0dG9uLmRpc2FibGVkID0gdHJ1ZTtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBzaG93SW1hZ2VJblZpZXdlcihmaWxlOiBGaWxlLCBkb25lOiAoKSA9PiB2b2lkKSB7XG4gIHRyeSB7XG4gICAgaWYgKGZpbGUudHlwZSAhPT0gJ2ltYWdlL3BuZycpIHtcbiAgICAgIHRocm93IGBFcnJvcjogQ291bGQgbm90IHByb2Nlc3MgXCIke2ZpbGUubmFtZX1cIi5cXG5QbGVhc2UgdXBsb2FkIFBORyBvbmx5LmA7XG4gICAgfVxuICAgIHNlbGVjdGVkX2ZpbGUgPSBmaWxlO1xuICAgIGNvbnN0IGltZyA9IGF3YWl0IG5ldyBQcm9taXNlPEhUTUxJbWFnZUVsZW1lbnQ+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGNvbnN0IGltZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2ltZycpO1xuICAgICAgaW1nLnNyYyA9IFVSTC5jcmVhdGVPYmplY3RVUkwoZmlsZSk7XG4gICAgICBpbWcuYWRkRXZlbnRMaXN0ZW5lcignbG9hZCcsICgpID0+IHJlc29sdmUoaW1nKSk7XG4gICAgICBpbWcuYWRkRXZlbnRMaXN0ZW5lcignZXJyb3InLCByZWplY3QpO1xuICAgIH0pO1xuICAgIGZvciAoY29uc3QgZ2FwIG9mIGltYWdlX3ZpZXdlcl9nYXBzID8/IFtdKSB7XG4gICAgICBnYXAuY2xhc3NMaXN0LnJlbW92ZSgncmVtb3ZlJyk7XG4gICAgfVxuICAgIGlmIChpbWFnZV92aWV3ZXIpIHtcbiAgICAgIGltYWdlX3ZpZXdlci5xdWVyeVNlbGVjdG9yKCdpbWcnKT8ucmVtb3ZlKCk7XG4gICAgICBpbWFnZV92aWV3ZXIuY2xhc3NMaXN0LmFkZCgnaW1hZ2UtbG9hZGVkJyk7XG4gICAgICBpbWFnZV92aWV3ZXIuY2xhc3NMaXN0LnJlbW92ZSgncmVtb3ZlJyk7XG4gICAgICBpbWFnZV92aWV3ZXIuYXBwZW5kQ2hpbGQoaW1nKTtcbiAgICB9XG4gICAgaWYgKGVkaXRfYnV0dG9ucykge1xuICAgICAgZm9yIChjb25zdCBidXR0b24gb2YgZWRpdF9idXR0b25zLnF1ZXJ5U2VsZWN0b3JBbGwoJ2J1dHRvbicpKSB7XG4gICAgICAgIGJ1dHRvbi5kaXNhYmxlZCA9IGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBDb25zb2xlRXJyb3IoZXJyb3IpO1xuICAgIGFkZFRleHRzVG9PdXRwdXQoZXJyb3IgYXMgYW55LCB0cnVlKTtcbiAgICByZXNldFZpZXdlcigpO1xuICB9XG4gIC8vIGRvbmUoKTtcbn1cblxuaWYgKGJ0bl9pbnNwZWN0IGluc3RhbmNlb2YgSFRNTEJ1dHRvbkVsZW1lbnQpIHtcbiAgYnRuX2luc3BlY3QuZGlzYWJsZWQgPSB0cnVlO1xuICBidG5faW5zcGVjdC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGFzeW5jICgpID0+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgYnl0ZXMgPSBhd2FpdCBHZXRCeXRlcyhzZWxlY3RlZF9maWxlKTtcbiAgICAgIGNvbnN0IG5hbWUgPSBzZWxlY3RlZF9maWxlPy5uYW1lO1xuICAgICAgaWYgKGJ5dGVzKSB7XG4gICAgICAgIGNvbnN0IGxvZ3M6IHN0cmluZ1tdID0gW107XG4gICAgICAgIGlmIChuYW1lKSBsb2dzLnB1c2goYFwiJHtuYW1lfVwiXFxuYCk7XG4gICAgICAgIFBOR0luc3BlY3QoYnl0ZXMsIChkYXRhOiBhbnlbXSA9IFtdKSA9PiB7XG4gICAgICAgICAgbG9ncy5wdXNoKGRhdGEuam9pbignICcpKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGFkZFRleHRzVG9PdXRwdXQobG9ncyk7XG4gICAgICAgIGFkZFRleHRzVG9PdXRwdXQoW2BJbnNwZWN0aW9uIHJlcG9ydCBmb3IgXCIke25hbWV9XCJgXSk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIENvbnNvbGVFcnJvcihlcnJvcik7XG4gICAgfVxuICB9KTtcbn1cbmlmIChidG5fc3BsaXQgaW5zdGFuY2VvZiBIVE1MQnV0dG9uRWxlbWVudCkge1xuICBidG5fc3BsaXQuZGlzYWJsZWQgPSB0cnVlO1xuICBidG5fc3BsaXQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgYnl0ZXMgPSBhd2FpdCBHZXRCeXRlcyhzZWxlY3RlZF9maWxlKTtcbiAgICBjb25zdCBuYW1lID0gc2VsZWN0ZWRfZmlsZT8ubmFtZTtcbiAgICBpZiAoYnl0ZXMpIHtcbiAgICAgIGNvbnN0IHNpemVfaW5wdXQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjc3BsaXQtc2l6ZScpO1xuICAgICAgY29uc3Qgc2l6ZSA9IHNpemVfaW5wdXQgaW5zdGFuY2VvZiBIVE1MSW5wdXRFbGVtZW50ID8gTnVtYmVyLnBhcnNlSW50KHNpemVfaW5wdXQudmFsdWUgPz8gJzEwMDAnKSA6IDEwMDA7XG4gICAgICBjb25zdCBvdXRwdXRfYnVmZmVycyA9IGF3YWl0IFBOR1NwbGl0KGJ5dGVzLCBzaXplKTtcbiAgICAgIGF3YWl0IGFkZEltYWdlc1RvT3V0cHV0KG91dHB1dF9idWZmZXJzKTtcbiAgICAgIGFkZFRleHRzVG9PdXRwdXQoW2BTcGxpdCByZXN1bHRzIGZvciBcIiR7bmFtZX1cImAsICcnLCBgU2l6ZTogJHtzaXplX2lucHV0fWBdKTtcbiAgICB9XG4gIH0pO1xufVxuXG5hc3luYyBmdW5jdGlvbiBhZGRJbWFnZXNUb091dHB1dChidWZmZXJzOiBVaW50OEFycmF5W10pIHtcbiAgY29uc3QgaW1ncyA9IFtdO1xuICBmb3IgKGNvbnN0IGJ1ZmZlciBvZiBidWZmZXJzKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGltZ191cmwgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKG5ldyBCbG9iKFtidWZmZXJdLCB7IHR5cGU6ICdpbWFnZS9wbmcnIH0pKTtcbiAgICAgIGNvbnN0IGltZyA9IGF3YWl0IG5ldyBQcm9taXNlPEhUTUxJbWFnZUVsZW1lbnQ+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgY29uc3QgaW1nID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW1nJyk7XG4gICAgICAgIGltZy5zcmMgPSBpbWdfdXJsO1xuICAgICAgICBpbWcuYWRkRXZlbnRMaXN0ZW5lcignbG9hZCcsICgpID0+IHJlc29sdmUoaW1nKSk7XG4gICAgICAgIGltZy5hZGRFdmVudExpc3RlbmVyKCdlcnJvcicsIHJlamVjdCk7XG4gICAgICB9KTtcbiAgICAgIGltZ3MucHVzaChpbWcpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBDb25zb2xlRXJyb3IoZXJyb3IpO1xuICAgIH1cbiAgfVxuICBpZiAob3V0cHV0X2NvbnRhaW5lcikge1xuICAgIG91dHB1dF9jb250YWluZXIuY2xhc3NMaXN0LnJlbW92ZSgncmVtb3ZlJyk7XG4gICAgZm9yIChjb25zdCBnYXAgb2Ygb3V0cHV0X2NvbnRhaW5lcl9nYXBzID8/IFtdKSB7XG4gICAgICBnYXAuY2xhc3NMaXN0LnJlbW92ZSgncmVtb3ZlJyk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgaW1nIG9mIGltZ3MucmV2ZXJzZSgpKSB7XG4gICAgICBvdXRwdXRfY29udGFpbmVyLnByZXBlbmQoaW1nKTtcbiAgICB9XG4gICAgaW1ncy5hdCgtMSk/LnNjcm9sbEludG9WaWV3KGZhbHNlKTtcbiAgfVxuICByZXR1cm4gaW1ncztcbn1cblxuZnVuY3Rpb24gYWRkVGV4dHNUb091dHB1dCh0ZXh0czogTjxzdHJpbmc+LCBpc19lcnJvciA9IGZhbHNlKSB7XG4gIHRyeSB7XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KHRleHRzKSkge1xuICAgICAgdGV4dHMgPSBbdGV4dHNdO1xuICAgIH1cbiAgICBpZiAob3V0cHV0X2NvbnRhaW5lcikge1xuICAgICAgb3V0cHV0X2NvbnRhaW5lci5jbGFzc0xpc3QucmVtb3ZlKCdyZW1vdmUnKTtcbiAgICAgIGZvciAoY29uc3QgZ2FwIG9mIG91dHB1dF9jb250YWluZXJfZ2FwcyA/PyBbXSkge1xuICAgICAgICBnYXAuY2xhc3NMaXN0LnJlbW92ZSgncmVtb3ZlJyk7XG4gICAgICB9XG4gICAgICBjb25zdCBkaXZfb3V0ZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgIGNvbnN0IGRpdl9pbm5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgY29uc3QgcHJlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgncHJlJyk7XG4gICAgICBwcmUudGV4dENvbnRlbnQgPSB0ZXh0cy5qb2luKCdcXG4nKTtcbiAgICAgIGlmIChpc19lcnJvcikge1xuICAgICAgICBwcmUuY2xhc3NMaXN0LmFkZCgnZXJyb3ItbWVzc2FnZScpO1xuICAgICAgICBjb25zdCBkZWxldGVfYnV0dG9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgIGRlbGV0ZV9idXR0b24uY2xhc3NMaXN0LmFkZCgnZGVsZXRlLW91dHB1dCcpO1xuICAgICAgICBkZWxldGVfYnV0dG9uLnRleHRDb250ZW50ID0gJ1gnO1xuICAgICAgICBkaXZfaW5uZXIuYXBwZW5kQ2hpbGQoZGVsZXRlX2J1dHRvbik7XG4gICAgICAgIGRlbGV0ZV9idXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgZGl2X291dGVyLnJlbW92ZSgpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGRpdl9pbm5lci5hcHBlbmRDaGlsZChwcmUpO1xuICAgICAgZGl2X291dGVyLmFwcGVuZENoaWxkKGRpdl9pbm5lcik7XG4gICAgICBvdXRwdXRfY29udGFpbmVyLnByZXBlbmQoZGl2X291dGVyKTtcbiAgICAgIGRpdl9vdXRlci5zY3JvbGxJbnRvVmlldyhmYWxzZSk7XG4gICAgICByZXR1cm4gZGl2X291dGVyO1xuICAgIH1cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBDb25zb2xlRXJyb3IoZXJyb3IpO1xuICB9XG59XG4iCiAgXSwKICAibWFwcGluZ3MiOiAiO0FBQUEsZUFBc0IsS0FBSyxDQUFDLElBQVk7QUFDdEMsUUFBTSxJQUFJLFFBQVEsQ0FBQyxZQUFZLFdBQVcs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QUFPLENBQUM7QUFBQSxNQUN0RDtBQUFBLGFBQ08sT0FBUDtBQUNBLG1CQUFhLEtBQUs7QUFBQTtBQUFBLEdBRXJCO0FBQ0g7QUFDQSxJQUFJLHFCQUFxQixtQkFBbUI7QUFDMUMsWUFBVSxXQUFXO0FBQ3JCLFlBQVUsaUJBQWlCLFNBQVMsWUFBWTtBQUM5QyxVQUFNLFFBQVEsTUFBTSxTQUFTLGFBQWE7QUFDMUMsVUFBTSxPQUFPLGVBQWU7QUFDNUIsUUFBSSxPQUFPO0FBQ1QsWUFBTSxhQUFhLFNBQVMsY0FBYyxhQUFhO0FBQ3ZELFlBQU0sT0FBTyxzQkFBc0IsbUJBQW1CLE9BQU8sU0FBUyxXQUFXLFNBQVMsTUFBTSxJQUFJO0FBQ3BHLFlBQU0saUJBQWlCLE1BQU0sU0FBUyxPQUFPLElBQUk7QUFDakQsWUFBTSxrQkFBa0IsY0FBYztBQUN0Qyx1QkFBaUIsQ0FBQyxzQkFBc0IsU0FBUyxJQUFJLFNBQVMsWUFBWSxDQUFDO0FBQUEsSUFDN0U7QUFBQSxHQUNEO0FBQ0g7IiwKICAiZGVidWdJZCI6ICJGQTkzNEFGMUE2QTBDNjRCNjQ3NTZFMjE2NDc1NkUyMSIsCiAgIm5hbWVzIjogW10KfQ==
