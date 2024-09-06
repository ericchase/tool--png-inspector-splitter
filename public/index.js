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
      if (true) {
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
        if (true) {
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

//# debugId=83D371CAF7279EF564756E2164756E21
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjXFxsaWJcXGVyaWNjaGFzZVxcQWxnb3JpdGhtXFxTbGVlcC50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxEZXNpZ24gUGF0dGVyblxcT2JzZXJ2ZXJcXFN0b3JlLnRzIiwgInNyY1xcbGliXFxlcmljY2hhc2VcXFV0aWxpdHlcXENvbnNvbGUudHMiLCAic3JjXFxsaWJcXGVyaWNjaGFzZVxcVXRpbGl0eVxcSm9iUXVldWUudHMiLCAic3JjXFxsaWJcXGVyaWNjaGFzZVxcVXRpbGl0eVxcUmVjdXJzaXZlQXN5bmNJdGVyYXRvci50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxXZWIgQVBJXFxEYXRhVHJhbnNmZXIudHMiLCAic3JjXFxsaWJcXGVyaWNjaGFzZVxcQWxnb3JpdGhtXFxBcnJheVxcVWludDhBcnJheS50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxBbGdvcml0aG1cXFN0cmVhbVxcUmVhZEFsbC50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxXZWIgQVBJXFxGaWxlLnRzIiwgInNyY1xcbGliXFxlcmljY2hhc2VcXFdlYiBBUElcXEZpbGVTeXN0ZW1fVXRpbGl0eS50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxXZWIgQVBJXFxIVE1MSW5wdXRFbGVtZW50LnRzIiwgInNyY1xcY29tcG9uZW50c1xcZHJhZy1hbmQtZHJvcC1maWxlLXBpY2tlclxcZHJhZy1hbmQtZHJvcC1maWxlLXBpY2tlci50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxBbGdvcml0aG1cXE1hdGhcXENSQy50cyIsICJub2RlX21vZHVsZXNcXHBha29cXGRpc3RcXHBha28uZXNtLm1qcyIsICJzcmNcXGxpYlxccG5nLnRzIiwgInNyY1xcbGliXFxwbmctaW5zcGVjdC50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxBbGdvcml0aG1cXEFycmF5XFxBcnJheS50cyIsICJzcmNcXGxpYlxccG5nLXNwbGl0LnRzIiwgInNyY1xcaW5kZXgudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbCiAgICAiZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIFNsZWVwKG1zOiBudW1iZXIpIHtcbiAgYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgbXMpKTtcbn1cbiIsCiAgICAiZXhwb3J0IHR5cGUgU3Vic2NyaXB0aW9uQ2FsbGJhY2s8VmFsdWU+ID0gKHZhbHVlOiBWYWx1ZSwgdW5zdWJzY3JpYmU6ICgpID0+IHZvaWQpID0+IHZvaWQ7XG5leHBvcnQgdHlwZSBVcGRhdGVDYWxsYmFjazxWYWx1ZT4gPSAodmFsdWU6IFZhbHVlKSA9PiBWYWx1ZTtcblxuZXhwb3J0IGNsYXNzIENvbnN0PFZhbHVlPiB7XG4gIHByb3RlY3RlZCBzdWJzY3JpcHRpb25TZXQgPSBuZXcgU2V0PFN1YnNjcmlwdGlvbkNhbGxiYWNrPFZhbHVlPj4oKTtcbiAgY29uc3RydWN0b3IocHJvdGVjdGVkIHZhbHVlPzogVmFsdWUpIHt9XG4gIHN1YnNjcmliZShjYWxsYmFjazogU3Vic2NyaXB0aW9uQ2FsbGJhY2s8VmFsdWU+KTogKCkgPT4gdm9pZCB7XG4gICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuYWRkKGNhbGxiYWNrKTtcbiAgICBpZiAodGhpcy52YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBjYWxsYmFjayh0aGlzLnZhbHVlLCAoKSA9PiB7XG4gICAgICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmRlbGV0ZShjYWxsYmFjayk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmRlbGV0ZShjYWxsYmFjayk7XG4gICAgfTtcbiAgfVxuICBnZXQoKTogUHJvbWlzZTxWYWx1ZT4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZTxWYWx1ZT4oKHJlc29sdmUpID0+IHtcbiAgICAgIHRoaXMuc3Vic2NyaWJlKCh2YWx1ZSwgdW5zdWJzY3JpYmUpID0+IHtcbiAgICAgICAgdW5zdWJzY3JpYmUoKTtcbiAgICAgICAgcmVzb2x2ZSh2YWx1ZSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuICBzZXQodmFsdWU6IFZhbHVlKTogdm9pZCB7XG4gICAgaWYgKHRoaXMudmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuICAgICAgZm9yIChjb25zdCBjYWxsYmFjayBvZiB0aGlzLnN1YnNjcmlwdGlvblNldCkge1xuICAgICAgICBjYWxsYmFjayh2YWx1ZSwgKCkgPT4ge1xuICAgICAgICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmRlbGV0ZShjYWxsYmFjayk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgU3RvcmU8VmFsdWU+IHtcbiAgcHJvdGVjdGVkIGN1cnJlbnRWYWx1ZTogVmFsdWU7XG4gIHByb3RlY3RlZCBzdWJzY3JpcHRpb25TZXQgPSBuZXcgU2V0PFN1YnNjcmlwdGlvbkNhbGxiYWNrPFZhbHVlPj4oKTtcbiAgY29uc3RydWN0b3IoXG4gICAgcHJvdGVjdGVkIGluaXRpYWxWYWx1ZTogVmFsdWUsXG4gICAgcHJvdGVjdGVkIG5vdGlmeU9uQ2hhbmdlT25seTogYm9vbGVhbiA9IGZhbHNlLFxuICApIHtcbiAgICB0aGlzLmN1cnJlbnRWYWx1ZSA9IGluaXRpYWxWYWx1ZTtcbiAgfVxuICBzdWJzY3JpYmUoY2FsbGJhY2s6IFN1YnNjcmlwdGlvbkNhbGxiYWNrPFZhbHVlPik6ICgpID0+IHZvaWQge1xuICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmFkZChjYWxsYmFjayk7XG4gICAgY29uc3QgdW5zdWJzY3JpYmUgPSAoKSA9PiB7XG4gICAgICB0aGlzLnN1YnNjcmlwdGlvblNldC5kZWxldGUoY2FsbGJhY2spO1xuICAgIH07XG4gICAgY2FsbGJhY2sodGhpcy5jdXJyZW50VmFsdWUsIHVuc3Vic2NyaWJlKTtcbiAgICByZXR1cm4gdW5zdWJzY3JpYmU7XG4gIH1cbiAgZ2V0KCk6IFByb21pc2U8VmFsdWU+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2U8VmFsdWU+KChyZXNvbHZlKSA9PiB7XG4gICAgICB0aGlzLnN1YnNjcmliZSgodmFsdWUsIHVuc3Vic2NyaWJlKSA9PiB7XG4gICAgICAgIHVuc3Vic2NyaWJlKCk7XG4gICAgICAgIHJlc29sdmUodmFsdWUpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbiAgc2V0KHZhbHVlOiBWYWx1ZSk6IHZvaWQge1xuICAgIGlmICh0aGlzLm5vdGlmeU9uQ2hhbmdlT25seSAmJiB0aGlzLmN1cnJlbnRWYWx1ZSA9PT0gdmFsdWUpIHJldHVybjtcbiAgICB0aGlzLmN1cnJlbnRWYWx1ZSA9IHZhbHVlO1xuICAgIGZvciAoY29uc3QgY2FsbGJhY2sgb2YgdGhpcy5zdWJzY3JpcHRpb25TZXQpIHtcbiAgICAgIGNhbGxiYWNrKHZhbHVlLCAoKSA9PiB7XG4gICAgICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmRlbGV0ZShjYWxsYmFjayk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cbiAgdXBkYXRlKGNhbGxiYWNrOiBVcGRhdGVDYWxsYmFjazxWYWx1ZT4pOiB2b2lkIHtcbiAgICB0aGlzLnNldChjYWxsYmFjayh0aGlzLmN1cnJlbnRWYWx1ZSkpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBPcHRpb25hbDxWYWx1ZT4ge1xuICBwcm90ZWN0ZWQgc3RvcmU6IFN0b3JlPFZhbHVlIHwgdW5kZWZpbmVkPjtcbiAgY29uc3RydWN0b3Iobm90aWZ5T25DaGFuZ2VPbmx5ID0gZmFsc2UpIHtcbiAgICB0aGlzLnN0b3JlID0gbmV3IFN0b3JlPFZhbHVlIHwgdW5kZWZpbmVkPih1bmRlZmluZWQsIG5vdGlmeU9uQ2hhbmdlT25seSk7XG4gIH1cbiAgc3Vic2NyaWJlKGNhbGxiYWNrOiBTdWJzY3JpcHRpb25DYWxsYmFjazxWYWx1ZSB8IHVuZGVmaW5lZD4pOiAoKSA9PiB2b2lkIHtcbiAgICByZXR1cm4gdGhpcy5zdG9yZS5zdWJzY3JpYmUoY2FsbGJhY2spO1xuICB9XG4gIGdldCgpOiBQcm9taXNlPFZhbHVlIHwgdW5kZWZpbmVkPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPFZhbHVlIHwgdW5kZWZpbmVkPigocmVzb2x2ZSkgPT4ge1xuICAgICAgdGhpcy5zdWJzY3JpYmUoKHZhbHVlLCB1bnN1YnNjcmliZSkgPT4ge1xuICAgICAgICB1bnN1YnNjcmliZSgpO1xuICAgICAgICByZXNvbHZlKHZhbHVlKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG4gIHNldCh2YWx1ZTogVmFsdWUgfCB1bmRlZmluZWQpOiB2b2lkIHtcbiAgICB0aGlzLnN0b3JlLnNldCh2YWx1ZSk7XG4gIH1cbiAgdXBkYXRlKGNhbGxiYWNrOiBVcGRhdGVDYWxsYmFjazxWYWx1ZSB8IHVuZGVmaW5lZD4pOiB2b2lkIHtcbiAgICB0aGlzLnN0b3JlLnVwZGF0ZShjYWxsYmFjayk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIENvbXBvdW5kU3Vic2NyaXB0aW9uPFQgZXh0ZW5kcyBhbnlbXT4oc3RvcmVzOiB7IFtLIGluIGtleW9mIFRdOiBTdG9yZTxUW0tdPiB8IE9wdGlvbmFsPFRbS10+IH0sIGNhbGxiYWNrOiBTdWJzY3JpcHRpb25DYWxsYmFjazx7IFtLIGluIGtleW9mIFRdOiBUW0tdIHwgdW5kZWZpbmVkIH0+KTogKCkgPT4gdm9pZCB7XG4gIGNvbnN0IHVuc3ViczogKCgpID0+IHZvaWQpW10gPSBbXTtcbiAgY29uc3QgdW5zdWJzY3JpYmUgPSAoKSA9PiB7XG4gICAgZm9yIChjb25zdCB1bnN1YiBvZiB1bnN1YnMpIHtcbiAgICAgIHVuc3ViKCk7XG4gICAgfVxuICB9O1xuICBjb25zdCB2YWx1ZXMgPSBbXSBhcyB7IFtLIGluIGtleW9mIFRdOiBUW0tdIHwgdW5kZWZpbmVkIH07XG4gIGNvbnN0IGNhbGxiYWNrX2hhbmRsZXIgPSAoKSA9PiB7XG4gICAgaWYgKHZhbHVlcy5sZW5ndGggPT09IHN0b3Jlcy5sZW5ndGgpIHtcbiAgICAgIGNhbGxiYWNrKHZhbHVlcywgdW5zdWJzY3JpYmUpO1xuICAgIH1cbiAgfTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdG9yZXMubGVuZ3RoOyBpKyspIHtcbiAgICBzdG9yZXNbaV0uc3Vic2NyaWJlKCh2YWx1ZSwgdW5zdWJzY3JpYmUpID0+IHtcbiAgICAgIHZhbHVlc1tpXSA9IHZhbHVlO1xuICAgICAgdW5zdWJzW2ldID0gdW5zdWJzY3JpYmU7XG4gICAgICBpZiAodmFsdWVzLmxlbmd0aCA9PT0gc3RvcmVzLmxlbmd0aCkge1xuICAgICAgICBjYWxsYmFja19oYW5kbGVyKCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbiAgcmV0dXJuIHVuc3Vic2NyaWJlO1xufVxuIiwKICAgICJleHBvcnQgZnVuY3Rpb24gQ29uc29sZUxvZyguLi5pdGVtczogYW55W10pIHtcbiAgY29uc29sZVsnbG9nJ10oLi4uaXRlbXMpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIENvbnNvbGVFcnJvciguLi5pdGVtczogYW55W10pIHtcbiAgY29uc29sZVsnZXJyb3InXSguLi5pdGVtcyk7XG59XG4iLAogICAgImltcG9ydCB7IFN0b3JlIH0gZnJvbSAnLi4vRGVzaWduIFBhdHRlcm4vT2JzZXJ2ZXIvU3RvcmUuanMnO1xuaW1wb3J0IHsgQ29uc29sZUxvZyB9IGZyb20gJy4vQ29uc29sZS5qcyc7XG5cbmV4cG9ydCB0eXBlIFN1YnNjcmlwdGlvbkNhbGxiYWNrPFJlc3VsdCwgVGFnPiA9IChyZXN1bHQ/OiBSZXN1bHQsIGVycm9yPzogRXJyb3IsIHRhZz86IFRhZykgPT4geyBhYm9ydDogYm9vbGVhbiB9IHwgdm9pZDtcblxuZXhwb3J0IGNsYXNzIEpvYlF1ZXVlPFJlc3VsdCA9IHZvaWQsIFRhZyA9IHZvaWQ+IHtcbiAgLyoqXG4gICAqIDA6IE5vIGRlbGF5LiAtMTogQ29uc2VjdXRpdmUuXG4gICAqL1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgZGVsYXlfbXM6IG51bWJlcikge31cbiAgLyoqXG4gICAqICEgV2F0Y2ggb3V0IGZvciBjaXJjdWxhciBjYWxscyAhXG4gICAqXG4gICAqIFNldHMgdGhlIGBhYm9ydGVkYCBzdGF0ZSBhbmQgcmVzb2x2ZXMgd2hlbiBjdXJyZW50bHkgcnVubmluZyBqb2JzIGZpbmlzaC5cbiAgICovXG4gIHB1YmxpYyBhc3luYyBhYm9ydCgpIHtcbiAgICB0aGlzLmFib3J0ZWQgPSB0cnVlO1xuICAgIGF3YWl0IHRoaXMuZG9uZTtcbiAgfVxuICBwdWJsaWMgYWRkKGZuOiAoKSA9PiBQcm9taXNlPFJlc3VsdD4sIHRhZz86IFRhZykge1xuICAgIGlmICh0aGlzLmFib3J0ZWQgPT09IGZhbHNlKSB7XG4gICAgICB0aGlzLnF1ZXVlLnB1c2goeyBmbiwgdGFnIH0pO1xuICAgICAgaWYgKHRoaXMucnVubmluZyA9PT0gZmFsc2UpIHtcbiAgICAgICAgdGhpcy5ydW5uaW5nID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5ydW4oKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgLyoqXG4gICAqIFJldHVybnMgYSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2hlbiBqb2JzIGZpbmlzaC5cbiAgICovXG4gIHB1YmxpYyBnZXQgZG9uZSgpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUpID0+IHtcbiAgICAgIHRoaXMucnVubmluZ0NvdW50LnN1YnNjcmliZSgoY291bnQpID0+IHtcbiAgICAgICAgaWYgKGNvdW50ID09PSAwKSByZXNvbHZlKCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuICAvKipcbiAgICogUmVzZXRzIHRoZSBKb2JRdWV1ZSB0byBhbiBpbml0aWFsIHN0YXRlLCBrZWVwaW5nIHN1YnNjcmlwdGlvbnMgYWxpdmUuXG4gICAqXG4gICAqIEB0aHJvd3MgSWYgY2FsbGVkIHdoZW4gam9icyBhcmUgY3VycmVudGx5IHJ1bm5pbmcuXG4gICAqL1xuICBwdWJsaWMgYXN5bmMgcmVzZXQoKSB7XG4gICAgaWYgKHRoaXMucnVubmluZyA9PT0gdHJ1ZSB8fCAoYXdhaXQgdGhpcy5ydW5uaW5nQ291bnQuZ2V0KCkpID4gMCkge1xuICAgICAgdGhyb3cgJ1dhcm5pbmc6IFdhaXQgZm9yIHJ1bm5pbmcgam9icyB0byBmaW5pc2ggYmVmb3JlIGNhbGxpbmcgcmVzZXQuIGBhd2FpdCBKb2JRdWV1ZS5kb25lO2AnO1xuICAgIH1cbiAgICB0aGlzLmFib3J0ZWQgPSBmYWxzZTtcbiAgICB0aGlzLmNvbXBsZXRpb25Db3VudCA9IDA7XG4gICAgdGhpcy5xdWV1ZS5sZW5ndGggPSAwO1xuICAgIHRoaXMucXVldWVJbmRleCA9IDA7XG4gICAgdGhpcy5yZXN1bHRzLmxlbmd0aCA9IDA7XG4gIH1cbiAgcHVibGljIHN1YnNjcmliZShjYWxsYmFjazogU3Vic2NyaXB0aW9uQ2FsbGJhY2s8UmVzdWx0LCBUYWc+KTogKCkgPT4gdm9pZCB7XG4gICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuYWRkKGNhbGxiYWNrKTtcbiAgICBmb3IgKGNvbnN0IHJlc3VsdCBvZiB0aGlzLnJlc3VsdHMpIHtcbiAgICAgIGlmIChjYWxsYmFjayhyZXN1bHQudmFsdWUsIHJlc3VsdC5lcnJvcik/LmFib3J0ID09PSB0cnVlKSB7XG4gICAgICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmRlbGV0ZShjYWxsYmFjayk7XG4gICAgICAgIHJldHVybiAoKSA9PiB7fTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmRlbGV0ZShjYWxsYmFjayk7XG4gICAgfTtcbiAgfVxuICBwcm90ZWN0ZWQgYWJvcnRlZCA9IGZhbHNlO1xuICBwcm90ZWN0ZWQgY29tcGxldGlvbkNvdW50ID0gMDtcbiAgcHJvdGVjdGVkIHF1ZXVlOiB7IGZuOiAoKSA9PiBQcm9taXNlPFJlc3VsdD47IHRhZz86IFRhZyB9W10gPSBbXTtcbiAgcHJvdGVjdGVkIHF1ZXVlSW5kZXggPSAwO1xuICBwcm90ZWN0ZWQgcmVzdWx0czogeyB2YWx1ZT86IFJlc3VsdDsgZXJyb3I/OiBFcnJvciB9W10gPSBbXTtcbiAgcHJvdGVjdGVkIHJ1bm5pbmcgPSBmYWxzZTtcbiAgcHJvdGVjdGVkIHJ1bm5pbmdDb3VudCA9IG5ldyBTdG9yZSgwKTtcbiAgcHJvdGVjdGVkIHN1YnNjcmlwdGlvblNldCA9IG5ldyBTZXQ8U3Vic2NyaXB0aW9uQ2FsbGJhY2s8UmVzdWx0LCBUYWc+PigpO1xuICBwcm90ZWN0ZWQgcnVuKCkge1xuICAgIGlmICh0aGlzLmFib3J0ZWQgPT09IGZhbHNlICYmIHRoaXMucXVldWVJbmRleCA8IHRoaXMucXVldWUubGVuZ3RoKSB7XG4gICAgICBjb25zdCB7IGZuLCB0YWcgfSA9IHRoaXMucXVldWVbdGhpcy5xdWV1ZUluZGV4KytdO1xuICAgICAgKGFzeW5jICgpID0+IHtcbiAgICAgICAgdGhpcy5ydW5uaW5nQ291bnQudXBkYXRlKChjb3VudCkgPT4ge1xuICAgICAgICAgIHJldHVybiBjb3VudCArIDE7XG4gICAgICAgIH0pO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHZhbHVlID0gYXdhaXQgZm4oKTtcbiAgICAgICAgICB0aGlzLnNlbmQoeyB2YWx1ZSwgdGFnIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgQ29uc29sZUxvZyhlcnJvcik7XG4gICAgICAgICAgdGhpcy5zZW5kKHsgZXJyb3IsIHRhZyB9KTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnJ1bm5pbmdDb3VudC51cGRhdGUoKGNvdW50KSA9PiB7XG4gICAgICAgICAgcmV0dXJuIGNvdW50IC0gMTtcbiAgICAgICAgfSk7XG4gICAgICAgIGlmICh0aGlzLmRlbGF5X21zIDwgMCkge1xuICAgICAgICAgIHRoaXMucnVuKCk7XG4gICAgICAgIH1cbiAgICAgIH0pKCk7XG4gICAgICBpZiAodGhpcy5kZWxheV9tcyA+PSAwKSB7XG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4gdGhpcy5ydW4oKSwgdGhpcy5kZWxheV9tcyk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucnVubmluZyA9IGZhbHNlO1xuICAgIH1cbiAgfVxuICBwcm90ZWN0ZWQgc2VuZChyZXN1bHQ6IHsgdmFsdWU/OiBSZXN1bHQ7IGVycm9yPzogRXJyb3I7IHRhZz86IFRhZyB9KSB7XG4gICAgaWYgKHRoaXMuYWJvcnRlZCA9PT0gZmFsc2UpIHtcbiAgICAgIHRoaXMuY29tcGxldGlvbkNvdW50Kys7XG4gICAgICB0aGlzLnJlc3VsdHMucHVzaChyZXN1bHQpO1xuICAgICAgZm9yIChjb25zdCBjYWxsYmFjayBvZiB0aGlzLnN1YnNjcmlwdGlvblNldCkge1xuICAgICAgICBpZiAoY2FsbGJhY2socmVzdWx0LnZhbHVlLCByZXN1bHQuZXJyb3IsIHJlc3VsdC50YWcpPy5hYm9ydCA9PT0gdHJ1ZSkge1xuICAgICAgICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmRlbGV0ZShjYWxsYmFjayk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiIsCiAgICAiaW1wb3J0IHR5cGUgeyBTeW5jQXN5bmNJdGVyYWJsZSB9IGZyb20gJy4vVHlwZXMuanMnO1xuXG5leHBvcnQgY2xhc3MgUmVjdXJzaXZlSXRlcmF0b3I8SW4sIE91dD4ge1xuICBjb25zdHJ1Y3Rvcihwcm90ZWN0ZWQgZm46ICh2YWx1ZTogU3luY0FzeW5jSXRlcmFibGU8SW4+LCBwdXNoOiAodmFsdWU6IFN5bmNBc3luY0l0ZXJhYmxlPEluPikgPT4gdm9pZCkgPT4gU3luY0FzeW5jSXRlcmFibGU8T3V0Pikge31cbiAgYXN5bmMgKml0ZXJhdGUoaW5pdDogU3luY0FzeW5jSXRlcmFibGU8SW4+KTogU3luY0FzeW5jSXRlcmFibGU8T3V0PiB7XG4gICAgY29uc3QgbGlzdDogU3luY0FzeW5jSXRlcmFibGU8SW4+W10gPSBbaW5pdF07XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IGZTRW50cnkgb2YgdGhpcy5mbihsaXN0W2ldLCAodmFsdWUpID0+IHtcbiAgICAgICAgbGlzdC5wdXNoKHZhbHVlKTtcbiAgICAgIH0pKSB7XG4gICAgICAgIHlpZWxkIGZTRW50cnk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iLAogICAgImltcG9ydCB0eXBlIHsgTiB9IGZyb20gJy4uL1V0aWxpdHkvVHlwZXMuanMnO1xuXG5leHBvcnQgY2xhc3MgRGF0YVRyYW5zZmVySXRlbUl0ZXJhdG9yIHtcbiAgbGlzdDogRGF0YVRyYW5zZmVySXRlbVtdID0gW107XG4gIGNvbnN0cnVjdG9yKGl0ZW1zPzogTjxEYXRhVHJhbnNmZXJJdGVtPiB8IERhdGFUcmFuc2Zlckl0ZW1MaXN0IHwgbnVsbCkge1xuICAgIGlmIChpdGVtcyBpbnN0YW5jZW9mIERhdGFUcmFuc2Zlckl0ZW0pIHtcbiAgICAgIHRoaXMubGlzdCA9IFtpdGVtc107XG4gICAgfSBlbHNlIGlmIChpdGVtcyBpbnN0YW5jZW9mIERhdGFUcmFuc2Zlckl0ZW1MaXN0KSB7XG4gICAgICB0aGlzLmxpc3QgPSBBcnJheS5mcm9tKGl0ZW1zKTtcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoaXRlbXMpKSB7XG4gICAgICB0aGlzLmxpc3QgPSBpdGVtcztcbiAgICB9XG4gIH1cbiAgKmdldEFzRW50cnkoKTogR2VuZXJhdG9yPEZpbGVTeXN0ZW1FbnRyeT4ge1xuICAgIGZvciAoY29uc3QgaXRlbSBvZiB0aGlzLmxpc3QpIHtcbiAgICAgIGNvbnN0IGVudHJ5ID0gKGl0ZW0gYXMgRGF0YVRyYW5zZmVySXRlbSAmIHsgZ2V0QXNFbnRyeT86IERhdGFUcmFuc2Zlckl0ZW1bJ3dlYmtpdEdldEFzRW50cnknXSB9KS5nZXRBc0VudHJ5Py4oKSA/PyBpdGVtLndlYmtpdEdldEFzRW50cnk/LigpO1xuICAgICAgaWYgKHR5cGVvZiBGaWxlU3lzdGVtRW50cnkgIT09ICd1bmRlZmluZWQnICYmIGVudHJ5IGluc3RhbmNlb2YgRmlsZVN5c3RlbUVudHJ5KSB7XG4gICAgICAgIHlpZWxkIGVudHJ5O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gVE9ETyBmaWd1cmUgb3V0IHdoYXQgbmVlZHMgdG8gYmUgZG9uZSB0byBndWFyZCB0aGlzIGZvciBjaHJvbWUgYW5kIG90aGVyIGJyb3dzZXJzXG4gICAgICAgIHlpZWxkIGVudHJ5IGFzIEZpbGVTeXN0ZW1FbnRyeTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgKmdldEFzRmlsZSgpOiBHZW5lcmF0b3I8RmlsZT4ge1xuICAgIGZvciAoY29uc3QgaXRlbSBvZiB0aGlzLmxpc3QpIHtcbiAgICAgIGNvbnN0IGZpbGUgPSBpdGVtLmdldEFzRmlsZT8uKCk7XG4gICAgICBpZiAoZmlsZSBpbnN0YW5jZW9mIEZpbGUpIHtcbiAgICAgICAgeWllbGQgZmlsZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgYXN5bmMgKmdldEFzU3RyaW5nKCk6IEFzeW5jR2VuZXJhdG9yPHN0cmluZz4ge1xuICAgIGZvciAoY29uc3QgaXRlbSBvZiB0aGlzLmxpc3QpIHtcbiAgICAgIHlpZWxkIGF3YWl0IG5ldyBQcm9taXNlPHN0cmluZz4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBpZiAodHlwZW9mIGl0ZW0uZ2V0QXNTdHJpbmcgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICBpdGVtLmdldEFzU3RyaW5nKHJlc29sdmUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlamVjdCgpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn1cbiIsCiAgICAiZXhwb3J0IGZ1bmN0aW9uIFU4KGZyb206IEFycmF5TGlrZTxudW1iZXI+ID0gW10pOiBVaW50OEFycmF5IHtcbiAgcmV0dXJuIFVpbnQ4QXJyYXkuZnJvbShmcm9tKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIFU4Q2xhbXBlZChmcm9tOiBBcnJheUxpa2U8bnVtYmVyPiA9IFtdKTogVWludDhBcnJheSB7XG4gIHJldHVybiBVaW50OEFycmF5LmZyb20oVWludDhDbGFtcGVkQXJyYXkuZnJvbShmcm9tKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBVOENvbmNhdChhcnJheXM6IHJlYWRvbmx5IFVpbnQ4QXJyYXlbXSk6IFVpbnQ4QXJyYXkge1xuICBsZXQgdG90YWxMZW5ndGggPSAwO1xuICBmb3IgKGNvbnN0IGFycmF5IG9mIGFycmF5cykge1xuICAgIHRvdGFsTGVuZ3RoICs9IGFycmF5Lmxlbmd0aDtcbiAgfVxuICBjb25zdCByZXN1bHQgPSBuZXcgVWludDhBcnJheSh0b3RhbExlbmd0aCk7XG4gIGxldCBvZmZzZXQgPSAwO1xuICBmb3IgKGNvbnN0IGFycmF5IG9mIGFycmF5cykge1xuICAgIHJlc3VsdC5zZXQoYXJyYXksIG9mZnNldCk7XG4gICAgb2Zmc2V0ICs9IGFycmF5Lmxlbmd0aDtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gVThDb3B5KGJ5dGVzOiBVaW50OEFycmF5LCBjb3VudDogbnVtYmVyLCBvZmZzZXQgPSAwKTogVWludDhBcnJheSB7XG4gIHJldHVybiBieXRlcy5zbGljZShvZmZzZXQsIG9mZnNldCArIGNvdW50KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIFU4RnJvbVN0cmluZyhmcm9tOiBzdHJpbmcpIHtcbiAgcmV0dXJuIG5ldyBUZXh0RW5jb2RlcigpLmVuY29kZShmcm9tKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIFU4RnJvbVVpbnQzMihmcm9tOiBudW1iZXIpOiBVaW50OEFycmF5IHtcbiAgY29uc3QgdThzID0gbmV3IFVpbnQ4QXJyYXkoNCk7XG4gIGNvbnN0IHZpZXcgPSBuZXcgRGF0YVZpZXcodThzLmJ1ZmZlcik7XG4gIHZpZXcuc2V0VWludDMyKDAsIGZyb20gPj4+IDAsIGZhbHNlKTtcbiAgcmV0dXJuIHU4cztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIFU4U3BsaXQoYnl0ZXM6IFVpbnQ4QXJyYXksIGNvdW50OiBudW1iZXIpOiBVaW50OEFycmF5W10ge1xuICBpZiAoY291bnQgPiBieXRlcy5ieXRlTGVuZ3RoKSB7XG4gICAgcmV0dXJuIFtieXRlcy5zbGljZSgpXTtcbiAgfVxuICBpZiAoY291bnQgPiAwKSB7XG4gICAgY29uc3QgcGFydHM6IFVpbnQ4QXJyYXlbXSA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYnl0ZXMubGVuZ3RoOyBpICs9IGNvdW50KSB7XG4gICAgICBwYXJ0cy5wdXNoKGJ5dGVzLnNsaWNlKGksIGkgKyBjb3VudCkpO1xuICAgIH1cbiAgICByZXR1cm4gcGFydHM7XG4gIH1cbiAgcmV0dXJuIFtieXRlcy5zbGljZSgpXTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIFU4VGFrZShieXRlczogVWludDhBcnJheSwgY291bnQ6IG51bWJlcik6IFtVaW50OEFycmF5LCBVaW50OEFycmF5XSB7XG4gIGlmIChjb3VudCA+IGJ5dGVzLmJ5dGVMZW5ndGgpIHtcbiAgICByZXR1cm4gW2J5dGVzLnNsaWNlKCksIG5ldyBVaW50OEFycmF5KCldO1xuICB9XG4gIGlmIChjb3VudCA+IDApIHtcbiAgICBjb25zdCBjaHVua0EgPSBieXRlcy5zbGljZSgwLCBjb3VudCk7XG4gICAgY29uc3QgY2h1bmtCID0gYnl0ZXMuc2xpY2UoY291bnQpO1xuICAgIHJldHVybiBbY2h1bmtBLCBjaHVua0JdO1xuICB9XG4gIHJldHVybiBbbmV3IFVpbnQ4QXJyYXkoKSwgYnl0ZXMuc2xpY2UoKV07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBVOFRha2VFbmQoYnl0ZXM6IFVpbnQ4QXJyYXksIGNvdW50OiBudW1iZXIpOiBbVWludDhBcnJheSwgVWludDhBcnJheV0ge1xuICBpZiAoY291bnQgPiBieXRlcy5ieXRlTGVuZ3RoKSB7XG4gICAgcmV0dXJuIFtieXRlcy5zbGljZSgpLCBuZXcgVWludDhBcnJheSgpXTtcbiAgfVxuICBpZiAoY291bnQgPiAwKSB7XG4gICAgY29uc3QgY2h1bmtBID0gYnl0ZXMuc2xpY2UoYnl0ZXMuYnl0ZUxlbmd0aCAtIGNvdW50KTtcbiAgICBjb25zdCBjaHVua0IgPSBieXRlcy5zbGljZSgwLCBieXRlcy5ieXRlTGVuZ3RoIC0gY291bnQpO1xuICAgIHJldHVybiBbY2h1bmtBLCBjaHVua0JdO1xuICB9XG4gIHJldHVybiBbbmV3IFVpbnQ4QXJyYXkoKSwgYnl0ZXMuc2xpY2UoKV07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBVOFRvQVNDSUkoYnl0ZXM6IFVpbnQ4QXJyYXkpOiBzdHJpbmcge1xuICByZXR1cm4gQXJyYXkuZnJvbShieXRlcylcbiAgICAubWFwKChieXRlKSA9PiBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ5dGUgPj4+IDApKVxuICAgIC5qb2luKCcnKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIFU4VG9EZWNpbWFsKGJ5dGVzOiBVaW50OEFycmF5KTogc3RyaW5nW10ge1xuICByZXR1cm4gQXJyYXkuZnJvbShieXRlcykubWFwKChieXRlKSA9PiAoYnl0ZSA+Pj4gMCkudG9TdHJpbmcoMTApKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIFU4VG9IZXgoYnl0ZXM6IFVpbnQ4QXJyYXkpOiBzdHJpbmdbXSB7XG4gIHJldHVybiBBcnJheS5mcm9tKGJ5dGVzKS5tYXAoKGJ5dGUpID0+IChieXRlID4+PiAwKS50b1N0cmluZygxNikucGFkU3RhcnQoMiwgJzAnKSk7XG59XG4iLAogICAgImltcG9ydCB7IFU4Q29uY2F0IH0gZnJvbSAnLi4vQXJyYXkvVWludDhBcnJheS5qcyc7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBVOFN0cmVhbVJlYWRBbGwoc3RyZWFtOiBSZWFkYWJsZVN0cmVhbTxVaW50OEFycmF5Pikge1xuICBjb25zdCByZWFkZXIgPSBzdHJlYW0uZ2V0UmVhZGVyKCk7XG4gIGNvbnN0IGNodW5rczogVWludDhBcnJheVtdID0gW107XG4gIHdoaWxlICh0cnVlKSB7XG4gICAgY29uc3QgeyBkb25lLCB2YWx1ZSB9ID0gYXdhaXQgcmVhZGVyLnJlYWQoKTtcbiAgICBpZiAodmFsdWUpIHtcbiAgICAgIGNodW5rcy5wdXNoKHZhbHVlKTtcbiAgICB9XG4gICAgaWYgKGRvbmUpIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuICByZXR1cm4gVThDb25jYXQoY2h1bmtzKTtcbn1cbiIsCiAgICAiaW1wb3J0IHsgVThTdHJlYW1SZWFkQWxsIH0gZnJvbSAnLi4vQWxnb3JpdGhtL1N0cmVhbS9SZWFkQWxsLmpzJztcblxuZXhwb3J0IGZ1bmN0aW9uIEdldFdlYmtpdFJlbGF0aXZlUGF0aChmaWxlOiBGaWxlKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgaWYgKHR5cGVvZiBmaWxlLndlYmtpdFJlbGF0aXZlUGF0aCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICByZXR1cm4gZmlsZS53ZWJraXRSZWxhdGl2ZVBhdGg7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIEdldEJ5dGVzKGZpbGU/OiBGaWxlKSB7XG4gIGlmIChmaWxlKSB7XG4gICAgaWYgKHR5cGVvZiBmaWxlLmJ5dGVzICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgcmV0dXJuIGZpbGUuYnl0ZXMoKTtcbiAgICB9XG4gICAgcmV0dXJuIFU4U3RyZWFtUmVhZEFsbChmaWxlLnN0cmVhbSgpKTtcbiAgfVxufVxuIiwKICAgICJleHBvcnQgY2xhc3MgRmlsZVN5c3RlbUVudHJ5SXRlcmF0b3Ige1xuICBsaXN0OiBGaWxlU3lzdGVtRW50cnlbXSA9IFtdO1xuICBjb25zdHJ1Y3RvcihlbnRyaWVzPzogRmlsZVN5c3RlbUVudHJ5IHwgRmlsZVN5c3RlbUVudHJ5W10gfCBudWxsKSB7XG4gICAgaWYgKGVudHJpZXMpIHtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KGVudHJpZXMpKSB7XG4gICAgICAgIHRoaXMubGlzdCA9IGVudHJpZXM7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmxpc3QgPSBbZW50cmllc107XG4gICAgICB9XG4gICAgfVxuICB9XG4gICpnZXREaXJlY3RvcnlFbnRyeSgpOiBHZW5lcmF0b3I8RmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5PiB7XG4gICAgZm9yIChjb25zdCBlbnRyeSBvZiB0aGlzLmxpc3QpIHtcbiAgICAgIGlmIChlbnRyeS5pc0RpcmVjdG9yeSAmJiBlbnRyeSBpbnN0YW5jZW9mIEZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeSkge1xuICAgICAgICB5aWVsZCBlbnRyeTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgKmdldEZpbGVFbnRyeSgpOiBHZW5lcmF0b3I8RmlsZVN5c3RlbUZpbGVFbnRyeT4ge1xuICAgIGZvciAoY29uc3QgZW50cnkgb2YgdGhpcy5saXN0KSB7XG4gICAgICBpZiAodHlwZW9mIEZpbGVTeXN0ZW1GaWxlRW50cnkgIT09ICd1bmRlZmluZWQnICYmIGVudHJ5LmlzRmlsZSAmJiBlbnRyeSBpbnN0YW5jZW9mIEZpbGVTeXN0ZW1GaWxlRW50cnkpIHtcbiAgICAgICAgeWllbGQgZW50cnk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB5aWVsZCBlbnRyeSBhcyBGaWxlU3lzdGVtRmlsZUVudHJ5O1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5SXRlcmF0b3Ige1xuICBsaXN0OiBGaWxlU3lzdGVtRGlyZWN0b3J5RW50cnlbXSA9IFtdO1xuICBjb25zdHJ1Y3RvcihlbnRyaWVzPzogRmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5IHwgRmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5W10gfCBudWxsKSB7XG4gICAgaWYgKGVudHJpZXMgaW5zdGFuY2VvZiBGaWxlU3lzdGVtRGlyZWN0b3J5RW50cnkpIHtcbiAgICAgIHRoaXMubGlzdCA9IFtlbnRyaWVzXTtcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoZW50cmllcykpIHtcbiAgICAgIHRoaXMubGlzdCA9IGVudHJpZXM7XG4gICAgfVxuICB9XG4gIGFzeW5jICpnZXRFbnRyeSgpOiBBc3luY0dlbmVyYXRvcjxGaWxlU3lzdGVtRW50cnk+IHtcbiAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIHRoaXMubGlzdCkge1xuICAgICAgY29uc3QgcmVhZGVyID0gZW50cnkuY3JlYXRlUmVhZGVyKCk7XG4gICAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIGF3YWl0IG5ldyBQcm9taXNlPEZpbGVTeXN0ZW1FbnRyeVtdPigocmVzb2x2ZSwgcmVqZWN0KSA9PiByZWFkZXIucmVhZEVudHJpZXMocmVzb2x2ZSwgcmVqZWN0KSkpIHtcbiAgICAgICAgeWllbGQgZW50cnk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iLAogICAgIi8vIFdlYmtpdCBHdWFyZHNcblxuZXhwb3J0IGZ1bmN0aW9uIEdldFdlYmtpdEVudHJpZXMoZWxlbWVudDogSFRNTElucHV0RWxlbWVudCk6IHJlYWRvbmx5IEZpbGVTeXN0ZW1FbnRyeVtdIHwgdW5kZWZpbmVkIHtcbiAgcmV0dXJuIGVsZW1lbnQud2Via2l0RW50cmllcyA/PyB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBTdXBwb3J0c1dlYmtpdERpcmVjdG9yeSgpOiBib29sZWFuIHtcbiAgcmV0dXJuIC9hbmRyb2lkfGlwaG9uZXxtb2JpbGUvaS50ZXN0KHdpbmRvdy5uYXZpZ2F0b3IudXNlckFnZW50KSA9PT0gdHJ1ZSA/IGZhbHNlIDogdHJ1ZTtcbn1cbiIsCiAgICAiaW1wb3J0IHsgU2xlZXAgfSBmcm9tICcuLi8uLi9saWIvZXJpY2NoYXNlL0FsZ29yaXRobS9TbGVlcC5qcyc7XG5pbXBvcnQgeyBKb2JRdWV1ZSB9IGZyb20gJy4uLy4uL2xpYi9lcmljY2hhc2UvVXRpbGl0eS9Kb2JRdWV1ZS5qcyc7XG5pbXBvcnQgeyBSZWN1cnNpdmVJdGVyYXRvciB9IGZyb20gJy4uLy4uL2xpYi9lcmljY2hhc2UvVXRpbGl0eS9SZWN1cnNpdmVBc3luY0l0ZXJhdG9yLmpzJztcbmltcG9ydCB0eXBlIHsgU3luY0FzeW5jSXRlcmFibGUgfSBmcm9tICcuLi8uLi9saWIvZXJpY2NoYXNlL1V0aWxpdHkvVHlwZXMuanMnO1xuaW1wb3J0IHsgRGF0YVRyYW5zZmVySXRlbUl0ZXJhdG9yIH0gZnJvbSAnLi4vLi4vbGliL2VyaWNjaGFzZS9XZWIgQVBJL0RhdGFUcmFuc2Zlci5qcyc7XG5pbXBvcnQgeyBHZXRXZWJraXRSZWxhdGl2ZVBhdGggfSBmcm9tICcuLi8uLi9saWIvZXJpY2NoYXNlL1dlYiBBUEkvRmlsZS5qcyc7XG5pbXBvcnQgeyBGaWxlU3lzdGVtRGlyZWN0b3J5RW50cnlJdGVyYXRvciwgRmlsZVN5c3RlbUVudHJ5SXRlcmF0b3IgfSBmcm9tICcuLi8uLi9saWIvZXJpY2NoYXNlL1dlYiBBUEkvRmlsZVN5c3RlbV9VdGlsaXR5LmpzJztcbmltcG9ydCB7IEdldFdlYmtpdEVudHJpZXMsIFN1cHBvcnRzV2Via2l0RGlyZWN0b3J5IH0gZnJvbSAnLi4vLi4vbGliL2VyaWNjaGFzZS9XZWIgQVBJL0hUTUxJbnB1dEVsZW1lbnQuanMnO1xuXG5leHBvcnQgZnVuY3Rpb24gc2V0dXBEcmFnQW5kRHJvcEZpbGVQaWNrZXIoXG4gIGNvbnRhaW5lcjogRWxlbWVudCxcbiAgZm46IHtcbiAgICBvbkRyYWdFbmQ/OiAoKSA9PiB2b2lkO1xuICAgIG9uRHJhZ0VudGVyPzogKCkgPT4gdm9pZDtcbiAgICBvbkRyYWdMZWF2ZT86ICgpID0+IHZvaWQ7XG4gICAgb25Ecm9wPzogKCkgPT4gdm9pZDtcbiAgICBvblVwbG9hZEVuZD86ICgpID0+IHZvaWQgfCBQcm9taXNlPHZvaWQ+O1xuICAgIG9uVXBsb2FkRXJyb3I/OiAoZXJyb3I6IGFueSkgPT4gdm9pZCB8IFByb21pc2U8dm9pZD47XG4gICAgb25VcGxvYWROZXh0RmlsZTogKGZpbGU6IEZpbGUsIGRvbmU6ICgpID0+IHZvaWQpID0+IFByb21pc2U8dm9pZD4gfCB2b2lkO1xuICAgIG9uVXBsb2FkU3RhcnQ/OiAoKSA9PiB2b2lkIHwgUHJvbWlzZTx2b2lkPjtcbiAgfSxcbiAgb3B0aW9ucz86IHtcbiAgICBhY2NlcHQ/OiBzdHJpbmc7XG4gICAgZGlyZWN0b3J5PzogYm9vbGVhbjtcbiAgICBtdWx0aXBsZT86IGJvb2xlYW47XG4gIH0sXG4pIHtcbiAgY29uc3QgZWxlbWVudCA9IGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yKCdpbnB1dCcpO1xuICBpZiAoIWVsZW1lbnQpIHtcbiAgICB0aHJvdyAnZHJhZy1hbmQtZHJvcC1maWxlLXBpY2tlciBpbnB1dCBlbGVtZW50IG1pc3NpbmcnO1xuICB9XG4gIGlmIChvcHRpb25zPy5hY2NlcHQpIHtcbiAgICBlbGVtZW50LnNldEF0dHJpYnV0ZSgnYWNjZXB0Jywgb3B0aW9ucy5hY2NlcHQpO1xuICB9XG4gIGlmIChvcHRpb25zPy5kaXJlY3RvcnkgPT09IHRydWUgJiYgU3VwcG9ydHNXZWJraXREaXJlY3RvcnkoKSkge1xuICAgIGVsZW1lbnQudG9nZ2xlQXR0cmlidXRlKCd3ZWJraXRkaXJlY3RvcnknLCB0cnVlKTtcbiAgfVxuICBpZiAob3B0aW9ucz8ubXVsdGlwbGUgPT09IHRydWUpIHtcbiAgICBlbGVtZW50LnRvZ2dsZUF0dHJpYnV0ZSgnbXVsdGlwbGUnLCB0cnVlKTtcbiAgfVxuXG4gIGlmIChmbi5vbkRyYWdFbmQgfHwgZm4ub25EcmFnRW50ZXIgfHwgZm4ub25EcmFnTGVhdmUpIHtcbiAgICBjb25zdCByZW1vdmVMaXN0ZW5lcnMgPSAoKSA9PiB7XG4gICAgICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdsZWF2ZScsIGRyYWdsZWF2ZUhhbmRsZXIpO1xuICAgICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdkcmFnZW5kJywgZHJhZ2VuZEhhbmRsZXIpO1xuICAgICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdkcm9wJywgZHJvcEhhbmRsZXIpO1xuICAgIH07XG4gICAgY29uc3QgZHJhZ2VuZEhhbmRsZXIgPSAoKSA9PiB7XG4gICAgICByZW1vdmVMaXN0ZW5lcnMoKTtcbiAgICAgIGZuLm9uRHJhZ0VuZD8uKCk7XG4gICAgfTtcbiAgICBjb25zdCBkcmFnbGVhdmVIYW5kbGVyID0gKCkgPT4ge1xuICAgICAgcmVtb3ZlTGlzdGVuZXJzKCk7XG4gICAgICBmbi5vbkRyYWdMZWF2ZT8uKCk7XG4gICAgfTtcbiAgICBjb25zdCBkcm9wSGFuZGxlciA9ICgpID0+IHtcbiAgICAgIHJlbW92ZUxpc3RlbmVycygpO1xuICAgICAgZm4ub25Ecm9wPy4oKTtcbiAgICB9O1xuICAgIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ2VudGVyJywgKCkgPT4ge1xuICAgICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdkcmFnbGVhdmUnLCBkcmFnbGVhdmVIYW5kbGVyKTtcbiAgICAgIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ2VuZCcsIGRyYWdlbmRIYW5kbGVyKTtcbiAgICAgIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZHJvcCcsIGRyb3BIYW5kbGVyKTtcbiAgICAgIGZuLm9uRHJhZ0VudGVyPy4oKTtcbiAgICB9KTtcbiAgfVxuXG4gIGNvbnN0IGZTRW50cnlTZXQgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgY29uc3QgZlNFbnRyeUl0ZXJhdG9yID0gbmV3IFJlY3Vyc2l2ZUl0ZXJhdG9yPEZpbGVTeXN0ZW1FbnRyeSwgRmlsZVN5c3RlbUZpbGVFbnRyeT4oYXN5bmMgZnVuY3Rpb24qIChmU0VudHJ5SXRlcmF0b3IsIHB1c2gpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGZTRW50cnkgb2YgZlNFbnRyeUl0ZXJhdG9yKSB7XG4gICAgICBjb25zdCBwYXRoID0gZlNFbnRyeS5mdWxsUGF0aC5zbGljZSgxKTtcbiAgICAgIGlmICh0cnVlIHx8ICFmU0VudHJ5U2V0LmhhcyhwYXRoKSkge1xuICAgICAgICBmU0VudHJ5U2V0LmFkZChwYXRoKTtcbiAgICAgICAgY29uc3QgZnNFbnRyaWVzID0gbmV3IEZpbGVTeXN0ZW1FbnRyeUl0ZXJhdG9yKGZTRW50cnkpO1xuICAgICAgICBmb3IgKGNvbnN0IGZTRmlsZUVudHJ5IG9mIGZzRW50cmllcy5nZXRGaWxlRW50cnkoKSkge1xuICAgICAgICAgIHlpZWxkIGZTRmlsZUVudHJ5O1xuICAgICAgICB9XG4gICAgICAgIGZvciAoY29uc3QgZlNEaXJlY3RvcnlFbnRyeSBvZiBmc0VudHJpZXMuZ2V0RGlyZWN0b3J5RW50cnkoKSkge1xuICAgICAgICAgIHB1c2gobmV3IEZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeUl0ZXJhdG9yKGZTRGlyZWN0b3J5RW50cnkpLmdldEVudHJ5KCkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9KTtcblxuICBjb25zdCBqb2JRdWV1ZSA9IG5ldyBKb2JRdWV1ZTx2b2lkLCBzdHJpbmc+KC0xKTtcbiAgam9iUXVldWUuc3Vic2NyaWJlKChfLCBlcnJvcikgPT4ge1xuICAgIGlmIChlcnJvcikge1xuICAgICAgZm4/Lm9uVXBsb2FkRXJyb3I/LihlcnJvcik7XG4gICAgfVxuICB9KTtcblxuICBsZXQgZG9uZSA9IHRydWU7XG4gIGxldCBydW5uaW5nID0gZmFsc2U7XG4gIGNvbnN0IHVwbG9hZFN0YXJ0ID0gYXN5bmMgKCkgPT4ge1xuICAgIGlmIChydW5uaW5nID09PSBmYWxzZSkge1xuICAgICAgZG9uZSA9IGZhbHNlO1xuICAgICAgcnVubmluZyA9IHRydWU7XG4gICAgICBhd2FpdCBmbi5vblVwbG9hZFN0YXJ0Py4oKTtcbiAgICAgIC8vIGdpdmUgYnJvd3NlciBzb21lIHRpbWUgdG8gcXVldWUgYm90aCBldmVudHNcbiAgICAgIFNsZWVwKDUwMCkudGhlbihhc3luYyAoKSA9PiB7XG4gICAgICAgIGF3YWl0IGpvYlF1ZXVlLmRvbmU7XG4gICAgICAgIHVwbG9hZEVuZCgpO1xuICAgICAgfSk7XG4gICAgfVxuICB9O1xuICBjb25zdCB1cGxvYWRFbmQgPSBhc3luYyAoKSA9PiB7XG4gICAgZG9uZSA9IHRydWU7XG4gICAgcnVubmluZyA9IGZhbHNlO1xuICAgIGF3YWl0IGZuLm9uVXBsb2FkRW5kPy4oKTtcbiAgICBqb2JRdWV1ZS5yZXNldCgpO1xuICAgIGZTRW50cnlTZXQuY2xlYXIoKTtcbiAgfTtcbiAgY29uc3QgaXRlcmF0ZUZTRW50cmllcyA9IGFzeW5jIChlbnRyaWVzOiBTeW5jQXN5bmNJdGVyYWJsZTxGaWxlU3lzdGVtRW50cnk+LCBmaWxlczogRmlsZUxpc3QpID0+IHtcbiAgICBpZiAoZG9uZSA9PT0gZmFsc2UpIHtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgZlNGaWxlRW50cnkgb2YgZlNFbnRyeUl0ZXJhdG9yLml0ZXJhdGUoZW50cmllcykpIHtcbiAgICAgICAgY29uc3QgZmlsZSA9IGF3YWl0IG5ldyBQcm9taXNlPEZpbGU+KChyZXNvbHZlLCByZWplY3QpID0+IGZTRmlsZUVudHJ5LmZpbGUocmVzb2x2ZSwgcmVqZWN0KSk7XG4gICAgICAgIGF3YWl0IGZuLm9uVXBsb2FkTmV4dEZpbGUoZmlsZSwgKCkgPT4gKGRvbmUgPSB0cnVlKSk7XG4gICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgaWYgKGRvbmUgPT09IHRydWUpIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xuICAgICAgICBjb25zdCBwYXRoID0gR2V0V2Via2l0UmVsYXRpdmVQYXRoKGZpbGUpICsgZmlsZS5uYW1lO1xuICAgICAgICBpZiAodHJ1ZSB8fCAhZlNFbnRyeVNldC5oYXMocGF0aCkpIHtcbiAgICAgICAgICBmU0VudHJ5U2V0LmFkZChwYXRoKTtcbiAgICAgICAgICBhd2FpdCBmbi5vblVwbG9hZE5leHRGaWxlKGZpbGUsICgpID0+IChkb25lID0gdHJ1ZSkpO1xuICAgICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgICBpZiAoZG9uZSA9PT0gdHJ1ZSkgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9O1xuICBjb25zdCBjaGFuZ2VIYW5kbGVyID0gKCkgPT4ge1xuICAgIGpvYlF1ZXVlLmFkZChhc3luYyAoKSA9PiB7XG4gICAgICBhd2FpdCB1cGxvYWRTdGFydCgpO1xuICAgICAgaWYgKGRvbmUgPT09IGZhbHNlICYmIGVsZW1lbnQgaW5zdGFuY2VvZiBIVE1MSW5wdXRFbGVtZW50ICYmIGVsZW1lbnQuZmlsZXMpIHtcbiAgICAgICAgYXdhaXQgaXRlcmF0ZUZTRW50cmllcyhHZXRXZWJraXRFbnRyaWVzKGVsZW1lbnQpID8/IFtdLCBlbGVtZW50LmZpbGVzKTtcbiAgICAgIH1cbiAgICB9LCAnY2hhbmdlSGFuZGxlcicpO1xuICB9O1xuICBjb25zdCBkcm9wSGFuZGxlciA9IChldmVudDogRHJhZ0V2ZW50KSA9PiB7XG4gICAgam9iUXVldWUuYWRkKGFzeW5jICgpID0+IHtcbiAgICAgIGF3YWl0IHVwbG9hZFN0YXJ0KCk7XG4gICAgICBpZiAoZG9uZSA9PT0gZmFsc2UgJiYgZXZlbnQuZGF0YVRyYW5zZmVyKSB7XG4gICAgICAgIGNvbnN0IGRhdGFUcmFuc2Zlckl0ZW1zID0gbmV3IERhdGFUcmFuc2Zlckl0ZW1JdGVyYXRvcihldmVudC5kYXRhVHJhbnNmZXIuaXRlbXMpO1xuICAgICAgICBhd2FpdCBpdGVyYXRlRlNFbnRyaWVzKGRhdGFUcmFuc2Zlckl0ZW1zLmdldEFzRW50cnkoKSwgZXZlbnQuZGF0YVRyYW5zZmVyLmZpbGVzKTtcbiAgICAgIH1cbiAgICB9LCAnZHJvcEhhbmRsZXInKTtcbiAgfTtcbiAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCBjaGFuZ2VIYW5kbGVyKTtcbiAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdkcm9wJywgZHJvcEhhbmRsZXIpO1xufVxuIiwKICAgICIvKiBUYWJsZSBvZiBDUkNzIG9mIGFsbCA4LWJpdCBtZXNzYWdlcy4gKi9cbmNvbnN0IGNyY190YWJsZTogVWludDMyQXJyYXkgPSBuZXcgVWludDMyQXJyYXkoMjU2KTtcbmNvbnN0IGNyY19tYWdpYzogVWludDMyQXJyYXkgPSBuZXcgVWludDMyQXJyYXkoMSk7XG5jcmNfbWFnaWNbMF0gPSAweGVkYjg4MzIwO1xuXG4vKiBNYWtlIHRoZSB0YWJsZSBmb3IgYSBmYXN0IENSQy4gKi9cbmZvciAobGV0IG4gPSAwOyBuIDwgMjU2OyBuKyspIHtcbiAgbGV0IGMgPSBuID4+PiAwOyAvLyBVc2UgdW5zaWduZWQgMzItYml0IGludGVnZXJcbiAgZm9yIChsZXQgayA9IDA7IGsgPCA4OyBrKyspIHtcbiAgICBpZiAoYyAmIDEpIHtcbiAgICAgIGMgPSBjcmNfbWFnaWNbMF0gXiAoYyA+Pj4gMSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGMgPj4+PSAxO1xuICAgIH1cbiAgfVxuICBjcmNfdGFibGVbbl0gPSBjO1xufVxuXG5leHBvcnQgY2xhc3MgQ1JDIHtcbiAgc3RhdGljIEluaXQoYnl0ZXM6IFVpbnQ4QXJyYXkpIHtcbiAgICByZXR1cm4gKENSQy5VcGRhdGUoMHhmZmZmZmZmZiA+Pj4gMCwgYnl0ZXMpIF4gKDB4ZmZmZmZmZmYgPj4+IDApKSA+Pj4gMDtcbiAgfVxuICBzdGF0aWMgVXBkYXRlKGNyYzogbnVtYmVyLCBieXRlczogVWludDhBcnJheSkge1xuICAgIGxldCBjID0gY3JjID4+PiAwO1xuICAgIGZvciAobGV0IG4gPSAwOyBuIDwgYnl0ZXMubGVuZ3RoOyBuKyspIHtcbiAgICAgIGMgPSBjcmNfdGFibGVbKGMgXiBieXRlc1tuXSkgJiAweGZmXSBeIChjID4+PiA4KTtcbiAgICB9XG4gICAgcmV0dXJuIGMgPj4+IDA7XG4gIH1cbn1cbiIsCiAgICAiXG4vKiEgcGFrbyAyLjEuMCBodHRwczovL2dpdGh1Yi5jb20vbm9kZWNhL3Bha28gQGxpY2Vuc2UgKE1JVCBBTkQgWmxpYikgKi9cbi8vIChDKSAxOTk1LTIwMTMgSmVhbi1sb3VwIEdhaWxseSBhbmQgTWFyayBBZGxlclxuLy8gKEMpIDIwMTQtMjAxNyBWaXRhbHkgUHV6cmluIGFuZCBBbmRyZXkgVHVwaXRzaW5cbi8vXG4vLyBUaGlzIHNvZnR3YXJlIGlzIHByb3ZpZGVkICdhcy1pcycsIHdpdGhvdXQgYW55IGV4cHJlc3Mgb3IgaW1wbGllZFxuLy8gd2FycmFudHkuIEluIG5vIGV2ZW50IHdpbGwgdGhlIGF1dGhvcnMgYmUgaGVsZCBsaWFibGUgZm9yIGFueSBkYW1hZ2VzXG4vLyBhcmlzaW5nIGZyb20gdGhlIHVzZSBvZiB0aGlzIHNvZnR3YXJlLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgZ3JhbnRlZCB0byBhbnlvbmUgdG8gdXNlIHRoaXMgc29mdHdhcmUgZm9yIGFueSBwdXJwb3NlLFxuLy8gaW5jbHVkaW5nIGNvbW1lcmNpYWwgYXBwbGljYXRpb25zLCBhbmQgdG8gYWx0ZXIgaXQgYW5kIHJlZGlzdHJpYnV0ZSBpdFxuLy8gZnJlZWx5LCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgcmVzdHJpY3Rpb25zOlxuLy9cbi8vIDEuIFRoZSBvcmlnaW4gb2YgdGhpcyBzb2Z0d2FyZSBtdXN0IG5vdCBiZSBtaXNyZXByZXNlbnRlZDsgeW91IG11c3Qgbm90XG4vLyAgIGNsYWltIHRoYXQgeW91IHdyb3RlIHRoZSBvcmlnaW5hbCBzb2Z0d2FyZS4gSWYgeW91IHVzZSB0aGlzIHNvZnR3YXJlXG4vLyAgIGluIGEgcHJvZHVjdCwgYW4gYWNrbm93bGVkZ21lbnQgaW4gdGhlIHByb2R1Y3QgZG9jdW1lbnRhdGlvbiB3b3VsZCBiZVxuLy8gICBhcHByZWNpYXRlZCBidXQgaXMgbm90IHJlcXVpcmVkLlxuLy8gMi4gQWx0ZXJlZCBzb3VyY2UgdmVyc2lvbnMgbXVzdCBiZSBwbGFpbmx5IG1hcmtlZCBhcyBzdWNoLCBhbmQgbXVzdCBub3QgYmVcbi8vICAgbWlzcmVwcmVzZW50ZWQgYXMgYmVpbmcgdGhlIG9yaWdpbmFsIHNvZnR3YXJlLlxuLy8gMy4gVGhpcyBub3RpY2UgbWF5IG5vdCBiZSByZW1vdmVkIG9yIGFsdGVyZWQgZnJvbSBhbnkgc291cmNlIGRpc3RyaWJ1dGlvbi5cblxuLyogZXNsaW50LWRpc2FibGUgc3BhY2UtdW5hcnktb3BzICovXG5cbi8qIFB1YmxpYyBjb25zdGFudHMgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSovXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0qL1xuXG5cbi8vY29uc3QgWl9GSUxURVJFRCAgICAgICAgICA9IDE7XG4vL2NvbnN0IFpfSFVGRk1BTl9PTkxZICAgICAgPSAyO1xuLy9jb25zdCBaX1JMRSAgICAgICAgICAgICAgID0gMztcbmNvbnN0IFpfRklYRUQkMSAgICAgICAgICAgICAgID0gNDtcbi8vY29uc3QgWl9ERUZBVUxUX1NUUkFURUdZICA9IDA7XG5cbi8qIFBvc3NpYmxlIHZhbHVlcyBvZiB0aGUgZGF0YV90eXBlIGZpZWxkICh0aG91Z2ggc2VlIGluZmxhdGUoKSkgKi9cbmNvbnN0IFpfQklOQVJZICAgICAgICAgICAgICA9IDA7XG5jb25zdCBaX1RFWFQgICAgICAgICAgICAgICAgPSAxO1xuLy9jb25zdCBaX0FTQ0lJICAgICAgICAgICAgID0gMTsgLy8gPSBaX1RFWFRcbmNvbnN0IFpfVU5LTk9XTiQxICAgICAgICAgICAgID0gMjtcblxuLyo9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Ki9cblxuXG5mdW5jdGlvbiB6ZXJvJDEoYnVmKSB7IGxldCBsZW4gPSBidWYubGVuZ3RoOyB3aGlsZSAoLS1sZW4gPj0gMCkgeyBidWZbbGVuXSA9IDA7IH0gfVxuXG4vLyBGcm9tIHp1dGlsLmhcblxuY29uc3QgU1RPUkVEX0JMT0NLID0gMDtcbmNvbnN0IFNUQVRJQ19UUkVFUyA9IDE7XG5jb25zdCBEWU5fVFJFRVMgICAgPSAyO1xuLyogVGhlIHRocmVlIGtpbmRzIG9mIGJsb2NrIHR5cGUgKi9cblxuY29uc3QgTUlOX01BVENIJDEgICAgPSAzO1xuY29uc3QgTUFYX01BVENIJDEgICAgPSAyNTg7XG4vKiBUaGUgbWluaW11bSBhbmQgbWF4aW11bSBtYXRjaCBsZW5ndGhzICovXG5cbi8vIEZyb20gZGVmbGF0ZS5oXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIEludGVybmFsIGNvbXByZXNzaW9uIHN0YXRlLlxuICovXG5cbmNvbnN0IExFTkdUSF9DT0RFUyQxICA9IDI5O1xuLyogbnVtYmVyIG9mIGxlbmd0aCBjb2Rlcywgbm90IGNvdW50aW5nIHRoZSBzcGVjaWFsIEVORF9CTE9DSyBjb2RlICovXG5cbmNvbnN0IExJVEVSQUxTJDEgICAgICA9IDI1Njtcbi8qIG51bWJlciBvZiBsaXRlcmFsIGJ5dGVzIDAuLjI1NSAqL1xuXG5jb25zdCBMX0NPREVTJDEgICAgICAgPSBMSVRFUkFMUyQxICsgMSArIExFTkdUSF9DT0RFUyQxO1xuLyogbnVtYmVyIG9mIExpdGVyYWwgb3IgTGVuZ3RoIGNvZGVzLCBpbmNsdWRpbmcgdGhlIEVORF9CTE9DSyBjb2RlICovXG5cbmNvbnN0IERfQ09ERVMkMSAgICAgICA9IDMwO1xuLyogbnVtYmVyIG9mIGRpc3RhbmNlIGNvZGVzICovXG5cbmNvbnN0IEJMX0NPREVTJDEgICAgICA9IDE5O1xuLyogbnVtYmVyIG9mIGNvZGVzIHVzZWQgdG8gdHJhbnNmZXIgdGhlIGJpdCBsZW5ndGhzICovXG5cbmNvbnN0IEhFQVBfU0laRSQxICAgICA9IDIgKiBMX0NPREVTJDEgKyAxO1xuLyogbWF4aW11bSBoZWFwIHNpemUgKi9cblxuY29uc3QgTUFYX0JJVFMkMSAgICAgID0gMTU7XG4vKiBBbGwgY29kZXMgbXVzdCBub3QgZXhjZWVkIE1BWF9CSVRTIGJpdHMgKi9cblxuY29uc3QgQnVmX3NpemUgICAgICA9IDE2O1xuLyogc2l6ZSBvZiBiaXQgYnVmZmVyIGluIGJpX2J1ZiAqL1xuXG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogQ29uc3RhbnRzXG4gKi9cblxuY29uc3QgTUFYX0JMX0JJVFMgPSA3O1xuLyogQml0IGxlbmd0aCBjb2RlcyBtdXN0IG5vdCBleGNlZWQgTUFYX0JMX0JJVFMgYml0cyAqL1xuXG5jb25zdCBFTkRfQkxPQ0sgICA9IDI1Njtcbi8qIGVuZCBvZiBibG9jayBsaXRlcmFsIGNvZGUgKi9cblxuY29uc3QgUkVQXzNfNiAgICAgPSAxNjtcbi8qIHJlcGVhdCBwcmV2aW91cyBiaXQgbGVuZ3RoIDMtNiB0aW1lcyAoMiBiaXRzIG9mIHJlcGVhdCBjb3VudCkgKi9cblxuY29uc3QgUkVQWl8zXzEwICAgPSAxNztcbi8qIHJlcGVhdCBhIHplcm8gbGVuZ3RoIDMtMTAgdGltZXMgICgzIGJpdHMgb2YgcmVwZWF0IGNvdW50KSAqL1xuXG5jb25zdCBSRVBaXzExXzEzOCA9IDE4O1xuLyogcmVwZWF0IGEgemVybyBsZW5ndGggMTEtMTM4IHRpbWVzICAoNyBiaXRzIG9mIHJlcGVhdCBjb3VudCkgKi9cblxuLyogZXNsaW50LWRpc2FibGUgY29tbWEtc3BhY2luZyxhcnJheS1icmFja2V0LXNwYWNpbmcgKi9cbmNvbnN0IGV4dHJhX2xiaXRzID0gICAvKiBleHRyYSBiaXRzIGZvciBlYWNoIGxlbmd0aCBjb2RlICovXG4gIG5ldyBVaW50OEFycmF5KFswLDAsMCwwLDAsMCwwLDAsMSwxLDEsMSwyLDIsMiwyLDMsMywzLDMsNCw0LDQsNCw1LDUsNSw1LDBdKTtcblxuY29uc3QgZXh0cmFfZGJpdHMgPSAgIC8qIGV4dHJhIGJpdHMgZm9yIGVhY2ggZGlzdGFuY2UgY29kZSAqL1xuICBuZXcgVWludDhBcnJheShbMCwwLDAsMCwxLDEsMiwyLDMsMyw0LDQsNSw1LDYsNiw3LDcsOCw4LDksOSwxMCwxMCwxMSwxMSwxMiwxMiwxMywxM10pO1xuXG5jb25zdCBleHRyYV9ibGJpdHMgPSAgLyogZXh0cmEgYml0cyBmb3IgZWFjaCBiaXQgbGVuZ3RoIGNvZGUgKi9cbiAgbmV3IFVpbnQ4QXJyYXkoWzAsMCwwLDAsMCwwLDAsMCwwLDAsMCwwLDAsMCwwLDAsMiwzLDddKTtcblxuY29uc3QgYmxfb3JkZXIgPVxuICBuZXcgVWludDhBcnJheShbMTYsMTcsMTgsMCw4LDcsOSw2LDEwLDUsMTEsNCwxMiwzLDEzLDIsMTQsMSwxNV0pO1xuLyogZXNsaW50LWVuYWJsZSBjb21tYS1zcGFjaW5nLGFycmF5LWJyYWNrZXQtc3BhY2luZyAqL1xuXG4vKiBUaGUgbGVuZ3RocyBvZiB0aGUgYml0IGxlbmd0aCBjb2RlcyBhcmUgc2VudCBpbiBvcmRlciBvZiBkZWNyZWFzaW5nXG4gKiBwcm9iYWJpbGl0eSwgdG8gYXZvaWQgdHJhbnNtaXR0aW5nIHRoZSBsZW5ndGhzIGZvciB1bnVzZWQgYml0IGxlbmd0aCBjb2Rlcy5cbiAqL1xuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIExvY2FsIGRhdGEuIFRoZXNlIGFyZSBpbml0aWFsaXplZCBvbmx5IG9uY2UuXG4gKi9cblxuLy8gV2UgcHJlLWZpbGwgYXJyYXlzIHdpdGggMCB0byBhdm9pZCB1bmluaXRpYWxpemVkIGdhcHNcblxuY29uc3QgRElTVF9DT0RFX0xFTiA9IDUxMjsgLyogc2VlIGRlZmluaXRpb24gb2YgYXJyYXkgZGlzdF9jb2RlIGJlbG93ICovXG5cbi8vICEhISEgVXNlIGZsYXQgYXJyYXkgaW5zdGVhZCBvZiBzdHJ1Y3R1cmUsIEZyZXEgPSBpKjIsIExlbiA9IGkqMisxXG5jb25zdCBzdGF0aWNfbHRyZWUgID0gbmV3IEFycmF5KChMX0NPREVTJDEgKyAyKSAqIDIpO1xuemVybyQxKHN0YXRpY19sdHJlZSk7XG4vKiBUaGUgc3RhdGljIGxpdGVyYWwgdHJlZS4gU2luY2UgdGhlIGJpdCBsZW5ndGhzIGFyZSBpbXBvc2VkLCB0aGVyZSBpcyBub1xuICogbmVlZCBmb3IgdGhlIExfQ09ERVMgZXh0cmEgY29kZXMgdXNlZCBkdXJpbmcgaGVhcCBjb25zdHJ1Y3Rpb24uIEhvd2V2ZXJcbiAqIFRoZSBjb2RlcyAyODYgYW5kIDI4NyBhcmUgbmVlZGVkIHRvIGJ1aWxkIGEgY2Fub25pY2FsIHRyZWUgKHNlZSBfdHJfaW5pdFxuICogYmVsb3cpLlxuICovXG5cbmNvbnN0IHN0YXRpY19kdHJlZSAgPSBuZXcgQXJyYXkoRF9DT0RFUyQxICogMik7XG56ZXJvJDEoc3RhdGljX2R0cmVlKTtcbi8qIFRoZSBzdGF0aWMgZGlzdGFuY2UgdHJlZS4gKEFjdHVhbGx5IGEgdHJpdmlhbCB0cmVlIHNpbmNlIGFsbCBjb2RlcyB1c2VcbiAqIDUgYml0cy4pXG4gKi9cblxuY29uc3QgX2Rpc3RfY29kZSAgICA9IG5ldyBBcnJheShESVNUX0NPREVfTEVOKTtcbnplcm8kMShfZGlzdF9jb2RlKTtcbi8qIERpc3RhbmNlIGNvZGVzLiBUaGUgZmlyc3QgMjU2IHZhbHVlcyBjb3JyZXNwb25kIHRvIHRoZSBkaXN0YW5jZXNcbiAqIDMgLi4gMjU4LCB0aGUgbGFzdCAyNTYgdmFsdWVzIGNvcnJlc3BvbmQgdG8gdGhlIHRvcCA4IGJpdHMgb2ZcbiAqIHRoZSAxNSBiaXQgZGlzdGFuY2VzLlxuICovXG5cbmNvbnN0IF9sZW5ndGhfY29kZSAgPSBuZXcgQXJyYXkoTUFYX01BVENIJDEgLSBNSU5fTUFUQ0gkMSArIDEpO1xuemVybyQxKF9sZW5ndGhfY29kZSk7XG4vKiBsZW5ndGggY29kZSBmb3IgZWFjaCBub3JtYWxpemVkIG1hdGNoIGxlbmd0aCAoMCA9PSBNSU5fTUFUQ0gpICovXG5cbmNvbnN0IGJhc2VfbGVuZ3RoICAgPSBuZXcgQXJyYXkoTEVOR1RIX0NPREVTJDEpO1xuemVybyQxKGJhc2VfbGVuZ3RoKTtcbi8qIEZpcnN0IG5vcm1hbGl6ZWQgbGVuZ3RoIGZvciBlYWNoIGNvZGUgKDAgPSBNSU5fTUFUQ0gpICovXG5cbmNvbnN0IGJhc2VfZGlzdCAgICAgPSBuZXcgQXJyYXkoRF9DT0RFUyQxKTtcbnplcm8kMShiYXNlX2Rpc3QpO1xuLyogRmlyc3Qgbm9ybWFsaXplZCBkaXN0YW5jZSBmb3IgZWFjaCBjb2RlICgwID0gZGlzdGFuY2Ugb2YgMSkgKi9cblxuXG5mdW5jdGlvbiBTdGF0aWNUcmVlRGVzYyhzdGF0aWNfdHJlZSwgZXh0cmFfYml0cywgZXh0cmFfYmFzZSwgZWxlbXMsIG1heF9sZW5ndGgpIHtcblxuICB0aGlzLnN0YXRpY190cmVlICA9IHN0YXRpY190cmVlOyAgLyogc3RhdGljIHRyZWUgb3IgTlVMTCAqL1xuICB0aGlzLmV4dHJhX2JpdHMgICA9IGV4dHJhX2JpdHM7ICAgLyogZXh0cmEgYml0cyBmb3IgZWFjaCBjb2RlIG9yIE5VTEwgKi9cbiAgdGhpcy5leHRyYV9iYXNlICAgPSBleHRyYV9iYXNlOyAgIC8qIGJhc2UgaW5kZXggZm9yIGV4dHJhX2JpdHMgKi9cbiAgdGhpcy5lbGVtcyAgICAgICAgPSBlbGVtczsgICAgICAgIC8qIG1heCBudW1iZXIgb2YgZWxlbWVudHMgaW4gdGhlIHRyZWUgKi9cbiAgdGhpcy5tYXhfbGVuZ3RoICAgPSBtYXhfbGVuZ3RoOyAgIC8qIG1heCBiaXQgbGVuZ3RoIGZvciB0aGUgY29kZXMgKi9cblxuICAvLyBzaG93IGlmIGBzdGF0aWNfdHJlZWAgaGFzIGRhdGEgb3IgZHVtbXkgLSBuZWVkZWQgZm9yIG1vbm9tb3JwaGljIG9iamVjdHNcbiAgdGhpcy5oYXNfc3RyZWUgICAgPSBzdGF0aWNfdHJlZSAmJiBzdGF0aWNfdHJlZS5sZW5ndGg7XG59XG5cblxubGV0IHN0YXRpY19sX2Rlc2M7XG5sZXQgc3RhdGljX2RfZGVzYztcbmxldCBzdGF0aWNfYmxfZGVzYztcblxuXG5mdW5jdGlvbiBUcmVlRGVzYyhkeW5fdHJlZSwgc3RhdF9kZXNjKSB7XG4gIHRoaXMuZHluX3RyZWUgPSBkeW5fdHJlZTsgICAgIC8qIHRoZSBkeW5hbWljIHRyZWUgKi9cbiAgdGhpcy5tYXhfY29kZSA9IDA7ICAgICAgICAgICAgLyogbGFyZ2VzdCBjb2RlIHdpdGggbm9uIHplcm8gZnJlcXVlbmN5ICovXG4gIHRoaXMuc3RhdF9kZXNjID0gc3RhdF9kZXNjOyAgIC8qIHRoZSBjb3JyZXNwb25kaW5nIHN0YXRpYyB0cmVlICovXG59XG5cblxuXG5jb25zdCBkX2NvZGUgPSAoZGlzdCkgPT4ge1xuXG4gIHJldHVybiBkaXN0IDwgMjU2ID8gX2Rpc3RfY29kZVtkaXN0XSA6IF9kaXN0X2NvZGVbMjU2ICsgKGRpc3QgPj4+IDcpXTtcbn07XG5cblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBPdXRwdXQgYSBzaG9ydCBMU0IgZmlyc3Qgb24gdGhlIHN0cmVhbS5cbiAqIElOIGFzc2VydGlvbjogdGhlcmUgaXMgZW5vdWdoIHJvb20gaW4gcGVuZGluZ0J1Zi5cbiAqL1xuY29uc3QgcHV0X3Nob3J0ID0gKHMsIHcpID0+IHtcbi8vICAgIHB1dF9ieXRlKHMsICh1Y2gpKCh3KSAmIDB4ZmYpKTtcbi8vICAgIHB1dF9ieXRlKHMsICh1Y2gpKCh1c2gpKHcpID4+IDgpKTtcbiAgcy5wZW5kaW5nX2J1ZltzLnBlbmRpbmcrK10gPSAodykgJiAweGZmO1xuICBzLnBlbmRpbmdfYnVmW3MucGVuZGluZysrXSA9ICh3ID4+PiA4KSAmIDB4ZmY7XG59O1xuXG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogU2VuZCBhIHZhbHVlIG9uIGEgZ2l2ZW4gbnVtYmVyIG9mIGJpdHMuXG4gKiBJTiBhc3NlcnRpb246IGxlbmd0aCA8PSAxNiBhbmQgdmFsdWUgZml0cyBpbiBsZW5ndGggYml0cy5cbiAqL1xuY29uc3Qgc2VuZF9iaXRzID0gKHMsIHZhbHVlLCBsZW5ndGgpID0+IHtcblxuICBpZiAocy5iaV92YWxpZCA+IChCdWZfc2l6ZSAtIGxlbmd0aCkpIHtcbiAgICBzLmJpX2J1ZiB8PSAodmFsdWUgPDwgcy5iaV92YWxpZCkgJiAweGZmZmY7XG4gICAgcHV0X3Nob3J0KHMsIHMuYmlfYnVmKTtcbiAgICBzLmJpX2J1ZiA9IHZhbHVlID4+IChCdWZfc2l6ZSAtIHMuYmlfdmFsaWQpO1xuICAgIHMuYmlfdmFsaWQgKz0gbGVuZ3RoIC0gQnVmX3NpemU7XG4gIH0gZWxzZSB7XG4gICAgcy5iaV9idWYgfD0gKHZhbHVlIDw8IHMuYmlfdmFsaWQpICYgMHhmZmZmO1xuICAgIHMuYmlfdmFsaWQgKz0gbGVuZ3RoO1xuICB9XG59O1xuXG5cbmNvbnN0IHNlbmRfY29kZSA9IChzLCBjLCB0cmVlKSA9PiB7XG5cbiAgc2VuZF9iaXRzKHMsIHRyZWVbYyAqIDJdLyouQ29kZSovLCB0cmVlW2MgKiAyICsgMV0vKi5MZW4qLyk7XG59O1xuXG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogUmV2ZXJzZSB0aGUgZmlyc3QgbGVuIGJpdHMgb2YgYSBjb2RlLCB1c2luZyBzdHJhaWdodGZvcndhcmQgY29kZSAoYSBmYXN0ZXJcbiAqIG1ldGhvZCB3b3VsZCB1c2UgYSB0YWJsZSlcbiAqIElOIGFzc2VydGlvbjogMSA8PSBsZW4gPD0gMTVcbiAqL1xuY29uc3QgYmlfcmV2ZXJzZSA9IChjb2RlLCBsZW4pID0+IHtcblxuICBsZXQgcmVzID0gMDtcbiAgZG8ge1xuICAgIHJlcyB8PSBjb2RlICYgMTtcbiAgICBjb2RlID4+Pj0gMTtcbiAgICByZXMgPDw9IDE7XG4gIH0gd2hpbGUgKC0tbGVuID4gMCk7XG4gIHJldHVybiByZXMgPj4+IDE7XG59O1xuXG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogRmx1c2ggdGhlIGJpdCBidWZmZXIsIGtlZXBpbmcgYXQgbW9zdCA3IGJpdHMgaW4gaXQuXG4gKi9cbmNvbnN0IGJpX2ZsdXNoID0gKHMpID0+IHtcblxuICBpZiAocy5iaV92YWxpZCA9PT0gMTYpIHtcbiAgICBwdXRfc2hvcnQocywgcy5iaV9idWYpO1xuICAgIHMuYmlfYnVmID0gMDtcbiAgICBzLmJpX3ZhbGlkID0gMDtcblxuICB9IGVsc2UgaWYgKHMuYmlfdmFsaWQgPj0gOCkge1xuICAgIHMucGVuZGluZ19idWZbcy5wZW5kaW5nKytdID0gcy5iaV9idWYgJiAweGZmO1xuICAgIHMuYmlfYnVmID4+PSA4O1xuICAgIHMuYmlfdmFsaWQgLT0gODtcbiAgfVxufTtcblxuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIENvbXB1dGUgdGhlIG9wdGltYWwgYml0IGxlbmd0aHMgZm9yIGEgdHJlZSBhbmQgdXBkYXRlIHRoZSB0b3RhbCBiaXQgbGVuZ3RoXG4gKiBmb3IgdGhlIGN1cnJlbnQgYmxvY2suXG4gKiBJTiBhc3NlcnRpb246IHRoZSBmaWVsZHMgZnJlcSBhbmQgZGFkIGFyZSBzZXQsIGhlYXBbaGVhcF9tYXhdIGFuZFxuICogICAgYWJvdmUgYXJlIHRoZSB0cmVlIG5vZGVzIHNvcnRlZCBieSBpbmNyZWFzaW5nIGZyZXF1ZW5jeS5cbiAqIE9VVCBhc3NlcnRpb25zOiB0aGUgZmllbGQgbGVuIGlzIHNldCB0byB0aGUgb3B0aW1hbCBiaXQgbGVuZ3RoLCB0aGVcbiAqICAgICBhcnJheSBibF9jb3VudCBjb250YWlucyB0aGUgZnJlcXVlbmNpZXMgZm9yIGVhY2ggYml0IGxlbmd0aC5cbiAqICAgICBUaGUgbGVuZ3RoIG9wdF9sZW4gaXMgdXBkYXRlZDsgc3RhdGljX2xlbiBpcyBhbHNvIHVwZGF0ZWQgaWYgc3RyZWUgaXNcbiAqICAgICBub3QgbnVsbC5cbiAqL1xuY29uc3QgZ2VuX2JpdGxlbiA9IChzLCBkZXNjKSA9PiB7XG4vLyAgICBkZWZsYXRlX3N0YXRlICpzO1xuLy8gICAgdHJlZV9kZXNjICpkZXNjOyAgICAvKiB0aGUgdHJlZSBkZXNjcmlwdG9yICovXG5cbiAgY29uc3QgdHJlZSAgICAgICAgICAgID0gZGVzYy5keW5fdHJlZTtcbiAgY29uc3QgbWF4X2NvZGUgICAgICAgID0gZGVzYy5tYXhfY29kZTtcbiAgY29uc3Qgc3RyZWUgICAgICAgICAgID0gZGVzYy5zdGF0X2Rlc2Muc3RhdGljX3RyZWU7XG4gIGNvbnN0IGhhc19zdHJlZSAgICAgICA9IGRlc2Muc3RhdF9kZXNjLmhhc19zdHJlZTtcbiAgY29uc3QgZXh0cmEgICAgICAgICAgID0gZGVzYy5zdGF0X2Rlc2MuZXh0cmFfYml0cztcbiAgY29uc3QgYmFzZSAgICAgICAgICAgID0gZGVzYy5zdGF0X2Rlc2MuZXh0cmFfYmFzZTtcbiAgY29uc3QgbWF4X2xlbmd0aCAgICAgID0gZGVzYy5zdGF0X2Rlc2MubWF4X2xlbmd0aDtcbiAgbGV0IGg7ICAgICAgICAgICAgICAvKiBoZWFwIGluZGV4ICovXG4gIGxldCBuLCBtOyAgICAgICAgICAgLyogaXRlcmF0ZSBvdmVyIHRoZSB0cmVlIGVsZW1lbnRzICovXG4gIGxldCBiaXRzOyAgICAgICAgICAgLyogYml0IGxlbmd0aCAqL1xuICBsZXQgeGJpdHM7ICAgICAgICAgIC8qIGV4dHJhIGJpdHMgKi9cbiAgbGV0IGY7ICAgICAgICAgICAgICAvKiBmcmVxdWVuY3kgKi9cbiAgbGV0IG92ZXJmbG93ID0gMDsgICAvKiBudW1iZXIgb2YgZWxlbWVudHMgd2l0aCBiaXQgbGVuZ3RoIHRvbyBsYXJnZSAqL1xuXG4gIGZvciAoYml0cyA9IDA7IGJpdHMgPD0gTUFYX0JJVFMkMTsgYml0cysrKSB7XG4gICAgcy5ibF9jb3VudFtiaXRzXSA9IDA7XG4gIH1cblxuICAvKiBJbiBhIGZpcnN0IHBhc3MsIGNvbXB1dGUgdGhlIG9wdGltYWwgYml0IGxlbmd0aHMgKHdoaWNoIG1heVxuICAgKiBvdmVyZmxvdyBpbiB0aGUgY2FzZSBvZiB0aGUgYml0IGxlbmd0aCB0cmVlKS5cbiAgICovXG4gIHRyZWVbcy5oZWFwW3MuaGVhcF9tYXhdICogMiArIDFdLyouTGVuKi8gPSAwOyAvKiByb290IG9mIHRoZSBoZWFwICovXG5cbiAgZm9yIChoID0gcy5oZWFwX21heCArIDE7IGggPCBIRUFQX1NJWkUkMTsgaCsrKSB7XG4gICAgbiA9IHMuaGVhcFtoXTtcbiAgICBiaXRzID0gdHJlZVt0cmVlW24gKiAyICsgMV0vKi5EYWQqLyAqIDIgKyAxXS8qLkxlbiovICsgMTtcbiAgICBpZiAoYml0cyA+IG1heF9sZW5ndGgpIHtcbiAgICAgIGJpdHMgPSBtYXhfbGVuZ3RoO1xuICAgICAgb3ZlcmZsb3crKztcbiAgICB9XG4gICAgdHJlZVtuICogMiArIDFdLyouTGVuKi8gPSBiaXRzO1xuICAgIC8qIFdlIG92ZXJ3cml0ZSB0cmVlW25dLkRhZCB3aGljaCBpcyBubyBsb25nZXIgbmVlZGVkICovXG5cbiAgICBpZiAobiA+IG1heF9jb2RlKSB7IGNvbnRpbnVlOyB9IC8qIG5vdCBhIGxlYWYgbm9kZSAqL1xuXG4gICAgcy5ibF9jb3VudFtiaXRzXSsrO1xuICAgIHhiaXRzID0gMDtcbiAgICBpZiAobiA+PSBiYXNlKSB7XG4gICAgICB4Yml0cyA9IGV4dHJhW24gLSBiYXNlXTtcbiAgICB9XG4gICAgZiA9IHRyZWVbbiAqIDJdLyouRnJlcSovO1xuICAgIHMub3B0X2xlbiArPSBmICogKGJpdHMgKyB4Yml0cyk7XG4gICAgaWYgKGhhc19zdHJlZSkge1xuICAgICAgcy5zdGF0aWNfbGVuICs9IGYgKiAoc3RyZWVbbiAqIDIgKyAxXS8qLkxlbiovICsgeGJpdHMpO1xuICAgIH1cbiAgfVxuICBpZiAob3ZlcmZsb3cgPT09IDApIHsgcmV0dXJuOyB9XG5cbiAgLy8gVHJhY2V2KChzdGRlcnIsXCJcXG5iaXQgbGVuZ3RoIG92ZXJmbG93XFxuXCIpKTtcbiAgLyogVGhpcyBoYXBwZW5zIGZvciBleGFtcGxlIG9uIG9iajIgYW5kIHBpYyBvZiB0aGUgQ2FsZ2FyeSBjb3JwdXMgKi9cblxuICAvKiBGaW5kIHRoZSBmaXJzdCBiaXQgbGVuZ3RoIHdoaWNoIGNvdWxkIGluY3JlYXNlOiAqL1xuICBkbyB7XG4gICAgYml0cyA9IG1heF9sZW5ndGggLSAxO1xuICAgIHdoaWxlIChzLmJsX2NvdW50W2JpdHNdID09PSAwKSB7IGJpdHMtLTsgfVxuICAgIHMuYmxfY291bnRbYml0c10tLTsgICAgICAvKiBtb3ZlIG9uZSBsZWFmIGRvd24gdGhlIHRyZWUgKi9cbiAgICBzLmJsX2NvdW50W2JpdHMgKyAxXSArPSAyOyAvKiBtb3ZlIG9uZSBvdmVyZmxvdyBpdGVtIGFzIGl0cyBicm90aGVyICovXG4gICAgcy5ibF9jb3VudFttYXhfbGVuZ3RoXS0tO1xuICAgIC8qIFRoZSBicm90aGVyIG9mIHRoZSBvdmVyZmxvdyBpdGVtIGFsc28gbW92ZXMgb25lIHN0ZXAgdXAsXG4gICAgICogYnV0IHRoaXMgZG9lcyBub3QgYWZmZWN0IGJsX2NvdW50W21heF9sZW5ndGhdXG4gICAgICovXG4gICAgb3ZlcmZsb3cgLT0gMjtcbiAgfSB3aGlsZSAob3ZlcmZsb3cgPiAwKTtcblxuICAvKiBOb3cgcmVjb21wdXRlIGFsbCBiaXQgbGVuZ3Rocywgc2Nhbm5pbmcgaW4gaW5jcmVhc2luZyBmcmVxdWVuY3kuXG4gICAqIGggaXMgc3RpbGwgZXF1YWwgdG8gSEVBUF9TSVpFLiAoSXQgaXMgc2ltcGxlciB0byByZWNvbnN0cnVjdCBhbGxcbiAgICogbGVuZ3RocyBpbnN0ZWFkIG9mIGZpeGluZyBvbmx5IHRoZSB3cm9uZyBvbmVzLiBUaGlzIGlkZWEgaXMgdGFrZW5cbiAgICogZnJvbSAnYXInIHdyaXR0ZW4gYnkgSGFydWhpa28gT2t1bXVyYS4pXG4gICAqL1xuICBmb3IgKGJpdHMgPSBtYXhfbGVuZ3RoOyBiaXRzICE9PSAwOyBiaXRzLS0pIHtcbiAgICBuID0gcy5ibF9jb3VudFtiaXRzXTtcbiAgICB3aGlsZSAobiAhPT0gMCkge1xuICAgICAgbSA9IHMuaGVhcFstLWhdO1xuICAgICAgaWYgKG0gPiBtYXhfY29kZSkgeyBjb250aW51ZTsgfVxuICAgICAgaWYgKHRyZWVbbSAqIDIgKyAxXS8qLkxlbiovICE9PSBiaXRzKSB7XG4gICAgICAgIC8vIFRyYWNldigoc3RkZXJyLFwiY29kZSAlZCBiaXRzICVkLT4lZFxcblwiLCBtLCB0cmVlW21dLkxlbiwgYml0cykpO1xuICAgICAgICBzLm9wdF9sZW4gKz0gKGJpdHMgLSB0cmVlW20gKiAyICsgMV0vKi5MZW4qLykgKiB0cmVlW20gKiAyXS8qLkZyZXEqLztcbiAgICAgICAgdHJlZVttICogMiArIDFdLyouTGVuKi8gPSBiaXRzO1xuICAgICAgfVxuICAgICAgbi0tO1xuICAgIH1cbiAgfVxufTtcblxuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIEdlbmVyYXRlIHRoZSBjb2RlcyBmb3IgYSBnaXZlbiB0cmVlIGFuZCBiaXQgY291bnRzICh3aGljaCBuZWVkIG5vdCBiZVxuICogb3B0aW1hbCkuXG4gKiBJTiBhc3NlcnRpb246IHRoZSBhcnJheSBibF9jb3VudCBjb250YWlucyB0aGUgYml0IGxlbmd0aCBzdGF0aXN0aWNzIGZvclxuICogdGhlIGdpdmVuIHRyZWUgYW5kIHRoZSBmaWVsZCBsZW4gaXMgc2V0IGZvciBhbGwgdHJlZSBlbGVtZW50cy5cbiAqIE9VVCBhc3NlcnRpb246IHRoZSBmaWVsZCBjb2RlIGlzIHNldCBmb3IgYWxsIHRyZWUgZWxlbWVudHMgb2Ygbm9uXG4gKiAgICAgemVybyBjb2RlIGxlbmd0aC5cbiAqL1xuY29uc3QgZ2VuX2NvZGVzID0gKHRyZWUsIG1heF9jb2RlLCBibF9jb3VudCkgPT4ge1xuLy8gICAgY3RfZGF0YSAqdHJlZTsgICAgICAgICAgICAgLyogdGhlIHRyZWUgdG8gZGVjb3JhdGUgKi9cbi8vICAgIGludCBtYXhfY29kZTsgICAgICAgICAgICAgIC8qIGxhcmdlc3QgY29kZSB3aXRoIG5vbiB6ZXJvIGZyZXF1ZW5jeSAqL1xuLy8gICAgdXNoZiAqYmxfY291bnQ7ICAgICAgICAgICAgLyogbnVtYmVyIG9mIGNvZGVzIGF0IGVhY2ggYml0IGxlbmd0aCAqL1xuXG4gIGNvbnN0IG5leHRfY29kZSA9IG5ldyBBcnJheShNQVhfQklUUyQxICsgMSk7IC8qIG5leHQgY29kZSB2YWx1ZSBmb3IgZWFjaCBiaXQgbGVuZ3RoICovXG4gIGxldCBjb2RlID0gMDsgICAgICAgICAgICAgIC8qIHJ1bm5pbmcgY29kZSB2YWx1ZSAqL1xuICBsZXQgYml0czsgICAgICAgICAgICAgICAgICAvKiBiaXQgaW5kZXggKi9cbiAgbGV0IG47ICAgICAgICAgICAgICAgICAgICAgLyogY29kZSBpbmRleCAqL1xuXG4gIC8qIFRoZSBkaXN0cmlidXRpb24gY291bnRzIGFyZSBmaXJzdCB1c2VkIHRvIGdlbmVyYXRlIHRoZSBjb2RlIHZhbHVlc1xuICAgKiB3aXRob3V0IGJpdCByZXZlcnNhbC5cbiAgICovXG4gIGZvciAoYml0cyA9IDE7IGJpdHMgPD0gTUFYX0JJVFMkMTsgYml0cysrKSB7XG4gICAgY29kZSA9IChjb2RlICsgYmxfY291bnRbYml0cyAtIDFdKSA8PCAxO1xuICAgIG5leHRfY29kZVtiaXRzXSA9IGNvZGU7XG4gIH1cbiAgLyogQ2hlY2sgdGhhdCB0aGUgYml0IGNvdW50cyBpbiBibF9jb3VudCBhcmUgY29uc2lzdGVudC4gVGhlIGxhc3QgY29kZVxuICAgKiBtdXN0IGJlIGFsbCBvbmVzLlxuICAgKi9cbiAgLy9Bc3NlcnQgKGNvZGUgKyBibF9jb3VudFtNQVhfQklUU10tMSA9PSAoMTw8TUFYX0JJVFMpLTEsXG4gIC8vICAgICAgICBcImluY29uc2lzdGVudCBiaXQgY291bnRzXCIpO1xuICAvL1RyYWNldigoc3RkZXJyLFwiXFxuZ2VuX2NvZGVzOiBtYXhfY29kZSAlZCBcIiwgbWF4X2NvZGUpKTtcblxuICBmb3IgKG4gPSAwOyAgbiA8PSBtYXhfY29kZTsgbisrKSB7XG4gICAgbGV0IGxlbiA9IHRyZWVbbiAqIDIgKyAxXS8qLkxlbiovO1xuICAgIGlmIChsZW4gPT09IDApIHsgY29udGludWU7IH1cbiAgICAvKiBOb3cgcmV2ZXJzZSB0aGUgYml0cyAqL1xuICAgIHRyZWVbbiAqIDJdLyouQ29kZSovID0gYmlfcmV2ZXJzZShuZXh0X2NvZGVbbGVuXSsrLCBsZW4pO1xuXG4gICAgLy9UcmFjZWN2KHRyZWUgIT0gc3RhdGljX2x0cmVlLCAoc3RkZXJyLFwiXFxubiAlM2QgJWMgbCAlMmQgYyAlNHggKCV4KSBcIixcbiAgICAvLyAgICAgbiwgKGlzZ3JhcGgobikgPyBuIDogJyAnKSwgbGVuLCB0cmVlW25dLkNvZGUsIG5leHRfY29kZVtsZW5dLTEpKTtcbiAgfVxufTtcblxuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIEluaXRpYWxpemUgdGhlIHZhcmlvdXMgJ2NvbnN0YW50JyB0YWJsZXMuXG4gKi9cbmNvbnN0IHRyX3N0YXRpY19pbml0ID0gKCkgPT4ge1xuXG4gIGxldCBuOyAgICAgICAgLyogaXRlcmF0ZXMgb3ZlciB0cmVlIGVsZW1lbnRzICovXG4gIGxldCBiaXRzOyAgICAgLyogYml0IGNvdW50ZXIgKi9cbiAgbGV0IGxlbmd0aDsgICAvKiBsZW5ndGggdmFsdWUgKi9cbiAgbGV0IGNvZGU7ICAgICAvKiBjb2RlIHZhbHVlICovXG4gIGxldCBkaXN0OyAgICAgLyogZGlzdGFuY2UgaW5kZXggKi9cbiAgY29uc3QgYmxfY291bnQgPSBuZXcgQXJyYXkoTUFYX0JJVFMkMSArIDEpO1xuICAvKiBudW1iZXIgb2YgY29kZXMgYXQgZWFjaCBiaXQgbGVuZ3RoIGZvciBhbiBvcHRpbWFsIHRyZWUgKi9cblxuICAvLyBkbyBjaGVjayBpbiBfdHJfaW5pdCgpXG4gIC8vaWYgKHN0YXRpY19pbml0X2RvbmUpIHJldHVybjtcblxuICAvKiBGb3Igc29tZSBlbWJlZGRlZCB0YXJnZXRzLCBnbG9iYWwgdmFyaWFibGVzIGFyZSBub3QgaW5pdGlhbGl6ZWQ6ICovXG4vKiNpZmRlZiBOT19JTklUX0dMT0JBTF9QT0lOVEVSU1xuICBzdGF0aWNfbF9kZXNjLnN0YXRpY190cmVlID0gc3RhdGljX2x0cmVlO1xuICBzdGF0aWNfbF9kZXNjLmV4dHJhX2JpdHMgPSBleHRyYV9sYml0cztcbiAgc3RhdGljX2RfZGVzYy5zdGF0aWNfdHJlZSA9IHN0YXRpY19kdHJlZTtcbiAgc3RhdGljX2RfZGVzYy5leHRyYV9iaXRzID0gZXh0cmFfZGJpdHM7XG4gIHN0YXRpY19ibF9kZXNjLmV4dHJhX2JpdHMgPSBleHRyYV9ibGJpdHM7XG4jZW5kaWYqL1xuXG4gIC8qIEluaXRpYWxpemUgdGhlIG1hcHBpbmcgbGVuZ3RoICgwLi4yNTUpIC0+IGxlbmd0aCBjb2RlICgwLi4yOCkgKi9cbiAgbGVuZ3RoID0gMDtcbiAgZm9yIChjb2RlID0gMDsgY29kZSA8IExFTkdUSF9DT0RFUyQxIC0gMTsgY29kZSsrKSB7XG4gICAgYmFzZV9sZW5ndGhbY29kZV0gPSBsZW5ndGg7XG4gICAgZm9yIChuID0gMDsgbiA8ICgxIDw8IGV4dHJhX2xiaXRzW2NvZGVdKTsgbisrKSB7XG4gICAgICBfbGVuZ3RoX2NvZGVbbGVuZ3RoKytdID0gY29kZTtcbiAgICB9XG4gIH1cbiAgLy9Bc3NlcnQgKGxlbmd0aCA9PSAyNTYsIFwidHJfc3RhdGljX2luaXQ6IGxlbmd0aCAhPSAyNTZcIik7XG4gIC8qIE5vdGUgdGhhdCB0aGUgbGVuZ3RoIDI1NSAobWF0Y2ggbGVuZ3RoIDI1OCkgY2FuIGJlIHJlcHJlc2VudGVkXG4gICAqIGluIHR3byBkaWZmZXJlbnQgd2F5czogY29kZSAyODQgKyA1IGJpdHMgb3IgY29kZSAyODUsIHNvIHdlXG4gICAqIG92ZXJ3cml0ZSBsZW5ndGhfY29kZVsyNTVdIHRvIHVzZSB0aGUgYmVzdCBlbmNvZGluZzpcbiAgICovXG4gIF9sZW5ndGhfY29kZVtsZW5ndGggLSAxXSA9IGNvZGU7XG5cbiAgLyogSW5pdGlhbGl6ZSB0aGUgbWFwcGluZyBkaXN0ICgwLi4zMkspIC0+IGRpc3QgY29kZSAoMC4uMjkpICovXG4gIGRpc3QgPSAwO1xuICBmb3IgKGNvZGUgPSAwOyBjb2RlIDwgMTY7IGNvZGUrKykge1xuICAgIGJhc2VfZGlzdFtjb2RlXSA9IGRpc3Q7XG4gICAgZm9yIChuID0gMDsgbiA8ICgxIDw8IGV4dHJhX2RiaXRzW2NvZGVdKTsgbisrKSB7XG4gICAgICBfZGlzdF9jb2RlW2Rpc3QrK10gPSBjb2RlO1xuICAgIH1cbiAgfVxuICAvL0Fzc2VydCAoZGlzdCA9PSAyNTYsIFwidHJfc3RhdGljX2luaXQ6IGRpc3QgIT0gMjU2XCIpO1xuICBkaXN0ID4+PSA3OyAvKiBmcm9tIG5vdyBvbiwgYWxsIGRpc3RhbmNlcyBhcmUgZGl2aWRlZCBieSAxMjggKi9cbiAgZm9yICg7IGNvZGUgPCBEX0NPREVTJDE7IGNvZGUrKykge1xuICAgIGJhc2VfZGlzdFtjb2RlXSA9IGRpc3QgPDwgNztcbiAgICBmb3IgKG4gPSAwOyBuIDwgKDEgPDwgKGV4dHJhX2RiaXRzW2NvZGVdIC0gNykpOyBuKyspIHtcbiAgICAgIF9kaXN0X2NvZGVbMjU2ICsgZGlzdCsrXSA9IGNvZGU7XG4gICAgfVxuICB9XG4gIC8vQXNzZXJ0IChkaXN0ID09IDI1NiwgXCJ0cl9zdGF0aWNfaW5pdDogMjU2K2Rpc3QgIT0gNTEyXCIpO1xuXG4gIC8qIENvbnN0cnVjdCB0aGUgY29kZXMgb2YgdGhlIHN0YXRpYyBsaXRlcmFsIHRyZWUgKi9cbiAgZm9yIChiaXRzID0gMDsgYml0cyA8PSBNQVhfQklUUyQxOyBiaXRzKyspIHtcbiAgICBibF9jb3VudFtiaXRzXSA9IDA7XG4gIH1cblxuICBuID0gMDtcbiAgd2hpbGUgKG4gPD0gMTQzKSB7XG4gICAgc3RhdGljX2x0cmVlW24gKiAyICsgMV0vKi5MZW4qLyA9IDg7XG4gICAgbisrO1xuICAgIGJsX2NvdW50WzhdKys7XG4gIH1cbiAgd2hpbGUgKG4gPD0gMjU1KSB7XG4gICAgc3RhdGljX2x0cmVlW24gKiAyICsgMV0vKi5MZW4qLyA9IDk7XG4gICAgbisrO1xuICAgIGJsX2NvdW50WzldKys7XG4gIH1cbiAgd2hpbGUgKG4gPD0gMjc5KSB7XG4gICAgc3RhdGljX2x0cmVlW24gKiAyICsgMV0vKi5MZW4qLyA9IDc7XG4gICAgbisrO1xuICAgIGJsX2NvdW50WzddKys7XG4gIH1cbiAgd2hpbGUgKG4gPD0gMjg3KSB7XG4gICAgc3RhdGljX2x0cmVlW24gKiAyICsgMV0vKi5MZW4qLyA9IDg7XG4gICAgbisrO1xuICAgIGJsX2NvdW50WzhdKys7XG4gIH1cbiAgLyogQ29kZXMgMjg2IGFuZCAyODcgZG8gbm90IGV4aXN0LCBidXQgd2UgbXVzdCBpbmNsdWRlIHRoZW0gaW4gdGhlXG4gICAqIHRyZWUgY29uc3RydWN0aW9uIHRvIGdldCBhIGNhbm9uaWNhbCBIdWZmbWFuIHRyZWUgKGxvbmdlc3QgY29kZVxuICAgKiBhbGwgb25lcylcbiAgICovXG4gIGdlbl9jb2RlcyhzdGF0aWNfbHRyZWUsIExfQ09ERVMkMSArIDEsIGJsX2NvdW50KTtcblxuICAvKiBUaGUgc3RhdGljIGRpc3RhbmNlIHRyZWUgaXMgdHJpdmlhbDogKi9cbiAgZm9yIChuID0gMDsgbiA8IERfQ09ERVMkMTsgbisrKSB7XG4gICAgc3RhdGljX2R0cmVlW24gKiAyICsgMV0vKi5MZW4qLyA9IDU7XG4gICAgc3RhdGljX2R0cmVlW24gKiAyXS8qLkNvZGUqLyA9IGJpX3JldmVyc2UobiwgNSk7XG4gIH1cblxuICAvLyBOb3cgZGF0YSByZWFkeSBhbmQgd2UgY2FuIGluaXQgc3RhdGljIHRyZWVzXG4gIHN0YXRpY19sX2Rlc2MgPSBuZXcgU3RhdGljVHJlZURlc2Moc3RhdGljX2x0cmVlLCBleHRyYV9sYml0cywgTElURVJBTFMkMSArIDEsIExfQ09ERVMkMSwgTUFYX0JJVFMkMSk7XG4gIHN0YXRpY19kX2Rlc2MgPSBuZXcgU3RhdGljVHJlZURlc2Moc3RhdGljX2R0cmVlLCBleHRyYV9kYml0cywgMCwgICAgICAgICAgRF9DT0RFUyQxLCBNQVhfQklUUyQxKTtcbiAgc3RhdGljX2JsX2Rlc2MgPSBuZXcgU3RhdGljVHJlZURlc2MobmV3IEFycmF5KDApLCBleHRyYV9ibGJpdHMsIDAsICAgICAgICAgQkxfQ09ERVMkMSwgTUFYX0JMX0JJVFMpO1xuXG4gIC8vc3RhdGljX2luaXRfZG9uZSA9IHRydWU7XG59O1xuXG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogSW5pdGlhbGl6ZSBhIG5ldyBibG9jay5cbiAqL1xuY29uc3QgaW5pdF9ibG9jayA9IChzKSA9PiB7XG5cbiAgbGV0IG47IC8qIGl0ZXJhdGVzIG92ZXIgdHJlZSBlbGVtZW50cyAqL1xuXG4gIC8qIEluaXRpYWxpemUgdGhlIHRyZWVzLiAqL1xuICBmb3IgKG4gPSAwOyBuIDwgTF9DT0RFUyQxOyAgbisrKSB7IHMuZHluX2x0cmVlW24gKiAyXS8qLkZyZXEqLyA9IDA7IH1cbiAgZm9yIChuID0gMDsgbiA8IERfQ09ERVMkMTsgIG4rKykgeyBzLmR5bl9kdHJlZVtuICogMl0vKi5GcmVxKi8gPSAwOyB9XG4gIGZvciAobiA9IDA7IG4gPCBCTF9DT0RFUyQxOyBuKyspIHsgcy5ibF90cmVlW24gKiAyXS8qLkZyZXEqLyA9IDA7IH1cblxuICBzLmR5bl9sdHJlZVtFTkRfQkxPQ0sgKiAyXS8qLkZyZXEqLyA9IDE7XG4gIHMub3B0X2xlbiA9IHMuc3RhdGljX2xlbiA9IDA7XG4gIHMuc3ltX25leHQgPSBzLm1hdGNoZXMgPSAwO1xufTtcblxuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIEZsdXNoIHRoZSBiaXQgYnVmZmVyIGFuZCBhbGlnbiB0aGUgb3V0cHV0IG9uIGEgYnl0ZSBib3VuZGFyeVxuICovXG5jb25zdCBiaV93aW5kdXAgPSAocykgPT5cbntcbiAgaWYgKHMuYmlfdmFsaWQgPiA4KSB7XG4gICAgcHV0X3Nob3J0KHMsIHMuYmlfYnVmKTtcbiAgfSBlbHNlIGlmIChzLmJpX3ZhbGlkID4gMCkge1xuICAgIC8vcHV0X2J5dGUocywgKEJ5dGUpcy0+YmlfYnVmKTtcbiAgICBzLnBlbmRpbmdfYnVmW3MucGVuZGluZysrXSA9IHMuYmlfYnVmO1xuICB9XG4gIHMuYmlfYnVmID0gMDtcbiAgcy5iaV92YWxpZCA9IDA7XG59O1xuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIENvbXBhcmVzIHRvIHN1YnRyZWVzLCB1c2luZyB0aGUgdHJlZSBkZXB0aCBhcyB0aWUgYnJlYWtlciB3aGVuXG4gKiB0aGUgc3VidHJlZXMgaGF2ZSBlcXVhbCBmcmVxdWVuY3kuIFRoaXMgbWluaW1pemVzIHRoZSB3b3JzdCBjYXNlIGxlbmd0aC5cbiAqL1xuY29uc3Qgc21hbGxlciA9ICh0cmVlLCBuLCBtLCBkZXB0aCkgPT4ge1xuXG4gIGNvbnN0IF9uMiA9IG4gKiAyO1xuICBjb25zdCBfbTIgPSBtICogMjtcbiAgcmV0dXJuICh0cmVlW19uMl0vKi5GcmVxKi8gPCB0cmVlW19tMl0vKi5GcmVxKi8gfHxcbiAgICAgICAgICh0cmVlW19uMl0vKi5GcmVxKi8gPT09IHRyZWVbX20yXS8qLkZyZXEqLyAmJiBkZXB0aFtuXSA8PSBkZXB0aFttXSkpO1xufTtcblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBSZXN0b3JlIHRoZSBoZWFwIHByb3BlcnR5IGJ5IG1vdmluZyBkb3duIHRoZSB0cmVlIHN0YXJ0aW5nIGF0IG5vZGUgayxcbiAqIGV4Y2hhbmdpbmcgYSBub2RlIHdpdGggdGhlIHNtYWxsZXN0IG9mIGl0cyB0d28gc29ucyBpZiBuZWNlc3NhcnksIHN0b3BwaW5nXG4gKiB3aGVuIHRoZSBoZWFwIHByb3BlcnR5IGlzIHJlLWVzdGFibGlzaGVkIChlYWNoIGZhdGhlciBzbWFsbGVyIHRoYW4gaXRzXG4gKiB0d28gc29ucykuXG4gKi9cbmNvbnN0IHBxZG93bmhlYXAgPSAocywgdHJlZSwgaykgPT4ge1xuLy8gICAgZGVmbGF0ZV9zdGF0ZSAqcztcbi8vICAgIGN0X2RhdGEgKnRyZWU7ICAvKiB0aGUgdHJlZSB0byByZXN0b3JlICovXG4vLyAgICBpbnQgazsgICAgICAgICAgICAgICAvKiBub2RlIHRvIG1vdmUgZG93biAqL1xuXG4gIGNvbnN0IHYgPSBzLmhlYXBba107XG4gIGxldCBqID0gayA8PCAxOyAgLyogbGVmdCBzb24gb2YgayAqL1xuICB3aGlsZSAoaiA8PSBzLmhlYXBfbGVuKSB7XG4gICAgLyogU2V0IGogdG8gdGhlIHNtYWxsZXN0IG9mIHRoZSB0d28gc29uczogKi9cbiAgICBpZiAoaiA8IHMuaGVhcF9sZW4gJiZcbiAgICAgIHNtYWxsZXIodHJlZSwgcy5oZWFwW2ogKyAxXSwgcy5oZWFwW2pdLCBzLmRlcHRoKSkge1xuICAgICAgaisrO1xuICAgIH1cbiAgICAvKiBFeGl0IGlmIHYgaXMgc21hbGxlciB0aGFuIGJvdGggc29ucyAqL1xuICAgIGlmIChzbWFsbGVyKHRyZWUsIHYsIHMuaGVhcFtqXSwgcy5kZXB0aCkpIHsgYnJlYWs7IH1cblxuICAgIC8qIEV4Y2hhbmdlIHYgd2l0aCB0aGUgc21hbGxlc3Qgc29uICovXG4gICAgcy5oZWFwW2tdID0gcy5oZWFwW2pdO1xuICAgIGsgPSBqO1xuXG4gICAgLyogQW5kIGNvbnRpbnVlIGRvd24gdGhlIHRyZWUsIHNldHRpbmcgaiB0byB0aGUgbGVmdCBzb24gb2YgayAqL1xuICAgIGogPDw9IDE7XG4gIH1cbiAgcy5oZWFwW2tdID0gdjtcbn07XG5cblxuLy8gaW5saW5lZCBtYW51YWxseVxuLy8gY29uc3QgU01BTExFU1QgPSAxO1xuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIFNlbmQgdGhlIGJsb2NrIGRhdGEgY29tcHJlc3NlZCB1c2luZyB0aGUgZ2l2ZW4gSHVmZm1hbiB0cmVlc1xuICovXG5jb25zdCBjb21wcmVzc19ibG9jayA9IChzLCBsdHJlZSwgZHRyZWUpID0+IHtcbi8vICAgIGRlZmxhdGVfc3RhdGUgKnM7XG4vLyAgICBjb25zdCBjdF9kYXRhICpsdHJlZTsgLyogbGl0ZXJhbCB0cmVlICovXG4vLyAgICBjb25zdCBjdF9kYXRhICpkdHJlZTsgLyogZGlzdGFuY2UgdHJlZSAqL1xuXG4gIGxldCBkaXN0OyAgICAgICAgICAgLyogZGlzdGFuY2Ugb2YgbWF0Y2hlZCBzdHJpbmcgKi9cbiAgbGV0IGxjOyAgICAgICAgICAgICAvKiBtYXRjaCBsZW5ndGggb3IgdW5tYXRjaGVkIGNoYXIgKGlmIGRpc3QgPT0gMCkgKi9cbiAgbGV0IHN4ID0gMDsgICAgICAgICAvKiBydW5uaW5nIGluZGV4IGluIHN5bV9idWYgKi9cbiAgbGV0IGNvZGU7ICAgICAgICAgICAvKiB0aGUgY29kZSB0byBzZW5kICovXG4gIGxldCBleHRyYTsgICAgICAgICAgLyogbnVtYmVyIG9mIGV4dHJhIGJpdHMgdG8gc2VuZCAqL1xuXG4gIGlmIChzLnN5bV9uZXh0ICE9PSAwKSB7XG4gICAgZG8ge1xuICAgICAgZGlzdCA9IHMucGVuZGluZ19idWZbcy5zeW1fYnVmICsgc3grK10gJiAweGZmO1xuICAgICAgZGlzdCArPSAocy5wZW5kaW5nX2J1ZltzLnN5bV9idWYgKyBzeCsrXSAmIDB4ZmYpIDw8IDg7XG4gICAgICBsYyA9IHMucGVuZGluZ19idWZbcy5zeW1fYnVmICsgc3grK107XG4gICAgICBpZiAoZGlzdCA9PT0gMCkge1xuICAgICAgICBzZW5kX2NvZGUocywgbGMsIGx0cmVlKTsgLyogc2VuZCBhIGxpdGVyYWwgYnl0ZSAqL1xuICAgICAgICAvL1RyYWNlY3YoaXNncmFwaChsYyksIChzdGRlcnIsXCIgJyVjJyBcIiwgbGMpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8qIEhlcmUsIGxjIGlzIHRoZSBtYXRjaCBsZW5ndGggLSBNSU5fTUFUQ0ggKi9cbiAgICAgICAgY29kZSA9IF9sZW5ndGhfY29kZVtsY107XG4gICAgICAgIHNlbmRfY29kZShzLCBjb2RlICsgTElURVJBTFMkMSArIDEsIGx0cmVlKTsgLyogc2VuZCB0aGUgbGVuZ3RoIGNvZGUgKi9cbiAgICAgICAgZXh0cmEgPSBleHRyYV9sYml0c1tjb2RlXTtcbiAgICAgICAgaWYgKGV4dHJhICE9PSAwKSB7XG4gICAgICAgICAgbGMgLT0gYmFzZV9sZW5ndGhbY29kZV07XG4gICAgICAgICAgc2VuZF9iaXRzKHMsIGxjLCBleHRyYSk7ICAgICAgIC8qIHNlbmQgdGhlIGV4dHJhIGxlbmd0aCBiaXRzICovXG4gICAgICAgIH1cbiAgICAgICAgZGlzdC0tOyAvKiBkaXN0IGlzIG5vdyB0aGUgbWF0Y2ggZGlzdGFuY2UgLSAxICovXG4gICAgICAgIGNvZGUgPSBkX2NvZGUoZGlzdCk7XG4gICAgICAgIC8vQXNzZXJ0IChjb2RlIDwgRF9DT0RFUywgXCJiYWQgZF9jb2RlXCIpO1xuXG4gICAgICAgIHNlbmRfY29kZShzLCBjb2RlLCBkdHJlZSk7ICAgICAgIC8qIHNlbmQgdGhlIGRpc3RhbmNlIGNvZGUgKi9cbiAgICAgICAgZXh0cmEgPSBleHRyYV9kYml0c1tjb2RlXTtcbiAgICAgICAgaWYgKGV4dHJhICE9PSAwKSB7XG4gICAgICAgICAgZGlzdCAtPSBiYXNlX2Rpc3RbY29kZV07XG4gICAgICAgICAgc2VuZF9iaXRzKHMsIGRpc3QsIGV4dHJhKTsgICAvKiBzZW5kIHRoZSBleHRyYSBkaXN0YW5jZSBiaXRzICovXG4gICAgICAgIH1cbiAgICAgIH0gLyogbGl0ZXJhbCBvciBtYXRjaCBwYWlyID8gKi9cblxuICAgICAgLyogQ2hlY2sgdGhhdCB0aGUgb3ZlcmxheSBiZXR3ZWVuIHBlbmRpbmdfYnVmIGFuZCBzeW1fYnVmIGlzIG9rOiAqL1xuICAgICAgLy9Bc3NlcnQocy0+cGVuZGluZyA8IHMtPmxpdF9idWZzaXplICsgc3gsIFwicGVuZGluZ0J1ZiBvdmVyZmxvd1wiKTtcblxuICAgIH0gd2hpbGUgKHN4IDwgcy5zeW1fbmV4dCk7XG4gIH1cblxuICBzZW5kX2NvZGUocywgRU5EX0JMT0NLLCBsdHJlZSk7XG59O1xuXG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogQ29uc3RydWN0IG9uZSBIdWZmbWFuIHRyZWUgYW5kIGFzc2lnbnMgdGhlIGNvZGUgYml0IHN0cmluZ3MgYW5kIGxlbmd0aHMuXG4gKiBVcGRhdGUgdGhlIHRvdGFsIGJpdCBsZW5ndGggZm9yIHRoZSBjdXJyZW50IGJsb2NrLlxuICogSU4gYXNzZXJ0aW9uOiB0aGUgZmllbGQgZnJlcSBpcyBzZXQgZm9yIGFsbCB0cmVlIGVsZW1lbnRzLlxuICogT1VUIGFzc2VydGlvbnM6IHRoZSBmaWVsZHMgbGVuIGFuZCBjb2RlIGFyZSBzZXQgdG8gdGhlIG9wdGltYWwgYml0IGxlbmd0aFxuICogICAgIGFuZCBjb3JyZXNwb25kaW5nIGNvZGUuIFRoZSBsZW5ndGggb3B0X2xlbiBpcyB1cGRhdGVkOyBzdGF0aWNfbGVuIGlzXG4gKiAgICAgYWxzbyB1cGRhdGVkIGlmIHN0cmVlIGlzIG5vdCBudWxsLiBUaGUgZmllbGQgbWF4X2NvZGUgaXMgc2V0LlxuICovXG5jb25zdCBidWlsZF90cmVlID0gKHMsIGRlc2MpID0+IHtcbi8vICAgIGRlZmxhdGVfc3RhdGUgKnM7XG4vLyAgICB0cmVlX2Rlc2MgKmRlc2M7IC8qIHRoZSB0cmVlIGRlc2NyaXB0b3IgKi9cblxuICBjb25zdCB0cmVlICAgICA9IGRlc2MuZHluX3RyZWU7XG4gIGNvbnN0IHN0cmVlICAgID0gZGVzYy5zdGF0X2Rlc2Muc3RhdGljX3RyZWU7XG4gIGNvbnN0IGhhc19zdHJlZSA9IGRlc2Muc3RhdF9kZXNjLmhhc19zdHJlZTtcbiAgY29uc3QgZWxlbXMgICAgPSBkZXNjLnN0YXRfZGVzYy5lbGVtcztcbiAgbGV0IG4sIG07ICAgICAgICAgIC8qIGl0ZXJhdGUgb3ZlciBoZWFwIGVsZW1lbnRzICovXG4gIGxldCBtYXhfY29kZSA9IC0xOyAvKiBsYXJnZXN0IGNvZGUgd2l0aCBub24gemVybyBmcmVxdWVuY3kgKi9cbiAgbGV0IG5vZGU7ICAgICAgICAgIC8qIG5ldyBub2RlIGJlaW5nIGNyZWF0ZWQgKi9cblxuICAvKiBDb25zdHJ1Y3QgdGhlIGluaXRpYWwgaGVhcCwgd2l0aCBsZWFzdCBmcmVxdWVudCBlbGVtZW50IGluXG4gICAqIGhlYXBbU01BTExFU1RdLiBUaGUgc29ucyBvZiBoZWFwW25dIGFyZSBoZWFwWzIqbl0gYW5kIGhlYXBbMipuKzFdLlxuICAgKiBoZWFwWzBdIGlzIG5vdCB1c2VkLlxuICAgKi9cbiAgcy5oZWFwX2xlbiA9IDA7XG4gIHMuaGVhcF9tYXggPSBIRUFQX1NJWkUkMTtcblxuICBmb3IgKG4gPSAwOyBuIDwgZWxlbXM7IG4rKykge1xuICAgIGlmICh0cmVlW24gKiAyXS8qLkZyZXEqLyAhPT0gMCkge1xuICAgICAgcy5oZWFwWysrcy5oZWFwX2xlbl0gPSBtYXhfY29kZSA9IG47XG4gICAgICBzLmRlcHRoW25dID0gMDtcblxuICAgIH0gZWxzZSB7XG4gICAgICB0cmVlW24gKiAyICsgMV0vKi5MZW4qLyA9IDA7XG4gICAgfVxuICB9XG5cbiAgLyogVGhlIHBremlwIGZvcm1hdCByZXF1aXJlcyB0aGF0IGF0IGxlYXN0IG9uZSBkaXN0YW5jZSBjb2RlIGV4aXN0cyxcbiAgICogYW5kIHRoYXQgYXQgbGVhc3Qgb25lIGJpdCBzaG91bGQgYmUgc2VudCBldmVuIGlmIHRoZXJlIGlzIG9ubHkgb25lXG4gICAqIHBvc3NpYmxlIGNvZGUuIFNvIHRvIGF2b2lkIHNwZWNpYWwgY2hlY2tzIGxhdGVyIG9uIHdlIGZvcmNlIGF0IGxlYXN0XG4gICAqIHR3byBjb2RlcyBvZiBub24gemVybyBmcmVxdWVuY3kuXG4gICAqL1xuICB3aGlsZSAocy5oZWFwX2xlbiA8IDIpIHtcbiAgICBub2RlID0gcy5oZWFwWysrcy5oZWFwX2xlbl0gPSAobWF4X2NvZGUgPCAyID8gKyttYXhfY29kZSA6IDApO1xuICAgIHRyZWVbbm9kZSAqIDJdLyouRnJlcSovID0gMTtcbiAgICBzLmRlcHRoW25vZGVdID0gMDtcbiAgICBzLm9wdF9sZW4tLTtcblxuICAgIGlmIChoYXNfc3RyZWUpIHtcbiAgICAgIHMuc3RhdGljX2xlbiAtPSBzdHJlZVtub2RlICogMiArIDFdLyouTGVuKi87XG4gICAgfVxuICAgIC8qIG5vZGUgaXMgMCBvciAxIHNvIGl0IGRvZXMgbm90IGhhdmUgZXh0cmEgYml0cyAqL1xuICB9XG4gIGRlc2MubWF4X2NvZGUgPSBtYXhfY29kZTtcblxuICAvKiBUaGUgZWxlbWVudHMgaGVhcFtoZWFwX2xlbi8yKzEgLi4gaGVhcF9sZW5dIGFyZSBsZWF2ZXMgb2YgdGhlIHRyZWUsXG4gICAqIGVzdGFibGlzaCBzdWItaGVhcHMgb2YgaW5jcmVhc2luZyBsZW5ndGhzOlxuICAgKi9cbiAgZm9yIChuID0gKHMuaGVhcF9sZW4gPj4gMS8qaW50IC8yKi8pOyBuID49IDE7IG4tLSkgeyBwcWRvd25oZWFwKHMsIHRyZWUsIG4pOyB9XG5cbiAgLyogQ29uc3RydWN0IHRoZSBIdWZmbWFuIHRyZWUgYnkgcmVwZWF0ZWRseSBjb21iaW5pbmcgdGhlIGxlYXN0IHR3b1xuICAgKiBmcmVxdWVudCBub2Rlcy5cbiAgICovXG4gIG5vZGUgPSBlbGVtczsgICAgICAgICAgICAgIC8qIG5leHQgaW50ZXJuYWwgbm9kZSBvZiB0aGUgdHJlZSAqL1xuICBkbyB7XG4gICAgLy9wcXJlbW92ZShzLCB0cmVlLCBuKTsgIC8qIG4gPSBub2RlIG9mIGxlYXN0IGZyZXF1ZW5jeSAqL1xuICAgIC8qKiogcHFyZW1vdmUgKioqL1xuICAgIG4gPSBzLmhlYXBbMS8qU01BTExFU1QqL107XG4gICAgcy5oZWFwWzEvKlNNQUxMRVNUKi9dID0gcy5oZWFwW3MuaGVhcF9sZW4tLV07XG4gICAgcHFkb3duaGVhcChzLCB0cmVlLCAxLypTTUFMTEVTVCovKTtcbiAgICAvKioqL1xuXG4gICAgbSA9IHMuaGVhcFsxLypTTUFMTEVTVCovXTsgLyogbSA9IG5vZGUgb2YgbmV4dCBsZWFzdCBmcmVxdWVuY3kgKi9cblxuICAgIHMuaGVhcFstLXMuaGVhcF9tYXhdID0gbjsgLyoga2VlcCB0aGUgbm9kZXMgc29ydGVkIGJ5IGZyZXF1ZW5jeSAqL1xuICAgIHMuaGVhcFstLXMuaGVhcF9tYXhdID0gbTtcblxuICAgIC8qIENyZWF0ZSBhIG5ldyBub2RlIGZhdGhlciBvZiBuIGFuZCBtICovXG4gICAgdHJlZVtub2RlICogMl0vKi5GcmVxKi8gPSB0cmVlW24gKiAyXS8qLkZyZXEqLyArIHRyZWVbbSAqIDJdLyouRnJlcSovO1xuICAgIHMuZGVwdGhbbm9kZV0gPSAocy5kZXB0aFtuXSA+PSBzLmRlcHRoW21dID8gcy5kZXB0aFtuXSA6IHMuZGVwdGhbbV0pICsgMTtcbiAgICB0cmVlW24gKiAyICsgMV0vKi5EYWQqLyA9IHRyZWVbbSAqIDIgKyAxXS8qLkRhZCovID0gbm9kZTtcblxuICAgIC8qIGFuZCBpbnNlcnQgdGhlIG5ldyBub2RlIGluIHRoZSBoZWFwICovXG4gICAgcy5oZWFwWzEvKlNNQUxMRVNUKi9dID0gbm9kZSsrO1xuICAgIHBxZG93bmhlYXAocywgdHJlZSwgMS8qU01BTExFU1QqLyk7XG5cbiAgfSB3aGlsZSAocy5oZWFwX2xlbiA+PSAyKTtcblxuICBzLmhlYXBbLS1zLmhlYXBfbWF4XSA9IHMuaGVhcFsxLypTTUFMTEVTVCovXTtcblxuICAvKiBBdCB0aGlzIHBvaW50LCB0aGUgZmllbGRzIGZyZXEgYW5kIGRhZCBhcmUgc2V0LiBXZSBjYW4gbm93XG4gICAqIGdlbmVyYXRlIHRoZSBiaXQgbGVuZ3Rocy5cbiAgICovXG4gIGdlbl9iaXRsZW4ocywgZGVzYyk7XG5cbiAgLyogVGhlIGZpZWxkIGxlbiBpcyBub3cgc2V0LCB3ZSBjYW4gZ2VuZXJhdGUgdGhlIGJpdCBjb2RlcyAqL1xuICBnZW5fY29kZXModHJlZSwgbWF4X2NvZGUsIHMuYmxfY291bnQpO1xufTtcblxuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIFNjYW4gYSBsaXRlcmFsIG9yIGRpc3RhbmNlIHRyZWUgdG8gZGV0ZXJtaW5lIHRoZSBmcmVxdWVuY2llcyBvZiB0aGUgY29kZXNcbiAqIGluIHRoZSBiaXQgbGVuZ3RoIHRyZWUuXG4gKi9cbmNvbnN0IHNjYW5fdHJlZSA9IChzLCB0cmVlLCBtYXhfY29kZSkgPT4ge1xuLy8gICAgZGVmbGF0ZV9zdGF0ZSAqcztcbi8vICAgIGN0X2RhdGEgKnRyZWU7ICAgLyogdGhlIHRyZWUgdG8gYmUgc2Nhbm5lZCAqL1xuLy8gICAgaW50IG1heF9jb2RlOyAgICAvKiBhbmQgaXRzIGxhcmdlc3QgY29kZSBvZiBub24gemVybyBmcmVxdWVuY3kgKi9cblxuICBsZXQgbjsgICAgICAgICAgICAgICAgICAgICAvKiBpdGVyYXRlcyBvdmVyIGFsbCB0cmVlIGVsZW1lbnRzICovXG4gIGxldCBwcmV2bGVuID0gLTE7ICAgICAgICAgIC8qIGxhc3QgZW1pdHRlZCBsZW5ndGggKi9cbiAgbGV0IGN1cmxlbjsgICAgICAgICAgICAgICAgLyogbGVuZ3RoIG9mIGN1cnJlbnQgY29kZSAqL1xuXG4gIGxldCBuZXh0bGVuID0gdHJlZVswICogMiArIDFdLyouTGVuKi87IC8qIGxlbmd0aCBvZiBuZXh0IGNvZGUgKi9cblxuICBsZXQgY291bnQgPSAwOyAgICAgICAgICAgICAvKiByZXBlYXQgY291bnQgb2YgdGhlIGN1cnJlbnQgY29kZSAqL1xuICBsZXQgbWF4X2NvdW50ID0gNzsgICAgICAgICAvKiBtYXggcmVwZWF0IGNvdW50ICovXG4gIGxldCBtaW5fY291bnQgPSA0OyAgICAgICAgIC8qIG1pbiByZXBlYXQgY291bnQgKi9cblxuICBpZiAobmV4dGxlbiA9PT0gMCkge1xuICAgIG1heF9jb3VudCA9IDEzODtcbiAgICBtaW5fY291bnQgPSAzO1xuICB9XG4gIHRyZWVbKG1heF9jb2RlICsgMSkgKiAyICsgMV0vKi5MZW4qLyA9IDB4ZmZmZjsgLyogZ3VhcmQgKi9cblxuICBmb3IgKG4gPSAwOyBuIDw9IG1heF9jb2RlOyBuKyspIHtcbiAgICBjdXJsZW4gPSBuZXh0bGVuO1xuICAgIG5leHRsZW4gPSB0cmVlWyhuICsgMSkgKiAyICsgMV0vKi5MZW4qLztcblxuICAgIGlmICgrK2NvdW50IDwgbWF4X2NvdW50ICYmIGN1cmxlbiA9PT0gbmV4dGxlbikge1xuICAgICAgY29udGludWU7XG5cbiAgICB9IGVsc2UgaWYgKGNvdW50IDwgbWluX2NvdW50KSB7XG4gICAgICBzLmJsX3RyZWVbY3VybGVuICogMl0vKi5GcmVxKi8gKz0gY291bnQ7XG5cbiAgICB9IGVsc2UgaWYgKGN1cmxlbiAhPT0gMCkge1xuXG4gICAgICBpZiAoY3VybGVuICE9PSBwcmV2bGVuKSB7IHMuYmxfdHJlZVtjdXJsZW4gKiAyXS8qLkZyZXEqLysrOyB9XG4gICAgICBzLmJsX3RyZWVbUkVQXzNfNiAqIDJdLyouRnJlcSovKys7XG5cbiAgICB9IGVsc2UgaWYgKGNvdW50IDw9IDEwKSB7XG4gICAgICBzLmJsX3RyZWVbUkVQWl8zXzEwICogMl0vKi5GcmVxKi8rKztcblxuICAgIH0gZWxzZSB7XG4gICAgICBzLmJsX3RyZWVbUkVQWl8xMV8xMzggKiAyXS8qLkZyZXEqLysrO1xuICAgIH1cblxuICAgIGNvdW50ID0gMDtcbiAgICBwcmV2bGVuID0gY3VybGVuO1xuXG4gICAgaWYgKG5leHRsZW4gPT09IDApIHtcbiAgICAgIG1heF9jb3VudCA9IDEzODtcbiAgICAgIG1pbl9jb3VudCA9IDM7XG5cbiAgICB9IGVsc2UgaWYgKGN1cmxlbiA9PT0gbmV4dGxlbikge1xuICAgICAgbWF4X2NvdW50ID0gNjtcbiAgICAgIG1pbl9jb3VudCA9IDM7XG5cbiAgICB9IGVsc2Uge1xuICAgICAgbWF4X2NvdW50ID0gNztcbiAgICAgIG1pbl9jb3VudCA9IDQ7XG4gICAgfVxuICB9XG59O1xuXG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogU2VuZCBhIGxpdGVyYWwgb3IgZGlzdGFuY2UgdHJlZSBpbiBjb21wcmVzc2VkIGZvcm0sIHVzaW5nIHRoZSBjb2RlcyBpblxuICogYmxfdHJlZS5cbiAqL1xuY29uc3Qgc2VuZF90cmVlID0gKHMsIHRyZWUsIG1heF9jb2RlKSA9PiB7XG4vLyAgICBkZWZsYXRlX3N0YXRlICpzO1xuLy8gICAgY3RfZGF0YSAqdHJlZTsgLyogdGhlIHRyZWUgdG8gYmUgc2Nhbm5lZCAqL1xuLy8gICAgaW50IG1heF9jb2RlOyAgICAgICAvKiBhbmQgaXRzIGxhcmdlc3QgY29kZSBvZiBub24gemVybyBmcmVxdWVuY3kgKi9cblxuICBsZXQgbjsgICAgICAgICAgICAgICAgICAgICAvKiBpdGVyYXRlcyBvdmVyIGFsbCB0cmVlIGVsZW1lbnRzICovXG4gIGxldCBwcmV2bGVuID0gLTE7ICAgICAgICAgIC8qIGxhc3QgZW1pdHRlZCBsZW5ndGggKi9cbiAgbGV0IGN1cmxlbjsgICAgICAgICAgICAgICAgLyogbGVuZ3RoIG9mIGN1cnJlbnQgY29kZSAqL1xuXG4gIGxldCBuZXh0bGVuID0gdHJlZVswICogMiArIDFdLyouTGVuKi87IC8qIGxlbmd0aCBvZiBuZXh0IGNvZGUgKi9cblxuICBsZXQgY291bnQgPSAwOyAgICAgICAgICAgICAvKiByZXBlYXQgY291bnQgb2YgdGhlIGN1cnJlbnQgY29kZSAqL1xuICBsZXQgbWF4X2NvdW50ID0gNzsgICAgICAgICAvKiBtYXggcmVwZWF0IGNvdW50ICovXG4gIGxldCBtaW5fY291bnQgPSA0OyAgICAgICAgIC8qIG1pbiByZXBlYXQgY291bnQgKi9cblxuICAvKiB0cmVlW21heF9jb2RlKzFdLkxlbiA9IC0xOyAqLyAgLyogZ3VhcmQgYWxyZWFkeSBzZXQgKi9cbiAgaWYgKG5leHRsZW4gPT09IDApIHtcbiAgICBtYXhfY291bnQgPSAxMzg7XG4gICAgbWluX2NvdW50ID0gMztcbiAgfVxuXG4gIGZvciAobiA9IDA7IG4gPD0gbWF4X2NvZGU7IG4rKykge1xuICAgIGN1cmxlbiA9IG5leHRsZW47XG4gICAgbmV4dGxlbiA9IHRyZWVbKG4gKyAxKSAqIDIgKyAxXS8qLkxlbiovO1xuXG4gICAgaWYgKCsrY291bnQgPCBtYXhfY291bnQgJiYgY3VybGVuID09PSBuZXh0bGVuKSB7XG4gICAgICBjb250aW51ZTtcblxuICAgIH0gZWxzZSBpZiAoY291bnQgPCBtaW5fY291bnQpIHtcbiAgICAgIGRvIHsgc2VuZF9jb2RlKHMsIGN1cmxlbiwgcy5ibF90cmVlKTsgfSB3aGlsZSAoLS1jb3VudCAhPT0gMCk7XG5cbiAgICB9IGVsc2UgaWYgKGN1cmxlbiAhPT0gMCkge1xuICAgICAgaWYgKGN1cmxlbiAhPT0gcHJldmxlbikge1xuICAgICAgICBzZW5kX2NvZGUocywgY3VybGVuLCBzLmJsX3RyZWUpO1xuICAgICAgICBjb3VudC0tO1xuICAgICAgfVxuICAgICAgLy9Bc3NlcnQoY291bnQgPj0gMyAmJiBjb3VudCA8PSA2LCBcIiAzXzY/XCIpO1xuICAgICAgc2VuZF9jb2RlKHMsIFJFUF8zXzYsIHMuYmxfdHJlZSk7XG4gICAgICBzZW5kX2JpdHMocywgY291bnQgLSAzLCAyKTtcblxuICAgIH0gZWxzZSBpZiAoY291bnQgPD0gMTApIHtcbiAgICAgIHNlbmRfY29kZShzLCBSRVBaXzNfMTAsIHMuYmxfdHJlZSk7XG4gICAgICBzZW5kX2JpdHMocywgY291bnQgLSAzLCAzKTtcblxuICAgIH0gZWxzZSB7XG4gICAgICBzZW5kX2NvZGUocywgUkVQWl8xMV8xMzgsIHMuYmxfdHJlZSk7XG4gICAgICBzZW5kX2JpdHMocywgY291bnQgLSAxMSwgNyk7XG4gICAgfVxuXG4gICAgY291bnQgPSAwO1xuICAgIHByZXZsZW4gPSBjdXJsZW47XG4gICAgaWYgKG5leHRsZW4gPT09IDApIHtcbiAgICAgIG1heF9jb3VudCA9IDEzODtcbiAgICAgIG1pbl9jb3VudCA9IDM7XG5cbiAgICB9IGVsc2UgaWYgKGN1cmxlbiA9PT0gbmV4dGxlbikge1xuICAgICAgbWF4X2NvdW50ID0gNjtcbiAgICAgIG1pbl9jb3VudCA9IDM7XG5cbiAgICB9IGVsc2Uge1xuICAgICAgbWF4X2NvdW50ID0gNztcbiAgICAgIG1pbl9jb3VudCA9IDQ7XG4gICAgfVxuICB9XG59O1xuXG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogQ29uc3RydWN0IHRoZSBIdWZmbWFuIHRyZWUgZm9yIHRoZSBiaXQgbGVuZ3RocyBhbmQgcmV0dXJuIHRoZSBpbmRleCBpblxuICogYmxfb3JkZXIgb2YgdGhlIGxhc3QgYml0IGxlbmd0aCBjb2RlIHRvIHNlbmQuXG4gKi9cbmNvbnN0IGJ1aWxkX2JsX3RyZWUgPSAocykgPT4ge1xuXG4gIGxldCBtYXhfYmxpbmRleDsgIC8qIGluZGV4IG9mIGxhc3QgYml0IGxlbmd0aCBjb2RlIG9mIG5vbiB6ZXJvIGZyZXEgKi9cblxuICAvKiBEZXRlcm1pbmUgdGhlIGJpdCBsZW5ndGggZnJlcXVlbmNpZXMgZm9yIGxpdGVyYWwgYW5kIGRpc3RhbmNlIHRyZWVzICovXG4gIHNjYW5fdHJlZShzLCBzLmR5bl9sdHJlZSwgcy5sX2Rlc2MubWF4X2NvZGUpO1xuICBzY2FuX3RyZWUocywgcy5keW5fZHRyZWUsIHMuZF9kZXNjLm1heF9jb2RlKTtcblxuICAvKiBCdWlsZCB0aGUgYml0IGxlbmd0aCB0cmVlOiAqL1xuICBidWlsZF90cmVlKHMsIHMuYmxfZGVzYyk7XG4gIC8qIG9wdF9sZW4gbm93IGluY2x1ZGVzIHRoZSBsZW5ndGggb2YgdGhlIHRyZWUgcmVwcmVzZW50YXRpb25zLCBleGNlcHRcbiAgICogdGhlIGxlbmd0aHMgb2YgdGhlIGJpdCBsZW5ndGhzIGNvZGVzIGFuZCB0aGUgNSs1KzQgYml0cyBmb3IgdGhlIGNvdW50cy5cbiAgICovXG5cbiAgLyogRGV0ZXJtaW5lIHRoZSBudW1iZXIgb2YgYml0IGxlbmd0aCBjb2RlcyB0byBzZW5kLiBUaGUgcGt6aXAgZm9ybWF0XG4gICAqIHJlcXVpcmVzIHRoYXQgYXQgbGVhc3QgNCBiaXQgbGVuZ3RoIGNvZGVzIGJlIHNlbnQuIChhcHBub3RlLnR4dCBzYXlzXG4gICAqIDMgYnV0IHRoZSBhY3R1YWwgdmFsdWUgdXNlZCBpcyA0LilcbiAgICovXG4gIGZvciAobWF4X2JsaW5kZXggPSBCTF9DT0RFUyQxIC0gMTsgbWF4X2JsaW5kZXggPj0gMzsgbWF4X2JsaW5kZXgtLSkge1xuICAgIGlmIChzLmJsX3RyZWVbYmxfb3JkZXJbbWF4X2JsaW5kZXhdICogMiArIDFdLyouTGVuKi8gIT09IDApIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuICAvKiBVcGRhdGUgb3B0X2xlbiB0byBpbmNsdWRlIHRoZSBiaXQgbGVuZ3RoIHRyZWUgYW5kIGNvdW50cyAqL1xuICBzLm9wdF9sZW4gKz0gMyAqIChtYXhfYmxpbmRleCArIDEpICsgNSArIDUgKyA0O1xuICAvL1RyYWNldigoc3RkZXJyLCBcIlxcbmR5biB0cmVlczogZHluICVsZCwgc3RhdCAlbGRcIixcbiAgLy8gICAgICAgIHMtPm9wdF9sZW4sIHMtPnN0YXRpY19sZW4pKTtcblxuICByZXR1cm4gbWF4X2JsaW5kZXg7XG59O1xuXG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogU2VuZCB0aGUgaGVhZGVyIGZvciBhIGJsb2NrIHVzaW5nIGR5bmFtaWMgSHVmZm1hbiB0cmVlczogdGhlIGNvdW50cywgdGhlXG4gKiBsZW5ndGhzIG9mIHRoZSBiaXQgbGVuZ3RoIGNvZGVzLCB0aGUgbGl0ZXJhbCB0cmVlIGFuZCB0aGUgZGlzdGFuY2UgdHJlZS5cbiAqIElOIGFzc2VydGlvbjogbGNvZGVzID49IDI1NywgZGNvZGVzID49IDEsIGJsY29kZXMgPj0gNC5cbiAqL1xuY29uc3Qgc2VuZF9hbGxfdHJlZXMgPSAocywgbGNvZGVzLCBkY29kZXMsIGJsY29kZXMpID0+IHtcbi8vICAgIGRlZmxhdGVfc3RhdGUgKnM7XG4vLyAgICBpbnQgbGNvZGVzLCBkY29kZXMsIGJsY29kZXM7IC8qIG51bWJlciBvZiBjb2RlcyBmb3IgZWFjaCB0cmVlICovXG5cbiAgbGV0IHJhbms7ICAgICAgICAgICAgICAgICAgICAvKiBpbmRleCBpbiBibF9vcmRlciAqL1xuXG4gIC8vQXNzZXJ0IChsY29kZXMgPj0gMjU3ICYmIGRjb2RlcyA+PSAxICYmIGJsY29kZXMgPj0gNCwgXCJub3QgZW5vdWdoIGNvZGVzXCIpO1xuICAvL0Fzc2VydCAobGNvZGVzIDw9IExfQ09ERVMgJiYgZGNvZGVzIDw9IERfQ09ERVMgJiYgYmxjb2RlcyA8PSBCTF9DT0RFUyxcbiAgLy8gICAgICAgIFwidG9vIG1hbnkgY29kZXNcIik7XG4gIC8vVHJhY2V2KChzdGRlcnIsIFwiXFxuYmwgY291bnRzOiBcIikpO1xuICBzZW5kX2JpdHMocywgbGNvZGVzIC0gMjU3LCA1KTsgLyogbm90ICsyNTUgYXMgc3RhdGVkIGluIGFwcG5vdGUudHh0ICovXG4gIHNlbmRfYml0cyhzLCBkY29kZXMgLSAxLCAgIDUpO1xuICBzZW5kX2JpdHMocywgYmxjb2RlcyAtIDQsICA0KTsgLyogbm90IC0zIGFzIHN0YXRlZCBpbiBhcHBub3RlLnR4dCAqL1xuICBmb3IgKHJhbmsgPSAwOyByYW5rIDwgYmxjb2RlczsgcmFuaysrKSB7XG4gICAgLy9UcmFjZXYoKHN0ZGVyciwgXCJcXG5ibCBjb2RlICUyZCBcIiwgYmxfb3JkZXJbcmFua10pKTtcbiAgICBzZW5kX2JpdHMocywgcy5ibF90cmVlW2JsX29yZGVyW3JhbmtdICogMiArIDFdLyouTGVuKi8sIDMpO1xuICB9XG4gIC8vVHJhY2V2KChzdGRlcnIsIFwiXFxuYmwgdHJlZTogc2VudCAlbGRcIiwgcy0+Yml0c19zZW50KSk7XG5cbiAgc2VuZF90cmVlKHMsIHMuZHluX2x0cmVlLCBsY29kZXMgLSAxKTsgLyogbGl0ZXJhbCB0cmVlICovXG4gIC8vVHJhY2V2KChzdGRlcnIsIFwiXFxubGl0IHRyZWU6IHNlbnQgJWxkXCIsIHMtPmJpdHNfc2VudCkpO1xuXG4gIHNlbmRfdHJlZShzLCBzLmR5bl9kdHJlZSwgZGNvZGVzIC0gMSk7IC8qIGRpc3RhbmNlIHRyZWUgKi9cbiAgLy9UcmFjZXYoKHN0ZGVyciwgXCJcXG5kaXN0IHRyZWU6IHNlbnQgJWxkXCIsIHMtPmJpdHNfc2VudCkpO1xufTtcblxuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIENoZWNrIGlmIHRoZSBkYXRhIHR5cGUgaXMgVEVYVCBvciBCSU5BUlksIHVzaW5nIHRoZSBmb2xsb3dpbmcgYWxnb3JpdGhtOlxuICogLSBURVhUIGlmIHRoZSB0d28gY29uZGl0aW9ucyBiZWxvdyBhcmUgc2F0aXNmaWVkOlxuICogICAgYSkgVGhlcmUgYXJlIG5vIG5vbi1wb3J0YWJsZSBjb250cm9sIGNoYXJhY3RlcnMgYmVsb25naW5nIHRvIHRoZVxuICogICAgICAgXCJibG9jayBsaXN0XCIgKDAuLjYsIDE0Li4yNSwgMjguLjMxKS5cbiAqICAgIGIpIFRoZXJlIGlzIGF0IGxlYXN0IG9uZSBwcmludGFibGUgY2hhcmFjdGVyIGJlbG9uZ2luZyB0byB0aGVcbiAqICAgICAgIFwiYWxsb3cgbGlzdFwiICg5IHtUQUJ9LCAxMCB7TEZ9LCAxMyB7Q1J9LCAzMi4uMjU1KS5cbiAqIC0gQklOQVJZIG90aGVyd2lzZS5cbiAqIC0gVGhlIGZvbGxvd2luZyBwYXJ0aWFsbHktcG9ydGFibGUgY29udHJvbCBjaGFyYWN0ZXJzIGZvcm0gYVxuICogICBcImdyYXkgbGlzdFwiIHRoYXQgaXMgaWdub3JlZCBpbiB0aGlzIGRldGVjdGlvbiBhbGdvcml0aG06XG4gKiAgICg3IHtCRUx9LCA4IHtCU30sIDExIHtWVH0sIDEyIHtGRn0sIDI2IHtTVUJ9LCAyNyB7RVNDfSkuXG4gKiBJTiBhc3NlcnRpb246IHRoZSBmaWVsZHMgRnJlcSBvZiBkeW5fbHRyZWUgYXJlIHNldC5cbiAqL1xuY29uc3QgZGV0ZWN0X2RhdGFfdHlwZSA9IChzKSA9PiB7XG4gIC8qIGJsb2NrX21hc2sgaXMgdGhlIGJpdCBtYXNrIG9mIGJsb2NrLWxpc3RlZCBieXRlc1xuICAgKiBzZXQgYml0cyAwLi42LCAxNC4uMjUsIGFuZCAyOC4uMzFcbiAgICogMHhmM2ZmYzA3ZiA9IGJpbmFyeSAxMTExMDAxMTExMTExMTExMTEwMDAwMDAwMTExMTExMVxuICAgKi9cbiAgbGV0IGJsb2NrX21hc2sgPSAweGYzZmZjMDdmO1xuICBsZXQgbjtcblxuICAvKiBDaGVjayBmb3Igbm9uLXRleHR1YWwgKFwiYmxvY2stbGlzdGVkXCIpIGJ5dGVzLiAqL1xuICBmb3IgKG4gPSAwOyBuIDw9IDMxOyBuKyssIGJsb2NrX21hc2sgPj4+PSAxKSB7XG4gICAgaWYgKChibG9ja19tYXNrICYgMSkgJiYgKHMuZHluX2x0cmVlW24gKiAyXS8qLkZyZXEqLyAhPT0gMCkpIHtcbiAgICAgIHJldHVybiBaX0JJTkFSWTtcbiAgICB9XG4gIH1cblxuICAvKiBDaGVjayBmb3IgdGV4dHVhbCAoXCJhbGxvdy1saXN0ZWRcIikgYnl0ZXMuICovXG4gIGlmIChzLmR5bl9sdHJlZVs5ICogMl0vKi5GcmVxKi8gIT09IDAgfHwgcy5keW5fbHRyZWVbMTAgKiAyXS8qLkZyZXEqLyAhPT0gMCB8fFxuICAgICAgcy5keW5fbHRyZWVbMTMgKiAyXS8qLkZyZXEqLyAhPT0gMCkge1xuICAgIHJldHVybiBaX1RFWFQ7XG4gIH1cbiAgZm9yIChuID0gMzI7IG4gPCBMSVRFUkFMUyQxOyBuKyspIHtcbiAgICBpZiAocy5keW5fbHRyZWVbbiAqIDJdLyouRnJlcSovICE9PSAwKSB7XG4gICAgICByZXR1cm4gWl9URVhUO1xuICAgIH1cbiAgfVxuXG4gIC8qIFRoZXJlIGFyZSBubyBcImJsb2NrLWxpc3RlZFwiIG9yIFwiYWxsb3ctbGlzdGVkXCIgYnl0ZXM6XG4gICAqIHRoaXMgc3RyZWFtIGVpdGhlciBpcyBlbXB0eSBvciBoYXMgdG9sZXJhdGVkIChcImdyYXktbGlzdGVkXCIpIGJ5dGVzIG9ubHkuXG4gICAqL1xuICByZXR1cm4gWl9CSU5BUlk7XG59O1xuXG5cbmxldCBzdGF0aWNfaW5pdF9kb25lID0gZmFsc2U7XG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogSW5pdGlhbGl6ZSB0aGUgdHJlZSBkYXRhIHN0cnVjdHVyZXMgZm9yIGEgbmV3IHpsaWIgc3RyZWFtLlxuICovXG5jb25zdCBfdHJfaW5pdCQxID0gKHMpID0+XG57XG5cbiAgaWYgKCFzdGF0aWNfaW5pdF9kb25lKSB7XG4gICAgdHJfc3RhdGljX2luaXQoKTtcbiAgICBzdGF0aWNfaW5pdF9kb25lID0gdHJ1ZTtcbiAgfVxuXG4gIHMubF9kZXNjICA9IG5ldyBUcmVlRGVzYyhzLmR5bl9sdHJlZSwgc3RhdGljX2xfZGVzYyk7XG4gIHMuZF9kZXNjICA9IG5ldyBUcmVlRGVzYyhzLmR5bl9kdHJlZSwgc3RhdGljX2RfZGVzYyk7XG4gIHMuYmxfZGVzYyA9IG5ldyBUcmVlRGVzYyhzLmJsX3RyZWUsIHN0YXRpY19ibF9kZXNjKTtcblxuICBzLmJpX2J1ZiA9IDA7XG4gIHMuYmlfdmFsaWQgPSAwO1xuXG4gIC8qIEluaXRpYWxpemUgdGhlIGZpcnN0IGJsb2NrIG9mIHRoZSBmaXJzdCBmaWxlOiAqL1xuICBpbml0X2Jsb2NrKHMpO1xufTtcblxuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIFNlbmQgYSBzdG9yZWQgYmxvY2tcbiAqL1xuY29uc3QgX3RyX3N0b3JlZF9ibG9jayQxID0gKHMsIGJ1Ziwgc3RvcmVkX2xlbiwgbGFzdCkgPT4ge1xuLy9EZWZsYXRlU3RhdGUgKnM7XG4vL2NoYXJmICpidWY7ICAgICAgIC8qIGlucHV0IGJsb2NrICovXG4vL3VsZyBzdG9yZWRfbGVuOyAgIC8qIGxlbmd0aCBvZiBpbnB1dCBibG9jayAqL1xuLy9pbnQgbGFzdDsgICAgICAgICAvKiBvbmUgaWYgdGhpcyBpcyB0aGUgbGFzdCBibG9jayBmb3IgYSBmaWxlICovXG5cbiAgc2VuZF9iaXRzKHMsIChTVE9SRURfQkxPQ0sgPDwgMSkgKyAobGFzdCA/IDEgOiAwKSwgMyk7ICAgIC8qIHNlbmQgYmxvY2sgdHlwZSAqL1xuICBiaV93aW5kdXAocyk7ICAgICAgICAvKiBhbGlnbiBvbiBieXRlIGJvdW5kYXJ5ICovXG4gIHB1dF9zaG9ydChzLCBzdG9yZWRfbGVuKTtcbiAgcHV0X3Nob3J0KHMsIH5zdG9yZWRfbGVuKTtcbiAgaWYgKHN0b3JlZF9sZW4pIHtcbiAgICBzLnBlbmRpbmdfYnVmLnNldChzLndpbmRvdy5zdWJhcnJheShidWYsIGJ1ZiArIHN0b3JlZF9sZW4pLCBzLnBlbmRpbmcpO1xuICB9XG4gIHMucGVuZGluZyArPSBzdG9yZWRfbGVuO1xufTtcblxuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIFNlbmQgb25lIGVtcHR5IHN0YXRpYyBibG9jayB0byBnaXZlIGVub3VnaCBsb29rYWhlYWQgZm9yIGluZmxhdGUuXG4gKiBUaGlzIHRha2VzIDEwIGJpdHMsIG9mIHdoaWNoIDcgbWF5IHJlbWFpbiBpbiB0aGUgYml0IGJ1ZmZlci5cbiAqL1xuY29uc3QgX3RyX2FsaWduJDEgPSAocykgPT4ge1xuICBzZW5kX2JpdHMocywgU1RBVElDX1RSRUVTIDw8IDEsIDMpO1xuICBzZW5kX2NvZGUocywgRU5EX0JMT0NLLCBzdGF0aWNfbHRyZWUpO1xuICBiaV9mbHVzaChzKTtcbn07XG5cblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBEZXRlcm1pbmUgdGhlIGJlc3QgZW5jb2RpbmcgZm9yIHRoZSBjdXJyZW50IGJsb2NrOiBkeW5hbWljIHRyZWVzLCBzdGF0aWNcbiAqIHRyZWVzIG9yIHN0b3JlLCBhbmQgd3JpdGUgb3V0IHRoZSBlbmNvZGVkIGJsb2NrLlxuICovXG5jb25zdCBfdHJfZmx1c2hfYmxvY2skMSA9IChzLCBidWYsIHN0b3JlZF9sZW4sIGxhc3QpID0+IHtcbi8vRGVmbGF0ZVN0YXRlICpzO1xuLy9jaGFyZiAqYnVmOyAgICAgICAvKiBpbnB1dCBibG9jaywgb3IgTlVMTCBpZiB0b28gb2xkICovXG4vL3VsZyBzdG9yZWRfbGVuOyAgIC8qIGxlbmd0aCBvZiBpbnB1dCBibG9jayAqL1xuLy9pbnQgbGFzdDsgICAgICAgICAvKiBvbmUgaWYgdGhpcyBpcyB0aGUgbGFzdCBibG9jayBmb3IgYSBmaWxlICovXG5cbiAgbGV0IG9wdF9sZW5iLCBzdGF0aWNfbGVuYjsgIC8qIG9wdF9sZW4gYW5kIHN0YXRpY19sZW4gaW4gYnl0ZXMgKi9cbiAgbGV0IG1heF9ibGluZGV4ID0gMDsgICAgICAgIC8qIGluZGV4IG9mIGxhc3QgYml0IGxlbmd0aCBjb2RlIG9mIG5vbiB6ZXJvIGZyZXEgKi9cblxuICAvKiBCdWlsZCB0aGUgSHVmZm1hbiB0cmVlcyB1bmxlc3MgYSBzdG9yZWQgYmxvY2sgaXMgZm9yY2VkICovXG4gIGlmIChzLmxldmVsID4gMCkge1xuXG4gICAgLyogQ2hlY2sgaWYgdGhlIGZpbGUgaXMgYmluYXJ5IG9yIHRleHQgKi9cbiAgICBpZiAocy5zdHJtLmRhdGFfdHlwZSA9PT0gWl9VTktOT1dOJDEpIHtcbiAgICAgIHMuc3RybS5kYXRhX3R5cGUgPSBkZXRlY3RfZGF0YV90eXBlKHMpO1xuICAgIH1cblxuICAgIC8qIENvbnN0cnVjdCB0aGUgbGl0ZXJhbCBhbmQgZGlzdGFuY2UgdHJlZXMgKi9cbiAgICBidWlsZF90cmVlKHMsIHMubF9kZXNjKTtcbiAgICAvLyBUcmFjZXYoKHN0ZGVyciwgXCJcXG5saXQgZGF0YTogZHluICVsZCwgc3RhdCAlbGRcIiwgcy0+b3B0X2xlbixcbiAgICAvLyAgICAgICAgcy0+c3RhdGljX2xlbikpO1xuXG4gICAgYnVpbGRfdHJlZShzLCBzLmRfZGVzYyk7XG4gICAgLy8gVHJhY2V2KChzdGRlcnIsIFwiXFxuZGlzdCBkYXRhOiBkeW4gJWxkLCBzdGF0ICVsZFwiLCBzLT5vcHRfbGVuLFxuICAgIC8vICAgICAgICBzLT5zdGF0aWNfbGVuKSk7XG4gICAgLyogQXQgdGhpcyBwb2ludCwgb3B0X2xlbiBhbmQgc3RhdGljX2xlbiBhcmUgdGhlIHRvdGFsIGJpdCBsZW5ndGhzIG9mXG4gICAgICogdGhlIGNvbXByZXNzZWQgYmxvY2sgZGF0YSwgZXhjbHVkaW5nIHRoZSB0cmVlIHJlcHJlc2VudGF0aW9ucy5cbiAgICAgKi9cblxuICAgIC8qIEJ1aWxkIHRoZSBiaXQgbGVuZ3RoIHRyZWUgZm9yIHRoZSBhYm92ZSB0d28gdHJlZXMsIGFuZCBnZXQgdGhlIGluZGV4XG4gICAgICogaW4gYmxfb3JkZXIgb2YgdGhlIGxhc3QgYml0IGxlbmd0aCBjb2RlIHRvIHNlbmQuXG4gICAgICovXG4gICAgbWF4X2JsaW5kZXggPSBidWlsZF9ibF90cmVlKHMpO1xuXG4gICAgLyogRGV0ZXJtaW5lIHRoZSBiZXN0IGVuY29kaW5nLiBDb21wdXRlIHRoZSBibG9jayBsZW5ndGhzIGluIGJ5dGVzLiAqL1xuICAgIG9wdF9sZW5iID0gKHMub3B0X2xlbiArIDMgKyA3KSA+Pj4gMztcbiAgICBzdGF0aWNfbGVuYiA9IChzLnN0YXRpY19sZW4gKyAzICsgNykgPj4+IDM7XG5cbiAgICAvLyBUcmFjZXYoKHN0ZGVyciwgXCJcXG5vcHQgJWx1KCVsdSkgc3RhdCAlbHUoJWx1KSBzdG9yZWQgJWx1IGxpdCAldSBcIixcbiAgICAvLyAgICAgICAgb3B0X2xlbmIsIHMtPm9wdF9sZW4sIHN0YXRpY19sZW5iLCBzLT5zdGF0aWNfbGVuLCBzdG9yZWRfbGVuLFxuICAgIC8vICAgICAgICBzLT5zeW1fbmV4dCAvIDMpKTtcblxuICAgIGlmIChzdGF0aWNfbGVuYiA8PSBvcHRfbGVuYikgeyBvcHRfbGVuYiA9IHN0YXRpY19sZW5iOyB9XG5cbiAgfSBlbHNlIHtcbiAgICAvLyBBc3NlcnQoYnVmICE9IChjaGFyKikwLCBcImxvc3QgYnVmXCIpO1xuICAgIG9wdF9sZW5iID0gc3RhdGljX2xlbmIgPSBzdG9yZWRfbGVuICsgNTsgLyogZm9yY2UgYSBzdG9yZWQgYmxvY2sgKi9cbiAgfVxuXG4gIGlmICgoc3RvcmVkX2xlbiArIDQgPD0gb3B0X2xlbmIpICYmIChidWYgIT09IC0xKSkge1xuICAgIC8qIDQ6IHR3byB3b3JkcyBmb3IgdGhlIGxlbmd0aHMgKi9cblxuICAgIC8qIFRoZSB0ZXN0IGJ1ZiAhPSBOVUxMIGlzIG9ubHkgbmVjZXNzYXJ5IGlmIExJVF9CVUZTSVpFID4gV1NJWkUuXG4gICAgICogT3RoZXJ3aXNlIHdlIGNhbid0IGhhdmUgcHJvY2Vzc2VkIG1vcmUgdGhhbiBXU0laRSBpbnB1dCBieXRlcyBzaW5jZVxuICAgICAqIHRoZSBsYXN0IGJsb2NrIGZsdXNoLCBiZWNhdXNlIGNvbXByZXNzaW9uIHdvdWxkIGhhdmUgYmVlblxuICAgICAqIHN1Y2Nlc3NmdWwuIElmIExJVF9CVUZTSVpFIDw9IFdTSVpFLCBpdCBpcyBuZXZlciB0b28gbGF0ZSB0b1xuICAgICAqIHRyYW5zZm9ybSBhIGJsb2NrIGludG8gYSBzdG9yZWQgYmxvY2suXG4gICAgICovXG4gICAgX3RyX3N0b3JlZF9ibG9jayQxKHMsIGJ1Ziwgc3RvcmVkX2xlbiwgbGFzdCk7XG5cbiAgfSBlbHNlIGlmIChzLnN0cmF0ZWd5ID09PSBaX0ZJWEVEJDEgfHwgc3RhdGljX2xlbmIgPT09IG9wdF9sZW5iKSB7XG5cbiAgICBzZW5kX2JpdHMocywgKFNUQVRJQ19UUkVFUyA8PCAxKSArIChsYXN0ID8gMSA6IDApLCAzKTtcbiAgICBjb21wcmVzc19ibG9jayhzLCBzdGF0aWNfbHRyZWUsIHN0YXRpY19kdHJlZSk7XG5cbiAgfSBlbHNlIHtcbiAgICBzZW5kX2JpdHMocywgKERZTl9UUkVFUyA8PCAxKSArIChsYXN0ID8gMSA6IDApLCAzKTtcbiAgICBzZW5kX2FsbF90cmVlcyhzLCBzLmxfZGVzYy5tYXhfY29kZSArIDEsIHMuZF9kZXNjLm1heF9jb2RlICsgMSwgbWF4X2JsaW5kZXggKyAxKTtcbiAgICBjb21wcmVzc19ibG9jayhzLCBzLmR5bl9sdHJlZSwgcy5keW5fZHRyZWUpO1xuICB9XG4gIC8vIEFzc2VydCAocy0+Y29tcHJlc3NlZF9sZW4gPT0gcy0+Yml0c19zZW50LCBcImJhZCBjb21wcmVzc2VkIHNpemVcIik7XG4gIC8qIFRoZSBhYm92ZSBjaGVjayBpcyBtYWRlIG1vZCAyXjMyLCBmb3IgZmlsZXMgbGFyZ2VyIHRoYW4gNTEyIE1CXG4gICAqIGFuZCB1TG9uZyBpbXBsZW1lbnRlZCBvbiAzMiBiaXRzLlxuICAgKi9cbiAgaW5pdF9ibG9jayhzKTtcblxuICBpZiAobGFzdCkge1xuICAgIGJpX3dpbmR1cChzKTtcbiAgfVxuICAvLyBUcmFjZXYoKHN0ZGVycixcIlxcbmNvbXBybGVuICVsdSglbHUpIFwiLCBzLT5jb21wcmVzc2VkX2xlbj4+MyxcbiAgLy8gICAgICAgcy0+Y29tcHJlc3NlZF9sZW4tNypsYXN0KSk7XG59O1xuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIFNhdmUgdGhlIG1hdGNoIGluZm8gYW5kIHRhbGx5IHRoZSBmcmVxdWVuY3kgY291bnRzLiBSZXR1cm4gdHJ1ZSBpZlxuICogdGhlIGN1cnJlbnQgYmxvY2sgbXVzdCBiZSBmbHVzaGVkLlxuICovXG5jb25zdCBfdHJfdGFsbHkkMSA9IChzLCBkaXN0LCBsYykgPT4ge1xuLy8gICAgZGVmbGF0ZV9zdGF0ZSAqcztcbi8vICAgIHVuc2lnbmVkIGRpc3Q7ICAvKiBkaXN0YW5jZSBvZiBtYXRjaGVkIHN0cmluZyAqL1xuLy8gICAgdW5zaWduZWQgbGM7ICAgIC8qIG1hdGNoIGxlbmd0aC1NSU5fTUFUQ0ggb3IgdW5tYXRjaGVkIGNoYXIgKGlmIGRpc3Q9PTApICovXG5cbiAgcy5wZW5kaW5nX2J1ZltzLnN5bV9idWYgKyBzLnN5bV9uZXh0KytdID0gZGlzdDtcbiAgcy5wZW5kaW5nX2J1ZltzLnN5bV9idWYgKyBzLnN5bV9uZXh0KytdID0gZGlzdCA+PiA4O1xuICBzLnBlbmRpbmdfYnVmW3Muc3ltX2J1ZiArIHMuc3ltX25leHQrK10gPSBsYztcbiAgaWYgKGRpc3QgPT09IDApIHtcbiAgICAvKiBsYyBpcyB0aGUgdW5tYXRjaGVkIGNoYXIgKi9cbiAgICBzLmR5bl9sdHJlZVtsYyAqIDJdLyouRnJlcSovKys7XG4gIH0gZWxzZSB7XG4gICAgcy5tYXRjaGVzKys7XG4gICAgLyogSGVyZSwgbGMgaXMgdGhlIG1hdGNoIGxlbmd0aCAtIE1JTl9NQVRDSCAqL1xuICAgIGRpc3QtLTsgICAgICAgICAgICAgLyogZGlzdCA9IG1hdGNoIGRpc3RhbmNlIC0gMSAqL1xuICAgIC8vQXNzZXJ0KCh1c2gpZGlzdCA8ICh1c2gpTUFYX0RJU1QocykgJiZcbiAgICAvLyAgICAgICAodXNoKWxjIDw9ICh1c2gpKE1BWF9NQVRDSC1NSU5fTUFUQ0gpICYmXG4gICAgLy8gICAgICAgKHVzaClkX2NvZGUoZGlzdCkgPCAodXNoKURfQ09ERVMsICBcIl90cl90YWxseTogYmFkIG1hdGNoXCIpO1xuXG4gICAgcy5keW5fbHRyZWVbKF9sZW5ndGhfY29kZVtsY10gKyBMSVRFUkFMUyQxICsgMSkgKiAyXS8qLkZyZXEqLysrO1xuICAgIHMuZHluX2R0cmVlW2RfY29kZShkaXN0KSAqIDJdLyouRnJlcSovKys7XG4gIH1cblxuICByZXR1cm4gKHMuc3ltX25leHQgPT09IHMuc3ltX2VuZCk7XG59O1xuXG52YXIgX3RyX2luaXRfMSAgPSBfdHJfaW5pdCQxO1xudmFyIF90cl9zdG9yZWRfYmxvY2tfMSA9IF90cl9zdG9yZWRfYmxvY2skMTtcbnZhciBfdHJfZmx1c2hfYmxvY2tfMSAgPSBfdHJfZmx1c2hfYmxvY2skMTtcbnZhciBfdHJfdGFsbHlfMSA9IF90cl90YWxseSQxO1xudmFyIF90cl9hbGlnbl8xID0gX3RyX2FsaWduJDE7XG5cbnZhciB0cmVlcyA9IHtcblx0X3RyX2luaXQ6IF90cl9pbml0XzEsXG5cdF90cl9zdG9yZWRfYmxvY2s6IF90cl9zdG9yZWRfYmxvY2tfMSxcblx0X3RyX2ZsdXNoX2Jsb2NrOiBfdHJfZmx1c2hfYmxvY2tfMSxcblx0X3RyX3RhbGx5OiBfdHJfdGFsbHlfMSxcblx0X3RyX2FsaWduOiBfdHJfYWxpZ25fMVxufTtcblxuLy8gTm90ZTogYWRsZXIzMiB0YWtlcyAxMiUgZm9yIGxldmVsIDAgYW5kIDIlIGZvciBsZXZlbCA2LlxuLy8gSXQgaXNuJ3Qgd29ydGggaXQgdG8gbWFrZSBhZGRpdGlvbmFsIG9wdGltaXphdGlvbnMgYXMgaW4gb3JpZ2luYWwuXG4vLyBTbWFsbCBzaXplIGlzIHByZWZlcmFibGUuXG5cbi8vIChDKSAxOTk1LTIwMTMgSmVhbi1sb3VwIEdhaWxseSBhbmQgTWFyayBBZGxlclxuLy8gKEMpIDIwMTQtMjAxNyBWaXRhbHkgUHV6cmluIGFuZCBBbmRyZXkgVHVwaXRzaW5cbi8vXG4vLyBUaGlzIHNvZnR3YXJlIGlzIHByb3ZpZGVkICdhcy1pcycsIHdpdGhvdXQgYW55IGV4cHJlc3Mgb3IgaW1wbGllZFxuLy8gd2FycmFudHkuIEluIG5vIGV2ZW50IHdpbGwgdGhlIGF1dGhvcnMgYmUgaGVsZCBsaWFibGUgZm9yIGFueSBkYW1hZ2VzXG4vLyBhcmlzaW5nIGZyb20gdGhlIHVzZSBvZiB0aGlzIHNvZnR3YXJlLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgZ3JhbnRlZCB0byBhbnlvbmUgdG8gdXNlIHRoaXMgc29mdHdhcmUgZm9yIGFueSBwdXJwb3NlLFxuLy8gaW5jbHVkaW5nIGNvbW1lcmNpYWwgYXBwbGljYXRpb25zLCBhbmQgdG8gYWx0ZXIgaXQgYW5kIHJlZGlzdHJpYnV0ZSBpdFxuLy8gZnJlZWx5LCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgcmVzdHJpY3Rpb25zOlxuLy9cbi8vIDEuIFRoZSBvcmlnaW4gb2YgdGhpcyBzb2Z0d2FyZSBtdXN0IG5vdCBiZSBtaXNyZXByZXNlbnRlZDsgeW91IG11c3Qgbm90XG4vLyAgIGNsYWltIHRoYXQgeW91IHdyb3RlIHRoZSBvcmlnaW5hbCBzb2Z0d2FyZS4gSWYgeW91IHVzZSB0aGlzIHNvZnR3YXJlXG4vLyAgIGluIGEgcHJvZHVjdCwgYW4gYWNrbm93bGVkZ21lbnQgaW4gdGhlIHByb2R1Y3QgZG9jdW1lbnRhdGlvbiB3b3VsZCBiZVxuLy8gICBhcHByZWNpYXRlZCBidXQgaXMgbm90IHJlcXVpcmVkLlxuLy8gMi4gQWx0ZXJlZCBzb3VyY2UgdmVyc2lvbnMgbXVzdCBiZSBwbGFpbmx5IG1hcmtlZCBhcyBzdWNoLCBhbmQgbXVzdCBub3QgYmVcbi8vICAgbWlzcmVwcmVzZW50ZWQgYXMgYmVpbmcgdGhlIG9yaWdpbmFsIHNvZnR3YXJlLlxuLy8gMy4gVGhpcyBub3RpY2UgbWF5IG5vdCBiZSByZW1vdmVkIG9yIGFsdGVyZWQgZnJvbSBhbnkgc291cmNlIGRpc3RyaWJ1dGlvbi5cblxuY29uc3QgYWRsZXIzMiA9IChhZGxlciwgYnVmLCBsZW4sIHBvcykgPT4ge1xuICBsZXQgczEgPSAoYWRsZXIgJiAweGZmZmYpIHwwLFxuICAgICAgczIgPSAoKGFkbGVyID4+PiAxNikgJiAweGZmZmYpIHwwLFxuICAgICAgbiA9IDA7XG5cbiAgd2hpbGUgKGxlbiAhPT0gMCkge1xuICAgIC8vIFNldCBsaW1pdCB+IHR3aWNlIGxlc3MgdGhhbiA1NTUyLCB0byBrZWVwXG4gICAgLy8gczIgaW4gMzEtYml0cywgYmVjYXVzZSB3ZSBmb3JjZSBzaWduZWQgaW50cy5cbiAgICAvLyBpbiBvdGhlciBjYXNlICU9IHdpbGwgZmFpbC5cbiAgICBuID0gbGVuID4gMjAwMCA/IDIwMDAgOiBsZW47XG4gICAgbGVuIC09IG47XG5cbiAgICBkbyB7XG4gICAgICBzMSA9IChzMSArIGJ1Zltwb3MrK10pIHwwO1xuICAgICAgczIgPSAoczIgKyBzMSkgfDA7XG4gICAgfSB3aGlsZSAoLS1uKTtcblxuICAgIHMxICU9IDY1NTIxO1xuICAgIHMyICU9IDY1NTIxO1xuICB9XG5cbiAgcmV0dXJuIChzMSB8IChzMiA8PCAxNikpIHwwO1xufTtcblxuXG52YXIgYWRsZXIzMl8xID0gYWRsZXIzMjtcblxuLy8gTm90ZTogd2UgY2FuJ3QgZ2V0IHNpZ25pZmljYW50IHNwZWVkIGJvb3N0IGhlcmUuXG4vLyBTbyB3cml0ZSBjb2RlIHRvIG1pbmltaXplIHNpemUgLSBubyBwcmVnZW5lcmF0ZWQgdGFibGVzXG4vLyBhbmQgYXJyYXkgdG9vbHMgZGVwZW5kZW5jaWVzLlxuXG4vLyAoQykgMTk5NS0yMDEzIEplYW4tbG91cCBHYWlsbHkgYW5kIE1hcmsgQWRsZXJcbi8vIChDKSAyMDE0LTIwMTcgVml0YWx5IFB1enJpbiBhbmQgQW5kcmV5IFR1cGl0c2luXG4vL1xuLy8gVGhpcyBzb2Z0d2FyZSBpcyBwcm92aWRlZCAnYXMtaXMnLCB3aXRob3V0IGFueSBleHByZXNzIG9yIGltcGxpZWRcbi8vIHdhcnJhbnR5LiBJbiBubyBldmVudCB3aWxsIHRoZSBhdXRob3JzIGJlIGhlbGQgbGlhYmxlIGZvciBhbnkgZGFtYWdlc1xuLy8gYXJpc2luZyBmcm9tIHRoZSB1c2Ugb2YgdGhpcyBzb2Z0d2FyZS5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGdyYW50ZWQgdG8gYW55b25lIHRvIHVzZSB0aGlzIHNvZnR3YXJlIGZvciBhbnkgcHVycG9zZSxcbi8vIGluY2x1ZGluZyBjb21tZXJjaWFsIGFwcGxpY2F0aW9ucywgYW5kIHRvIGFsdGVyIGl0IGFuZCByZWRpc3RyaWJ1dGUgaXRcbi8vIGZyZWVseSwgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nIHJlc3RyaWN0aW9uczpcbi8vXG4vLyAxLiBUaGUgb3JpZ2luIG9mIHRoaXMgc29mdHdhcmUgbXVzdCBub3QgYmUgbWlzcmVwcmVzZW50ZWQ7IHlvdSBtdXN0IG5vdFxuLy8gICBjbGFpbSB0aGF0IHlvdSB3cm90ZSB0aGUgb3JpZ2luYWwgc29mdHdhcmUuIElmIHlvdSB1c2UgdGhpcyBzb2Z0d2FyZVxuLy8gICBpbiBhIHByb2R1Y3QsIGFuIGFja25vd2xlZGdtZW50IGluIHRoZSBwcm9kdWN0IGRvY3VtZW50YXRpb24gd291bGQgYmVcbi8vICAgYXBwcmVjaWF0ZWQgYnV0IGlzIG5vdCByZXF1aXJlZC5cbi8vIDIuIEFsdGVyZWQgc291cmNlIHZlcnNpb25zIG11c3QgYmUgcGxhaW5seSBtYXJrZWQgYXMgc3VjaCwgYW5kIG11c3Qgbm90IGJlXG4vLyAgIG1pc3JlcHJlc2VudGVkIGFzIGJlaW5nIHRoZSBvcmlnaW5hbCBzb2Z0d2FyZS5cbi8vIDMuIFRoaXMgbm90aWNlIG1heSBub3QgYmUgcmVtb3ZlZCBvciBhbHRlcmVkIGZyb20gYW55IHNvdXJjZSBkaXN0cmlidXRpb24uXG5cbi8vIFVzZSBvcmRpbmFyeSBhcnJheSwgc2luY2UgdW50eXBlZCBtYWtlcyBubyBib29zdCBoZXJlXG5jb25zdCBtYWtlVGFibGUgPSAoKSA9PiB7XG4gIGxldCBjLCB0YWJsZSA9IFtdO1xuXG4gIGZvciAodmFyIG4gPSAwOyBuIDwgMjU2OyBuKyspIHtcbiAgICBjID0gbjtcbiAgICBmb3IgKHZhciBrID0gMDsgayA8IDg7IGsrKykge1xuICAgICAgYyA9ICgoYyAmIDEpID8gKDB4RURCODgzMjAgXiAoYyA+Pj4gMSkpIDogKGMgPj4+IDEpKTtcbiAgICB9XG4gICAgdGFibGVbbl0gPSBjO1xuICB9XG5cbiAgcmV0dXJuIHRhYmxlO1xufTtcblxuLy8gQ3JlYXRlIHRhYmxlIG9uIGxvYWQuIEp1c3QgMjU1IHNpZ25lZCBsb25ncy4gTm90IGEgcHJvYmxlbS5cbmNvbnN0IGNyY1RhYmxlID0gbmV3IFVpbnQzMkFycmF5KG1ha2VUYWJsZSgpKTtcblxuXG5jb25zdCBjcmMzMiA9IChjcmMsIGJ1ZiwgbGVuLCBwb3MpID0+IHtcbiAgY29uc3QgdCA9IGNyY1RhYmxlO1xuICBjb25zdCBlbmQgPSBwb3MgKyBsZW47XG5cbiAgY3JjIF49IC0xO1xuXG4gIGZvciAobGV0IGkgPSBwb3M7IGkgPCBlbmQ7IGkrKykge1xuICAgIGNyYyA9IChjcmMgPj4+IDgpIF4gdFsoY3JjIF4gYnVmW2ldKSAmIDB4RkZdO1xuICB9XG5cbiAgcmV0dXJuIChjcmMgXiAoLTEpKTsgLy8gPj4+IDA7XG59O1xuXG5cbnZhciBjcmMzMl8xID0gY3JjMzI7XG5cbi8vIChDKSAxOTk1LTIwMTMgSmVhbi1sb3VwIEdhaWxseSBhbmQgTWFyayBBZGxlclxuLy8gKEMpIDIwMTQtMjAxNyBWaXRhbHkgUHV6cmluIGFuZCBBbmRyZXkgVHVwaXRzaW5cbi8vXG4vLyBUaGlzIHNvZnR3YXJlIGlzIHByb3ZpZGVkICdhcy1pcycsIHdpdGhvdXQgYW55IGV4cHJlc3Mgb3IgaW1wbGllZFxuLy8gd2FycmFudHkuIEluIG5vIGV2ZW50IHdpbGwgdGhlIGF1dGhvcnMgYmUgaGVsZCBsaWFibGUgZm9yIGFueSBkYW1hZ2VzXG4vLyBhcmlzaW5nIGZyb20gdGhlIHVzZSBvZiB0aGlzIHNvZnR3YXJlLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgZ3JhbnRlZCB0byBhbnlvbmUgdG8gdXNlIHRoaXMgc29mdHdhcmUgZm9yIGFueSBwdXJwb3NlLFxuLy8gaW5jbHVkaW5nIGNvbW1lcmNpYWwgYXBwbGljYXRpb25zLCBhbmQgdG8gYWx0ZXIgaXQgYW5kIHJlZGlzdHJpYnV0ZSBpdFxuLy8gZnJlZWx5LCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgcmVzdHJpY3Rpb25zOlxuLy9cbi8vIDEuIFRoZSBvcmlnaW4gb2YgdGhpcyBzb2Z0d2FyZSBtdXN0IG5vdCBiZSBtaXNyZXByZXNlbnRlZDsgeW91IG11c3Qgbm90XG4vLyAgIGNsYWltIHRoYXQgeW91IHdyb3RlIHRoZSBvcmlnaW5hbCBzb2Z0d2FyZS4gSWYgeW91IHVzZSB0aGlzIHNvZnR3YXJlXG4vLyAgIGluIGEgcHJvZHVjdCwgYW4gYWNrbm93bGVkZ21lbnQgaW4gdGhlIHByb2R1Y3QgZG9jdW1lbnRhdGlvbiB3b3VsZCBiZVxuLy8gICBhcHByZWNpYXRlZCBidXQgaXMgbm90IHJlcXVpcmVkLlxuLy8gMi4gQWx0ZXJlZCBzb3VyY2UgdmVyc2lvbnMgbXVzdCBiZSBwbGFpbmx5IG1hcmtlZCBhcyBzdWNoLCBhbmQgbXVzdCBub3QgYmVcbi8vICAgbWlzcmVwcmVzZW50ZWQgYXMgYmVpbmcgdGhlIG9yaWdpbmFsIHNvZnR3YXJlLlxuLy8gMy4gVGhpcyBub3RpY2UgbWF5IG5vdCBiZSByZW1vdmVkIG9yIGFsdGVyZWQgZnJvbSBhbnkgc291cmNlIGRpc3RyaWJ1dGlvbi5cblxudmFyIG1lc3NhZ2VzID0ge1xuICAyOiAgICAgICduZWVkIGRpY3Rpb25hcnknLCAgICAgLyogWl9ORUVEX0RJQ1QgICAgICAgMiAgKi9cbiAgMTogICAgICAnc3RyZWFtIGVuZCcsICAgICAgICAgIC8qIFpfU1RSRUFNX0VORCAgICAgIDEgICovXG4gIDA6ICAgICAgJycsICAgICAgICAgICAgICAgICAgICAvKiBaX09LICAgICAgICAgICAgICAwICAqL1xuICAnLTEnOiAgICdmaWxlIGVycm9yJywgICAgICAgICAgLyogWl9FUlJOTyAgICAgICAgICgtMSkgKi9cbiAgJy0yJzogICAnc3RyZWFtIGVycm9yJywgICAgICAgIC8qIFpfU1RSRUFNX0VSUk9SICAoLTIpICovXG4gICctMyc6ICAgJ2RhdGEgZXJyb3InLCAgICAgICAgICAvKiBaX0RBVEFfRVJST1IgICAgKC0zKSAqL1xuICAnLTQnOiAgICdpbnN1ZmZpY2llbnQgbWVtb3J5JywgLyogWl9NRU1fRVJST1IgICAgICgtNCkgKi9cbiAgJy01JzogICAnYnVmZmVyIGVycm9yJywgICAgICAgIC8qIFpfQlVGX0VSUk9SICAgICAoLTUpICovXG4gICctNic6ICAgJ2luY29tcGF0aWJsZSB2ZXJzaW9uJyAvKiBaX1ZFUlNJT05fRVJST1IgKC02KSAqL1xufTtcblxuLy8gKEMpIDE5OTUtMjAxMyBKZWFuLWxvdXAgR2FpbGx5IGFuZCBNYXJrIEFkbGVyXG4vLyAoQykgMjAxNC0yMDE3IFZpdGFseSBQdXpyaW4gYW5kIEFuZHJleSBUdXBpdHNpblxuLy9cbi8vIFRoaXMgc29mdHdhcmUgaXMgcHJvdmlkZWQgJ2FzLWlzJywgd2l0aG91dCBhbnkgZXhwcmVzcyBvciBpbXBsaWVkXG4vLyB3YXJyYW50eS4gSW4gbm8gZXZlbnQgd2lsbCB0aGUgYXV0aG9ycyBiZSBoZWxkIGxpYWJsZSBmb3IgYW55IGRhbWFnZXNcbi8vIGFyaXNpbmcgZnJvbSB0aGUgdXNlIG9mIHRoaXMgc29mdHdhcmUuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBncmFudGVkIHRvIGFueW9uZSB0byB1c2UgdGhpcyBzb2Z0d2FyZSBmb3IgYW55IHB1cnBvc2UsXG4vLyBpbmNsdWRpbmcgY29tbWVyY2lhbCBhcHBsaWNhdGlvbnMsIGFuZCB0byBhbHRlciBpdCBhbmQgcmVkaXN0cmlidXRlIGl0XG4vLyBmcmVlbHksIHN1YmplY3QgdG8gdGhlIGZvbGxvd2luZyByZXN0cmljdGlvbnM6XG4vL1xuLy8gMS4gVGhlIG9yaWdpbiBvZiB0aGlzIHNvZnR3YXJlIG11c3Qgbm90IGJlIG1pc3JlcHJlc2VudGVkOyB5b3UgbXVzdCBub3Rcbi8vICAgY2xhaW0gdGhhdCB5b3Ugd3JvdGUgdGhlIG9yaWdpbmFsIHNvZnR3YXJlLiBJZiB5b3UgdXNlIHRoaXMgc29mdHdhcmVcbi8vICAgaW4gYSBwcm9kdWN0LCBhbiBhY2tub3dsZWRnbWVudCBpbiB0aGUgcHJvZHVjdCBkb2N1bWVudGF0aW9uIHdvdWxkIGJlXG4vLyAgIGFwcHJlY2lhdGVkIGJ1dCBpcyBub3QgcmVxdWlyZWQuXG4vLyAyLiBBbHRlcmVkIHNvdXJjZSB2ZXJzaW9ucyBtdXN0IGJlIHBsYWlubHkgbWFya2VkIGFzIHN1Y2gsIGFuZCBtdXN0IG5vdCBiZVxuLy8gICBtaXNyZXByZXNlbnRlZCBhcyBiZWluZyB0aGUgb3JpZ2luYWwgc29mdHdhcmUuXG4vLyAzLiBUaGlzIG5vdGljZSBtYXkgbm90IGJlIHJlbW92ZWQgb3IgYWx0ZXJlZCBmcm9tIGFueSBzb3VyY2UgZGlzdHJpYnV0aW9uLlxuXG52YXIgY29uc3RhbnRzJDIgPSB7XG5cbiAgLyogQWxsb3dlZCBmbHVzaCB2YWx1ZXM7IHNlZSBkZWZsYXRlKCkgYW5kIGluZmxhdGUoKSBiZWxvdyBmb3IgZGV0YWlscyAqL1xuICBaX05PX0ZMVVNIOiAgICAgICAgIDAsXG4gIFpfUEFSVElBTF9GTFVTSDogICAgMSxcbiAgWl9TWU5DX0ZMVVNIOiAgICAgICAyLFxuICBaX0ZVTExfRkxVU0g6ICAgICAgIDMsXG4gIFpfRklOSVNIOiAgICAgICAgICAgNCxcbiAgWl9CTE9DSzogICAgICAgICAgICA1LFxuICBaX1RSRUVTOiAgICAgICAgICAgIDYsXG5cbiAgLyogUmV0dXJuIGNvZGVzIGZvciB0aGUgY29tcHJlc3Npb24vZGVjb21wcmVzc2lvbiBmdW5jdGlvbnMuIE5lZ2F0aXZlIHZhbHVlc1xuICAqIGFyZSBlcnJvcnMsIHBvc2l0aXZlIHZhbHVlcyBhcmUgdXNlZCBmb3Igc3BlY2lhbCBidXQgbm9ybWFsIGV2ZW50cy5cbiAgKi9cbiAgWl9PSzogICAgICAgICAgICAgICAwLFxuICBaX1NUUkVBTV9FTkQ6ICAgICAgIDEsXG4gIFpfTkVFRF9ESUNUOiAgICAgICAgMixcbiAgWl9FUlJOTzogICAgICAgICAgIC0xLFxuICBaX1NUUkVBTV9FUlJPUjogICAgLTIsXG4gIFpfREFUQV9FUlJPUjogICAgICAtMyxcbiAgWl9NRU1fRVJST1I6ICAgICAgIC00LFxuICBaX0JVRl9FUlJPUjogICAgICAgLTUsXG4gIC8vWl9WRVJTSU9OX0VSUk9SOiAtNixcblxuICAvKiBjb21wcmVzc2lvbiBsZXZlbHMgKi9cbiAgWl9OT19DT01QUkVTU0lPTjogICAgICAgICAwLFxuICBaX0JFU1RfU1BFRUQ6ICAgICAgICAgICAgIDEsXG4gIFpfQkVTVF9DT01QUkVTU0lPTjogICAgICAgOSxcbiAgWl9ERUZBVUxUX0NPTVBSRVNTSU9OOiAgIC0xLFxuXG5cbiAgWl9GSUxURVJFRDogICAgICAgICAgICAgICAxLFxuICBaX0hVRkZNQU5fT05MWTogICAgICAgICAgIDIsXG4gIFpfUkxFOiAgICAgICAgICAgICAgICAgICAgMyxcbiAgWl9GSVhFRDogICAgICAgICAgICAgICAgICA0LFxuICBaX0RFRkFVTFRfU1RSQVRFR1k6ICAgICAgIDAsXG5cbiAgLyogUG9zc2libGUgdmFsdWVzIG9mIHRoZSBkYXRhX3R5cGUgZmllbGQgKHRob3VnaCBzZWUgaW5mbGF0ZSgpKSAqL1xuICBaX0JJTkFSWTogICAgICAgICAgICAgICAgIDAsXG4gIFpfVEVYVDogICAgICAgICAgICAgICAgICAgMSxcbiAgLy9aX0FTQ0lJOiAgICAgICAgICAgICAgICAxLCAvLyA9IFpfVEVYVCAoZGVwcmVjYXRlZClcbiAgWl9VTktOT1dOOiAgICAgICAgICAgICAgICAyLFxuXG4gIC8qIFRoZSBkZWZsYXRlIGNvbXByZXNzaW9uIG1ldGhvZCAqL1xuICBaX0RFRkxBVEVEOiAgICAgICAgICAgICAgIDhcbiAgLy9aX05VTEw6ICAgICAgICAgICAgICAgICBudWxsIC8vIFVzZSAtMSBvciBudWxsIGlubGluZSwgZGVwZW5kaW5nIG9uIHZhciB0eXBlXG59O1xuXG4vLyAoQykgMTk5NS0yMDEzIEplYW4tbG91cCBHYWlsbHkgYW5kIE1hcmsgQWRsZXJcbi8vIChDKSAyMDE0LTIwMTcgVml0YWx5IFB1enJpbiBhbmQgQW5kcmV5IFR1cGl0c2luXG4vL1xuLy8gVGhpcyBzb2Z0d2FyZSBpcyBwcm92aWRlZCAnYXMtaXMnLCB3aXRob3V0IGFueSBleHByZXNzIG9yIGltcGxpZWRcbi8vIHdhcnJhbnR5LiBJbiBubyBldmVudCB3aWxsIHRoZSBhdXRob3JzIGJlIGhlbGQgbGlhYmxlIGZvciBhbnkgZGFtYWdlc1xuLy8gYXJpc2luZyBmcm9tIHRoZSB1c2Ugb2YgdGhpcyBzb2Z0d2FyZS5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGdyYW50ZWQgdG8gYW55b25lIHRvIHVzZSB0aGlzIHNvZnR3YXJlIGZvciBhbnkgcHVycG9zZSxcbi8vIGluY2x1ZGluZyBjb21tZXJjaWFsIGFwcGxpY2F0aW9ucywgYW5kIHRvIGFsdGVyIGl0IGFuZCByZWRpc3RyaWJ1dGUgaXRcbi8vIGZyZWVseSwgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nIHJlc3RyaWN0aW9uczpcbi8vXG4vLyAxLiBUaGUgb3JpZ2luIG9mIHRoaXMgc29mdHdhcmUgbXVzdCBub3QgYmUgbWlzcmVwcmVzZW50ZWQ7IHlvdSBtdXN0IG5vdFxuLy8gICBjbGFpbSB0aGF0IHlvdSB3cm90ZSB0aGUgb3JpZ2luYWwgc29mdHdhcmUuIElmIHlvdSB1c2UgdGhpcyBzb2Z0d2FyZVxuLy8gICBpbiBhIHByb2R1Y3QsIGFuIGFja25vd2xlZGdtZW50IGluIHRoZSBwcm9kdWN0IGRvY3VtZW50YXRpb24gd291bGQgYmVcbi8vICAgYXBwcmVjaWF0ZWQgYnV0IGlzIG5vdCByZXF1aXJlZC5cbi8vIDIuIEFsdGVyZWQgc291cmNlIHZlcnNpb25zIG11c3QgYmUgcGxhaW5seSBtYXJrZWQgYXMgc3VjaCwgYW5kIG11c3Qgbm90IGJlXG4vLyAgIG1pc3JlcHJlc2VudGVkIGFzIGJlaW5nIHRoZSBvcmlnaW5hbCBzb2Z0d2FyZS5cbi8vIDMuIFRoaXMgbm90aWNlIG1heSBub3QgYmUgcmVtb3ZlZCBvciBhbHRlcmVkIGZyb20gYW55IHNvdXJjZSBkaXN0cmlidXRpb24uXG5cbmNvbnN0IHsgX3RyX2luaXQsIF90cl9zdG9yZWRfYmxvY2ssIF90cl9mbHVzaF9ibG9jaywgX3RyX3RhbGx5LCBfdHJfYWxpZ24gfSA9IHRyZWVzO1xuXG5cblxuXG4vKiBQdWJsaWMgY29uc3RhbnRzID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0qL1xuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Ki9cblxuY29uc3Qge1xuICBaX05PX0ZMVVNIOiBaX05PX0ZMVVNIJDIsIFpfUEFSVElBTF9GTFVTSCwgWl9GVUxMX0ZMVVNIOiBaX0ZVTExfRkxVU0gkMSwgWl9GSU5JU0g6IFpfRklOSVNIJDMsIFpfQkxPQ0s6IFpfQkxPQ0skMSxcbiAgWl9PSzogWl9PSyQzLCBaX1NUUkVBTV9FTkQ6IFpfU1RSRUFNX0VORCQzLCBaX1NUUkVBTV9FUlJPUjogWl9TVFJFQU1fRVJST1IkMiwgWl9EQVRBX0VSUk9SOiBaX0RBVEFfRVJST1IkMiwgWl9CVUZfRVJST1I6IFpfQlVGX0VSUk9SJDEsXG4gIFpfREVGQVVMVF9DT01QUkVTU0lPTjogWl9ERUZBVUxUX0NPTVBSRVNTSU9OJDEsXG4gIFpfRklMVEVSRUQsIFpfSFVGRk1BTl9PTkxZLCBaX1JMRSwgWl9GSVhFRCwgWl9ERUZBVUxUX1NUUkFURUdZOiBaX0RFRkFVTFRfU1RSQVRFR1kkMSxcbiAgWl9VTktOT1dOLFxuICBaX0RFRkxBVEVEOiBaX0RFRkxBVEVEJDJcbn0gPSBjb25zdGFudHMkMjtcblxuLyo9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Ki9cblxuXG5jb25zdCBNQVhfTUVNX0xFVkVMID0gOTtcbi8qIE1heGltdW0gdmFsdWUgZm9yIG1lbUxldmVsIGluIGRlZmxhdGVJbml0MiAqL1xuY29uc3QgTUFYX1dCSVRTJDEgPSAxNTtcbi8qIDMySyBMWjc3IHdpbmRvdyAqL1xuY29uc3QgREVGX01FTV9MRVZFTCA9IDg7XG5cblxuY29uc3QgTEVOR1RIX0NPREVTICA9IDI5O1xuLyogbnVtYmVyIG9mIGxlbmd0aCBjb2Rlcywgbm90IGNvdW50aW5nIHRoZSBzcGVjaWFsIEVORF9CTE9DSyBjb2RlICovXG5jb25zdCBMSVRFUkFMUyAgICAgID0gMjU2O1xuLyogbnVtYmVyIG9mIGxpdGVyYWwgYnl0ZXMgMC4uMjU1ICovXG5jb25zdCBMX0NPREVTICAgICAgID0gTElURVJBTFMgKyAxICsgTEVOR1RIX0NPREVTO1xuLyogbnVtYmVyIG9mIExpdGVyYWwgb3IgTGVuZ3RoIGNvZGVzLCBpbmNsdWRpbmcgdGhlIEVORF9CTE9DSyBjb2RlICovXG5jb25zdCBEX0NPREVTICAgICAgID0gMzA7XG4vKiBudW1iZXIgb2YgZGlzdGFuY2UgY29kZXMgKi9cbmNvbnN0IEJMX0NPREVTICAgICAgPSAxOTtcbi8qIG51bWJlciBvZiBjb2RlcyB1c2VkIHRvIHRyYW5zZmVyIHRoZSBiaXQgbGVuZ3RocyAqL1xuY29uc3QgSEVBUF9TSVpFICAgICA9IDIgKiBMX0NPREVTICsgMTtcbi8qIG1heGltdW0gaGVhcCBzaXplICovXG5jb25zdCBNQVhfQklUUyAgPSAxNTtcbi8qIEFsbCBjb2RlcyBtdXN0IG5vdCBleGNlZWQgTUFYX0JJVFMgYml0cyAqL1xuXG5jb25zdCBNSU5fTUFUQ0ggPSAzO1xuY29uc3QgTUFYX01BVENIID0gMjU4O1xuY29uc3QgTUlOX0xPT0tBSEVBRCA9IChNQVhfTUFUQ0ggKyBNSU5fTUFUQ0ggKyAxKTtcblxuY29uc3QgUFJFU0VUX0RJQ1QgPSAweDIwO1xuXG5jb25zdCBJTklUX1NUQVRFICAgID0gIDQyOyAgICAvKiB6bGliIGhlYWRlciAtPiBCVVNZX1NUQVRFICovXG4vLyNpZmRlZiBHWklQXG5jb25zdCBHWklQX1NUQVRFICAgID0gIDU3OyAgICAvKiBnemlwIGhlYWRlciAtPiBCVVNZX1NUQVRFIHwgRVhUUkFfU1RBVEUgKi9cbi8vI2VuZGlmXG5jb25zdCBFWFRSQV9TVEFURSAgID0gIDY5OyAgICAvKiBnemlwIGV4dHJhIGJsb2NrIC0+IE5BTUVfU1RBVEUgKi9cbmNvbnN0IE5BTUVfU1RBVEUgICAgPSAgNzM7ICAgIC8qIGd6aXAgZmlsZSBuYW1lIC0+IENPTU1FTlRfU1RBVEUgKi9cbmNvbnN0IENPTU1FTlRfU1RBVEUgPSAgOTE7ICAgIC8qIGd6aXAgY29tbWVudCAtPiBIQ1JDX1NUQVRFICovXG5jb25zdCBIQ1JDX1NUQVRFICAgID0gMTAzOyAgICAvKiBnemlwIGhlYWRlciBDUkMgLT4gQlVTWV9TVEFURSAqL1xuY29uc3QgQlVTWV9TVEFURSAgICA9IDExMzsgICAgLyogZGVmbGF0ZSAtPiBGSU5JU0hfU1RBVEUgKi9cbmNvbnN0IEZJTklTSF9TVEFURSAgPSA2NjY7ICAgIC8qIHN0cmVhbSBjb21wbGV0ZSAqL1xuXG5jb25zdCBCU19ORUVEX01PUkUgICAgICA9IDE7IC8qIGJsb2NrIG5vdCBjb21wbGV0ZWQsIG5lZWQgbW9yZSBpbnB1dCBvciBtb3JlIG91dHB1dCAqL1xuY29uc3QgQlNfQkxPQ0tfRE9ORSAgICAgPSAyOyAvKiBibG9jayBmbHVzaCBwZXJmb3JtZWQgKi9cbmNvbnN0IEJTX0ZJTklTSF9TVEFSVEVEID0gMzsgLyogZmluaXNoIHN0YXJ0ZWQsIG5lZWQgb25seSBtb3JlIG91dHB1dCBhdCBuZXh0IGRlZmxhdGUgKi9cbmNvbnN0IEJTX0ZJTklTSF9ET05FICAgID0gNDsgLyogZmluaXNoIGRvbmUsIGFjY2VwdCBubyBtb3JlIGlucHV0IG9yIG91dHB1dCAqL1xuXG5jb25zdCBPU19DT0RFID0gMHgwMzsgLy8gVW5peCA6KSAuIERvbid0IGRldGVjdCwgdXNlIHRoaXMgZGVmYXVsdC5cblxuY29uc3QgZXJyID0gKHN0cm0sIGVycm9yQ29kZSkgPT4ge1xuICBzdHJtLm1zZyA9IG1lc3NhZ2VzW2Vycm9yQ29kZV07XG4gIHJldHVybiBlcnJvckNvZGU7XG59O1xuXG5jb25zdCByYW5rID0gKGYpID0+IHtcbiAgcmV0dXJuICgoZikgKiAyKSAtICgoZikgPiA0ID8gOSA6IDApO1xufTtcblxuY29uc3QgemVybyA9IChidWYpID0+IHtcbiAgbGV0IGxlbiA9IGJ1Zi5sZW5ndGg7IHdoaWxlICgtLWxlbiA+PSAwKSB7IGJ1ZltsZW5dID0gMDsgfVxufTtcblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBTbGlkZSB0aGUgaGFzaCB0YWJsZSB3aGVuIHNsaWRpbmcgdGhlIHdpbmRvdyBkb3duIChjb3VsZCBiZSBhdm9pZGVkIHdpdGggMzJcbiAqIGJpdCB2YWx1ZXMgYXQgdGhlIGV4cGVuc2Ugb2YgbWVtb3J5IHVzYWdlKS4gV2Ugc2xpZGUgZXZlbiB3aGVuIGxldmVsID09IDAgdG9cbiAqIGtlZXAgdGhlIGhhc2ggdGFibGUgY29uc2lzdGVudCBpZiB3ZSBzd2l0Y2ggYmFjayB0byBsZXZlbCA+IDAgbGF0ZXIuXG4gKi9cbmNvbnN0IHNsaWRlX2hhc2ggPSAocykgPT4ge1xuICBsZXQgbiwgbTtcbiAgbGV0IHA7XG4gIGxldCB3c2l6ZSA9IHMud19zaXplO1xuXG4gIG4gPSBzLmhhc2hfc2l6ZTtcbiAgcCA9IG47XG4gIGRvIHtcbiAgICBtID0gcy5oZWFkWy0tcF07XG4gICAgcy5oZWFkW3BdID0gKG0gPj0gd3NpemUgPyBtIC0gd3NpemUgOiAwKTtcbiAgfSB3aGlsZSAoLS1uKTtcbiAgbiA9IHdzaXplO1xuLy8jaWZuZGVmIEZBU1RFU1RcbiAgcCA9IG47XG4gIGRvIHtcbiAgICBtID0gcy5wcmV2Wy0tcF07XG4gICAgcy5wcmV2W3BdID0gKG0gPj0gd3NpemUgPyBtIC0gd3NpemUgOiAwKTtcbiAgICAvKiBJZiBuIGlzIG5vdCBvbiBhbnkgaGFzaCBjaGFpbiwgcHJldltuXSBpcyBnYXJiYWdlIGJ1dFxuICAgICAqIGl0cyB2YWx1ZSB3aWxsIG5ldmVyIGJlIHVzZWQuXG4gICAgICovXG4gIH0gd2hpbGUgKC0tbik7XG4vLyNlbmRpZlxufTtcblxuLyogZXNsaW50LWRpc2FibGUgbmV3LWNhcCAqL1xubGV0IEhBU0hfWkxJQiA9IChzLCBwcmV2LCBkYXRhKSA9PiAoKHByZXYgPDwgcy5oYXNoX3NoaWZ0KSBeIGRhdGEpICYgcy5oYXNoX21hc2s7XG4vLyBUaGlzIGhhc2ggY2F1c2VzIGxlc3MgY29sbGlzaW9ucywgaHR0cHM6Ly9naXRodWIuY29tL25vZGVjYS9wYWtvL2lzc3Vlcy8xMzVcbi8vIEJ1dCBicmVha3MgYmluYXJ5IGNvbXBhdGliaWxpdHlcbi8vbGV0IEhBU0hfRkFTVCA9IChzLCBwcmV2LCBkYXRhKSA9PiAoKHByZXYgPDwgOCkgKyAocHJldiA+PiA4KSArIChkYXRhIDw8IDQpKSAmIHMuaGFzaF9tYXNrO1xubGV0IEhBU0ggPSBIQVNIX1pMSUI7XG5cblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogRmx1c2ggYXMgbXVjaCBwZW5kaW5nIG91dHB1dCBhcyBwb3NzaWJsZS4gQWxsIGRlZmxhdGUoKSBvdXRwdXQsIGV4Y2VwdCBmb3JcbiAqIHNvbWUgZGVmbGF0ZV9zdG9yZWQoKSBvdXRwdXQsIGdvZXMgdGhyb3VnaCB0aGlzIGZ1bmN0aW9uIHNvIHNvbWVcbiAqIGFwcGxpY2F0aW9ucyBtYXkgd2lzaCB0byBtb2RpZnkgaXQgdG8gYXZvaWQgYWxsb2NhdGluZyBhIGxhcmdlXG4gKiBzdHJtLT5uZXh0X291dCBidWZmZXIgYW5kIGNvcHlpbmcgaW50byBpdC4gKFNlZSBhbHNvIHJlYWRfYnVmKCkpLlxuICovXG5jb25zdCBmbHVzaF9wZW5kaW5nID0gKHN0cm0pID0+IHtcbiAgY29uc3QgcyA9IHN0cm0uc3RhdGU7XG5cbiAgLy9fdHJfZmx1c2hfYml0cyhzKTtcbiAgbGV0IGxlbiA9IHMucGVuZGluZztcbiAgaWYgKGxlbiA+IHN0cm0uYXZhaWxfb3V0KSB7XG4gICAgbGVuID0gc3RybS5hdmFpbF9vdXQ7XG4gIH1cbiAgaWYgKGxlbiA9PT0gMCkgeyByZXR1cm47IH1cblxuICBzdHJtLm91dHB1dC5zZXQocy5wZW5kaW5nX2J1Zi5zdWJhcnJheShzLnBlbmRpbmdfb3V0LCBzLnBlbmRpbmdfb3V0ICsgbGVuKSwgc3RybS5uZXh0X291dCk7XG4gIHN0cm0ubmV4dF9vdXQgICs9IGxlbjtcbiAgcy5wZW5kaW5nX291dCAgKz0gbGVuO1xuICBzdHJtLnRvdGFsX291dCArPSBsZW47XG4gIHN0cm0uYXZhaWxfb3V0IC09IGxlbjtcbiAgcy5wZW5kaW5nICAgICAgLT0gbGVuO1xuICBpZiAocy5wZW5kaW5nID09PSAwKSB7XG4gICAgcy5wZW5kaW5nX291dCA9IDA7XG4gIH1cbn07XG5cblxuY29uc3QgZmx1c2hfYmxvY2tfb25seSA9IChzLCBsYXN0KSA9PiB7XG4gIF90cl9mbHVzaF9ibG9jayhzLCAocy5ibG9ja19zdGFydCA+PSAwID8gcy5ibG9ja19zdGFydCA6IC0xKSwgcy5zdHJzdGFydCAtIHMuYmxvY2tfc3RhcnQsIGxhc3QpO1xuICBzLmJsb2NrX3N0YXJ0ID0gcy5zdHJzdGFydDtcbiAgZmx1c2hfcGVuZGluZyhzLnN0cm0pO1xufTtcblxuXG5jb25zdCBwdXRfYnl0ZSA9IChzLCBiKSA9PiB7XG4gIHMucGVuZGluZ19idWZbcy5wZW5kaW5nKytdID0gYjtcbn07XG5cblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogUHV0IGEgc2hvcnQgaW4gdGhlIHBlbmRpbmcgYnVmZmVyLiBUaGUgMTYtYml0IHZhbHVlIGlzIHB1dCBpbiBNU0Igb3JkZXIuXG4gKiBJTiBhc3NlcnRpb246IHRoZSBzdHJlYW0gc3RhdGUgaXMgY29ycmVjdCBhbmQgdGhlcmUgaXMgZW5vdWdoIHJvb20gaW5cbiAqIHBlbmRpbmdfYnVmLlxuICovXG5jb25zdCBwdXRTaG9ydE1TQiA9IChzLCBiKSA9PiB7XG5cbiAgLy8gIHB1dF9ieXRlKHMsIChCeXRlKShiID4+IDgpKTtcbi8vICBwdXRfYnl0ZShzLCAoQnl0ZSkoYiAmIDB4ZmYpKTtcbiAgcy5wZW5kaW5nX2J1ZltzLnBlbmRpbmcrK10gPSAoYiA+Pj4gOCkgJiAweGZmO1xuICBzLnBlbmRpbmdfYnVmW3MucGVuZGluZysrXSA9IGIgJiAweGZmO1xufTtcblxuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIFJlYWQgYSBuZXcgYnVmZmVyIGZyb20gdGhlIGN1cnJlbnQgaW5wdXQgc3RyZWFtLCB1cGRhdGUgdGhlIGFkbGVyMzJcbiAqIGFuZCB0b3RhbCBudW1iZXIgb2YgYnl0ZXMgcmVhZC4gIEFsbCBkZWZsYXRlKCkgaW5wdXQgZ29lcyB0aHJvdWdoXG4gKiB0aGlzIGZ1bmN0aW9uIHNvIHNvbWUgYXBwbGljYXRpb25zIG1heSB3aXNoIHRvIG1vZGlmeSBpdCB0byBhdm9pZFxuICogYWxsb2NhdGluZyBhIGxhcmdlIHN0cm0tPmlucHV0IGJ1ZmZlciBhbmQgY29weWluZyBmcm9tIGl0LlxuICogKFNlZSBhbHNvIGZsdXNoX3BlbmRpbmcoKSkuXG4gKi9cbmNvbnN0IHJlYWRfYnVmID0gKHN0cm0sIGJ1Ziwgc3RhcnQsIHNpemUpID0+IHtcblxuICBsZXQgbGVuID0gc3RybS5hdmFpbF9pbjtcblxuICBpZiAobGVuID4gc2l6ZSkgeyBsZW4gPSBzaXplOyB9XG4gIGlmIChsZW4gPT09IDApIHsgcmV0dXJuIDA7IH1cblxuICBzdHJtLmF2YWlsX2luIC09IGxlbjtcblxuICAvLyB6bWVtY3B5KGJ1Ziwgc3RybS0+bmV4dF9pbiwgbGVuKTtcbiAgYnVmLnNldChzdHJtLmlucHV0LnN1YmFycmF5KHN0cm0ubmV4dF9pbiwgc3RybS5uZXh0X2luICsgbGVuKSwgc3RhcnQpO1xuICBpZiAoc3RybS5zdGF0ZS53cmFwID09PSAxKSB7XG4gICAgc3RybS5hZGxlciA9IGFkbGVyMzJfMShzdHJtLmFkbGVyLCBidWYsIGxlbiwgc3RhcnQpO1xuICB9XG5cbiAgZWxzZSBpZiAoc3RybS5zdGF0ZS53cmFwID09PSAyKSB7XG4gICAgc3RybS5hZGxlciA9IGNyYzMyXzEoc3RybS5hZGxlciwgYnVmLCBsZW4sIHN0YXJ0KTtcbiAgfVxuXG4gIHN0cm0ubmV4dF9pbiArPSBsZW47XG4gIHN0cm0udG90YWxfaW4gKz0gbGVuO1xuXG4gIHJldHVybiBsZW47XG59O1xuXG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogU2V0IG1hdGNoX3N0YXJ0IHRvIHRoZSBsb25nZXN0IG1hdGNoIHN0YXJ0aW5nIGF0IHRoZSBnaXZlbiBzdHJpbmcgYW5kXG4gKiByZXR1cm4gaXRzIGxlbmd0aC4gTWF0Y2hlcyBzaG9ydGVyIG9yIGVxdWFsIHRvIHByZXZfbGVuZ3RoIGFyZSBkaXNjYXJkZWQsXG4gKiBpbiB3aGljaCBjYXNlIHRoZSByZXN1bHQgaXMgZXF1YWwgdG8gcHJldl9sZW5ndGggYW5kIG1hdGNoX3N0YXJ0IGlzXG4gKiBnYXJiYWdlLlxuICogSU4gYXNzZXJ0aW9uczogY3VyX21hdGNoIGlzIHRoZSBoZWFkIG9mIHRoZSBoYXNoIGNoYWluIGZvciB0aGUgY3VycmVudFxuICogICBzdHJpbmcgKHN0cnN0YXJ0KSBhbmQgaXRzIGRpc3RhbmNlIGlzIDw9IE1BWF9ESVNULCBhbmQgcHJldl9sZW5ndGggPj0gMVxuICogT1VUIGFzc2VydGlvbjogdGhlIG1hdGNoIGxlbmd0aCBpcyBub3QgZ3JlYXRlciB0aGFuIHMtPmxvb2thaGVhZC5cbiAqL1xuY29uc3QgbG9uZ2VzdF9tYXRjaCA9IChzLCBjdXJfbWF0Y2gpID0+IHtcblxuICBsZXQgY2hhaW5fbGVuZ3RoID0gcy5tYXhfY2hhaW5fbGVuZ3RoOyAgICAgIC8qIG1heCBoYXNoIGNoYWluIGxlbmd0aCAqL1xuICBsZXQgc2NhbiA9IHMuc3Ryc3RhcnQ7IC8qIGN1cnJlbnQgc3RyaW5nICovXG4gIGxldCBtYXRjaDsgICAgICAgICAgICAgICAgICAgICAgIC8qIG1hdGNoZWQgc3RyaW5nICovXG4gIGxldCBsZW47ICAgICAgICAgICAgICAgICAgICAgICAgICAgLyogbGVuZ3RoIG9mIGN1cnJlbnQgbWF0Y2ggKi9cbiAgbGV0IGJlc3RfbGVuID0gcy5wcmV2X2xlbmd0aDsgICAgICAgICAgICAgIC8qIGJlc3QgbWF0Y2ggbGVuZ3RoIHNvIGZhciAqL1xuICBsZXQgbmljZV9tYXRjaCA9IHMubmljZV9tYXRjaDsgICAgICAgICAgICAgLyogc3RvcCBpZiBtYXRjaCBsb25nIGVub3VnaCAqL1xuICBjb25zdCBsaW1pdCA9IChzLnN0cnN0YXJ0ID4gKHMud19zaXplIC0gTUlOX0xPT0tBSEVBRCkpID9cbiAgICAgIHMuc3Ryc3RhcnQgLSAocy53X3NpemUgLSBNSU5fTE9PS0FIRUFEKSA6IDAvKk5JTCovO1xuXG4gIGNvbnN0IF93aW4gPSBzLndpbmRvdzsgLy8gc2hvcnRjdXRcblxuICBjb25zdCB3bWFzayA9IHMud19tYXNrO1xuICBjb25zdCBwcmV2ICA9IHMucHJldjtcblxuICAvKiBTdG9wIHdoZW4gY3VyX21hdGNoIGJlY29tZXMgPD0gbGltaXQuIFRvIHNpbXBsaWZ5IHRoZSBjb2RlLFxuICAgKiB3ZSBwcmV2ZW50IG1hdGNoZXMgd2l0aCB0aGUgc3RyaW5nIG9mIHdpbmRvdyBpbmRleCAwLlxuICAgKi9cblxuICBjb25zdCBzdHJlbmQgPSBzLnN0cnN0YXJ0ICsgTUFYX01BVENIO1xuICBsZXQgc2Nhbl9lbmQxICA9IF93aW5bc2NhbiArIGJlc3RfbGVuIC0gMV07XG4gIGxldCBzY2FuX2VuZCAgID0gX3dpbltzY2FuICsgYmVzdF9sZW5dO1xuXG4gIC8qIFRoZSBjb2RlIGlzIG9wdGltaXplZCBmb3IgSEFTSF9CSVRTID49IDggYW5kIE1BWF9NQVRDSC0yIG11bHRpcGxlIG9mIDE2LlxuICAgKiBJdCBpcyBlYXN5IHRvIGdldCByaWQgb2YgdGhpcyBvcHRpbWl6YXRpb24gaWYgbmVjZXNzYXJ5LlxuICAgKi9cbiAgLy8gQXNzZXJ0KHMtPmhhc2hfYml0cyA+PSA4ICYmIE1BWF9NQVRDSCA9PSAyNTgsIFwiQ29kZSB0b28gY2xldmVyXCIpO1xuXG4gIC8qIERvIG5vdCB3YXN0ZSB0b28gbXVjaCB0aW1lIGlmIHdlIGFscmVhZHkgaGF2ZSBhIGdvb2QgbWF0Y2g6ICovXG4gIGlmIChzLnByZXZfbGVuZ3RoID49IHMuZ29vZF9tYXRjaCkge1xuICAgIGNoYWluX2xlbmd0aCA+Pj0gMjtcbiAgfVxuICAvKiBEbyBub3QgbG9vayBmb3IgbWF0Y2hlcyBiZXlvbmQgdGhlIGVuZCBvZiB0aGUgaW5wdXQuIFRoaXMgaXMgbmVjZXNzYXJ5XG4gICAqIHRvIG1ha2UgZGVmbGF0ZSBkZXRlcm1pbmlzdGljLlxuICAgKi9cbiAgaWYgKG5pY2VfbWF0Y2ggPiBzLmxvb2thaGVhZCkgeyBuaWNlX21hdGNoID0gcy5sb29rYWhlYWQ7IH1cblxuICAvLyBBc3NlcnQoKHVsZylzLT5zdHJzdGFydCA8PSBzLT53aW5kb3dfc2l6ZS1NSU5fTE9PS0FIRUFELCBcIm5lZWQgbG9va2FoZWFkXCIpO1xuXG4gIGRvIHtcbiAgICAvLyBBc3NlcnQoY3VyX21hdGNoIDwgcy0+c3Ryc3RhcnQsIFwibm8gZnV0dXJlXCIpO1xuICAgIG1hdGNoID0gY3VyX21hdGNoO1xuXG4gICAgLyogU2tpcCB0byBuZXh0IG1hdGNoIGlmIHRoZSBtYXRjaCBsZW5ndGggY2Fubm90IGluY3JlYXNlXG4gICAgICogb3IgaWYgdGhlIG1hdGNoIGxlbmd0aCBpcyBsZXNzIHRoYW4gMi4gIE5vdGUgdGhhdCB0aGUgY2hlY2tzIGJlbG93XG4gICAgICogZm9yIGluc3VmZmljaWVudCBsb29rYWhlYWQgb25seSBvY2N1ciBvY2Nhc2lvbmFsbHkgZm9yIHBlcmZvcm1hbmNlXG4gICAgICogcmVhc29ucy4gIFRoZXJlZm9yZSB1bmluaXRpYWxpemVkIG1lbW9yeSB3aWxsIGJlIGFjY2Vzc2VkLCBhbmRcbiAgICAgKiBjb25kaXRpb25hbCBqdW1wcyB3aWxsIGJlIG1hZGUgdGhhdCBkZXBlbmQgb24gdGhvc2UgdmFsdWVzLlxuICAgICAqIEhvd2V2ZXIgdGhlIGxlbmd0aCBvZiB0aGUgbWF0Y2ggaXMgbGltaXRlZCB0byB0aGUgbG9va2FoZWFkLCBzb1xuICAgICAqIHRoZSBvdXRwdXQgb2YgZGVmbGF0ZSBpcyBub3QgYWZmZWN0ZWQgYnkgdGhlIHVuaW5pdGlhbGl6ZWQgdmFsdWVzLlxuICAgICAqL1xuXG4gICAgaWYgKF93aW5bbWF0Y2ggKyBiZXN0X2xlbl0gICAgICE9PSBzY2FuX2VuZCAgfHxcbiAgICAgICAgX3dpblttYXRjaCArIGJlc3RfbGVuIC0gMV0gIT09IHNjYW5fZW5kMSB8fFxuICAgICAgICBfd2luW21hdGNoXSAgICAgICAgICAgICAgICAhPT0gX3dpbltzY2FuXSB8fFxuICAgICAgICBfd2luWysrbWF0Y2hdICAgICAgICAgICAgICAhPT0gX3dpbltzY2FuICsgMV0pIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8qIFRoZSBjaGVjayBhdCBiZXN0X2xlbi0xIGNhbiBiZSByZW1vdmVkIGJlY2F1c2UgaXQgd2lsbCBiZSBtYWRlXG4gICAgICogYWdhaW4gbGF0ZXIuIChUaGlzIGhldXJpc3RpYyBpcyBub3QgYWx3YXlzIGEgd2luLilcbiAgICAgKiBJdCBpcyBub3QgbmVjZXNzYXJ5IHRvIGNvbXBhcmUgc2NhblsyXSBhbmQgbWF0Y2hbMl0gc2luY2UgdGhleVxuICAgICAqIGFyZSBhbHdheXMgZXF1YWwgd2hlbiB0aGUgb3RoZXIgYnl0ZXMgbWF0Y2gsIGdpdmVuIHRoYXRcbiAgICAgKiB0aGUgaGFzaCBrZXlzIGFyZSBlcXVhbCBhbmQgdGhhdCBIQVNIX0JJVFMgPj0gOC5cbiAgICAgKi9cbiAgICBzY2FuICs9IDI7XG4gICAgbWF0Y2grKztcbiAgICAvLyBBc3NlcnQoKnNjYW4gPT0gKm1hdGNoLCBcIm1hdGNoWzJdP1wiKTtcblxuICAgIC8qIFdlIGNoZWNrIGZvciBpbnN1ZmZpY2llbnQgbG9va2FoZWFkIG9ubHkgZXZlcnkgOHRoIGNvbXBhcmlzb247XG4gICAgICogdGhlIDI1NnRoIGNoZWNrIHdpbGwgYmUgbWFkZSBhdCBzdHJzdGFydCsyNTguXG4gICAgICovXG4gICAgZG8ge1xuICAgICAgLypqc2hpbnQgbm9lbXB0eTpmYWxzZSovXG4gICAgfSB3aGlsZSAoX3dpblsrK3NjYW5dID09PSBfd2luWysrbWF0Y2hdICYmIF93aW5bKytzY2FuXSA9PT0gX3dpblsrK21hdGNoXSAmJlxuICAgICAgICAgICAgIF93aW5bKytzY2FuXSA9PT0gX3dpblsrK21hdGNoXSAmJiBfd2luWysrc2Nhbl0gPT09IF93aW5bKyttYXRjaF0gJiZcbiAgICAgICAgICAgICBfd2luWysrc2Nhbl0gPT09IF93aW5bKyttYXRjaF0gJiYgX3dpblsrK3NjYW5dID09PSBfd2luWysrbWF0Y2hdICYmXG4gICAgICAgICAgICAgX3dpblsrK3NjYW5dID09PSBfd2luWysrbWF0Y2hdICYmIF93aW5bKytzY2FuXSA9PT0gX3dpblsrK21hdGNoXSAmJlxuICAgICAgICAgICAgIHNjYW4gPCBzdHJlbmQpO1xuXG4gICAgLy8gQXNzZXJ0KHNjYW4gPD0gcy0+d2luZG93Kyh1bnNpZ25lZCkocy0+d2luZG93X3NpemUtMSksIFwid2lsZCBzY2FuXCIpO1xuXG4gICAgbGVuID0gTUFYX01BVENIIC0gKHN0cmVuZCAtIHNjYW4pO1xuICAgIHNjYW4gPSBzdHJlbmQgLSBNQVhfTUFUQ0g7XG5cbiAgICBpZiAobGVuID4gYmVzdF9sZW4pIHtcbiAgICAgIHMubWF0Y2hfc3RhcnQgPSBjdXJfbWF0Y2g7XG4gICAgICBiZXN0X2xlbiA9IGxlbjtcbiAgICAgIGlmIChsZW4gPj0gbmljZV9tYXRjaCkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIHNjYW5fZW5kMSAgPSBfd2luW3NjYW4gKyBiZXN0X2xlbiAtIDFdO1xuICAgICAgc2Nhbl9lbmQgICA9IF93aW5bc2NhbiArIGJlc3RfbGVuXTtcbiAgICB9XG4gIH0gd2hpbGUgKChjdXJfbWF0Y2ggPSBwcmV2W2N1cl9tYXRjaCAmIHdtYXNrXSkgPiBsaW1pdCAmJiAtLWNoYWluX2xlbmd0aCAhPT0gMCk7XG5cbiAgaWYgKGJlc3RfbGVuIDw9IHMubG9va2FoZWFkKSB7XG4gICAgcmV0dXJuIGJlc3RfbGVuO1xuICB9XG4gIHJldHVybiBzLmxvb2thaGVhZDtcbn07XG5cblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBGaWxsIHRoZSB3aW5kb3cgd2hlbiB0aGUgbG9va2FoZWFkIGJlY29tZXMgaW5zdWZmaWNpZW50LlxuICogVXBkYXRlcyBzdHJzdGFydCBhbmQgbG9va2FoZWFkLlxuICpcbiAqIElOIGFzc2VydGlvbjogbG9va2FoZWFkIDwgTUlOX0xPT0tBSEVBRFxuICogT1VUIGFzc2VydGlvbnM6IHN0cnN0YXJ0IDw9IHdpbmRvd19zaXplLU1JTl9MT09LQUhFQURcbiAqICAgIEF0IGxlYXN0IG9uZSBieXRlIGhhcyBiZWVuIHJlYWQsIG9yIGF2YWlsX2luID09IDA7IHJlYWRzIGFyZVxuICogICAgcGVyZm9ybWVkIGZvciBhdCBsZWFzdCB0d28gYnl0ZXMgKHJlcXVpcmVkIGZvciB0aGUgemlwIHRyYW5zbGF0ZV9lb2xcbiAqICAgIG9wdGlvbiAtLSBub3Qgc3VwcG9ydGVkIGhlcmUpLlxuICovXG5jb25zdCBmaWxsX3dpbmRvdyA9IChzKSA9PiB7XG5cbiAgY29uc3QgX3dfc2l6ZSA9IHMud19zaXplO1xuICBsZXQgbiwgbW9yZSwgc3RyO1xuXG4gIC8vQXNzZXJ0KHMtPmxvb2thaGVhZCA8IE1JTl9MT09LQUhFQUQsIFwiYWxyZWFkeSBlbm91Z2ggbG9va2FoZWFkXCIpO1xuXG4gIGRvIHtcbiAgICBtb3JlID0gcy53aW5kb3dfc2l6ZSAtIHMubG9va2FoZWFkIC0gcy5zdHJzdGFydDtcblxuICAgIC8vIEpTIGludHMgaGF2ZSAzMiBiaXQsIGJsb2NrIGJlbG93IG5vdCBuZWVkZWRcbiAgICAvKiBEZWFsIHdpdGggIUAjJCUgNjRLIGxpbWl0OiAqL1xuICAgIC8vaWYgKHNpemVvZihpbnQpIDw9IDIpIHtcbiAgICAvLyAgICBpZiAobW9yZSA9PSAwICYmIHMtPnN0cnN0YXJ0ID09IDAgJiYgcy0+bG9va2FoZWFkID09IDApIHtcbiAgICAvLyAgICAgICAgbW9yZSA9IHdzaXplO1xuICAgIC8vXG4gICAgLy8gIH0gZWxzZSBpZiAobW9yZSA9PSAodW5zaWduZWQpKC0xKSkge1xuICAgIC8vICAgICAgICAvKiBWZXJ5IHVubGlrZWx5LCBidXQgcG9zc2libGUgb24gMTYgYml0IG1hY2hpbmUgaWZcbiAgICAvLyAgICAgICAgICogc3Ryc3RhcnQgPT0gMCAmJiBsb29rYWhlYWQgPT0gMSAoaW5wdXQgZG9uZSBhIGJ5dGUgYXQgdGltZSlcbiAgICAvLyAgICAgICAgICovXG4gICAgLy8gICAgICAgIG1vcmUtLTtcbiAgICAvLyAgICB9XG4gICAgLy99XG5cblxuICAgIC8qIElmIHRoZSB3aW5kb3cgaXMgYWxtb3N0IGZ1bGwgYW5kIHRoZXJlIGlzIGluc3VmZmljaWVudCBsb29rYWhlYWQsXG4gICAgICogbW92ZSB0aGUgdXBwZXIgaGFsZiB0byB0aGUgbG93ZXIgb25lIHRvIG1ha2Ugcm9vbSBpbiB0aGUgdXBwZXIgaGFsZi5cbiAgICAgKi9cbiAgICBpZiAocy5zdHJzdGFydCA+PSBfd19zaXplICsgKF93X3NpemUgLSBNSU5fTE9PS0FIRUFEKSkge1xuXG4gICAgICBzLndpbmRvdy5zZXQocy53aW5kb3cuc3ViYXJyYXkoX3dfc2l6ZSwgX3dfc2l6ZSArIF93X3NpemUgLSBtb3JlKSwgMCk7XG4gICAgICBzLm1hdGNoX3N0YXJ0IC09IF93X3NpemU7XG4gICAgICBzLnN0cnN0YXJ0IC09IF93X3NpemU7XG4gICAgICAvKiB3ZSBub3cgaGF2ZSBzdHJzdGFydCA+PSBNQVhfRElTVCAqL1xuICAgICAgcy5ibG9ja19zdGFydCAtPSBfd19zaXplO1xuICAgICAgaWYgKHMuaW5zZXJ0ID4gcy5zdHJzdGFydCkge1xuICAgICAgICBzLmluc2VydCA9IHMuc3Ryc3RhcnQ7XG4gICAgICB9XG4gICAgICBzbGlkZV9oYXNoKHMpO1xuICAgICAgbW9yZSArPSBfd19zaXplO1xuICAgIH1cbiAgICBpZiAocy5zdHJtLmF2YWlsX2luID09PSAwKSB7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICAvKiBJZiB0aGVyZSB3YXMgbm8gc2xpZGluZzpcbiAgICAgKiAgICBzdHJzdGFydCA8PSBXU0laRStNQVhfRElTVC0xICYmIGxvb2thaGVhZCA8PSBNSU5fTE9PS0FIRUFEIC0gMSAmJlxuICAgICAqICAgIG1vcmUgPT0gd2luZG93X3NpemUgLSBsb29rYWhlYWQgLSBzdHJzdGFydFxuICAgICAqID0+IG1vcmUgPj0gd2luZG93X3NpemUgLSAoTUlOX0xPT0tBSEVBRC0xICsgV1NJWkUgKyBNQVhfRElTVC0xKVxuICAgICAqID0+IG1vcmUgPj0gd2luZG93X3NpemUgLSAyKldTSVpFICsgMlxuICAgICAqIEluIHRoZSBCSUdfTUVNIG9yIE1NQVAgY2FzZSAobm90IHlldCBzdXBwb3J0ZWQpLFxuICAgICAqICAgd2luZG93X3NpemUgPT0gaW5wdXRfc2l6ZSArIE1JTl9MT09LQUhFQUQgICYmXG4gICAgICogICBzdHJzdGFydCArIHMtPmxvb2thaGVhZCA8PSBpbnB1dF9zaXplID0+IG1vcmUgPj0gTUlOX0xPT0tBSEVBRC5cbiAgICAgKiBPdGhlcndpc2UsIHdpbmRvd19zaXplID09IDIqV1NJWkUgc28gbW9yZSA+PSAyLlxuICAgICAqIElmIHRoZXJlIHdhcyBzbGlkaW5nLCBtb3JlID49IFdTSVpFLiBTbyBpbiBhbGwgY2FzZXMsIG1vcmUgPj0gMi5cbiAgICAgKi9cbiAgICAvL0Fzc2VydChtb3JlID49IDIsIFwibW9yZSA8IDJcIik7XG4gICAgbiA9IHJlYWRfYnVmKHMuc3RybSwgcy53aW5kb3csIHMuc3Ryc3RhcnQgKyBzLmxvb2thaGVhZCwgbW9yZSk7XG4gICAgcy5sb29rYWhlYWQgKz0gbjtcblxuICAgIC8qIEluaXRpYWxpemUgdGhlIGhhc2ggdmFsdWUgbm93IHRoYXQgd2UgaGF2ZSBzb21lIGlucHV0OiAqL1xuICAgIGlmIChzLmxvb2thaGVhZCArIHMuaW5zZXJ0ID49IE1JTl9NQVRDSCkge1xuICAgICAgc3RyID0gcy5zdHJzdGFydCAtIHMuaW5zZXJ0O1xuICAgICAgcy5pbnNfaCA9IHMud2luZG93W3N0cl07XG5cbiAgICAgIC8qIFVQREFURV9IQVNIKHMsIHMtPmluc19oLCBzLT53aW5kb3dbc3RyICsgMV0pOyAqL1xuICAgICAgcy5pbnNfaCA9IEhBU0gocywgcy5pbnNfaCwgcy53aW5kb3dbc3RyICsgMV0pO1xuLy8jaWYgTUlOX01BVENIICE9IDNcbi8vICAgICAgICBDYWxsIHVwZGF0ZV9oYXNoKCkgTUlOX01BVENILTMgbW9yZSB0aW1lc1xuLy8jZW5kaWZcbiAgICAgIHdoaWxlIChzLmluc2VydCkge1xuICAgICAgICAvKiBVUERBVEVfSEFTSChzLCBzLT5pbnNfaCwgcy0+d2luZG93W3N0ciArIE1JTl9NQVRDSC0xXSk7ICovXG4gICAgICAgIHMuaW5zX2ggPSBIQVNIKHMsIHMuaW5zX2gsIHMud2luZG93W3N0ciArIE1JTl9NQVRDSCAtIDFdKTtcblxuICAgICAgICBzLnByZXZbc3RyICYgcy53X21hc2tdID0gcy5oZWFkW3MuaW5zX2hdO1xuICAgICAgICBzLmhlYWRbcy5pbnNfaF0gPSBzdHI7XG4gICAgICAgIHN0cisrO1xuICAgICAgICBzLmluc2VydC0tO1xuICAgICAgICBpZiAocy5sb29rYWhlYWQgKyBzLmluc2VydCA8IE1JTl9NQVRDSCkge1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8qIElmIHRoZSB3aG9sZSBpbnB1dCBoYXMgbGVzcyB0aGFuIE1JTl9NQVRDSCBieXRlcywgaW5zX2ggaXMgZ2FyYmFnZSxcbiAgICAgKiBidXQgdGhpcyBpcyBub3QgaW1wb3J0YW50IHNpbmNlIG9ubHkgbGl0ZXJhbCBieXRlcyB3aWxsIGJlIGVtaXR0ZWQuXG4gICAgICovXG5cbiAgfSB3aGlsZSAocy5sb29rYWhlYWQgPCBNSU5fTE9PS0FIRUFEICYmIHMuc3RybS5hdmFpbF9pbiAhPT0gMCk7XG5cbiAgLyogSWYgdGhlIFdJTl9JTklUIGJ5dGVzIGFmdGVyIHRoZSBlbmQgb2YgdGhlIGN1cnJlbnQgZGF0YSBoYXZlIG5ldmVyIGJlZW5cbiAgICogd3JpdHRlbiwgdGhlbiB6ZXJvIHRob3NlIGJ5dGVzIGluIG9yZGVyIHRvIGF2b2lkIG1lbW9yeSBjaGVjayByZXBvcnRzIG9mXG4gICAqIHRoZSB1c2Ugb2YgdW5pbml0aWFsaXplZCAob3IgdW5pbml0aWFsaXNlZCBhcyBKdWxpYW4gd3JpdGVzKSBieXRlcyBieVxuICAgKiB0aGUgbG9uZ2VzdCBtYXRjaCByb3V0aW5lcy4gIFVwZGF0ZSB0aGUgaGlnaCB3YXRlciBtYXJrIGZvciB0aGUgbmV4dFxuICAgKiB0aW1lIHRocm91Z2ggaGVyZS4gIFdJTl9JTklUIGlzIHNldCB0byBNQVhfTUFUQ0ggc2luY2UgdGhlIGxvbmdlc3QgbWF0Y2hcbiAgICogcm91dGluZXMgYWxsb3cgc2Nhbm5pbmcgdG8gc3Ryc3RhcnQgKyBNQVhfTUFUQ0gsIGlnbm9yaW5nIGxvb2thaGVhZC5cbiAgICovXG4vLyAgaWYgKHMuaGlnaF93YXRlciA8IHMud2luZG93X3NpemUpIHtcbi8vICAgIGNvbnN0IGN1cnIgPSBzLnN0cnN0YXJ0ICsgcy5sb29rYWhlYWQ7XG4vLyAgICBsZXQgaW5pdCA9IDA7XG4vL1xuLy8gICAgaWYgKHMuaGlnaF93YXRlciA8IGN1cnIpIHtcbi8vICAgICAgLyogUHJldmlvdXMgaGlnaCB3YXRlciBtYXJrIGJlbG93IGN1cnJlbnQgZGF0YSAtLSB6ZXJvIFdJTl9JTklUXG4vLyAgICAgICAqIGJ5dGVzIG9yIHVwIHRvIGVuZCBvZiB3aW5kb3csIHdoaWNoZXZlciBpcyBsZXNzLlxuLy8gICAgICAgKi9cbi8vICAgICAgaW5pdCA9IHMud2luZG93X3NpemUgLSBjdXJyO1xuLy8gICAgICBpZiAoaW5pdCA+IFdJTl9JTklUKVxuLy8gICAgICAgIGluaXQgPSBXSU5fSU5JVDtcbi8vICAgICAgem1lbXplcm8ocy0+d2luZG93ICsgY3VyciwgKHVuc2lnbmVkKWluaXQpO1xuLy8gICAgICBzLT5oaWdoX3dhdGVyID0gY3VyciArIGluaXQ7XG4vLyAgICB9XG4vLyAgICBlbHNlIGlmIChzLT5oaWdoX3dhdGVyIDwgKHVsZyljdXJyICsgV0lOX0lOSVQpIHtcbi8vICAgICAgLyogSGlnaCB3YXRlciBtYXJrIGF0IG9yIGFib3ZlIGN1cnJlbnQgZGF0YSwgYnV0IGJlbG93IGN1cnJlbnQgZGF0YVxuLy8gICAgICAgKiBwbHVzIFdJTl9JTklUIC0tIHplcm8gb3V0IHRvIGN1cnJlbnQgZGF0YSBwbHVzIFdJTl9JTklULCBvciB1cFxuLy8gICAgICAgKiB0byBlbmQgb2Ygd2luZG93LCB3aGljaGV2ZXIgaXMgbGVzcy5cbi8vICAgICAgICovXG4vLyAgICAgIGluaXQgPSAodWxnKWN1cnIgKyBXSU5fSU5JVCAtIHMtPmhpZ2hfd2F0ZXI7XG4vLyAgICAgIGlmIChpbml0ID4gcy0+d2luZG93X3NpemUgLSBzLT5oaWdoX3dhdGVyKVxuLy8gICAgICAgIGluaXQgPSBzLT53aW5kb3dfc2l6ZSAtIHMtPmhpZ2hfd2F0ZXI7XG4vLyAgICAgIHptZW16ZXJvKHMtPndpbmRvdyArIHMtPmhpZ2hfd2F0ZXIsICh1bnNpZ25lZClpbml0KTtcbi8vICAgICAgcy0+aGlnaF93YXRlciArPSBpbml0O1xuLy8gICAgfVxuLy8gIH1cbi8vXG4vLyAgQXNzZXJ0KCh1bGcpcy0+c3Ryc3RhcnQgPD0gcy0+d2luZG93X3NpemUgLSBNSU5fTE9PS0FIRUFELFxuLy8gICAgXCJub3QgZW5vdWdoIHJvb20gZm9yIHNlYXJjaFwiKTtcbn07XG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogQ29weSB3aXRob3V0IGNvbXByZXNzaW9uIGFzIG11Y2ggYXMgcG9zc2libGUgZnJvbSB0aGUgaW5wdXQgc3RyZWFtLCByZXR1cm5cbiAqIHRoZSBjdXJyZW50IGJsb2NrIHN0YXRlLlxuICpcbiAqIEluIGNhc2UgZGVmbGF0ZVBhcmFtcygpIGlzIHVzZWQgdG8gbGF0ZXIgc3dpdGNoIHRvIGEgbm9uLXplcm8gY29tcHJlc3Npb25cbiAqIGxldmVsLCBzLT5tYXRjaGVzIChvdGhlcndpc2UgdW51c2VkIHdoZW4gc3RvcmluZykga2VlcHMgdHJhY2sgb2YgdGhlIG51bWJlclxuICogb2YgaGFzaCB0YWJsZSBzbGlkZXMgdG8gcGVyZm9ybS4gSWYgcy0+bWF0Y2hlcyBpcyAxLCB0aGVuIG9uZSBoYXNoIHRhYmxlXG4gKiBzbGlkZSB3aWxsIGJlIGRvbmUgd2hlbiBzd2l0Y2hpbmcuIElmIHMtPm1hdGNoZXMgaXMgMiwgdGhlIG1heGltdW0gdmFsdWVcbiAqIGFsbG93ZWQgaGVyZSwgdGhlbiB0aGUgaGFzaCB0YWJsZSB3aWxsIGJlIGNsZWFyZWQsIHNpbmNlIHR3byBvciBtb3JlIHNsaWRlc1xuICogaXMgdGhlIHNhbWUgYXMgYSBjbGVhci5cbiAqXG4gKiBkZWZsYXRlX3N0b3JlZCgpIGlzIHdyaXR0ZW4gdG8gbWluaW1pemUgdGhlIG51bWJlciBvZiB0aW1lcyBhbiBpbnB1dCBieXRlIGlzXG4gKiBjb3BpZWQuIEl0IGlzIG1vc3QgZWZmaWNpZW50IHdpdGggbGFyZ2UgaW5wdXQgYW5kIG91dHB1dCBidWZmZXJzLCB3aGljaFxuICogbWF4aW1pemVzIHRoZSBvcHBvcnR1bml0ZXMgdG8gaGF2ZSBhIHNpbmdsZSBjb3B5IGZyb20gbmV4dF9pbiB0byBuZXh0X291dC5cbiAqL1xuY29uc3QgZGVmbGF0ZV9zdG9yZWQgPSAocywgZmx1c2gpID0+IHtcblxuICAvKiBTbWFsbGVzdCB3b3J0aHkgYmxvY2sgc2l6ZSB3aGVuIG5vdCBmbHVzaGluZyBvciBmaW5pc2hpbmcuIEJ5IGRlZmF1bHRcbiAgICogdGhpcyBpcyAzMksuIFRoaXMgY2FuIGJlIGFzIHNtYWxsIGFzIDUwNyBieXRlcyBmb3IgbWVtTGV2ZWwgPT0gMS4gRm9yXG4gICAqIGxhcmdlIGlucHV0IGFuZCBvdXRwdXQgYnVmZmVycywgdGhlIHN0b3JlZCBibG9jayBzaXplIHdpbGwgYmUgbGFyZ2VyLlxuICAgKi9cbiAgbGV0IG1pbl9ibG9jayA9IHMucGVuZGluZ19idWZfc2l6ZSAtIDUgPiBzLndfc2l6ZSA/IHMud19zaXplIDogcy5wZW5kaW5nX2J1Zl9zaXplIC0gNTtcblxuICAvKiBDb3B5IGFzIG1hbnkgbWluX2Jsb2NrIG9yIGxhcmdlciBzdG9yZWQgYmxvY2tzIGRpcmVjdGx5IHRvIG5leHRfb3V0IGFzXG4gICAqIHBvc3NpYmxlLiBJZiBmbHVzaGluZywgY29weSB0aGUgcmVtYWluaW5nIGF2YWlsYWJsZSBpbnB1dCB0byBuZXh0X291dCBhc1xuICAgKiBzdG9yZWQgYmxvY2tzLCBpZiB0aGVyZSBpcyBlbm91Z2ggc3BhY2UuXG4gICAqL1xuICBsZXQgbGVuLCBsZWZ0LCBoYXZlLCBsYXN0ID0gMDtcbiAgbGV0IHVzZWQgPSBzLnN0cm0uYXZhaWxfaW47XG4gIGRvIHtcbiAgICAvKiBTZXQgbGVuIHRvIHRoZSBtYXhpbXVtIHNpemUgYmxvY2sgdGhhdCB3ZSBjYW4gY29weSBkaXJlY3RseSB3aXRoIHRoZVxuICAgICAqIGF2YWlsYWJsZSBpbnB1dCBkYXRhIGFuZCBvdXRwdXQgc3BhY2UuIFNldCBsZWZ0IHRvIGhvdyBtdWNoIG9mIHRoYXRcbiAgICAgKiB3b3VsZCBiZSBjb3BpZWQgZnJvbSB3aGF0J3MgbGVmdCBpbiB0aGUgd2luZG93LlxuICAgICAqL1xuICAgIGxlbiA9IDY1NTM1LyogTUFYX1NUT1JFRCAqLzsgICAgIC8qIG1heGltdW0gZGVmbGF0ZSBzdG9yZWQgYmxvY2sgbGVuZ3RoICovXG4gICAgaGF2ZSA9IChzLmJpX3ZhbGlkICsgNDIpID4+IDM7ICAgICAvKiBudW1iZXIgb2YgaGVhZGVyIGJ5dGVzICovXG4gICAgaWYgKHMuc3RybS5hdmFpbF9vdXQgPCBoYXZlKSB7ICAgICAgICAgLyogbmVlZCByb29tIGZvciBoZWFkZXIgKi9cbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICAgIC8qIG1heGltdW0gc3RvcmVkIGJsb2NrIGxlbmd0aCB0aGF0IHdpbGwgZml0IGluIGF2YWlsX291dDogKi9cbiAgICBoYXZlID0gcy5zdHJtLmF2YWlsX291dCAtIGhhdmU7XG4gICAgbGVmdCA9IHMuc3Ryc3RhcnQgLSBzLmJsb2NrX3N0YXJ0OyAgLyogYnl0ZXMgbGVmdCBpbiB3aW5kb3cgKi9cbiAgICBpZiAobGVuID4gbGVmdCArIHMuc3RybS5hdmFpbF9pbikge1xuICAgICAgbGVuID0gbGVmdCArIHMuc3RybS5hdmFpbF9pbjsgICAvKiBsaW1pdCBsZW4gdG8gdGhlIGlucHV0ICovXG4gICAgfVxuICAgIGlmIChsZW4gPiBoYXZlKSB7XG4gICAgICBsZW4gPSBoYXZlOyAgICAgICAgICAgICAvKiBsaW1pdCBsZW4gdG8gdGhlIG91dHB1dCAqL1xuICAgIH1cblxuICAgIC8qIElmIHRoZSBzdG9yZWQgYmxvY2sgd291bGQgYmUgbGVzcyB0aGFuIG1pbl9ibG9jayBpbiBsZW5ndGgsIG9yIGlmXG4gICAgICogdW5hYmxlIHRvIGNvcHkgYWxsIG9mIHRoZSBhdmFpbGFibGUgaW5wdXQgd2hlbiBmbHVzaGluZywgdGhlbiB0cnlcbiAgICAgKiBjb3B5aW5nIHRvIHRoZSB3aW5kb3cgYW5kIHRoZSBwZW5kaW5nIGJ1ZmZlciBpbnN0ZWFkLiBBbHNvIGRvbid0XG4gICAgICogd3JpdGUgYW4gZW1wdHkgYmxvY2sgd2hlbiBmbHVzaGluZyAtLSBkZWZsYXRlKCkgZG9lcyB0aGF0LlxuICAgICAqL1xuICAgIGlmIChsZW4gPCBtaW5fYmxvY2sgJiYgKChsZW4gPT09IDAgJiYgZmx1c2ggIT09IFpfRklOSVNIJDMpIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICBmbHVzaCA9PT0gWl9OT19GTFVTSCQyIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICBsZW4gIT09IGxlZnQgKyBzLnN0cm0uYXZhaWxfaW4pKSB7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICAvKiBNYWtlIGEgZHVtbXkgc3RvcmVkIGJsb2NrIGluIHBlbmRpbmcgdG8gZ2V0IHRoZSBoZWFkZXIgYnl0ZXMsXG4gICAgICogaW5jbHVkaW5nIGFueSBwZW5kaW5nIGJpdHMuIFRoaXMgYWxzbyB1cGRhdGVzIHRoZSBkZWJ1Z2dpbmcgY291bnRzLlxuICAgICAqL1xuICAgIGxhc3QgPSBmbHVzaCA9PT0gWl9GSU5JU0gkMyAmJiBsZW4gPT09IGxlZnQgKyBzLnN0cm0uYXZhaWxfaW4gPyAxIDogMDtcbiAgICBfdHJfc3RvcmVkX2Jsb2NrKHMsIDAsIDAsIGxhc3QpO1xuXG4gICAgLyogUmVwbGFjZSB0aGUgbGVuZ3RocyBpbiB0aGUgZHVtbXkgc3RvcmVkIGJsb2NrIHdpdGggbGVuLiAqL1xuICAgIHMucGVuZGluZ19idWZbcy5wZW5kaW5nIC0gNF0gPSBsZW47XG4gICAgcy5wZW5kaW5nX2J1ZltzLnBlbmRpbmcgLSAzXSA9IGxlbiA+PiA4O1xuICAgIHMucGVuZGluZ19idWZbcy5wZW5kaW5nIC0gMl0gPSB+bGVuO1xuICAgIHMucGVuZGluZ19idWZbcy5wZW5kaW5nIC0gMV0gPSB+bGVuID4+IDg7XG5cbiAgICAvKiBXcml0ZSB0aGUgc3RvcmVkIGJsb2NrIGhlYWRlciBieXRlcy4gKi9cbiAgICBmbHVzaF9wZW5kaW5nKHMuc3RybSk7XG5cbi8vI2lmZGVmIFpMSUJfREVCVUdcbi8vICAgIC8qIFVwZGF0ZSBkZWJ1Z2dpbmcgY291bnRzIGZvciB0aGUgZGF0YSBhYm91dCB0byBiZSBjb3BpZWQuICovXG4vLyAgICBzLT5jb21wcmVzc2VkX2xlbiArPSBsZW4gPDwgMztcbi8vICAgIHMtPmJpdHNfc2VudCArPSBsZW4gPDwgMztcbi8vI2VuZGlmXG5cbiAgICAvKiBDb3B5IHVuY29tcHJlc3NlZCBieXRlcyBmcm9tIHRoZSB3aW5kb3cgdG8gbmV4dF9vdXQuICovXG4gICAgaWYgKGxlZnQpIHtcbiAgICAgIGlmIChsZWZ0ID4gbGVuKSB7XG4gICAgICAgIGxlZnQgPSBsZW47XG4gICAgICB9XG4gICAgICAvL3ptZW1jcHkocy0+c3RybS0+bmV4dF9vdXQsIHMtPndpbmRvdyArIHMtPmJsb2NrX3N0YXJ0LCBsZWZ0KTtcbiAgICAgIHMuc3RybS5vdXRwdXQuc2V0KHMud2luZG93LnN1YmFycmF5KHMuYmxvY2tfc3RhcnQsIHMuYmxvY2tfc3RhcnQgKyBsZWZ0KSwgcy5zdHJtLm5leHRfb3V0KTtcbiAgICAgIHMuc3RybS5uZXh0X291dCArPSBsZWZ0O1xuICAgICAgcy5zdHJtLmF2YWlsX291dCAtPSBsZWZ0O1xuICAgICAgcy5zdHJtLnRvdGFsX291dCArPSBsZWZ0O1xuICAgICAgcy5ibG9ja19zdGFydCArPSBsZWZ0O1xuICAgICAgbGVuIC09IGxlZnQ7XG4gICAgfVxuXG4gICAgLyogQ29weSB1bmNvbXByZXNzZWQgYnl0ZXMgZGlyZWN0bHkgZnJvbSBuZXh0X2luIHRvIG5leHRfb3V0LCB1cGRhdGluZ1xuICAgICAqIHRoZSBjaGVjayB2YWx1ZS5cbiAgICAgKi9cbiAgICBpZiAobGVuKSB7XG4gICAgICByZWFkX2J1ZihzLnN0cm0sIHMuc3RybS5vdXRwdXQsIHMuc3RybS5uZXh0X291dCwgbGVuKTtcbiAgICAgIHMuc3RybS5uZXh0X291dCArPSBsZW47XG4gICAgICBzLnN0cm0uYXZhaWxfb3V0IC09IGxlbjtcbiAgICAgIHMuc3RybS50b3RhbF9vdXQgKz0gbGVuO1xuICAgIH1cbiAgfSB3aGlsZSAobGFzdCA9PT0gMCk7XG5cbiAgLyogVXBkYXRlIHRoZSBzbGlkaW5nIHdpbmRvdyB3aXRoIHRoZSBsYXN0IHMtPndfc2l6ZSBieXRlcyBvZiB0aGUgY29waWVkXG4gICAqIGRhdGEsIG9yIGFwcGVuZCBhbGwgb2YgdGhlIGNvcGllZCBkYXRhIHRvIHRoZSBleGlzdGluZyB3aW5kb3cgaWYgbGVzc1xuICAgKiB0aGFuIHMtPndfc2l6ZSBieXRlcyB3ZXJlIGNvcGllZC4gQWxzbyB1cGRhdGUgdGhlIG51bWJlciBvZiBieXRlcyB0b1xuICAgKiBpbnNlcnQgaW4gdGhlIGhhc2ggdGFibGVzLCBpbiB0aGUgZXZlbnQgdGhhdCBkZWZsYXRlUGFyYW1zKCkgc3dpdGNoZXMgdG9cbiAgICogYSBub24temVybyBjb21wcmVzc2lvbiBsZXZlbC5cbiAgICovXG4gIHVzZWQgLT0gcy5zdHJtLmF2YWlsX2luOyAgICAvKiBudW1iZXIgb2YgaW5wdXQgYnl0ZXMgZGlyZWN0bHkgY29waWVkICovXG4gIGlmICh1c2VkKSB7XG4gICAgLyogSWYgYW55IGlucHV0IHdhcyB1c2VkLCB0aGVuIG5vIHVudXNlZCBpbnB1dCByZW1haW5zIGluIHRoZSB3aW5kb3csXG4gICAgICogdGhlcmVmb3JlIHMtPmJsb2NrX3N0YXJ0ID09IHMtPnN0cnN0YXJ0LlxuICAgICAqL1xuICAgIGlmICh1c2VkID49IHMud19zaXplKSB7ICAvKiBzdXBwbGFudCB0aGUgcHJldmlvdXMgaGlzdG9yeSAqL1xuICAgICAgcy5tYXRjaGVzID0gMjsgICAgIC8qIGNsZWFyIGhhc2ggKi9cbiAgICAgIC8vem1lbWNweShzLT53aW5kb3csIHMtPnN0cm0tPm5leHRfaW4gLSBzLT53X3NpemUsIHMtPndfc2l6ZSk7XG4gICAgICBzLndpbmRvdy5zZXQocy5zdHJtLmlucHV0LnN1YmFycmF5KHMuc3RybS5uZXh0X2luIC0gcy53X3NpemUsIHMuc3RybS5uZXh0X2luKSwgMCk7XG4gICAgICBzLnN0cnN0YXJ0ID0gcy53X3NpemU7XG4gICAgICBzLmluc2VydCA9IHMuc3Ryc3RhcnQ7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgaWYgKHMud2luZG93X3NpemUgLSBzLnN0cnN0YXJ0IDw9IHVzZWQpIHtcbiAgICAgICAgLyogU2xpZGUgdGhlIHdpbmRvdyBkb3duLiAqL1xuICAgICAgICBzLnN0cnN0YXJ0IC09IHMud19zaXplO1xuICAgICAgICAvL3ptZW1jcHkocy0+d2luZG93LCBzLT53aW5kb3cgKyBzLT53X3NpemUsIHMtPnN0cnN0YXJ0KTtcbiAgICAgICAgcy53aW5kb3cuc2V0KHMud2luZG93LnN1YmFycmF5KHMud19zaXplLCBzLndfc2l6ZSArIHMuc3Ryc3RhcnQpLCAwKTtcbiAgICAgICAgaWYgKHMubWF0Y2hlcyA8IDIpIHtcbiAgICAgICAgICBzLm1hdGNoZXMrKzsgICAvKiBhZGQgYSBwZW5kaW5nIHNsaWRlX2hhc2goKSAqL1xuICAgICAgICB9XG4gICAgICAgIGlmIChzLmluc2VydCA+IHMuc3Ryc3RhcnQpIHtcbiAgICAgICAgICBzLmluc2VydCA9IHMuc3Ryc3RhcnQ7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vem1lbWNweShzLT53aW5kb3cgKyBzLT5zdHJzdGFydCwgcy0+c3RybS0+bmV4dF9pbiAtIHVzZWQsIHVzZWQpO1xuICAgICAgcy53aW5kb3cuc2V0KHMuc3RybS5pbnB1dC5zdWJhcnJheShzLnN0cm0ubmV4dF9pbiAtIHVzZWQsIHMuc3RybS5uZXh0X2luKSwgcy5zdHJzdGFydCk7XG4gICAgICBzLnN0cnN0YXJ0ICs9IHVzZWQ7XG4gICAgICBzLmluc2VydCArPSB1c2VkID4gcy53X3NpemUgLSBzLmluc2VydCA/IHMud19zaXplIC0gcy5pbnNlcnQgOiB1c2VkO1xuICAgIH1cbiAgICBzLmJsb2NrX3N0YXJ0ID0gcy5zdHJzdGFydDtcbiAgfVxuICBpZiAocy5oaWdoX3dhdGVyIDwgcy5zdHJzdGFydCkge1xuICAgIHMuaGlnaF93YXRlciA9IHMuc3Ryc3RhcnQ7XG4gIH1cblxuICAvKiBJZiB0aGUgbGFzdCBibG9jayB3YXMgd3JpdHRlbiB0byBuZXh0X291dCwgdGhlbiBkb25lLiAqL1xuICBpZiAobGFzdCkge1xuICAgIHJldHVybiBCU19GSU5JU0hfRE9ORTtcbiAgfVxuXG4gIC8qIElmIGZsdXNoaW5nIGFuZCBhbGwgaW5wdXQgaGFzIGJlZW4gY29uc3VtZWQsIHRoZW4gZG9uZS4gKi9cbiAgaWYgKGZsdXNoICE9PSBaX05PX0ZMVVNIJDIgJiYgZmx1c2ggIT09IFpfRklOSVNIJDMgJiZcbiAgICBzLnN0cm0uYXZhaWxfaW4gPT09IDAgJiYgcy5zdHJzdGFydCA9PT0gcy5ibG9ja19zdGFydCkge1xuICAgIHJldHVybiBCU19CTE9DS19ET05FO1xuICB9XG5cbiAgLyogRmlsbCB0aGUgd2luZG93IHdpdGggYW55IHJlbWFpbmluZyBpbnB1dC4gKi9cbiAgaGF2ZSA9IHMud2luZG93X3NpemUgLSBzLnN0cnN0YXJ0O1xuICBpZiAocy5zdHJtLmF2YWlsX2luID4gaGF2ZSAmJiBzLmJsb2NrX3N0YXJ0ID49IHMud19zaXplKSB7XG4gICAgLyogU2xpZGUgdGhlIHdpbmRvdyBkb3duLiAqL1xuICAgIHMuYmxvY2tfc3RhcnQgLT0gcy53X3NpemU7XG4gICAgcy5zdHJzdGFydCAtPSBzLndfc2l6ZTtcbiAgICAvL3ptZW1jcHkocy0+d2luZG93LCBzLT53aW5kb3cgKyBzLT53X3NpemUsIHMtPnN0cnN0YXJ0KTtcbiAgICBzLndpbmRvdy5zZXQocy53aW5kb3cuc3ViYXJyYXkocy53X3NpemUsIHMud19zaXplICsgcy5zdHJzdGFydCksIDApO1xuICAgIGlmIChzLm1hdGNoZXMgPCAyKSB7XG4gICAgICBzLm1hdGNoZXMrKzsgICAgICAgLyogYWRkIGEgcGVuZGluZyBzbGlkZV9oYXNoKCkgKi9cbiAgICB9XG4gICAgaGF2ZSArPSBzLndfc2l6ZTsgICAgICAvKiBtb3JlIHNwYWNlIG5vdyAqL1xuICAgIGlmIChzLmluc2VydCA+IHMuc3Ryc3RhcnQpIHtcbiAgICAgIHMuaW5zZXJ0ID0gcy5zdHJzdGFydDtcbiAgICB9XG4gIH1cbiAgaWYgKGhhdmUgPiBzLnN0cm0uYXZhaWxfaW4pIHtcbiAgICBoYXZlID0gcy5zdHJtLmF2YWlsX2luO1xuICB9XG4gIGlmIChoYXZlKSB7XG4gICAgcmVhZF9idWYocy5zdHJtLCBzLndpbmRvdywgcy5zdHJzdGFydCwgaGF2ZSk7XG4gICAgcy5zdHJzdGFydCArPSBoYXZlO1xuICAgIHMuaW5zZXJ0ICs9IGhhdmUgPiBzLndfc2l6ZSAtIHMuaW5zZXJ0ID8gcy53X3NpemUgLSBzLmluc2VydCA6IGhhdmU7XG4gIH1cbiAgaWYgKHMuaGlnaF93YXRlciA8IHMuc3Ryc3RhcnQpIHtcbiAgICBzLmhpZ2hfd2F0ZXIgPSBzLnN0cnN0YXJ0O1xuICB9XG5cbiAgLyogVGhlcmUgd2FzIG5vdCBlbm91Z2ggYXZhaWxfb3V0IHRvIHdyaXRlIGEgY29tcGxldGUgd29ydGh5IG9yIGZsdXNoZWRcbiAgICogc3RvcmVkIGJsb2NrIHRvIG5leHRfb3V0LiBXcml0ZSBhIHN0b3JlZCBibG9jayB0byBwZW5kaW5nIGluc3RlYWQsIGlmIHdlXG4gICAqIGhhdmUgZW5vdWdoIGlucHV0IGZvciBhIHdvcnRoeSBibG9jaywgb3IgaWYgZmx1c2hpbmcgYW5kIHRoZXJlIGlzIGVub3VnaFxuICAgKiByb29tIGZvciB0aGUgcmVtYWluaW5nIGlucHV0IGFzIGEgc3RvcmVkIGJsb2NrIGluIHRoZSBwZW5kaW5nIGJ1ZmZlci5cbiAgICovXG4gIGhhdmUgPSAocy5iaV92YWxpZCArIDQyKSA+PiAzOyAgICAgLyogbnVtYmVyIG9mIGhlYWRlciBieXRlcyAqL1xuICAgIC8qIG1heGltdW0gc3RvcmVkIGJsb2NrIGxlbmd0aCB0aGF0IHdpbGwgZml0IGluIHBlbmRpbmc6ICovXG4gIGhhdmUgPSBzLnBlbmRpbmdfYnVmX3NpemUgLSBoYXZlID4gNjU1MzUvKiBNQVhfU1RPUkVEICovID8gNjU1MzUvKiBNQVhfU1RPUkVEICovIDogcy5wZW5kaW5nX2J1Zl9zaXplIC0gaGF2ZTtcbiAgbWluX2Jsb2NrID0gaGF2ZSA+IHMud19zaXplID8gcy53X3NpemUgOiBoYXZlO1xuICBsZWZ0ID0gcy5zdHJzdGFydCAtIHMuYmxvY2tfc3RhcnQ7XG4gIGlmIChsZWZ0ID49IG1pbl9ibG9jayB8fFxuICAgICAoKGxlZnQgfHwgZmx1c2ggPT09IFpfRklOSVNIJDMpICYmIGZsdXNoICE9PSBaX05PX0ZMVVNIJDIgJiZcbiAgICAgcy5zdHJtLmF2YWlsX2luID09PSAwICYmIGxlZnQgPD0gaGF2ZSkpIHtcbiAgICBsZW4gPSBsZWZ0ID4gaGF2ZSA/IGhhdmUgOiBsZWZ0O1xuICAgIGxhc3QgPSBmbHVzaCA9PT0gWl9GSU5JU0gkMyAmJiBzLnN0cm0uYXZhaWxfaW4gPT09IDAgJiZcbiAgICAgICAgIGxlbiA9PT0gbGVmdCA/IDEgOiAwO1xuICAgIF90cl9zdG9yZWRfYmxvY2socywgcy5ibG9ja19zdGFydCwgbGVuLCBsYXN0KTtcbiAgICBzLmJsb2NrX3N0YXJ0ICs9IGxlbjtcbiAgICBmbHVzaF9wZW5kaW5nKHMuc3RybSk7XG4gIH1cblxuICAvKiBXZSd2ZSBkb25lIGFsbCB3ZSBjYW4gd2l0aCB0aGUgYXZhaWxhYmxlIGlucHV0IGFuZCBvdXRwdXQuICovXG4gIHJldHVybiBsYXN0ID8gQlNfRklOSVNIX1NUQVJURUQgOiBCU19ORUVEX01PUkU7XG59O1xuXG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogQ29tcHJlc3MgYXMgbXVjaCBhcyBwb3NzaWJsZSBmcm9tIHRoZSBpbnB1dCBzdHJlYW0sIHJldHVybiB0aGUgY3VycmVudFxuICogYmxvY2sgc3RhdGUuXG4gKiBUaGlzIGZ1bmN0aW9uIGRvZXMgbm90IHBlcmZvcm0gbGF6eSBldmFsdWF0aW9uIG9mIG1hdGNoZXMgYW5kIGluc2VydHNcbiAqIG5ldyBzdHJpbmdzIGluIHRoZSBkaWN0aW9uYXJ5IG9ubHkgZm9yIHVubWF0Y2hlZCBzdHJpbmdzIG9yIGZvciBzaG9ydFxuICogbWF0Y2hlcy4gSXQgaXMgdXNlZCBvbmx5IGZvciB0aGUgZmFzdCBjb21wcmVzc2lvbiBvcHRpb25zLlxuICovXG5jb25zdCBkZWZsYXRlX2Zhc3QgPSAocywgZmx1c2gpID0+IHtcblxuICBsZXQgaGFzaF9oZWFkOyAgICAgICAgLyogaGVhZCBvZiB0aGUgaGFzaCBjaGFpbiAqL1xuICBsZXQgYmZsdXNoOyAgICAgICAgICAgLyogc2V0IGlmIGN1cnJlbnQgYmxvY2sgbXVzdCBiZSBmbHVzaGVkICovXG5cbiAgZm9yICg7Oykge1xuICAgIC8qIE1ha2Ugc3VyZSB0aGF0IHdlIGFsd2F5cyBoYXZlIGVub3VnaCBsb29rYWhlYWQsIGV4Y2VwdFxuICAgICAqIGF0IHRoZSBlbmQgb2YgdGhlIGlucHV0IGZpbGUuIFdlIG5lZWQgTUFYX01BVENIIGJ5dGVzXG4gICAgICogZm9yIHRoZSBuZXh0IG1hdGNoLCBwbHVzIE1JTl9NQVRDSCBieXRlcyB0byBpbnNlcnQgdGhlXG4gICAgICogc3RyaW5nIGZvbGxvd2luZyB0aGUgbmV4dCBtYXRjaC5cbiAgICAgKi9cbiAgICBpZiAocy5sb29rYWhlYWQgPCBNSU5fTE9PS0FIRUFEKSB7XG4gICAgICBmaWxsX3dpbmRvdyhzKTtcbiAgICAgIGlmIChzLmxvb2thaGVhZCA8IE1JTl9MT09LQUhFQUQgJiYgZmx1c2ggPT09IFpfTk9fRkxVU0gkMikge1xuICAgICAgICByZXR1cm4gQlNfTkVFRF9NT1JFO1xuICAgICAgfVxuICAgICAgaWYgKHMubG9va2FoZWFkID09PSAwKSB7XG4gICAgICAgIGJyZWFrOyAvKiBmbHVzaCB0aGUgY3VycmVudCBibG9jayAqL1xuICAgICAgfVxuICAgIH1cblxuICAgIC8qIEluc2VydCB0aGUgc3RyaW5nIHdpbmRvd1tzdHJzdGFydCAuLiBzdHJzdGFydCsyXSBpbiB0aGVcbiAgICAgKiBkaWN0aW9uYXJ5LCBhbmQgc2V0IGhhc2hfaGVhZCB0byB0aGUgaGVhZCBvZiB0aGUgaGFzaCBjaGFpbjpcbiAgICAgKi9cbiAgICBoYXNoX2hlYWQgPSAwLypOSUwqLztcbiAgICBpZiAocy5sb29rYWhlYWQgPj0gTUlOX01BVENIKSB7XG4gICAgICAvKioqIElOU0VSVF9TVFJJTkcocywgcy5zdHJzdGFydCwgaGFzaF9oZWFkKTsgKioqL1xuICAgICAgcy5pbnNfaCA9IEhBU0gocywgcy5pbnNfaCwgcy53aW5kb3dbcy5zdHJzdGFydCArIE1JTl9NQVRDSCAtIDFdKTtcbiAgICAgIGhhc2hfaGVhZCA9IHMucHJldltzLnN0cnN0YXJ0ICYgcy53X21hc2tdID0gcy5oZWFkW3MuaW5zX2hdO1xuICAgICAgcy5oZWFkW3MuaW5zX2hdID0gcy5zdHJzdGFydDtcbiAgICAgIC8qKiovXG4gICAgfVxuXG4gICAgLyogRmluZCB0aGUgbG9uZ2VzdCBtYXRjaCwgZGlzY2FyZGluZyB0aG9zZSA8PSBwcmV2X2xlbmd0aC5cbiAgICAgKiBBdCB0aGlzIHBvaW50IHdlIGhhdmUgYWx3YXlzIG1hdGNoX2xlbmd0aCA8IE1JTl9NQVRDSFxuICAgICAqL1xuICAgIGlmIChoYXNoX2hlYWQgIT09IDAvKk5JTCovICYmICgocy5zdHJzdGFydCAtIGhhc2hfaGVhZCkgPD0gKHMud19zaXplIC0gTUlOX0xPT0tBSEVBRCkpKSB7XG4gICAgICAvKiBUbyBzaW1wbGlmeSB0aGUgY29kZSwgd2UgcHJldmVudCBtYXRjaGVzIHdpdGggdGhlIHN0cmluZ1xuICAgICAgICogb2Ygd2luZG93IGluZGV4IDAgKGluIHBhcnRpY3VsYXIgd2UgaGF2ZSB0byBhdm9pZCBhIG1hdGNoXG4gICAgICAgKiBvZiB0aGUgc3RyaW5nIHdpdGggaXRzZWxmIGF0IHRoZSBzdGFydCBvZiB0aGUgaW5wdXQgZmlsZSkuXG4gICAgICAgKi9cbiAgICAgIHMubWF0Y2hfbGVuZ3RoID0gbG9uZ2VzdF9tYXRjaChzLCBoYXNoX2hlYWQpO1xuICAgICAgLyogbG9uZ2VzdF9tYXRjaCgpIHNldHMgbWF0Y2hfc3RhcnQgKi9cbiAgICB9XG4gICAgaWYgKHMubWF0Y2hfbGVuZ3RoID49IE1JTl9NQVRDSCkge1xuICAgICAgLy8gY2hlY2tfbWF0Y2gocywgcy5zdHJzdGFydCwgcy5tYXRjaF9zdGFydCwgcy5tYXRjaF9sZW5ndGgpOyAvLyBmb3IgZGVidWcgb25seVxuXG4gICAgICAvKioqIF90cl90YWxseV9kaXN0KHMsIHMuc3Ryc3RhcnQgLSBzLm1hdGNoX3N0YXJ0LFxuICAgICAgICAgICAgICAgICAgICAgcy5tYXRjaF9sZW5ndGggLSBNSU5fTUFUQ0gsIGJmbHVzaCk7ICoqKi9cbiAgICAgIGJmbHVzaCA9IF90cl90YWxseShzLCBzLnN0cnN0YXJ0IC0gcy5tYXRjaF9zdGFydCwgcy5tYXRjaF9sZW5ndGggLSBNSU5fTUFUQ0gpO1xuXG4gICAgICBzLmxvb2thaGVhZCAtPSBzLm1hdGNoX2xlbmd0aDtcblxuICAgICAgLyogSW5zZXJ0IG5ldyBzdHJpbmdzIGluIHRoZSBoYXNoIHRhYmxlIG9ubHkgaWYgdGhlIG1hdGNoIGxlbmd0aFxuICAgICAgICogaXMgbm90IHRvbyBsYXJnZS4gVGhpcyBzYXZlcyB0aW1lIGJ1dCBkZWdyYWRlcyBjb21wcmVzc2lvbi5cbiAgICAgICAqL1xuICAgICAgaWYgKHMubWF0Y2hfbGVuZ3RoIDw9IHMubWF4X2xhenlfbWF0Y2gvKm1heF9pbnNlcnRfbGVuZ3RoKi8gJiYgcy5sb29rYWhlYWQgPj0gTUlOX01BVENIKSB7XG4gICAgICAgIHMubWF0Y2hfbGVuZ3RoLS07IC8qIHN0cmluZyBhdCBzdHJzdGFydCBhbHJlYWR5IGluIHRhYmxlICovXG4gICAgICAgIGRvIHtcbiAgICAgICAgICBzLnN0cnN0YXJ0Kys7XG4gICAgICAgICAgLyoqKiBJTlNFUlRfU1RSSU5HKHMsIHMuc3Ryc3RhcnQsIGhhc2hfaGVhZCk7ICoqKi9cbiAgICAgICAgICBzLmluc19oID0gSEFTSChzLCBzLmluc19oLCBzLndpbmRvd1tzLnN0cnN0YXJ0ICsgTUlOX01BVENIIC0gMV0pO1xuICAgICAgICAgIGhhc2hfaGVhZCA9IHMucHJldltzLnN0cnN0YXJ0ICYgcy53X21hc2tdID0gcy5oZWFkW3MuaW5zX2hdO1xuICAgICAgICAgIHMuaGVhZFtzLmluc19oXSA9IHMuc3Ryc3RhcnQ7XG4gICAgICAgICAgLyoqKi9cbiAgICAgICAgICAvKiBzdHJzdGFydCBuZXZlciBleGNlZWRzIFdTSVpFLU1BWF9NQVRDSCwgc28gdGhlcmUgYXJlXG4gICAgICAgICAgICogYWx3YXlzIE1JTl9NQVRDSCBieXRlcyBhaGVhZC5cbiAgICAgICAgICAgKi9cbiAgICAgICAgfSB3aGlsZSAoLS1zLm1hdGNoX2xlbmd0aCAhPT0gMCk7XG4gICAgICAgIHMuc3Ryc3RhcnQrKztcbiAgICAgIH0gZWxzZVxuICAgICAge1xuICAgICAgICBzLnN0cnN0YXJ0ICs9IHMubWF0Y2hfbGVuZ3RoO1xuICAgICAgICBzLm1hdGNoX2xlbmd0aCA9IDA7XG4gICAgICAgIHMuaW5zX2ggPSBzLndpbmRvd1tzLnN0cnN0YXJ0XTtcbiAgICAgICAgLyogVVBEQVRFX0hBU0gocywgcy5pbnNfaCwgcy53aW5kb3dbcy5zdHJzdGFydCsxXSk7ICovXG4gICAgICAgIHMuaW5zX2ggPSBIQVNIKHMsIHMuaW5zX2gsIHMud2luZG93W3Muc3Ryc3RhcnQgKyAxXSk7XG5cbi8vI2lmIE1JTl9NQVRDSCAhPSAzXG4vLyAgICAgICAgICAgICAgICBDYWxsIFVQREFURV9IQVNIKCkgTUlOX01BVENILTMgbW9yZSB0aW1lc1xuLy8jZW5kaWZcbiAgICAgICAgLyogSWYgbG9va2FoZWFkIDwgTUlOX01BVENILCBpbnNfaCBpcyBnYXJiYWdlLCBidXQgaXQgZG9lcyBub3RcbiAgICAgICAgICogbWF0dGVyIHNpbmNlIGl0IHdpbGwgYmUgcmVjb21wdXRlZCBhdCBuZXh0IGRlZmxhdGUgY2FsbC5cbiAgICAgICAgICovXG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8qIE5vIG1hdGNoLCBvdXRwdXQgYSBsaXRlcmFsIGJ5dGUgKi9cbiAgICAgIC8vVHJhY2V2digoc3RkZXJyLFwiJWNcIiwgcy53aW5kb3dbcy5zdHJzdGFydF0pKTtcbiAgICAgIC8qKiogX3RyX3RhbGx5X2xpdChzLCBzLndpbmRvd1tzLnN0cnN0YXJ0XSwgYmZsdXNoKTsgKioqL1xuICAgICAgYmZsdXNoID0gX3RyX3RhbGx5KHMsIDAsIHMud2luZG93W3Muc3Ryc3RhcnRdKTtcblxuICAgICAgcy5sb29rYWhlYWQtLTtcbiAgICAgIHMuc3Ryc3RhcnQrKztcbiAgICB9XG4gICAgaWYgKGJmbHVzaCkge1xuICAgICAgLyoqKiBGTFVTSF9CTE9DSyhzLCAwKTsgKioqL1xuICAgICAgZmx1c2hfYmxvY2tfb25seShzLCBmYWxzZSk7XG4gICAgICBpZiAocy5zdHJtLmF2YWlsX291dCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gQlNfTkVFRF9NT1JFO1xuICAgICAgfVxuICAgICAgLyoqKi9cbiAgICB9XG4gIH1cbiAgcy5pbnNlcnQgPSAoKHMuc3Ryc3RhcnQgPCAoTUlOX01BVENIIC0gMSkpID8gcy5zdHJzdGFydCA6IE1JTl9NQVRDSCAtIDEpO1xuICBpZiAoZmx1c2ggPT09IFpfRklOSVNIJDMpIHtcbiAgICAvKioqIEZMVVNIX0JMT0NLKHMsIDEpOyAqKiovXG4gICAgZmx1c2hfYmxvY2tfb25seShzLCB0cnVlKTtcbiAgICBpZiAocy5zdHJtLmF2YWlsX291dCA9PT0gMCkge1xuICAgICAgcmV0dXJuIEJTX0ZJTklTSF9TVEFSVEVEO1xuICAgIH1cbiAgICAvKioqL1xuICAgIHJldHVybiBCU19GSU5JU0hfRE9ORTtcbiAgfVxuICBpZiAocy5zeW1fbmV4dCkge1xuICAgIC8qKiogRkxVU0hfQkxPQ0socywgMCk7ICoqKi9cbiAgICBmbHVzaF9ibG9ja19vbmx5KHMsIGZhbHNlKTtcbiAgICBpZiAocy5zdHJtLmF2YWlsX291dCA9PT0gMCkge1xuICAgICAgcmV0dXJuIEJTX05FRURfTU9SRTtcbiAgICB9XG4gICAgLyoqKi9cbiAgfVxuICByZXR1cm4gQlNfQkxPQ0tfRE9ORTtcbn07XG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogU2FtZSBhcyBhYm92ZSwgYnV0IGFjaGlldmVzIGJldHRlciBjb21wcmVzc2lvbi4gV2UgdXNlIGEgbGF6eVxuICogZXZhbHVhdGlvbiBmb3IgbWF0Y2hlczogYSBtYXRjaCBpcyBmaW5hbGx5IGFkb3B0ZWQgb25seSBpZiB0aGVyZSBpc1xuICogbm8gYmV0dGVyIG1hdGNoIGF0IHRoZSBuZXh0IHdpbmRvdyBwb3NpdGlvbi5cbiAqL1xuY29uc3QgZGVmbGF0ZV9zbG93ID0gKHMsIGZsdXNoKSA9PiB7XG5cbiAgbGV0IGhhc2hfaGVhZDsgICAgICAgICAgLyogaGVhZCBvZiBoYXNoIGNoYWluICovXG4gIGxldCBiZmx1c2g7ICAgICAgICAgICAgICAvKiBzZXQgaWYgY3VycmVudCBibG9jayBtdXN0IGJlIGZsdXNoZWQgKi9cblxuICBsZXQgbWF4X2luc2VydDtcblxuICAvKiBQcm9jZXNzIHRoZSBpbnB1dCBibG9jay4gKi9cbiAgZm9yICg7Oykge1xuICAgIC8qIE1ha2Ugc3VyZSB0aGF0IHdlIGFsd2F5cyBoYXZlIGVub3VnaCBsb29rYWhlYWQsIGV4Y2VwdFxuICAgICAqIGF0IHRoZSBlbmQgb2YgdGhlIGlucHV0IGZpbGUuIFdlIG5lZWQgTUFYX01BVENIIGJ5dGVzXG4gICAgICogZm9yIHRoZSBuZXh0IG1hdGNoLCBwbHVzIE1JTl9NQVRDSCBieXRlcyB0byBpbnNlcnQgdGhlXG4gICAgICogc3RyaW5nIGZvbGxvd2luZyB0aGUgbmV4dCBtYXRjaC5cbiAgICAgKi9cbiAgICBpZiAocy5sb29rYWhlYWQgPCBNSU5fTE9PS0FIRUFEKSB7XG4gICAgICBmaWxsX3dpbmRvdyhzKTtcbiAgICAgIGlmIChzLmxvb2thaGVhZCA8IE1JTl9MT09LQUhFQUQgJiYgZmx1c2ggPT09IFpfTk9fRkxVU0gkMikge1xuICAgICAgICByZXR1cm4gQlNfTkVFRF9NT1JFO1xuICAgICAgfVxuICAgICAgaWYgKHMubG9va2FoZWFkID09PSAwKSB7IGJyZWFrOyB9IC8qIGZsdXNoIHRoZSBjdXJyZW50IGJsb2NrICovXG4gICAgfVxuXG4gICAgLyogSW5zZXJ0IHRoZSBzdHJpbmcgd2luZG93W3N0cnN0YXJ0IC4uIHN0cnN0YXJ0KzJdIGluIHRoZVxuICAgICAqIGRpY3Rpb25hcnksIGFuZCBzZXQgaGFzaF9oZWFkIHRvIHRoZSBoZWFkIG9mIHRoZSBoYXNoIGNoYWluOlxuICAgICAqL1xuICAgIGhhc2hfaGVhZCA9IDAvKk5JTCovO1xuICAgIGlmIChzLmxvb2thaGVhZCA+PSBNSU5fTUFUQ0gpIHtcbiAgICAgIC8qKiogSU5TRVJUX1NUUklORyhzLCBzLnN0cnN0YXJ0LCBoYXNoX2hlYWQpOyAqKiovXG4gICAgICBzLmluc19oID0gSEFTSChzLCBzLmluc19oLCBzLndpbmRvd1tzLnN0cnN0YXJ0ICsgTUlOX01BVENIIC0gMV0pO1xuICAgICAgaGFzaF9oZWFkID0gcy5wcmV2W3Muc3Ryc3RhcnQgJiBzLndfbWFza10gPSBzLmhlYWRbcy5pbnNfaF07XG4gICAgICBzLmhlYWRbcy5pbnNfaF0gPSBzLnN0cnN0YXJ0O1xuICAgICAgLyoqKi9cbiAgICB9XG5cbiAgICAvKiBGaW5kIHRoZSBsb25nZXN0IG1hdGNoLCBkaXNjYXJkaW5nIHRob3NlIDw9IHByZXZfbGVuZ3RoLlxuICAgICAqL1xuICAgIHMucHJldl9sZW5ndGggPSBzLm1hdGNoX2xlbmd0aDtcbiAgICBzLnByZXZfbWF0Y2ggPSBzLm1hdGNoX3N0YXJ0O1xuICAgIHMubWF0Y2hfbGVuZ3RoID0gTUlOX01BVENIIC0gMTtcblxuICAgIGlmIChoYXNoX2hlYWQgIT09IDAvKk5JTCovICYmIHMucHJldl9sZW5ndGggPCBzLm1heF9sYXp5X21hdGNoICYmXG4gICAgICAgIHMuc3Ryc3RhcnQgLSBoYXNoX2hlYWQgPD0gKHMud19zaXplIC0gTUlOX0xPT0tBSEVBRCkvKk1BWF9ESVNUKHMpKi8pIHtcbiAgICAgIC8qIFRvIHNpbXBsaWZ5IHRoZSBjb2RlLCB3ZSBwcmV2ZW50IG1hdGNoZXMgd2l0aCB0aGUgc3RyaW5nXG4gICAgICAgKiBvZiB3aW5kb3cgaW5kZXggMCAoaW4gcGFydGljdWxhciB3ZSBoYXZlIHRvIGF2b2lkIGEgbWF0Y2hcbiAgICAgICAqIG9mIHRoZSBzdHJpbmcgd2l0aCBpdHNlbGYgYXQgdGhlIHN0YXJ0IG9mIHRoZSBpbnB1dCBmaWxlKS5cbiAgICAgICAqL1xuICAgICAgcy5tYXRjaF9sZW5ndGggPSBsb25nZXN0X21hdGNoKHMsIGhhc2hfaGVhZCk7XG4gICAgICAvKiBsb25nZXN0X21hdGNoKCkgc2V0cyBtYXRjaF9zdGFydCAqL1xuXG4gICAgICBpZiAocy5tYXRjaF9sZW5ndGggPD0gNSAmJlxuICAgICAgICAgKHMuc3RyYXRlZ3kgPT09IFpfRklMVEVSRUQgfHwgKHMubWF0Y2hfbGVuZ3RoID09PSBNSU5fTUFUQ0ggJiYgcy5zdHJzdGFydCAtIHMubWF0Y2hfc3RhcnQgPiA0MDk2LypUT09fRkFSKi8pKSkge1xuXG4gICAgICAgIC8qIElmIHByZXZfbWF0Y2ggaXMgYWxzbyBNSU5fTUFUQ0gsIG1hdGNoX3N0YXJ0IGlzIGdhcmJhZ2VcbiAgICAgICAgICogYnV0IHdlIHdpbGwgaWdub3JlIHRoZSBjdXJyZW50IG1hdGNoIGFueXdheS5cbiAgICAgICAgICovXG4gICAgICAgIHMubWF0Y2hfbGVuZ3RoID0gTUlOX01BVENIIC0gMTtcbiAgICAgIH1cbiAgICB9XG4gICAgLyogSWYgdGhlcmUgd2FzIGEgbWF0Y2ggYXQgdGhlIHByZXZpb3VzIHN0ZXAgYW5kIHRoZSBjdXJyZW50XG4gICAgICogbWF0Y2ggaXMgbm90IGJldHRlciwgb3V0cHV0IHRoZSBwcmV2aW91cyBtYXRjaDpcbiAgICAgKi9cbiAgICBpZiAocy5wcmV2X2xlbmd0aCA+PSBNSU5fTUFUQ0ggJiYgcy5tYXRjaF9sZW5ndGggPD0gcy5wcmV2X2xlbmd0aCkge1xuICAgICAgbWF4X2luc2VydCA9IHMuc3Ryc3RhcnQgKyBzLmxvb2thaGVhZCAtIE1JTl9NQVRDSDtcbiAgICAgIC8qIERvIG5vdCBpbnNlcnQgc3RyaW5ncyBpbiBoYXNoIHRhYmxlIGJleW9uZCB0aGlzLiAqL1xuXG4gICAgICAvL2NoZWNrX21hdGNoKHMsIHMuc3Ryc3RhcnQtMSwgcy5wcmV2X21hdGNoLCBzLnByZXZfbGVuZ3RoKTtcblxuICAgICAgLyoqKl90cl90YWxseV9kaXN0KHMsIHMuc3Ryc3RhcnQgLSAxIC0gcy5wcmV2X21hdGNoLFxuICAgICAgICAgICAgICAgICAgICAgcy5wcmV2X2xlbmd0aCAtIE1JTl9NQVRDSCwgYmZsdXNoKTsqKiovXG4gICAgICBiZmx1c2ggPSBfdHJfdGFsbHkocywgcy5zdHJzdGFydCAtIDEgLSBzLnByZXZfbWF0Y2gsIHMucHJldl9sZW5ndGggLSBNSU5fTUFUQ0gpO1xuICAgICAgLyogSW5zZXJ0IGluIGhhc2ggdGFibGUgYWxsIHN0cmluZ3MgdXAgdG8gdGhlIGVuZCBvZiB0aGUgbWF0Y2guXG4gICAgICAgKiBzdHJzdGFydC0xIGFuZCBzdHJzdGFydCBhcmUgYWxyZWFkeSBpbnNlcnRlZC4gSWYgdGhlcmUgaXMgbm90XG4gICAgICAgKiBlbm91Z2ggbG9va2FoZWFkLCB0aGUgbGFzdCB0d28gc3RyaW5ncyBhcmUgbm90IGluc2VydGVkIGluXG4gICAgICAgKiB0aGUgaGFzaCB0YWJsZS5cbiAgICAgICAqL1xuICAgICAgcy5sb29rYWhlYWQgLT0gcy5wcmV2X2xlbmd0aCAtIDE7XG4gICAgICBzLnByZXZfbGVuZ3RoIC09IDI7XG4gICAgICBkbyB7XG4gICAgICAgIGlmICgrK3Muc3Ryc3RhcnQgPD0gbWF4X2luc2VydCkge1xuICAgICAgICAgIC8qKiogSU5TRVJUX1NUUklORyhzLCBzLnN0cnN0YXJ0LCBoYXNoX2hlYWQpOyAqKiovXG4gICAgICAgICAgcy5pbnNfaCA9IEhBU0gocywgcy5pbnNfaCwgcy53aW5kb3dbcy5zdHJzdGFydCArIE1JTl9NQVRDSCAtIDFdKTtcbiAgICAgICAgICBoYXNoX2hlYWQgPSBzLnByZXZbcy5zdHJzdGFydCAmIHMud19tYXNrXSA9IHMuaGVhZFtzLmluc19oXTtcbiAgICAgICAgICBzLmhlYWRbcy5pbnNfaF0gPSBzLnN0cnN0YXJ0O1xuICAgICAgICAgIC8qKiovXG4gICAgICAgIH1cbiAgICAgIH0gd2hpbGUgKC0tcy5wcmV2X2xlbmd0aCAhPT0gMCk7XG4gICAgICBzLm1hdGNoX2F2YWlsYWJsZSA9IDA7XG4gICAgICBzLm1hdGNoX2xlbmd0aCA9IE1JTl9NQVRDSCAtIDE7XG4gICAgICBzLnN0cnN0YXJ0Kys7XG5cbiAgICAgIGlmIChiZmx1c2gpIHtcbiAgICAgICAgLyoqKiBGTFVTSF9CTE9DSyhzLCAwKTsgKioqL1xuICAgICAgICBmbHVzaF9ibG9ja19vbmx5KHMsIGZhbHNlKTtcbiAgICAgICAgaWYgKHMuc3RybS5hdmFpbF9vdXQgPT09IDApIHtcbiAgICAgICAgICByZXR1cm4gQlNfTkVFRF9NT1JFO1xuICAgICAgICB9XG4gICAgICAgIC8qKiovXG4gICAgICB9XG5cbiAgICB9IGVsc2UgaWYgKHMubWF0Y2hfYXZhaWxhYmxlKSB7XG4gICAgICAvKiBJZiB0aGVyZSB3YXMgbm8gbWF0Y2ggYXQgdGhlIHByZXZpb3VzIHBvc2l0aW9uLCBvdXRwdXQgYVxuICAgICAgICogc2luZ2xlIGxpdGVyYWwuIElmIHRoZXJlIHdhcyBhIG1hdGNoIGJ1dCB0aGUgY3VycmVudCBtYXRjaFxuICAgICAgICogaXMgbG9uZ2VyLCB0cnVuY2F0ZSB0aGUgcHJldmlvdXMgbWF0Y2ggdG8gYSBzaW5nbGUgbGl0ZXJhbC5cbiAgICAgICAqL1xuICAgICAgLy9UcmFjZXZ2KChzdGRlcnIsXCIlY1wiLCBzLT53aW5kb3dbcy0+c3Ryc3RhcnQtMV0pKTtcbiAgICAgIC8qKiogX3RyX3RhbGx5X2xpdChzLCBzLndpbmRvd1tzLnN0cnN0YXJ0LTFdLCBiZmx1c2gpOyAqKiovXG4gICAgICBiZmx1c2ggPSBfdHJfdGFsbHkocywgMCwgcy53aW5kb3dbcy5zdHJzdGFydCAtIDFdKTtcblxuICAgICAgaWYgKGJmbHVzaCkge1xuICAgICAgICAvKioqIEZMVVNIX0JMT0NLX09OTFkocywgMCkgKioqL1xuICAgICAgICBmbHVzaF9ibG9ja19vbmx5KHMsIGZhbHNlKTtcbiAgICAgICAgLyoqKi9cbiAgICAgIH1cbiAgICAgIHMuc3Ryc3RhcnQrKztcbiAgICAgIHMubG9va2FoZWFkLS07XG4gICAgICBpZiAocy5zdHJtLmF2YWlsX291dCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gQlNfTkVFRF9NT1JFO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvKiBUaGVyZSBpcyBubyBwcmV2aW91cyBtYXRjaCB0byBjb21wYXJlIHdpdGgsIHdhaXQgZm9yXG4gICAgICAgKiB0aGUgbmV4dCBzdGVwIHRvIGRlY2lkZS5cbiAgICAgICAqL1xuICAgICAgcy5tYXRjaF9hdmFpbGFibGUgPSAxO1xuICAgICAgcy5zdHJzdGFydCsrO1xuICAgICAgcy5sb29rYWhlYWQtLTtcbiAgICB9XG4gIH1cbiAgLy9Bc3NlcnQgKGZsdXNoICE9IFpfTk9fRkxVU0gsIFwibm8gZmx1c2g/XCIpO1xuICBpZiAocy5tYXRjaF9hdmFpbGFibGUpIHtcbiAgICAvL1RyYWNldnYoKHN0ZGVycixcIiVjXCIsIHMtPndpbmRvd1tzLT5zdHJzdGFydC0xXSkpO1xuICAgIC8qKiogX3RyX3RhbGx5X2xpdChzLCBzLndpbmRvd1tzLnN0cnN0YXJ0LTFdLCBiZmx1c2gpOyAqKiovXG4gICAgYmZsdXNoID0gX3RyX3RhbGx5KHMsIDAsIHMud2luZG93W3Muc3Ryc3RhcnQgLSAxXSk7XG5cbiAgICBzLm1hdGNoX2F2YWlsYWJsZSA9IDA7XG4gIH1cbiAgcy5pbnNlcnQgPSBzLnN0cnN0YXJ0IDwgTUlOX01BVENIIC0gMSA/IHMuc3Ryc3RhcnQgOiBNSU5fTUFUQ0ggLSAxO1xuICBpZiAoZmx1c2ggPT09IFpfRklOSVNIJDMpIHtcbiAgICAvKioqIEZMVVNIX0JMT0NLKHMsIDEpOyAqKiovXG4gICAgZmx1c2hfYmxvY2tfb25seShzLCB0cnVlKTtcbiAgICBpZiAocy5zdHJtLmF2YWlsX291dCA9PT0gMCkge1xuICAgICAgcmV0dXJuIEJTX0ZJTklTSF9TVEFSVEVEO1xuICAgIH1cbiAgICAvKioqL1xuICAgIHJldHVybiBCU19GSU5JU0hfRE9ORTtcbiAgfVxuICBpZiAocy5zeW1fbmV4dCkge1xuICAgIC8qKiogRkxVU0hfQkxPQ0socywgMCk7ICoqKi9cbiAgICBmbHVzaF9ibG9ja19vbmx5KHMsIGZhbHNlKTtcbiAgICBpZiAocy5zdHJtLmF2YWlsX291dCA9PT0gMCkge1xuICAgICAgcmV0dXJuIEJTX05FRURfTU9SRTtcbiAgICB9XG4gICAgLyoqKi9cbiAgfVxuXG4gIHJldHVybiBCU19CTE9DS19ET05FO1xufTtcblxuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIEZvciBaX1JMRSwgc2ltcGx5IGxvb2sgZm9yIHJ1bnMgb2YgYnl0ZXMsIGdlbmVyYXRlIG1hdGNoZXMgb25seSBvZiBkaXN0YW5jZVxuICogb25lLiAgRG8gbm90IG1haW50YWluIGEgaGFzaCB0YWJsZS4gIChJdCB3aWxsIGJlIHJlZ2VuZXJhdGVkIGlmIHRoaXMgcnVuIG9mXG4gKiBkZWZsYXRlIHN3aXRjaGVzIGF3YXkgZnJvbSBaX1JMRS4pXG4gKi9cbmNvbnN0IGRlZmxhdGVfcmxlID0gKHMsIGZsdXNoKSA9PiB7XG5cbiAgbGV0IGJmbHVzaDsgICAgICAgICAgICAvKiBzZXQgaWYgY3VycmVudCBibG9jayBtdXN0IGJlIGZsdXNoZWQgKi9cbiAgbGV0IHByZXY7ICAgICAgICAgICAgICAvKiBieXRlIGF0IGRpc3RhbmNlIG9uZSB0byBtYXRjaCAqL1xuICBsZXQgc2Nhbiwgc3RyZW5kOyAgICAgIC8qIHNjYW4gZ29lcyB1cCB0byBzdHJlbmQgZm9yIGxlbmd0aCBvZiBydW4gKi9cblxuICBjb25zdCBfd2luID0gcy53aW5kb3c7XG5cbiAgZm9yICg7Oykge1xuICAgIC8qIE1ha2Ugc3VyZSB0aGF0IHdlIGFsd2F5cyBoYXZlIGVub3VnaCBsb29rYWhlYWQsIGV4Y2VwdFxuICAgICAqIGF0IHRoZSBlbmQgb2YgdGhlIGlucHV0IGZpbGUuIFdlIG5lZWQgTUFYX01BVENIIGJ5dGVzXG4gICAgICogZm9yIHRoZSBsb25nZXN0IHJ1biwgcGx1cyBvbmUgZm9yIHRoZSB1bnJvbGxlZCBsb29wLlxuICAgICAqL1xuICAgIGlmIChzLmxvb2thaGVhZCA8PSBNQVhfTUFUQ0gpIHtcbiAgICAgIGZpbGxfd2luZG93KHMpO1xuICAgICAgaWYgKHMubG9va2FoZWFkIDw9IE1BWF9NQVRDSCAmJiBmbHVzaCA9PT0gWl9OT19GTFVTSCQyKSB7XG4gICAgICAgIHJldHVybiBCU19ORUVEX01PUkU7XG4gICAgICB9XG4gICAgICBpZiAocy5sb29rYWhlYWQgPT09IDApIHsgYnJlYWs7IH0gLyogZmx1c2ggdGhlIGN1cnJlbnQgYmxvY2sgKi9cbiAgICB9XG5cbiAgICAvKiBTZWUgaG93IG1hbnkgdGltZXMgdGhlIHByZXZpb3VzIGJ5dGUgcmVwZWF0cyAqL1xuICAgIHMubWF0Y2hfbGVuZ3RoID0gMDtcbiAgICBpZiAocy5sb29rYWhlYWQgPj0gTUlOX01BVENIICYmIHMuc3Ryc3RhcnQgPiAwKSB7XG4gICAgICBzY2FuID0gcy5zdHJzdGFydCAtIDE7XG4gICAgICBwcmV2ID0gX3dpbltzY2FuXTtcbiAgICAgIGlmIChwcmV2ID09PSBfd2luWysrc2Nhbl0gJiYgcHJldiA9PT0gX3dpblsrK3NjYW5dICYmIHByZXYgPT09IF93aW5bKytzY2FuXSkge1xuICAgICAgICBzdHJlbmQgPSBzLnN0cnN0YXJ0ICsgTUFYX01BVENIO1xuICAgICAgICBkbyB7XG4gICAgICAgICAgLypqc2hpbnQgbm9lbXB0eTpmYWxzZSovXG4gICAgICAgIH0gd2hpbGUgKHByZXYgPT09IF93aW5bKytzY2FuXSAmJiBwcmV2ID09PSBfd2luWysrc2Nhbl0gJiZcbiAgICAgICAgICAgICAgICAgcHJldiA9PT0gX3dpblsrK3NjYW5dICYmIHByZXYgPT09IF93aW5bKytzY2FuXSAmJlxuICAgICAgICAgICAgICAgICBwcmV2ID09PSBfd2luWysrc2Nhbl0gJiYgcHJldiA9PT0gX3dpblsrK3NjYW5dICYmXG4gICAgICAgICAgICAgICAgIHByZXYgPT09IF93aW5bKytzY2FuXSAmJiBwcmV2ID09PSBfd2luWysrc2Nhbl0gJiZcbiAgICAgICAgICAgICAgICAgc2NhbiA8IHN0cmVuZCk7XG4gICAgICAgIHMubWF0Y2hfbGVuZ3RoID0gTUFYX01BVENIIC0gKHN0cmVuZCAtIHNjYW4pO1xuICAgICAgICBpZiAocy5tYXRjaF9sZW5ndGggPiBzLmxvb2thaGVhZCkge1xuICAgICAgICAgIHMubWF0Y2hfbGVuZ3RoID0gcy5sb29rYWhlYWQ7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vQXNzZXJ0KHNjYW4gPD0gcy0+d2luZG93Kyh1SW50KShzLT53aW5kb3dfc2l6ZS0xKSwgXCJ3aWxkIHNjYW5cIik7XG4gICAgfVxuXG4gICAgLyogRW1pdCBtYXRjaCBpZiBoYXZlIHJ1biBvZiBNSU5fTUFUQ0ggb3IgbG9uZ2VyLCBlbHNlIGVtaXQgbGl0ZXJhbCAqL1xuICAgIGlmIChzLm1hdGNoX2xlbmd0aCA+PSBNSU5fTUFUQ0gpIHtcbiAgICAgIC8vY2hlY2tfbWF0Y2gocywgcy5zdHJzdGFydCwgcy5zdHJzdGFydCAtIDEsIHMubWF0Y2hfbGVuZ3RoKTtcblxuICAgICAgLyoqKiBfdHJfdGFsbHlfZGlzdChzLCAxLCBzLm1hdGNoX2xlbmd0aCAtIE1JTl9NQVRDSCwgYmZsdXNoKTsgKioqL1xuICAgICAgYmZsdXNoID0gX3RyX3RhbGx5KHMsIDEsIHMubWF0Y2hfbGVuZ3RoIC0gTUlOX01BVENIKTtcblxuICAgICAgcy5sb29rYWhlYWQgLT0gcy5tYXRjaF9sZW5ndGg7XG4gICAgICBzLnN0cnN0YXJ0ICs9IHMubWF0Y2hfbGVuZ3RoO1xuICAgICAgcy5tYXRjaF9sZW5ndGggPSAwO1xuICAgIH0gZWxzZSB7XG4gICAgICAvKiBObyBtYXRjaCwgb3V0cHV0IGEgbGl0ZXJhbCBieXRlICovXG4gICAgICAvL1RyYWNldnYoKHN0ZGVycixcIiVjXCIsIHMtPndpbmRvd1tzLT5zdHJzdGFydF0pKTtcbiAgICAgIC8qKiogX3RyX3RhbGx5X2xpdChzLCBzLndpbmRvd1tzLnN0cnN0YXJ0XSwgYmZsdXNoKTsgKioqL1xuICAgICAgYmZsdXNoID0gX3RyX3RhbGx5KHMsIDAsIHMud2luZG93W3Muc3Ryc3RhcnRdKTtcblxuICAgICAgcy5sb29rYWhlYWQtLTtcbiAgICAgIHMuc3Ryc3RhcnQrKztcbiAgICB9XG4gICAgaWYgKGJmbHVzaCkge1xuICAgICAgLyoqKiBGTFVTSF9CTE9DSyhzLCAwKTsgKioqL1xuICAgICAgZmx1c2hfYmxvY2tfb25seShzLCBmYWxzZSk7XG4gICAgICBpZiAocy5zdHJtLmF2YWlsX291dCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gQlNfTkVFRF9NT1JFO1xuICAgICAgfVxuICAgICAgLyoqKi9cbiAgICB9XG4gIH1cbiAgcy5pbnNlcnQgPSAwO1xuICBpZiAoZmx1c2ggPT09IFpfRklOSVNIJDMpIHtcbiAgICAvKioqIEZMVVNIX0JMT0NLKHMsIDEpOyAqKiovXG4gICAgZmx1c2hfYmxvY2tfb25seShzLCB0cnVlKTtcbiAgICBpZiAocy5zdHJtLmF2YWlsX291dCA9PT0gMCkge1xuICAgICAgcmV0dXJuIEJTX0ZJTklTSF9TVEFSVEVEO1xuICAgIH1cbiAgICAvKioqL1xuICAgIHJldHVybiBCU19GSU5JU0hfRE9ORTtcbiAgfVxuICBpZiAocy5zeW1fbmV4dCkge1xuICAgIC8qKiogRkxVU0hfQkxPQ0socywgMCk7ICoqKi9cbiAgICBmbHVzaF9ibG9ja19vbmx5KHMsIGZhbHNlKTtcbiAgICBpZiAocy5zdHJtLmF2YWlsX291dCA9PT0gMCkge1xuICAgICAgcmV0dXJuIEJTX05FRURfTU9SRTtcbiAgICB9XG4gICAgLyoqKi9cbiAgfVxuICByZXR1cm4gQlNfQkxPQ0tfRE9ORTtcbn07XG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogRm9yIFpfSFVGRk1BTl9PTkxZLCBkbyBub3QgbG9vayBmb3IgbWF0Y2hlcy4gIERvIG5vdCBtYWludGFpbiBhIGhhc2ggdGFibGUuXG4gKiAoSXQgd2lsbCBiZSByZWdlbmVyYXRlZCBpZiB0aGlzIHJ1biBvZiBkZWZsYXRlIHN3aXRjaGVzIGF3YXkgZnJvbSBIdWZmbWFuLilcbiAqL1xuY29uc3QgZGVmbGF0ZV9odWZmID0gKHMsIGZsdXNoKSA9PiB7XG5cbiAgbGV0IGJmbHVzaDsgICAgICAgICAgICAgLyogc2V0IGlmIGN1cnJlbnQgYmxvY2sgbXVzdCBiZSBmbHVzaGVkICovXG5cbiAgZm9yICg7Oykge1xuICAgIC8qIE1ha2Ugc3VyZSB0aGF0IHdlIGhhdmUgYSBsaXRlcmFsIHRvIHdyaXRlLiAqL1xuICAgIGlmIChzLmxvb2thaGVhZCA9PT0gMCkge1xuICAgICAgZmlsbF93aW5kb3cocyk7XG4gICAgICBpZiAocy5sb29rYWhlYWQgPT09IDApIHtcbiAgICAgICAgaWYgKGZsdXNoID09PSBaX05PX0ZMVVNIJDIpIHtcbiAgICAgICAgICByZXR1cm4gQlNfTkVFRF9NT1JFO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrOyAgICAgIC8qIGZsdXNoIHRoZSBjdXJyZW50IGJsb2NrICovXG4gICAgICB9XG4gICAgfVxuXG4gICAgLyogT3V0cHV0IGEgbGl0ZXJhbCBieXRlICovXG4gICAgcy5tYXRjaF9sZW5ndGggPSAwO1xuICAgIC8vVHJhY2V2digoc3RkZXJyLFwiJWNcIiwgcy0+d2luZG93W3MtPnN0cnN0YXJ0XSkpO1xuICAgIC8qKiogX3RyX3RhbGx5X2xpdChzLCBzLndpbmRvd1tzLnN0cnN0YXJ0XSwgYmZsdXNoKTsgKioqL1xuICAgIGJmbHVzaCA9IF90cl90YWxseShzLCAwLCBzLndpbmRvd1tzLnN0cnN0YXJ0XSk7XG4gICAgcy5sb29rYWhlYWQtLTtcbiAgICBzLnN0cnN0YXJ0Kys7XG4gICAgaWYgKGJmbHVzaCkge1xuICAgICAgLyoqKiBGTFVTSF9CTE9DSyhzLCAwKTsgKioqL1xuICAgICAgZmx1c2hfYmxvY2tfb25seShzLCBmYWxzZSk7XG4gICAgICBpZiAocy5zdHJtLmF2YWlsX291dCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gQlNfTkVFRF9NT1JFO1xuICAgICAgfVxuICAgICAgLyoqKi9cbiAgICB9XG4gIH1cbiAgcy5pbnNlcnQgPSAwO1xuICBpZiAoZmx1c2ggPT09IFpfRklOSVNIJDMpIHtcbiAgICAvKioqIEZMVVNIX0JMT0NLKHMsIDEpOyAqKiovXG4gICAgZmx1c2hfYmxvY2tfb25seShzLCB0cnVlKTtcbiAgICBpZiAocy5zdHJtLmF2YWlsX291dCA9PT0gMCkge1xuICAgICAgcmV0dXJuIEJTX0ZJTklTSF9TVEFSVEVEO1xuICAgIH1cbiAgICAvKioqL1xuICAgIHJldHVybiBCU19GSU5JU0hfRE9ORTtcbiAgfVxuICBpZiAocy5zeW1fbmV4dCkge1xuICAgIC8qKiogRkxVU0hfQkxPQ0socywgMCk7ICoqKi9cbiAgICBmbHVzaF9ibG9ja19vbmx5KHMsIGZhbHNlKTtcbiAgICBpZiAocy5zdHJtLmF2YWlsX291dCA9PT0gMCkge1xuICAgICAgcmV0dXJuIEJTX05FRURfTU9SRTtcbiAgICB9XG4gICAgLyoqKi9cbiAgfVxuICByZXR1cm4gQlNfQkxPQ0tfRE9ORTtcbn07XG5cbi8qIFZhbHVlcyBmb3IgbWF4X2xhenlfbWF0Y2gsIGdvb2RfbWF0Y2ggYW5kIG1heF9jaGFpbl9sZW5ndGgsIGRlcGVuZGluZyBvblxuICogdGhlIGRlc2lyZWQgcGFjayBsZXZlbCAoMC4uOSkuIFRoZSB2YWx1ZXMgZ2l2ZW4gYmVsb3cgaGF2ZSBiZWVuIHR1bmVkIHRvXG4gKiBleGNsdWRlIHdvcnN0IGNhc2UgcGVyZm9ybWFuY2UgZm9yIHBhdGhvbG9naWNhbCBmaWxlcy4gQmV0dGVyIHZhbHVlcyBtYXkgYmVcbiAqIGZvdW5kIGZvciBzcGVjaWZpYyBmaWxlcy5cbiAqL1xuZnVuY3Rpb24gQ29uZmlnKGdvb2RfbGVuZ3RoLCBtYXhfbGF6eSwgbmljZV9sZW5ndGgsIG1heF9jaGFpbiwgZnVuYykge1xuXG4gIHRoaXMuZ29vZF9sZW5ndGggPSBnb29kX2xlbmd0aDtcbiAgdGhpcy5tYXhfbGF6eSA9IG1heF9sYXp5O1xuICB0aGlzLm5pY2VfbGVuZ3RoID0gbmljZV9sZW5ndGg7XG4gIHRoaXMubWF4X2NoYWluID0gbWF4X2NoYWluO1xuICB0aGlzLmZ1bmMgPSBmdW5jO1xufVxuXG5jb25zdCBjb25maWd1cmF0aW9uX3RhYmxlID0gW1xuICAvKiAgICAgIGdvb2QgbGF6eSBuaWNlIGNoYWluICovXG4gIG5ldyBDb25maWcoMCwgMCwgMCwgMCwgZGVmbGF0ZV9zdG9yZWQpLCAgICAgICAgICAvKiAwIHN0b3JlIG9ubHkgKi9cbiAgbmV3IENvbmZpZyg0LCA0LCA4LCA0LCBkZWZsYXRlX2Zhc3QpLCAgICAgICAgICAgIC8qIDEgbWF4IHNwZWVkLCBubyBsYXp5IG1hdGNoZXMgKi9cbiAgbmV3IENvbmZpZyg0LCA1LCAxNiwgOCwgZGVmbGF0ZV9mYXN0KSwgICAgICAgICAgIC8qIDIgKi9cbiAgbmV3IENvbmZpZyg0LCA2LCAzMiwgMzIsIGRlZmxhdGVfZmFzdCksICAgICAgICAgIC8qIDMgKi9cblxuICBuZXcgQ29uZmlnKDQsIDQsIDE2LCAxNiwgZGVmbGF0ZV9zbG93KSwgICAgICAgICAgLyogNCBsYXp5IG1hdGNoZXMgKi9cbiAgbmV3IENvbmZpZyg4LCAxNiwgMzIsIDMyLCBkZWZsYXRlX3Nsb3cpLCAgICAgICAgIC8qIDUgKi9cbiAgbmV3IENvbmZpZyg4LCAxNiwgMTI4LCAxMjgsIGRlZmxhdGVfc2xvdyksICAgICAgIC8qIDYgKi9cbiAgbmV3IENvbmZpZyg4LCAzMiwgMTI4LCAyNTYsIGRlZmxhdGVfc2xvdyksICAgICAgIC8qIDcgKi9cbiAgbmV3IENvbmZpZygzMiwgMTI4LCAyNTgsIDEwMjQsIGRlZmxhdGVfc2xvdyksICAgIC8qIDggKi9cbiAgbmV3IENvbmZpZygzMiwgMjU4LCAyNTgsIDQwOTYsIGRlZmxhdGVfc2xvdykgICAgIC8qIDkgbWF4IGNvbXByZXNzaW9uICovXG5dO1xuXG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogSW5pdGlhbGl6ZSB0aGUgXCJsb25nZXN0IG1hdGNoXCIgcm91dGluZXMgZm9yIGEgbmV3IHpsaWIgc3RyZWFtXG4gKi9cbmNvbnN0IGxtX2luaXQgPSAocykgPT4ge1xuXG4gIHMud2luZG93X3NpemUgPSAyICogcy53X3NpemU7XG5cbiAgLyoqKiBDTEVBUl9IQVNIKHMpOyAqKiovXG4gIHplcm8ocy5oZWFkKTsgLy8gRmlsbCB3aXRoIE5JTCAoPSAwKTtcblxuICAvKiBTZXQgdGhlIGRlZmF1bHQgY29uZmlndXJhdGlvbiBwYXJhbWV0ZXJzOlxuICAgKi9cbiAgcy5tYXhfbGF6eV9tYXRjaCA9IGNvbmZpZ3VyYXRpb25fdGFibGVbcy5sZXZlbF0ubWF4X2xhenk7XG4gIHMuZ29vZF9tYXRjaCA9IGNvbmZpZ3VyYXRpb25fdGFibGVbcy5sZXZlbF0uZ29vZF9sZW5ndGg7XG4gIHMubmljZV9tYXRjaCA9IGNvbmZpZ3VyYXRpb25fdGFibGVbcy5sZXZlbF0ubmljZV9sZW5ndGg7XG4gIHMubWF4X2NoYWluX2xlbmd0aCA9IGNvbmZpZ3VyYXRpb25fdGFibGVbcy5sZXZlbF0ubWF4X2NoYWluO1xuXG4gIHMuc3Ryc3RhcnQgPSAwO1xuICBzLmJsb2NrX3N0YXJ0ID0gMDtcbiAgcy5sb29rYWhlYWQgPSAwO1xuICBzLmluc2VydCA9IDA7XG4gIHMubWF0Y2hfbGVuZ3RoID0gcy5wcmV2X2xlbmd0aCA9IE1JTl9NQVRDSCAtIDE7XG4gIHMubWF0Y2hfYXZhaWxhYmxlID0gMDtcbiAgcy5pbnNfaCA9IDA7XG59O1xuXG5cbmZ1bmN0aW9uIERlZmxhdGVTdGF0ZSgpIHtcbiAgdGhpcy5zdHJtID0gbnVsbDsgICAgICAgICAgICAvKiBwb2ludGVyIGJhY2sgdG8gdGhpcyB6bGliIHN0cmVhbSAqL1xuICB0aGlzLnN0YXR1cyA9IDA7ICAgICAgICAgICAgLyogYXMgdGhlIG5hbWUgaW1wbGllcyAqL1xuICB0aGlzLnBlbmRpbmdfYnVmID0gbnVsbDsgICAgICAvKiBvdXRwdXQgc3RpbGwgcGVuZGluZyAqL1xuICB0aGlzLnBlbmRpbmdfYnVmX3NpemUgPSAwOyAgLyogc2l6ZSBvZiBwZW5kaW5nX2J1ZiAqL1xuICB0aGlzLnBlbmRpbmdfb3V0ID0gMDsgICAgICAgLyogbmV4dCBwZW5kaW5nIGJ5dGUgdG8gb3V0cHV0IHRvIHRoZSBzdHJlYW0gKi9cbiAgdGhpcy5wZW5kaW5nID0gMDsgICAgICAgICAgIC8qIG5iIG9mIGJ5dGVzIGluIHRoZSBwZW5kaW5nIGJ1ZmZlciAqL1xuICB0aGlzLndyYXAgPSAwOyAgICAgICAgICAgICAgLyogYml0IDAgdHJ1ZSBmb3IgemxpYiwgYml0IDEgdHJ1ZSBmb3IgZ3ppcCAqL1xuICB0aGlzLmd6aGVhZCA9IG51bGw7ICAgICAgICAgLyogZ3ppcCBoZWFkZXIgaW5mb3JtYXRpb24gdG8gd3JpdGUgKi9cbiAgdGhpcy5nemluZGV4ID0gMDsgICAgICAgICAgIC8qIHdoZXJlIGluIGV4dHJhLCBuYW1lLCBvciBjb21tZW50ICovXG4gIHRoaXMubWV0aG9kID0gWl9ERUZMQVRFRCQyOyAvKiBjYW4gb25seSBiZSBERUZMQVRFRCAqL1xuICB0aGlzLmxhc3RfZmx1c2ggPSAtMTsgICAvKiB2YWx1ZSBvZiBmbHVzaCBwYXJhbSBmb3IgcHJldmlvdXMgZGVmbGF0ZSBjYWxsICovXG5cbiAgdGhpcy53X3NpemUgPSAwOyAgLyogTFo3NyB3aW5kb3cgc2l6ZSAoMzJLIGJ5IGRlZmF1bHQpICovXG4gIHRoaXMud19iaXRzID0gMDsgIC8qIGxvZzIod19zaXplKSAgKDguLjE2KSAqL1xuICB0aGlzLndfbWFzayA9IDA7ICAvKiB3X3NpemUgLSAxICovXG5cbiAgdGhpcy53aW5kb3cgPSBudWxsO1xuICAvKiBTbGlkaW5nIHdpbmRvdy4gSW5wdXQgYnl0ZXMgYXJlIHJlYWQgaW50byB0aGUgc2Vjb25kIGhhbGYgb2YgdGhlIHdpbmRvdyxcbiAgICogYW5kIG1vdmUgdG8gdGhlIGZpcnN0IGhhbGYgbGF0ZXIgdG8ga2VlcCBhIGRpY3Rpb25hcnkgb2YgYXQgbGVhc3Qgd1NpemVcbiAgICogYnl0ZXMuIFdpdGggdGhpcyBvcmdhbml6YXRpb24sIG1hdGNoZXMgYXJlIGxpbWl0ZWQgdG8gYSBkaXN0YW5jZSBvZlxuICAgKiB3U2l6ZS1NQVhfTUFUQ0ggYnl0ZXMsIGJ1dCB0aGlzIGVuc3VyZXMgdGhhdCBJTyBpcyBhbHdheXNcbiAgICogcGVyZm9ybWVkIHdpdGggYSBsZW5ndGggbXVsdGlwbGUgb2YgdGhlIGJsb2NrIHNpemUuXG4gICAqL1xuXG4gIHRoaXMud2luZG93X3NpemUgPSAwO1xuICAvKiBBY3R1YWwgc2l6ZSBvZiB3aW5kb3c6IDIqd1NpemUsIGV4Y2VwdCB3aGVuIHRoZSB1c2VyIGlucHV0IGJ1ZmZlclxuICAgKiBpcyBkaXJlY3RseSB1c2VkIGFzIHNsaWRpbmcgd2luZG93LlxuICAgKi9cblxuICB0aGlzLnByZXYgPSBudWxsO1xuICAvKiBMaW5rIHRvIG9sZGVyIHN0cmluZyB3aXRoIHNhbWUgaGFzaCBpbmRleC4gVG8gbGltaXQgdGhlIHNpemUgb2YgdGhpc1xuICAgKiBhcnJheSB0byA2NEssIHRoaXMgbGluayBpcyBtYWludGFpbmVkIG9ubHkgZm9yIHRoZSBsYXN0IDMySyBzdHJpbmdzLlxuICAgKiBBbiBpbmRleCBpbiB0aGlzIGFycmF5IGlzIHRodXMgYSB3aW5kb3cgaW5kZXggbW9kdWxvIDMySy5cbiAgICovXG5cbiAgdGhpcy5oZWFkID0gbnVsbDsgICAvKiBIZWFkcyBvZiB0aGUgaGFzaCBjaGFpbnMgb3IgTklMLiAqL1xuXG4gIHRoaXMuaW5zX2ggPSAwOyAgICAgICAvKiBoYXNoIGluZGV4IG9mIHN0cmluZyB0byBiZSBpbnNlcnRlZCAqL1xuICB0aGlzLmhhc2hfc2l6ZSA9IDA7ICAgLyogbnVtYmVyIG9mIGVsZW1lbnRzIGluIGhhc2ggdGFibGUgKi9cbiAgdGhpcy5oYXNoX2JpdHMgPSAwOyAgIC8qIGxvZzIoaGFzaF9zaXplKSAqL1xuICB0aGlzLmhhc2hfbWFzayA9IDA7ICAgLyogaGFzaF9zaXplLTEgKi9cblxuICB0aGlzLmhhc2hfc2hpZnQgPSAwO1xuICAvKiBOdW1iZXIgb2YgYml0cyBieSB3aGljaCBpbnNfaCBtdXN0IGJlIHNoaWZ0ZWQgYXQgZWFjaCBpbnB1dFxuICAgKiBzdGVwLiBJdCBtdXN0IGJlIHN1Y2ggdGhhdCBhZnRlciBNSU5fTUFUQ0ggc3RlcHMsIHRoZSBvbGRlc3RcbiAgICogYnl0ZSBubyBsb25nZXIgdGFrZXMgcGFydCBpbiB0aGUgaGFzaCBrZXksIHRoYXQgaXM6XG4gICAqICAgaGFzaF9zaGlmdCAqIE1JTl9NQVRDSCA+PSBoYXNoX2JpdHNcbiAgICovXG5cbiAgdGhpcy5ibG9ja19zdGFydCA9IDA7XG4gIC8qIFdpbmRvdyBwb3NpdGlvbiBhdCB0aGUgYmVnaW5uaW5nIG9mIHRoZSBjdXJyZW50IG91dHB1dCBibG9jay4gR2V0c1xuICAgKiBuZWdhdGl2ZSB3aGVuIHRoZSB3aW5kb3cgaXMgbW92ZWQgYmFja3dhcmRzLlxuICAgKi9cblxuICB0aGlzLm1hdGNoX2xlbmd0aCA9IDA7ICAgICAgLyogbGVuZ3RoIG9mIGJlc3QgbWF0Y2ggKi9cbiAgdGhpcy5wcmV2X21hdGNoID0gMDsgICAgICAgIC8qIHByZXZpb3VzIG1hdGNoICovXG4gIHRoaXMubWF0Y2hfYXZhaWxhYmxlID0gMDsgICAvKiBzZXQgaWYgcHJldmlvdXMgbWF0Y2ggZXhpc3RzICovXG4gIHRoaXMuc3Ryc3RhcnQgPSAwOyAgICAgICAgICAvKiBzdGFydCBvZiBzdHJpbmcgdG8gaW5zZXJ0ICovXG4gIHRoaXMubWF0Y2hfc3RhcnQgPSAwOyAgICAgICAvKiBzdGFydCBvZiBtYXRjaGluZyBzdHJpbmcgKi9cbiAgdGhpcy5sb29rYWhlYWQgPSAwOyAgICAgICAgIC8qIG51bWJlciBvZiB2YWxpZCBieXRlcyBhaGVhZCBpbiB3aW5kb3cgKi9cblxuICB0aGlzLnByZXZfbGVuZ3RoID0gMDtcbiAgLyogTGVuZ3RoIG9mIHRoZSBiZXN0IG1hdGNoIGF0IHByZXZpb3VzIHN0ZXAuIE1hdGNoZXMgbm90IGdyZWF0ZXIgdGhhbiB0aGlzXG4gICAqIGFyZSBkaXNjYXJkZWQuIFRoaXMgaXMgdXNlZCBpbiB0aGUgbGF6eSBtYXRjaCBldmFsdWF0aW9uLlxuICAgKi9cblxuICB0aGlzLm1heF9jaGFpbl9sZW5ndGggPSAwO1xuICAvKiBUbyBzcGVlZCB1cCBkZWZsYXRpb24sIGhhc2ggY2hhaW5zIGFyZSBuZXZlciBzZWFyY2hlZCBiZXlvbmQgdGhpc1xuICAgKiBsZW5ndGguICBBIGhpZ2hlciBsaW1pdCBpbXByb3ZlcyBjb21wcmVzc2lvbiByYXRpbyBidXQgZGVncmFkZXMgdGhlXG4gICAqIHNwZWVkLlxuICAgKi9cblxuICB0aGlzLm1heF9sYXp5X21hdGNoID0gMDtcbiAgLyogQXR0ZW1wdCB0byBmaW5kIGEgYmV0dGVyIG1hdGNoIG9ubHkgd2hlbiB0aGUgY3VycmVudCBtYXRjaCBpcyBzdHJpY3RseVxuICAgKiBzbWFsbGVyIHRoYW4gdGhpcyB2YWx1ZS4gVGhpcyBtZWNoYW5pc20gaXMgdXNlZCBvbmx5IGZvciBjb21wcmVzc2lvblxuICAgKiBsZXZlbHMgPj0gNC5cbiAgICovXG4gIC8vIFRoYXQncyBhbGlhcyB0byBtYXhfbGF6eV9tYXRjaCwgZG9uJ3QgdXNlIGRpcmVjdGx5XG4gIC8vdGhpcy5tYXhfaW5zZXJ0X2xlbmd0aCA9IDA7XG4gIC8qIEluc2VydCBuZXcgc3RyaW5ncyBpbiB0aGUgaGFzaCB0YWJsZSBvbmx5IGlmIHRoZSBtYXRjaCBsZW5ndGggaXMgbm90XG4gICAqIGdyZWF0ZXIgdGhhbiB0aGlzIGxlbmd0aC4gVGhpcyBzYXZlcyB0aW1lIGJ1dCBkZWdyYWRlcyBjb21wcmVzc2lvbi5cbiAgICogbWF4X2luc2VydF9sZW5ndGggaXMgdXNlZCBvbmx5IGZvciBjb21wcmVzc2lvbiBsZXZlbHMgPD0gMy5cbiAgICovXG5cbiAgdGhpcy5sZXZlbCA9IDA7ICAgICAvKiBjb21wcmVzc2lvbiBsZXZlbCAoMS4uOSkgKi9cbiAgdGhpcy5zdHJhdGVneSA9IDA7ICAvKiBmYXZvciBvciBmb3JjZSBIdWZmbWFuIGNvZGluZyovXG5cbiAgdGhpcy5nb29kX21hdGNoID0gMDtcbiAgLyogVXNlIGEgZmFzdGVyIHNlYXJjaCB3aGVuIHRoZSBwcmV2aW91cyBtYXRjaCBpcyBsb25nZXIgdGhhbiB0aGlzICovXG5cbiAgdGhpcy5uaWNlX21hdGNoID0gMDsgLyogU3RvcCBzZWFyY2hpbmcgd2hlbiBjdXJyZW50IG1hdGNoIGV4Y2VlZHMgdGhpcyAqL1xuXG4gICAgICAgICAgICAgIC8qIHVzZWQgYnkgdHJlZXMuYzogKi9cblxuICAvKiBEaWRuJ3QgdXNlIGN0X2RhdGEgdHlwZWRlZiBiZWxvdyB0byBzdXBwcmVzcyBjb21waWxlciB3YXJuaW5nICovXG5cbiAgLy8gc3RydWN0IGN0X2RhdGFfcyBkeW5fbHRyZWVbSEVBUF9TSVpFXTsgICAvKiBsaXRlcmFsIGFuZCBsZW5ndGggdHJlZSAqL1xuICAvLyBzdHJ1Y3QgY3RfZGF0YV9zIGR5bl9kdHJlZVsyKkRfQ09ERVMrMV07IC8qIGRpc3RhbmNlIHRyZWUgKi9cbiAgLy8gc3RydWN0IGN0X2RhdGFfcyBibF90cmVlWzIqQkxfQ09ERVMrMV07ICAvKiBIdWZmbWFuIHRyZWUgZm9yIGJpdCBsZW5ndGhzICovXG5cbiAgLy8gVXNlIGZsYXQgYXJyYXkgb2YgRE9VQkxFIHNpemUsIHdpdGggaW50ZXJsZWF2ZWQgZmF0YSxcbiAgLy8gYmVjYXVzZSBKUyBkb2VzIG5vdCBzdXBwb3J0IGVmZmVjdGl2ZVxuICB0aGlzLmR5bl9sdHJlZSAgPSBuZXcgVWludDE2QXJyYXkoSEVBUF9TSVpFICogMik7XG4gIHRoaXMuZHluX2R0cmVlICA9IG5ldyBVaW50MTZBcnJheSgoMiAqIERfQ09ERVMgKyAxKSAqIDIpO1xuICB0aGlzLmJsX3RyZWUgICAgPSBuZXcgVWludDE2QXJyYXkoKDIgKiBCTF9DT0RFUyArIDEpICogMik7XG4gIHplcm8odGhpcy5keW5fbHRyZWUpO1xuICB6ZXJvKHRoaXMuZHluX2R0cmVlKTtcbiAgemVybyh0aGlzLmJsX3RyZWUpO1xuXG4gIHRoaXMubF9kZXNjICAgPSBudWxsOyAgICAgICAgIC8qIGRlc2MuIGZvciBsaXRlcmFsIHRyZWUgKi9cbiAgdGhpcy5kX2Rlc2MgICA9IG51bGw7ICAgICAgICAgLyogZGVzYy4gZm9yIGRpc3RhbmNlIHRyZWUgKi9cbiAgdGhpcy5ibF9kZXNjICA9IG51bGw7ICAgICAgICAgLyogZGVzYy4gZm9yIGJpdCBsZW5ndGggdHJlZSAqL1xuXG4gIC8vdXNoIGJsX2NvdW50W01BWF9CSVRTKzFdO1xuICB0aGlzLmJsX2NvdW50ID0gbmV3IFVpbnQxNkFycmF5KE1BWF9CSVRTICsgMSk7XG4gIC8qIG51bWJlciBvZiBjb2RlcyBhdCBlYWNoIGJpdCBsZW5ndGggZm9yIGFuIG9wdGltYWwgdHJlZSAqL1xuXG4gIC8vaW50IGhlYXBbMipMX0NPREVTKzFdOyAgICAgIC8qIGhlYXAgdXNlZCB0byBidWlsZCB0aGUgSHVmZm1hbiB0cmVlcyAqL1xuICB0aGlzLmhlYXAgPSBuZXcgVWludDE2QXJyYXkoMiAqIExfQ09ERVMgKyAxKTsgIC8qIGhlYXAgdXNlZCB0byBidWlsZCB0aGUgSHVmZm1hbiB0cmVlcyAqL1xuICB6ZXJvKHRoaXMuaGVhcCk7XG5cbiAgdGhpcy5oZWFwX2xlbiA9IDA7ICAgICAgICAgICAgICAgLyogbnVtYmVyIG9mIGVsZW1lbnRzIGluIHRoZSBoZWFwICovXG4gIHRoaXMuaGVhcF9tYXggPSAwOyAgICAgICAgICAgICAgIC8qIGVsZW1lbnQgb2YgbGFyZ2VzdCBmcmVxdWVuY3kgKi9cbiAgLyogVGhlIHNvbnMgb2YgaGVhcFtuXSBhcmUgaGVhcFsyKm5dIGFuZCBoZWFwWzIqbisxXS4gaGVhcFswXSBpcyBub3QgdXNlZC5cbiAgICogVGhlIHNhbWUgaGVhcCBhcnJheSBpcyB1c2VkIHRvIGJ1aWxkIGFsbCB0cmVlcy5cbiAgICovXG5cbiAgdGhpcy5kZXB0aCA9IG5ldyBVaW50MTZBcnJheSgyICogTF9DT0RFUyArIDEpOyAvL3VjaCBkZXB0aFsyKkxfQ09ERVMrMV07XG4gIHplcm8odGhpcy5kZXB0aCk7XG4gIC8qIERlcHRoIG9mIGVhY2ggc3VidHJlZSB1c2VkIGFzIHRpZSBicmVha2VyIGZvciB0cmVlcyBvZiBlcXVhbCBmcmVxdWVuY3lcbiAgICovXG5cbiAgdGhpcy5zeW1fYnVmID0gMDsgICAgICAgIC8qIGJ1ZmZlciBmb3IgZGlzdGFuY2VzIGFuZCBsaXRlcmFscy9sZW5ndGhzICovXG5cbiAgdGhpcy5saXRfYnVmc2l6ZSA9IDA7XG4gIC8qIFNpemUgb2YgbWF0Y2ggYnVmZmVyIGZvciBsaXRlcmFscy9sZW5ndGhzLiAgVGhlcmUgYXJlIDQgcmVhc29ucyBmb3JcbiAgICogbGltaXRpbmcgbGl0X2J1ZnNpemUgdG8gNjRLOlxuICAgKiAgIC0gZnJlcXVlbmNpZXMgY2FuIGJlIGtlcHQgaW4gMTYgYml0IGNvdW50ZXJzXG4gICAqICAgLSBpZiBjb21wcmVzc2lvbiBpcyBub3Qgc3VjY2Vzc2Z1bCBmb3IgdGhlIGZpcnN0IGJsb2NrLCBhbGwgaW5wdXRcbiAgICogICAgIGRhdGEgaXMgc3RpbGwgaW4gdGhlIHdpbmRvdyBzbyB3ZSBjYW4gc3RpbGwgZW1pdCBhIHN0b3JlZCBibG9jayBldmVuXG4gICAqICAgICB3aGVuIGlucHV0IGNvbWVzIGZyb20gc3RhbmRhcmQgaW5wdXQuICAoVGhpcyBjYW4gYWxzbyBiZSBkb25lIGZvclxuICAgKiAgICAgYWxsIGJsb2NrcyBpZiBsaXRfYnVmc2l6ZSBpcyBub3QgZ3JlYXRlciB0aGFuIDMySy4pXG4gICAqICAgLSBpZiBjb21wcmVzc2lvbiBpcyBub3Qgc3VjY2Vzc2Z1bCBmb3IgYSBmaWxlIHNtYWxsZXIgdGhhbiA2NEssIHdlIGNhblxuICAgKiAgICAgZXZlbiBlbWl0IGEgc3RvcmVkIGZpbGUgaW5zdGVhZCBvZiBhIHN0b3JlZCBibG9jayAoc2F2aW5nIDUgYnl0ZXMpLlxuICAgKiAgICAgVGhpcyBpcyBhcHBsaWNhYmxlIG9ubHkgZm9yIHppcCAobm90IGd6aXAgb3IgemxpYikuXG4gICAqICAgLSBjcmVhdGluZyBuZXcgSHVmZm1hbiB0cmVlcyBsZXNzIGZyZXF1ZW50bHkgbWF5IG5vdCBwcm92aWRlIGZhc3RcbiAgICogICAgIGFkYXB0YXRpb24gdG8gY2hhbmdlcyBpbiB0aGUgaW5wdXQgZGF0YSBzdGF0aXN0aWNzLiAoVGFrZSBmb3JcbiAgICogICAgIGV4YW1wbGUgYSBiaW5hcnkgZmlsZSB3aXRoIHBvb3JseSBjb21wcmVzc2libGUgY29kZSBmb2xsb3dlZCBieVxuICAgKiAgICAgYSBoaWdobHkgY29tcHJlc3NpYmxlIHN0cmluZyB0YWJsZS4pIFNtYWxsZXIgYnVmZmVyIHNpemVzIGdpdmVcbiAgICogICAgIGZhc3QgYWRhcHRhdGlvbiBidXQgaGF2ZSBvZiBjb3Vyc2UgdGhlIG92ZXJoZWFkIG9mIHRyYW5zbWl0dGluZ1xuICAgKiAgICAgdHJlZXMgbW9yZSBmcmVxdWVudGx5LlxuICAgKiAgIC0gSSBjYW4ndCBjb3VudCBhYm92ZSA0XG4gICAqL1xuXG4gIHRoaXMuc3ltX25leHQgPSAwOyAgICAgIC8qIHJ1bm5pbmcgaW5kZXggaW4gc3ltX2J1ZiAqL1xuICB0aGlzLnN5bV9lbmQgPSAwOyAgICAgICAvKiBzeW1ib2wgdGFibGUgZnVsbCB3aGVuIHN5bV9uZXh0IHJlYWNoZXMgdGhpcyAqL1xuXG4gIHRoaXMub3B0X2xlbiA9IDA7ICAgICAgIC8qIGJpdCBsZW5ndGggb2YgY3VycmVudCBibG9jayB3aXRoIG9wdGltYWwgdHJlZXMgKi9cbiAgdGhpcy5zdGF0aWNfbGVuID0gMDsgICAgLyogYml0IGxlbmd0aCBvZiBjdXJyZW50IGJsb2NrIHdpdGggc3RhdGljIHRyZWVzICovXG4gIHRoaXMubWF0Y2hlcyA9IDA7ICAgICAgIC8qIG51bWJlciBvZiBzdHJpbmcgbWF0Y2hlcyBpbiBjdXJyZW50IGJsb2NrICovXG4gIHRoaXMuaW5zZXJ0ID0gMDsgICAgICAgIC8qIGJ5dGVzIGF0IGVuZCBvZiB3aW5kb3cgbGVmdCB0byBpbnNlcnQgKi9cblxuXG4gIHRoaXMuYmlfYnVmID0gMDtcbiAgLyogT3V0cHV0IGJ1ZmZlci4gYml0cyBhcmUgaW5zZXJ0ZWQgc3RhcnRpbmcgYXQgdGhlIGJvdHRvbSAobGVhc3RcbiAgICogc2lnbmlmaWNhbnQgYml0cykuXG4gICAqL1xuICB0aGlzLmJpX3ZhbGlkID0gMDtcbiAgLyogTnVtYmVyIG9mIHZhbGlkIGJpdHMgaW4gYmlfYnVmLiAgQWxsIGJpdHMgYWJvdmUgdGhlIGxhc3QgdmFsaWQgYml0XG4gICAqIGFyZSBhbHdheXMgemVyby5cbiAgICovXG5cbiAgLy8gVXNlZCBmb3Igd2luZG93IG1lbW9yeSBpbml0LiBXZSBzYWZlbHkgaWdub3JlIGl0IGZvciBKUy4gVGhhdCBtYWtlc1xuICAvLyBzZW5zZSBvbmx5IGZvciBwb2ludGVycyBhbmQgbWVtb3J5IGNoZWNrIHRvb2xzLlxuICAvL3RoaXMuaGlnaF93YXRlciA9IDA7XG4gIC8qIEhpZ2ggd2F0ZXIgbWFyayBvZmZzZXQgaW4gd2luZG93IGZvciBpbml0aWFsaXplZCBieXRlcyAtLSBieXRlcyBhYm92ZVxuICAgKiB0aGlzIGFyZSBzZXQgdG8gemVybyBpbiBvcmRlciB0byBhdm9pZCBtZW1vcnkgY2hlY2sgd2FybmluZ3Mgd2hlblxuICAgKiBsb25nZXN0IG1hdGNoIHJvdXRpbmVzIGFjY2VzcyBieXRlcyBwYXN0IHRoZSBpbnB1dC4gIFRoaXMgaXMgdGhlblxuICAgKiB1cGRhdGVkIHRvIHRoZSBuZXcgaGlnaCB3YXRlciBtYXJrLlxuICAgKi9cbn1cblxuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBDaGVjayBmb3IgYSB2YWxpZCBkZWZsYXRlIHN0cmVhbSBzdGF0ZS4gUmV0dXJuIDAgaWYgb2ssIDEgaWYgbm90LlxuICovXG5jb25zdCBkZWZsYXRlU3RhdGVDaGVjayA9IChzdHJtKSA9PiB7XG5cbiAgaWYgKCFzdHJtKSB7XG4gICAgcmV0dXJuIDE7XG4gIH1cbiAgY29uc3QgcyA9IHN0cm0uc3RhdGU7XG4gIGlmICghcyB8fCBzLnN0cm0gIT09IHN0cm0gfHwgKHMuc3RhdHVzICE9PSBJTklUX1NUQVRFICYmXG4vLyNpZmRlZiBHWklQXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHMuc3RhdHVzICE9PSBHWklQX1NUQVRFICYmXG4vLyNlbmRpZlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzLnN0YXR1cyAhPT0gRVhUUkFfU1RBVEUgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcy5zdGF0dXMgIT09IE5BTUVfU1RBVEUgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcy5zdGF0dXMgIT09IENPTU1FTlRfU1RBVEUgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcy5zdGF0dXMgIT09IEhDUkNfU1RBVEUgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcy5zdGF0dXMgIT09IEJVU1lfU1RBVEUgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcy5zdGF0dXMgIT09IEZJTklTSF9TVEFURSkpIHtcbiAgICByZXR1cm4gMTtcbiAgfVxuICByZXR1cm4gMDtcbn07XG5cblxuY29uc3QgZGVmbGF0ZVJlc2V0S2VlcCA9IChzdHJtKSA9PiB7XG5cbiAgaWYgKGRlZmxhdGVTdGF0ZUNoZWNrKHN0cm0pKSB7XG4gICAgcmV0dXJuIGVycihzdHJtLCBaX1NUUkVBTV9FUlJPUiQyKTtcbiAgfVxuXG4gIHN0cm0udG90YWxfaW4gPSBzdHJtLnRvdGFsX291dCA9IDA7XG4gIHN0cm0uZGF0YV90eXBlID0gWl9VTktOT1dOO1xuXG4gIGNvbnN0IHMgPSBzdHJtLnN0YXRlO1xuICBzLnBlbmRpbmcgPSAwO1xuICBzLnBlbmRpbmdfb3V0ID0gMDtcblxuICBpZiAocy53cmFwIDwgMCkge1xuICAgIHMud3JhcCA9IC1zLndyYXA7XG4gICAgLyogd2FzIG1hZGUgbmVnYXRpdmUgYnkgZGVmbGF0ZSguLi4sIFpfRklOSVNIKTsgKi9cbiAgfVxuICBzLnN0YXR1cyA9XG4vLyNpZmRlZiBHWklQXG4gICAgcy53cmFwID09PSAyID8gR1pJUF9TVEFURSA6XG4vLyNlbmRpZlxuICAgIHMud3JhcCA/IElOSVRfU1RBVEUgOiBCVVNZX1NUQVRFO1xuICBzdHJtLmFkbGVyID0gKHMud3JhcCA9PT0gMikgP1xuICAgIDAgIC8vIGNyYzMyKDAsIFpfTlVMTCwgMClcbiAgOlxuICAgIDE7IC8vIGFkbGVyMzIoMCwgWl9OVUxMLCAwKVxuICBzLmxhc3RfZmx1c2ggPSAtMjtcbiAgX3RyX2luaXQocyk7XG4gIHJldHVybiBaX09LJDM7XG59O1xuXG5cbmNvbnN0IGRlZmxhdGVSZXNldCA9IChzdHJtKSA9PiB7XG5cbiAgY29uc3QgcmV0ID0gZGVmbGF0ZVJlc2V0S2VlcChzdHJtKTtcbiAgaWYgKHJldCA9PT0gWl9PSyQzKSB7XG4gICAgbG1faW5pdChzdHJtLnN0YXRlKTtcbiAgfVxuICByZXR1cm4gcmV0O1xufTtcblxuXG5jb25zdCBkZWZsYXRlU2V0SGVhZGVyID0gKHN0cm0sIGhlYWQpID0+IHtcblxuICBpZiAoZGVmbGF0ZVN0YXRlQ2hlY2soc3RybSkgfHwgc3RybS5zdGF0ZS53cmFwICE9PSAyKSB7XG4gICAgcmV0dXJuIFpfU1RSRUFNX0VSUk9SJDI7XG4gIH1cbiAgc3RybS5zdGF0ZS5nemhlYWQgPSBoZWFkO1xuICByZXR1cm4gWl9PSyQzO1xufTtcblxuXG5jb25zdCBkZWZsYXRlSW5pdDIgPSAoc3RybSwgbGV2ZWwsIG1ldGhvZCwgd2luZG93Qml0cywgbWVtTGV2ZWwsIHN0cmF0ZWd5KSA9PiB7XG5cbiAgaWYgKCFzdHJtKSB7IC8vID09PSBaX05VTExcbiAgICByZXR1cm4gWl9TVFJFQU1fRVJST1IkMjtcbiAgfVxuICBsZXQgd3JhcCA9IDE7XG5cbiAgaWYgKGxldmVsID09PSBaX0RFRkFVTFRfQ09NUFJFU1NJT04kMSkge1xuICAgIGxldmVsID0gNjtcbiAgfVxuXG4gIGlmICh3aW5kb3dCaXRzIDwgMCkgeyAvKiBzdXBwcmVzcyB6bGliIHdyYXBwZXIgKi9cbiAgICB3cmFwID0gMDtcbiAgICB3aW5kb3dCaXRzID0gLXdpbmRvd0JpdHM7XG4gIH1cblxuICBlbHNlIGlmICh3aW5kb3dCaXRzID4gMTUpIHtcbiAgICB3cmFwID0gMjsgICAgICAgICAgIC8qIHdyaXRlIGd6aXAgd3JhcHBlciBpbnN0ZWFkICovXG4gICAgd2luZG93Qml0cyAtPSAxNjtcbiAgfVxuXG5cbiAgaWYgKG1lbUxldmVsIDwgMSB8fCBtZW1MZXZlbCA+IE1BWF9NRU1fTEVWRUwgfHwgbWV0aG9kICE9PSBaX0RFRkxBVEVEJDIgfHxcbiAgICB3aW5kb3dCaXRzIDwgOCB8fCB3aW5kb3dCaXRzID4gMTUgfHwgbGV2ZWwgPCAwIHx8IGxldmVsID4gOSB8fFxuICAgIHN0cmF0ZWd5IDwgMCB8fCBzdHJhdGVneSA+IFpfRklYRUQgfHwgKHdpbmRvd0JpdHMgPT09IDggJiYgd3JhcCAhPT0gMSkpIHtcbiAgICByZXR1cm4gZXJyKHN0cm0sIFpfU1RSRUFNX0VSUk9SJDIpO1xuICB9XG5cblxuICBpZiAod2luZG93Qml0cyA9PT0gOCkge1xuICAgIHdpbmRvd0JpdHMgPSA5O1xuICB9XG4gIC8qIHVudGlsIDI1Ni1ieXRlIHdpbmRvdyBidWcgZml4ZWQgKi9cblxuICBjb25zdCBzID0gbmV3IERlZmxhdGVTdGF0ZSgpO1xuXG4gIHN0cm0uc3RhdGUgPSBzO1xuICBzLnN0cm0gPSBzdHJtO1xuICBzLnN0YXR1cyA9IElOSVRfU1RBVEU7ICAgICAvKiB0byBwYXNzIHN0YXRlIHRlc3QgaW4gZGVmbGF0ZVJlc2V0KCkgKi9cblxuICBzLndyYXAgPSB3cmFwO1xuICBzLmd6aGVhZCA9IG51bGw7XG4gIHMud19iaXRzID0gd2luZG93Qml0cztcbiAgcy53X3NpemUgPSAxIDw8IHMud19iaXRzO1xuICBzLndfbWFzayA9IHMud19zaXplIC0gMTtcblxuICBzLmhhc2hfYml0cyA9IG1lbUxldmVsICsgNztcbiAgcy5oYXNoX3NpemUgPSAxIDw8IHMuaGFzaF9iaXRzO1xuICBzLmhhc2hfbWFzayA9IHMuaGFzaF9zaXplIC0gMTtcbiAgcy5oYXNoX3NoaWZ0ID0gfn4oKHMuaGFzaF9iaXRzICsgTUlOX01BVENIIC0gMSkgLyBNSU5fTUFUQ0gpO1xuXG4gIHMud2luZG93ID0gbmV3IFVpbnQ4QXJyYXkocy53X3NpemUgKiAyKTtcbiAgcy5oZWFkID0gbmV3IFVpbnQxNkFycmF5KHMuaGFzaF9zaXplKTtcbiAgcy5wcmV2ID0gbmV3IFVpbnQxNkFycmF5KHMud19zaXplKTtcblxuICAvLyBEb24ndCBuZWVkIG1lbSBpbml0IG1hZ2ljIGZvciBKUy5cbiAgLy9zLmhpZ2hfd2F0ZXIgPSAwOyAgLyogbm90aGluZyB3cml0dGVuIHRvIHMtPndpbmRvdyB5ZXQgKi9cblxuICBzLmxpdF9idWZzaXplID0gMSA8PCAobWVtTGV2ZWwgKyA2KTsgLyogMTZLIGVsZW1lbnRzIGJ5IGRlZmF1bHQgKi9cblxuICAvKiBXZSBvdmVybGF5IHBlbmRpbmdfYnVmIGFuZCBzeW1fYnVmLiBUaGlzIHdvcmtzIHNpbmNlIHRoZSBhdmVyYWdlIHNpemVcbiAgICogZm9yIGxlbmd0aC9kaXN0YW5jZSBwYWlycyBvdmVyIGFueSBjb21wcmVzc2VkIGJsb2NrIGlzIGFzc3VyZWQgdG8gYmUgMzFcbiAgICogYml0cyBvciBsZXNzLlxuICAgKlxuICAgKiBBbmFseXNpczogVGhlIGxvbmdlc3QgZml4ZWQgY29kZXMgYXJlIGEgbGVuZ3RoIGNvZGUgb2YgOCBiaXRzIHBsdXMgNVxuICAgKiBleHRyYSBiaXRzLCBmb3IgbGVuZ3RocyAxMzEgdG8gMjU3LiBUaGUgbG9uZ2VzdCBmaXhlZCBkaXN0YW5jZSBjb2RlcyBhcmVcbiAgICogNSBiaXRzIHBsdXMgMTMgZXh0cmEgYml0cywgZm9yIGRpc3RhbmNlcyAxNjM4NSB0byAzMjc2OC4gVGhlIGxvbmdlc3RcbiAgICogcG9zc2libGUgZml4ZWQtY29kZXMgbGVuZ3RoL2Rpc3RhbmNlIHBhaXIgaXMgdGhlbiAzMSBiaXRzIHRvdGFsLlxuICAgKlxuICAgKiBzeW1fYnVmIHN0YXJ0cyBvbmUtZm91cnRoIG9mIHRoZSB3YXkgaW50byBwZW5kaW5nX2J1Zi4gU28gdGhlcmUgYXJlXG4gICAqIHRocmVlIGJ5dGVzIGluIHN5bV9idWYgZm9yIGV2ZXJ5IGZvdXIgYnl0ZXMgaW4gcGVuZGluZ19idWYuIEVhY2ggc3ltYm9sXG4gICAqIGluIHN5bV9idWYgaXMgdGhyZWUgYnl0ZXMgLS0gdHdvIGZvciB0aGUgZGlzdGFuY2UgYW5kIG9uZSBmb3IgdGhlXG4gICAqIGxpdGVyYWwvbGVuZ3RoLiBBcyBlYWNoIHN5bWJvbCBpcyBjb25zdW1lZCwgdGhlIHBvaW50ZXIgdG8gdGhlIG5leHRcbiAgICogc3ltX2J1ZiB2YWx1ZSB0byByZWFkIG1vdmVzIGZvcndhcmQgdGhyZWUgYnl0ZXMuIEZyb20gdGhhdCBzeW1ib2wsIHVwIHRvXG4gICAqIDMxIGJpdHMgYXJlIHdyaXR0ZW4gdG8gcGVuZGluZ19idWYuIFRoZSBjbG9zZXN0IHRoZSB3cml0dGVuIHBlbmRpbmdfYnVmXG4gICAqIGJpdHMgZ2V0cyB0byB0aGUgbmV4dCBzeW1fYnVmIHN5bWJvbCB0byByZWFkIGlzIGp1c3QgYmVmb3JlIHRoZSBsYXN0XG4gICAqIGNvZGUgaXMgd3JpdHRlbi4gQXQgdGhhdCB0aW1lLCAzMSoobi0yKSBiaXRzIGhhdmUgYmVlbiB3cml0dGVuLCBqdXN0XG4gICAqIGFmdGVyIDI0KihuLTIpIGJpdHMgaGF2ZSBiZWVuIGNvbnN1bWVkIGZyb20gc3ltX2J1Zi4gc3ltX2J1ZiBzdGFydHMgYXRcbiAgICogOCpuIGJpdHMgaW50byBwZW5kaW5nX2J1Zi4gKE5vdGUgdGhhdCB0aGUgc3ltYm9sIGJ1ZmZlciBmaWxscyB3aGVuIG4tMVxuICAgKiBzeW1ib2xzIGFyZSB3cml0dGVuLikgVGhlIGNsb3Nlc3QgdGhlIHdyaXRpbmcgZ2V0cyB0byB3aGF0IGlzIHVucmVhZCBpc1xuICAgKiB0aGVuIG4rMTQgYml0cy4gSGVyZSBuIGlzIGxpdF9idWZzaXplLCB3aGljaCBpcyAxNjM4NCBieSBkZWZhdWx0LCBhbmRcbiAgICogY2FuIHJhbmdlIGZyb20gMTI4IHRvIDMyNzY4LlxuICAgKlxuICAgKiBUaGVyZWZvcmUsIGF0IGEgbWluaW11bSwgdGhlcmUgYXJlIDE0MiBiaXRzIG9mIHNwYWNlIGJldHdlZW4gd2hhdCBpc1xuICAgKiB3cml0dGVuIGFuZCB3aGF0IGlzIHJlYWQgaW4gdGhlIG92ZXJsYWluIGJ1ZmZlcnMsIHNvIHRoZSBzeW1ib2xzIGNhbm5vdFxuICAgKiBiZSBvdmVyd3JpdHRlbiBieSB0aGUgY29tcHJlc3NlZCBkYXRhLiBUaGF0IHNwYWNlIGlzIGFjdHVhbGx5IDEzOSBiaXRzLFxuICAgKiBkdWUgdG8gdGhlIHRocmVlLWJpdCBmaXhlZC1jb2RlIGJsb2NrIGhlYWRlci5cbiAgICpcbiAgICogVGhhdCBjb3ZlcnMgdGhlIGNhc2Ugd2hlcmUgZWl0aGVyIFpfRklYRUQgaXMgc3BlY2lmaWVkLCBmb3JjaW5nIGZpeGVkXG4gICAqIGNvZGVzLCBvciB3aGVuIHRoZSB1c2Ugb2YgZml4ZWQgY29kZXMgaXMgY2hvc2VuLCBiZWNhdXNlIHRoYXQgY2hvaWNlXG4gICAqIHJlc3VsdHMgaW4gYSBzbWFsbGVyIGNvbXByZXNzZWQgYmxvY2sgdGhhbiBkeW5hbWljIGNvZGVzLiBUaGF0IGxhdHRlclxuICAgKiBjb25kaXRpb24gdGhlbiBhc3N1cmVzIHRoYXQgdGhlIGFib3ZlIGFuYWx5c2lzIGFsc28gY292ZXJzIGFsbCBkeW5hbWljXG4gICAqIGJsb2Nrcy4gQSBkeW5hbWljLWNvZGUgYmxvY2sgd2lsbCBvbmx5IGJlIGNob3NlbiB0byBiZSBlbWl0dGVkIGlmIGl0IGhhc1xuICAgKiBmZXdlciBiaXRzIHRoYW4gYSBmaXhlZC1jb2RlIGJsb2NrIHdvdWxkIGZvciB0aGUgc2FtZSBzZXQgb2Ygc3ltYm9scy5cbiAgICogVGhlcmVmb3JlIGl0cyBhdmVyYWdlIHN5bWJvbCBsZW5ndGggaXMgYXNzdXJlZCB0byBiZSBsZXNzIHRoYW4gMzEuIFNvXG4gICAqIHRoZSBjb21wcmVzc2VkIGRhdGEgZm9yIGEgZHluYW1pYyBibG9jayBhbHNvIGNhbm5vdCBvdmVyd3JpdGUgdGhlXG4gICAqIHN5bWJvbHMgZnJvbSB3aGljaCBpdCBpcyBiZWluZyBjb25zdHJ1Y3RlZC5cbiAgICovXG5cbiAgcy5wZW5kaW5nX2J1Zl9zaXplID0gcy5saXRfYnVmc2l6ZSAqIDQ7XG4gIHMucGVuZGluZ19idWYgPSBuZXcgVWludDhBcnJheShzLnBlbmRpbmdfYnVmX3NpemUpO1xuXG4gIC8vIEl0IGlzIG9mZnNldCBmcm9tIGBzLnBlbmRpbmdfYnVmYCAoc2l6ZSBpcyBgcy5saXRfYnVmc2l6ZSAqIDJgKVxuICAvL3MtPnN5bV9idWYgPSBzLT5wZW5kaW5nX2J1ZiArIHMtPmxpdF9idWZzaXplO1xuICBzLnN5bV9idWYgPSBzLmxpdF9idWZzaXplO1xuXG4gIC8vcy0+c3ltX2VuZCA9IChzLT5saXRfYnVmc2l6ZSAtIDEpICogMztcbiAgcy5zeW1fZW5kID0gKHMubGl0X2J1ZnNpemUgLSAxKSAqIDM7XG4gIC8qIFdlIGF2b2lkIGVxdWFsaXR5IHdpdGggbGl0X2J1ZnNpemUqMyBiZWNhdXNlIG9mIHdyYXBhcm91bmQgYXQgNjRLXG4gICAqIG9uIDE2IGJpdCBtYWNoaW5lcyBhbmQgYmVjYXVzZSBzdG9yZWQgYmxvY2tzIGFyZSByZXN0cmljdGVkIHRvXG4gICAqIDY0Sy0xIGJ5dGVzLlxuICAgKi9cblxuICBzLmxldmVsID0gbGV2ZWw7XG4gIHMuc3RyYXRlZ3kgPSBzdHJhdGVneTtcbiAgcy5tZXRob2QgPSBtZXRob2Q7XG5cbiAgcmV0dXJuIGRlZmxhdGVSZXNldChzdHJtKTtcbn07XG5cbmNvbnN0IGRlZmxhdGVJbml0ID0gKHN0cm0sIGxldmVsKSA9PiB7XG5cbiAgcmV0dXJuIGRlZmxhdGVJbml0MihzdHJtLCBsZXZlbCwgWl9ERUZMQVRFRCQyLCBNQVhfV0JJVFMkMSwgREVGX01FTV9MRVZFTCwgWl9ERUZBVUxUX1NUUkFURUdZJDEpO1xufTtcblxuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG5jb25zdCBkZWZsYXRlJDIgPSAoc3RybSwgZmx1c2gpID0+IHtcblxuICBpZiAoZGVmbGF0ZVN0YXRlQ2hlY2soc3RybSkgfHwgZmx1c2ggPiBaX0JMT0NLJDEgfHwgZmx1c2ggPCAwKSB7XG4gICAgcmV0dXJuIHN0cm0gPyBlcnIoc3RybSwgWl9TVFJFQU1fRVJST1IkMikgOiBaX1NUUkVBTV9FUlJPUiQyO1xuICB9XG5cbiAgY29uc3QgcyA9IHN0cm0uc3RhdGU7XG5cbiAgaWYgKCFzdHJtLm91dHB1dCB8fFxuICAgICAgKHN0cm0uYXZhaWxfaW4gIT09IDAgJiYgIXN0cm0uaW5wdXQpIHx8XG4gICAgICAocy5zdGF0dXMgPT09IEZJTklTSF9TVEFURSAmJiBmbHVzaCAhPT0gWl9GSU5JU0gkMykpIHtcbiAgICByZXR1cm4gZXJyKHN0cm0sIChzdHJtLmF2YWlsX291dCA9PT0gMCkgPyBaX0JVRl9FUlJPUiQxIDogWl9TVFJFQU1fRVJST1IkMik7XG4gIH1cblxuICBjb25zdCBvbGRfZmx1c2ggPSBzLmxhc3RfZmx1c2g7XG4gIHMubGFzdF9mbHVzaCA9IGZsdXNoO1xuXG4gIC8qIEZsdXNoIGFzIG11Y2ggcGVuZGluZyBvdXRwdXQgYXMgcG9zc2libGUgKi9cbiAgaWYgKHMucGVuZGluZyAhPT0gMCkge1xuICAgIGZsdXNoX3BlbmRpbmcoc3RybSk7XG4gICAgaWYgKHN0cm0uYXZhaWxfb3V0ID09PSAwKSB7XG4gICAgICAvKiBTaW5jZSBhdmFpbF9vdXQgaXMgMCwgZGVmbGF0ZSB3aWxsIGJlIGNhbGxlZCBhZ2FpbiB3aXRoXG4gICAgICAgKiBtb3JlIG91dHB1dCBzcGFjZSwgYnV0IHBvc3NpYmx5IHdpdGggYm90aCBwZW5kaW5nIGFuZFxuICAgICAgICogYXZhaWxfaW4gZXF1YWwgdG8gemVyby4gVGhlcmUgd29uJ3QgYmUgYW55dGhpbmcgdG8gZG8sXG4gICAgICAgKiBidXQgdGhpcyBpcyBub3QgYW4gZXJyb3Igc2l0dWF0aW9uIHNvIG1ha2Ugc3VyZSB3ZVxuICAgICAgICogcmV0dXJuIE9LIGluc3RlYWQgb2YgQlVGX0VSUk9SIGF0IG5leHQgY2FsbCBvZiBkZWZsYXRlOlxuICAgICAgICovXG4gICAgICBzLmxhc3RfZmx1c2ggPSAtMTtcbiAgICAgIHJldHVybiBaX09LJDM7XG4gICAgfVxuXG4gICAgLyogTWFrZSBzdXJlIHRoZXJlIGlzIHNvbWV0aGluZyB0byBkbyBhbmQgYXZvaWQgZHVwbGljYXRlIGNvbnNlY3V0aXZlXG4gICAgICogZmx1c2hlcy4gRm9yIHJlcGVhdGVkIGFuZCB1c2VsZXNzIGNhbGxzIHdpdGggWl9GSU5JU0gsIHdlIGtlZXBcbiAgICAgKiByZXR1cm5pbmcgWl9TVFJFQU1fRU5EIGluc3RlYWQgb2YgWl9CVUZfRVJST1IuXG4gICAgICovXG4gIH0gZWxzZSBpZiAoc3RybS5hdmFpbF9pbiA9PT0gMCAmJiByYW5rKGZsdXNoKSA8PSByYW5rKG9sZF9mbHVzaCkgJiZcbiAgICBmbHVzaCAhPT0gWl9GSU5JU0gkMykge1xuICAgIHJldHVybiBlcnIoc3RybSwgWl9CVUZfRVJST1IkMSk7XG4gIH1cblxuICAvKiBVc2VyIG11c3Qgbm90IHByb3ZpZGUgbW9yZSBpbnB1dCBhZnRlciB0aGUgZmlyc3QgRklOSVNIOiAqL1xuICBpZiAocy5zdGF0dXMgPT09IEZJTklTSF9TVEFURSAmJiBzdHJtLmF2YWlsX2luICE9PSAwKSB7XG4gICAgcmV0dXJuIGVycihzdHJtLCBaX0JVRl9FUlJPUiQxKTtcbiAgfVxuXG4gIC8qIFdyaXRlIHRoZSBoZWFkZXIgKi9cbiAgaWYgKHMuc3RhdHVzID09PSBJTklUX1NUQVRFICYmIHMud3JhcCA9PT0gMCkge1xuICAgIHMuc3RhdHVzID0gQlVTWV9TVEFURTtcbiAgfVxuICBpZiAocy5zdGF0dXMgPT09IElOSVRfU1RBVEUpIHtcbiAgICAvKiB6bGliIGhlYWRlciAqL1xuICAgIGxldCBoZWFkZXIgPSAoWl9ERUZMQVRFRCQyICsgKChzLndfYml0cyAtIDgpIDw8IDQpKSA8PCA4O1xuICAgIGxldCBsZXZlbF9mbGFncyA9IC0xO1xuXG4gICAgaWYgKHMuc3RyYXRlZ3kgPj0gWl9IVUZGTUFOX09OTFkgfHwgcy5sZXZlbCA8IDIpIHtcbiAgICAgIGxldmVsX2ZsYWdzID0gMDtcbiAgICB9IGVsc2UgaWYgKHMubGV2ZWwgPCA2KSB7XG4gICAgICBsZXZlbF9mbGFncyA9IDE7XG4gICAgfSBlbHNlIGlmIChzLmxldmVsID09PSA2KSB7XG4gICAgICBsZXZlbF9mbGFncyA9IDI7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldmVsX2ZsYWdzID0gMztcbiAgICB9XG4gICAgaGVhZGVyIHw9IChsZXZlbF9mbGFncyA8PCA2KTtcbiAgICBpZiAocy5zdHJzdGFydCAhPT0gMCkgeyBoZWFkZXIgfD0gUFJFU0VUX0RJQ1Q7IH1cbiAgICBoZWFkZXIgKz0gMzEgLSAoaGVhZGVyICUgMzEpO1xuXG4gICAgcHV0U2hvcnRNU0IocywgaGVhZGVyKTtcblxuICAgIC8qIFNhdmUgdGhlIGFkbGVyMzIgb2YgdGhlIHByZXNldCBkaWN0aW9uYXJ5OiAqL1xuICAgIGlmIChzLnN0cnN0YXJ0ICE9PSAwKSB7XG4gICAgICBwdXRTaG9ydE1TQihzLCBzdHJtLmFkbGVyID4+PiAxNik7XG4gICAgICBwdXRTaG9ydE1TQihzLCBzdHJtLmFkbGVyICYgMHhmZmZmKTtcbiAgICB9XG4gICAgc3RybS5hZGxlciA9IDE7IC8vIGFkbGVyMzIoMEwsIFpfTlVMTCwgMCk7XG4gICAgcy5zdGF0dXMgPSBCVVNZX1NUQVRFO1xuXG4gICAgLyogQ29tcHJlc3Npb24gbXVzdCBzdGFydCB3aXRoIGFuIGVtcHR5IHBlbmRpbmcgYnVmZmVyICovXG4gICAgZmx1c2hfcGVuZGluZyhzdHJtKTtcbiAgICBpZiAocy5wZW5kaW5nICE9PSAwKSB7XG4gICAgICBzLmxhc3RfZmx1c2ggPSAtMTtcbiAgICAgIHJldHVybiBaX09LJDM7XG4gICAgfVxuICB9XG4vLyNpZmRlZiBHWklQXG4gIGlmIChzLnN0YXR1cyA9PT0gR1pJUF9TVEFURSkge1xuICAgIC8qIGd6aXAgaGVhZGVyICovXG4gICAgc3RybS5hZGxlciA9IDA7ICAvL2NyYzMyKDBMLCBaX05VTEwsIDApO1xuICAgIHB1dF9ieXRlKHMsIDMxKTtcbiAgICBwdXRfYnl0ZShzLCAxMzkpO1xuICAgIHB1dF9ieXRlKHMsIDgpO1xuICAgIGlmICghcy5nemhlYWQpIHsgLy8gcy0+Z3poZWFkID09IFpfTlVMTFxuICAgICAgcHV0X2J5dGUocywgMCk7XG4gICAgICBwdXRfYnl0ZShzLCAwKTtcbiAgICAgIHB1dF9ieXRlKHMsIDApO1xuICAgICAgcHV0X2J5dGUocywgMCk7XG4gICAgICBwdXRfYnl0ZShzLCAwKTtcbiAgICAgIHB1dF9ieXRlKHMsIHMubGV2ZWwgPT09IDkgPyAyIDpcbiAgICAgICAgICAgICAgICAgIChzLnN0cmF0ZWd5ID49IFpfSFVGRk1BTl9PTkxZIHx8IHMubGV2ZWwgPCAyID9cbiAgICAgICAgICAgICAgICAgICA0IDogMCkpO1xuICAgICAgcHV0X2J5dGUocywgT1NfQ09ERSk7XG4gICAgICBzLnN0YXR1cyA9IEJVU1lfU1RBVEU7XG5cbiAgICAgIC8qIENvbXByZXNzaW9uIG11c3Qgc3RhcnQgd2l0aCBhbiBlbXB0eSBwZW5kaW5nIGJ1ZmZlciAqL1xuICAgICAgZmx1c2hfcGVuZGluZyhzdHJtKTtcbiAgICAgIGlmIChzLnBlbmRpbmcgIT09IDApIHtcbiAgICAgICAgcy5sYXN0X2ZsdXNoID0gLTE7XG4gICAgICAgIHJldHVybiBaX09LJDM7XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgcHV0X2J5dGUocywgKHMuZ3poZWFkLnRleHQgPyAxIDogMCkgK1xuICAgICAgICAgICAgICAgICAgKHMuZ3poZWFkLmhjcmMgPyAyIDogMCkgK1xuICAgICAgICAgICAgICAgICAgKCFzLmd6aGVhZC5leHRyYSA/IDAgOiA0KSArXG4gICAgICAgICAgICAgICAgICAoIXMuZ3poZWFkLm5hbWUgPyAwIDogOCkgK1xuICAgICAgICAgICAgICAgICAgKCFzLmd6aGVhZC5jb21tZW50ID8gMCA6IDE2KVxuICAgICAgKTtcbiAgICAgIHB1dF9ieXRlKHMsIHMuZ3poZWFkLnRpbWUgJiAweGZmKTtcbiAgICAgIHB1dF9ieXRlKHMsIChzLmd6aGVhZC50aW1lID4+IDgpICYgMHhmZik7XG4gICAgICBwdXRfYnl0ZShzLCAocy5nemhlYWQudGltZSA+PiAxNikgJiAweGZmKTtcbiAgICAgIHB1dF9ieXRlKHMsIChzLmd6aGVhZC50aW1lID4+IDI0KSAmIDB4ZmYpO1xuICAgICAgcHV0X2J5dGUocywgcy5sZXZlbCA9PT0gOSA/IDIgOlxuICAgICAgICAgICAgICAgICAgKHMuc3RyYXRlZ3kgPj0gWl9IVUZGTUFOX09OTFkgfHwgcy5sZXZlbCA8IDIgP1xuICAgICAgICAgICAgICAgICAgIDQgOiAwKSk7XG4gICAgICBwdXRfYnl0ZShzLCBzLmd6aGVhZC5vcyAmIDB4ZmYpO1xuICAgICAgaWYgKHMuZ3poZWFkLmV4dHJhICYmIHMuZ3poZWFkLmV4dHJhLmxlbmd0aCkge1xuICAgICAgICBwdXRfYnl0ZShzLCBzLmd6aGVhZC5leHRyYS5sZW5ndGggJiAweGZmKTtcbiAgICAgICAgcHV0X2J5dGUocywgKHMuZ3poZWFkLmV4dHJhLmxlbmd0aCA+PiA4KSAmIDB4ZmYpO1xuICAgICAgfVxuICAgICAgaWYgKHMuZ3poZWFkLmhjcmMpIHtcbiAgICAgICAgc3RybS5hZGxlciA9IGNyYzMyXzEoc3RybS5hZGxlciwgcy5wZW5kaW5nX2J1Ziwgcy5wZW5kaW5nLCAwKTtcbiAgICAgIH1cbiAgICAgIHMuZ3ppbmRleCA9IDA7XG4gICAgICBzLnN0YXR1cyA9IEVYVFJBX1NUQVRFO1xuICAgIH1cbiAgfVxuICBpZiAocy5zdGF0dXMgPT09IEVYVFJBX1NUQVRFKSB7XG4gICAgaWYgKHMuZ3poZWFkLmV4dHJhLyogIT0gWl9OVUxMKi8pIHtcbiAgICAgIGxldCBiZWcgPSBzLnBlbmRpbmc7ICAgLyogc3RhcnQgb2YgYnl0ZXMgdG8gdXBkYXRlIGNyYyAqL1xuICAgICAgbGV0IGxlZnQgPSAocy5nemhlYWQuZXh0cmEubGVuZ3RoICYgMHhmZmZmKSAtIHMuZ3ppbmRleDtcbiAgICAgIHdoaWxlIChzLnBlbmRpbmcgKyBsZWZ0ID4gcy5wZW5kaW5nX2J1Zl9zaXplKSB7XG4gICAgICAgIGxldCBjb3B5ID0gcy5wZW5kaW5nX2J1Zl9zaXplIC0gcy5wZW5kaW5nO1xuICAgICAgICAvLyB6bWVtY3B5KHMucGVuZGluZ19idWYgKyBzLnBlbmRpbmcsXG4gICAgICAgIC8vICAgIHMuZ3poZWFkLmV4dHJhICsgcy5nemluZGV4LCBjb3B5KTtcbiAgICAgICAgcy5wZW5kaW5nX2J1Zi5zZXQocy5nemhlYWQuZXh0cmEuc3ViYXJyYXkocy5nemluZGV4LCBzLmd6aW5kZXggKyBjb3B5KSwgcy5wZW5kaW5nKTtcbiAgICAgICAgcy5wZW5kaW5nID0gcy5wZW5kaW5nX2J1Zl9zaXplO1xuICAgICAgICAvLy0tLSBIQ1JDX1VQREFURShiZWcpIC0tLS8vXG4gICAgICAgIGlmIChzLmd6aGVhZC5oY3JjICYmIHMucGVuZGluZyA+IGJlZykge1xuICAgICAgICAgIHN0cm0uYWRsZXIgPSBjcmMzMl8xKHN0cm0uYWRsZXIsIHMucGVuZGluZ19idWYsIHMucGVuZGluZyAtIGJlZywgYmVnKTtcbiAgICAgICAgfVxuICAgICAgICAvLy0tLS8vXG4gICAgICAgIHMuZ3ppbmRleCArPSBjb3B5O1xuICAgICAgICBmbHVzaF9wZW5kaW5nKHN0cm0pO1xuICAgICAgICBpZiAocy5wZW5kaW5nICE9PSAwKSB7XG4gICAgICAgICAgcy5sYXN0X2ZsdXNoID0gLTE7XG4gICAgICAgICAgcmV0dXJuIFpfT0skMztcbiAgICAgICAgfVxuICAgICAgICBiZWcgPSAwO1xuICAgICAgICBsZWZ0IC09IGNvcHk7XG4gICAgICB9XG4gICAgICAvLyBKUyBzcGVjaWZpYzogcy5nemhlYWQuZXh0cmEgbWF5IGJlIFR5cGVkQXJyYXkgb3IgQXJyYXkgZm9yIGJhY2t3YXJkIGNvbXBhdGliaWxpdHlcbiAgICAgIC8vICAgICAgICAgICAgICBUeXBlZEFycmF5LnNsaWNlIGFuZCBUeXBlZEFycmF5LmZyb20gZG9uJ3QgZXhpc3QgaW4gSUUxMC1JRTExXG4gICAgICBsZXQgZ3poZWFkX2V4dHJhID0gbmV3IFVpbnQ4QXJyYXkocy5nemhlYWQuZXh0cmEpO1xuICAgICAgLy8gem1lbWNweShzLT5wZW5kaW5nX2J1ZiArIHMtPnBlbmRpbmcsXG4gICAgICAvLyAgICAgcy0+Z3poZWFkLT5leHRyYSArIHMtPmd6aW5kZXgsIGxlZnQpO1xuICAgICAgcy5wZW5kaW5nX2J1Zi5zZXQoZ3poZWFkX2V4dHJhLnN1YmFycmF5KHMuZ3ppbmRleCwgcy5nemluZGV4ICsgbGVmdCksIHMucGVuZGluZyk7XG4gICAgICBzLnBlbmRpbmcgKz0gbGVmdDtcbiAgICAgIC8vLS0tIEhDUkNfVVBEQVRFKGJlZykgLS0tLy9cbiAgICAgIGlmIChzLmd6aGVhZC5oY3JjICYmIHMucGVuZGluZyA+IGJlZykge1xuICAgICAgICBzdHJtLmFkbGVyID0gY3JjMzJfMShzdHJtLmFkbGVyLCBzLnBlbmRpbmdfYnVmLCBzLnBlbmRpbmcgLSBiZWcsIGJlZyk7XG4gICAgICB9XG4gICAgICAvLy0tLS8vXG4gICAgICBzLmd6aW5kZXggPSAwO1xuICAgIH1cbiAgICBzLnN0YXR1cyA9IE5BTUVfU1RBVEU7XG4gIH1cbiAgaWYgKHMuc3RhdHVzID09PSBOQU1FX1NUQVRFKSB7XG4gICAgaWYgKHMuZ3poZWFkLm5hbWUvKiAhPSBaX05VTEwqLykge1xuICAgICAgbGV0IGJlZyA9IHMucGVuZGluZzsgICAvKiBzdGFydCBvZiBieXRlcyB0byB1cGRhdGUgY3JjICovXG4gICAgICBsZXQgdmFsO1xuICAgICAgZG8ge1xuICAgICAgICBpZiAocy5wZW5kaW5nID09PSBzLnBlbmRpbmdfYnVmX3NpemUpIHtcbiAgICAgICAgICAvLy0tLSBIQ1JDX1VQREFURShiZWcpIC0tLS8vXG4gICAgICAgICAgaWYgKHMuZ3poZWFkLmhjcmMgJiYgcy5wZW5kaW5nID4gYmVnKSB7XG4gICAgICAgICAgICBzdHJtLmFkbGVyID0gY3JjMzJfMShzdHJtLmFkbGVyLCBzLnBlbmRpbmdfYnVmLCBzLnBlbmRpbmcgLSBiZWcsIGJlZyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vLS0tLy9cbiAgICAgICAgICBmbHVzaF9wZW5kaW5nKHN0cm0pO1xuICAgICAgICAgIGlmIChzLnBlbmRpbmcgIT09IDApIHtcbiAgICAgICAgICAgIHMubGFzdF9mbHVzaCA9IC0xO1xuICAgICAgICAgICAgcmV0dXJuIFpfT0skMztcbiAgICAgICAgICB9XG4gICAgICAgICAgYmVnID0gMDtcbiAgICAgICAgfVxuICAgICAgICAvLyBKUyBzcGVjaWZpYzogbGl0dGxlIG1hZ2ljIHRvIGFkZCB6ZXJvIHRlcm1pbmF0b3IgdG8gZW5kIG9mIHN0cmluZ1xuICAgICAgICBpZiAocy5nemluZGV4IDwgcy5nemhlYWQubmFtZS5sZW5ndGgpIHtcbiAgICAgICAgICB2YWwgPSBzLmd6aGVhZC5uYW1lLmNoYXJDb2RlQXQocy5nemluZGV4KyspICYgMHhmZjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YWwgPSAwO1xuICAgICAgICB9XG4gICAgICAgIHB1dF9ieXRlKHMsIHZhbCk7XG4gICAgICB9IHdoaWxlICh2YWwgIT09IDApO1xuICAgICAgLy8tLS0gSENSQ19VUERBVEUoYmVnKSAtLS0vL1xuICAgICAgaWYgKHMuZ3poZWFkLmhjcmMgJiYgcy5wZW5kaW5nID4gYmVnKSB7XG4gICAgICAgIHN0cm0uYWRsZXIgPSBjcmMzMl8xKHN0cm0uYWRsZXIsIHMucGVuZGluZ19idWYsIHMucGVuZGluZyAtIGJlZywgYmVnKTtcbiAgICAgIH1cbiAgICAgIC8vLS0tLy9cbiAgICAgIHMuZ3ppbmRleCA9IDA7XG4gICAgfVxuICAgIHMuc3RhdHVzID0gQ09NTUVOVF9TVEFURTtcbiAgfVxuICBpZiAocy5zdGF0dXMgPT09IENPTU1FTlRfU1RBVEUpIHtcbiAgICBpZiAocy5nemhlYWQuY29tbWVudC8qICE9IFpfTlVMTCovKSB7XG4gICAgICBsZXQgYmVnID0gcy5wZW5kaW5nOyAgIC8qIHN0YXJ0IG9mIGJ5dGVzIHRvIHVwZGF0ZSBjcmMgKi9cbiAgICAgIGxldCB2YWw7XG4gICAgICBkbyB7XG4gICAgICAgIGlmIChzLnBlbmRpbmcgPT09IHMucGVuZGluZ19idWZfc2l6ZSkge1xuICAgICAgICAgIC8vLS0tIEhDUkNfVVBEQVRFKGJlZykgLS0tLy9cbiAgICAgICAgICBpZiAocy5nemhlYWQuaGNyYyAmJiBzLnBlbmRpbmcgPiBiZWcpIHtcbiAgICAgICAgICAgIHN0cm0uYWRsZXIgPSBjcmMzMl8xKHN0cm0uYWRsZXIsIHMucGVuZGluZ19idWYsIHMucGVuZGluZyAtIGJlZywgYmVnKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8tLS0vL1xuICAgICAgICAgIGZsdXNoX3BlbmRpbmcoc3RybSk7XG4gICAgICAgICAgaWYgKHMucGVuZGluZyAhPT0gMCkge1xuICAgICAgICAgICAgcy5sYXN0X2ZsdXNoID0gLTE7XG4gICAgICAgICAgICByZXR1cm4gWl9PSyQzO1xuICAgICAgICAgIH1cbiAgICAgICAgICBiZWcgPSAwO1xuICAgICAgICB9XG4gICAgICAgIC8vIEpTIHNwZWNpZmljOiBsaXR0bGUgbWFnaWMgdG8gYWRkIHplcm8gdGVybWluYXRvciB0byBlbmQgb2Ygc3RyaW5nXG4gICAgICAgIGlmIChzLmd6aW5kZXggPCBzLmd6aGVhZC5jb21tZW50Lmxlbmd0aCkge1xuICAgICAgICAgIHZhbCA9IHMuZ3poZWFkLmNvbW1lbnQuY2hhckNvZGVBdChzLmd6aW5kZXgrKykgJiAweGZmO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhbCA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgcHV0X2J5dGUocywgdmFsKTtcbiAgICAgIH0gd2hpbGUgKHZhbCAhPT0gMCk7XG4gICAgICAvLy0tLSBIQ1JDX1VQREFURShiZWcpIC0tLS8vXG4gICAgICBpZiAocy5nemhlYWQuaGNyYyAmJiBzLnBlbmRpbmcgPiBiZWcpIHtcbiAgICAgICAgc3RybS5hZGxlciA9IGNyYzMyXzEoc3RybS5hZGxlciwgcy5wZW5kaW5nX2J1Ziwgcy5wZW5kaW5nIC0gYmVnLCBiZWcpO1xuICAgICAgfVxuICAgICAgLy8tLS0vL1xuICAgIH1cbiAgICBzLnN0YXR1cyA9IEhDUkNfU1RBVEU7XG4gIH1cbiAgaWYgKHMuc3RhdHVzID09PSBIQ1JDX1NUQVRFKSB7XG4gICAgaWYgKHMuZ3poZWFkLmhjcmMpIHtcbiAgICAgIGlmIChzLnBlbmRpbmcgKyAyID4gcy5wZW5kaW5nX2J1Zl9zaXplKSB7XG4gICAgICAgIGZsdXNoX3BlbmRpbmcoc3RybSk7XG4gICAgICAgIGlmIChzLnBlbmRpbmcgIT09IDApIHtcbiAgICAgICAgICBzLmxhc3RfZmx1c2ggPSAtMTtcbiAgICAgICAgICByZXR1cm4gWl9PSyQzO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBwdXRfYnl0ZShzLCBzdHJtLmFkbGVyICYgMHhmZik7XG4gICAgICBwdXRfYnl0ZShzLCAoc3RybS5hZGxlciA+PiA4KSAmIDB4ZmYpO1xuICAgICAgc3RybS5hZGxlciA9IDA7IC8vY3JjMzIoMEwsIFpfTlVMTCwgMCk7XG4gICAgfVxuICAgIHMuc3RhdHVzID0gQlVTWV9TVEFURTtcblxuICAgIC8qIENvbXByZXNzaW9uIG11c3Qgc3RhcnQgd2l0aCBhbiBlbXB0eSBwZW5kaW5nIGJ1ZmZlciAqL1xuICAgIGZsdXNoX3BlbmRpbmcoc3RybSk7XG4gICAgaWYgKHMucGVuZGluZyAhPT0gMCkge1xuICAgICAgcy5sYXN0X2ZsdXNoID0gLTE7XG4gICAgICByZXR1cm4gWl9PSyQzO1xuICAgIH1cbiAgfVxuLy8jZW5kaWZcblxuICAvKiBTdGFydCBhIG5ldyBibG9jayBvciBjb250aW51ZSB0aGUgY3VycmVudCBvbmUuXG4gICAqL1xuICBpZiAoc3RybS5hdmFpbF9pbiAhPT0gMCB8fCBzLmxvb2thaGVhZCAhPT0gMCB8fFxuICAgIChmbHVzaCAhPT0gWl9OT19GTFVTSCQyICYmIHMuc3RhdHVzICE9PSBGSU5JU0hfU1RBVEUpKSB7XG4gICAgbGV0IGJzdGF0ZSA9IHMubGV2ZWwgPT09IDAgPyBkZWZsYXRlX3N0b3JlZChzLCBmbHVzaCkgOlxuICAgICAgICAgICAgICAgICBzLnN0cmF0ZWd5ID09PSBaX0hVRkZNQU5fT05MWSA/IGRlZmxhdGVfaHVmZihzLCBmbHVzaCkgOlxuICAgICAgICAgICAgICAgICBzLnN0cmF0ZWd5ID09PSBaX1JMRSA/IGRlZmxhdGVfcmxlKHMsIGZsdXNoKSA6XG4gICAgICAgICAgICAgICAgIGNvbmZpZ3VyYXRpb25fdGFibGVbcy5sZXZlbF0uZnVuYyhzLCBmbHVzaCk7XG5cbiAgICBpZiAoYnN0YXRlID09PSBCU19GSU5JU0hfU1RBUlRFRCB8fCBic3RhdGUgPT09IEJTX0ZJTklTSF9ET05FKSB7XG4gICAgICBzLnN0YXR1cyA9IEZJTklTSF9TVEFURTtcbiAgICB9XG4gICAgaWYgKGJzdGF0ZSA9PT0gQlNfTkVFRF9NT1JFIHx8IGJzdGF0ZSA9PT0gQlNfRklOSVNIX1NUQVJURUQpIHtcbiAgICAgIGlmIChzdHJtLmF2YWlsX291dCA9PT0gMCkge1xuICAgICAgICBzLmxhc3RfZmx1c2ggPSAtMTtcbiAgICAgICAgLyogYXZvaWQgQlVGX0VSUk9SIG5leHQgY2FsbCwgc2VlIGFib3ZlICovXG4gICAgICB9XG4gICAgICByZXR1cm4gWl9PSyQzO1xuICAgICAgLyogSWYgZmx1c2ggIT0gWl9OT19GTFVTSCAmJiBhdmFpbF9vdXQgPT0gMCwgdGhlIG5leHQgY2FsbFxuICAgICAgICogb2YgZGVmbGF0ZSBzaG91bGQgdXNlIHRoZSBzYW1lIGZsdXNoIHBhcmFtZXRlciB0byBtYWtlIHN1cmVcbiAgICAgICAqIHRoYXQgdGhlIGZsdXNoIGlzIGNvbXBsZXRlLiBTbyB3ZSBkb24ndCBoYXZlIHRvIG91dHB1dCBhblxuICAgICAgICogZW1wdHkgYmxvY2sgaGVyZSwgdGhpcyB3aWxsIGJlIGRvbmUgYXQgbmV4dCBjYWxsLiBUaGlzIGFsc29cbiAgICAgICAqIGVuc3VyZXMgdGhhdCBmb3IgYSB2ZXJ5IHNtYWxsIG91dHB1dCBidWZmZXIsIHdlIGVtaXQgYXQgbW9zdFxuICAgICAgICogb25lIGVtcHR5IGJsb2NrLlxuICAgICAgICovXG4gICAgfVxuICAgIGlmIChic3RhdGUgPT09IEJTX0JMT0NLX0RPTkUpIHtcbiAgICAgIGlmIChmbHVzaCA9PT0gWl9QQVJUSUFMX0ZMVVNIKSB7XG4gICAgICAgIF90cl9hbGlnbihzKTtcbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKGZsdXNoICE9PSBaX0JMT0NLJDEpIHsgLyogRlVMTF9GTFVTSCBvciBTWU5DX0ZMVVNIICovXG5cbiAgICAgICAgX3RyX3N0b3JlZF9ibG9jayhzLCAwLCAwLCBmYWxzZSk7XG4gICAgICAgIC8qIEZvciBhIGZ1bGwgZmx1c2gsIHRoaXMgZW1wdHkgYmxvY2sgd2lsbCBiZSByZWNvZ25pemVkXG4gICAgICAgICAqIGFzIGEgc3BlY2lhbCBtYXJrZXIgYnkgaW5mbGF0ZV9zeW5jKCkuXG4gICAgICAgICAqL1xuICAgICAgICBpZiAoZmx1c2ggPT09IFpfRlVMTF9GTFVTSCQxKSB7XG4gICAgICAgICAgLyoqKiBDTEVBUl9IQVNIKHMpOyAqKiovICAgICAgICAgICAgIC8qIGZvcmdldCBoaXN0b3J5ICovXG4gICAgICAgICAgemVybyhzLmhlYWQpOyAvLyBGaWxsIHdpdGggTklMICg9IDApO1xuXG4gICAgICAgICAgaWYgKHMubG9va2FoZWFkID09PSAwKSB7XG4gICAgICAgICAgICBzLnN0cnN0YXJ0ID0gMDtcbiAgICAgICAgICAgIHMuYmxvY2tfc3RhcnQgPSAwO1xuICAgICAgICAgICAgcy5pbnNlcnQgPSAwO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZmx1c2hfcGVuZGluZyhzdHJtKTtcbiAgICAgIGlmIChzdHJtLmF2YWlsX291dCA9PT0gMCkge1xuICAgICAgICBzLmxhc3RfZmx1c2ggPSAtMTsgLyogYXZvaWQgQlVGX0VSUk9SIGF0IG5leHQgY2FsbCwgc2VlIGFib3ZlICovXG4gICAgICAgIHJldHVybiBaX09LJDM7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgaWYgKGZsdXNoICE9PSBaX0ZJTklTSCQzKSB7IHJldHVybiBaX09LJDM7IH1cbiAgaWYgKHMud3JhcCA8PSAwKSB7IHJldHVybiBaX1NUUkVBTV9FTkQkMzsgfVxuXG4gIC8qIFdyaXRlIHRoZSB0cmFpbGVyICovXG4gIGlmIChzLndyYXAgPT09IDIpIHtcbiAgICBwdXRfYnl0ZShzLCBzdHJtLmFkbGVyICYgMHhmZik7XG4gICAgcHV0X2J5dGUocywgKHN0cm0uYWRsZXIgPj4gOCkgJiAweGZmKTtcbiAgICBwdXRfYnl0ZShzLCAoc3RybS5hZGxlciA+PiAxNikgJiAweGZmKTtcbiAgICBwdXRfYnl0ZShzLCAoc3RybS5hZGxlciA+PiAyNCkgJiAweGZmKTtcbiAgICBwdXRfYnl0ZShzLCBzdHJtLnRvdGFsX2luICYgMHhmZik7XG4gICAgcHV0X2J5dGUocywgKHN0cm0udG90YWxfaW4gPj4gOCkgJiAweGZmKTtcbiAgICBwdXRfYnl0ZShzLCAoc3RybS50b3RhbF9pbiA+PiAxNikgJiAweGZmKTtcbiAgICBwdXRfYnl0ZShzLCAoc3RybS50b3RhbF9pbiA+PiAyNCkgJiAweGZmKTtcbiAgfVxuICBlbHNlXG4gIHtcbiAgICBwdXRTaG9ydE1TQihzLCBzdHJtLmFkbGVyID4+PiAxNik7XG4gICAgcHV0U2hvcnRNU0Iocywgc3RybS5hZGxlciAmIDB4ZmZmZik7XG4gIH1cblxuICBmbHVzaF9wZW5kaW5nKHN0cm0pO1xuICAvKiBJZiBhdmFpbF9vdXQgaXMgemVybywgdGhlIGFwcGxpY2F0aW9uIHdpbGwgY2FsbCBkZWZsYXRlIGFnYWluXG4gICAqIHRvIGZsdXNoIHRoZSByZXN0LlxuICAgKi9cbiAgaWYgKHMud3JhcCA+IDApIHsgcy53cmFwID0gLXMud3JhcDsgfVxuICAvKiB3cml0ZSB0aGUgdHJhaWxlciBvbmx5IG9uY2UhICovXG4gIHJldHVybiBzLnBlbmRpbmcgIT09IDAgPyBaX09LJDMgOiBaX1NUUkVBTV9FTkQkMztcbn07XG5cblxuY29uc3QgZGVmbGF0ZUVuZCA9IChzdHJtKSA9PiB7XG5cbiAgaWYgKGRlZmxhdGVTdGF0ZUNoZWNrKHN0cm0pKSB7XG4gICAgcmV0dXJuIFpfU1RSRUFNX0VSUk9SJDI7XG4gIH1cblxuICBjb25zdCBzdGF0dXMgPSBzdHJtLnN0YXRlLnN0YXR1cztcblxuICBzdHJtLnN0YXRlID0gbnVsbDtcblxuICByZXR1cm4gc3RhdHVzID09PSBCVVNZX1NUQVRFID8gZXJyKHN0cm0sIFpfREFUQV9FUlJPUiQyKSA6IFpfT0skMztcbn07XG5cblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogSW5pdGlhbGl6ZXMgdGhlIGNvbXByZXNzaW9uIGRpY3Rpb25hcnkgZnJvbSB0aGUgZ2l2ZW4gYnl0ZVxuICogc2VxdWVuY2Ugd2l0aG91dCBwcm9kdWNpbmcgYW55IGNvbXByZXNzZWQgb3V0cHV0LlxuICovXG5jb25zdCBkZWZsYXRlU2V0RGljdGlvbmFyeSA9IChzdHJtLCBkaWN0aW9uYXJ5KSA9PiB7XG5cbiAgbGV0IGRpY3RMZW5ndGggPSBkaWN0aW9uYXJ5Lmxlbmd0aDtcblxuICBpZiAoZGVmbGF0ZVN0YXRlQ2hlY2soc3RybSkpIHtcbiAgICByZXR1cm4gWl9TVFJFQU1fRVJST1IkMjtcbiAgfVxuXG4gIGNvbnN0IHMgPSBzdHJtLnN0YXRlO1xuICBjb25zdCB3cmFwID0gcy53cmFwO1xuXG4gIGlmICh3cmFwID09PSAyIHx8ICh3cmFwID09PSAxICYmIHMuc3RhdHVzICE9PSBJTklUX1NUQVRFKSB8fCBzLmxvb2thaGVhZCkge1xuICAgIHJldHVybiBaX1NUUkVBTV9FUlJPUiQyO1xuICB9XG5cbiAgLyogd2hlbiB1c2luZyB6bGliIHdyYXBwZXJzLCBjb21wdXRlIEFkbGVyLTMyIGZvciBwcm92aWRlZCBkaWN0aW9uYXJ5ICovXG4gIGlmICh3cmFwID09PSAxKSB7XG4gICAgLyogYWRsZXIzMihzdHJtLT5hZGxlciwgZGljdGlvbmFyeSwgZGljdExlbmd0aCk7ICovXG4gICAgc3RybS5hZGxlciA9IGFkbGVyMzJfMShzdHJtLmFkbGVyLCBkaWN0aW9uYXJ5LCBkaWN0TGVuZ3RoLCAwKTtcbiAgfVxuXG4gIHMud3JhcCA9IDA7ICAgLyogYXZvaWQgY29tcHV0aW5nIEFkbGVyLTMyIGluIHJlYWRfYnVmICovXG5cbiAgLyogaWYgZGljdGlvbmFyeSB3b3VsZCBmaWxsIHdpbmRvdywganVzdCByZXBsYWNlIHRoZSBoaXN0b3J5ICovXG4gIGlmIChkaWN0TGVuZ3RoID49IHMud19zaXplKSB7XG4gICAgaWYgKHdyYXAgPT09IDApIHsgICAgICAgICAgICAvKiBhbHJlYWR5IGVtcHR5IG90aGVyd2lzZSAqL1xuICAgICAgLyoqKiBDTEVBUl9IQVNIKHMpOyAqKiovXG4gICAgICB6ZXJvKHMuaGVhZCk7IC8vIEZpbGwgd2l0aCBOSUwgKD0gMCk7XG4gICAgICBzLnN0cnN0YXJ0ID0gMDtcbiAgICAgIHMuYmxvY2tfc3RhcnQgPSAwO1xuICAgICAgcy5pbnNlcnQgPSAwO1xuICAgIH1cbiAgICAvKiB1c2UgdGhlIHRhaWwgKi9cbiAgICAvLyBkaWN0aW9uYXJ5ID0gZGljdGlvbmFyeS5zbGljZShkaWN0TGVuZ3RoIC0gcy53X3NpemUpO1xuICAgIGxldCB0bXBEaWN0ID0gbmV3IFVpbnQ4QXJyYXkocy53X3NpemUpO1xuICAgIHRtcERpY3Quc2V0KGRpY3Rpb25hcnkuc3ViYXJyYXkoZGljdExlbmd0aCAtIHMud19zaXplLCBkaWN0TGVuZ3RoKSwgMCk7XG4gICAgZGljdGlvbmFyeSA9IHRtcERpY3Q7XG4gICAgZGljdExlbmd0aCA9IHMud19zaXplO1xuICB9XG4gIC8qIGluc2VydCBkaWN0aW9uYXJ5IGludG8gd2luZG93IGFuZCBoYXNoICovXG4gIGNvbnN0IGF2YWlsID0gc3RybS5hdmFpbF9pbjtcbiAgY29uc3QgbmV4dCA9IHN0cm0ubmV4dF9pbjtcbiAgY29uc3QgaW5wdXQgPSBzdHJtLmlucHV0O1xuICBzdHJtLmF2YWlsX2luID0gZGljdExlbmd0aDtcbiAgc3RybS5uZXh0X2luID0gMDtcbiAgc3RybS5pbnB1dCA9IGRpY3Rpb25hcnk7XG4gIGZpbGxfd2luZG93KHMpO1xuICB3aGlsZSAocy5sb29rYWhlYWQgPj0gTUlOX01BVENIKSB7XG4gICAgbGV0IHN0ciA9IHMuc3Ryc3RhcnQ7XG4gICAgbGV0IG4gPSBzLmxvb2thaGVhZCAtIChNSU5fTUFUQ0ggLSAxKTtcbiAgICBkbyB7XG4gICAgICAvKiBVUERBVEVfSEFTSChzLCBzLT5pbnNfaCwgcy0+d2luZG93W3N0ciArIE1JTl9NQVRDSC0xXSk7ICovXG4gICAgICBzLmluc19oID0gSEFTSChzLCBzLmluc19oLCBzLndpbmRvd1tzdHIgKyBNSU5fTUFUQ0ggLSAxXSk7XG5cbiAgICAgIHMucHJldltzdHIgJiBzLndfbWFza10gPSBzLmhlYWRbcy5pbnNfaF07XG5cbiAgICAgIHMuaGVhZFtzLmluc19oXSA9IHN0cjtcbiAgICAgIHN0cisrO1xuICAgIH0gd2hpbGUgKC0tbik7XG4gICAgcy5zdHJzdGFydCA9IHN0cjtcbiAgICBzLmxvb2thaGVhZCA9IE1JTl9NQVRDSCAtIDE7XG4gICAgZmlsbF93aW5kb3cocyk7XG4gIH1cbiAgcy5zdHJzdGFydCArPSBzLmxvb2thaGVhZDtcbiAgcy5ibG9ja19zdGFydCA9IHMuc3Ryc3RhcnQ7XG4gIHMuaW5zZXJ0ID0gcy5sb29rYWhlYWQ7XG4gIHMubG9va2FoZWFkID0gMDtcbiAgcy5tYXRjaF9sZW5ndGggPSBzLnByZXZfbGVuZ3RoID0gTUlOX01BVENIIC0gMTtcbiAgcy5tYXRjaF9hdmFpbGFibGUgPSAwO1xuICBzdHJtLm5leHRfaW4gPSBuZXh0O1xuICBzdHJtLmlucHV0ID0gaW5wdXQ7XG4gIHN0cm0uYXZhaWxfaW4gPSBhdmFpbDtcbiAgcy53cmFwID0gd3JhcDtcbiAgcmV0dXJuIFpfT0skMztcbn07XG5cblxudmFyIGRlZmxhdGVJbml0XzEgPSBkZWZsYXRlSW5pdDtcbnZhciBkZWZsYXRlSW5pdDJfMSA9IGRlZmxhdGVJbml0MjtcbnZhciBkZWZsYXRlUmVzZXRfMSA9IGRlZmxhdGVSZXNldDtcbnZhciBkZWZsYXRlUmVzZXRLZWVwXzEgPSBkZWZsYXRlUmVzZXRLZWVwO1xudmFyIGRlZmxhdGVTZXRIZWFkZXJfMSA9IGRlZmxhdGVTZXRIZWFkZXI7XG52YXIgZGVmbGF0ZV8yJDEgPSBkZWZsYXRlJDI7XG52YXIgZGVmbGF0ZUVuZF8xID0gZGVmbGF0ZUVuZDtcbnZhciBkZWZsYXRlU2V0RGljdGlvbmFyeV8xID0gZGVmbGF0ZVNldERpY3Rpb25hcnk7XG52YXIgZGVmbGF0ZUluZm8gPSAncGFrbyBkZWZsYXRlIChmcm9tIE5vZGVjYSBwcm9qZWN0KSc7XG5cbi8qIE5vdCBpbXBsZW1lbnRlZFxubW9kdWxlLmV4cG9ydHMuZGVmbGF0ZUJvdW5kID0gZGVmbGF0ZUJvdW5kO1xubW9kdWxlLmV4cG9ydHMuZGVmbGF0ZUNvcHkgPSBkZWZsYXRlQ29weTtcbm1vZHVsZS5leHBvcnRzLmRlZmxhdGVHZXREaWN0aW9uYXJ5ID0gZGVmbGF0ZUdldERpY3Rpb25hcnk7XG5tb2R1bGUuZXhwb3J0cy5kZWZsYXRlUGFyYW1zID0gZGVmbGF0ZVBhcmFtcztcbm1vZHVsZS5leHBvcnRzLmRlZmxhdGVQZW5kaW5nID0gZGVmbGF0ZVBlbmRpbmc7XG5tb2R1bGUuZXhwb3J0cy5kZWZsYXRlUHJpbWUgPSBkZWZsYXRlUHJpbWU7XG5tb2R1bGUuZXhwb3J0cy5kZWZsYXRlVHVuZSA9IGRlZmxhdGVUdW5lO1xuKi9cblxudmFyIGRlZmxhdGVfMSQyID0ge1xuXHRkZWZsYXRlSW5pdDogZGVmbGF0ZUluaXRfMSxcblx0ZGVmbGF0ZUluaXQyOiBkZWZsYXRlSW5pdDJfMSxcblx0ZGVmbGF0ZVJlc2V0OiBkZWZsYXRlUmVzZXRfMSxcblx0ZGVmbGF0ZVJlc2V0S2VlcDogZGVmbGF0ZVJlc2V0S2VlcF8xLFxuXHRkZWZsYXRlU2V0SGVhZGVyOiBkZWZsYXRlU2V0SGVhZGVyXzEsXG5cdGRlZmxhdGU6IGRlZmxhdGVfMiQxLFxuXHRkZWZsYXRlRW5kOiBkZWZsYXRlRW5kXzEsXG5cdGRlZmxhdGVTZXREaWN0aW9uYXJ5OiBkZWZsYXRlU2V0RGljdGlvbmFyeV8xLFxuXHRkZWZsYXRlSW5mbzogZGVmbGF0ZUluZm9cbn07XG5cbmNvbnN0IF9oYXMgPSAob2JqLCBrZXkpID0+IHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIGtleSk7XG59O1xuXG52YXIgYXNzaWduID0gZnVuY3Rpb24gKG9iaiAvKmZyb20xLCBmcm9tMiwgZnJvbTMsIC4uLiovKSB7XG4gIGNvbnN0IHNvdXJjZXMgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICB3aGlsZSAoc291cmNlcy5sZW5ndGgpIHtcbiAgICBjb25zdCBzb3VyY2UgPSBzb3VyY2VzLnNoaWZ0KCk7XG4gICAgaWYgKCFzb3VyY2UpIHsgY29udGludWU7IH1cblxuICAgIGlmICh0eXBlb2Ygc291cmNlICE9PSAnb2JqZWN0Jykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihzb3VyY2UgKyAnbXVzdCBiZSBub24tb2JqZWN0Jyk7XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBwIGluIHNvdXJjZSkge1xuICAgICAgaWYgKF9oYXMoc291cmNlLCBwKSkge1xuICAgICAgICBvYmpbcF0gPSBzb3VyY2VbcF07XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG9iajtcbn07XG5cblxuLy8gSm9pbiBhcnJheSBvZiBjaHVua3MgdG8gc2luZ2xlIGFycmF5LlxudmFyIGZsYXR0ZW5DaHVua3MgPSAoY2h1bmtzKSA9PiB7XG4gIC8vIGNhbGN1bGF0ZSBkYXRhIGxlbmd0aFxuICBsZXQgbGVuID0gMDtcblxuICBmb3IgKGxldCBpID0gMCwgbCA9IGNodW5rcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICBsZW4gKz0gY2h1bmtzW2ldLmxlbmd0aDtcbiAgfVxuXG4gIC8vIGpvaW4gY2h1bmtzXG4gIGNvbnN0IHJlc3VsdCA9IG5ldyBVaW50OEFycmF5KGxlbik7XG5cbiAgZm9yIChsZXQgaSA9IDAsIHBvcyA9IDAsIGwgPSBjaHVua3MubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgbGV0IGNodW5rID0gY2h1bmtzW2ldO1xuICAgIHJlc3VsdC5zZXQoY2h1bmssIHBvcyk7XG4gICAgcG9zICs9IGNodW5rLmxlbmd0aDtcbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59O1xuXG52YXIgY29tbW9uID0ge1xuXHRhc3NpZ246IGFzc2lnbixcblx0ZmxhdHRlbkNodW5rczogZmxhdHRlbkNodW5rc1xufTtcblxuLy8gU3RyaW5nIGVuY29kZS9kZWNvZGUgaGVscGVyc1xuXG5cbi8vIFF1aWNrIGNoZWNrIGlmIHdlIGNhbiB1c2UgZmFzdCBhcnJheSB0byBiaW4gc3RyaW5nIGNvbnZlcnNpb25cbi8vXG4vLyAtIGFwcGx5KEFycmF5KSBjYW4gZmFpbCBvbiBBbmRyb2lkIDIuMlxuLy8gLSBhcHBseShVaW50OEFycmF5KSBjYW4gZmFpbCBvbiBpT1MgNS4xIFNhZmFyaVxuLy9cbmxldCBTVFJfQVBQTFlfVUlBX09LID0gdHJ1ZTtcblxudHJ5IHsgU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBuZXcgVWludDhBcnJheSgxKSk7IH0gY2F0Y2ggKF9fKSB7IFNUUl9BUFBMWV9VSUFfT0sgPSBmYWxzZTsgfVxuXG5cbi8vIFRhYmxlIHdpdGggdXRmOCBsZW5ndGhzIChjYWxjdWxhdGVkIGJ5IGZpcnN0IGJ5dGUgb2Ygc2VxdWVuY2UpXG4vLyBOb3RlLCB0aGF0IDUgJiA2LWJ5dGUgdmFsdWVzIGFuZCBzb21lIDQtYnl0ZSB2YWx1ZXMgY2FuIG5vdCBiZSByZXByZXNlbnRlZCBpbiBKUyxcbi8vIGJlY2F1c2UgbWF4IHBvc3NpYmxlIGNvZGVwb2ludCBpcyAweDEwZmZmZlxuY29uc3QgX3V0ZjhsZW4gPSBuZXcgVWludDhBcnJheSgyNTYpO1xuZm9yIChsZXQgcSA9IDA7IHEgPCAyNTY7IHErKykge1xuICBfdXRmOGxlbltxXSA9IChxID49IDI1MiA/IDYgOiBxID49IDI0OCA/IDUgOiBxID49IDI0MCA/IDQgOiBxID49IDIyNCA/IDMgOiBxID49IDE5MiA/IDIgOiAxKTtcbn1cbl91dGY4bGVuWzI1NF0gPSBfdXRmOGxlblsyNTRdID0gMTsgLy8gSW52YWxpZCBzZXF1ZW5jZSBzdGFydFxuXG5cbi8vIGNvbnZlcnQgc3RyaW5nIHRvIGFycmF5ICh0eXBlZCwgd2hlbiBwb3NzaWJsZSlcbnZhciBzdHJpbmcyYnVmID0gKHN0cikgPT4ge1xuICBpZiAodHlwZW9mIFRleHRFbmNvZGVyID09PSAnZnVuY3Rpb24nICYmIFRleHRFbmNvZGVyLnByb3RvdHlwZS5lbmNvZGUpIHtcbiAgICByZXR1cm4gbmV3IFRleHRFbmNvZGVyKCkuZW5jb2RlKHN0cik7XG4gIH1cblxuICBsZXQgYnVmLCBjLCBjMiwgbV9wb3MsIGksIHN0cl9sZW4gPSBzdHIubGVuZ3RoLCBidWZfbGVuID0gMDtcblxuICAvLyBjb3VudCBiaW5hcnkgc2l6ZVxuICBmb3IgKG1fcG9zID0gMDsgbV9wb3MgPCBzdHJfbGVuOyBtX3BvcysrKSB7XG4gICAgYyA9IHN0ci5jaGFyQ29kZUF0KG1fcG9zKTtcbiAgICBpZiAoKGMgJiAweGZjMDApID09PSAweGQ4MDAgJiYgKG1fcG9zICsgMSA8IHN0cl9sZW4pKSB7XG4gICAgICBjMiA9IHN0ci5jaGFyQ29kZUF0KG1fcG9zICsgMSk7XG4gICAgICBpZiAoKGMyICYgMHhmYzAwKSA9PT0gMHhkYzAwKSB7XG4gICAgICAgIGMgPSAweDEwMDAwICsgKChjIC0gMHhkODAwKSA8PCAxMCkgKyAoYzIgLSAweGRjMDApO1xuICAgICAgICBtX3BvcysrO1xuICAgICAgfVxuICAgIH1cbiAgICBidWZfbGVuICs9IGMgPCAweDgwID8gMSA6IGMgPCAweDgwMCA/IDIgOiBjIDwgMHgxMDAwMCA/IDMgOiA0O1xuICB9XG5cbiAgLy8gYWxsb2NhdGUgYnVmZmVyXG4gIGJ1ZiA9IG5ldyBVaW50OEFycmF5KGJ1Zl9sZW4pO1xuXG4gIC8vIGNvbnZlcnRcbiAgZm9yIChpID0gMCwgbV9wb3MgPSAwOyBpIDwgYnVmX2xlbjsgbV9wb3MrKykge1xuICAgIGMgPSBzdHIuY2hhckNvZGVBdChtX3Bvcyk7XG4gICAgaWYgKChjICYgMHhmYzAwKSA9PT0gMHhkODAwICYmIChtX3BvcyArIDEgPCBzdHJfbGVuKSkge1xuICAgICAgYzIgPSBzdHIuY2hhckNvZGVBdChtX3BvcyArIDEpO1xuICAgICAgaWYgKChjMiAmIDB4ZmMwMCkgPT09IDB4ZGMwMCkge1xuICAgICAgICBjID0gMHgxMDAwMCArICgoYyAtIDB4ZDgwMCkgPDwgMTApICsgKGMyIC0gMHhkYzAwKTtcbiAgICAgICAgbV9wb3MrKztcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGMgPCAweDgwKSB7XG4gICAgICAvKiBvbmUgYnl0ZSAqL1xuICAgICAgYnVmW2krK10gPSBjO1xuICAgIH0gZWxzZSBpZiAoYyA8IDB4ODAwKSB7XG4gICAgICAvKiB0d28gYnl0ZXMgKi9cbiAgICAgIGJ1ZltpKytdID0gMHhDMCB8IChjID4+PiA2KTtcbiAgICAgIGJ1ZltpKytdID0gMHg4MCB8IChjICYgMHgzZik7XG4gICAgfSBlbHNlIGlmIChjIDwgMHgxMDAwMCkge1xuICAgICAgLyogdGhyZWUgYnl0ZXMgKi9cbiAgICAgIGJ1ZltpKytdID0gMHhFMCB8IChjID4+PiAxMik7XG4gICAgICBidWZbaSsrXSA9IDB4ODAgfCAoYyA+Pj4gNiAmIDB4M2YpO1xuICAgICAgYnVmW2krK10gPSAweDgwIHwgKGMgJiAweDNmKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLyogZm91ciBieXRlcyAqL1xuICAgICAgYnVmW2krK10gPSAweGYwIHwgKGMgPj4+IDE4KTtcbiAgICAgIGJ1ZltpKytdID0gMHg4MCB8IChjID4+PiAxMiAmIDB4M2YpO1xuICAgICAgYnVmW2krK10gPSAweDgwIHwgKGMgPj4+IDYgJiAweDNmKTtcbiAgICAgIGJ1ZltpKytdID0gMHg4MCB8IChjICYgMHgzZik7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGJ1Zjtcbn07XG5cbi8vIEhlbHBlclxuY29uc3QgYnVmMmJpbnN0cmluZyA9IChidWYsIGxlbikgPT4ge1xuICAvLyBPbiBDaHJvbWUsIHRoZSBhcmd1bWVudHMgaW4gYSBmdW5jdGlvbiBjYWxsIHRoYXQgYXJlIGFsbG93ZWQgaXMgYDY1NTM0YC5cbiAgLy8gSWYgdGhlIGxlbmd0aCBvZiB0aGUgYnVmZmVyIGlzIHNtYWxsZXIgdGhhbiB0aGF0LCB3ZSBjYW4gdXNlIHRoaXMgb3B0aW1pemF0aW9uLFxuICAvLyBvdGhlcndpc2Ugd2Ugd2lsbCB0YWtlIGEgc2xvd2VyIHBhdGguXG4gIGlmIChsZW4gPCA2NTUzNCkge1xuICAgIGlmIChidWYuc3ViYXJyYXkgJiYgU1RSX0FQUExZX1VJQV9PSykge1xuICAgICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgYnVmLmxlbmd0aCA9PT0gbGVuID8gYnVmIDogYnVmLnN1YmFycmF5KDAsIGxlbikpO1xuICAgIH1cbiAgfVxuXG4gIGxldCByZXN1bHQgPSAnJztcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgIHJlc3VsdCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSk7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn07XG5cblxuLy8gY29udmVydCBhcnJheSB0byBzdHJpbmdcbnZhciBidWYyc3RyaW5nID0gKGJ1ZiwgbWF4KSA9PiB7XG4gIGNvbnN0IGxlbiA9IG1heCB8fCBidWYubGVuZ3RoO1xuXG4gIGlmICh0eXBlb2YgVGV4dERlY29kZXIgPT09ICdmdW5jdGlvbicgJiYgVGV4dERlY29kZXIucHJvdG90eXBlLmRlY29kZSkge1xuICAgIHJldHVybiBuZXcgVGV4dERlY29kZXIoKS5kZWNvZGUoYnVmLnN1YmFycmF5KDAsIG1heCkpO1xuICB9XG5cbiAgbGV0IGksIG91dDtcblxuICAvLyBSZXNlcnZlIG1heCBwb3NzaWJsZSBsZW5ndGggKDIgd29yZHMgcGVyIGNoYXIpXG4gIC8vIE5COiBieSB1bmtub3duIHJlYXNvbnMsIEFycmF5IGlzIHNpZ25pZmljYW50bHkgZmFzdGVyIGZvclxuICAvLyAgICAgU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseSB0aGFuIFVpbnQxNkFycmF5LlxuICBjb25zdCB1dGYxNmJ1ZiA9IG5ldyBBcnJheShsZW4gKiAyKTtcblxuICBmb3IgKG91dCA9IDAsIGkgPSAwOyBpIDwgbGVuOykge1xuICAgIGxldCBjID0gYnVmW2krK107XG4gICAgLy8gcXVpY2sgcHJvY2VzcyBhc2NpaVxuICAgIGlmIChjIDwgMHg4MCkgeyB1dGYxNmJ1ZltvdXQrK10gPSBjOyBjb250aW51ZTsgfVxuXG4gICAgbGV0IGNfbGVuID0gX3V0ZjhsZW5bY107XG4gICAgLy8gc2tpcCA1ICYgNiBieXRlIGNvZGVzXG4gICAgaWYgKGNfbGVuID4gNCkgeyB1dGYxNmJ1ZltvdXQrK10gPSAweGZmZmQ7IGkgKz0gY19sZW4gLSAxOyBjb250aW51ZTsgfVxuXG4gICAgLy8gYXBwbHkgbWFzayBvbiBmaXJzdCBieXRlXG4gICAgYyAmPSBjX2xlbiA9PT0gMiA/IDB4MWYgOiBjX2xlbiA9PT0gMyA/IDB4MGYgOiAweDA3O1xuICAgIC8vIGpvaW4gdGhlIHJlc3RcbiAgICB3aGlsZSAoY19sZW4gPiAxICYmIGkgPCBsZW4pIHtcbiAgICAgIGMgPSAoYyA8PCA2KSB8IChidWZbaSsrXSAmIDB4M2YpO1xuICAgICAgY19sZW4tLTtcbiAgICB9XG5cbiAgICAvLyB0ZXJtaW5hdGVkIGJ5IGVuZCBvZiBzdHJpbmc/XG4gICAgaWYgKGNfbGVuID4gMSkgeyB1dGYxNmJ1ZltvdXQrK10gPSAweGZmZmQ7IGNvbnRpbnVlOyB9XG5cbiAgICBpZiAoYyA8IDB4MTAwMDApIHtcbiAgICAgIHV0ZjE2YnVmW291dCsrXSA9IGM7XG4gICAgfSBlbHNlIHtcbiAgICAgIGMgLT0gMHgxMDAwMDtcbiAgICAgIHV0ZjE2YnVmW291dCsrXSA9IDB4ZDgwMCB8ICgoYyA+PiAxMCkgJiAweDNmZik7XG4gICAgICB1dGYxNmJ1ZltvdXQrK10gPSAweGRjMDAgfCAoYyAmIDB4M2ZmKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYnVmMmJpbnN0cmluZyh1dGYxNmJ1Ziwgb3V0KTtcbn07XG5cblxuLy8gQ2FsY3VsYXRlIG1heCBwb3NzaWJsZSBwb3NpdGlvbiBpbiB1dGY4IGJ1ZmZlcixcbi8vIHRoYXQgd2lsbCBub3QgYnJlYWsgc2VxdWVuY2UuIElmIHRoYXQncyBub3QgcG9zc2libGVcbi8vIC0gKHZlcnkgc21hbGwgbGltaXRzKSByZXR1cm4gbWF4IHNpemUgYXMgaXMuXG4vL1xuLy8gYnVmW10gLSB1dGY4IGJ5dGVzIGFycmF5XG4vLyBtYXggICAtIGxlbmd0aCBsaW1pdCAobWFuZGF0b3J5KTtcbnZhciB1dGY4Ym9yZGVyID0gKGJ1ZiwgbWF4KSA9PiB7XG5cbiAgbWF4ID0gbWF4IHx8IGJ1Zi5sZW5ndGg7XG4gIGlmIChtYXggPiBidWYubGVuZ3RoKSB7IG1heCA9IGJ1Zi5sZW5ndGg7IH1cblxuICAvLyBnbyBiYWNrIGZyb20gbGFzdCBwb3NpdGlvbiwgdW50aWwgc3RhcnQgb2Ygc2VxdWVuY2UgZm91bmRcbiAgbGV0IHBvcyA9IG1heCAtIDE7XG4gIHdoaWxlIChwb3MgPj0gMCAmJiAoYnVmW3Bvc10gJiAweEMwKSA9PT0gMHg4MCkgeyBwb3MtLTsgfVxuXG4gIC8vIFZlcnkgc21hbGwgYW5kIGJyb2tlbiBzZXF1ZW5jZSxcbiAgLy8gcmV0dXJuIG1heCwgYmVjYXVzZSB3ZSBzaG91bGQgcmV0dXJuIHNvbWV0aGluZyBhbnl3YXkuXG4gIGlmIChwb3MgPCAwKSB7IHJldHVybiBtYXg7IH1cblxuICAvLyBJZiB3ZSBjYW1lIHRvIHN0YXJ0IG9mIGJ1ZmZlciAtIHRoYXQgbWVhbnMgYnVmZmVyIGlzIHRvbyBzbWFsbCxcbiAgLy8gcmV0dXJuIG1heCB0b28uXG4gIGlmIChwb3MgPT09IDApIHsgcmV0dXJuIG1heDsgfVxuXG4gIHJldHVybiAocG9zICsgX3V0ZjhsZW5bYnVmW3Bvc11dID4gbWF4KSA/IHBvcyA6IG1heDtcbn07XG5cbnZhciBzdHJpbmdzID0ge1xuXHRzdHJpbmcyYnVmOiBzdHJpbmcyYnVmLFxuXHRidWYyc3RyaW5nOiBidWYyc3RyaW5nLFxuXHR1dGY4Ym9yZGVyOiB1dGY4Ym9yZGVyXG59O1xuXG4vLyAoQykgMTk5NS0yMDEzIEplYW4tbG91cCBHYWlsbHkgYW5kIE1hcmsgQWRsZXJcbi8vIChDKSAyMDE0LTIwMTcgVml0YWx5IFB1enJpbiBhbmQgQW5kcmV5IFR1cGl0c2luXG4vL1xuLy8gVGhpcyBzb2Z0d2FyZSBpcyBwcm92aWRlZCAnYXMtaXMnLCB3aXRob3V0IGFueSBleHByZXNzIG9yIGltcGxpZWRcbi8vIHdhcnJhbnR5LiBJbiBubyBldmVudCB3aWxsIHRoZSBhdXRob3JzIGJlIGhlbGQgbGlhYmxlIGZvciBhbnkgZGFtYWdlc1xuLy8gYXJpc2luZyBmcm9tIHRoZSB1c2Ugb2YgdGhpcyBzb2Z0d2FyZS5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGdyYW50ZWQgdG8gYW55b25lIHRvIHVzZSB0aGlzIHNvZnR3YXJlIGZvciBhbnkgcHVycG9zZSxcbi8vIGluY2x1ZGluZyBjb21tZXJjaWFsIGFwcGxpY2F0aW9ucywgYW5kIHRvIGFsdGVyIGl0IGFuZCByZWRpc3RyaWJ1dGUgaXRcbi8vIGZyZWVseSwgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nIHJlc3RyaWN0aW9uczpcbi8vXG4vLyAxLiBUaGUgb3JpZ2luIG9mIHRoaXMgc29mdHdhcmUgbXVzdCBub3QgYmUgbWlzcmVwcmVzZW50ZWQ7IHlvdSBtdXN0IG5vdFxuLy8gICBjbGFpbSB0aGF0IHlvdSB3cm90ZSB0aGUgb3JpZ2luYWwgc29mdHdhcmUuIElmIHlvdSB1c2UgdGhpcyBzb2Z0d2FyZVxuLy8gICBpbiBhIHByb2R1Y3QsIGFuIGFja25vd2xlZGdtZW50IGluIHRoZSBwcm9kdWN0IGRvY3VtZW50YXRpb24gd291bGQgYmVcbi8vICAgYXBwcmVjaWF0ZWQgYnV0IGlzIG5vdCByZXF1aXJlZC5cbi8vIDIuIEFsdGVyZWQgc291cmNlIHZlcnNpb25zIG11c3QgYmUgcGxhaW5seSBtYXJrZWQgYXMgc3VjaCwgYW5kIG11c3Qgbm90IGJlXG4vLyAgIG1pc3JlcHJlc2VudGVkIGFzIGJlaW5nIHRoZSBvcmlnaW5hbCBzb2Z0d2FyZS5cbi8vIDMuIFRoaXMgbm90aWNlIG1heSBub3QgYmUgcmVtb3ZlZCBvciBhbHRlcmVkIGZyb20gYW55IHNvdXJjZSBkaXN0cmlidXRpb24uXG5cbmZ1bmN0aW9uIFpTdHJlYW0oKSB7XG4gIC8qIG5leHQgaW5wdXQgYnl0ZSAqL1xuICB0aGlzLmlucHV0ID0gbnVsbDsgLy8gSlMgc3BlY2lmaWMsIGJlY2F1c2Ugd2UgaGF2ZSBubyBwb2ludGVyc1xuICB0aGlzLm5leHRfaW4gPSAwO1xuICAvKiBudW1iZXIgb2YgYnl0ZXMgYXZhaWxhYmxlIGF0IGlucHV0ICovXG4gIHRoaXMuYXZhaWxfaW4gPSAwO1xuICAvKiB0b3RhbCBudW1iZXIgb2YgaW5wdXQgYnl0ZXMgcmVhZCBzbyBmYXIgKi9cbiAgdGhpcy50b3RhbF9pbiA9IDA7XG4gIC8qIG5leHQgb3V0cHV0IGJ5dGUgc2hvdWxkIGJlIHB1dCB0aGVyZSAqL1xuICB0aGlzLm91dHB1dCA9IG51bGw7IC8vIEpTIHNwZWNpZmljLCBiZWNhdXNlIHdlIGhhdmUgbm8gcG9pbnRlcnNcbiAgdGhpcy5uZXh0X291dCA9IDA7XG4gIC8qIHJlbWFpbmluZyBmcmVlIHNwYWNlIGF0IG91dHB1dCAqL1xuICB0aGlzLmF2YWlsX291dCA9IDA7XG4gIC8qIHRvdGFsIG51bWJlciBvZiBieXRlcyBvdXRwdXQgc28gZmFyICovXG4gIHRoaXMudG90YWxfb3V0ID0gMDtcbiAgLyogbGFzdCBlcnJvciBtZXNzYWdlLCBOVUxMIGlmIG5vIGVycm9yICovXG4gIHRoaXMubXNnID0gJycvKlpfTlVMTCovO1xuICAvKiBub3QgdmlzaWJsZSBieSBhcHBsaWNhdGlvbnMgKi9cbiAgdGhpcy5zdGF0ZSA9IG51bGw7XG4gIC8qIGJlc3QgZ3Vlc3MgYWJvdXQgdGhlIGRhdGEgdHlwZTogYmluYXJ5IG9yIHRleHQgKi9cbiAgdGhpcy5kYXRhX3R5cGUgPSAyLypaX1VOS05PV04qLztcbiAgLyogYWRsZXIzMiB2YWx1ZSBvZiB0aGUgdW5jb21wcmVzc2VkIGRhdGEgKi9cbiAgdGhpcy5hZGxlciA9IDA7XG59XG5cbnZhciB6c3RyZWFtID0gWlN0cmVhbTtcblxuY29uc3QgdG9TdHJpbmckMSA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG5cbi8qIFB1YmxpYyBjb25zdGFudHMgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSovXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0qL1xuXG5jb25zdCB7XG4gIFpfTk9fRkxVU0g6IFpfTk9fRkxVU0gkMSwgWl9TWU5DX0ZMVVNILCBaX0ZVTExfRkxVU0gsIFpfRklOSVNIOiBaX0ZJTklTSCQyLFxuICBaX09LOiBaX09LJDIsIFpfU1RSRUFNX0VORDogWl9TVFJFQU1fRU5EJDIsXG4gIFpfREVGQVVMVF9DT01QUkVTU0lPTixcbiAgWl9ERUZBVUxUX1NUUkFURUdZLFxuICBaX0RFRkxBVEVEOiBaX0RFRkxBVEVEJDFcbn0gPSBjb25zdGFudHMkMjtcblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Ki9cblxuXG4vKipcbiAqIGNsYXNzIERlZmxhdGVcbiAqXG4gKiBHZW5lcmljIEpTLXN0eWxlIHdyYXBwZXIgZm9yIHpsaWIgY2FsbHMuIElmIHlvdSBkb24ndCBuZWVkXG4gKiBzdHJlYW1pbmcgYmVoYXZpb3VyIC0gdXNlIG1vcmUgc2ltcGxlIGZ1bmN0aW9uczogW1tkZWZsYXRlXV0sXG4gKiBbW2RlZmxhdGVSYXddXSBhbmQgW1tnemlwXV0uXG4gKiovXG5cbi8qIGludGVybmFsXG4gKiBEZWZsYXRlLmNodW5rcyAtPiBBcnJheVxuICpcbiAqIENodW5rcyBvZiBvdXRwdXQgZGF0YSwgaWYgW1tEZWZsYXRlI29uRGF0YV1dIG5vdCBvdmVycmlkZGVuLlxuICoqL1xuXG4vKipcbiAqIERlZmxhdGUucmVzdWx0IC0+IFVpbnQ4QXJyYXlcbiAqXG4gKiBDb21wcmVzc2VkIHJlc3VsdCwgZ2VuZXJhdGVkIGJ5IGRlZmF1bHQgW1tEZWZsYXRlI29uRGF0YV1dXG4gKiBhbmQgW1tEZWZsYXRlI29uRW5kXV0gaGFuZGxlcnMuIEZpbGxlZCBhZnRlciB5b3UgcHVzaCBsYXN0IGNodW5rXG4gKiAoY2FsbCBbW0RlZmxhdGUjcHVzaF1dIHdpdGggYFpfRklOSVNIYCAvIGB0cnVlYCBwYXJhbSkuXG4gKiovXG5cbi8qKlxuICogRGVmbGF0ZS5lcnIgLT4gTnVtYmVyXG4gKlxuICogRXJyb3IgY29kZSBhZnRlciBkZWZsYXRlIGZpbmlzaGVkLiAwIChaX09LKSBvbiBzdWNjZXNzLlxuICogWW91IHdpbGwgbm90IG5lZWQgaXQgaW4gcmVhbCBsaWZlLCBiZWNhdXNlIGRlZmxhdGUgZXJyb3JzXG4gKiBhcmUgcG9zc2libGUgb25seSBvbiB3cm9uZyBvcHRpb25zIG9yIGJhZCBgb25EYXRhYCAvIGBvbkVuZGBcbiAqIGN1c3RvbSBoYW5kbGVycy5cbiAqKi9cblxuLyoqXG4gKiBEZWZsYXRlLm1zZyAtPiBTdHJpbmdcbiAqXG4gKiBFcnJvciBtZXNzYWdlLCBpZiBbW0RlZmxhdGUuZXJyXV0gIT0gMFxuICoqL1xuXG5cbi8qKlxuICogbmV3IERlZmxhdGUob3B0aW9ucylcbiAqIC0gb3B0aW9ucyAoT2JqZWN0KTogemxpYiBkZWZsYXRlIG9wdGlvbnMuXG4gKlxuICogQ3JlYXRlcyBuZXcgZGVmbGF0b3IgaW5zdGFuY2Ugd2l0aCBzcGVjaWZpZWQgcGFyYW1zLiBUaHJvd3MgZXhjZXB0aW9uXG4gKiBvbiBiYWQgcGFyYW1zLiBTdXBwb3J0ZWQgb3B0aW9uczpcbiAqXG4gKiAtIGBsZXZlbGBcbiAqIC0gYHdpbmRvd0JpdHNgXG4gKiAtIGBtZW1MZXZlbGBcbiAqIC0gYHN0cmF0ZWd5YFxuICogLSBgZGljdGlvbmFyeWBcbiAqXG4gKiBbaHR0cDovL3psaWIubmV0L21hbnVhbC5odG1sI0FkdmFuY2VkXShodHRwOi8vemxpYi5uZXQvbWFudWFsLmh0bWwjQWR2YW5jZWQpXG4gKiBmb3IgbW9yZSBpbmZvcm1hdGlvbiBvbiB0aGVzZS5cbiAqXG4gKiBBZGRpdGlvbmFsIG9wdGlvbnMsIGZvciBpbnRlcm5hbCBuZWVkczpcbiAqXG4gKiAtIGBjaHVua1NpemVgIC0gc2l6ZSBvZiBnZW5lcmF0ZWQgZGF0YSBjaHVua3MgKDE2SyBieSBkZWZhdWx0KVxuICogLSBgcmF3YCAoQm9vbGVhbikgLSBkbyByYXcgZGVmbGF0ZVxuICogLSBgZ3ppcGAgKEJvb2xlYW4pIC0gY3JlYXRlIGd6aXAgd3JhcHBlclxuICogLSBgaGVhZGVyYCAoT2JqZWN0KSAtIGN1c3RvbSBoZWFkZXIgZm9yIGd6aXBcbiAqICAgLSBgdGV4dGAgKEJvb2xlYW4pIC0gdHJ1ZSBpZiBjb21wcmVzc2VkIGRhdGEgYmVsaWV2ZWQgdG8gYmUgdGV4dFxuICogICAtIGB0aW1lYCAoTnVtYmVyKSAtIG1vZGlmaWNhdGlvbiB0aW1lLCB1bml4IHRpbWVzdGFtcFxuICogICAtIGBvc2AgKE51bWJlcikgLSBvcGVyYXRpb24gc3lzdGVtIGNvZGVcbiAqICAgLSBgZXh0cmFgIChBcnJheSkgLSBhcnJheSBvZiBieXRlcyB3aXRoIGV4dHJhIGRhdGEgKG1heCA2NTUzNilcbiAqICAgLSBgbmFtZWAgKFN0cmluZykgLSBmaWxlIG5hbWUgKGJpbmFyeSBzdHJpbmcpXG4gKiAgIC0gYGNvbW1lbnRgIChTdHJpbmcpIC0gY29tbWVudCAoYmluYXJ5IHN0cmluZylcbiAqICAgLSBgaGNyY2AgKEJvb2xlYW4pIC0gdHJ1ZSBpZiBoZWFkZXIgY3JjIHNob3VsZCBiZSBhZGRlZFxuICpcbiAqICMjIyMjIEV4YW1wbGU6XG4gKlxuICogYGBgamF2YXNjcmlwdFxuICogY29uc3QgcGFrbyA9IHJlcXVpcmUoJ3Bha28nKVxuICogICAsIGNodW5rMSA9IG5ldyBVaW50OEFycmF5KFsxLDIsMyw0LDUsNiw3LDgsOV0pXG4gKiAgICwgY2h1bmsyID0gbmV3IFVpbnQ4QXJyYXkoWzEwLDExLDEyLDEzLDE0LDE1LDE2LDE3LDE4LDE5XSk7XG4gKlxuICogY29uc3QgZGVmbGF0ZSA9IG5ldyBwYWtvLkRlZmxhdGUoeyBsZXZlbDogM30pO1xuICpcbiAqIGRlZmxhdGUucHVzaChjaHVuazEsIGZhbHNlKTtcbiAqIGRlZmxhdGUucHVzaChjaHVuazIsIHRydWUpOyAgLy8gdHJ1ZSAtPiBsYXN0IGNodW5rXG4gKlxuICogaWYgKGRlZmxhdGUuZXJyKSB7IHRocm93IG5ldyBFcnJvcihkZWZsYXRlLmVycik7IH1cbiAqXG4gKiBjb25zb2xlLmxvZyhkZWZsYXRlLnJlc3VsdCk7XG4gKiBgYGBcbiAqKi9cbmZ1bmN0aW9uIERlZmxhdGUkMShvcHRpb25zKSB7XG4gIHRoaXMub3B0aW9ucyA9IGNvbW1vbi5hc3NpZ24oe1xuICAgIGxldmVsOiBaX0RFRkFVTFRfQ09NUFJFU1NJT04sXG4gICAgbWV0aG9kOiBaX0RFRkxBVEVEJDEsXG4gICAgY2h1bmtTaXplOiAxNjM4NCxcbiAgICB3aW5kb3dCaXRzOiAxNSxcbiAgICBtZW1MZXZlbDogOCxcbiAgICBzdHJhdGVneTogWl9ERUZBVUxUX1NUUkFURUdZXG4gIH0sIG9wdGlvbnMgfHwge30pO1xuXG4gIGxldCBvcHQgPSB0aGlzLm9wdGlvbnM7XG5cbiAgaWYgKG9wdC5yYXcgJiYgKG9wdC53aW5kb3dCaXRzID4gMCkpIHtcbiAgICBvcHQud2luZG93Qml0cyA9IC1vcHQud2luZG93Qml0cztcbiAgfVxuXG4gIGVsc2UgaWYgKG9wdC5nemlwICYmIChvcHQud2luZG93Qml0cyA+IDApICYmIChvcHQud2luZG93Qml0cyA8IDE2KSkge1xuICAgIG9wdC53aW5kb3dCaXRzICs9IDE2O1xuICB9XG5cbiAgdGhpcy5lcnIgICAgPSAwOyAgICAgIC8vIGVycm9yIGNvZGUsIGlmIGhhcHBlbnMgKDAgPSBaX09LKVxuICB0aGlzLm1zZyAgICA9ICcnOyAgICAgLy8gZXJyb3IgbWVzc2FnZVxuICB0aGlzLmVuZGVkICA9IGZhbHNlOyAgLy8gdXNlZCB0byBhdm9pZCBtdWx0aXBsZSBvbkVuZCgpIGNhbGxzXG4gIHRoaXMuY2h1bmtzID0gW107ICAgICAvLyBjaHVua3Mgb2YgY29tcHJlc3NlZCBkYXRhXG5cbiAgdGhpcy5zdHJtID0gbmV3IHpzdHJlYW0oKTtcbiAgdGhpcy5zdHJtLmF2YWlsX291dCA9IDA7XG5cbiAgbGV0IHN0YXR1cyA9IGRlZmxhdGVfMSQyLmRlZmxhdGVJbml0MihcbiAgICB0aGlzLnN0cm0sXG4gICAgb3B0LmxldmVsLFxuICAgIG9wdC5tZXRob2QsXG4gICAgb3B0LndpbmRvd0JpdHMsXG4gICAgb3B0Lm1lbUxldmVsLFxuICAgIG9wdC5zdHJhdGVneVxuICApO1xuXG4gIGlmIChzdGF0dXMgIT09IFpfT0skMikge1xuICAgIHRocm93IG5ldyBFcnJvcihtZXNzYWdlc1tzdGF0dXNdKTtcbiAgfVxuXG4gIGlmIChvcHQuaGVhZGVyKSB7XG4gICAgZGVmbGF0ZV8xJDIuZGVmbGF0ZVNldEhlYWRlcih0aGlzLnN0cm0sIG9wdC5oZWFkZXIpO1xuICB9XG5cbiAgaWYgKG9wdC5kaWN0aW9uYXJ5KSB7XG4gICAgbGV0IGRpY3Q7XG4gICAgLy8gQ29udmVydCBkYXRhIGlmIG5lZWRlZFxuICAgIGlmICh0eXBlb2Ygb3B0LmRpY3Rpb25hcnkgPT09ICdzdHJpbmcnKSB7XG4gICAgICAvLyBJZiB3ZSBuZWVkIHRvIGNvbXByZXNzIHRleHQsIGNoYW5nZSBlbmNvZGluZyB0byB1dGY4LlxuICAgICAgZGljdCA9IHN0cmluZ3Muc3RyaW5nMmJ1ZihvcHQuZGljdGlvbmFyeSk7XG4gICAgfSBlbHNlIGlmICh0b1N0cmluZyQxLmNhbGwob3B0LmRpY3Rpb25hcnkpID09PSAnW29iamVjdCBBcnJheUJ1ZmZlcl0nKSB7XG4gICAgICBkaWN0ID0gbmV3IFVpbnQ4QXJyYXkob3B0LmRpY3Rpb25hcnkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBkaWN0ID0gb3B0LmRpY3Rpb25hcnk7XG4gICAgfVxuXG4gICAgc3RhdHVzID0gZGVmbGF0ZV8xJDIuZGVmbGF0ZVNldERpY3Rpb25hcnkodGhpcy5zdHJtLCBkaWN0KTtcblxuICAgIGlmIChzdGF0dXMgIT09IFpfT0skMikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKG1lc3NhZ2VzW3N0YXR1c10pO1xuICAgIH1cblxuICAgIHRoaXMuX2RpY3Rfc2V0ID0gdHJ1ZTtcbiAgfVxufVxuXG4vKipcbiAqIERlZmxhdGUjcHVzaChkYXRhWywgZmx1c2hfbW9kZV0pIC0+IEJvb2xlYW5cbiAqIC0gZGF0YSAoVWludDhBcnJheXxBcnJheUJ1ZmZlcnxTdHJpbmcpOiBpbnB1dCBkYXRhLiBTdHJpbmdzIHdpbGwgYmVcbiAqICAgY29udmVydGVkIHRvIHV0ZjggYnl0ZSBzZXF1ZW5jZS5cbiAqIC0gZmx1c2hfbW9kZSAoTnVtYmVyfEJvb2xlYW4pOiAwLi42IGZvciBjb3JyZXNwb25kaW5nIFpfTk9fRkxVU0guLlpfVFJFRSBtb2Rlcy5cbiAqICAgU2VlIGNvbnN0YW50cy4gU2tpcHBlZCBvciBgZmFsc2VgIG1lYW5zIFpfTk9fRkxVU0gsIGB0cnVlYCBtZWFucyBaX0ZJTklTSC5cbiAqXG4gKiBTZW5kcyBpbnB1dCBkYXRhIHRvIGRlZmxhdGUgcGlwZSwgZ2VuZXJhdGluZyBbW0RlZmxhdGUjb25EYXRhXV0gY2FsbHMgd2l0aFxuICogbmV3IGNvbXByZXNzZWQgY2h1bmtzLiBSZXR1cm5zIGB0cnVlYCBvbiBzdWNjZXNzLiBUaGUgbGFzdCBkYXRhIGJsb2NrIG11c3RcbiAqIGhhdmUgYGZsdXNoX21vZGVgIFpfRklOSVNIIChvciBgdHJ1ZWApLiBUaGF0IHdpbGwgZmx1c2ggaW50ZXJuYWwgcGVuZGluZ1xuICogYnVmZmVycyBhbmQgY2FsbCBbW0RlZmxhdGUjb25FbmRdXS5cbiAqXG4gKiBPbiBmYWlsIGNhbGwgW1tEZWZsYXRlI29uRW5kXV0gd2l0aCBlcnJvciBjb2RlIGFuZCByZXR1cm4gZmFsc2UuXG4gKlxuICogIyMjIyMgRXhhbXBsZVxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqIHB1c2goY2h1bmssIGZhbHNlKTsgLy8gcHVzaCBvbmUgb2YgZGF0YSBjaHVua3NcbiAqIC4uLlxuICogcHVzaChjaHVuaywgdHJ1ZSk7ICAvLyBwdXNoIGxhc3QgY2h1bmtcbiAqIGBgYFxuICoqL1xuRGVmbGF0ZSQxLnByb3RvdHlwZS5wdXNoID0gZnVuY3Rpb24gKGRhdGEsIGZsdXNoX21vZGUpIHtcbiAgY29uc3Qgc3RybSA9IHRoaXMuc3RybTtcbiAgY29uc3QgY2h1bmtTaXplID0gdGhpcy5vcHRpb25zLmNodW5rU2l6ZTtcbiAgbGV0IHN0YXR1cywgX2ZsdXNoX21vZGU7XG5cbiAgaWYgKHRoaXMuZW5kZWQpIHsgcmV0dXJuIGZhbHNlOyB9XG5cbiAgaWYgKGZsdXNoX21vZGUgPT09IH5+Zmx1c2hfbW9kZSkgX2ZsdXNoX21vZGUgPSBmbHVzaF9tb2RlO1xuICBlbHNlIF9mbHVzaF9tb2RlID0gZmx1c2hfbW9kZSA9PT0gdHJ1ZSA/IFpfRklOSVNIJDIgOiBaX05PX0ZMVVNIJDE7XG5cbiAgLy8gQ29udmVydCBkYXRhIGlmIG5lZWRlZFxuICBpZiAodHlwZW9mIGRhdGEgPT09ICdzdHJpbmcnKSB7XG4gICAgLy8gSWYgd2UgbmVlZCB0byBjb21wcmVzcyB0ZXh0LCBjaGFuZ2UgZW5jb2RpbmcgdG8gdXRmOC5cbiAgICBzdHJtLmlucHV0ID0gc3RyaW5ncy5zdHJpbmcyYnVmKGRhdGEpO1xuICB9IGVsc2UgaWYgKHRvU3RyaW5nJDEuY2FsbChkYXRhKSA9PT0gJ1tvYmplY3QgQXJyYXlCdWZmZXJdJykge1xuICAgIHN0cm0uaW5wdXQgPSBuZXcgVWludDhBcnJheShkYXRhKTtcbiAgfSBlbHNlIHtcbiAgICBzdHJtLmlucHV0ID0gZGF0YTtcbiAgfVxuXG4gIHN0cm0ubmV4dF9pbiA9IDA7XG4gIHN0cm0uYXZhaWxfaW4gPSBzdHJtLmlucHV0Lmxlbmd0aDtcblxuICBmb3IgKDs7KSB7XG4gICAgaWYgKHN0cm0uYXZhaWxfb3V0ID09PSAwKSB7XG4gICAgICBzdHJtLm91dHB1dCA9IG5ldyBVaW50OEFycmF5KGNodW5rU2l6ZSk7XG4gICAgICBzdHJtLm5leHRfb3V0ID0gMDtcbiAgICAgIHN0cm0uYXZhaWxfb3V0ID0gY2h1bmtTaXplO1xuICAgIH1cblxuICAgIC8vIE1ha2Ugc3VyZSBhdmFpbF9vdXQgPiA2IHRvIGF2b2lkIHJlcGVhdGluZyBtYXJrZXJzXG4gICAgaWYgKChfZmx1c2hfbW9kZSA9PT0gWl9TWU5DX0ZMVVNIIHx8IF9mbHVzaF9tb2RlID09PSBaX0ZVTExfRkxVU0gpICYmIHN0cm0uYXZhaWxfb3V0IDw9IDYpIHtcbiAgICAgIHRoaXMub25EYXRhKHN0cm0ub3V0cHV0LnN1YmFycmF5KDAsIHN0cm0ubmV4dF9vdXQpKTtcbiAgICAgIHN0cm0uYXZhaWxfb3V0ID0gMDtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIHN0YXR1cyA9IGRlZmxhdGVfMSQyLmRlZmxhdGUoc3RybSwgX2ZsdXNoX21vZGUpO1xuXG4gICAgLy8gRW5kZWQgPT4gZmx1c2ggYW5kIGZpbmlzaFxuICAgIGlmIChzdGF0dXMgPT09IFpfU1RSRUFNX0VORCQyKSB7XG4gICAgICBpZiAoc3RybS5uZXh0X291dCA+IDApIHtcbiAgICAgICAgdGhpcy5vbkRhdGEoc3RybS5vdXRwdXQuc3ViYXJyYXkoMCwgc3RybS5uZXh0X291dCkpO1xuICAgICAgfVxuICAgICAgc3RhdHVzID0gZGVmbGF0ZV8xJDIuZGVmbGF0ZUVuZCh0aGlzLnN0cm0pO1xuICAgICAgdGhpcy5vbkVuZChzdGF0dXMpO1xuICAgICAgdGhpcy5lbmRlZCA9IHRydWU7XG4gICAgICByZXR1cm4gc3RhdHVzID09PSBaX09LJDI7XG4gICAgfVxuXG4gICAgLy8gRmx1c2ggaWYgb3V0IGJ1ZmZlciBmdWxsXG4gICAgaWYgKHN0cm0uYXZhaWxfb3V0ID09PSAwKSB7XG4gICAgICB0aGlzLm9uRGF0YShzdHJtLm91dHB1dCk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyBGbHVzaCBpZiByZXF1ZXN0ZWQgYW5kIGhhcyBkYXRhXG4gICAgaWYgKF9mbHVzaF9tb2RlID4gMCAmJiBzdHJtLm5leHRfb3V0ID4gMCkge1xuICAgICAgdGhpcy5vbkRhdGEoc3RybS5vdXRwdXQuc3ViYXJyYXkoMCwgc3RybS5uZXh0X291dCkpO1xuICAgICAgc3RybS5hdmFpbF9vdXQgPSAwO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgaWYgKHN0cm0uYXZhaWxfaW4gPT09IDApIGJyZWFrO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5cbi8qKlxuICogRGVmbGF0ZSNvbkRhdGEoY2h1bmspIC0+IFZvaWRcbiAqIC0gY2h1bmsgKFVpbnQ4QXJyYXkpOiBvdXRwdXQgZGF0YS5cbiAqXG4gKiBCeSBkZWZhdWx0LCBzdG9yZXMgZGF0YSBibG9ja3MgaW4gYGNodW5rc1tdYCBwcm9wZXJ0eSBhbmQgZ2x1ZVxuICogdGhvc2UgaW4gYG9uRW5kYC4gT3ZlcnJpZGUgdGhpcyBoYW5kbGVyLCBpZiB5b3UgbmVlZCBhbm90aGVyIGJlaGF2aW91ci5cbiAqKi9cbkRlZmxhdGUkMS5wcm90b3R5cGUub25EYXRhID0gZnVuY3Rpb24gKGNodW5rKSB7XG4gIHRoaXMuY2h1bmtzLnB1c2goY2h1bmspO1xufTtcblxuXG4vKipcbiAqIERlZmxhdGUjb25FbmQoc3RhdHVzKSAtPiBWb2lkXG4gKiAtIHN0YXR1cyAoTnVtYmVyKTogZGVmbGF0ZSBzdGF0dXMuIDAgKFpfT0spIG9uIHN1Y2Nlc3MsXG4gKiAgIG90aGVyIGlmIG5vdC5cbiAqXG4gKiBDYWxsZWQgb25jZSBhZnRlciB5b3UgdGVsbCBkZWZsYXRlIHRoYXQgdGhlIGlucHV0IHN0cmVhbSBpc1xuICogY29tcGxldGUgKFpfRklOSVNIKS4gQnkgZGVmYXVsdCAtIGpvaW4gY29sbGVjdGVkIGNodW5rcyxcbiAqIGZyZWUgbWVtb3J5IGFuZCBmaWxsIGByZXN1bHRzYCAvIGBlcnJgIHByb3BlcnRpZXMuXG4gKiovXG5EZWZsYXRlJDEucHJvdG90eXBlLm9uRW5kID0gZnVuY3Rpb24gKHN0YXR1cykge1xuICAvLyBPbiBzdWNjZXNzIC0gam9pblxuICBpZiAoc3RhdHVzID09PSBaX09LJDIpIHtcbiAgICB0aGlzLnJlc3VsdCA9IGNvbW1vbi5mbGF0dGVuQ2h1bmtzKHRoaXMuY2h1bmtzKTtcbiAgfVxuICB0aGlzLmNodW5rcyA9IFtdO1xuICB0aGlzLmVyciA9IHN0YXR1cztcbiAgdGhpcy5tc2cgPSB0aGlzLnN0cm0ubXNnO1xufTtcblxuXG4vKipcbiAqIGRlZmxhdGUoZGF0YVssIG9wdGlvbnNdKSAtPiBVaW50OEFycmF5XG4gKiAtIGRhdGEgKFVpbnQ4QXJyYXl8QXJyYXlCdWZmZXJ8U3RyaW5nKTogaW5wdXQgZGF0YSB0byBjb21wcmVzcy5cbiAqIC0gb3B0aW9ucyAoT2JqZWN0KTogemxpYiBkZWZsYXRlIG9wdGlvbnMuXG4gKlxuICogQ29tcHJlc3MgYGRhdGFgIHdpdGggZGVmbGF0ZSBhbGdvcml0aG0gYW5kIGBvcHRpb25zYC5cbiAqXG4gKiBTdXBwb3J0ZWQgb3B0aW9ucyBhcmU6XG4gKlxuICogLSBsZXZlbFxuICogLSB3aW5kb3dCaXRzXG4gKiAtIG1lbUxldmVsXG4gKiAtIHN0cmF0ZWd5XG4gKiAtIGRpY3Rpb25hcnlcbiAqXG4gKiBbaHR0cDovL3psaWIubmV0L21hbnVhbC5odG1sI0FkdmFuY2VkXShodHRwOi8vemxpYi5uZXQvbWFudWFsLmh0bWwjQWR2YW5jZWQpXG4gKiBmb3IgbW9yZSBpbmZvcm1hdGlvbiBvbiB0aGVzZS5cbiAqXG4gKiBTdWdhciAob3B0aW9ucyk6XG4gKlxuICogLSBgcmF3YCAoQm9vbGVhbikgLSBzYXkgdGhhdCB3ZSB3b3JrIHdpdGggcmF3IHN0cmVhbSwgaWYgeW91IGRvbid0IHdpc2ggdG8gc3BlY2lmeVxuICogICBuZWdhdGl2ZSB3aW5kb3dCaXRzIGltcGxpY2l0bHkuXG4gKlxuICogIyMjIyMgRXhhbXBsZTpcbiAqXG4gKiBgYGBqYXZhc2NyaXB0XG4gKiBjb25zdCBwYWtvID0gcmVxdWlyZSgncGFrbycpXG4gKiBjb25zdCBkYXRhID0gbmV3IFVpbnQ4QXJyYXkoWzEsMiwzLDQsNSw2LDcsOCw5XSk7XG4gKlxuICogY29uc29sZS5sb2cocGFrby5kZWZsYXRlKGRhdGEpKTtcbiAqIGBgYFxuICoqL1xuZnVuY3Rpb24gZGVmbGF0ZSQxKGlucHV0LCBvcHRpb25zKSB7XG4gIGNvbnN0IGRlZmxhdG9yID0gbmV3IERlZmxhdGUkMShvcHRpb25zKTtcblxuICBkZWZsYXRvci5wdXNoKGlucHV0LCB0cnVlKTtcblxuICAvLyBUaGF0IHdpbGwgbmV2ZXIgaGFwcGVucywgaWYgeW91IGRvbid0IGNoZWF0IHdpdGggb3B0aW9ucyA6KVxuICBpZiAoZGVmbGF0b3IuZXJyKSB7IHRocm93IGRlZmxhdG9yLm1zZyB8fCBtZXNzYWdlc1tkZWZsYXRvci5lcnJdOyB9XG5cbiAgcmV0dXJuIGRlZmxhdG9yLnJlc3VsdDtcbn1cblxuXG4vKipcbiAqIGRlZmxhdGVSYXcoZGF0YVssIG9wdGlvbnNdKSAtPiBVaW50OEFycmF5XG4gKiAtIGRhdGEgKFVpbnQ4QXJyYXl8QXJyYXlCdWZmZXJ8U3RyaW5nKTogaW5wdXQgZGF0YSB0byBjb21wcmVzcy5cbiAqIC0gb3B0aW9ucyAoT2JqZWN0KTogemxpYiBkZWZsYXRlIG9wdGlvbnMuXG4gKlxuICogVGhlIHNhbWUgYXMgW1tkZWZsYXRlXV0sIGJ1dCBjcmVhdGVzIHJhdyBkYXRhLCB3aXRob3V0IHdyYXBwZXJcbiAqIChoZWFkZXIgYW5kIGFkbGVyMzIgY3JjKS5cbiAqKi9cbmZ1bmN0aW9uIGRlZmxhdGVSYXckMShpbnB1dCwgb3B0aW9ucykge1xuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgb3B0aW9ucy5yYXcgPSB0cnVlO1xuICByZXR1cm4gZGVmbGF0ZSQxKGlucHV0LCBvcHRpb25zKTtcbn1cblxuXG4vKipcbiAqIGd6aXAoZGF0YVssIG9wdGlvbnNdKSAtPiBVaW50OEFycmF5XG4gKiAtIGRhdGEgKFVpbnQ4QXJyYXl8QXJyYXlCdWZmZXJ8U3RyaW5nKTogaW5wdXQgZGF0YSB0byBjb21wcmVzcy5cbiAqIC0gb3B0aW9ucyAoT2JqZWN0KTogemxpYiBkZWZsYXRlIG9wdGlvbnMuXG4gKlxuICogVGhlIHNhbWUgYXMgW1tkZWZsYXRlXV0sIGJ1dCBjcmVhdGUgZ3ppcCB3cmFwcGVyIGluc3RlYWQgb2ZcbiAqIGRlZmxhdGUgb25lLlxuICoqL1xuZnVuY3Rpb24gZ3ppcCQxKGlucHV0LCBvcHRpb25zKSB7XG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICBvcHRpb25zLmd6aXAgPSB0cnVlO1xuICByZXR1cm4gZGVmbGF0ZSQxKGlucHV0LCBvcHRpb25zKTtcbn1cblxuXG52YXIgRGVmbGF0ZV8xJDEgPSBEZWZsYXRlJDE7XG52YXIgZGVmbGF0ZV8yID0gZGVmbGF0ZSQxO1xudmFyIGRlZmxhdGVSYXdfMSQxID0gZGVmbGF0ZVJhdyQxO1xudmFyIGd6aXBfMSQxID0gZ3ppcCQxO1xudmFyIGNvbnN0YW50cyQxID0gY29uc3RhbnRzJDI7XG5cbnZhciBkZWZsYXRlXzEkMSA9IHtcblx0RGVmbGF0ZTogRGVmbGF0ZV8xJDEsXG5cdGRlZmxhdGU6IGRlZmxhdGVfMixcblx0ZGVmbGF0ZVJhdzogZGVmbGF0ZVJhd18xJDEsXG5cdGd6aXA6IGd6aXBfMSQxLFxuXHRjb25zdGFudHM6IGNvbnN0YW50cyQxXG59O1xuXG4vLyAoQykgMTk5NS0yMDEzIEplYW4tbG91cCBHYWlsbHkgYW5kIE1hcmsgQWRsZXJcbi8vIChDKSAyMDE0LTIwMTcgVml0YWx5IFB1enJpbiBhbmQgQW5kcmV5IFR1cGl0c2luXG4vL1xuLy8gVGhpcyBzb2Z0d2FyZSBpcyBwcm92aWRlZCAnYXMtaXMnLCB3aXRob3V0IGFueSBleHByZXNzIG9yIGltcGxpZWRcbi8vIHdhcnJhbnR5LiBJbiBubyBldmVudCB3aWxsIHRoZSBhdXRob3JzIGJlIGhlbGQgbGlhYmxlIGZvciBhbnkgZGFtYWdlc1xuLy8gYXJpc2luZyBmcm9tIHRoZSB1c2Ugb2YgdGhpcyBzb2Z0d2FyZS5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGdyYW50ZWQgdG8gYW55b25lIHRvIHVzZSB0aGlzIHNvZnR3YXJlIGZvciBhbnkgcHVycG9zZSxcbi8vIGluY2x1ZGluZyBjb21tZXJjaWFsIGFwcGxpY2F0aW9ucywgYW5kIHRvIGFsdGVyIGl0IGFuZCByZWRpc3RyaWJ1dGUgaXRcbi8vIGZyZWVseSwgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nIHJlc3RyaWN0aW9uczpcbi8vXG4vLyAxLiBUaGUgb3JpZ2luIG9mIHRoaXMgc29mdHdhcmUgbXVzdCBub3QgYmUgbWlzcmVwcmVzZW50ZWQ7IHlvdSBtdXN0IG5vdFxuLy8gICBjbGFpbSB0aGF0IHlvdSB3cm90ZSB0aGUgb3JpZ2luYWwgc29mdHdhcmUuIElmIHlvdSB1c2UgdGhpcyBzb2Z0d2FyZVxuLy8gICBpbiBhIHByb2R1Y3QsIGFuIGFja25vd2xlZGdtZW50IGluIHRoZSBwcm9kdWN0IGRvY3VtZW50YXRpb24gd291bGQgYmVcbi8vICAgYXBwcmVjaWF0ZWQgYnV0IGlzIG5vdCByZXF1aXJlZC5cbi8vIDIuIEFsdGVyZWQgc291cmNlIHZlcnNpb25zIG11c3QgYmUgcGxhaW5seSBtYXJrZWQgYXMgc3VjaCwgYW5kIG11c3Qgbm90IGJlXG4vLyAgIG1pc3JlcHJlc2VudGVkIGFzIGJlaW5nIHRoZSBvcmlnaW5hbCBzb2Z0d2FyZS5cbi8vIDMuIFRoaXMgbm90aWNlIG1heSBub3QgYmUgcmVtb3ZlZCBvciBhbHRlcmVkIGZyb20gYW55IHNvdXJjZSBkaXN0cmlidXRpb24uXG5cbi8vIFNlZSBzdGF0ZSBkZWZzIGZyb20gaW5mbGF0ZS5qc1xuY29uc3QgQkFEJDEgPSAxNjIwOTsgICAgICAgLyogZ290IGEgZGF0YSBlcnJvciAtLSByZW1haW4gaGVyZSB1bnRpbCByZXNldCAqL1xuY29uc3QgVFlQRSQxID0gMTYxOTE7ICAgICAgLyogaTogd2FpdGluZyBmb3IgdHlwZSBiaXRzLCBpbmNsdWRpbmcgbGFzdC1mbGFnIGJpdCAqL1xuXG4vKlxuICAgRGVjb2RlIGxpdGVyYWwsIGxlbmd0aCwgYW5kIGRpc3RhbmNlIGNvZGVzIGFuZCB3cml0ZSBvdXQgdGhlIHJlc3VsdGluZ1xuICAgbGl0ZXJhbCBhbmQgbWF0Y2ggYnl0ZXMgdW50aWwgZWl0aGVyIG5vdCBlbm91Z2ggaW5wdXQgb3Igb3V0cHV0IGlzXG4gICBhdmFpbGFibGUsIGFuIGVuZC1vZi1ibG9jayBpcyBlbmNvdW50ZXJlZCwgb3IgYSBkYXRhIGVycm9yIGlzIGVuY291bnRlcmVkLlxuICAgV2hlbiBsYXJnZSBlbm91Z2ggaW5wdXQgYW5kIG91dHB1dCBidWZmZXJzIGFyZSBzdXBwbGllZCB0byBpbmZsYXRlKCksIGZvclxuICAgZXhhbXBsZSwgYSAxNksgaW5wdXQgYnVmZmVyIGFuZCBhIDY0SyBvdXRwdXQgYnVmZmVyLCBtb3JlIHRoYW4gOTUlIG9mIHRoZVxuICAgaW5mbGF0ZSBleGVjdXRpb24gdGltZSBpcyBzcGVudCBpbiB0aGlzIHJvdXRpbmUuXG5cbiAgIEVudHJ5IGFzc3VtcHRpb25zOlxuXG4gICAgICAgIHN0YXRlLm1vZGUgPT09IExFTlxuICAgICAgICBzdHJtLmF2YWlsX2luID49IDZcbiAgICAgICAgc3RybS5hdmFpbF9vdXQgPj0gMjU4XG4gICAgICAgIHN0YXJ0ID49IHN0cm0uYXZhaWxfb3V0XG4gICAgICAgIHN0YXRlLmJpdHMgPCA4XG5cbiAgIE9uIHJldHVybiwgc3RhdGUubW9kZSBpcyBvbmUgb2Y6XG5cbiAgICAgICAgTEVOIC0tIHJhbiBvdXQgb2YgZW5vdWdoIG91dHB1dCBzcGFjZSBvciBlbm91Z2ggYXZhaWxhYmxlIGlucHV0XG4gICAgICAgIFRZUEUgLS0gcmVhY2hlZCBlbmQgb2YgYmxvY2sgY29kZSwgaW5mbGF0ZSgpIHRvIGludGVycHJldCBuZXh0IGJsb2NrXG4gICAgICAgIEJBRCAtLSBlcnJvciBpbiBibG9jayBkYXRhXG5cbiAgIE5vdGVzOlxuXG4gICAgLSBUaGUgbWF4aW11bSBpbnB1dCBiaXRzIHVzZWQgYnkgYSBsZW5ndGgvZGlzdGFuY2UgcGFpciBpcyAxNSBiaXRzIGZvciB0aGVcbiAgICAgIGxlbmd0aCBjb2RlLCA1IGJpdHMgZm9yIHRoZSBsZW5ndGggZXh0cmEsIDE1IGJpdHMgZm9yIHRoZSBkaXN0YW5jZSBjb2RlLFxuICAgICAgYW5kIDEzIGJpdHMgZm9yIHRoZSBkaXN0YW5jZSBleHRyYS4gIFRoaXMgdG90YWxzIDQ4IGJpdHMsIG9yIHNpeCBieXRlcy5cbiAgICAgIFRoZXJlZm9yZSBpZiBzdHJtLmF2YWlsX2luID49IDYsIHRoZW4gdGhlcmUgaXMgZW5vdWdoIGlucHV0IHRvIGF2b2lkXG4gICAgICBjaGVja2luZyBmb3IgYXZhaWxhYmxlIGlucHV0IHdoaWxlIGRlY29kaW5nLlxuXG4gICAgLSBUaGUgbWF4aW11bSBieXRlcyB0aGF0IGEgc2luZ2xlIGxlbmd0aC9kaXN0YW5jZSBwYWlyIGNhbiBvdXRwdXQgaXMgMjU4XG4gICAgICBieXRlcywgd2hpY2ggaXMgdGhlIG1heGltdW0gbGVuZ3RoIHRoYXQgY2FuIGJlIGNvZGVkLiAgaW5mbGF0ZV9mYXN0KClcbiAgICAgIHJlcXVpcmVzIHN0cm0uYXZhaWxfb3V0ID49IDI1OCBmb3IgZWFjaCBsb29wIHRvIGF2b2lkIGNoZWNraW5nIGZvclxuICAgICAgb3V0cHV0IHNwYWNlLlxuICovXG52YXIgaW5mZmFzdCA9IGZ1bmN0aW9uIGluZmxhdGVfZmFzdChzdHJtLCBzdGFydCkge1xuICBsZXQgX2luOyAgICAgICAgICAgICAgICAgICAgLyogbG9jYWwgc3RybS5pbnB1dCAqL1xuICBsZXQgbGFzdDsgICAgICAgICAgICAgICAgICAgLyogaGF2ZSBlbm91Z2ggaW5wdXQgd2hpbGUgaW4gPCBsYXN0ICovXG4gIGxldCBfb3V0OyAgICAgICAgICAgICAgICAgICAvKiBsb2NhbCBzdHJtLm91dHB1dCAqL1xuICBsZXQgYmVnOyAgICAgICAgICAgICAgICAgICAgLyogaW5mbGF0ZSgpJ3MgaW5pdGlhbCBzdHJtLm91dHB1dCAqL1xuICBsZXQgZW5kOyAgICAgICAgICAgICAgICAgICAgLyogd2hpbGUgb3V0IDwgZW5kLCBlbm91Z2ggc3BhY2UgYXZhaWxhYmxlICovXG4vLyNpZmRlZiBJTkZMQVRFX1NUUklDVFxuICBsZXQgZG1heDsgICAgICAgICAgICAgICAgICAgLyogbWF4aW11bSBkaXN0YW5jZSBmcm9tIHpsaWIgaGVhZGVyICovXG4vLyNlbmRpZlxuICBsZXQgd3NpemU7ICAgICAgICAgICAgICAgICAgLyogd2luZG93IHNpemUgb3IgemVybyBpZiBub3QgdXNpbmcgd2luZG93ICovXG4gIGxldCB3aGF2ZTsgICAgICAgICAgICAgICAgICAvKiB2YWxpZCBieXRlcyBpbiB0aGUgd2luZG93ICovXG4gIGxldCB3bmV4dDsgICAgICAgICAgICAgICAgICAvKiB3aW5kb3cgd3JpdGUgaW5kZXggKi9cbiAgLy8gVXNlIGBzX3dpbmRvd2AgaW5zdGVhZCBgd2luZG93YCwgYXZvaWQgY29uZmxpY3Qgd2l0aCBpbnN0cnVtZW50YXRpb24gdG9vbHNcbiAgbGV0IHNfd2luZG93OyAgICAgICAgICAgICAgIC8qIGFsbG9jYXRlZCBzbGlkaW5nIHdpbmRvdywgaWYgd3NpemUgIT0gMCAqL1xuICBsZXQgaG9sZDsgICAgICAgICAgICAgICAgICAgLyogbG9jYWwgc3RybS5ob2xkICovXG4gIGxldCBiaXRzOyAgICAgICAgICAgICAgICAgICAvKiBsb2NhbCBzdHJtLmJpdHMgKi9cbiAgbGV0IGxjb2RlOyAgICAgICAgICAgICAgICAgIC8qIGxvY2FsIHN0cm0ubGVuY29kZSAqL1xuICBsZXQgZGNvZGU7ICAgICAgICAgICAgICAgICAgLyogbG9jYWwgc3RybS5kaXN0Y29kZSAqL1xuICBsZXQgbG1hc2s7ICAgICAgICAgICAgICAgICAgLyogbWFzayBmb3IgZmlyc3QgbGV2ZWwgb2YgbGVuZ3RoIGNvZGVzICovXG4gIGxldCBkbWFzazsgICAgICAgICAgICAgICAgICAvKiBtYXNrIGZvciBmaXJzdCBsZXZlbCBvZiBkaXN0YW5jZSBjb2RlcyAqL1xuICBsZXQgaGVyZTsgICAgICAgICAgICAgICAgICAgLyogcmV0cmlldmVkIHRhYmxlIGVudHJ5ICovXG4gIGxldCBvcDsgICAgICAgICAgICAgICAgICAgICAvKiBjb2RlIGJpdHMsIG9wZXJhdGlvbiwgZXh0cmEgYml0cywgb3IgKi9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8qICB3aW5kb3cgcG9zaXRpb24sIHdpbmRvdyBieXRlcyB0byBjb3B5ICovXG4gIGxldCBsZW47ICAgICAgICAgICAgICAgICAgICAvKiBtYXRjaCBsZW5ndGgsIHVudXNlZCBieXRlcyAqL1xuICBsZXQgZGlzdDsgICAgICAgICAgICAgICAgICAgLyogbWF0Y2ggZGlzdGFuY2UgKi9cbiAgbGV0IGZyb207ICAgICAgICAgICAgICAgICAgIC8qIHdoZXJlIHRvIGNvcHkgbWF0Y2ggZnJvbSAqL1xuICBsZXQgZnJvbV9zb3VyY2U7XG5cblxuICBsZXQgaW5wdXQsIG91dHB1dDsgLy8gSlMgc3BlY2lmaWMsIGJlY2F1c2Ugd2UgaGF2ZSBubyBwb2ludGVyc1xuXG4gIC8qIGNvcHkgc3RhdGUgdG8gbG9jYWwgdmFyaWFibGVzICovXG4gIGNvbnN0IHN0YXRlID0gc3RybS5zdGF0ZTtcbiAgLy9oZXJlID0gc3RhdGUuaGVyZTtcbiAgX2luID0gc3RybS5uZXh0X2luO1xuICBpbnB1dCA9IHN0cm0uaW5wdXQ7XG4gIGxhc3QgPSBfaW4gKyAoc3RybS5hdmFpbF9pbiAtIDUpO1xuICBfb3V0ID0gc3RybS5uZXh0X291dDtcbiAgb3V0cHV0ID0gc3RybS5vdXRwdXQ7XG4gIGJlZyA9IF9vdXQgLSAoc3RhcnQgLSBzdHJtLmF2YWlsX291dCk7XG4gIGVuZCA9IF9vdXQgKyAoc3RybS5hdmFpbF9vdXQgLSAyNTcpO1xuLy8jaWZkZWYgSU5GTEFURV9TVFJJQ1RcbiAgZG1heCA9IHN0YXRlLmRtYXg7XG4vLyNlbmRpZlxuICB3c2l6ZSA9IHN0YXRlLndzaXplO1xuICB3aGF2ZSA9IHN0YXRlLndoYXZlO1xuICB3bmV4dCA9IHN0YXRlLnduZXh0O1xuICBzX3dpbmRvdyA9IHN0YXRlLndpbmRvdztcbiAgaG9sZCA9IHN0YXRlLmhvbGQ7XG4gIGJpdHMgPSBzdGF0ZS5iaXRzO1xuICBsY29kZSA9IHN0YXRlLmxlbmNvZGU7XG4gIGRjb2RlID0gc3RhdGUuZGlzdGNvZGU7XG4gIGxtYXNrID0gKDEgPDwgc3RhdGUubGVuYml0cykgLSAxO1xuICBkbWFzayA9ICgxIDw8IHN0YXRlLmRpc3RiaXRzKSAtIDE7XG5cblxuICAvKiBkZWNvZGUgbGl0ZXJhbHMgYW5kIGxlbmd0aC9kaXN0YW5jZXMgdW50aWwgZW5kLW9mLWJsb2NrIG9yIG5vdCBlbm91Z2hcbiAgICAgaW5wdXQgZGF0YSBvciBvdXRwdXQgc3BhY2UgKi9cblxuICB0b3A6XG4gIGRvIHtcbiAgICBpZiAoYml0cyA8IDE1KSB7XG4gICAgICBob2xkICs9IGlucHV0W19pbisrXSA8PCBiaXRzO1xuICAgICAgYml0cyArPSA4O1xuICAgICAgaG9sZCArPSBpbnB1dFtfaW4rK10gPDwgYml0cztcbiAgICAgIGJpdHMgKz0gODtcbiAgICB9XG5cbiAgICBoZXJlID0gbGNvZGVbaG9sZCAmIGxtYXNrXTtcblxuICAgIGRvbGVuOlxuICAgIGZvciAoOzspIHsgLy8gR290byBlbXVsYXRpb25cbiAgICAgIG9wID0gaGVyZSA+Pj4gMjQvKmhlcmUuYml0cyovO1xuICAgICAgaG9sZCA+Pj49IG9wO1xuICAgICAgYml0cyAtPSBvcDtcbiAgICAgIG9wID0gKGhlcmUgPj4+IDE2KSAmIDB4ZmYvKmhlcmUub3AqLztcbiAgICAgIGlmIChvcCA9PT0gMCkgeyAgICAgICAgICAgICAgICAgICAgICAgICAgLyogbGl0ZXJhbCAqL1xuICAgICAgICAvL1RyYWNldnYoKHN0ZGVyciwgaGVyZS52YWwgPj0gMHgyMCAmJiBoZXJlLnZhbCA8IDB4N2YgP1xuICAgICAgICAvLyAgICAgICAgXCJpbmZsYXRlOiAgICAgICAgIGxpdGVyYWwgJyVjJ1xcblwiIDpcbiAgICAgICAgLy8gICAgICAgIFwiaW5mbGF0ZTogICAgICAgICBsaXRlcmFsIDB4JTAyeFxcblwiLCBoZXJlLnZhbCkpO1xuICAgICAgICBvdXRwdXRbX291dCsrXSA9IGhlcmUgJiAweGZmZmYvKmhlcmUudmFsKi87XG4gICAgICB9XG4gICAgICBlbHNlIGlmIChvcCAmIDE2KSB7ICAgICAgICAgICAgICAgICAgICAgLyogbGVuZ3RoIGJhc2UgKi9cbiAgICAgICAgbGVuID0gaGVyZSAmIDB4ZmZmZi8qaGVyZS52YWwqLztcbiAgICAgICAgb3AgJj0gMTU7ICAgICAgICAgICAgICAgICAgICAgICAgICAgLyogbnVtYmVyIG9mIGV4dHJhIGJpdHMgKi9cbiAgICAgICAgaWYgKG9wKSB7XG4gICAgICAgICAgaWYgKGJpdHMgPCBvcCkge1xuICAgICAgICAgICAgaG9sZCArPSBpbnB1dFtfaW4rK10gPDwgYml0cztcbiAgICAgICAgICAgIGJpdHMgKz0gODtcbiAgICAgICAgICB9XG4gICAgICAgICAgbGVuICs9IGhvbGQgJiAoKDEgPDwgb3ApIC0gMSk7XG4gICAgICAgICAgaG9sZCA+Pj49IG9wO1xuICAgICAgICAgIGJpdHMgLT0gb3A7XG4gICAgICAgIH1cbiAgICAgICAgLy9UcmFjZXZ2KChzdGRlcnIsIFwiaW5mbGF0ZTogICAgICAgICBsZW5ndGggJXVcXG5cIiwgbGVuKSk7XG4gICAgICAgIGlmIChiaXRzIDwgMTUpIHtcbiAgICAgICAgICBob2xkICs9IGlucHV0W19pbisrXSA8PCBiaXRzO1xuICAgICAgICAgIGJpdHMgKz0gODtcbiAgICAgICAgICBob2xkICs9IGlucHV0W19pbisrXSA8PCBiaXRzO1xuICAgICAgICAgIGJpdHMgKz0gODtcbiAgICAgICAgfVxuICAgICAgICBoZXJlID0gZGNvZGVbaG9sZCAmIGRtYXNrXTtcblxuICAgICAgICBkb2Rpc3Q6XG4gICAgICAgIGZvciAoOzspIHsgLy8gZ290byBlbXVsYXRpb25cbiAgICAgICAgICBvcCA9IGhlcmUgPj4+IDI0LypoZXJlLmJpdHMqLztcbiAgICAgICAgICBob2xkID4+Pj0gb3A7XG4gICAgICAgICAgYml0cyAtPSBvcDtcbiAgICAgICAgICBvcCA9IChoZXJlID4+PiAxNikgJiAweGZmLypoZXJlLm9wKi87XG5cbiAgICAgICAgICBpZiAob3AgJiAxNikgeyAgICAgICAgICAgICAgICAgICAgICAvKiBkaXN0YW5jZSBiYXNlICovXG4gICAgICAgICAgICBkaXN0ID0gaGVyZSAmIDB4ZmZmZi8qaGVyZS52YWwqLztcbiAgICAgICAgICAgIG9wICY9IDE1OyAgICAgICAgICAgICAgICAgICAgICAgLyogbnVtYmVyIG9mIGV4dHJhIGJpdHMgKi9cbiAgICAgICAgICAgIGlmIChiaXRzIDwgb3ApIHtcbiAgICAgICAgICAgICAgaG9sZCArPSBpbnB1dFtfaW4rK10gPDwgYml0cztcbiAgICAgICAgICAgICAgYml0cyArPSA4O1xuICAgICAgICAgICAgICBpZiAoYml0cyA8IG9wKSB7XG4gICAgICAgICAgICAgICAgaG9sZCArPSBpbnB1dFtfaW4rK10gPDwgYml0cztcbiAgICAgICAgICAgICAgICBiaXRzICs9IDg7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGRpc3QgKz0gaG9sZCAmICgoMSA8PCBvcCkgLSAxKTtcbi8vI2lmZGVmIElORkxBVEVfU1RSSUNUXG4gICAgICAgICAgICBpZiAoZGlzdCA+IGRtYXgpIHtcbiAgICAgICAgICAgICAgc3RybS5tc2cgPSAnaW52YWxpZCBkaXN0YW5jZSB0b28gZmFyIGJhY2snO1xuICAgICAgICAgICAgICBzdGF0ZS5tb2RlID0gQkFEJDE7XG4gICAgICAgICAgICAgIGJyZWFrIHRvcDtcbiAgICAgICAgICAgIH1cbi8vI2VuZGlmXG4gICAgICAgICAgICBob2xkID4+Pj0gb3A7XG4gICAgICAgICAgICBiaXRzIC09IG9wO1xuICAgICAgICAgICAgLy9UcmFjZXZ2KChzdGRlcnIsIFwiaW5mbGF0ZTogICAgICAgICBkaXN0YW5jZSAldVxcblwiLCBkaXN0KSk7XG4gICAgICAgICAgICBvcCA9IF9vdXQgLSBiZWc7ICAgICAgICAgICAgICAgIC8qIG1heCBkaXN0YW5jZSBpbiBvdXRwdXQgKi9cbiAgICAgICAgICAgIGlmIChkaXN0ID4gb3ApIHsgICAgICAgICAgICAgICAgLyogc2VlIGlmIGNvcHkgZnJvbSB3aW5kb3cgKi9cbiAgICAgICAgICAgICAgb3AgPSBkaXN0IC0gb3A7ICAgICAgICAgICAgICAgLyogZGlzdGFuY2UgYmFjayBpbiB3aW5kb3cgKi9cbiAgICAgICAgICAgICAgaWYgKG9wID4gd2hhdmUpIHtcbiAgICAgICAgICAgICAgICBpZiAoc3RhdGUuc2FuZSkge1xuICAgICAgICAgICAgICAgICAgc3RybS5tc2cgPSAnaW52YWxpZCBkaXN0YW5jZSB0b28gZmFyIGJhY2snO1xuICAgICAgICAgICAgICAgICAgc3RhdGUubW9kZSA9IEJBRCQxO1xuICAgICAgICAgICAgICAgICAgYnJlYWsgdG9wO1xuICAgICAgICAgICAgICAgIH1cblxuLy8gKCEpIFRoaXMgYmxvY2sgaXMgZGlzYWJsZWQgaW4gemxpYiBkZWZhdWx0cyxcbi8vIGRvbid0IGVuYWJsZSBpdCBmb3IgYmluYXJ5IGNvbXBhdGliaWxpdHlcbi8vI2lmZGVmIElORkxBVEVfQUxMT1dfSU5WQUxJRF9ESVNUQU5DRV9UT09GQVJfQVJSUlxuLy8gICAgICAgICAgICAgICAgaWYgKGxlbiA8PSBvcCAtIHdoYXZlKSB7XG4vLyAgICAgICAgICAgICAgICAgIGRvIHtcbi8vICAgICAgICAgICAgICAgICAgICBvdXRwdXRbX291dCsrXSA9IDA7XG4vLyAgICAgICAgICAgICAgICAgIH0gd2hpbGUgKC0tbGVuKTtcbi8vICAgICAgICAgICAgICAgICAgY29udGludWUgdG9wO1xuLy8gICAgICAgICAgICAgICAgfVxuLy8gICAgICAgICAgICAgICAgbGVuIC09IG9wIC0gd2hhdmU7XG4vLyAgICAgICAgICAgICAgICBkbyB7XG4vLyAgICAgICAgICAgICAgICAgIG91dHB1dFtfb3V0KytdID0gMDtcbi8vICAgICAgICAgICAgICAgIH0gd2hpbGUgKC0tb3AgPiB3aGF2ZSk7XG4vLyAgICAgICAgICAgICAgICBpZiAob3AgPT09IDApIHtcbi8vICAgICAgICAgICAgICAgICAgZnJvbSA9IF9vdXQgLSBkaXN0O1xuLy8gICAgICAgICAgICAgICAgICBkbyB7XG4vLyAgICAgICAgICAgICAgICAgICAgb3V0cHV0W19vdXQrK10gPSBvdXRwdXRbZnJvbSsrXTtcbi8vICAgICAgICAgICAgICAgICAgfSB3aGlsZSAoLS1sZW4pO1xuLy8gICAgICAgICAgICAgICAgICBjb250aW51ZSB0b3A7XG4vLyAgICAgICAgICAgICAgICB9XG4vLyNlbmRpZlxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGZyb20gPSAwOyAvLyB3aW5kb3cgaW5kZXhcbiAgICAgICAgICAgICAgZnJvbV9zb3VyY2UgPSBzX3dpbmRvdztcbiAgICAgICAgICAgICAgaWYgKHduZXh0ID09PSAwKSB7ICAgICAgICAgICAvKiB2ZXJ5IGNvbW1vbiBjYXNlICovXG4gICAgICAgICAgICAgICAgZnJvbSArPSB3c2l6ZSAtIG9wO1xuICAgICAgICAgICAgICAgIGlmIChvcCA8IGxlbikgeyAgICAgICAgIC8qIHNvbWUgZnJvbSB3aW5kb3cgKi9cbiAgICAgICAgICAgICAgICAgIGxlbiAtPSBvcDtcbiAgICAgICAgICAgICAgICAgIGRvIHtcbiAgICAgICAgICAgICAgICAgICAgb3V0cHV0W19vdXQrK10gPSBzX3dpbmRvd1tmcm9tKytdO1xuICAgICAgICAgICAgICAgICAgfSB3aGlsZSAoLS1vcCk7XG4gICAgICAgICAgICAgICAgICBmcm9tID0gX291dCAtIGRpc3Q7ICAvKiByZXN0IGZyb20gb3V0cHV0ICovXG4gICAgICAgICAgICAgICAgICBmcm9tX3NvdXJjZSA9IG91dHB1dDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgZWxzZSBpZiAod25leHQgPCBvcCkgeyAgICAgIC8qIHdyYXAgYXJvdW5kIHdpbmRvdyAqL1xuICAgICAgICAgICAgICAgIGZyb20gKz0gd3NpemUgKyB3bmV4dCAtIG9wO1xuICAgICAgICAgICAgICAgIG9wIC09IHduZXh0O1xuICAgICAgICAgICAgICAgIGlmIChvcCA8IGxlbikgeyAgICAgICAgIC8qIHNvbWUgZnJvbSBlbmQgb2Ygd2luZG93ICovXG4gICAgICAgICAgICAgICAgICBsZW4gLT0gb3A7XG4gICAgICAgICAgICAgICAgICBkbyB7XG4gICAgICAgICAgICAgICAgICAgIG91dHB1dFtfb3V0KytdID0gc193aW5kb3dbZnJvbSsrXTtcbiAgICAgICAgICAgICAgICAgIH0gd2hpbGUgKC0tb3ApO1xuICAgICAgICAgICAgICAgICAgZnJvbSA9IDA7XG4gICAgICAgICAgICAgICAgICBpZiAod25leHQgPCBsZW4pIHsgIC8qIHNvbWUgZnJvbSBzdGFydCBvZiB3aW5kb3cgKi9cbiAgICAgICAgICAgICAgICAgICAgb3AgPSB3bmV4dDtcbiAgICAgICAgICAgICAgICAgICAgbGVuIC09IG9wO1xuICAgICAgICAgICAgICAgICAgICBkbyB7XG4gICAgICAgICAgICAgICAgICAgICAgb3V0cHV0W19vdXQrK10gPSBzX3dpbmRvd1tmcm9tKytdO1xuICAgICAgICAgICAgICAgICAgICB9IHdoaWxlICgtLW9wKTtcbiAgICAgICAgICAgICAgICAgICAgZnJvbSA9IF9vdXQgLSBkaXN0OyAgICAgIC8qIHJlc3QgZnJvbSBvdXRwdXQgKi9cbiAgICAgICAgICAgICAgICAgICAgZnJvbV9zb3VyY2UgPSBvdXRwdXQ7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGVsc2UgeyAgICAgICAgICAgICAgICAgICAgICAvKiBjb250aWd1b3VzIGluIHdpbmRvdyAqL1xuICAgICAgICAgICAgICAgIGZyb20gKz0gd25leHQgLSBvcDtcbiAgICAgICAgICAgICAgICBpZiAob3AgPCBsZW4pIHsgICAgICAgICAvKiBzb21lIGZyb20gd2luZG93ICovXG4gICAgICAgICAgICAgICAgICBsZW4gLT0gb3A7XG4gICAgICAgICAgICAgICAgICBkbyB7XG4gICAgICAgICAgICAgICAgICAgIG91dHB1dFtfb3V0KytdID0gc193aW5kb3dbZnJvbSsrXTtcbiAgICAgICAgICAgICAgICAgIH0gd2hpbGUgKC0tb3ApO1xuICAgICAgICAgICAgICAgICAgZnJvbSA9IF9vdXQgLSBkaXN0OyAgLyogcmVzdCBmcm9tIG91dHB1dCAqL1xuICAgICAgICAgICAgICAgICAgZnJvbV9zb3VyY2UgPSBvdXRwdXQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHdoaWxlIChsZW4gPiAyKSB7XG4gICAgICAgICAgICAgICAgb3V0cHV0W19vdXQrK10gPSBmcm9tX3NvdXJjZVtmcm9tKytdO1xuICAgICAgICAgICAgICAgIG91dHB1dFtfb3V0KytdID0gZnJvbV9zb3VyY2VbZnJvbSsrXTtcbiAgICAgICAgICAgICAgICBvdXRwdXRbX291dCsrXSA9IGZyb21fc291cmNlW2Zyb20rK107XG4gICAgICAgICAgICAgICAgbGVuIC09IDM7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKGxlbikge1xuICAgICAgICAgICAgICAgIG91dHB1dFtfb3V0KytdID0gZnJvbV9zb3VyY2VbZnJvbSsrXTtcbiAgICAgICAgICAgICAgICBpZiAobGVuID4gMSkge1xuICAgICAgICAgICAgICAgICAgb3V0cHV0W19vdXQrK10gPSBmcm9tX3NvdXJjZVtmcm9tKytdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgIGZyb20gPSBfb3V0IC0gZGlzdDsgICAgICAgICAgLyogY29weSBkaXJlY3QgZnJvbSBvdXRwdXQgKi9cbiAgICAgICAgICAgICAgZG8geyAgICAgICAgICAgICAgICAgICAgICAgIC8qIG1pbmltdW0gbGVuZ3RoIGlzIHRocmVlICovXG4gICAgICAgICAgICAgICAgb3V0cHV0W19vdXQrK10gPSBvdXRwdXRbZnJvbSsrXTtcbiAgICAgICAgICAgICAgICBvdXRwdXRbX291dCsrXSA9IG91dHB1dFtmcm9tKytdO1xuICAgICAgICAgICAgICAgIG91dHB1dFtfb3V0KytdID0gb3V0cHV0W2Zyb20rK107XG4gICAgICAgICAgICAgICAgbGVuIC09IDM7XG4gICAgICAgICAgICAgIH0gd2hpbGUgKGxlbiA+IDIpO1xuICAgICAgICAgICAgICBpZiAobGVuKSB7XG4gICAgICAgICAgICAgICAgb3V0cHV0W19vdXQrK10gPSBvdXRwdXRbZnJvbSsrXTtcbiAgICAgICAgICAgICAgICBpZiAobGVuID4gMSkge1xuICAgICAgICAgICAgICAgICAgb3V0cHV0W19vdXQrK10gPSBvdXRwdXRbZnJvbSsrXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSBpZiAoKG9wICYgNjQpID09PSAwKSB7ICAgICAgICAgIC8qIDJuZCBsZXZlbCBkaXN0YW5jZSBjb2RlICovXG4gICAgICAgICAgICBoZXJlID0gZGNvZGVbKGhlcmUgJiAweGZmZmYpLypoZXJlLnZhbCovICsgKGhvbGQgJiAoKDEgPDwgb3ApIC0gMSkpXTtcbiAgICAgICAgICAgIGNvbnRpbnVlIGRvZGlzdDtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBzdHJtLm1zZyA9ICdpbnZhbGlkIGRpc3RhbmNlIGNvZGUnO1xuICAgICAgICAgICAgc3RhdGUubW9kZSA9IEJBRCQxO1xuICAgICAgICAgICAgYnJlYWsgdG9wO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGJyZWFrOyAvLyBuZWVkIHRvIGVtdWxhdGUgZ290byB2aWEgXCJjb250aW51ZVwiXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKChvcCAmIDY0KSA9PT0gMCkgeyAgICAgICAgICAgICAgLyogMm5kIGxldmVsIGxlbmd0aCBjb2RlICovXG4gICAgICAgIGhlcmUgPSBsY29kZVsoaGVyZSAmIDB4ZmZmZikvKmhlcmUudmFsKi8gKyAoaG9sZCAmICgoMSA8PCBvcCkgLSAxKSldO1xuICAgICAgICBjb250aW51ZSBkb2xlbjtcbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKG9wICYgMzIpIHsgICAgICAgICAgICAgICAgICAgICAvKiBlbmQtb2YtYmxvY2sgKi9cbiAgICAgICAgLy9UcmFjZXZ2KChzdGRlcnIsIFwiaW5mbGF0ZTogICAgICAgICBlbmQgb2YgYmxvY2tcXG5cIikpO1xuICAgICAgICBzdGF0ZS5tb2RlID0gVFlQRSQxO1xuICAgICAgICBicmVhayB0b3A7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgc3RybS5tc2cgPSAnaW52YWxpZCBsaXRlcmFsL2xlbmd0aCBjb2RlJztcbiAgICAgICAgc3RhdGUubW9kZSA9IEJBRCQxO1xuICAgICAgICBicmVhayB0b3A7XG4gICAgICB9XG5cbiAgICAgIGJyZWFrOyAvLyBuZWVkIHRvIGVtdWxhdGUgZ290byB2aWEgXCJjb250aW51ZVwiXG4gICAgfVxuICB9IHdoaWxlIChfaW4gPCBsYXN0ICYmIF9vdXQgPCBlbmQpO1xuXG4gIC8qIHJldHVybiB1bnVzZWQgYnl0ZXMgKG9uIGVudHJ5LCBiaXRzIDwgOCwgc28gaW4gd29uJ3QgZ28gdG9vIGZhciBiYWNrKSAqL1xuICBsZW4gPSBiaXRzID4+IDM7XG4gIF9pbiAtPSBsZW47XG4gIGJpdHMgLT0gbGVuIDw8IDM7XG4gIGhvbGQgJj0gKDEgPDwgYml0cykgLSAxO1xuXG4gIC8qIHVwZGF0ZSBzdGF0ZSBhbmQgcmV0dXJuICovXG4gIHN0cm0ubmV4dF9pbiA9IF9pbjtcbiAgc3RybS5uZXh0X291dCA9IF9vdXQ7XG4gIHN0cm0uYXZhaWxfaW4gPSAoX2luIDwgbGFzdCA/IDUgKyAobGFzdCAtIF9pbikgOiA1IC0gKF9pbiAtIGxhc3QpKTtcbiAgc3RybS5hdmFpbF9vdXQgPSAoX291dCA8IGVuZCA/IDI1NyArIChlbmQgLSBfb3V0KSA6IDI1NyAtIChfb3V0IC0gZW5kKSk7XG4gIHN0YXRlLmhvbGQgPSBob2xkO1xuICBzdGF0ZS5iaXRzID0gYml0cztcbiAgcmV0dXJuO1xufTtcblxuLy8gKEMpIDE5OTUtMjAxMyBKZWFuLWxvdXAgR2FpbGx5IGFuZCBNYXJrIEFkbGVyXG4vLyAoQykgMjAxNC0yMDE3IFZpdGFseSBQdXpyaW4gYW5kIEFuZHJleSBUdXBpdHNpblxuLy9cbi8vIFRoaXMgc29mdHdhcmUgaXMgcHJvdmlkZWQgJ2FzLWlzJywgd2l0aG91dCBhbnkgZXhwcmVzcyBvciBpbXBsaWVkXG4vLyB3YXJyYW50eS4gSW4gbm8gZXZlbnQgd2lsbCB0aGUgYXV0aG9ycyBiZSBoZWxkIGxpYWJsZSBmb3IgYW55IGRhbWFnZXNcbi8vIGFyaXNpbmcgZnJvbSB0aGUgdXNlIG9mIHRoaXMgc29mdHdhcmUuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBncmFudGVkIHRvIGFueW9uZSB0byB1c2UgdGhpcyBzb2Z0d2FyZSBmb3IgYW55IHB1cnBvc2UsXG4vLyBpbmNsdWRpbmcgY29tbWVyY2lhbCBhcHBsaWNhdGlvbnMsIGFuZCB0byBhbHRlciBpdCBhbmQgcmVkaXN0cmlidXRlIGl0XG4vLyBmcmVlbHksIHN1YmplY3QgdG8gdGhlIGZvbGxvd2luZyByZXN0cmljdGlvbnM6XG4vL1xuLy8gMS4gVGhlIG9yaWdpbiBvZiB0aGlzIHNvZnR3YXJlIG11c3Qgbm90IGJlIG1pc3JlcHJlc2VudGVkOyB5b3UgbXVzdCBub3Rcbi8vICAgY2xhaW0gdGhhdCB5b3Ugd3JvdGUgdGhlIG9yaWdpbmFsIHNvZnR3YXJlLiBJZiB5b3UgdXNlIHRoaXMgc29mdHdhcmVcbi8vICAgaW4gYSBwcm9kdWN0LCBhbiBhY2tub3dsZWRnbWVudCBpbiB0aGUgcHJvZHVjdCBkb2N1bWVudGF0aW9uIHdvdWxkIGJlXG4vLyAgIGFwcHJlY2lhdGVkIGJ1dCBpcyBub3QgcmVxdWlyZWQuXG4vLyAyLiBBbHRlcmVkIHNvdXJjZSB2ZXJzaW9ucyBtdXN0IGJlIHBsYWlubHkgbWFya2VkIGFzIHN1Y2gsIGFuZCBtdXN0IG5vdCBiZVxuLy8gICBtaXNyZXByZXNlbnRlZCBhcyBiZWluZyB0aGUgb3JpZ2luYWwgc29mdHdhcmUuXG4vLyAzLiBUaGlzIG5vdGljZSBtYXkgbm90IGJlIHJlbW92ZWQgb3IgYWx0ZXJlZCBmcm9tIGFueSBzb3VyY2UgZGlzdHJpYnV0aW9uLlxuXG5jb25zdCBNQVhCSVRTID0gMTU7XG5jb25zdCBFTk9VR0hfTEVOUyQxID0gODUyO1xuY29uc3QgRU5PVUdIX0RJU1RTJDEgPSA1OTI7XG4vL2NvbnN0IEVOT1VHSCA9IChFTk9VR0hfTEVOUytFTk9VR0hfRElTVFMpO1xuXG5jb25zdCBDT0RFUyQxID0gMDtcbmNvbnN0IExFTlMkMSA9IDE7XG5jb25zdCBESVNUUyQxID0gMjtcblxuY29uc3QgbGJhc2UgPSBuZXcgVWludDE2QXJyYXkoWyAvKiBMZW5ndGggY29kZXMgMjU3Li4yODUgYmFzZSAqL1xuICAzLCA0LCA1LCA2LCA3LCA4LCA5LCAxMCwgMTEsIDEzLCAxNSwgMTcsIDE5LCAyMywgMjcsIDMxLFxuICAzNSwgNDMsIDUxLCA1OSwgNjcsIDgzLCA5OSwgMTE1LCAxMzEsIDE2MywgMTk1LCAyMjcsIDI1OCwgMCwgMFxuXSk7XG5cbmNvbnN0IGxleHQgPSBuZXcgVWludDhBcnJheShbIC8qIExlbmd0aCBjb2RlcyAyNTcuLjI4NSBleHRyYSAqL1xuICAxNiwgMTYsIDE2LCAxNiwgMTYsIDE2LCAxNiwgMTYsIDE3LCAxNywgMTcsIDE3LCAxOCwgMTgsIDE4LCAxOCxcbiAgMTksIDE5LCAxOSwgMTksIDIwLCAyMCwgMjAsIDIwLCAyMSwgMjEsIDIxLCAyMSwgMTYsIDcyLCA3OFxuXSk7XG5cbmNvbnN0IGRiYXNlID0gbmV3IFVpbnQxNkFycmF5KFsgLyogRGlzdGFuY2UgY29kZXMgMC4uMjkgYmFzZSAqL1xuICAxLCAyLCAzLCA0LCA1LCA3LCA5LCAxMywgMTcsIDI1LCAzMywgNDksIDY1LCA5NywgMTI5LCAxOTMsXG4gIDI1NywgMzg1LCA1MTMsIDc2OSwgMTAyNSwgMTUzNywgMjA0OSwgMzA3MywgNDA5NywgNjE0NSxcbiAgODE5MywgMTIyODksIDE2Mzg1LCAyNDU3NywgMCwgMFxuXSk7XG5cbmNvbnN0IGRleHQgPSBuZXcgVWludDhBcnJheShbIC8qIERpc3RhbmNlIGNvZGVzIDAuLjI5IGV4dHJhICovXG4gIDE2LCAxNiwgMTYsIDE2LCAxNywgMTcsIDE4LCAxOCwgMTksIDE5LCAyMCwgMjAsIDIxLCAyMSwgMjIsIDIyLFxuICAyMywgMjMsIDI0LCAyNCwgMjUsIDI1LCAyNiwgMjYsIDI3LCAyNyxcbiAgMjgsIDI4LCAyOSwgMjksIDY0LCA2NFxuXSk7XG5cbmNvbnN0IGluZmxhdGVfdGFibGUgPSAodHlwZSwgbGVucywgbGVuc19pbmRleCwgY29kZXMsIHRhYmxlLCB0YWJsZV9pbmRleCwgd29yaywgb3B0cykgPT5cbntcbiAgY29uc3QgYml0cyA9IG9wdHMuYml0cztcbiAgICAgIC8vaGVyZSA9IG9wdHMuaGVyZTsgLyogdGFibGUgZW50cnkgZm9yIGR1cGxpY2F0aW9uICovXG5cbiAgbGV0IGxlbiA9IDA7ICAgICAgICAgICAgICAgLyogYSBjb2RlJ3MgbGVuZ3RoIGluIGJpdHMgKi9cbiAgbGV0IHN5bSA9IDA7ICAgICAgICAgICAgICAgLyogaW5kZXggb2YgY29kZSBzeW1ib2xzICovXG4gIGxldCBtaW4gPSAwLCBtYXggPSAwOyAgICAgICAgICAvKiBtaW5pbXVtIGFuZCBtYXhpbXVtIGNvZGUgbGVuZ3RocyAqL1xuICBsZXQgcm9vdCA9IDA7ICAgICAgICAgICAgICAvKiBudW1iZXIgb2YgaW5kZXggYml0cyBmb3Igcm9vdCB0YWJsZSAqL1xuICBsZXQgY3VyciA9IDA7ICAgICAgICAgICAgICAvKiBudW1iZXIgb2YgaW5kZXggYml0cyBmb3IgY3VycmVudCB0YWJsZSAqL1xuICBsZXQgZHJvcCA9IDA7ICAgICAgICAgICAgICAvKiBjb2RlIGJpdHMgdG8gZHJvcCBmb3Igc3ViLXRhYmxlICovXG4gIGxldCBsZWZ0ID0gMDsgICAgICAgICAgICAgICAgICAgLyogbnVtYmVyIG9mIHByZWZpeCBjb2RlcyBhdmFpbGFibGUgKi9cbiAgbGV0IHVzZWQgPSAwOyAgICAgICAgICAgICAgLyogY29kZSBlbnRyaWVzIGluIHRhYmxlIHVzZWQgKi9cbiAgbGV0IGh1ZmYgPSAwOyAgICAgICAgICAgICAgLyogSHVmZm1hbiBjb2RlICovXG4gIGxldCBpbmNyOyAgICAgICAgICAgICAgLyogZm9yIGluY3JlbWVudGluZyBjb2RlLCBpbmRleCAqL1xuICBsZXQgZmlsbDsgICAgICAgICAgICAgIC8qIGluZGV4IGZvciByZXBsaWNhdGluZyBlbnRyaWVzICovXG4gIGxldCBsb3c7ICAgICAgICAgICAgICAgLyogbG93IGJpdHMgZm9yIGN1cnJlbnQgcm9vdCBlbnRyeSAqL1xuICBsZXQgbWFzazsgICAgICAgICAgICAgIC8qIG1hc2sgZm9yIGxvdyByb290IGJpdHMgKi9cbiAgbGV0IG5leHQ7ICAgICAgICAgICAgIC8qIG5leHQgYXZhaWxhYmxlIHNwYWNlIGluIHRhYmxlICovXG4gIGxldCBiYXNlID0gbnVsbDsgICAgIC8qIGJhc2UgdmFsdWUgdGFibGUgdG8gdXNlICovXG4vLyAgbGV0IHNob2V4dHJhOyAgICAvKiBleHRyYSBiaXRzIHRhYmxlIHRvIHVzZSAqL1xuICBsZXQgbWF0Y2g7ICAgICAgICAgICAgICAgICAgLyogdXNlIGJhc2UgYW5kIGV4dHJhIGZvciBzeW1ib2wgPj0gbWF0Y2ggKi9cbiAgY29uc3QgY291bnQgPSBuZXcgVWludDE2QXJyYXkoTUFYQklUUyArIDEpOyAvL1tNQVhCSVRTKzFdOyAgICAvKiBudW1iZXIgb2YgY29kZXMgb2YgZWFjaCBsZW5ndGggKi9cbiAgY29uc3Qgb2ZmcyA9IG5ldyBVaW50MTZBcnJheShNQVhCSVRTICsgMSk7IC8vW01BWEJJVFMrMV07ICAgICAvKiBvZmZzZXRzIGluIHRhYmxlIGZvciBlYWNoIGxlbmd0aCAqL1xuICBsZXQgZXh0cmEgPSBudWxsO1xuXG4gIGxldCBoZXJlX2JpdHMsIGhlcmVfb3AsIGhlcmVfdmFsO1xuXG4gIC8qXG4gICBQcm9jZXNzIGEgc2V0IG9mIGNvZGUgbGVuZ3RocyB0byBjcmVhdGUgYSBjYW5vbmljYWwgSHVmZm1hbiBjb2RlLiAgVGhlXG4gICBjb2RlIGxlbmd0aHMgYXJlIGxlbnNbMC4uY29kZXMtMV0uICBFYWNoIGxlbmd0aCBjb3JyZXNwb25kcyB0byB0aGVcbiAgIHN5bWJvbHMgMC4uY29kZXMtMS4gIFRoZSBIdWZmbWFuIGNvZGUgaXMgZ2VuZXJhdGVkIGJ5IGZpcnN0IHNvcnRpbmcgdGhlXG4gICBzeW1ib2xzIGJ5IGxlbmd0aCBmcm9tIHNob3J0IHRvIGxvbmcsIGFuZCByZXRhaW5pbmcgdGhlIHN5bWJvbCBvcmRlclxuICAgZm9yIGNvZGVzIHdpdGggZXF1YWwgbGVuZ3Rocy4gIFRoZW4gdGhlIGNvZGUgc3RhcnRzIHdpdGggYWxsIHplcm8gYml0c1xuICAgZm9yIHRoZSBmaXJzdCBjb2RlIG9mIHRoZSBzaG9ydGVzdCBsZW5ndGgsIGFuZCB0aGUgY29kZXMgYXJlIGludGVnZXJcbiAgIGluY3JlbWVudHMgZm9yIHRoZSBzYW1lIGxlbmd0aCwgYW5kIHplcm9zIGFyZSBhcHBlbmRlZCBhcyB0aGUgbGVuZ3RoXG4gICBpbmNyZWFzZXMuICBGb3IgdGhlIGRlZmxhdGUgZm9ybWF0LCB0aGVzZSBiaXRzIGFyZSBzdG9yZWQgYmFja3dhcmRzXG4gICBmcm9tIHRoZWlyIG1vcmUgbmF0dXJhbCBpbnRlZ2VyIGluY3JlbWVudCBvcmRlcmluZywgYW5kIHNvIHdoZW4gdGhlXG4gICBkZWNvZGluZyB0YWJsZXMgYXJlIGJ1aWx0IGluIHRoZSBsYXJnZSBsb29wIGJlbG93LCB0aGUgaW50ZWdlciBjb2Rlc1xuICAgYXJlIGluY3JlbWVudGVkIGJhY2t3YXJkcy5cblxuICAgVGhpcyByb3V0aW5lIGFzc3VtZXMsIGJ1dCBkb2VzIG5vdCBjaGVjaywgdGhhdCBhbGwgb2YgdGhlIGVudHJpZXMgaW5cbiAgIGxlbnNbXSBhcmUgaW4gdGhlIHJhbmdlIDAuLk1BWEJJVFMuICBUaGUgY2FsbGVyIG11c3QgYXNzdXJlIHRoaXMuXG4gICAxLi5NQVhCSVRTIGlzIGludGVycHJldGVkIGFzIHRoYXQgY29kZSBsZW5ndGguICB6ZXJvIG1lYW5zIHRoYXQgdGhhdFxuICAgc3ltYm9sIGRvZXMgbm90IG9jY3VyIGluIHRoaXMgY29kZS5cblxuICAgVGhlIGNvZGVzIGFyZSBzb3J0ZWQgYnkgY29tcHV0aW5nIGEgY291bnQgb2YgY29kZXMgZm9yIGVhY2ggbGVuZ3RoLFxuICAgY3JlYXRpbmcgZnJvbSB0aGF0IGEgdGFibGUgb2Ygc3RhcnRpbmcgaW5kaWNlcyBmb3IgZWFjaCBsZW5ndGggaW4gdGhlXG4gICBzb3J0ZWQgdGFibGUsIGFuZCB0aGVuIGVudGVyaW5nIHRoZSBzeW1ib2xzIGluIG9yZGVyIGluIHRoZSBzb3J0ZWRcbiAgIHRhYmxlLiAgVGhlIHNvcnRlZCB0YWJsZSBpcyB3b3JrW10sIHdpdGggdGhhdCBzcGFjZSBiZWluZyBwcm92aWRlZCBieVxuICAgdGhlIGNhbGxlci5cblxuICAgVGhlIGxlbmd0aCBjb3VudHMgYXJlIHVzZWQgZm9yIG90aGVyIHB1cnBvc2VzIGFzIHdlbGwsIGkuZS4gZmluZGluZ1xuICAgdGhlIG1pbmltdW0gYW5kIG1heGltdW0gbGVuZ3RoIGNvZGVzLCBkZXRlcm1pbmluZyBpZiB0aGVyZSBhcmUgYW55XG4gICBjb2RlcyBhdCBhbGwsIGNoZWNraW5nIGZvciBhIHZhbGlkIHNldCBvZiBsZW5ndGhzLCBhbmQgbG9va2luZyBhaGVhZFxuICAgYXQgbGVuZ3RoIGNvdW50cyB0byBkZXRlcm1pbmUgc3ViLXRhYmxlIHNpemVzIHdoZW4gYnVpbGRpbmcgdGhlXG4gICBkZWNvZGluZyB0YWJsZXMuXG4gICAqL1xuXG4gIC8qIGFjY3VtdWxhdGUgbGVuZ3RocyBmb3IgY29kZXMgKGFzc3VtZXMgbGVuc1tdIGFsbCBpbiAwLi5NQVhCSVRTKSAqL1xuICBmb3IgKGxlbiA9IDA7IGxlbiA8PSBNQVhCSVRTOyBsZW4rKykge1xuICAgIGNvdW50W2xlbl0gPSAwO1xuICB9XG4gIGZvciAoc3ltID0gMDsgc3ltIDwgY29kZXM7IHN5bSsrKSB7XG4gICAgY291bnRbbGVuc1tsZW5zX2luZGV4ICsgc3ltXV0rKztcbiAgfVxuXG4gIC8qIGJvdW5kIGNvZGUgbGVuZ3RocywgZm9yY2Ugcm9vdCB0byBiZSB3aXRoaW4gY29kZSBsZW5ndGhzICovXG4gIHJvb3QgPSBiaXRzO1xuICBmb3IgKG1heCA9IE1BWEJJVFM7IG1heCA+PSAxOyBtYXgtLSkge1xuICAgIGlmIChjb3VudFttYXhdICE9PSAwKSB7IGJyZWFrOyB9XG4gIH1cbiAgaWYgKHJvb3QgPiBtYXgpIHtcbiAgICByb290ID0gbWF4O1xuICB9XG4gIGlmIChtYXggPT09IDApIHsgICAgICAgICAgICAgICAgICAgICAvKiBubyBzeW1ib2xzIHRvIGNvZGUgYXQgYWxsICovXG4gICAgLy90YWJsZS5vcFtvcHRzLnRhYmxlX2luZGV4XSA9IDY0OyAgLy9oZXJlLm9wID0gKHZhciBjaGFyKTY0OyAgICAvKiBpbnZhbGlkIGNvZGUgbWFya2VyICovXG4gICAgLy90YWJsZS5iaXRzW29wdHMudGFibGVfaW5kZXhdID0gMTsgICAvL2hlcmUuYml0cyA9ICh2YXIgY2hhcikxO1xuICAgIC8vdGFibGUudmFsW29wdHMudGFibGVfaW5kZXgrK10gPSAwOyAgIC8vaGVyZS52YWwgPSAodmFyIHNob3J0KTA7XG4gICAgdGFibGVbdGFibGVfaW5kZXgrK10gPSAoMSA8PCAyNCkgfCAoNjQgPDwgMTYpIHwgMDtcblxuXG4gICAgLy90YWJsZS5vcFtvcHRzLnRhYmxlX2luZGV4XSA9IDY0O1xuICAgIC8vdGFibGUuYml0c1tvcHRzLnRhYmxlX2luZGV4XSA9IDE7XG4gICAgLy90YWJsZS52YWxbb3B0cy50YWJsZV9pbmRleCsrXSA9IDA7XG4gICAgdGFibGVbdGFibGVfaW5kZXgrK10gPSAoMSA8PCAyNCkgfCAoNjQgPDwgMTYpIHwgMDtcblxuICAgIG9wdHMuYml0cyA9IDE7XG4gICAgcmV0dXJuIDA7ICAgICAvKiBubyBzeW1ib2xzLCBidXQgd2FpdCBmb3IgZGVjb2RpbmcgdG8gcmVwb3J0IGVycm9yICovXG4gIH1cbiAgZm9yIChtaW4gPSAxOyBtaW4gPCBtYXg7IG1pbisrKSB7XG4gICAgaWYgKGNvdW50W21pbl0gIT09IDApIHsgYnJlYWs7IH1cbiAgfVxuICBpZiAocm9vdCA8IG1pbikge1xuICAgIHJvb3QgPSBtaW47XG4gIH1cblxuICAvKiBjaGVjayBmb3IgYW4gb3Zlci1zdWJzY3JpYmVkIG9yIGluY29tcGxldGUgc2V0IG9mIGxlbmd0aHMgKi9cbiAgbGVmdCA9IDE7XG4gIGZvciAobGVuID0gMTsgbGVuIDw9IE1BWEJJVFM7IGxlbisrKSB7XG4gICAgbGVmdCA8PD0gMTtcbiAgICBsZWZ0IC09IGNvdW50W2xlbl07XG4gICAgaWYgKGxlZnQgPCAwKSB7XG4gICAgICByZXR1cm4gLTE7XG4gICAgfSAgICAgICAgLyogb3Zlci1zdWJzY3JpYmVkICovXG4gIH1cbiAgaWYgKGxlZnQgPiAwICYmICh0eXBlID09PSBDT0RFUyQxIHx8IG1heCAhPT0gMSkpIHtcbiAgICByZXR1cm4gLTE7ICAgICAgICAgICAgICAgICAgICAgIC8qIGluY29tcGxldGUgc2V0ICovXG4gIH1cblxuICAvKiBnZW5lcmF0ZSBvZmZzZXRzIGludG8gc3ltYm9sIHRhYmxlIGZvciBlYWNoIGxlbmd0aCBmb3Igc29ydGluZyAqL1xuICBvZmZzWzFdID0gMDtcbiAgZm9yIChsZW4gPSAxOyBsZW4gPCBNQVhCSVRTOyBsZW4rKykge1xuICAgIG9mZnNbbGVuICsgMV0gPSBvZmZzW2xlbl0gKyBjb3VudFtsZW5dO1xuICB9XG5cbiAgLyogc29ydCBzeW1ib2xzIGJ5IGxlbmd0aCwgYnkgc3ltYm9sIG9yZGVyIHdpdGhpbiBlYWNoIGxlbmd0aCAqL1xuICBmb3IgKHN5bSA9IDA7IHN5bSA8IGNvZGVzOyBzeW0rKykge1xuICAgIGlmIChsZW5zW2xlbnNfaW5kZXggKyBzeW1dICE9PSAwKSB7XG4gICAgICB3b3JrW29mZnNbbGVuc1tsZW5zX2luZGV4ICsgc3ltXV0rK10gPSBzeW07XG4gICAgfVxuICB9XG5cbiAgLypcbiAgIENyZWF0ZSBhbmQgZmlsbCBpbiBkZWNvZGluZyB0YWJsZXMuICBJbiB0aGlzIGxvb3AsIHRoZSB0YWJsZSBiZWluZ1xuICAgZmlsbGVkIGlzIGF0IG5leHQgYW5kIGhhcyBjdXJyIGluZGV4IGJpdHMuICBUaGUgY29kZSBiZWluZyB1c2VkIGlzIGh1ZmZcbiAgIHdpdGggbGVuZ3RoIGxlbi4gIFRoYXQgY29kZSBpcyBjb252ZXJ0ZWQgdG8gYW4gaW5kZXggYnkgZHJvcHBpbmcgZHJvcFxuICAgYml0cyBvZmYgb2YgdGhlIGJvdHRvbS4gIEZvciBjb2RlcyB3aGVyZSBsZW4gaXMgbGVzcyB0aGFuIGRyb3AgKyBjdXJyLFxuICAgdGhvc2UgdG9wIGRyb3AgKyBjdXJyIC0gbGVuIGJpdHMgYXJlIGluY3JlbWVudGVkIHRocm91Z2ggYWxsIHZhbHVlcyB0b1xuICAgZmlsbCB0aGUgdGFibGUgd2l0aCByZXBsaWNhdGVkIGVudHJpZXMuXG5cbiAgIHJvb3QgaXMgdGhlIG51bWJlciBvZiBpbmRleCBiaXRzIGZvciB0aGUgcm9vdCB0YWJsZS4gIFdoZW4gbGVuIGV4Y2VlZHNcbiAgIHJvb3QsIHN1Yi10YWJsZXMgYXJlIGNyZWF0ZWQgcG9pbnRlZCB0byBieSB0aGUgcm9vdCBlbnRyeSB3aXRoIGFuIGluZGV4XG4gICBvZiB0aGUgbG93IHJvb3QgYml0cyBvZiBodWZmLiAgVGhpcyBpcyBzYXZlZCBpbiBsb3cgdG8gY2hlY2sgZm9yIHdoZW4gYVxuICAgbmV3IHN1Yi10YWJsZSBzaG91bGQgYmUgc3RhcnRlZC4gIGRyb3AgaXMgemVybyB3aGVuIHRoZSByb290IHRhYmxlIGlzXG4gICBiZWluZyBmaWxsZWQsIGFuZCBkcm9wIGlzIHJvb3Qgd2hlbiBzdWItdGFibGVzIGFyZSBiZWluZyBmaWxsZWQuXG5cbiAgIFdoZW4gYSBuZXcgc3ViLXRhYmxlIGlzIG5lZWRlZCwgaXQgaXMgbmVjZXNzYXJ5IHRvIGxvb2sgYWhlYWQgaW4gdGhlXG4gICBjb2RlIGxlbmd0aHMgdG8gZGV0ZXJtaW5lIHdoYXQgc2l6ZSBzdWItdGFibGUgaXMgbmVlZGVkLiAgVGhlIGxlbmd0aFxuICAgY291bnRzIGFyZSB1c2VkIGZvciB0aGlzLCBhbmQgc28gY291bnRbXSBpcyBkZWNyZW1lbnRlZCBhcyBjb2RlcyBhcmVcbiAgIGVudGVyZWQgaW4gdGhlIHRhYmxlcy5cblxuICAgdXNlZCBrZWVwcyB0cmFjayBvZiBob3cgbWFueSB0YWJsZSBlbnRyaWVzIGhhdmUgYmVlbiBhbGxvY2F0ZWQgZnJvbSB0aGVcbiAgIHByb3ZpZGVkICp0YWJsZSBzcGFjZS4gIEl0IGlzIGNoZWNrZWQgZm9yIExFTlMgYW5kIERJU1QgdGFibGVzIGFnYWluc3RcbiAgIHRoZSBjb25zdGFudHMgRU5PVUdIX0xFTlMgYW5kIEVOT1VHSF9ESVNUUyB0byBndWFyZCBhZ2FpbnN0IGNoYW5nZXMgaW5cbiAgIHRoZSBpbml0aWFsIHJvb3QgdGFibGUgc2l6ZSBjb25zdGFudHMuICBTZWUgdGhlIGNvbW1lbnRzIGluIGluZnRyZWVzLmhcbiAgIGZvciBtb3JlIGluZm9ybWF0aW9uLlxuXG4gICBzeW0gaW5jcmVtZW50cyB0aHJvdWdoIGFsbCBzeW1ib2xzLCBhbmQgdGhlIGxvb3AgdGVybWluYXRlcyB3aGVuXG4gICBhbGwgY29kZXMgb2YgbGVuZ3RoIG1heCwgaS5lLiBhbGwgY29kZXMsIGhhdmUgYmVlbiBwcm9jZXNzZWQuICBUaGlzXG4gICByb3V0aW5lIHBlcm1pdHMgaW5jb21wbGV0ZSBjb2Rlcywgc28gYW5vdGhlciBsb29wIGFmdGVyIHRoaXMgb25lIGZpbGxzXG4gICBpbiB0aGUgcmVzdCBvZiB0aGUgZGVjb2RpbmcgdGFibGVzIHdpdGggaW52YWxpZCBjb2RlIG1hcmtlcnMuXG4gICAqL1xuXG4gIC8qIHNldCB1cCBmb3IgY29kZSB0eXBlICovXG4gIC8vIHBvb3IgbWFuIG9wdGltaXphdGlvbiAtIHVzZSBpZi1lbHNlIGluc3RlYWQgb2Ygc3dpdGNoLFxuICAvLyB0byBhdm9pZCBkZW9wdHMgaW4gb2xkIHY4XG4gIGlmICh0eXBlID09PSBDT0RFUyQxKSB7XG4gICAgYmFzZSA9IGV4dHJhID0gd29yazsgICAgLyogZHVtbXkgdmFsdWUtLW5vdCB1c2VkICovXG4gICAgbWF0Y2ggPSAyMDtcblxuICB9IGVsc2UgaWYgKHR5cGUgPT09IExFTlMkMSkge1xuICAgIGJhc2UgPSBsYmFzZTtcbiAgICBleHRyYSA9IGxleHQ7XG4gICAgbWF0Y2ggPSAyNTc7XG5cbiAgfSBlbHNlIHsgICAgICAgICAgICAgICAgICAgIC8qIERJU1RTICovXG4gICAgYmFzZSA9IGRiYXNlO1xuICAgIGV4dHJhID0gZGV4dDtcbiAgICBtYXRjaCA9IDA7XG4gIH1cblxuICAvKiBpbml0aWFsaXplIG9wdHMgZm9yIGxvb3AgKi9cbiAgaHVmZiA9IDA7ICAgICAgICAgICAgICAgICAgIC8qIHN0YXJ0aW5nIGNvZGUgKi9cbiAgc3ltID0gMDsgICAgICAgICAgICAgICAgICAgIC8qIHN0YXJ0aW5nIGNvZGUgc3ltYm9sICovXG4gIGxlbiA9IG1pbjsgICAgICAgICAgICAgICAgICAvKiBzdGFydGluZyBjb2RlIGxlbmd0aCAqL1xuICBuZXh0ID0gdGFibGVfaW5kZXg7ICAgICAgICAgICAgICAvKiBjdXJyZW50IHRhYmxlIHRvIGZpbGwgaW4gKi9cbiAgY3VyciA9IHJvb3Q7ICAgICAgICAgICAgICAgIC8qIGN1cnJlbnQgdGFibGUgaW5kZXggYml0cyAqL1xuICBkcm9wID0gMDsgICAgICAgICAgICAgICAgICAgLyogY3VycmVudCBiaXRzIHRvIGRyb3AgZnJvbSBjb2RlIGZvciBpbmRleCAqL1xuICBsb3cgPSAtMTsgICAgICAgICAgICAgICAgICAgLyogdHJpZ2dlciBuZXcgc3ViLXRhYmxlIHdoZW4gbGVuID4gcm9vdCAqL1xuICB1c2VkID0gMSA8PCByb290OyAgICAgICAgICAvKiB1c2Ugcm9vdCB0YWJsZSBlbnRyaWVzICovXG4gIG1hc2sgPSB1c2VkIC0gMTsgICAgICAgICAgICAvKiBtYXNrIGZvciBjb21wYXJpbmcgbG93ICovXG5cbiAgLyogY2hlY2sgYXZhaWxhYmxlIHRhYmxlIHNwYWNlICovXG4gIGlmICgodHlwZSA9PT0gTEVOUyQxICYmIHVzZWQgPiBFTk9VR0hfTEVOUyQxKSB8fFxuICAgICh0eXBlID09PSBESVNUUyQxICYmIHVzZWQgPiBFTk9VR0hfRElTVFMkMSkpIHtcbiAgICByZXR1cm4gMTtcbiAgfVxuXG4gIC8qIHByb2Nlc3MgYWxsIGNvZGVzIGFuZCBtYWtlIHRhYmxlIGVudHJpZXMgKi9cbiAgZm9yICg7Oykge1xuICAgIC8qIGNyZWF0ZSB0YWJsZSBlbnRyeSAqL1xuICAgIGhlcmVfYml0cyA9IGxlbiAtIGRyb3A7XG4gICAgaWYgKHdvcmtbc3ltXSArIDEgPCBtYXRjaCkge1xuICAgICAgaGVyZV9vcCA9IDA7XG4gICAgICBoZXJlX3ZhbCA9IHdvcmtbc3ltXTtcbiAgICB9XG4gICAgZWxzZSBpZiAod29ya1tzeW1dID49IG1hdGNoKSB7XG4gICAgICBoZXJlX29wID0gZXh0cmFbd29ya1tzeW1dIC0gbWF0Y2hdO1xuICAgICAgaGVyZV92YWwgPSBiYXNlW3dvcmtbc3ltXSAtIG1hdGNoXTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBoZXJlX29wID0gMzIgKyA2NDsgICAgICAgICAvKiBlbmQgb2YgYmxvY2sgKi9cbiAgICAgIGhlcmVfdmFsID0gMDtcbiAgICB9XG5cbiAgICAvKiByZXBsaWNhdGUgZm9yIHRob3NlIGluZGljZXMgd2l0aCBsb3cgbGVuIGJpdHMgZXF1YWwgdG8gaHVmZiAqL1xuICAgIGluY3IgPSAxIDw8IChsZW4gLSBkcm9wKTtcbiAgICBmaWxsID0gMSA8PCBjdXJyO1xuICAgIG1pbiA9IGZpbGw7ICAgICAgICAgICAgICAgICAvKiBzYXZlIG9mZnNldCB0byBuZXh0IHRhYmxlICovXG4gICAgZG8ge1xuICAgICAgZmlsbCAtPSBpbmNyO1xuICAgICAgdGFibGVbbmV4dCArIChodWZmID4+IGRyb3ApICsgZmlsbF0gPSAoaGVyZV9iaXRzIDw8IDI0KSB8IChoZXJlX29wIDw8IDE2KSB8IGhlcmVfdmFsIHwwO1xuICAgIH0gd2hpbGUgKGZpbGwgIT09IDApO1xuXG4gICAgLyogYmFja3dhcmRzIGluY3JlbWVudCB0aGUgbGVuLWJpdCBjb2RlIGh1ZmYgKi9cbiAgICBpbmNyID0gMSA8PCAobGVuIC0gMSk7XG4gICAgd2hpbGUgKGh1ZmYgJiBpbmNyKSB7XG4gICAgICBpbmNyID4+PSAxO1xuICAgIH1cbiAgICBpZiAoaW5jciAhPT0gMCkge1xuICAgICAgaHVmZiAmPSBpbmNyIC0gMTtcbiAgICAgIGh1ZmYgKz0gaW5jcjtcbiAgICB9IGVsc2Uge1xuICAgICAgaHVmZiA9IDA7XG4gICAgfVxuXG4gICAgLyogZ28gdG8gbmV4dCBzeW1ib2wsIHVwZGF0ZSBjb3VudCwgbGVuICovXG4gICAgc3ltKys7XG4gICAgaWYgKC0tY291bnRbbGVuXSA9PT0gMCkge1xuICAgICAgaWYgKGxlbiA9PT0gbWF4KSB7IGJyZWFrOyB9XG4gICAgICBsZW4gPSBsZW5zW2xlbnNfaW5kZXggKyB3b3JrW3N5bV1dO1xuICAgIH1cblxuICAgIC8qIGNyZWF0ZSBuZXcgc3ViLXRhYmxlIGlmIG5lZWRlZCAqL1xuICAgIGlmIChsZW4gPiByb290ICYmIChodWZmICYgbWFzaykgIT09IGxvdykge1xuICAgICAgLyogaWYgZmlyc3QgdGltZSwgdHJhbnNpdGlvbiB0byBzdWItdGFibGVzICovXG4gICAgICBpZiAoZHJvcCA9PT0gMCkge1xuICAgICAgICBkcm9wID0gcm9vdDtcbiAgICAgIH1cblxuICAgICAgLyogaW5jcmVtZW50IHBhc3QgbGFzdCB0YWJsZSAqL1xuICAgICAgbmV4dCArPSBtaW47ICAgICAgICAgICAgLyogaGVyZSBtaW4gaXMgMSA8PCBjdXJyICovXG5cbiAgICAgIC8qIGRldGVybWluZSBsZW5ndGggb2YgbmV4dCB0YWJsZSAqL1xuICAgICAgY3VyciA9IGxlbiAtIGRyb3A7XG4gICAgICBsZWZ0ID0gMSA8PCBjdXJyO1xuICAgICAgd2hpbGUgKGN1cnIgKyBkcm9wIDwgbWF4KSB7XG4gICAgICAgIGxlZnQgLT0gY291bnRbY3VyciArIGRyb3BdO1xuICAgICAgICBpZiAobGVmdCA8PSAwKSB7IGJyZWFrOyB9XG4gICAgICAgIGN1cnIrKztcbiAgICAgICAgbGVmdCA8PD0gMTtcbiAgICAgIH1cblxuICAgICAgLyogY2hlY2sgZm9yIGVub3VnaCBzcGFjZSAqL1xuICAgICAgdXNlZCArPSAxIDw8IGN1cnI7XG4gICAgICBpZiAoKHR5cGUgPT09IExFTlMkMSAmJiB1c2VkID4gRU5PVUdIX0xFTlMkMSkgfHxcbiAgICAgICAgKHR5cGUgPT09IERJU1RTJDEgJiYgdXNlZCA+IEVOT1VHSF9ESVNUUyQxKSkge1xuICAgICAgICByZXR1cm4gMTtcbiAgICAgIH1cblxuICAgICAgLyogcG9pbnQgZW50cnkgaW4gcm9vdCB0YWJsZSB0byBzdWItdGFibGUgKi9cbiAgICAgIGxvdyA9IGh1ZmYgJiBtYXNrO1xuICAgICAgLyp0YWJsZS5vcFtsb3ddID0gY3VycjtcbiAgICAgIHRhYmxlLmJpdHNbbG93XSA9IHJvb3Q7XG4gICAgICB0YWJsZS52YWxbbG93XSA9IG5leHQgLSBvcHRzLnRhYmxlX2luZGV4OyovXG4gICAgICB0YWJsZVtsb3ddID0gKHJvb3QgPDwgMjQpIHwgKGN1cnIgPDwgMTYpIHwgKG5leHQgLSB0YWJsZV9pbmRleCkgfDA7XG4gICAgfVxuICB9XG5cbiAgLyogZmlsbCBpbiByZW1haW5pbmcgdGFibGUgZW50cnkgaWYgY29kZSBpcyBpbmNvbXBsZXRlIChndWFyYW50ZWVkIHRvIGhhdmVcbiAgIGF0IG1vc3Qgb25lIHJlbWFpbmluZyBlbnRyeSwgc2luY2UgaWYgdGhlIGNvZGUgaXMgaW5jb21wbGV0ZSwgdGhlXG4gICBtYXhpbXVtIGNvZGUgbGVuZ3RoIHRoYXQgd2FzIGFsbG93ZWQgdG8gZ2V0IHRoaXMgZmFyIGlzIG9uZSBiaXQpICovXG4gIGlmIChodWZmICE9PSAwKSB7XG4gICAgLy90YWJsZS5vcFtuZXh0ICsgaHVmZl0gPSA2NDsgICAgICAgICAgICAvKiBpbnZhbGlkIGNvZGUgbWFya2VyICovXG4gICAgLy90YWJsZS5iaXRzW25leHQgKyBodWZmXSA9IGxlbiAtIGRyb3A7XG4gICAgLy90YWJsZS52YWxbbmV4dCArIGh1ZmZdID0gMDtcbiAgICB0YWJsZVtuZXh0ICsgaHVmZl0gPSAoKGxlbiAtIGRyb3ApIDw8IDI0KSB8ICg2NCA8PCAxNikgfDA7XG4gIH1cblxuICAvKiBzZXQgcmV0dXJuIHBhcmFtZXRlcnMgKi9cbiAgLy9vcHRzLnRhYmxlX2luZGV4ICs9IHVzZWQ7XG4gIG9wdHMuYml0cyA9IHJvb3Q7XG4gIHJldHVybiAwO1xufTtcblxuXG52YXIgaW5mdHJlZXMgPSBpbmZsYXRlX3RhYmxlO1xuXG4vLyAoQykgMTk5NS0yMDEzIEplYW4tbG91cCBHYWlsbHkgYW5kIE1hcmsgQWRsZXJcbi8vIChDKSAyMDE0LTIwMTcgVml0YWx5IFB1enJpbiBhbmQgQW5kcmV5IFR1cGl0c2luXG4vL1xuLy8gVGhpcyBzb2Z0d2FyZSBpcyBwcm92aWRlZCAnYXMtaXMnLCB3aXRob3V0IGFueSBleHByZXNzIG9yIGltcGxpZWRcbi8vIHdhcnJhbnR5LiBJbiBubyBldmVudCB3aWxsIHRoZSBhdXRob3JzIGJlIGhlbGQgbGlhYmxlIGZvciBhbnkgZGFtYWdlc1xuLy8gYXJpc2luZyBmcm9tIHRoZSB1c2Ugb2YgdGhpcyBzb2Z0d2FyZS5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGdyYW50ZWQgdG8gYW55b25lIHRvIHVzZSB0aGlzIHNvZnR3YXJlIGZvciBhbnkgcHVycG9zZSxcbi8vIGluY2x1ZGluZyBjb21tZXJjaWFsIGFwcGxpY2F0aW9ucywgYW5kIHRvIGFsdGVyIGl0IGFuZCByZWRpc3RyaWJ1dGUgaXRcbi8vIGZyZWVseSwgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nIHJlc3RyaWN0aW9uczpcbi8vXG4vLyAxLiBUaGUgb3JpZ2luIG9mIHRoaXMgc29mdHdhcmUgbXVzdCBub3QgYmUgbWlzcmVwcmVzZW50ZWQ7IHlvdSBtdXN0IG5vdFxuLy8gICBjbGFpbSB0aGF0IHlvdSB3cm90ZSB0aGUgb3JpZ2luYWwgc29mdHdhcmUuIElmIHlvdSB1c2UgdGhpcyBzb2Z0d2FyZVxuLy8gICBpbiBhIHByb2R1Y3QsIGFuIGFja25vd2xlZGdtZW50IGluIHRoZSBwcm9kdWN0IGRvY3VtZW50YXRpb24gd291bGQgYmVcbi8vICAgYXBwcmVjaWF0ZWQgYnV0IGlzIG5vdCByZXF1aXJlZC5cbi8vIDIuIEFsdGVyZWQgc291cmNlIHZlcnNpb25zIG11c3QgYmUgcGxhaW5seSBtYXJrZWQgYXMgc3VjaCwgYW5kIG11c3Qgbm90IGJlXG4vLyAgIG1pc3JlcHJlc2VudGVkIGFzIGJlaW5nIHRoZSBvcmlnaW5hbCBzb2Z0d2FyZS5cbi8vIDMuIFRoaXMgbm90aWNlIG1heSBub3QgYmUgcmVtb3ZlZCBvciBhbHRlcmVkIGZyb20gYW55IHNvdXJjZSBkaXN0cmlidXRpb24uXG5cblxuXG5cblxuXG5jb25zdCBDT0RFUyA9IDA7XG5jb25zdCBMRU5TID0gMTtcbmNvbnN0IERJU1RTID0gMjtcblxuLyogUHVibGljIGNvbnN0YW50cyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Ki9cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSovXG5cbmNvbnN0IHtcbiAgWl9GSU5JU0g6IFpfRklOSVNIJDEsIFpfQkxPQ0ssIFpfVFJFRVMsXG4gIFpfT0s6IFpfT0skMSwgWl9TVFJFQU1fRU5EOiBaX1NUUkVBTV9FTkQkMSwgWl9ORUVEX0RJQ1Q6IFpfTkVFRF9ESUNUJDEsIFpfU1RSRUFNX0VSUk9SOiBaX1NUUkVBTV9FUlJPUiQxLCBaX0RBVEFfRVJST1I6IFpfREFUQV9FUlJPUiQxLCBaX01FTV9FUlJPUjogWl9NRU1fRVJST1IkMSwgWl9CVUZfRVJST1IsXG4gIFpfREVGTEFURURcbn0gPSBjb25zdGFudHMkMjtcblxuXG4vKiBTVEFURVMgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0qL1xuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Ki9cblxuXG5jb25zdCAgICBIRUFEID0gMTYxODA7ICAgICAgIC8qIGk6IHdhaXRpbmcgZm9yIG1hZ2ljIGhlYWRlciAqL1xuY29uc3QgICAgRkxBR1MgPSAxNjE4MTsgICAgICAvKiBpOiB3YWl0aW5nIGZvciBtZXRob2QgYW5kIGZsYWdzIChnemlwKSAqL1xuY29uc3QgICAgVElNRSA9IDE2MTgyOyAgICAgICAvKiBpOiB3YWl0aW5nIGZvciBtb2RpZmljYXRpb24gdGltZSAoZ3ppcCkgKi9cbmNvbnN0ICAgIE9TID0gMTYxODM7ICAgICAgICAgLyogaTogd2FpdGluZyBmb3IgZXh0cmEgZmxhZ3MgYW5kIG9wZXJhdGluZyBzeXN0ZW0gKGd6aXApICovXG5jb25zdCAgICBFWExFTiA9IDE2MTg0OyAgICAgIC8qIGk6IHdhaXRpbmcgZm9yIGV4dHJhIGxlbmd0aCAoZ3ppcCkgKi9cbmNvbnN0ICAgIEVYVFJBID0gMTYxODU7ICAgICAgLyogaTogd2FpdGluZyBmb3IgZXh0cmEgYnl0ZXMgKGd6aXApICovXG5jb25zdCAgICBOQU1FID0gMTYxODY7ICAgICAgIC8qIGk6IHdhaXRpbmcgZm9yIGVuZCBvZiBmaWxlIG5hbWUgKGd6aXApICovXG5jb25zdCAgICBDT01NRU5UID0gMTYxODc7ICAgIC8qIGk6IHdhaXRpbmcgZm9yIGVuZCBvZiBjb21tZW50IChnemlwKSAqL1xuY29uc3QgICAgSENSQyA9IDE2MTg4OyAgICAgICAvKiBpOiB3YWl0aW5nIGZvciBoZWFkZXIgY3JjIChnemlwKSAqL1xuY29uc3QgICAgRElDVElEID0gMTYxODk7ICAgIC8qIGk6IHdhaXRpbmcgZm9yIGRpY3Rpb25hcnkgY2hlY2sgdmFsdWUgKi9cbmNvbnN0ICAgIERJQ1QgPSAxNjE5MDsgICAgICAvKiB3YWl0aW5nIGZvciBpbmZsYXRlU2V0RGljdGlvbmFyeSgpIGNhbGwgKi9cbmNvbnN0ICAgICAgICBUWVBFID0gMTYxOTE7ICAgICAgLyogaTogd2FpdGluZyBmb3IgdHlwZSBiaXRzLCBpbmNsdWRpbmcgbGFzdC1mbGFnIGJpdCAqL1xuY29uc3QgICAgICAgIFRZUEVETyA9IDE2MTkyOyAgICAvKiBpOiBzYW1lLCBidXQgc2tpcCBjaGVjayB0byBleGl0IGluZmxhdGUgb24gbmV3IGJsb2NrICovXG5jb25zdCAgICAgICAgU1RPUkVEID0gMTYxOTM7ICAgIC8qIGk6IHdhaXRpbmcgZm9yIHN0b3JlZCBzaXplIChsZW5ndGggYW5kIGNvbXBsZW1lbnQpICovXG5jb25zdCAgICAgICAgQ09QWV8gPSAxNjE5NDsgICAgIC8qIGkvbzogc2FtZSBhcyBDT1BZIGJlbG93LCBidXQgb25seSBmaXJzdCB0aW1lIGluICovXG5jb25zdCAgICAgICAgQ09QWSA9IDE2MTk1OyAgICAgIC8qIGkvbzogd2FpdGluZyBmb3IgaW5wdXQgb3Igb3V0cHV0IHRvIGNvcHkgc3RvcmVkIGJsb2NrICovXG5jb25zdCAgICAgICAgVEFCTEUgPSAxNjE5NjsgICAgIC8qIGk6IHdhaXRpbmcgZm9yIGR5bmFtaWMgYmxvY2sgdGFibGUgbGVuZ3RocyAqL1xuY29uc3QgICAgICAgIExFTkxFTlMgPSAxNjE5NzsgICAvKiBpOiB3YWl0aW5nIGZvciBjb2RlIGxlbmd0aCBjb2RlIGxlbmd0aHMgKi9cbmNvbnN0ICAgICAgICBDT0RFTEVOUyA9IDE2MTk4OyAgLyogaTogd2FpdGluZyBmb3IgbGVuZ3RoL2xpdCBhbmQgZGlzdGFuY2UgY29kZSBsZW5ndGhzICovXG5jb25zdCAgICAgICAgICAgIExFTl8gPSAxNjE5OTsgICAgICAvKiBpOiBzYW1lIGFzIExFTiBiZWxvdywgYnV0IG9ubHkgZmlyc3QgdGltZSBpbiAqL1xuY29uc3QgICAgICAgICAgICBMRU4gPSAxNjIwMDsgICAgICAgLyogaTogd2FpdGluZyBmb3IgbGVuZ3RoL2xpdC9lb2IgY29kZSAqL1xuY29uc3QgICAgICAgICAgICBMRU5FWFQgPSAxNjIwMTsgICAgLyogaTogd2FpdGluZyBmb3IgbGVuZ3RoIGV4dHJhIGJpdHMgKi9cbmNvbnN0ICAgICAgICAgICAgRElTVCA9IDE2MjAyOyAgICAgIC8qIGk6IHdhaXRpbmcgZm9yIGRpc3RhbmNlIGNvZGUgKi9cbmNvbnN0ICAgICAgICAgICAgRElTVEVYVCA9IDE2MjAzOyAgIC8qIGk6IHdhaXRpbmcgZm9yIGRpc3RhbmNlIGV4dHJhIGJpdHMgKi9cbmNvbnN0ICAgICAgICAgICAgTUFUQ0ggPSAxNjIwNDsgICAgIC8qIG86IHdhaXRpbmcgZm9yIG91dHB1dCBzcGFjZSB0byBjb3B5IHN0cmluZyAqL1xuY29uc3QgICAgICAgICAgICBMSVQgPSAxNjIwNTsgICAgICAgLyogbzogd2FpdGluZyBmb3Igb3V0cHV0IHNwYWNlIHRvIHdyaXRlIGxpdGVyYWwgKi9cbmNvbnN0ICAgIENIRUNLID0gMTYyMDY7ICAgICAvKiBpOiB3YWl0aW5nIGZvciAzMi1iaXQgY2hlY2sgdmFsdWUgKi9cbmNvbnN0ICAgIExFTkdUSCA9IDE2MjA3OyAgICAvKiBpOiB3YWl0aW5nIGZvciAzMi1iaXQgbGVuZ3RoIChnemlwKSAqL1xuY29uc3QgICAgRE9ORSA9IDE2MjA4OyAgICAgIC8qIGZpbmlzaGVkIGNoZWNrLCBkb25lIC0tIHJlbWFpbiBoZXJlIHVudGlsIHJlc2V0ICovXG5jb25zdCAgICBCQUQgPSAxNjIwOTsgICAgICAgLyogZ290IGEgZGF0YSBlcnJvciAtLSByZW1haW4gaGVyZSB1bnRpbCByZXNldCAqL1xuY29uc3QgICAgTUVNID0gMTYyMTA7ICAgICAgIC8qIGdvdCBhbiBpbmZsYXRlKCkgbWVtb3J5IGVycm9yIC0tIHJlbWFpbiBoZXJlIHVudGlsIHJlc2V0ICovXG5jb25zdCAgICBTWU5DID0gMTYyMTE7ICAgICAgLyogbG9va2luZyBmb3Igc3luY2hyb25pemF0aW9uIGJ5dGVzIHRvIHJlc3RhcnQgaW5mbGF0ZSgpICovXG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSovXG5cblxuXG5jb25zdCBFTk9VR0hfTEVOUyA9IDg1MjtcbmNvbnN0IEVOT1VHSF9ESVNUUyA9IDU5Mjtcbi8vY29uc3QgRU5PVUdIID0gIChFTk9VR0hfTEVOUytFTk9VR0hfRElTVFMpO1xuXG5jb25zdCBNQVhfV0JJVFMgPSAxNTtcbi8qIDMySyBMWjc3IHdpbmRvdyAqL1xuY29uc3QgREVGX1dCSVRTID0gTUFYX1dCSVRTO1xuXG5cbmNvbnN0IHpzd2FwMzIgPSAocSkgPT4ge1xuXG4gIHJldHVybiAgKCgocSA+Pj4gMjQpICYgMHhmZikgK1xuICAgICAgICAgICgocSA+Pj4gOCkgJiAweGZmMDApICtcbiAgICAgICAgICAoKHEgJiAweGZmMDApIDw8IDgpICtcbiAgICAgICAgICAoKHEgJiAweGZmKSA8PCAyNCkpO1xufTtcblxuXG5mdW5jdGlvbiBJbmZsYXRlU3RhdGUoKSB7XG4gIHRoaXMuc3RybSA9IG51bGw7ICAgICAgICAgICAvKiBwb2ludGVyIGJhY2sgdG8gdGhpcyB6bGliIHN0cmVhbSAqL1xuICB0aGlzLm1vZGUgPSAwOyAgICAgICAgICAgICAgLyogY3VycmVudCBpbmZsYXRlIG1vZGUgKi9cbiAgdGhpcy5sYXN0ID0gZmFsc2U7ICAgICAgICAgIC8qIHRydWUgaWYgcHJvY2Vzc2luZyBsYXN0IGJsb2NrICovXG4gIHRoaXMud3JhcCA9IDA7ICAgICAgICAgICAgICAvKiBiaXQgMCB0cnVlIGZvciB6bGliLCBiaXQgMSB0cnVlIGZvciBnemlwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYml0IDIgdHJ1ZSB0byB2YWxpZGF0ZSBjaGVjayB2YWx1ZSAqL1xuICB0aGlzLmhhdmVkaWN0ID0gZmFsc2U7ICAgICAgLyogdHJ1ZSBpZiBkaWN0aW9uYXJ5IHByb3ZpZGVkICovXG4gIHRoaXMuZmxhZ3MgPSAwOyAgICAgICAgICAgICAvKiBnemlwIGhlYWRlciBtZXRob2QgYW5kIGZsYWdzICgwIGlmIHpsaWIpLCBvclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLTEgaWYgcmF3IG9yIG5vIGhlYWRlciB5ZXQgKi9cbiAgdGhpcy5kbWF4ID0gMDsgICAgICAgICAgICAgIC8qIHpsaWIgaGVhZGVyIG1heCBkaXN0YW5jZSAoSU5GTEFURV9TVFJJQ1QpICovXG4gIHRoaXMuY2hlY2sgPSAwOyAgICAgICAgICAgICAvKiBwcm90ZWN0ZWQgY29weSBvZiBjaGVjayB2YWx1ZSAqL1xuICB0aGlzLnRvdGFsID0gMDsgICAgICAgICAgICAgLyogcHJvdGVjdGVkIGNvcHkgb2Ygb3V0cHV0IGNvdW50ICovXG4gIC8vIFRPRE86IG1heSBiZSB7fVxuICB0aGlzLmhlYWQgPSBudWxsOyAgICAgICAgICAgLyogd2hlcmUgdG8gc2F2ZSBnemlwIGhlYWRlciBpbmZvcm1hdGlvbiAqL1xuXG4gIC8qIHNsaWRpbmcgd2luZG93ICovXG4gIHRoaXMud2JpdHMgPSAwOyAgICAgICAgICAgICAvKiBsb2cgYmFzZSAyIG9mIHJlcXVlc3RlZCB3aW5kb3cgc2l6ZSAqL1xuICB0aGlzLndzaXplID0gMDsgICAgICAgICAgICAgLyogd2luZG93IHNpemUgb3IgemVybyBpZiBub3QgdXNpbmcgd2luZG93ICovXG4gIHRoaXMud2hhdmUgPSAwOyAgICAgICAgICAgICAvKiB2YWxpZCBieXRlcyBpbiB0aGUgd2luZG93ICovXG4gIHRoaXMud25leHQgPSAwOyAgICAgICAgICAgICAvKiB3aW5kb3cgd3JpdGUgaW5kZXggKi9cbiAgdGhpcy53aW5kb3cgPSBudWxsOyAgICAgICAgIC8qIGFsbG9jYXRlZCBzbGlkaW5nIHdpbmRvdywgaWYgbmVlZGVkICovXG5cbiAgLyogYml0IGFjY3VtdWxhdG9yICovXG4gIHRoaXMuaG9sZCA9IDA7ICAgICAgICAgICAgICAvKiBpbnB1dCBiaXQgYWNjdW11bGF0b3IgKi9cbiAgdGhpcy5iaXRzID0gMDsgICAgICAgICAgICAgIC8qIG51bWJlciBvZiBiaXRzIGluIFwiaW5cIiAqL1xuXG4gIC8qIGZvciBzdHJpbmcgYW5kIHN0b3JlZCBibG9jayBjb3B5aW5nICovXG4gIHRoaXMubGVuZ3RoID0gMDsgICAgICAgICAgICAvKiBsaXRlcmFsIG9yIGxlbmd0aCBvZiBkYXRhIHRvIGNvcHkgKi9cbiAgdGhpcy5vZmZzZXQgPSAwOyAgICAgICAgICAgIC8qIGRpc3RhbmNlIGJhY2sgdG8gY29weSBzdHJpbmcgZnJvbSAqL1xuXG4gIC8qIGZvciB0YWJsZSBhbmQgY29kZSBkZWNvZGluZyAqL1xuICB0aGlzLmV4dHJhID0gMDsgICAgICAgICAgICAgLyogZXh0cmEgYml0cyBuZWVkZWQgKi9cblxuICAvKiBmaXhlZCBhbmQgZHluYW1pYyBjb2RlIHRhYmxlcyAqL1xuICB0aGlzLmxlbmNvZGUgPSBudWxsOyAgICAgICAgICAvKiBzdGFydGluZyB0YWJsZSBmb3IgbGVuZ3RoL2xpdGVyYWwgY29kZXMgKi9cbiAgdGhpcy5kaXN0Y29kZSA9IG51bGw7ICAgICAgICAgLyogc3RhcnRpbmcgdGFibGUgZm9yIGRpc3RhbmNlIGNvZGVzICovXG4gIHRoaXMubGVuYml0cyA9IDA7ICAgICAgICAgICAvKiBpbmRleCBiaXRzIGZvciBsZW5jb2RlICovXG4gIHRoaXMuZGlzdGJpdHMgPSAwOyAgICAgICAgICAvKiBpbmRleCBiaXRzIGZvciBkaXN0Y29kZSAqL1xuXG4gIC8qIGR5bmFtaWMgdGFibGUgYnVpbGRpbmcgKi9cbiAgdGhpcy5uY29kZSA9IDA7ICAgICAgICAgICAgIC8qIG51bWJlciBvZiBjb2RlIGxlbmd0aCBjb2RlIGxlbmd0aHMgKi9cbiAgdGhpcy5ubGVuID0gMDsgICAgICAgICAgICAgIC8qIG51bWJlciBvZiBsZW5ndGggY29kZSBsZW5ndGhzICovXG4gIHRoaXMubmRpc3QgPSAwOyAgICAgICAgICAgICAvKiBudW1iZXIgb2YgZGlzdGFuY2UgY29kZSBsZW5ndGhzICovXG4gIHRoaXMuaGF2ZSA9IDA7ICAgICAgICAgICAgICAvKiBudW1iZXIgb2YgY29kZSBsZW5ndGhzIGluIGxlbnNbXSAqL1xuICB0aGlzLm5leHQgPSBudWxsOyAgICAgICAgICAgICAgLyogbmV4dCBhdmFpbGFibGUgc3BhY2UgaW4gY29kZXNbXSAqL1xuXG4gIHRoaXMubGVucyA9IG5ldyBVaW50MTZBcnJheSgzMjApOyAvKiB0ZW1wb3Jhcnkgc3RvcmFnZSBmb3IgY29kZSBsZW5ndGhzICovXG4gIHRoaXMud29yayA9IG5ldyBVaW50MTZBcnJheSgyODgpOyAvKiB3b3JrIGFyZWEgZm9yIGNvZGUgdGFibGUgYnVpbGRpbmcgKi9cblxuICAvKlxuICAgYmVjYXVzZSB3ZSBkb24ndCBoYXZlIHBvaW50ZXJzIGluIGpzLCB3ZSB1c2UgbGVuY29kZSBhbmQgZGlzdGNvZGUgZGlyZWN0bHlcbiAgIGFzIGJ1ZmZlcnMgc28gd2UgZG9uJ3QgbmVlZCBjb2Rlc1xuICAqL1xuICAvL3RoaXMuY29kZXMgPSBuZXcgSW50MzJBcnJheShFTk9VR0gpOyAgICAgICAvKiBzcGFjZSBmb3IgY29kZSB0YWJsZXMgKi9cbiAgdGhpcy5sZW5keW4gPSBudWxsOyAgICAgICAgICAgICAgLyogZHluYW1pYyB0YWJsZSBmb3IgbGVuZ3RoL2xpdGVyYWwgY29kZXMgKEpTIHNwZWNpZmljKSAqL1xuICB0aGlzLmRpc3RkeW4gPSBudWxsOyAgICAgICAgICAgICAvKiBkeW5hbWljIHRhYmxlIGZvciBkaXN0YW5jZSBjb2RlcyAoSlMgc3BlY2lmaWMpICovXG4gIHRoaXMuc2FuZSA9IDA7ICAgICAgICAgICAgICAgICAgIC8qIGlmIGZhbHNlLCBhbGxvdyBpbnZhbGlkIGRpc3RhbmNlIHRvbyBmYXIgKi9cbiAgdGhpcy5iYWNrID0gMDsgICAgICAgICAgICAgICAgICAgLyogYml0cyBiYWNrIG9mIGxhc3QgdW5wcm9jZXNzZWQgbGVuZ3RoL2xpdCAqL1xuICB0aGlzLndhcyA9IDA7ICAgICAgICAgICAgICAgICAgICAvKiBpbml0aWFsIGxlbmd0aCBvZiBtYXRjaCAqL1xufVxuXG5cbmNvbnN0IGluZmxhdGVTdGF0ZUNoZWNrID0gKHN0cm0pID0+IHtcblxuICBpZiAoIXN0cm0pIHtcbiAgICByZXR1cm4gMTtcbiAgfVxuICBjb25zdCBzdGF0ZSA9IHN0cm0uc3RhdGU7XG4gIGlmICghc3RhdGUgfHwgc3RhdGUuc3RybSAhPT0gc3RybSB8fFxuICAgIHN0YXRlLm1vZGUgPCBIRUFEIHx8IHN0YXRlLm1vZGUgPiBTWU5DKSB7XG4gICAgcmV0dXJuIDE7XG4gIH1cbiAgcmV0dXJuIDA7XG59O1xuXG5cbmNvbnN0IGluZmxhdGVSZXNldEtlZXAgPSAoc3RybSkgPT4ge1xuXG4gIGlmIChpbmZsYXRlU3RhdGVDaGVjayhzdHJtKSkgeyByZXR1cm4gWl9TVFJFQU1fRVJST1IkMTsgfVxuICBjb25zdCBzdGF0ZSA9IHN0cm0uc3RhdGU7XG4gIHN0cm0udG90YWxfaW4gPSBzdHJtLnRvdGFsX291dCA9IHN0YXRlLnRvdGFsID0gMDtcbiAgc3RybS5tc2cgPSAnJzsgLypaX05VTEwqL1xuICBpZiAoc3RhdGUud3JhcCkgeyAgICAgICAvKiB0byBzdXBwb3J0IGlsbC1jb25jZWl2ZWQgSmF2YSB0ZXN0IHN1aXRlICovXG4gICAgc3RybS5hZGxlciA9IHN0YXRlLndyYXAgJiAxO1xuICB9XG4gIHN0YXRlLm1vZGUgPSBIRUFEO1xuICBzdGF0ZS5sYXN0ID0gMDtcbiAgc3RhdGUuaGF2ZWRpY3QgPSAwO1xuICBzdGF0ZS5mbGFncyA9IC0xO1xuICBzdGF0ZS5kbWF4ID0gMzI3Njg7XG4gIHN0YXRlLmhlYWQgPSBudWxsLypaX05VTEwqLztcbiAgc3RhdGUuaG9sZCA9IDA7XG4gIHN0YXRlLmJpdHMgPSAwO1xuICAvL3N0YXRlLmxlbmNvZGUgPSBzdGF0ZS5kaXN0Y29kZSA9IHN0YXRlLm5leHQgPSBzdGF0ZS5jb2RlcztcbiAgc3RhdGUubGVuY29kZSA9IHN0YXRlLmxlbmR5biA9IG5ldyBJbnQzMkFycmF5KEVOT1VHSF9MRU5TKTtcbiAgc3RhdGUuZGlzdGNvZGUgPSBzdGF0ZS5kaXN0ZHluID0gbmV3IEludDMyQXJyYXkoRU5PVUdIX0RJU1RTKTtcblxuICBzdGF0ZS5zYW5lID0gMTtcbiAgc3RhdGUuYmFjayA9IC0xO1xuICAvL1RyYWNldigoc3RkZXJyLCBcImluZmxhdGU6IHJlc2V0XFxuXCIpKTtcbiAgcmV0dXJuIFpfT0skMTtcbn07XG5cblxuY29uc3QgaW5mbGF0ZVJlc2V0ID0gKHN0cm0pID0+IHtcblxuICBpZiAoaW5mbGF0ZVN0YXRlQ2hlY2soc3RybSkpIHsgcmV0dXJuIFpfU1RSRUFNX0VSUk9SJDE7IH1cbiAgY29uc3Qgc3RhdGUgPSBzdHJtLnN0YXRlO1xuICBzdGF0ZS53c2l6ZSA9IDA7XG4gIHN0YXRlLndoYXZlID0gMDtcbiAgc3RhdGUud25leHQgPSAwO1xuICByZXR1cm4gaW5mbGF0ZVJlc2V0S2VlcChzdHJtKTtcblxufTtcblxuXG5jb25zdCBpbmZsYXRlUmVzZXQyID0gKHN0cm0sIHdpbmRvd0JpdHMpID0+IHtcbiAgbGV0IHdyYXA7XG5cbiAgLyogZ2V0IHRoZSBzdGF0ZSAqL1xuICBpZiAoaW5mbGF0ZVN0YXRlQ2hlY2soc3RybSkpIHsgcmV0dXJuIFpfU1RSRUFNX0VSUk9SJDE7IH1cbiAgY29uc3Qgc3RhdGUgPSBzdHJtLnN0YXRlO1xuXG4gIC8qIGV4dHJhY3Qgd3JhcCByZXF1ZXN0IGZyb20gd2luZG93Qml0cyBwYXJhbWV0ZXIgKi9cbiAgaWYgKHdpbmRvd0JpdHMgPCAwKSB7XG4gICAgd3JhcCA9IDA7XG4gICAgd2luZG93Qml0cyA9IC13aW5kb3dCaXRzO1xuICB9XG4gIGVsc2Uge1xuICAgIHdyYXAgPSAod2luZG93Qml0cyA+PiA0KSArIDU7XG4gICAgaWYgKHdpbmRvd0JpdHMgPCA0OCkge1xuICAgICAgd2luZG93Qml0cyAmPSAxNTtcbiAgICB9XG4gIH1cblxuICAvKiBzZXQgbnVtYmVyIG9mIHdpbmRvdyBiaXRzLCBmcmVlIHdpbmRvdyBpZiBkaWZmZXJlbnQgKi9cbiAgaWYgKHdpbmRvd0JpdHMgJiYgKHdpbmRvd0JpdHMgPCA4IHx8IHdpbmRvd0JpdHMgPiAxNSkpIHtcbiAgICByZXR1cm4gWl9TVFJFQU1fRVJST1IkMTtcbiAgfVxuICBpZiAoc3RhdGUud2luZG93ICE9PSBudWxsICYmIHN0YXRlLndiaXRzICE9PSB3aW5kb3dCaXRzKSB7XG4gICAgc3RhdGUud2luZG93ID0gbnVsbDtcbiAgfVxuXG4gIC8qIHVwZGF0ZSBzdGF0ZSBhbmQgcmVzZXQgdGhlIHJlc3Qgb2YgaXQgKi9cbiAgc3RhdGUud3JhcCA9IHdyYXA7XG4gIHN0YXRlLndiaXRzID0gd2luZG93Qml0cztcbiAgcmV0dXJuIGluZmxhdGVSZXNldChzdHJtKTtcbn07XG5cblxuY29uc3QgaW5mbGF0ZUluaXQyID0gKHN0cm0sIHdpbmRvd0JpdHMpID0+IHtcblxuICBpZiAoIXN0cm0pIHsgcmV0dXJuIFpfU1RSRUFNX0VSUk9SJDE7IH1cbiAgLy9zdHJtLm1zZyA9IFpfTlVMTDsgICAgICAgICAgICAgICAgIC8qIGluIGNhc2Ugd2UgcmV0dXJuIGFuIGVycm9yICovXG5cbiAgY29uc3Qgc3RhdGUgPSBuZXcgSW5mbGF0ZVN0YXRlKCk7XG5cbiAgLy9pZiAoc3RhdGUgPT09IFpfTlVMTCkgcmV0dXJuIFpfTUVNX0VSUk9SO1xuICAvL1RyYWNldigoc3RkZXJyLCBcImluZmxhdGU6IGFsbG9jYXRlZFxcblwiKSk7XG4gIHN0cm0uc3RhdGUgPSBzdGF0ZTtcbiAgc3RhdGUuc3RybSA9IHN0cm07XG4gIHN0YXRlLndpbmRvdyA9IG51bGwvKlpfTlVMTCovO1xuICBzdGF0ZS5tb2RlID0gSEVBRDsgICAgIC8qIHRvIHBhc3Mgc3RhdGUgdGVzdCBpbiBpbmZsYXRlUmVzZXQyKCkgKi9cbiAgY29uc3QgcmV0ID0gaW5mbGF0ZVJlc2V0MihzdHJtLCB3aW5kb3dCaXRzKTtcbiAgaWYgKHJldCAhPT0gWl9PSyQxKSB7XG4gICAgc3RybS5zdGF0ZSA9IG51bGwvKlpfTlVMTCovO1xuICB9XG4gIHJldHVybiByZXQ7XG59O1xuXG5cbmNvbnN0IGluZmxhdGVJbml0ID0gKHN0cm0pID0+IHtcblxuICByZXR1cm4gaW5mbGF0ZUluaXQyKHN0cm0sIERFRl9XQklUUyk7XG59O1xuXG5cbi8qXG4gUmV0dXJuIHN0YXRlIHdpdGggbGVuZ3RoIGFuZCBkaXN0YW5jZSBkZWNvZGluZyB0YWJsZXMgYW5kIGluZGV4IHNpemVzIHNldCB0b1xuIGZpeGVkIGNvZGUgZGVjb2RpbmcuICBOb3JtYWxseSB0aGlzIHJldHVybnMgZml4ZWQgdGFibGVzIGZyb20gaW5mZml4ZWQuaC5cbiBJZiBCVUlMREZJWEVEIGlzIGRlZmluZWQsIHRoZW4gaW5zdGVhZCB0aGlzIHJvdXRpbmUgYnVpbGRzIHRoZSB0YWJsZXMgdGhlXG4gZmlyc3QgdGltZSBpdCdzIGNhbGxlZCwgYW5kIHJldHVybnMgdGhvc2UgdGFibGVzIHRoZSBmaXJzdCB0aW1lIGFuZFxuIHRoZXJlYWZ0ZXIuICBUaGlzIHJlZHVjZXMgdGhlIHNpemUgb2YgdGhlIGNvZGUgYnkgYWJvdXQgMksgYnl0ZXMsIGluXG4gZXhjaGFuZ2UgZm9yIGEgbGl0dGxlIGV4ZWN1dGlvbiB0aW1lLiAgSG93ZXZlciwgQlVJTERGSVhFRCBzaG91bGQgbm90IGJlXG4gdXNlZCBmb3IgdGhyZWFkZWQgYXBwbGljYXRpb25zLCBzaW5jZSB0aGUgcmV3cml0aW5nIG9mIHRoZSB0YWJsZXMgYW5kIHZpcmdpblxuIG1heSBub3QgYmUgdGhyZWFkLXNhZmUuXG4gKi9cbmxldCB2aXJnaW4gPSB0cnVlO1xuXG5sZXQgbGVuZml4LCBkaXN0Zml4OyAvLyBXZSBoYXZlIG5vIHBvaW50ZXJzIGluIEpTLCBzbyBrZWVwIHRhYmxlcyBzZXBhcmF0ZVxuXG5cbmNvbnN0IGZpeGVkdGFibGVzID0gKHN0YXRlKSA9PiB7XG5cbiAgLyogYnVpbGQgZml4ZWQgaHVmZm1hbiB0YWJsZXMgaWYgZmlyc3QgY2FsbCAobWF5IG5vdCBiZSB0aHJlYWQgc2FmZSkgKi9cbiAgaWYgKHZpcmdpbikge1xuICAgIGxlbmZpeCA9IG5ldyBJbnQzMkFycmF5KDUxMik7XG4gICAgZGlzdGZpeCA9IG5ldyBJbnQzMkFycmF5KDMyKTtcblxuICAgIC8qIGxpdGVyYWwvbGVuZ3RoIHRhYmxlICovXG4gICAgbGV0IHN5bSA9IDA7XG4gICAgd2hpbGUgKHN5bSA8IDE0NCkgeyBzdGF0ZS5sZW5zW3N5bSsrXSA9IDg7IH1cbiAgICB3aGlsZSAoc3ltIDwgMjU2KSB7IHN0YXRlLmxlbnNbc3ltKytdID0gOTsgfVxuICAgIHdoaWxlIChzeW0gPCAyODApIHsgc3RhdGUubGVuc1tzeW0rK10gPSA3OyB9XG4gICAgd2hpbGUgKHN5bSA8IDI4OCkgeyBzdGF0ZS5sZW5zW3N5bSsrXSA9IDg7IH1cblxuICAgIGluZnRyZWVzKExFTlMsICBzdGF0ZS5sZW5zLCAwLCAyODgsIGxlbmZpeCwgICAwLCBzdGF0ZS53b3JrLCB7IGJpdHM6IDkgfSk7XG5cbiAgICAvKiBkaXN0YW5jZSB0YWJsZSAqL1xuICAgIHN5bSA9IDA7XG4gICAgd2hpbGUgKHN5bSA8IDMyKSB7IHN0YXRlLmxlbnNbc3ltKytdID0gNTsgfVxuXG4gICAgaW5mdHJlZXMoRElTVFMsIHN0YXRlLmxlbnMsIDAsIDMyLCAgIGRpc3RmaXgsIDAsIHN0YXRlLndvcmssIHsgYml0czogNSB9KTtcblxuICAgIC8qIGRvIHRoaXMganVzdCBvbmNlICovXG4gICAgdmlyZ2luID0gZmFsc2U7XG4gIH1cblxuICBzdGF0ZS5sZW5jb2RlID0gbGVuZml4O1xuICBzdGF0ZS5sZW5iaXRzID0gOTtcbiAgc3RhdGUuZGlzdGNvZGUgPSBkaXN0Zml4O1xuICBzdGF0ZS5kaXN0Yml0cyA9IDU7XG59O1xuXG5cbi8qXG4gVXBkYXRlIHRoZSB3aW5kb3cgd2l0aCB0aGUgbGFzdCB3c2l6ZSAobm9ybWFsbHkgMzJLKSBieXRlcyB3cml0dGVuIGJlZm9yZVxuIHJldHVybmluZy4gIElmIHdpbmRvdyBkb2VzIG5vdCBleGlzdCB5ZXQsIGNyZWF0ZSBpdC4gIFRoaXMgaXMgb25seSBjYWxsZWRcbiB3aGVuIGEgd2luZG93IGlzIGFscmVhZHkgaW4gdXNlLCBvciB3aGVuIG91dHB1dCBoYXMgYmVlbiB3cml0dGVuIGR1cmluZyB0aGlzXG4gaW5mbGF0ZSBjYWxsLCBidXQgdGhlIGVuZCBvZiB0aGUgZGVmbGF0ZSBzdHJlYW0gaGFzIG5vdCBiZWVuIHJlYWNoZWQgeWV0LlxuIEl0IGlzIGFsc28gY2FsbGVkIHRvIGNyZWF0ZSBhIHdpbmRvdyBmb3IgZGljdGlvbmFyeSBkYXRhIHdoZW4gYSBkaWN0aW9uYXJ5XG4gaXMgbG9hZGVkLlxuXG4gUHJvdmlkaW5nIG91dHB1dCBidWZmZXJzIGxhcmdlciB0aGFuIDMySyB0byBpbmZsYXRlKCkgc2hvdWxkIHByb3ZpZGUgYSBzcGVlZFxuIGFkdmFudGFnZSwgc2luY2Ugb25seSB0aGUgbGFzdCAzMksgb2Ygb3V0cHV0IGlzIGNvcGllZCB0byB0aGUgc2xpZGluZyB3aW5kb3dcbiB1cG9uIHJldHVybiBmcm9tIGluZmxhdGUoKSwgYW5kIHNpbmNlIGFsbCBkaXN0YW5jZXMgYWZ0ZXIgdGhlIGZpcnN0IDMySyBvZlxuIG91dHB1dCB3aWxsIGZhbGwgaW4gdGhlIG91dHB1dCBkYXRhLCBtYWtpbmcgbWF0Y2ggY29waWVzIHNpbXBsZXIgYW5kIGZhc3Rlci5cbiBUaGUgYWR2YW50YWdlIG1heSBiZSBkZXBlbmRlbnQgb24gdGhlIHNpemUgb2YgdGhlIHByb2Nlc3NvcidzIGRhdGEgY2FjaGVzLlxuICovXG5jb25zdCB1cGRhdGV3aW5kb3cgPSAoc3RybSwgc3JjLCBlbmQsIGNvcHkpID0+IHtcblxuICBsZXQgZGlzdDtcbiAgY29uc3Qgc3RhdGUgPSBzdHJtLnN0YXRlO1xuXG4gIC8qIGlmIGl0IGhhc24ndCBiZWVuIGRvbmUgYWxyZWFkeSwgYWxsb2NhdGUgc3BhY2UgZm9yIHRoZSB3aW5kb3cgKi9cbiAgaWYgKHN0YXRlLndpbmRvdyA9PT0gbnVsbCkge1xuICAgIHN0YXRlLndzaXplID0gMSA8PCBzdGF0ZS53Yml0cztcbiAgICBzdGF0ZS53bmV4dCA9IDA7XG4gICAgc3RhdGUud2hhdmUgPSAwO1xuXG4gICAgc3RhdGUud2luZG93ID0gbmV3IFVpbnQ4QXJyYXkoc3RhdGUud3NpemUpO1xuICB9XG5cbiAgLyogY29weSBzdGF0ZS0+d3NpemUgb3IgbGVzcyBvdXRwdXQgYnl0ZXMgaW50byB0aGUgY2lyY3VsYXIgd2luZG93ICovXG4gIGlmIChjb3B5ID49IHN0YXRlLndzaXplKSB7XG4gICAgc3RhdGUud2luZG93LnNldChzcmMuc3ViYXJyYXkoZW5kIC0gc3RhdGUud3NpemUsIGVuZCksIDApO1xuICAgIHN0YXRlLnduZXh0ID0gMDtcbiAgICBzdGF0ZS53aGF2ZSA9IHN0YXRlLndzaXplO1xuICB9XG4gIGVsc2Uge1xuICAgIGRpc3QgPSBzdGF0ZS53c2l6ZSAtIHN0YXRlLnduZXh0O1xuICAgIGlmIChkaXN0ID4gY29weSkge1xuICAgICAgZGlzdCA9IGNvcHk7XG4gICAgfVxuICAgIC8vem1lbWNweShzdGF0ZS0+d2luZG93ICsgc3RhdGUtPnduZXh0LCBlbmQgLSBjb3B5LCBkaXN0KTtcbiAgICBzdGF0ZS53aW5kb3cuc2V0KHNyYy5zdWJhcnJheShlbmQgLSBjb3B5LCBlbmQgLSBjb3B5ICsgZGlzdCksIHN0YXRlLnduZXh0KTtcbiAgICBjb3B5IC09IGRpc3Q7XG4gICAgaWYgKGNvcHkpIHtcbiAgICAgIC8vem1lbWNweShzdGF0ZS0+d2luZG93LCBlbmQgLSBjb3B5LCBjb3B5KTtcbiAgICAgIHN0YXRlLndpbmRvdy5zZXQoc3JjLnN1YmFycmF5KGVuZCAtIGNvcHksIGVuZCksIDApO1xuICAgICAgc3RhdGUud25leHQgPSBjb3B5O1xuICAgICAgc3RhdGUud2hhdmUgPSBzdGF0ZS53c2l6ZTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBzdGF0ZS53bmV4dCArPSBkaXN0O1xuICAgICAgaWYgKHN0YXRlLnduZXh0ID09PSBzdGF0ZS53c2l6ZSkgeyBzdGF0ZS53bmV4dCA9IDA7IH1cbiAgICAgIGlmIChzdGF0ZS53aGF2ZSA8IHN0YXRlLndzaXplKSB7IHN0YXRlLndoYXZlICs9IGRpc3Q7IH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIDA7XG59O1xuXG5cbmNvbnN0IGluZmxhdGUkMiA9IChzdHJtLCBmbHVzaCkgPT4ge1xuXG4gIGxldCBzdGF0ZTtcbiAgbGV0IGlucHV0LCBvdXRwdXQ7ICAgICAgICAgIC8vIGlucHV0L291dHB1dCBidWZmZXJzXG4gIGxldCBuZXh0OyAgICAgICAgICAgICAgICAgICAvKiBuZXh0IGlucHV0IElOREVYICovXG4gIGxldCBwdXQ7ICAgICAgICAgICAgICAgICAgICAvKiBuZXh0IG91dHB1dCBJTkRFWCAqL1xuICBsZXQgaGF2ZSwgbGVmdDsgICAgICAgICAgICAgLyogYXZhaWxhYmxlIGlucHV0IGFuZCBvdXRwdXQgKi9cbiAgbGV0IGhvbGQ7ICAgICAgICAgICAgICAgICAgIC8qIGJpdCBidWZmZXIgKi9cbiAgbGV0IGJpdHM7ICAgICAgICAgICAgICAgICAgIC8qIGJpdHMgaW4gYml0IGJ1ZmZlciAqL1xuICBsZXQgX2luLCBfb3V0OyAgICAgICAgICAgICAgLyogc2F2ZSBzdGFydGluZyBhdmFpbGFibGUgaW5wdXQgYW5kIG91dHB1dCAqL1xuICBsZXQgY29weTsgICAgICAgICAgICAgICAgICAgLyogbnVtYmVyIG9mIHN0b3JlZCBvciBtYXRjaCBieXRlcyB0byBjb3B5ICovXG4gIGxldCBmcm9tOyAgICAgICAgICAgICAgICAgICAvKiB3aGVyZSB0byBjb3B5IG1hdGNoIGJ5dGVzIGZyb20gKi9cbiAgbGV0IGZyb21fc291cmNlO1xuICBsZXQgaGVyZSA9IDA7ICAgICAgICAgICAgICAgLyogY3VycmVudCBkZWNvZGluZyB0YWJsZSBlbnRyeSAqL1xuICBsZXQgaGVyZV9iaXRzLCBoZXJlX29wLCBoZXJlX3ZhbDsgLy8gcGFrZWQgXCJoZXJlXCIgZGVub3JtYWxpemVkIChKUyBzcGVjaWZpYylcbiAgLy9sZXQgbGFzdDsgICAgICAgICAgICAgICAgICAgLyogcGFyZW50IHRhYmxlIGVudHJ5ICovXG4gIGxldCBsYXN0X2JpdHMsIGxhc3Rfb3AsIGxhc3RfdmFsOyAvLyBwYWtlZCBcImxhc3RcIiBkZW5vcm1hbGl6ZWQgKEpTIHNwZWNpZmljKVxuICBsZXQgbGVuOyAgICAgICAgICAgICAgICAgICAgLyogbGVuZ3RoIHRvIGNvcHkgZm9yIHJlcGVhdHMsIGJpdHMgdG8gZHJvcCAqL1xuICBsZXQgcmV0OyAgICAgICAgICAgICAgICAgICAgLyogcmV0dXJuIGNvZGUgKi9cbiAgY29uc3QgaGJ1ZiA9IG5ldyBVaW50OEFycmF5KDQpOyAgICAvKiBidWZmZXIgZm9yIGd6aXAgaGVhZGVyIGNyYyBjYWxjdWxhdGlvbiAqL1xuICBsZXQgb3B0cztcblxuICBsZXQgbjsgLy8gdGVtcG9yYXJ5IHZhcmlhYmxlIGZvciBORUVEX0JJVFNcblxuICBjb25zdCBvcmRlciA9IC8qIHBlcm11dGF0aW9uIG9mIGNvZGUgbGVuZ3RocyAqL1xuICAgIG5ldyBVaW50OEFycmF5KFsgMTYsIDE3LCAxOCwgMCwgOCwgNywgOSwgNiwgMTAsIDUsIDExLCA0LCAxMiwgMywgMTMsIDIsIDE0LCAxLCAxNSBdKTtcblxuXG4gIGlmIChpbmZsYXRlU3RhdGVDaGVjayhzdHJtKSB8fCAhc3RybS5vdXRwdXQgfHxcbiAgICAgICghc3RybS5pbnB1dCAmJiBzdHJtLmF2YWlsX2luICE9PSAwKSkge1xuICAgIHJldHVybiBaX1NUUkVBTV9FUlJPUiQxO1xuICB9XG5cbiAgc3RhdGUgPSBzdHJtLnN0YXRlO1xuICBpZiAoc3RhdGUubW9kZSA9PT0gVFlQRSkgeyBzdGF0ZS5tb2RlID0gVFlQRURPOyB9ICAgIC8qIHNraXAgY2hlY2sgKi9cblxuXG4gIC8vLS0tIExPQUQoKSAtLS1cbiAgcHV0ID0gc3RybS5uZXh0X291dDtcbiAgb3V0cHV0ID0gc3RybS5vdXRwdXQ7XG4gIGxlZnQgPSBzdHJtLmF2YWlsX291dDtcbiAgbmV4dCA9IHN0cm0ubmV4dF9pbjtcbiAgaW5wdXQgPSBzdHJtLmlucHV0O1xuICBoYXZlID0gc3RybS5hdmFpbF9pbjtcbiAgaG9sZCA9IHN0YXRlLmhvbGQ7XG4gIGJpdHMgPSBzdGF0ZS5iaXRzO1xuICAvLy0tLVxuXG4gIF9pbiA9IGhhdmU7XG4gIF9vdXQgPSBsZWZ0O1xuICByZXQgPSBaX09LJDE7XG5cbiAgaW5mX2xlYXZlOiAvLyBnb3RvIGVtdWxhdGlvblxuICBmb3IgKDs7KSB7XG4gICAgc3dpdGNoIChzdGF0ZS5tb2RlKSB7XG4gICAgICBjYXNlIEhFQUQ6XG4gICAgICAgIGlmIChzdGF0ZS53cmFwID09PSAwKSB7XG4gICAgICAgICAgc3RhdGUubW9kZSA9IFRZUEVETztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICAvLz09PSBORUVEQklUUygxNik7XG4gICAgICAgIHdoaWxlIChiaXRzIDwgMTYpIHtcbiAgICAgICAgICBpZiAoaGF2ZSA9PT0gMCkgeyBicmVhayBpbmZfbGVhdmU7IH1cbiAgICAgICAgICBoYXZlLS07XG4gICAgICAgICAgaG9sZCArPSBpbnB1dFtuZXh0KytdIDw8IGJpdHM7XG4gICAgICAgICAgYml0cyArPSA4O1xuICAgICAgICB9XG4gICAgICAgIC8vPT09Ly9cbiAgICAgICAgaWYgKChzdGF0ZS53cmFwICYgMikgJiYgaG9sZCA9PT0gMHg4YjFmKSB7ICAvKiBnemlwIGhlYWRlciAqL1xuICAgICAgICAgIGlmIChzdGF0ZS53Yml0cyA9PT0gMCkge1xuICAgICAgICAgICAgc3RhdGUud2JpdHMgPSAxNTtcbiAgICAgICAgICB9XG4gICAgICAgICAgc3RhdGUuY2hlY2sgPSAwLypjcmMzMigwTCwgWl9OVUxMLCAwKSovO1xuICAgICAgICAgIC8vPT09IENSQzIoc3RhdGUuY2hlY2ssIGhvbGQpO1xuICAgICAgICAgIGhidWZbMF0gPSBob2xkICYgMHhmZjtcbiAgICAgICAgICBoYnVmWzFdID0gKGhvbGQgPj4+IDgpICYgMHhmZjtcbiAgICAgICAgICBzdGF0ZS5jaGVjayA9IGNyYzMyXzEoc3RhdGUuY2hlY2ssIGhidWYsIDIsIDApO1xuICAgICAgICAgIC8vPT09Ly9cblxuICAgICAgICAgIC8vPT09IElOSVRCSVRTKCk7XG4gICAgICAgICAgaG9sZCA9IDA7XG4gICAgICAgICAgYml0cyA9IDA7XG4gICAgICAgICAgLy89PT0vL1xuICAgICAgICAgIHN0YXRlLm1vZGUgPSBGTEFHUztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBpZiAoc3RhdGUuaGVhZCkge1xuICAgICAgICAgIHN0YXRlLmhlYWQuZG9uZSA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGlmICghKHN0YXRlLndyYXAgJiAxKSB8fCAgIC8qIGNoZWNrIGlmIHpsaWIgaGVhZGVyIGFsbG93ZWQgKi9cbiAgICAgICAgICAoKChob2xkICYgMHhmZikvKkJJVFMoOCkqLyA8PCA4KSArIChob2xkID4+IDgpKSAlIDMxKSB7XG4gICAgICAgICAgc3RybS5tc2cgPSAnaW5jb3JyZWN0IGhlYWRlciBjaGVjayc7XG4gICAgICAgICAgc3RhdGUubW9kZSA9IEJBRDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBpZiAoKGhvbGQgJiAweDBmKS8qQklUUyg0KSovICE9PSBaX0RFRkxBVEVEKSB7XG4gICAgICAgICAgc3RybS5tc2cgPSAndW5rbm93biBjb21wcmVzc2lvbiBtZXRob2QnO1xuICAgICAgICAgIHN0YXRlLm1vZGUgPSBCQUQ7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgLy8tLS0gRFJPUEJJVFMoNCkgLS0tLy9cbiAgICAgICAgaG9sZCA+Pj49IDQ7XG4gICAgICAgIGJpdHMgLT0gNDtcbiAgICAgICAgLy8tLS0vL1xuICAgICAgICBsZW4gPSAoaG9sZCAmIDB4MGYpLypCSVRTKDQpKi8gKyA4O1xuICAgICAgICBpZiAoc3RhdGUud2JpdHMgPT09IDApIHtcbiAgICAgICAgICBzdGF0ZS53Yml0cyA9IGxlbjtcbiAgICAgICAgfVxuICAgICAgICBpZiAobGVuID4gMTUgfHwgbGVuID4gc3RhdGUud2JpdHMpIHtcbiAgICAgICAgICBzdHJtLm1zZyA9ICdpbnZhbGlkIHdpbmRvdyBzaXplJztcbiAgICAgICAgICBzdGF0ZS5tb2RlID0gQkFEO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gISEhIHBha28gcGF0Y2guIEZvcmNlIHVzZSBgb3B0aW9ucy53aW5kb3dCaXRzYCBpZiBwYXNzZWQuXG4gICAgICAgIC8vIFJlcXVpcmVkIHRvIGFsd2F5cyB1c2UgbWF4IHdpbmRvdyBzaXplIGJ5IGRlZmF1bHQuXG4gICAgICAgIHN0YXRlLmRtYXggPSAxIDw8IHN0YXRlLndiaXRzO1xuICAgICAgICAvL3N0YXRlLmRtYXggPSAxIDw8IGxlbjtcblxuICAgICAgICBzdGF0ZS5mbGFncyA9IDA7ICAgICAgICAgICAgICAgLyogaW5kaWNhdGUgemxpYiBoZWFkZXIgKi9cbiAgICAgICAgLy9UcmFjZXYoKHN0ZGVyciwgXCJpbmZsYXRlOiAgIHpsaWIgaGVhZGVyIG9rXFxuXCIpKTtcbiAgICAgICAgc3RybS5hZGxlciA9IHN0YXRlLmNoZWNrID0gMS8qYWRsZXIzMigwTCwgWl9OVUxMLCAwKSovO1xuICAgICAgICBzdGF0ZS5tb2RlID0gaG9sZCAmIDB4MjAwID8gRElDVElEIDogVFlQRTtcbiAgICAgICAgLy89PT0gSU5JVEJJVFMoKTtcbiAgICAgICAgaG9sZCA9IDA7XG4gICAgICAgIGJpdHMgPSAwO1xuICAgICAgICAvLz09PS8vXG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBGTEFHUzpcbiAgICAgICAgLy89PT0gTkVFREJJVFMoMTYpOyAqL1xuICAgICAgICB3aGlsZSAoYml0cyA8IDE2KSB7XG4gICAgICAgICAgaWYgKGhhdmUgPT09IDApIHsgYnJlYWsgaW5mX2xlYXZlOyB9XG4gICAgICAgICAgaGF2ZS0tO1xuICAgICAgICAgIGhvbGQgKz0gaW5wdXRbbmV4dCsrXSA8PCBiaXRzO1xuICAgICAgICAgIGJpdHMgKz0gODtcbiAgICAgICAgfVxuICAgICAgICAvLz09PS8vXG4gICAgICAgIHN0YXRlLmZsYWdzID0gaG9sZDtcbiAgICAgICAgaWYgKChzdGF0ZS5mbGFncyAmIDB4ZmYpICE9PSBaX0RFRkxBVEVEKSB7XG4gICAgICAgICAgc3RybS5tc2cgPSAndW5rbm93biBjb21wcmVzc2lvbiBtZXRob2QnO1xuICAgICAgICAgIHN0YXRlLm1vZGUgPSBCQUQ7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHN0YXRlLmZsYWdzICYgMHhlMDAwKSB7XG4gICAgICAgICAgc3RybS5tc2cgPSAndW5rbm93biBoZWFkZXIgZmxhZ3Mgc2V0JztcbiAgICAgICAgICBzdGF0ZS5tb2RlID0gQkFEO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzdGF0ZS5oZWFkKSB7XG4gICAgICAgICAgc3RhdGUuaGVhZC50ZXh0ID0gKChob2xkID4+IDgpICYgMSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKChzdGF0ZS5mbGFncyAmIDB4MDIwMCkgJiYgKHN0YXRlLndyYXAgJiA0KSkge1xuICAgICAgICAgIC8vPT09IENSQzIoc3RhdGUuY2hlY2ssIGhvbGQpO1xuICAgICAgICAgIGhidWZbMF0gPSBob2xkICYgMHhmZjtcbiAgICAgICAgICBoYnVmWzFdID0gKGhvbGQgPj4+IDgpICYgMHhmZjtcbiAgICAgICAgICBzdGF0ZS5jaGVjayA9IGNyYzMyXzEoc3RhdGUuY2hlY2ssIGhidWYsIDIsIDApO1xuICAgICAgICAgIC8vPT09Ly9cbiAgICAgICAgfVxuICAgICAgICAvLz09PSBJTklUQklUUygpO1xuICAgICAgICBob2xkID0gMDtcbiAgICAgICAgYml0cyA9IDA7XG4gICAgICAgIC8vPT09Ly9cbiAgICAgICAgc3RhdGUubW9kZSA9IFRJTUU7XG4gICAgICAgIC8qIGZhbGxzIHRocm91Z2ggKi9cbiAgICAgIGNhc2UgVElNRTpcbiAgICAgICAgLy89PT0gTkVFREJJVFMoMzIpOyAqL1xuICAgICAgICB3aGlsZSAoYml0cyA8IDMyKSB7XG4gICAgICAgICAgaWYgKGhhdmUgPT09IDApIHsgYnJlYWsgaW5mX2xlYXZlOyB9XG4gICAgICAgICAgaGF2ZS0tO1xuICAgICAgICAgIGhvbGQgKz0gaW5wdXRbbmV4dCsrXSA8PCBiaXRzO1xuICAgICAgICAgIGJpdHMgKz0gODtcbiAgICAgICAgfVxuICAgICAgICAvLz09PS8vXG4gICAgICAgIGlmIChzdGF0ZS5oZWFkKSB7XG4gICAgICAgICAgc3RhdGUuaGVhZC50aW1lID0gaG9sZDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoKHN0YXRlLmZsYWdzICYgMHgwMjAwKSAmJiAoc3RhdGUud3JhcCAmIDQpKSB7XG4gICAgICAgICAgLy89PT0gQ1JDNChzdGF0ZS5jaGVjaywgaG9sZClcbiAgICAgICAgICBoYnVmWzBdID0gaG9sZCAmIDB4ZmY7XG4gICAgICAgICAgaGJ1ZlsxXSA9IChob2xkID4+PiA4KSAmIDB4ZmY7XG4gICAgICAgICAgaGJ1ZlsyXSA9IChob2xkID4+PiAxNikgJiAweGZmO1xuICAgICAgICAgIGhidWZbM10gPSAoaG9sZCA+Pj4gMjQpICYgMHhmZjtcbiAgICAgICAgICBzdGF0ZS5jaGVjayA9IGNyYzMyXzEoc3RhdGUuY2hlY2ssIGhidWYsIDQsIDApO1xuICAgICAgICAgIC8vPT09XG4gICAgICAgIH1cbiAgICAgICAgLy89PT0gSU5JVEJJVFMoKTtcbiAgICAgICAgaG9sZCA9IDA7XG4gICAgICAgIGJpdHMgPSAwO1xuICAgICAgICAvLz09PS8vXG4gICAgICAgIHN0YXRlLm1vZGUgPSBPUztcbiAgICAgICAgLyogZmFsbHMgdGhyb3VnaCAqL1xuICAgICAgY2FzZSBPUzpcbiAgICAgICAgLy89PT0gTkVFREJJVFMoMTYpOyAqL1xuICAgICAgICB3aGlsZSAoYml0cyA8IDE2KSB7XG4gICAgICAgICAgaWYgKGhhdmUgPT09IDApIHsgYnJlYWsgaW5mX2xlYXZlOyB9XG4gICAgICAgICAgaGF2ZS0tO1xuICAgICAgICAgIGhvbGQgKz0gaW5wdXRbbmV4dCsrXSA8PCBiaXRzO1xuICAgICAgICAgIGJpdHMgKz0gODtcbiAgICAgICAgfVxuICAgICAgICAvLz09PS8vXG4gICAgICAgIGlmIChzdGF0ZS5oZWFkKSB7XG4gICAgICAgICAgc3RhdGUuaGVhZC54ZmxhZ3MgPSAoaG9sZCAmIDB4ZmYpO1xuICAgICAgICAgIHN0YXRlLmhlYWQub3MgPSAoaG9sZCA+PiA4KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoKHN0YXRlLmZsYWdzICYgMHgwMjAwKSAmJiAoc3RhdGUud3JhcCAmIDQpKSB7XG4gICAgICAgICAgLy89PT0gQ1JDMihzdGF0ZS5jaGVjaywgaG9sZCk7XG4gICAgICAgICAgaGJ1ZlswXSA9IGhvbGQgJiAweGZmO1xuICAgICAgICAgIGhidWZbMV0gPSAoaG9sZCA+Pj4gOCkgJiAweGZmO1xuICAgICAgICAgIHN0YXRlLmNoZWNrID0gY3JjMzJfMShzdGF0ZS5jaGVjaywgaGJ1ZiwgMiwgMCk7XG4gICAgICAgICAgLy89PT0vL1xuICAgICAgICB9XG4gICAgICAgIC8vPT09IElOSVRCSVRTKCk7XG4gICAgICAgIGhvbGQgPSAwO1xuICAgICAgICBiaXRzID0gMDtcbiAgICAgICAgLy89PT0vL1xuICAgICAgICBzdGF0ZS5tb2RlID0gRVhMRU47XG4gICAgICAgIC8qIGZhbGxzIHRocm91Z2ggKi9cbiAgICAgIGNhc2UgRVhMRU46XG4gICAgICAgIGlmIChzdGF0ZS5mbGFncyAmIDB4MDQwMCkge1xuICAgICAgICAgIC8vPT09IE5FRURCSVRTKDE2KTsgKi9cbiAgICAgICAgICB3aGlsZSAoYml0cyA8IDE2KSB7XG4gICAgICAgICAgICBpZiAoaGF2ZSA9PT0gMCkgeyBicmVhayBpbmZfbGVhdmU7IH1cbiAgICAgICAgICAgIGhhdmUtLTtcbiAgICAgICAgICAgIGhvbGQgKz0gaW5wdXRbbmV4dCsrXSA8PCBiaXRzO1xuICAgICAgICAgICAgYml0cyArPSA4O1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLz09PS8vXG4gICAgICAgICAgc3RhdGUubGVuZ3RoID0gaG9sZDtcbiAgICAgICAgICBpZiAoc3RhdGUuaGVhZCkge1xuICAgICAgICAgICAgc3RhdGUuaGVhZC5leHRyYV9sZW4gPSBob2xkO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoKHN0YXRlLmZsYWdzICYgMHgwMjAwKSAmJiAoc3RhdGUud3JhcCAmIDQpKSB7XG4gICAgICAgICAgICAvLz09PSBDUkMyKHN0YXRlLmNoZWNrLCBob2xkKTtcbiAgICAgICAgICAgIGhidWZbMF0gPSBob2xkICYgMHhmZjtcbiAgICAgICAgICAgIGhidWZbMV0gPSAoaG9sZCA+Pj4gOCkgJiAweGZmO1xuICAgICAgICAgICAgc3RhdGUuY2hlY2sgPSBjcmMzMl8xKHN0YXRlLmNoZWNrLCBoYnVmLCAyLCAwKTtcbiAgICAgICAgICAgIC8vPT09Ly9cbiAgICAgICAgICB9XG4gICAgICAgICAgLy89PT0gSU5JVEJJVFMoKTtcbiAgICAgICAgICBob2xkID0gMDtcbiAgICAgICAgICBiaXRzID0gMDtcbiAgICAgICAgICAvLz09PS8vXG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoc3RhdGUuaGVhZCkge1xuICAgICAgICAgIHN0YXRlLmhlYWQuZXh0cmEgPSBudWxsLypaX05VTEwqLztcbiAgICAgICAgfVxuICAgICAgICBzdGF0ZS5tb2RlID0gRVhUUkE7XG4gICAgICAgIC8qIGZhbGxzIHRocm91Z2ggKi9cbiAgICAgIGNhc2UgRVhUUkE6XG4gICAgICAgIGlmIChzdGF0ZS5mbGFncyAmIDB4MDQwMCkge1xuICAgICAgICAgIGNvcHkgPSBzdGF0ZS5sZW5ndGg7XG4gICAgICAgICAgaWYgKGNvcHkgPiBoYXZlKSB7IGNvcHkgPSBoYXZlOyB9XG4gICAgICAgICAgaWYgKGNvcHkpIHtcbiAgICAgICAgICAgIGlmIChzdGF0ZS5oZWFkKSB7XG4gICAgICAgICAgICAgIGxlbiA9IHN0YXRlLmhlYWQuZXh0cmFfbGVuIC0gc3RhdGUubGVuZ3RoO1xuICAgICAgICAgICAgICBpZiAoIXN0YXRlLmhlYWQuZXh0cmEpIHtcbiAgICAgICAgICAgICAgICAvLyBVc2UgdW50eXBlZCBhcnJheSBmb3IgbW9yZSBjb252ZW5pZW50IHByb2Nlc3NpbmcgbGF0ZXJcbiAgICAgICAgICAgICAgICBzdGF0ZS5oZWFkLmV4dHJhID0gbmV3IFVpbnQ4QXJyYXkoc3RhdGUuaGVhZC5leHRyYV9sZW4pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHN0YXRlLmhlYWQuZXh0cmEuc2V0KFxuICAgICAgICAgICAgICAgIGlucHV0LnN1YmFycmF5KFxuICAgICAgICAgICAgICAgICAgbmV4dCxcbiAgICAgICAgICAgICAgICAgIC8vIGV4dHJhIGZpZWxkIGlzIGxpbWl0ZWQgdG8gNjU1MzYgYnl0ZXNcbiAgICAgICAgICAgICAgICAgIC8vIC0gbm8gbmVlZCBmb3IgYWRkaXRpb25hbCBzaXplIGNoZWNrXG4gICAgICAgICAgICAgICAgICBuZXh0ICsgY29weVxuICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgICAgLypsZW4gKyBjb3B5ID4gc3RhdGUuaGVhZC5leHRyYV9tYXggLSBsZW4gPyBzdGF0ZS5oZWFkLmV4dHJhX21heCA6IGNvcHksKi9cbiAgICAgICAgICAgICAgICBsZW5cbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgLy96bWVtY3B5KHN0YXRlLmhlYWQuZXh0cmEgKyBsZW4sIG5leHQsXG4gICAgICAgICAgICAgIC8vICAgICAgICBsZW4gKyBjb3B5ID4gc3RhdGUuaGVhZC5leHRyYV9tYXggP1xuICAgICAgICAgICAgICAvLyAgICAgICAgc3RhdGUuaGVhZC5leHRyYV9tYXggLSBsZW4gOiBjb3B5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICgoc3RhdGUuZmxhZ3MgJiAweDAyMDApICYmIChzdGF0ZS53cmFwICYgNCkpIHtcbiAgICAgICAgICAgICAgc3RhdGUuY2hlY2sgPSBjcmMzMl8xKHN0YXRlLmNoZWNrLCBpbnB1dCwgY29weSwgbmV4dCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBoYXZlIC09IGNvcHk7XG4gICAgICAgICAgICBuZXh0ICs9IGNvcHk7XG4gICAgICAgICAgICBzdGF0ZS5sZW5ndGggLT0gY29weTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHN0YXRlLmxlbmd0aCkgeyBicmVhayBpbmZfbGVhdmU7IH1cbiAgICAgICAgfVxuICAgICAgICBzdGF0ZS5sZW5ndGggPSAwO1xuICAgICAgICBzdGF0ZS5tb2RlID0gTkFNRTtcbiAgICAgICAgLyogZmFsbHMgdGhyb3VnaCAqL1xuICAgICAgY2FzZSBOQU1FOlxuICAgICAgICBpZiAoc3RhdGUuZmxhZ3MgJiAweDA4MDApIHtcbiAgICAgICAgICBpZiAoaGF2ZSA9PT0gMCkgeyBicmVhayBpbmZfbGVhdmU7IH1cbiAgICAgICAgICBjb3B5ID0gMDtcbiAgICAgICAgICBkbyB7XG4gICAgICAgICAgICAvLyBUT0RPOiAyIG9yIDEgYnl0ZXM/XG4gICAgICAgICAgICBsZW4gPSBpbnB1dFtuZXh0ICsgY29weSsrXTtcbiAgICAgICAgICAgIC8qIHVzZSBjb25zdGFudCBsaW1pdCBiZWNhdXNlIGluIGpzIHdlIHNob3VsZCBub3QgcHJlYWxsb2NhdGUgbWVtb3J5ICovXG4gICAgICAgICAgICBpZiAoc3RhdGUuaGVhZCAmJiBsZW4gJiZcbiAgICAgICAgICAgICAgICAoc3RhdGUubGVuZ3RoIDwgNjU1MzYgLypzdGF0ZS5oZWFkLm5hbWVfbWF4Ki8pKSB7XG4gICAgICAgICAgICAgIHN0YXRlLmhlYWQubmFtZSArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGxlbik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSB3aGlsZSAobGVuICYmIGNvcHkgPCBoYXZlKTtcblxuICAgICAgICAgIGlmICgoc3RhdGUuZmxhZ3MgJiAweDAyMDApICYmIChzdGF0ZS53cmFwICYgNCkpIHtcbiAgICAgICAgICAgIHN0YXRlLmNoZWNrID0gY3JjMzJfMShzdGF0ZS5jaGVjaywgaW5wdXQsIGNvcHksIG5leHQpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBoYXZlIC09IGNvcHk7XG4gICAgICAgICAgbmV4dCArPSBjb3B5O1xuICAgICAgICAgIGlmIChsZW4pIHsgYnJlYWsgaW5mX2xlYXZlOyB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoc3RhdGUuaGVhZCkge1xuICAgICAgICAgIHN0YXRlLmhlYWQubmFtZSA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgc3RhdGUubGVuZ3RoID0gMDtcbiAgICAgICAgc3RhdGUubW9kZSA9IENPTU1FTlQ7XG4gICAgICAgIC8qIGZhbGxzIHRocm91Z2ggKi9cbiAgICAgIGNhc2UgQ09NTUVOVDpcbiAgICAgICAgaWYgKHN0YXRlLmZsYWdzICYgMHgxMDAwKSB7XG4gICAgICAgICAgaWYgKGhhdmUgPT09IDApIHsgYnJlYWsgaW5mX2xlYXZlOyB9XG4gICAgICAgICAgY29weSA9IDA7XG4gICAgICAgICAgZG8ge1xuICAgICAgICAgICAgbGVuID0gaW5wdXRbbmV4dCArIGNvcHkrK107XG4gICAgICAgICAgICAvKiB1c2UgY29uc3RhbnQgbGltaXQgYmVjYXVzZSBpbiBqcyB3ZSBzaG91bGQgbm90IHByZWFsbG9jYXRlIG1lbW9yeSAqL1xuICAgICAgICAgICAgaWYgKHN0YXRlLmhlYWQgJiYgbGVuICYmXG4gICAgICAgICAgICAgICAgKHN0YXRlLmxlbmd0aCA8IDY1NTM2IC8qc3RhdGUuaGVhZC5jb21tX21heCovKSkge1xuICAgICAgICAgICAgICBzdGF0ZS5oZWFkLmNvbW1lbnQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShsZW4pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gd2hpbGUgKGxlbiAmJiBjb3B5IDwgaGF2ZSk7XG4gICAgICAgICAgaWYgKChzdGF0ZS5mbGFncyAmIDB4MDIwMCkgJiYgKHN0YXRlLndyYXAgJiA0KSkge1xuICAgICAgICAgICAgc3RhdGUuY2hlY2sgPSBjcmMzMl8xKHN0YXRlLmNoZWNrLCBpbnB1dCwgY29weSwgbmV4dCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGhhdmUgLT0gY29weTtcbiAgICAgICAgICBuZXh0ICs9IGNvcHk7XG4gICAgICAgICAgaWYgKGxlbikgeyBicmVhayBpbmZfbGVhdmU7IH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChzdGF0ZS5oZWFkKSB7XG4gICAgICAgICAgc3RhdGUuaGVhZC5jb21tZW50ID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBzdGF0ZS5tb2RlID0gSENSQztcbiAgICAgICAgLyogZmFsbHMgdGhyb3VnaCAqL1xuICAgICAgY2FzZSBIQ1JDOlxuICAgICAgICBpZiAoc3RhdGUuZmxhZ3MgJiAweDAyMDApIHtcbiAgICAgICAgICAvLz09PSBORUVEQklUUygxNik7ICovXG4gICAgICAgICAgd2hpbGUgKGJpdHMgPCAxNikge1xuICAgICAgICAgICAgaWYgKGhhdmUgPT09IDApIHsgYnJlYWsgaW5mX2xlYXZlOyB9XG4gICAgICAgICAgICBoYXZlLS07XG4gICAgICAgICAgICBob2xkICs9IGlucHV0W25leHQrK10gPDwgYml0cztcbiAgICAgICAgICAgIGJpdHMgKz0gODtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy89PT0vL1xuICAgICAgICAgIGlmICgoc3RhdGUud3JhcCAmIDQpICYmIGhvbGQgIT09IChzdGF0ZS5jaGVjayAmIDB4ZmZmZikpIHtcbiAgICAgICAgICAgIHN0cm0ubXNnID0gJ2hlYWRlciBjcmMgbWlzbWF0Y2gnO1xuICAgICAgICAgICAgc3RhdGUubW9kZSA9IEJBRDtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLz09PSBJTklUQklUUygpO1xuICAgICAgICAgIGhvbGQgPSAwO1xuICAgICAgICAgIGJpdHMgPSAwO1xuICAgICAgICAgIC8vPT09Ly9cbiAgICAgICAgfVxuICAgICAgICBpZiAoc3RhdGUuaGVhZCkge1xuICAgICAgICAgIHN0YXRlLmhlYWQuaGNyYyA9ICgoc3RhdGUuZmxhZ3MgPj4gOSkgJiAxKTtcbiAgICAgICAgICBzdGF0ZS5oZWFkLmRvbmUgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHN0cm0uYWRsZXIgPSBzdGF0ZS5jaGVjayA9IDA7XG4gICAgICAgIHN0YXRlLm1vZGUgPSBUWVBFO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgRElDVElEOlxuICAgICAgICAvLz09PSBORUVEQklUUygzMik7ICovXG4gICAgICAgIHdoaWxlIChiaXRzIDwgMzIpIHtcbiAgICAgICAgICBpZiAoaGF2ZSA9PT0gMCkgeyBicmVhayBpbmZfbGVhdmU7IH1cbiAgICAgICAgICBoYXZlLS07XG4gICAgICAgICAgaG9sZCArPSBpbnB1dFtuZXh0KytdIDw8IGJpdHM7XG4gICAgICAgICAgYml0cyArPSA4O1xuICAgICAgICB9XG4gICAgICAgIC8vPT09Ly9cbiAgICAgICAgc3RybS5hZGxlciA9IHN0YXRlLmNoZWNrID0genN3YXAzMihob2xkKTtcbiAgICAgICAgLy89PT0gSU5JVEJJVFMoKTtcbiAgICAgICAgaG9sZCA9IDA7XG4gICAgICAgIGJpdHMgPSAwO1xuICAgICAgICAvLz09PS8vXG4gICAgICAgIHN0YXRlLm1vZGUgPSBESUNUO1xuICAgICAgICAvKiBmYWxscyB0aHJvdWdoICovXG4gICAgICBjYXNlIERJQ1Q6XG4gICAgICAgIGlmIChzdGF0ZS5oYXZlZGljdCA9PT0gMCkge1xuICAgICAgICAgIC8vLS0tIFJFU1RPUkUoKSAtLS1cbiAgICAgICAgICBzdHJtLm5leHRfb3V0ID0gcHV0O1xuICAgICAgICAgIHN0cm0uYXZhaWxfb3V0ID0gbGVmdDtcbiAgICAgICAgICBzdHJtLm5leHRfaW4gPSBuZXh0O1xuICAgICAgICAgIHN0cm0uYXZhaWxfaW4gPSBoYXZlO1xuICAgICAgICAgIHN0YXRlLmhvbGQgPSBob2xkO1xuICAgICAgICAgIHN0YXRlLmJpdHMgPSBiaXRzO1xuICAgICAgICAgIC8vLS0tXG4gICAgICAgICAgcmV0dXJuIFpfTkVFRF9ESUNUJDE7XG4gICAgICAgIH1cbiAgICAgICAgc3RybS5hZGxlciA9IHN0YXRlLmNoZWNrID0gMS8qYWRsZXIzMigwTCwgWl9OVUxMLCAwKSovO1xuICAgICAgICBzdGF0ZS5tb2RlID0gVFlQRTtcbiAgICAgICAgLyogZmFsbHMgdGhyb3VnaCAqL1xuICAgICAgY2FzZSBUWVBFOlxuICAgICAgICBpZiAoZmx1c2ggPT09IFpfQkxPQ0sgfHwgZmx1c2ggPT09IFpfVFJFRVMpIHsgYnJlYWsgaW5mX2xlYXZlOyB9XG4gICAgICAgIC8qIGZhbGxzIHRocm91Z2ggKi9cbiAgICAgIGNhc2UgVFlQRURPOlxuICAgICAgICBpZiAoc3RhdGUubGFzdCkge1xuICAgICAgICAgIC8vLS0tIEJZVEVCSVRTKCkgLS0tLy9cbiAgICAgICAgICBob2xkID4+Pj0gYml0cyAmIDc7XG4gICAgICAgICAgYml0cyAtPSBiaXRzICYgNztcbiAgICAgICAgICAvLy0tLS8vXG4gICAgICAgICAgc3RhdGUubW9kZSA9IENIRUNLO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIC8vPT09IE5FRURCSVRTKDMpOyAqL1xuICAgICAgICB3aGlsZSAoYml0cyA8IDMpIHtcbiAgICAgICAgICBpZiAoaGF2ZSA9PT0gMCkgeyBicmVhayBpbmZfbGVhdmU7IH1cbiAgICAgICAgICBoYXZlLS07XG4gICAgICAgICAgaG9sZCArPSBpbnB1dFtuZXh0KytdIDw8IGJpdHM7XG4gICAgICAgICAgYml0cyArPSA4O1xuICAgICAgICB9XG4gICAgICAgIC8vPT09Ly9cbiAgICAgICAgc3RhdGUubGFzdCA9IChob2xkICYgMHgwMSkvKkJJVFMoMSkqLztcbiAgICAgICAgLy8tLS0gRFJPUEJJVFMoMSkgLS0tLy9cbiAgICAgICAgaG9sZCA+Pj49IDE7XG4gICAgICAgIGJpdHMgLT0gMTtcbiAgICAgICAgLy8tLS0vL1xuXG4gICAgICAgIHN3aXRjaCAoKGhvbGQgJiAweDAzKS8qQklUUygyKSovKSB7XG4gICAgICAgICAgY2FzZSAwOiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLyogc3RvcmVkIGJsb2NrICovXG4gICAgICAgICAgICAvL1RyYWNldigoc3RkZXJyLCBcImluZmxhdGU6ICAgICBzdG9yZWQgYmxvY2slc1xcblwiLFxuICAgICAgICAgICAgLy8gICAgICAgIHN0YXRlLmxhc3QgPyBcIiAobGFzdClcIiA6IFwiXCIpKTtcbiAgICAgICAgICAgIHN0YXRlLm1vZGUgPSBTVE9SRUQ7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIDE6ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvKiBmaXhlZCBibG9jayAqL1xuICAgICAgICAgICAgZml4ZWR0YWJsZXMoc3RhdGUpO1xuICAgICAgICAgICAgLy9UcmFjZXYoKHN0ZGVyciwgXCJpbmZsYXRlOiAgICAgZml4ZWQgY29kZXMgYmxvY2slc1xcblwiLFxuICAgICAgICAgICAgLy8gICAgICAgIHN0YXRlLmxhc3QgPyBcIiAobGFzdClcIiA6IFwiXCIpKTtcbiAgICAgICAgICAgIHN0YXRlLm1vZGUgPSBMRU5fOyAgICAgICAgICAgICAvKiBkZWNvZGUgY29kZXMgKi9cbiAgICAgICAgICAgIGlmIChmbHVzaCA9PT0gWl9UUkVFUykge1xuICAgICAgICAgICAgICAvLy0tLSBEUk9QQklUUygyKSAtLS0vL1xuICAgICAgICAgICAgICBob2xkID4+Pj0gMjtcbiAgICAgICAgICAgICAgYml0cyAtPSAyO1xuICAgICAgICAgICAgICAvLy0tLS8vXG4gICAgICAgICAgICAgIGJyZWFrIGluZl9sZWF2ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgMjogICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8qIGR5bmFtaWMgYmxvY2sgKi9cbiAgICAgICAgICAgIC8vVHJhY2V2KChzdGRlcnIsIFwiaW5mbGF0ZTogICAgIGR5bmFtaWMgY29kZXMgYmxvY2slc1xcblwiLFxuICAgICAgICAgICAgLy8gICAgICAgIHN0YXRlLmxhc3QgPyBcIiAobGFzdClcIiA6IFwiXCIpKTtcbiAgICAgICAgICAgIHN0YXRlLm1vZGUgPSBUQUJMRTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgMzpcbiAgICAgICAgICAgIHN0cm0ubXNnID0gJ2ludmFsaWQgYmxvY2sgdHlwZSc7XG4gICAgICAgICAgICBzdGF0ZS5tb2RlID0gQkFEO1xuICAgICAgICB9XG4gICAgICAgIC8vLS0tIERST1BCSVRTKDIpIC0tLS8vXG4gICAgICAgIGhvbGQgPj4+PSAyO1xuICAgICAgICBiaXRzIC09IDI7XG4gICAgICAgIC8vLS0tLy9cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFNUT1JFRDpcbiAgICAgICAgLy8tLS0gQllURUJJVFMoKSAtLS0vLyAvKiBnbyB0byBieXRlIGJvdW5kYXJ5ICovXG4gICAgICAgIGhvbGQgPj4+PSBiaXRzICYgNztcbiAgICAgICAgYml0cyAtPSBiaXRzICYgNztcbiAgICAgICAgLy8tLS0vL1xuICAgICAgICAvLz09PSBORUVEQklUUygzMik7ICovXG4gICAgICAgIHdoaWxlIChiaXRzIDwgMzIpIHtcbiAgICAgICAgICBpZiAoaGF2ZSA9PT0gMCkgeyBicmVhayBpbmZfbGVhdmU7IH1cbiAgICAgICAgICBoYXZlLS07XG4gICAgICAgICAgaG9sZCArPSBpbnB1dFtuZXh0KytdIDw8IGJpdHM7XG4gICAgICAgICAgYml0cyArPSA4O1xuICAgICAgICB9XG4gICAgICAgIC8vPT09Ly9cbiAgICAgICAgaWYgKChob2xkICYgMHhmZmZmKSAhPT0gKChob2xkID4+PiAxNikgXiAweGZmZmYpKSB7XG4gICAgICAgICAgc3RybS5tc2cgPSAnaW52YWxpZCBzdG9yZWQgYmxvY2sgbGVuZ3Rocyc7XG4gICAgICAgICAgc3RhdGUubW9kZSA9IEJBRDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBzdGF0ZS5sZW5ndGggPSBob2xkICYgMHhmZmZmO1xuICAgICAgICAvL1RyYWNldigoc3RkZXJyLCBcImluZmxhdGU6ICAgICAgIHN0b3JlZCBsZW5ndGggJXVcXG5cIixcbiAgICAgICAgLy8gICAgICAgIHN0YXRlLmxlbmd0aCkpO1xuICAgICAgICAvLz09PSBJTklUQklUUygpO1xuICAgICAgICBob2xkID0gMDtcbiAgICAgICAgYml0cyA9IDA7XG4gICAgICAgIC8vPT09Ly9cbiAgICAgICAgc3RhdGUubW9kZSA9IENPUFlfO1xuICAgICAgICBpZiAoZmx1c2ggPT09IFpfVFJFRVMpIHsgYnJlYWsgaW5mX2xlYXZlOyB9XG4gICAgICAgIC8qIGZhbGxzIHRocm91Z2ggKi9cbiAgICAgIGNhc2UgQ09QWV86XG4gICAgICAgIHN0YXRlLm1vZGUgPSBDT1BZO1xuICAgICAgICAvKiBmYWxscyB0aHJvdWdoICovXG4gICAgICBjYXNlIENPUFk6XG4gICAgICAgIGNvcHkgPSBzdGF0ZS5sZW5ndGg7XG4gICAgICAgIGlmIChjb3B5KSB7XG4gICAgICAgICAgaWYgKGNvcHkgPiBoYXZlKSB7IGNvcHkgPSBoYXZlOyB9XG4gICAgICAgICAgaWYgKGNvcHkgPiBsZWZ0KSB7IGNvcHkgPSBsZWZ0OyB9XG4gICAgICAgICAgaWYgKGNvcHkgPT09IDApIHsgYnJlYWsgaW5mX2xlYXZlOyB9XG4gICAgICAgICAgLy8tLS0gem1lbWNweShwdXQsIG5leHQsIGNvcHkpOyAtLS1cbiAgICAgICAgICBvdXRwdXQuc2V0KGlucHV0LnN1YmFycmF5KG5leHQsIG5leHQgKyBjb3B5KSwgcHV0KTtcbiAgICAgICAgICAvLy0tLS8vXG4gICAgICAgICAgaGF2ZSAtPSBjb3B5O1xuICAgICAgICAgIG5leHQgKz0gY29weTtcbiAgICAgICAgICBsZWZ0IC09IGNvcHk7XG4gICAgICAgICAgcHV0ICs9IGNvcHk7XG4gICAgICAgICAgc3RhdGUubGVuZ3RoIC09IGNvcHk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgLy9UcmFjZXYoKHN0ZGVyciwgXCJpbmZsYXRlOiAgICAgICBzdG9yZWQgZW5kXFxuXCIpKTtcbiAgICAgICAgc3RhdGUubW9kZSA9IFRZUEU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBUQUJMRTpcbiAgICAgICAgLy89PT0gTkVFREJJVFMoMTQpOyAqL1xuICAgICAgICB3aGlsZSAoYml0cyA8IDE0KSB7XG4gICAgICAgICAgaWYgKGhhdmUgPT09IDApIHsgYnJlYWsgaW5mX2xlYXZlOyB9XG4gICAgICAgICAgaGF2ZS0tO1xuICAgICAgICAgIGhvbGQgKz0gaW5wdXRbbmV4dCsrXSA8PCBiaXRzO1xuICAgICAgICAgIGJpdHMgKz0gODtcbiAgICAgICAgfVxuICAgICAgICAvLz09PS8vXG4gICAgICAgIHN0YXRlLm5sZW4gPSAoaG9sZCAmIDB4MWYpLypCSVRTKDUpKi8gKyAyNTc7XG4gICAgICAgIC8vLS0tIERST1BCSVRTKDUpIC0tLS8vXG4gICAgICAgIGhvbGQgPj4+PSA1O1xuICAgICAgICBiaXRzIC09IDU7XG4gICAgICAgIC8vLS0tLy9cbiAgICAgICAgc3RhdGUubmRpc3QgPSAoaG9sZCAmIDB4MWYpLypCSVRTKDUpKi8gKyAxO1xuICAgICAgICAvLy0tLSBEUk9QQklUUyg1KSAtLS0vL1xuICAgICAgICBob2xkID4+Pj0gNTtcbiAgICAgICAgYml0cyAtPSA1O1xuICAgICAgICAvLy0tLS8vXG4gICAgICAgIHN0YXRlLm5jb2RlID0gKGhvbGQgJiAweDBmKS8qQklUUyg0KSovICsgNDtcbiAgICAgICAgLy8tLS0gRFJPUEJJVFMoNCkgLS0tLy9cbiAgICAgICAgaG9sZCA+Pj49IDQ7XG4gICAgICAgIGJpdHMgLT0gNDtcbiAgICAgICAgLy8tLS0vL1xuLy8jaWZuZGVmIFBLWklQX0JVR19XT1JLQVJPVU5EXG4gICAgICAgIGlmIChzdGF0ZS5ubGVuID4gMjg2IHx8IHN0YXRlLm5kaXN0ID4gMzApIHtcbiAgICAgICAgICBzdHJtLm1zZyA9ICd0b28gbWFueSBsZW5ndGggb3IgZGlzdGFuY2Ugc3ltYm9scyc7XG4gICAgICAgICAgc3RhdGUubW9kZSA9IEJBRDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuLy8jZW5kaWZcbiAgICAgICAgLy9UcmFjZXYoKHN0ZGVyciwgXCJpbmZsYXRlOiAgICAgICB0YWJsZSBzaXplcyBva1xcblwiKSk7XG4gICAgICAgIHN0YXRlLmhhdmUgPSAwO1xuICAgICAgICBzdGF0ZS5tb2RlID0gTEVOTEVOUztcbiAgICAgICAgLyogZmFsbHMgdGhyb3VnaCAqL1xuICAgICAgY2FzZSBMRU5MRU5TOlxuICAgICAgICB3aGlsZSAoc3RhdGUuaGF2ZSA8IHN0YXRlLm5jb2RlKSB7XG4gICAgICAgICAgLy89PT0gTkVFREJJVFMoMyk7XG4gICAgICAgICAgd2hpbGUgKGJpdHMgPCAzKSB7XG4gICAgICAgICAgICBpZiAoaGF2ZSA9PT0gMCkgeyBicmVhayBpbmZfbGVhdmU7IH1cbiAgICAgICAgICAgIGhhdmUtLTtcbiAgICAgICAgICAgIGhvbGQgKz0gaW5wdXRbbmV4dCsrXSA8PCBiaXRzO1xuICAgICAgICAgICAgYml0cyArPSA4O1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLz09PS8vXG4gICAgICAgICAgc3RhdGUubGVuc1tvcmRlcltzdGF0ZS5oYXZlKytdXSA9IChob2xkICYgMHgwNyk7Ly9CSVRTKDMpO1xuICAgICAgICAgIC8vLS0tIERST1BCSVRTKDMpIC0tLS8vXG4gICAgICAgICAgaG9sZCA+Pj49IDM7XG4gICAgICAgICAgYml0cyAtPSAzO1xuICAgICAgICAgIC8vLS0tLy9cbiAgICAgICAgfVxuICAgICAgICB3aGlsZSAoc3RhdGUuaGF2ZSA8IDE5KSB7XG4gICAgICAgICAgc3RhdGUubGVuc1tvcmRlcltzdGF0ZS5oYXZlKytdXSA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgLy8gV2UgaGF2ZSBzZXBhcmF0ZSB0YWJsZXMgJiBubyBwb2ludGVycy4gMiBjb21tZW50ZWQgbGluZXMgYmVsb3cgbm90IG5lZWRlZC5cbiAgICAgICAgLy9zdGF0ZS5uZXh0ID0gc3RhdGUuY29kZXM7XG4gICAgICAgIC8vc3RhdGUubGVuY29kZSA9IHN0YXRlLm5leHQ7XG4gICAgICAgIC8vIFN3aXRjaCB0byB1c2UgZHluYW1pYyB0YWJsZVxuICAgICAgICBzdGF0ZS5sZW5jb2RlID0gc3RhdGUubGVuZHluO1xuICAgICAgICBzdGF0ZS5sZW5iaXRzID0gNztcblxuICAgICAgICBvcHRzID0geyBiaXRzOiBzdGF0ZS5sZW5iaXRzIH07XG4gICAgICAgIHJldCA9IGluZnRyZWVzKENPREVTLCBzdGF0ZS5sZW5zLCAwLCAxOSwgc3RhdGUubGVuY29kZSwgMCwgc3RhdGUud29yaywgb3B0cyk7XG4gICAgICAgIHN0YXRlLmxlbmJpdHMgPSBvcHRzLmJpdHM7XG5cbiAgICAgICAgaWYgKHJldCkge1xuICAgICAgICAgIHN0cm0ubXNnID0gJ2ludmFsaWQgY29kZSBsZW5ndGhzIHNldCc7XG4gICAgICAgICAgc3RhdGUubW9kZSA9IEJBRDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICAvL1RyYWNldigoc3RkZXJyLCBcImluZmxhdGU6ICAgICAgIGNvZGUgbGVuZ3RocyBva1xcblwiKSk7XG4gICAgICAgIHN0YXRlLmhhdmUgPSAwO1xuICAgICAgICBzdGF0ZS5tb2RlID0gQ09ERUxFTlM7XG4gICAgICAgIC8qIGZhbGxzIHRocm91Z2ggKi9cbiAgICAgIGNhc2UgQ09ERUxFTlM6XG4gICAgICAgIHdoaWxlIChzdGF0ZS5oYXZlIDwgc3RhdGUubmxlbiArIHN0YXRlLm5kaXN0KSB7XG4gICAgICAgICAgZm9yICg7Oykge1xuICAgICAgICAgICAgaGVyZSA9IHN0YXRlLmxlbmNvZGVbaG9sZCAmICgoMSA8PCBzdGF0ZS5sZW5iaXRzKSAtIDEpXTsvKkJJVFMoc3RhdGUubGVuYml0cykqL1xuICAgICAgICAgICAgaGVyZV9iaXRzID0gaGVyZSA+Pj4gMjQ7XG4gICAgICAgICAgICBoZXJlX29wID0gKGhlcmUgPj4+IDE2KSAmIDB4ZmY7XG4gICAgICAgICAgICBoZXJlX3ZhbCA9IGhlcmUgJiAweGZmZmY7XG5cbiAgICAgICAgICAgIGlmICgoaGVyZV9iaXRzKSA8PSBiaXRzKSB7IGJyZWFrOyB9XG4gICAgICAgICAgICAvLy0tLSBQVUxMQllURSgpIC0tLS8vXG4gICAgICAgICAgICBpZiAoaGF2ZSA9PT0gMCkgeyBicmVhayBpbmZfbGVhdmU7IH1cbiAgICAgICAgICAgIGhhdmUtLTtcbiAgICAgICAgICAgIGhvbGQgKz0gaW5wdXRbbmV4dCsrXSA8PCBiaXRzO1xuICAgICAgICAgICAgYml0cyArPSA4O1xuICAgICAgICAgICAgLy8tLS0vL1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoaGVyZV92YWwgPCAxNikge1xuICAgICAgICAgICAgLy8tLS0gRFJPUEJJVFMoaGVyZS5iaXRzKSAtLS0vL1xuICAgICAgICAgICAgaG9sZCA+Pj49IGhlcmVfYml0cztcbiAgICAgICAgICAgIGJpdHMgLT0gaGVyZV9iaXRzO1xuICAgICAgICAgICAgLy8tLS0vL1xuICAgICAgICAgICAgc3RhdGUubGVuc1tzdGF0ZS5oYXZlKytdID0gaGVyZV92YWw7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgaWYgKGhlcmVfdmFsID09PSAxNikge1xuICAgICAgICAgICAgICAvLz09PSBORUVEQklUUyhoZXJlLmJpdHMgKyAyKTtcbiAgICAgICAgICAgICAgbiA9IGhlcmVfYml0cyArIDI7XG4gICAgICAgICAgICAgIHdoaWxlIChiaXRzIDwgbikge1xuICAgICAgICAgICAgICAgIGlmIChoYXZlID09PSAwKSB7IGJyZWFrIGluZl9sZWF2ZTsgfVxuICAgICAgICAgICAgICAgIGhhdmUtLTtcbiAgICAgICAgICAgICAgICBob2xkICs9IGlucHV0W25leHQrK10gPDwgYml0cztcbiAgICAgICAgICAgICAgICBiaXRzICs9IDg7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgLy89PT0vL1xuICAgICAgICAgICAgICAvLy0tLSBEUk9QQklUUyhoZXJlLmJpdHMpIC0tLS8vXG4gICAgICAgICAgICAgIGhvbGQgPj4+PSBoZXJlX2JpdHM7XG4gICAgICAgICAgICAgIGJpdHMgLT0gaGVyZV9iaXRzO1xuICAgICAgICAgICAgICAvLy0tLS8vXG4gICAgICAgICAgICAgIGlmIChzdGF0ZS5oYXZlID09PSAwKSB7XG4gICAgICAgICAgICAgICAgc3RybS5tc2cgPSAnaW52YWxpZCBiaXQgbGVuZ3RoIHJlcGVhdCc7XG4gICAgICAgICAgICAgICAgc3RhdGUubW9kZSA9IEJBRDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBsZW4gPSBzdGF0ZS5sZW5zW3N0YXRlLmhhdmUgLSAxXTtcbiAgICAgICAgICAgICAgY29weSA9IDMgKyAoaG9sZCAmIDB4MDMpOy8vQklUUygyKTtcbiAgICAgICAgICAgICAgLy8tLS0gRFJPUEJJVFMoMikgLS0tLy9cbiAgICAgICAgICAgICAgaG9sZCA+Pj49IDI7XG4gICAgICAgICAgICAgIGJpdHMgLT0gMjtcbiAgICAgICAgICAgICAgLy8tLS0vL1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoaGVyZV92YWwgPT09IDE3KSB7XG4gICAgICAgICAgICAgIC8vPT09IE5FRURCSVRTKGhlcmUuYml0cyArIDMpO1xuICAgICAgICAgICAgICBuID0gaGVyZV9iaXRzICsgMztcbiAgICAgICAgICAgICAgd2hpbGUgKGJpdHMgPCBuKSB7XG4gICAgICAgICAgICAgICAgaWYgKGhhdmUgPT09IDApIHsgYnJlYWsgaW5mX2xlYXZlOyB9XG4gICAgICAgICAgICAgICAgaGF2ZS0tO1xuICAgICAgICAgICAgICAgIGhvbGQgKz0gaW5wdXRbbmV4dCsrXSA8PCBiaXRzO1xuICAgICAgICAgICAgICAgIGJpdHMgKz0gODtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAvLz09PS8vXG4gICAgICAgICAgICAgIC8vLS0tIERST1BCSVRTKGhlcmUuYml0cykgLS0tLy9cbiAgICAgICAgICAgICAgaG9sZCA+Pj49IGhlcmVfYml0cztcbiAgICAgICAgICAgICAgYml0cyAtPSBoZXJlX2JpdHM7XG4gICAgICAgICAgICAgIC8vLS0tLy9cbiAgICAgICAgICAgICAgbGVuID0gMDtcbiAgICAgICAgICAgICAgY29weSA9IDMgKyAoaG9sZCAmIDB4MDcpOy8vQklUUygzKTtcbiAgICAgICAgICAgICAgLy8tLS0gRFJPUEJJVFMoMykgLS0tLy9cbiAgICAgICAgICAgICAgaG9sZCA+Pj49IDM7XG4gICAgICAgICAgICAgIGJpdHMgLT0gMztcbiAgICAgICAgICAgICAgLy8tLS0vL1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgIC8vPT09IE5FRURCSVRTKGhlcmUuYml0cyArIDcpO1xuICAgICAgICAgICAgICBuID0gaGVyZV9iaXRzICsgNztcbiAgICAgICAgICAgICAgd2hpbGUgKGJpdHMgPCBuKSB7XG4gICAgICAgICAgICAgICAgaWYgKGhhdmUgPT09IDApIHsgYnJlYWsgaW5mX2xlYXZlOyB9XG4gICAgICAgICAgICAgICAgaGF2ZS0tO1xuICAgICAgICAgICAgICAgIGhvbGQgKz0gaW5wdXRbbmV4dCsrXSA8PCBiaXRzO1xuICAgICAgICAgICAgICAgIGJpdHMgKz0gODtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAvLz09PS8vXG4gICAgICAgICAgICAgIC8vLS0tIERST1BCSVRTKGhlcmUuYml0cykgLS0tLy9cbiAgICAgICAgICAgICAgaG9sZCA+Pj49IGhlcmVfYml0cztcbiAgICAgICAgICAgICAgYml0cyAtPSBoZXJlX2JpdHM7XG4gICAgICAgICAgICAgIC8vLS0tLy9cbiAgICAgICAgICAgICAgbGVuID0gMDtcbiAgICAgICAgICAgICAgY29weSA9IDExICsgKGhvbGQgJiAweDdmKTsvL0JJVFMoNyk7XG4gICAgICAgICAgICAgIC8vLS0tIERST1BCSVRTKDcpIC0tLS8vXG4gICAgICAgICAgICAgIGhvbGQgPj4+PSA3O1xuICAgICAgICAgICAgICBiaXRzIC09IDc7XG4gICAgICAgICAgICAgIC8vLS0tLy9cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzdGF0ZS5oYXZlICsgY29weSA+IHN0YXRlLm5sZW4gKyBzdGF0ZS5uZGlzdCkge1xuICAgICAgICAgICAgICBzdHJtLm1zZyA9ICdpbnZhbGlkIGJpdCBsZW5ndGggcmVwZWF0JztcbiAgICAgICAgICAgICAgc3RhdGUubW9kZSA9IEJBRDtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB3aGlsZSAoY29weS0tKSB7XG4gICAgICAgICAgICAgIHN0YXRlLmxlbnNbc3RhdGUuaGF2ZSsrXSA9IGxlbjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvKiBoYW5kbGUgZXJyb3IgYnJlYWtzIGluIHdoaWxlICovXG4gICAgICAgIGlmIChzdGF0ZS5tb2RlID09PSBCQUQpIHsgYnJlYWs7IH1cblxuICAgICAgICAvKiBjaGVjayBmb3IgZW5kLW9mLWJsb2NrIGNvZGUgKGJldHRlciBoYXZlIG9uZSkgKi9cbiAgICAgICAgaWYgKHN0YXRlLmxlbnNbMjU2XSA9PT0gMCkge1xuICAgICAgICAgIHN0cm0ubXNnID0gJ2ludmFsaWQgY29kZSAtLSBtaXNzaW5nIGVuZC1vZi1ibG9jayc7XG4gICAgICAgICAgc3RhdGUubW9kZSA9IEJBRDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIC8qIGJ1aWxkIGNvZGUgdGFibGVzIC0tIG5vdGU6IGRvIG5vdCBjaGFuZ2UgdGhlIGxlbmJpdHMgb3IgZGlzdGJpdHNcbiAgICAgICAgICAgdmFsdWVzIGhlcmUgKDkgYW5kIDYpIHdpdGhvdXQgcmVhZGluZyB0aGUgY29tbWVudHMgaW4gaW5mdHJlZXMuaFxuICAgICAgICAgICBjb25jZXJuaW5nIHRoZSBFTk9VR0ggY29uc3RhbnRzLCB3aGljaCBkZXBlbmQgb24gdGhvc2UgdmFsdWVzICovXG4gICAgICAgIHN0YXRlLmxlbmJpdHMgPSA5O1xuXG4gICAgICAgIG9wdHMgPSB7IGJpdHM6IHN0YXRlLmxlbmJpdHMgfTtcbiAgICAgICAgcmV0ID0gaW5mdHJlZXMoTEVOUywgc3RhdGUubGVucywgMCwgc3RhdGUubmxlbiwgc3RhdGUubGVuY29kZSwgMCwgc3RhdGUud29yaywgb3B0cyk7XG4gICAgICAgIC8vIFdlIGhhdmUgc2VwYXJhdGUgdGFibGVzICYgbm8gcG9pbnRlcnMuIDIgY29tbWVudGVkIGxpbmVzIGJlbG93IG5vdCBuZWVkZWQuXG4gICAgICAgIC8vIHN0YXRlLm5leHRfaW5kZXggPSBvcHRzLnRhYmxlX2luZGV4O1xuICAgICAgICBzdGF0ZS5sZW5iaXRzID0gb3B0cy5iaXRzO1xuICAgICAgICAvLyBzdGF0ZS5sZW5jb2RlID0gc3RhdGUubmV4dDtcblxuICAgICAgICBpZiAocmV0KSB7XG4gICAgICAgICAgc3RybS5tc2cgPSAnaW52YWxpZCBsaXRlcmFsL2xlbmd0aHMgc2V0JztcbiAgICAgICAgICBzdGF0ZS5tb2RlID0gQkFEO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgc3RhdGUuZGlzdGJpdHMgPSA2O1xuICAgICAgICAvL3N0YXRlLmRpc3Rjb2RlLmNvcHkoc3RhdGUuY29kZXMpO1xuICAgICAgICAvLyBTd2l0Y2ggdG8gdXNlIGR5bmFtaWMgdGFibGVcbiAgICAgICAgc3RhdGUuZGlzdGNvZGUgPSBzdGF0ZS5kaXN0ZHluO1xuICAgICAgICBvcHRzID0geyBiaXRzOiBzdGF0ZS5kaXN0Yml0cyB9O1xuICAgICAgICByZXQgPSBpbmZ0cmVlcyhESVNUUywgc3RhdGUubGVucywgc3RhdGUubmxlbiwgc3RhdGUubmRpc3QsIHN0YXRlLmRpc3Rjb2RlLCAwLCBzdGF0ZS53b3JrLCBvcHRzKTtcbiAgICAgICAgLy8gV2UgaGF2ZSBzZXBhcmF0ZSB0YWJsZXMgJiBubyBwb2ludGVycy4gMiBjb21tZW50ZWQgbGluZXMgYmVsb3cgbm90IG5lZWRlZC5cbiAgICAgICAgLy8gc3RhdGUubmV4dF9pbmRleCA9IG9wdHMudGFibGVfaW5kZXg7XG4gICAgICAgIHN0YXRlLmRpc3RiaXRzID0gb3B0cy5iaXRzO1xuICAgICAgICAvLyBzdGF0ZS5kaXN0Y29kZSA9IHN0YXRlLm5leHQ7XG5cbiAgICAgICAgaWYgKHJldCkge1xuICAgICAgICAgIHN0cm0ubXNnID0gJ2ludmFsaWQgZGlzdGFuY2VzIHNldCc7XG4gICAgICAgICAgc3RhdGUubW9kZSA9IEJBRDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICAvL1RyYWNldigoc3RkZXJyLCAnaW5mbGF0ZTogICAgICAgY29kZXMgb2tcXG4nKSk7XG4gICAgICAgIHN0YXRlLm1vZGUgPSBMRU5fO1xuICAgICAgICBpZiAoZmx1c2ggPT09IFpfVFJFRVMpIHsgYnJlYWsgaW5mX2xlYXZlOyB9XG4gICAgICAgIC8qIGZhbGxzIHRocm91Z2ggKi9cbiAgICAgIGNhc2UgTEVOXzpcbiAgICAgICAgc3RhdGUubW9kZSA9IExFTjtcbiAgICAgICAgLyogZmFsbHMgdGhyb3VnaCAqL1xuICAgICAgY2FzZSBMRU46XG4gICAgICAgIGlmIChoYXZlID49IDYgJiYgbGVmdCA+PSAyNTgpIHtcbiAgICAgICAgICAvLy0tLSBSRVNUT1JFKCkgLS0tXG4gICAgICAgICAgc3RybS5uZXh0X291dCA9IHB1dDtcbiAgICAgICAgICBzdHJtLmF2YWlsX291dCA9IGxlZnQ7XG4gICAgICAgICAgc3RybS5uZXh0X2luID0gbmV4dDtcbiAgICAgICAgICBzdHJtLmF2YWlsX2luID0gaGF2ZTtcbiAgICAgICAgICBzdGF0ZS5ob2xkID0gaG9sZDtcbiAgICAgICAgICBzdGF0ZS5iaXRzID0gYml0cztcbiAgICAgICAgICAvLy0tLVxuICAgICAgICAgIGluZmZhc3Qoc3RybSwgX291dCk7XG4gICAgICAgICAgLy8tLS0gTE9BRCgpIC0tLVxuICAgICAgICAgIHB1dCA9IHN0cm0ubmV4dF9vdXQ7XG4gICAgICAgICAgb3V0cHV0ID0gc3RybS5vdXRwdXQ7XG4gICAgICAgICAgbGVmdCA9IHN0cm0uYXZhaWxfb3V0O1xuICAgICAgICAgIG5leHQgPSBzdHJtLm5leHRfaW47XG4gICAgICAgICAgaW5wdXQgPSBzdHJtLmlucHV0O1xuICAgICAgICAgIGhhdmUgPSBzdHJtLmF2YWlsX2luO1xuICAgICAgICAgIGhvbGQgPSBzdGF0ZS5ob2xkO1xuICAgICAgICAgIGJpdHMgPSBzdGF0ZS5iaXRzO1xuICAgICAgICAgIC8vLS0tXG5cbiAgICAgICAgICBpZiAoc3RhdGUubW9kZSA9PT0gVFlQRSkge1xuICAgICAgICAgICAgc3RhdGUuYmFjayA9IC0xO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBzdGF0ZS5iYWNrID0gMDtcbiAgICAgICAgZm9yICg7Oykge1xuICAgICAgICAgIGhlcmUgPSBzdGF0ZS5sZW5jb2RlW2hvbGQgJiAoKDEgPDwgc3RhdGUubGVuYml0cykgLSAxKV07ICAvKkJJVFMoc3RhdGUubGVuYml0cykqL1xuICAgICAgICAgIGhlcmVfYml0cyA9IGhlcmUgPj4+IDI0O1xuICAgICAgICAgIGhlcmVfb3AgPSAoaGVyZSA+Pj4gMTYpICYgMHhmZjtcbiAgICAgICAgICBoZXJlX3ZhbCA9IGhlcmUgJiAweGZmZmY7XG5cbiAgICAgICAgICBpZiAoaGVyZV9iaXRzIDw9IGJpdHMpIHsgYnJlYWs7IH1cbiAgICAgICAgICAvLy0tLSBQVUxMQllURSgpIC0tLS8vXG4gICAgICAgICAgaWYgKGhhdmUgPT09IDApIHsgYnJlYWsgaW5mX2xlYXZlOyB9XG4gICAgICAgICAgaGF2ZS0tO1xuICAgICAgICAgIGhvbGQgKz0gaW5wdXRbbmV4dCsrXSA8PCBiaXRzO1xuICAgICAgICAgIGJpdHMgKz0gODtcbiAgICAgICAgICAvLy0tLS8vXG4gICAgICAgIH1cbiAgICAgICAgaWYgKGhlcmVfb3AgJiYgKGhlcmVfb3AgJiAweGYwKSA9PT0gMCkge1xuICAgICAgICAgIGxhc3RfYml0cyA9IGhlcmVfYml0cztcbiAgICAgICAgICBsYXN0X29wID0gaGVyZV9vcDtcbiAgICAgICAgICBsYXN0X3ZhbCA9IGhlcmVfdmFsO1xuICAgICAgICAgIGZvciAoOzspIHtcbiAgICAgICAgICAgIGhlcmUgPSBzdGF0ZS5sZW5jb2RlW2xhc3RfdmFsICtcbiAgICAgICAgICAgICAgICAgICAgKChob2xkICYgKCgxIDw8IChsYXN0X2JpdHMgKyBsYXN0X29wKSkgLSAxKSkvKkJJVFMobGFzdC5iaXRzICsgbGFzdC5vcCkqLyA+PiBsYXN0X2JpdHMpXTtcbiAgICAgICAgICAgIGhlcmVfYml0cyA9IGhlcmUgPj4+IDI0O1xuICAgICAgICAgICAgaGVyZV9vcCA9IChoZXJlID4+PiAxNikgJiAweGZmO1xuICAgICAgICAgICAgaGVyZV92YWwgPSBoZXJlICYgMHhmZmZmO1xuXG4gICAgICAgICAgICBpZiAoKGxhc3RfYml0cyArIGhlcmVfYml0cykgPD0gYml0cykgeyBicmVhazsgfVxuICAgICAgICAgICAgLy8tLS0gUFVMTEJZVEUoKSAtLS0vL1xuICAgICAgICAgICAgaWYgKGhhdmUgPT09IDApIHsgYnJlYWsgaW5mX2xlYXZlOyB9XG4gICAgICAgICAgICBoYXZlLS07XG4gICAgICAgICAgICBob2xkICs9IGlucHV0W25leHQrK10gPDwgYml0cztcbiAgICAgICAgICAgIGJpdHMgKz0gODtcbiAgICAgICAgICAgIC8vLS0tLy9cbiAgICAgICAgICB9XG4gICAgICAgICAgLy8tLS0gRFJPUEJJVFMobGFzdC5iaXRzKSAtLS0vL1xuICAgICAgICAgIGhvbGQgPj4+PSBsYXN0X2JpdHM7XG4gICAgICAgICAgYml0cyAtPSBsYXN0X2JpdHM7XG4gICAgICAgICAgLy8tLS0vL1xuICAgICAgICAgIHN0YXRlLmJhY2sgKz0gbGFzdF9iaXRzO1xuICAgICAgICB9XG4gICAgICAgIC8vLS0tIERST1BCSVRTKGhlcmUuYml0cykgLS0tLy9cbiAgICAgICAgaG9sZCA+Pj49IGhlcmVfYml0cztcbiAgICAgICAgYml0cyAtPSBoZXJlX2JpdHM7XG4gICAgICAgIC8vLS0tLy9cbiAgICAgICAgc3RhdGUuYmFjayArPSBoZXJlX2JpdHM7XG4gICAgICAgIHN0YXRlLmxlbmd0aCA9IGhlcmVfdmFsO1xuICAgICAgICBpZiAoaGVyZV9vcCA9PT0gMCkge1xuICAgICAgICAgIC8vVHJhY2V2digoc3RkZXJyLCBoZXJlLnZhbCA+PSAweDIwICYmIGhlcmUudmFsIDwgMHg3ZiA/XG4gICAgICAgICAgLy8gICAgICAgIFwiaW5mbGF0ZTogICAgICAgICBsaXRlcmFsICclYydcXG5cIiA6XG4gICAgICAgICAgLy8gICAgICAgIFwiaW5mbGF0ZTogICAgICAgICBsaXRlcmFsIDB4JTAyeFxcblwiLCBoZXJlLnZhbCkpO1xuICAgICAgICAgIHN0YXRlLm1vZGUgPSBMSVQ7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGhlcmVfb3AgJiAzMikge1xuICAgICAgICAgIC8vVHJhY2V2digoc3RkZXJyLCBcImluZmxhdGU6ICAgICAgICAgZW5kIG9mIGJsb2NrXFxuXCIpKTtcbiAgICAgICAgICBzdGF0ZS5iYWNrID0gLTE7XG4gICAgICAgICAgc3RhdGUubW9kZSA9IFRZUEU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGhlcmVfb3AgJiA2NCkge1xuICAgICAgICAgIHN0cm0ubXNnID0gJ2ludmFsaWQgbGl0ZXJhbC9sZW5ndGggY29kZSc7XG4gICAgICAgICAgc3RhdGUubW9kZSA9IEJBRDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBzdGF0ZS5leHRyYSA9IGhlcmVfb3AgJiAxNTtcbiAgICAgICAgc3RhdGUubW9kZSA9IExFTkVYVDtcbiAgICAgICAgLyogZmFsbHMgdGhyb3VnaCAqL1xuICAgICAgY2FzZSBMRU5FWFQ6XG4gICAgICAgIGlmIChzdGF0ZS5leHRyYSkge1xuICAgICAgICAgIC8vPT09IE5FRURCSVRTKHN0YXRlLmV4dHJhKTtcbiAgICAgICAgICBuID0gc3RhdGUuZXh0cmE7XG4gICAgICAgICAgd2hpbGUgKGJpdHMgPCBuKSB7XG4gICAgICAgICAgICBpZiAoaGF2ZSA9PT0gMCkgeyBicmVhayBpbmZfbGVhdmU7IH1cbiAgICAgICAgICAgIGhhdmUtLTtcbiAgICAgICAgICAgIGhvbGQgKz0gaW5wdXRbbmV4dCsrXSA8PCBiaXRzO1xuICAgICAgICAgICAgYml0cyArPSA4O1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLz09PS8vXG4gICAgICAgICAgc3RhdGUubGVuZ3RoICs9IGhvbGQgJiAoKDEgPDwgc3RhdGUuZXh0cmEpIC0gMSkvKkJJVFMoc3RhdGUuZXh0cmEpKi87XG4gICAgICAgICAgLy8tLS0gRFJPUEJJVFMoc3RhdGUuZXh0cmEpIC0tLS8vXG4gICAgICAgICAgaG9sZCA+Pj49IHN0YXRlLmV4dHJhO1xuICAgICAgICAgIGJpdHMgLT0gc3RhdGUuZXh0cmE7XG4gICAgICAgICAgLy8tLS0vL1xuICAgICAgICAgIHN0YXRlLmJhY2sgKz0gc3RhdGUuZXh0cmE7XG4gICAgICAgIH1cbiAgICAgICAgLy9UcmFjZXZ2KChzdGRlcnIsIFwiaW5mbGF0ZTogICAgICAgICBsZW5ndGggJXVcXG5cIiwgc3RhdGUubGVuZ3RoKSk7XG4gICAgICAgIHN0YXRlLndhcyA9IHN0YXRlLmxlbmd0aDtcbiAgICAgICAgc3RhdGUubW9kZSA9IERJU1Q7XG4gICAgICAgIC8qIGZhbGxzIHRocm91Z2ggKi9cbiAgICAgIGNhc2UgRElTVDpcbiAgICAgICAgZm9yICg7Oykge1xuICAgICAgICAgIGhlcmUgPSBzdGF0ZS5kaXN0Y29kZVtob2xkICYgKCgxIDw8IHN0YXRlLmRpc3RiaXRzKSAtIDEpXTsvKkJJVFMoc3RhdGUuZGlzdGJpdHMpKi9cbiAgICAgICAgICBoZXJlX2JpdHMgPSBoZXJlID4+PiAyNDtcbiAgICAgICAgICBoZXJlX29wID0gKGhlcmUgPj4+IDE2KSAmIDB4ZmY7XG4gICAgICAgICAgaGVyZV92YWwgPSBoZXJlICYgMHhmZmZmO1xuXG4gICAgICAgICAgaWYgKChoZXJlX2JpdHMpIDw9IGJpdHMpIHsgYnJlYWs7IH1cbiAgICAgICAgICAvLy0tLSBQVUxMQllURSgpIC0tLS8vXG4gICAgICAgICAgaWYgKGhhdmUgPT09IDApIHsgYnJlYWsgaW5mX2xlYXZlOyB9XG4gICAgICAgICAgaGF2ZS0tO1xuICAgICAgICAgIGhvbGQgKz0gaW5wdXRbbmV4dCsrXSA8PCBiaXRzO1xuICAgICAgICAgIGJpdHMgKz0gODtcbiAgICAgICAgICAvLy0tLS8vXG4gICAgICAgIH1cbiAgICAgICAgaWYgKChoZXJlX29wICYgMHhmMCkgPT09IDApIHtcbiAgICAgICAgICBsYXN0X2JpdHMgPSBoZXJlX2JpdHM7XG4gICAgICAgICAgbGFzdF9vcCA9IGhlcmVfb3A7XG4gICAgICAgICAgbGFzdF92YWwgPSBoZXJlX3ZhbDtcbiAgICAgICAgICBmb3IgKDs7KSB7XG4gICAgICAgICAgICBoZXJlID0gc3RhdGUuZGlzdGNvZGVbbGFzdF92YWwgK1xuICAgICAgICAgICAgICAgICAgICAoKGhvbGQgJiAoKDEgPDwgKGxhc3RfYml0cyArIGxhc3Rfb3ApKSAtIDEpKS8qQklUUyhsYXN0LmJpdHMgKyBsYXN0Lm9wKSovID4+IGxhc3RfYml0cyldO1xuICAgICAgICAgICAgaGVyZV9iaXRzID0gaGVyZSA+Pj4gMjQ7XG4gICAgICAgICAgICBoZXJlX29wID0gKGhlcmUgPj4+IDE2KSAmIDB4ZmY7XG4gICAgICAgICAgICBoZXJlX3ZhbCA9IGhlcmUgJiAweGZmZmY7XG5cbiAgICAgICAgICAgIGlmICgobGFzdF9iaXRzICsgaGVyZV9iaXRzKSA8PSBiaXRzKSB7IGJyZWFrOyB9XG4gICAgICAgICAgICAvLy0tLSBQVUxMQllURSgpIC0tLS8vXG4gICAgICAgICAgICBpZiAoaGF2ZSA9PT0gMCkgeyBicmVhayBpbmZfbGVhdmU7IH1cbiAgICAgICAgICAgIGhhdmUtLTtcbiAgICAgICAgICAgIGhvbGQgKz0gaW5wdXRbbmV4dCsrXSA8PCBiaXRzO1xuICAgICAgICAgICAgYml0cyArPSA4O1xuICAgICAgICAgICAgLy8tLS0vL1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLy0tLSBEUk9QQklUUyhsYXN0LmJpdHMpIC0tLS8vXG4gICAgICAgICAgaG9sZCA+Pj49IGxhc3RfYml0cztcbiAgICAgICAgICBiaXRzIC09IGxhc3RfYml0cztcbiAgICAgICAgICAvLy0tLS8vXG4gICAgICAgICAgc3RhdGUuYmFjayArPSBsYXN0X2JpdHM7XG4gICAgICAgIH1cbiAgICAgICAgLy8tLS0gRFJPUEJJVFMoaGVyZS5iaXRzKSAtLS0vL1xuICAgICAgICBob2xkID4+Pj0gaGVyZV9iaXRzO1xuICAgICAgICBiaXRzIC09IGhlcmVfYml0cztcbiAgICAgICAgLy8tLS0vL1xuICAgICAgICBzdGF0ZS5iYWNrICs9IGhlcmVfYml0cztcbiAgICAgICAgaWYgKGhlcmVfb3AgJiA2NCkge1xuICAgICAgICAgIHN0cm0ubXNnID0gJ2ludmFsaWQgZGlzdGFuY2UgY29kZSc7XG4gICAgICAgICAgc3RhdGUubW9kZSA9IEJBRDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBzdGF0ZS5vZmZzZXQgPSBoZXJlX3ZhbDtcbiAgICAgICAgc3RhdGUuZXh0cmEgPSAoaGVyZV9vcCkgJiAxNTtcbiAgICAgICAgc3RhdGUubW9kZSA9IERJU1RFWFQ7XG4gICAgICAgIC8qIGZhbGxzIHRocm91Z2ggKi9cbiAgICAgIGNhc2UgRElTVEVYVDpcbiAgICAgICAgaWYgKHN0YXRlLmV4dHJhKSB7XG4gICAgICAgICAgLy89PT0gTkVFREJJVFMoc3RhdGUuZXh0cmEpO1xuICAgICAgICAgIG4gPSBzdGF0ZS5leHRyYTtcbiAgICAgICAgICB3aGlsZSAoYml0cyA8IG4pIHtcbiAgICAgICAgICAgIGlmIChoYXZlID09PSAwKSB7IGJyZWFrIGluZl9sZWF2ZTsgfVxuICAgICAgICAgICAgaGF2ZS0tO1xuICAgICAgICAgICAgaG9sZCArPSBpbnB1dFtuZXh0KytdIDw8IGJpdHM7XG4gICAgICAgICAgICBiaXRzICs9IDg7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vPT09Ly9cbiAgICAgICAgICBzdGF0ZS5vZmZzZXQgKz0gaG9sZCAmICgoMSA8PCBzdGF0ZS5leHRyYSkgLSAxKS8qQklUUyhzdGF0ZS5leHRyYSkqLztcbiAgICAgICAgICAvLy0tLSBEUk9QQklUUyhzdGF0ZS5leHRyYSkgLS0tLy9cbiAgICAgICAgICBob2xkID4+Pj0gc3RhdGUuZXh0cmE7XG4gICAgICAgICAgYml0cyAtPSBzdGF0ZS5leHRyYTtcbiAgICAgICAgICAvLy0tLS8vXG4gICAgICAgICAgc3RhdGUuYmFjayArPSBzdGF0ZS5leHRyYTtcbiAgICAgICAgfVxuLy8jaWZkZWYgSU5GTEFURV9TVFJJQ1RcbiAgICAgICAgaWYgKHN0YXRlLm9mZnNldCA+IHN0YXRlLmRtYXgpIHtcbiAgICAgICAgICBzdHJtLm1zZyA9ICdpbnZhbGlkIGRpc3RhbmNlIHRvbyBmYXIgYmFjayc7XG4gICAgICAgICAgc3RhdGUubW9kZSA9IEJBRDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuLy8jZW5kaWZcbiAgICAgICAgLy9UcmFjZXZ2KChzdGRlcnIsIFwiaW5mbGF0ZTogICAgICAgICBkaXN0YW5jZSAldVxcblwiLCBzdGF0ZS5vZmZzZXQpKTtcbiAgICAgICAgc3RhdGUubW9kZSA9IE1BVENIO1xuICAgICAgICAvKiBmYWxscyB0aHJvdWdoICovXG4gICAgICBjYXNlIE1BVENIOlxuICAgICAgICBpZiAobGVmdCA9PT0gMCkgeyBicmVhayBpbmZfbGVhdmU7IH1cbiAgICAgICAgY29weSA9IF9vdXQgLSBsZWZ0O1xuICAgICAgICBpZiAoc3RhdGUub2Zmc2V0ID4gY29weSkgeyAgICAgICAgIC8qIGNvcHkgZnJvbSB3aW5kb3cgKi9cbiAgICAgICAgICBjb3B5ID0gc3RhdGUub2Zmc2V0IC0gY29weTtcbiAgICAgICAgICBpZiAoY29weSA+IHN0YXRlLndoYXZlKSB7XG4gICAgICAgICAgICBpZiAoc3RhdGUuc2FuZSkge1xuICAgICAgICAgICAgICBzdHJtLm1zZyA9ICdpbnZhbGlkIGRpc3RhbmNlIHRvbyBmYXIgYmFjayc7XG4gICAgICAgICAgICAgIHN0YXRlLm1vZGUgPSBCQUQ7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuLy8gKCEpIFRoaXMgYmxvY2sgaXMgZGlzYWJsZWQgaW4gemxpYiBkZWZhdWx0cyxcbi8vIGRvbid0IGVuYWJsZSBpdCBmb3IgYmluYXJ5IGNvbXBhdGliaWxpdHlcbi8vI2lmZGVmIElORkxBVEVfQUxMT1dfSU5WQUxJRF9ESVNUQU5DRV9UT09GQVJfQVJSUlxuLy8gICAgICAgICAgVHJhY2UoKHN0ZGVyciwgXCJpbmZsYXRlLmMgdG9vIGZhclxcblwiKSk7XG4vLyAgICAgICAgICBjb3B5IC09IHN0YXRlLndoYXZlO1xuLy8gICAgICAgICAgaWYgKGNvcHkgPiBzdGF0ZS5sZW5ndGgpIHsgY29weSA9IHN0YXRlLmxlbmd0aDsgfVxuLy8gICAgICAgICAgaWYgKGNvcHkgPiBsZWZ0KSB7IGNvcHkgPSBsZWZ0OyB9XG4vLyAgICAgICAgICBsZWZ0IC09IGNvcHk7XG4vLyAgICAgICAgICBzdGF0ZS5sZW5ndGggLT0gY29weTtcbi8vICAgICAgICAgIGRvIHtcbi8vICAgICAgICAgICAgb3V0cHV0W3B1dCsrXSA9IDA7XG4vLyAgICAgICAgICB9IHdoaWxlICgtLWNvcHkpO1xuLy8gICAgICAgICAgaWYgKHN0YXRlLmxlbmd0aCA9PT0gMCkgeyBzdGF0ZS5tb2RlID0gTEVOOyB9XG4vLyAgICAgICAgICBicmVhaztcbi8vI2VuZGlmXG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChjb3B5ID4gc3RhdGUud25leHQpIHtcbiAgICAgICAgICAgIGNvcHkgLT0gc3RhdGUud25leHQ7XG4gICAgICAgICAgICBmcm9tID0gc3RhdGUud3NpemUgLSBjb3B5O1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGZyb20gPSBzdGF0ZS53bmV4dCAtIGNvcHk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChjb3B5ID4gc3RhdGUubGVuZ3RoKSB7IGNvcHkgPSBzdGF0ZS5sZW5ndGg7IH1cbiAgICAgICAgICBmcm9tX3NvdXJjZSA9IHN0YXRlLndpbmRvdztcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvKiBjb3B5IGZyb20gb3V0cHV0ICovXG4gICAgICAgICAgZnJvbV9zb3VyY2UgPSBvdXRwdXQ7XG4gICAgICAgICAgZnJvbSA9IHB1dCAtIHN0YXRlLm9mZnNldDtcbiAgICAgICAgICBjb3B5ID0gc3RhdGUubGVuZ3RoO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjb3B5ID4gbGVmdCkgeyBjb3B5ID0gbGVmdDsgfVxuICAgICAgICBsZWZ0IC09IGNvcHk7XG4gICAgICAgIHN0YXRlLmxlbmd0aCAtPSBjb3B5O1xuICAgICAgICBkbyB7XG4gICAgICAgICAgb3V0cHV0W3B1dCsrXSA9IGZyb21fc291cmNlW2Zyb20rK107XG4gICAgICAgIH0gd2hpbGUgKC0tY29weSk7XG4gICAgICAgIGlmIChzdGF0ZS5sZW5ndGggPT09IDApIHsgc3RhdGUubW9kZSA9IExFTjsgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgTElUOlxuICAgICAgICBpZiAobGVmdCA9PT0gMCkgeyBicmVhayBpbmZfbGVhdmU7IH1cbiAgICAgICAgb3V0cHV0W3B1dCsrXSA9IHN0YXRlLmxlbmd0aDtcbiAgICAgICAgbGVmdC0tO1xuICAgICAgICBzdGF0ZS5tb2RlID0gTEVOO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgQ0hFQ0s6XG4gICAgICAgIGlmIChzdGF0ZS53cmFwKSB7XG4gICAgICAgICAgLy89PT0gTkVFREJJVFMoMzIpO1xuICAgICAgICAgIHdoaWxlIChiaXRzIDwgMzIpIHtcbiAgICAgICAgICAgIGlmIChoYXZlID09PSAwKSB7IGJyZWFrIGluZl9sZWF2ZTsgfVxuICAgICAgICAgICAgaGF2ZS0tO1xuICAgICAgICAgICAgLy8gVXNlICd8JyBpbnN0ZWFkIG9mICcrJyB0byBtYWtlIHN1cmUgdGhhdCByZXN1bHQgaXMgc2lnbmVkXG4gICAgICAgICAgICBob2xkIHw9IGlucHV0W25leHQrK10gPDwgYml0cztcbiAgICAgICAgICAgIGJpdHMgKz0gODtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy89PT0vL1xuICAgICAgICAgIF9vdXQgLT0gbGVmdDtcbiAgICAgICAgICBzdHJtLnRvdGFsX291dCArPSBfb3V0O1xuICAgICAgICAgIHN0YXRlLnRvdGFsICs9IF9vdXQ7XG4gICAgICAgICAgaWYgKChzdGF0ZS53cmFwICYgNCkgJiYgX291dCkge1xuICAgICAgICAgICAgc3RybS5hZGxlciA9IHN0YXRlLmNoZWNrID1cbiAgICAgICAgICAgICAgICAvKlVQREFURV9DSEVDSyhzdGF0ZS5jaGVjaywgcHV0IC0gX291dCwgX291dCk7Ki9cbiAgICAgICAgICAgICAgICAoc3RhdGUuZmxhZ3MgPyBjcmMzMl8xKHN0YXRlLmNoZWNrLCBvdXRwdXQsIF9vdXQsIHB1dCAtIF9vdXQpIDogYWRsZXIzMl8xKHN0YXRlLmNoZWNrLCBvdXRwdXQsIF9vdXQsIHB1dCAtIF9vdXQpKTtcblxuICAgICAgICAgIH1cbiAgICAgICAgICBfb3V0ID0gbGVmdDtcbiAgICAgICAgICAvLyBOQjogY3JjMzIgc3RvcmVkIGFzIHNpZ25lZCAzMi1iaXQgaW50LCB6c3dhcDMyIHJldHVybnMgc2lnbmVkIHRvb1xuICAgICAgICAgIGlmICgoc3RhdGUud3JhcCAmIDQpICYmIChzdGF0ZS5mbGFncyA/IGhvbGQgOiB6c3dhcDMyKGhvbGQpKSAhPT0gc3RhdGUuY2hlY2spIHtcbiAgICAgICAgICAgIHN0cm0ubXNnID0gJ2luY29ycmVjdCBkYXRhIGNoZWNrJztcbiAgICAgICAgICAgIHN0YXRlLm1vZGUgPSBCQUQ7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgICAgLy89PT0gSU5JVEJJVFMoKTtcbiAgICAgICAgICBob2xkID0gMDtcbiAgICAgICAgICBiaXRzID0gMDtcbiAgICAgICAgICAvLz09PS8vXG4gICAgICAgICAgLy9UcmFjZXYoKHN0ZGVyciwgXCJpbmZsYXRlOiAgIGNoZWNrIG1hdGNoZXMgdHJhaWxlclxcblwiKSk7XG4gICAgICAgIH1cbiAgICAgICAgc3RhdGUubW9kZSA9IExFTkdUSDtcbiAgICAgICAgLyogZmFsbHMgdGhyb3VnaCAqL1xuICAgICAgY2FzZSBMRU5HVEg6XG4gICAgICAgIGlmIChzdGF0ZS53cmFwICYmIHN0YXRlLmZsYWdzKSB7XG4gICAgICAgICAgLy89PT0gTkVFREJJVFMoMzIpO1xuICAgICAgICAgIHdoaWxlIChiaXRzIDwgMzIpIHtcbiAgICAgICAgICAgIGlmIChoYXZlID09PSAwKSB7IGJyZWFrIGluZl9sZWF2ZTsgfVxuICAgICAgICAgICAgaGF2ZS0tO1xuICAgICAgICAgICAgaG9sZCArPSBpbnB1dFtuZXh0KytdIDw8IGJpdHM7XG4gICAgICAgICAgICBiaXRzICs9IDg7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vPT09Ly9cbiAgICAgICAgICBpZiAoKHN0YXRlLndyYXAgJiA0KSAmJiBob2xkICE9PSAoc3RhdGUudG90YWwgJiAweGZmZmZmZmZmKSkge1xuICAgICAgICAgICAgc3RybS5tc2cgPSAnaW5jb3JyZWN0IGxlbmd0aCBjaGVjayc7XG4gICAgICAgICAgICBzdGF0ZS5tb2RlID0gQkFEO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vPT09IElOSVRCSVRTKCk7XG4gICAgICAgICAgaG9sZCA9IDA7XG4gICAgICAgICAgYml0cyA9IDA7XG4gICAgICAgICAgLy89PT0vL1xuICAgICAgICAgIC8vVHJhY2V2KChzdGRlcnIsIFwiaW5mbGF0ZTogICBsZW5ndGggbWF0Y2hlcyB0cmFpbGVyXFxuXCIpKTtcbiAgICAgICAgfVxuICAgICAgICBzdGF0ZS5tb2RlID0gRE9ORTtcbiAgICAgICAgLyogZmFsbHMgdGhyb3VnaCAqL1xuICAgICAgY2FzZSBET05FOlxuICAgICAgICByZXQgPSBaX1NUUkVBTV9FTkQkMTtcbiAgICAgICAgYnJlYWsgaW5mX2xlYXZlO1xuICAgICAgY2FzZSBCQUQ6XG4gICAgICAgIHJldCA9IFpfREFUQV9FUlJPUiQxO1xuICAgICAgICBicmVhayBpbmZfbGVhdmU7XG4gICAgICBjYXNlIE1FTTpcbiAgICAgICAgcmV0dXJuIFpfTUVNX0VSUk9SJDE7XG4gICAgICBjYXNlIFNZTkM6XG4gICAgICAgIC8qIGZhbGxzIHRocm91Z2ggKi9cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBaX1NUUkVBTV9FUlJPUiQxO1xuICAgIH1cbiAgfVxuXG4gIC8vIGluZl9sZWF2ZSA8LSBoZXJlIGlzIHJlYWwgcGxhY2UgZm9yIFwiZ290byBpbmZfbGVhdmVcIiwgZW11bGF0ZWQgdmlhIFwiYnJlYWsgaW5mX2xlYXZlXCJcblxuICAvKlxuICAgICBSZXR1cm4gZnJvbSBpbmZsYXRlKCksIHVwZGF0aW5nIHRoZSB0b3RhbCBjb3VudHMgYW5kIHRoZSBjaGVjayB2YWx1ZS5cbiAgICAgSWYgdGhlcmUgd2FzIG5vIHByb2dyZXNzIGR1cmluZyB0aGUgaW5mbGF0ZSgpIGNhbGwsIHJldHVybiBhIGJ1ZmZlclxuICAgICBlcnJvci4gIENhbGwgdXBkYXRld2luZG93KCkgdG8gY3JlYXRlIGFuZC9vciB1cGRhdGUgdGhlIHdpbmRvdyBzdGF0ZS5cbiAgICAgTm90ZTogYSBtZW1vcnkgZXJyb3IgZnJvbSBpbmZsYXRlKCkgaXMgbm9uLXJlY292ZXJhYmxlLlxuICAgKi9cblxuICAvLy0tLSBSRVNUT1JFKCkgLS0tXG4gIHN0cm0ubmV4dF9vdXQgPSBwdXQ7XG4gIHN0cm0uYXZhaWxfb3V0ID0gbGVmdDtcbiAgc3RybS5uZXh0X2luID0gbmV4dDtcbiAgc3RybS5hdmFpbF9pbiA9IGhhdmU7XG4gIHN0YXRlLmhvbGQgPSBob2xkO1xuICBzdGF0ZS5iaXRzID0gYml0cztcbiAgLy8tLS1cblxuICBpZiAoc3RhdGUud3NpemUgfHwgKF9vdXQgIT09IHN0cm0uYXZhaWxfb3V0ICYmIHN0YXRlLm1vZGUgPCBCQUQgJiZcbiAgICAgICAgICAgICAgICAgICAgICAoc3RhdGUubW9kZSA8IENIRUNLIHx8IGZsdXNoICE9PSBaX0ZJTklTSCQxKSkpIHtcbiAgICBpZiAodXBkYXRld2luZG93KHN0cm0sIHN0cm0ub3V0cHV0LCBzdHJtLm5leHRfb3V0LCBfb3V0IC0gc3RybS5hdmFpbF9vdXQpKSA7XG4gIH1cbiAgX2luIC09IHN0cm0uYXZhaWxfaW47XG4gIF9vdXQgLT0gc3RybS5hdmFpbF9vdXQ7XG4gIHN0cm0udG90YWxfaW4gKz0gX2luO1xuICBzdHJtLnRvdGFsX291dCArPSBfb3V0O1xuICBzdGF0ZS50b3RhbCArPSBfb3V0O1xuICBpZiAoKHN0YXRlLndyYXAgJiA0KSAmJiBfb3V0KSB7XG4gICAgc3RybS5hZGxlciA9IHN0YXRlLmNoZWNrID0gLypVUERBVEVfQ0hFQ0soc3RhdGUuY2hlY2ssIHN0cm0ubmV4dF9vdXQgLSBfb3V0LCBfb3V0KTsqL1xuICAgICAgKHN0YXRlLmZsYWdzID8gY3JjMzJfMShzdGF0ZS5jaGVjaywgb3V0cHV0LCBfb3V0LCBzdHJtLm5leHRfb3V0IC0gX291dCkgOiBhZGxlcjMyXzEoc3RhdGUuY2hlY2ssIG91dHB1dCwgX291dCwgc3RybS5uZXh0X291dCAtIF9vdXQpKTtcbiAgfVxuICBzdHJtLmRhdGFfdHlwZSA9IHN0YXRlLmJpdHMgKyAoc3RhdGUubGFzdCA/IDY0IDogMCkgK1xuICAgICAgICAgICAgICAgICAgICAoc3RhdGUubW9kZSA9PT0gVFlQRSA/IDEyOCA6IDApICtcbiAgICAgICAgICAgICAgICAgICAgKHN0YXRlLm1vZGUgPT09IExFTl8gfHwgc3RhdGUubW9kZSA9PT0gQ09QWV8gPyAyNTYgOiAwKTtcbiAgaWYgKCgoX2luID09PSAwICYmIF9vdXQgPT09IDApIHx8IGZsdXNoID09PSBaX0ZJTklTSCQxKSAmJiByZXQgPT09IFpfT0skMSkge1xuICAgIHJldCA9IFpfQlVGX0VSUk9SO1xuICB9XG4gIHJldHVybiByZXQ7XG59O1xuXG5cbmNvbnN0IGluZmxhdGVFbmQgPSAoc3RybSkgPT4ge1xuXG4gIGlmIChpbmZsYXRlU3RhdGVDaGVjayhzdHJtKSkge1xuICAgIHJldHVybiBaX1NUUkVBTV9FUlJPUiQxO1xuICB9XG5cbiAgbGV0IHN0YXRlID0gc3RybS5zdGF0ZTtcbiAgaWYgKHN0YXRlLndpbmRvdykge1xuICAgIHN0YXRlLndpbmRvdyA9IG51bGw7XG4gIH1cbiAgc3RybS5zdGF0ZSA9IG51bGw7XG4gIHJldHVybiBaX09LJDE7XG59O1xuXG5cbmNvbnN0IGluZmxhdGVHZXRIZWFkZXIgPSAoc3RybSwgaGVhZCkgPT4ge1xuXG4gIC8qIGNoZWNrIHN0YXRlICovXG4gIGlmIChpbmZsYXRlU3RhdGVDaGVjayhzdHJtKSkgeyByZXR1cm4gWl9TVFJFQU1fRVJST1IkMTsgfVxuICBjb25zdCBzdGF0ZSA9IHN0cm0uc3RhdGU7XG4gIGlmICgoc3RhdGUud3JhcCAmIDIpID09PSAwKSB7IHJldHVybiBaX1NUUkVBTV9FUlJPUiQxOyB9XG5cbiAgLyogc2F2ZSBoZWFkZXIgc3RydWN0dXJlICovXG4gIHN0YXRlLmhlYWQgPSBoZWFkO1xuICBoZWFkLmRvbmUgPSBmYWxzZTtcbiAgcmV0dXJuIFpfT0skMTtcbn07XG5cblxuY29uc3QgaW5mbGF0ZVNldERpY3Rpb25hcnkgPSAoc3RybSwgZGljdGlvbmFyeSkgPT4ge1xuICBjb25zdCBkaWN0TGVuZ3RoID0gZGljdGlvbmFyeS5sZW5ndGg7XG5cbiAgbGV0IHN0YXRlO1xuICBsZXQgZGljdGlkO1xuICBsZXQgcmV0O1xuXG4gIC8qIGNoZWNrIHN0YXRlICovXG4gIGlmIChpbmZsYXRlU3RhdGVDaGVjayhzdHJtKSkgeyByZXR1cm4gWl9TVFJFQU1fRVJST1IkMTsgfVxuICBzdGF0ZSA9IHN0cm0uc3RhdGU7XG5cbiAgaWYgKHN0YXRlLndyYXAgIT09IDAgJiYgc3RhdGUubW9kZSAhPT0gRElDVCkge1xuICAgIHJldHVybiBaX1NUUkVBTV9FUlJPUiQxO1xuICB9XG5cbiAgLyogY2hlY2sgZm9yIGNvcnJlY3QgZGljdGlvbmFyeSBpZGVudGlmaWVyICovXG4gIGlmIChzdGF0ZS5tb2RlID09PSBESUNUKSB7XG4gICAgZGljdGlkID0gMTsgLyogYWRsZXIzMigwLCBudWxsLCAwKSovXG4gICAgLyogZGljdGlkID0gYWRsZXIzMihkaWN0aWQsIGRpY3Rpb25hcnksIGRpY3RMZW5ndGgpOyAqL1xuICAgIGRpY3RpZCA9IGFkbGVyMzJfMShkaWN0aWQsIGRpY3Rpb25hcnksIGRpY3RMZW5ndGgsIDApO1xuICAgIGlmIChkaWN0aWQgIT09IHN0YXRlLmNoZWNrKSB7XG4gICAgICByZXR1cm4gWl9EQVRBX0VSUk9SJDE7XG4gICAgfVxuICB9XG4gIC8qIGNvcHkgZGljdGlvbmFyeSB0byB3aW5kb3cgdXNpbmcgdXBkYXRld2luZG93KCksIHdoaWNoIHdpbGwgYW1lbmQgdGhlXG4gICBleGlzdGluZyBkaWN0aW9uYXJ5IGlmIGFwcHJvcHJpYXRlICovXG4gIHJldCA9IHVwZGF0ZXdpbmRvdyhzdHJtLCBkaWN0aW9uYXJ5LCBkaWN0TGVuZ3RoLCBkaWN0TGVuZ3RoKTtcbiAgaWYgKHJldCkge1xuICAgIHN0YXRlLm1vZGUgPSBNRU07XG4gICAgcmV0dXJuIFpfTUVNX0VSUk9SJDE7XG4gIH1cbiAgc3RhdGUuaGF2ZWRpY3QgPSAxO1xuICAvLyBUcmFjZXYoKHN0ZGVyciwgXCJpbmZsYXRlOiAgIGRpY3Rpb25hcnkgc2V0XFxuXCIpKTtcbiAgcmV0dXJuIFpfT0skMTtcbn07XG5cblxudmFyIGluZmxhdGVSZXNldF8xID0gaW5mbGF0ZVJlc2V0O1xudmFyIGluZmxhdGVSZXNldDJfMSA9IGluZmxhdGVSZXNldDI7XG52YXIgaW5mbGF0ZVJlc2V0S2VlcF8xID0gaW5mbGF0ZVJlc2V0S2VlcDtcbnZhciBpbmZsYXRlSW5pdF8xID0gaW5mbGF0ZUluaXQ7XG52YXIgaW5mbGF0ZUluaXQyXzEgPSBpbmZsYXRlSW5pdDI7XG52YXIgaW5mbGF0ZV8yJDEgPSBpbmZsYXRlJDI7XG52YXIgaW5mbGF0ZUVuZF8xID0gaW5mbGF0ZUVuZDtcbnZhciBpbmZsYXRlR2V0SGVhZGVyXzEgPSBpbmZsYXRlR2V0SGVhZGVyO1xudmFyIGluZmxhdGVTZXREaWN0aW9uYXJ5XzEgPSBpbmZsYXRlU2V0RGljdGlvbmFyeTtcbnZhciBpbmZsYXRlSW5mbyA9ICdwYWtvIGluZmxhdGUgKGZyb20gTm9kZWNhIHByb2plY3QpJztcblxuLyogTm90IGltcGxlbWVudGVkXG5tb2R1bGUuZXhwb3J0cy5pbmZsYXRlQ29kZXNVc2VkID0gaW5mbGF0ZUNvZGVzVXNlZDtcbm1vZHVsZS5leHBvcnRzLmluZmxhdGVDb3B5ID0gaW5mbGF0ZUNvcHk7XG5tb2R1bGUuZXhwb3J0cy5pbmZsYXRlR2V0RGljdGlvbmFyeSA9IGluZmxhdGVHZXREaWN0aW9uYXJ5O1xubW9kdWxlLmV4cG9ydHMuaW5mbGF0ZU1hcmsgPSBpbmZsYXRlTWFyaztcbm1vZHVsZS5leHBvcnRzLmluZmxhdGVQcmltZSA9IGluZmxhdGVQcmltZTtcbm1vZHVsZS5leHBvcnRzLmluZmxhdGVTeW5jID0gaW5mbGF0ZVN5bmM7XG5tb2R1bGUuZXhwb3J0cy5pbmZsYXRlU3luY1BvaW50ID0gaW5mbGF0ZVN5bmNQb2ludDtcbm1vZHVsZS5leHBvcnRzLmluZmxhdGVVbmRlcm1pbmUgPSBpbmZsYXRlVW5kZXJtaW5lO1xubW9kdWxlLmV4cG9ydHMuaW5mbGF0ZVZhbGlkYXRlID0gaW5mbGF0ZVZhbGlkYXRlO1xuKi9cblxudmFyIGluZmxhdGVfMSQyID0ge1xuXHRpbmZsYXRlUmVzZXQ6IGluZmxhdGVSZXNldF8xLFxuXHRpbmZsYXRlUmVzZXQyOiBpbmZsYXRlUmVzZXQyXzEsXG5cdGluZmxhdGVSZXNldEtlZXA6IGluZmxhdGVSZXNldEtlZXBfMSxcblx0aW5mbGF0ZUluaXQ6IGluZmxhdGVJbml0XzEsXG5cdGluZmxhdGVJbml0MjogaW5mbGF0ZUluaXQyXzEsXG5cdGluZmxhdGU6IGluZmxhdGVfMiQxLFxuXHRpbmZsYXRlRW5kOiBpbmZsYXRlRW5kXzEsXG5cdGluZmxhdGVHZXRIZWFkZXI6IGluZmxhdGVHZXRIZWFkZXJfMSxcblx0aW5mbGF0ZVNldERpY3Rpb25hcnk6IGluZmxhdGVTZXREaWN0aW9uYXJ5XzEsXG5cdGluZmxhdGVJbmZvOiBpbmZsYXRlSW5mb1xufTtcblxuLy8gKEMpIDE5OTUtMjAxMyBKZWFuLWxvdXAgR2FpbGx5IGFuZCBNYXJrIEFkbGVyXG4vLyAoQykgMjAxNC0yMDE3IFZpdGFseSBQdXpyaW4gYW5kIEFuZHJleSBUdXBpdHNpblxuLy9cbi8vIFRoaXMgc29mdHdhcmUgaXMgcHJvdmlkZWQgJ2FzLWlzJywgd2l0aG91dCBhbnkgZXhwcmVzcyBvciBpbXBsaWVkXG4vLyB3YXJyYW50eS4gSW4gbm8gZXZlbnQgd2lsbCB0aGUgYXV0aG9ycyBiZSBoZWxkIGxpYWJsZSBmb3IgYW55IGRhbWFnZXNcbi8vIGFyaXNpbmcgZnJvbSB0aGUgdXNlIG9mIHRoaXMgc29mdHdhcmUuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBncmFudGVkIHRvIGFueW9uZSB0byB1c2UgdGhpcyBzb2Z0d2FyZSBmb3IgYW55IHB1cnBvc2UsXG4vLyBpbmNsdWRpbmcgY29tbWVyY2lhbCBhcHBsaWNhdGlvbnMsIGFuZCB0byBhbHRlciBpdCBhbmQgcmVkaXN0cmlidXRlIGl0XG4vLyBmcmVlbHksIHN1YmplY3QgdG8gdGhlIGZvbGxvd2luZyByZXN0cmljdGlvbnM6XG4vL1xuLy8gMS4gVGhlIG9yaWdpbiBvZiB0aGlzIHNvZnR3YXJlIG11c3Qgbm90IGJlIG1pc3JlcHJlc2VudGVkOyB5b3UgbXVzdCBub3Rcbi8vICAgY2xhaW0gdGhhdCB5b3Ugd3JvdGUgdGhlIG9yaWdpbmFsIHNvZnR3YXJlLiBJZiB5b3UgdXNlIHRoaXMgc29mdHdhcmVcbi8vICAgaW4gYSBwcm9kdWN0LCBhbiBhY2tub3dsZWRnbWVudCBpbiB0aGUgcHJvZHVjdCBkb2N1bWVudGF0aW9uIHdvdWxkIGJlXG4vLyAgIGFwcHJlY2lhdGVkIGJ1dCBpcyBub3QgcmVxdWlyZWQuXG4vLyAyLiBBbHRlcmVkIHNvdXJjZSB2ZXJzaW9ucyBtdXN0IGJlIHBsYWlubHkgbWFya2VkIGFzIHN1Y2gsIGFuZCBtdXN0IG5vdCBiZVxuLy8gICBtaXNyZXByZXNlbnRlZCBhcyBiZWluZyB0aGUgb3JpZ2luYWwgc29mdHdhcmUuXG4vLyAzLiBUaGlzIG5vdGljZSBtYXkgbm90IGJlIHJlbW92ZWQgb3IgYWx0ZXJlZCBmcm9tIGFueSBzb3VyY2UgZGlzdHJpYnV0aW9uLlxuXG5mdW5jdGlvbiBHWmhlYWRlcigpIHtcbiAgLyogdHJ1ZSBpZiBjb21wcmVzc2VkIGRhdGEgYmVsaWV2ZWQgdG8gYmUgdGV4dCAqL1xuICB0aGlzLnRleHQgICAgICAgPSAwO1xuICAvKiBtb2RpZmljYXRpb24gdGltZSAqL1xuICB0aGlzLnRpbWUgICAgICAgPSAwO1xuICAvKiBleHRyYSBmbGFncyAobm90IHVzZWQgd2hlbiB3cml0aW5nIGEgZ3ppcCBmaWxlKSAqL1xuICB0aGlzLnhmbGFncyAgICAgPSAwO1xuICAvKiBvcGVyYXRpbmcgc3lzdGVtICovXG4gIHRoaXMub3MgICAgICAgICA9IDA7XG4gIC8qIHBvaW50ZXIgdG8gZXh0cmEgZmllbGQgb3IgWl9OVUxMIGlmIG5vbmUgKi9cbiAgdGhpcy5leHRyYSAgICAgID0gbnVsbDtcbiAgLyogZXh0cmEgZmllbGQgbGVuZ3RoICh2YWxpZCBpZiBleHRyYSAhPSBaX05VTEwpICovXG4gIHRoaXMuZXh0cmFfbGVuICA9IDA7IC8vIEFjdHVhbGx5LCB3ZSBkb24ndCBuZWVkIGl0IGluIEpTLFxuICAgICAgICAgICAgICAgICAgICAgICAvLyBidXQgbGVhdmUgZm9yIGZldyBjb2RlIG1vZGlmaWNhdGlvbnNcblxuICAvL1xuICAvLyBTZXR1cCBsaW1pdHMgaXMgbm90IG5lY2Vzc2FyeSBiZWNhdXNlIGluIGpzIHdlIHNob3VsZCBub3QgcHJlYWxsb2NhdGUgbWVtb3J5XG4gIC8vIGZvciBpbmZsYXRlIHVzZSBjb25zdGFudCBsaW1pdCBpbiA2NTUzNiBieXRlc1xuICAvL1xuXG4gIC8qIHNwYWNlIGF0IGV4dHJhIChvbmx5IHdoZW4gcmVhZGluZyBoZWFkZXIpICovXG4gIC8vIHRoaXMuZXh0cmFfbWF4ICA9IDA7XG4gIC8qIHBvaW50ZXIgdG8gemVyby10ZXJtaW5hdGVkIGZpbGUgbmFtZSBvciBaX05VTEwgKi9cbiAgdGhpcy5uYW1lICAgICAgID0gJyc7XG4gIC8qIHNwYWNlIGF0IG5hbWUgKG9ubHkgd2hlbiByZWFkaW5nIGhlYWRlcikgKi9cbiAgLy8gdGhpcy5uYW1lX21heCAgID0gMDtcbiAgLyogcG9pbnRlciB0byB6ZXJvLXRlcm1pbmF0ZWQgY29tbWVudCBvciBaX05VTEwgKi9cbiAgdGhpcy5jb21tZW50ICAgID0gJyc7XG4gIC8qIHNwYWNlIGF0IGNvbW1lbnQgKG9ubHkgd2hlbiByZWFkaW5nIGhlYWRlcikgKi9cbiAgLy8gdGhpcy5jb21tX21heCAgID0gMDtcbiAgLyogdHJ1ZSBpZiB0aGVyZSB3YXMgb3Igd2lsbCBiZSBhIGhlYWRlciBjcmMgKi9cbiAgdGhpcy5oY3JjICAgICAgID0gMDtcbiAgLyogdHJ1ZSB3aGVuIGRvbmUgcmVhZGluZyBnemlwIGhlYWRlciAobm90IHVzZWQgd2hlbiB3cml0aW5nIGEgZ3ppcCBmaWxlKSAqL1xuICB0aGlzLmRvbmUgICAgICAgPSBmYWxzZTtcbn1cblxudmFyIGd6aGVhZGVyID0gR1poZWFkZXI7XG5cbmNvbnN0IHRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcblxuLyogUHVibGljIGNvbnN0YW50cyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Ki9cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSovXG5cbmNvbnN0IHtcbiAgWl9OT19GTFVTSCwgWl9GSU5JU0gsXG4gIFpfT0ssIFpfU1RSRUFNX0VORCwgWl9ORUVEX0RJQ1QsIFpfU1RSRUFNX0VSUk9SLCBaX0RBVEFfRVJST1IsIFpfTUVNX0VSUk9SXG59ID0gY29uc3RhbnRzJDI7XG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSovXG5cblxuLyoqXG4gKiBjbGFzcyBJbmZsYXRlXG4gKlxuICogR2VuZXJpYyBKUy1zdHlsZSB3cmFwcGVyIGZvciB6bGliIGNhbGxzLiBJZiB5b3UgZG9uJ3QgbmVlZFxuICogc3RyZWFtaW5nIGJlaGF2aW91ciAtIHVzZSBtb3JlIHNpbXBsZSBmdW5jdGlvbnM6IFtbaW5mbGF0ZV1dXG4gKiBhbmQgW1tpbmZsYXRlUmF3XV0uXG4gKiovXG5cbi8qIGludGVybmFsXG4gKiBpbmZsYXRlLmNodW5rcyAtPiBBcnJheVxuICpcbiAqIENodW5rcyBvZiBvdXRwdXQgZGF0YSwgaWYgW1tJbmZsYXRlI29uRGF0YV1dIG5vdCBvdmVycmlkZGVuLlxuICoqL1xuXG4vKipcbiAqIEluZmxhdGUucmVzdWx0IC0+IFVpbnQ4QXJyYXl8U3RyaW5nXG4gKlxuICogVW5jb21wcmVzc2VkIHJlc3VsdCwgZ2VuZXJhdGVkIGJ5IGRlZmF1bHQgW1tJbmZsYXRlI29uRGF0YV1dXG4gKiBhbmQgW1tJbmZsYXRlI29uRW5kXV0gaGFuZGxlcnMuIEZpbGxlZCBhZnRlciB5b3UgcHVzaCBsYXN0IGNodW5rXG4gKiAoY2FsbCBbW0luZmxhdGUjcHVzaF1dIHdpdGggYFpfRklOSVNIYCAvIGB0cnVlYCBwYXJhbSkuXG4gKiovXG5cbi8qKlxuICogSW5mbGF0ZS5lcnIgLT4gTnVtYmVyXG4gKlxuICogRXJyb3IgY29kZSBhZnRlciBpbmZsYXRlIGZpbmlzaGVkLiAwIChaX09LKSBvbiBzdWNjZXNzLlxuICogU2hvdWxkIGJlIGNoZWNrZWQgaWYgYnJva2VuIGRhdGEgcG9zc2libGUuXG4gKiovXG5cbi8qKlxuICogSW5mbGF0ZS5tc2cgLT4gU3RyaW5nXG4gKlxuICogRXJyb3IgbWVzc2FnZSwgaWYgW1tJbmZsYXRlLmVycl1dICE9IDBcbiAqKi9cblxuXG4vKipcbiAqIG5ldyBJbmZsYXRlKG9wdGlvbnMpXG4gKiAtIG9wdGlvbnMgKE9iamVjdCk6IHpsaWIgaW5mbGF0ZSBvcHRpb25zLlxuICpcbiAqIENyZWF0ZXMgbmV3IGluZmxhdG9yIGluc3RhbmNlIHdpdGggc3BlY2lmaWVkIHBhcmFtcy4gVGhyb3dzIGV4Y2VwdGlvblxuICogb24gYmFkIHBhcmFtcy4gU3VwcG9ydGVkIG9wdGlvbnM6XG4gKlxuICogLSBgd2luZG93Qml0c2BcbiAqIC0gYGRpY3Rpb25hcnlgXG4gKlxuICogW2h0dHA6Ly96bGliLm5ldC9tYW51YWwuaHRtbCNBZHZhbmNlZF0oaHR0cDovL3psaWIubmV0L21hbnVhbC5odG1sI0FkdmFuY2VkKVxuICogZm9yIG1vcmUgaW5mb3JtYXRpb24gb24gdGhlc2UuXG4gKlxuICogQWRkaXRpb25hbCBvcHRpb25zLCBmb3IgaW50ZXJuYWwgbmVlZHM6XG4gKlxuICogLSBgY2h1bmtTaXplYCAtIHNpemUgb2YgZ2VuZXJhdGVkIGRhdGEgY2h1bmtzICgxNksgYnkgZGVmYXVsdClcbiAqIC0gYHJhd2AgKEJvb2xlYW4pIC0gZG8gcmF3IGluZmxhdGVcbiAqIC0gYHRvYCAoU3RyaW5nKSAtIGlmIGVxdWFsIHRvICdzdHJpbmcnLCB0aGVuIHJlc3VsdCB3aWxsIGJlIGNvbnZlcnRlZFxuICogICBmcm9tIHV0ZjggdG8gdXRmMTYgKGphdmFzY3JpcHQpIHN0cmluZy4gV2hlbiBzdHJpbmcgb3V0cHV0IHJlcXVlc3RlZCxcbiAqICAgY2h1bmsgbGVuZ3RoIGNhbiBkaWZmZXIgZnJvbSBgY2h1bmtTaXplYCwgZGVwZW5kaW5nIG9uIGNvbnRlbnQuXG4gKlxuICogQnkgZGVmYXVsdCwgd2hlbiBubyBvcHRpb25zIHNldCwgYXV0b2RldGVjdCBkZWZsYXRlL2d6aXAgZGF0YSBmb3JtYXQgdmlhXG4gKiB3cmFwcGVyIGhlYWRlci5cbiAqXG4gKiAjIyMjIyBFeGFtcGxlOlxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqIGNvbnN0IHBha28gPSByZXF1aXJlKCdwYWtvJylcbiAqIGNvbnN0IGNodW5rMSA9IG5ldyBVaW50OEFycmF5KFsxLDIsMyw0LDUsNiw3LDgsOV0pXG4gKiBjb25zdCBjaHVuazIgPSBuZXcgVWludDhBcnJheShbMTAsMTEsMTIsMTMsMTQsMTUsMTYsMTcsMTgsMTldKTtcbiAqXG4gKiBjb25zdCBpbmZsYXRlID0gbmV3IHBha28uSW5mbGF0ZSh7IGxldmVsOiAzfSk7XG4gKlxuICogaW5mbGF0ZS5wdXNoKGNodW5rMSwgZmFsc2UpO1xuICogaW5mbGF0ZS5wdXNoKGNodW5rMiwgdHJ1ZSk7ICAvLyB0cnVlIC0+IGxhc3QgY2h1bmtcbiAqXG4gKiBpZiAoaW5mbGF0ZS5lcnIpIHsgdGhyb3cgbmV3IEVycm9yKGluZmxhdGUuZXJyKTsgfVxuICpcbiAqIGNvbnNvbGUubG9nKGluZmxhdGUucmVzdWx0KTtcbiAqIGBgYFxuICoqL1xuZnVuY3Rpb24gSW5mbGF0ZSQxKG9wdGlvbnMpIHtcbiAgdGhpcy5vcHRpb25zID0gY29tbW9uLmFzc2lnbih7XG4gICAgY2h1bmtTaXplOiAxMDI0ICogNjQsXG4gICAgd2luZG93Qml0czogMTUsXG4gICAgdG86ICcnXG4gIH0sIG9wdGlvbnMgfHwge30pO1xuXG4gIGNvbnN0IG9wdCA9IHRoaXMub3B0aW9ucztcblxuICAvLyBGb3JjZSB3aW5kb3cgc2l6ZSBmb3IgYHJhd2AgZGF0YSwgaWYgbm90IHNldCBkaXJlY3RseSxcbiAgLy8gYmVjYXVzZSB3ZSBoYXZlIG5vIGhlYWRlciBmb3IgYXV0b2RldGVjdC5cbiAgaWYgKG9wdC5yYXcgJiYgKG9wdC53aW5kb3dCaXRzID49IDApICYmIChvcHQud2luZG93Qml0cyA8IDE2KSkge1xuICAgIG9wdC53aW5kb3dCaXRzID0gLW9wdC53aW5kb3dCaXRzO1xuICAgIGlmIChvcHQud2luZG93Qml0cyA9PT0gMCkgeyBvcHQud2luZG93Qml0cyA9IC0xNTsgfVxuICB9XG5cbiAgLy8gSWYgYHdpbmRvd0JpdHNgIG5vdCBkZWZpbmVkIChhbmQgbW9kZSBub3QgcmF3KSAtIHNldCBhdXRvZGV0ZWN0IGZsYWcgZm9yIGd6aXAvZGVmbGF0ZVxuICBpZiAoKG9wdC53aW5kb3dCaXRzID49IDApICYmIChvcHQud2luZG93Qml0cyA8IDE2KSAmJlxuICAgICAgIShvcHRpb25zICYmIG9wdGlvbnMud2luZG93Qml0cykpIHtcbiAgICBvcHQud2luZG93Qml0cyArPSAzMjtcbiAgfVxuXG4gIC8vIEd6aXAgaGVhZGVyIGhhcyBubyBpbmZvIGFib3V0IHdpbmRvd3Mgc2l6ZSwgd2UgY2FuIGRvIGF1dG9kZXRlY3Qgb25seVxuICAvLyBmb3IgZGVmbGF0ZS4gU28sIGlmIHdpbmRvdyBzaXplIG5vdCBzZXQsIGZvcmNlIGl0IHRvIG1heCB3aGVuIGd6aXAgcG9zc2libGVcbiAgaWYgKChvcHQud2luZG93Qml0cyA+IDE1KSAmJiAob3B0LndpbmRvd0JpdHMgPCA0OCkpIHtcbiAgICAvLyBiaXQgMyAoMTYpIC0+IGd6aXBwZWQgZGF0YVxuICAgIC8vIGJpdCA0ICgzMikgLT4gYXV0b2RldGVjdCBnemlwL2RlZmxhdGVcbiAgICBpZiAoKG9wdC53aW5kb3dCaXRzICYgMTUpID09PSAwKSB7XG4gICAgICBvcHQud2luZG93Qml0cyB8PSAxNTtcbiAgICB9XG4gIH1cblxuICB0aGlzLmVyciAgICA9IDA7ICAgICAgLy8gZXJyb3IgY29kZSwgaWYgaGFwcGVucyAoMCA9IFpfT0spXG4gIHRoaXMubXNnICAgID0gJyc7ICAgICAvLyBlcnJvciBtZXNzYWdlXG4gIHRoaXMuZW5kZWQgID0gZmFsc2U7ICAvLyB1c2VkIHRvIGF2b2lkIG11bHRpcGxlIG9uRW5kKCkgY2FsbHNcbiAgdGhpcy5jaHVua3MgPSBbXTsgICAgIC8vIGNodW5rcyBvZiBjb21wcmVzc2VkIGRhdGFcblxuICB0aGlzLnN0cm0gICA9IG5ldyB6c3RyZWFtKCk7XG4gIHRoaXMuc3RybS5hdmFpbF9vdXQgPSAwO1xuXG4gIGxldCBzdGF0dXMgID0gaW5mbGF0ZV8xJDIuaW5mbGF0ZUluaXQyKFxuICAgIHRoaXMuc3RybSxcbiAgICBvcHQud2luZG93Qml0c1xuICApO1xuXG4gIGlmIChzdGF0dXMgIT09IFpfT0spIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IobWVzc2FnZXNbc3RhdHVzXSk7XG4gIH1cblxuICB0aGlzLmhlYWRlciA9IG5ldyBnemhlYWRlcigpO1xuXG4gIGluZmxhdGVfMSQyLmluZmxhdGVHZXRIZWFkZXIodGhpcy5zdHJtLCB0aGlzLmhlYWRlcik7XG5cbiAgLy8gU2V0dXAgZGljdGlvbmFyeVxuICBpZiAob3B0LmRpY3Rpb25hcnkpIHtcbiAgICAvLyBDb252ZXJ0IGRhdGEgaWYgbmVlZGVkXG4gICAgaWYgKHR5cGVvZiBvcHQuZGljdGlvbmFyeSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIG9wdC5kaWN0aW9uYXJ5ID0gc3RyaW5ncy5zdHJpbmcyYnVmKG9wdC5kaWN0aW9uYXJ5KTtcbiAgICB9IGVsc2UgaWYgKHRvU3RyaW5nLmNhbGwob3B0LmRpY3Rpb25hcnkpID09PSAnW29iamVjdCBBcnJheUJ1ZmZlcl0nKSB7XG4gICAgICBvcHQuZGljdGlvbmFyeSA9IG5ldyBVaW50OEFycmF5KG9wdC5kaWN0aW9uYXJ5KTtcbiAgICB9XG4gICAgaWYgKG9wdC5yYXcpIHsgLy9JbiByYXcgbW9kZSB3ZSBuZWVkIHRvIHNldCB0aGUgZGljdGlvbmFyeSBlYXJseVxuICAgICAgc3RhdHVzID0gaW5mbGF0ZV8xJDIuaW5mbGF0ZVNldERpY3Rpb25hcnkodGhpcy5zdHJtLCBvcHQuZGljdGlvbmFyeSk7XG4gICAgICBpZiAoc3RhdHVzICE9PSBaX09LKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihtZXNzYWdlc1tzdGF0dXNdKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBJbmZsYXRlI3B1c2goZGF0YVssIGZsdXNoX21vZGVdKSAtPiBCb29sZWFuXG4gKiAtIGRhdGEgKFVpbnQ4QXJyYXl8QXJyYXlCdWZmZXIpOiBpbnB1dCBkYXRhXG4gKiAtIGZsdXNoX21vZGUgKE51bWJlcnxCb29sZWFuKTogMC4uNiBmb3IgY29ycmVzcG9uZGluZyBaX05PX0ZMVVNILi5aX1RSRUVcbiAqICAgZmx1c2ggbW9kZXMuIFNlZSBjb25zdGFudHMuIFNraXBwZWQgb3IgYGZhbHNlYCBtZWFucyBaX05PX0ZMVVNILFxuICogICBgdHJ1ZWAgbWVhbnMgWl9GSU5JU0guXG4gKlxuICogU2VuZHMgaW5wdXQgZGF0YSB0byBpbmZsYXRlIHBpcGUsIGdlbmVyYXRpbmcgW1tJbmZsYXRlI29uRGF0YV1dIGNhbGxzIHdpdGhcbiAqIG5ldyBvdXRwdXQgY2h1bmtzLiBSZXR1cm5zIGB0cnVlYCBvbiBzdWNjZXNzLiBJZiBlbmQgb2Ygc3RyZWFtIGRldGVjdGVkLFxuICogW1tJbmZsYXRlI29uRW5kXV0gd2lsbCBiZSBjYWxsZWQuXG4gKlxuICogYGZsdXNoX21vZGVgIGlzIG5vdCBuZWVkZWQgZm9yIG5vcm1hbCBvcGVyYXRpb24sIGJlY2F1c2UgZW5kIG9mIHN0cmVhbVxuICogZGV0ZWN0ZWQgYXV0b21hdGljYWxseS4gWW91IG1heSB0cnkgdG8gdXNlIGl0IGZvciBhZHZhbmNlZCB0aGluZ3MsIGJ1dFxuICogdGhpcyBmdW5jdGlvbmFsaXR5IHdhcyBub3QgdGVzdGVkLlxuICpcbiAqIE9uIGZhaWwgY2FsbCBbW0luZmxhdGUjb25FbmRdXSB3aXRoIGVycm9yIGNvZGUgYW5kIHJldHVybiBmYWxzZS5cbiAqXG4gKiAjIyMjIyBFeGFtcGxlXG4gKlxuICogYGBgamF2YXNjcmlwdFxuICogcHVzaChjaHVuaywgZmFsc2UpOyAvLyBwdXNoIG9uZSBvZiBkYXRhIGNodW5rc1xuICogLi4uXG4gKiBwdXNoKGNodW5rLCB0cnVlKTsgIC8vIHB1c2ggbGFzdCBjaHVua1xuICogYGBgXG4gKiovXG5JbmZsYXRlJDEucHJvdG90eXBlLnB1c2ggPSBmdW5jdGlvbiAoZGF0YSwgZmx1c2hfbW9kZSkge1xuICBjb25zdCBzdHJtID0gdGhpcy5zdHJtO1xuICBjb25zdCBjaHVua1NpemUgPSB0aGlzLm9wdGlvbnMuY2h1bmtTaXplO1xuICBjb25zdCBkaWN0aW9uYXJ5ID0gdGhpcy5vcHRpb25zLmRpY3Rpb25hcnk7XG4gIGxldCBzdGF0dXMsIF9mbHVzaF9tb2RlLCBsYXN0X2F2YWlsX291dDtcblxuICBpZiAodGhpcy5lbmRlZCkgcmV0dXJuIGZhbHNlO1xuXG4gIGlmIChmbHVzaF9tb2RlID09PSB+fmZsdXNoX21vZGUpIF9mbHVzaF9tb2RlID0gZmx1c2hfbW9kZTtcbiAgZWxzZSBfZmx1c2hfbW9kZSA9IGZsdXNoX21vZGUgPT09IHRydWUgPyBaX0ZJTklTSCA6IFpfTk9fRkxVU0g7XG5cbiAgLy8gQ29udmVydCBkYXRhIGlmIG5lZWRlZFxuICBpZiAodG9TdHJpbmcuY2FsbChkYXRhKSA9PT0gJ1tvYmplY3QgQXJyYXlCdWZmZXJdJykge1xuICAgIHN0cm0uaW5wdXQgPSBuZXcgVWludDhBcnJheShkYXRhKTtcbiAgfSBlbHNlIHtcbiAgICBzdHJtLmlucHV0ID0gZGF0YTtcbiAgfVxuXG4gIHN0cm0ubmV4dF9pbiA9IDA7XG4gIHN0cm0uYXZhaWxfaW4gPSBzdHJtLmlucHV0Lmxlbmd0aDtcblxuICBmb3IgKDs7KSB7XG4gICAgaWYgKHN0cm0uYXZhaWxfb3V0ID09PSAwKSB7XG4gICAgICBzdHJtLm91dHB1dCA9IG5ldyBVaW50OEFycmF5KGNodW5rU2l6ZSk7XG4gICAgICBzdHJtLm5leHRfb3V0ID0gMDtcbiAgICAgIHN0cm0uYXZhaWxfb3V0ID0gY2h1bmtTaXplO1xuICAgIH1cblxuICAgIHN0YXR1cyA9IGluZmxhdGVfMSQyLmluZmxhdGUoc3RybSwgX2ZsdXNoX21vZGUpO1xuXG4gICAgaWYgKHN0YXR1cyA9PT0gWl9ORUVEX0RJQ1QgJiYgZGljdGlvbmFyeSkge1xuICAgICAgc3RhdHVzID0gaW5mbGF0ZV8xJDIuaW5mbGF0ZVNldERpY3Rpb25hcnkoc3RybSwgZGljdGlvbmFyeSk7XG5cbiAgICAgIGlmIChzdGF0dXMgPT09IFpfT0spIHtcbiAgICAgICAgc3RhdHVzID0gaW5mbGF0ZV8xJDIuaW5mbGF0ZShzdHJtLCBfZmx1c2hfbW9kZSk7XG4gICAgICB9IGVsc2UgaWYgKHN0YXR1cyA9PT0gWl9EQVRBX0VSUk9SKSB7XG4gICAgICAgIC8vIFJlcGxhY2UgY29kZSB3aXRoIG1vcmUgdmVyYm9zZVxuICAgICAgICBzdGF0dXMgPSBaX05FRURfRElDVDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBTa2lwIHNueWMgbWFya2VycyBpZiBtb3JlIGRhdGEgZm9sbG93cyBhbmQgbm90IHJhdyBtb2RlXG4gICAgd2hpbGUgKHN0cm0uYXZhaWxfaW4gPiAwICYmXG4gICAgICAgICAgIHN0YXR1cyA9PT0gWl9TVFJFQU1fRU5EICYmXG4gICAgICAgICAgIHN0cm0uc3RhdGUud3JhcCA+IDAgJiZcbiAgICAgICAgICAgZGF0YVtzdHJtLm5leHRfaW5dICE9PSAwKVxuICAgIHtcbiAgICAgIGluZmxhdGVfMSQyLmluZmxhdGVSZXNldChzdHJtKTtcbiAgICAgIHN0YXR1cyA9IGluZmxhdGVfMSQyLmluZmxhdGUoc3RybSwgX2ZsdXNoX21vZGUpO1xuICAgIH1cblxuICAgIHN3aXRjaCAoc3RhdHVzKSB7XG4gICAgICBjYXNlIFpfU1RSRUFNX0VSUk9SOlxuICAgICAgY2FzZSBaX0RBVEFfRVJST1I6XG4gICAgICBjYXNlIFpfTkVFRF9ESUNUOlxuICAgICAgY2FzZSBaX01FTV9FUlJPUjpcbiAgICAgICAgdGhpcy5vbkVuZChzdGF0dXMpO1xuICAgICAgICB0aGlzLmVuZGVkID0gdHJ1ZTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8vIFJlbWVtYmVyIHJlYWwgYGF2YWlsX291dGAgdmFsdWUsIGJlY2F1c2Ugd2UgbWF5IHBhdGNoIG91dCBidWZmZXIgY29udGVudFxuICAgIC8vIHRvIGFsaWduIHV0Zjggc3RyaW5ncyBib3VuZGFyaWVzLlxuICAgIGxhc3RfYXZhaWxfb3V0ID0gc3RybS5hdmFpbF9vdXQ7XG5cbiAgICBpZiAoc3RybS5uZXh0X291dCkge1xuICAgICAgaWYgKHN0cm0uYXZhaWxfb3V0ID09PSAwIHx8IHN0YXR1cyA9PT0gWl9TVFJFQU1fRU5EKSB7XG5cbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy50byA9PT0gJ3N0cmluZycpIHtcblxuICAgICAgICAgIGxldCBuZXh0X291dF91dGY4ID0gc3RyaW5ncy51dGY4Ym9yZGVyKHN0cm0ub3V0cHV0LCBzdHJtLm5leHRfb3V0KTtcblxuICAgICAgICAgIGxldCB0YWlsID0gc3RybS5uZXh0X291dCAtIG5leHRfb3V0X3V0Zjg7XG4gICAgICAgICAgbGV0IHV0ZjhzdHIgPSBzdHJpbmdzLmJ1ZjJzdHJpbmcoc3RybS5vdXRwdXQsIG5leHRfb3V0X3V0ZjgpO1xuXG4gICAgICAgICAgLy8gbW92ZSB0YWlsICYgcmVhbGlnbiBjb3VudGVyc1xuICAgICAgICAgIHN0cm0ubmV4dF9vdXQgPSB0YWlsO1xuICAgICAgICAgIHN0cm0uYXZhaWxfb3V0ID0gY2h1bmtTaXplIC0gdGFpbDtcbiAgICAgICAgICBpZiAodGFpbCkgc3RybS5vdXRwdXQuc2V0KHN0cm0ub3V0cHV0LnN1YmFycmF5KG5leHRfb3V0X3V0ZjgsIG5leHRfb3V0X3V0ZjggKyB0YWlsKSwgMCk7XG5cbiAgICAgICAgICB0aGlzLm9uRGF0YSh1dGY4c3RyKTtcblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMub25EYXRhKHN0cm0ub3V0cHV0Lmxlbmd0aCA9PT0gc3RybS5uZXh0X291dCA/IHN0cm0ub3V0cHV0IDogc3RybS5vdXRwdXQuc3ViYXJyYXkoMCwgc3RybS5uZXh0X291dCkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gTXVzdCByZXBlYXQgaXRlcmF0aW9uIGlmIG91dCBidWZmZXIgaXMgZnVsbFxuICAgIGlmIChzdGF0dXMgPT09IFpfT0sgJiYgbGFzdF9hdmFpbF9vdXQgPT09IDApIGNvbnRpbnVlO1xuXG4gICAgLy8gRmluYWxpemUgaWYgZW5kIG9mIHN0cmVhbSByZWFjaGVkLlxuICAgIGlmIChzdGF0dXMgPT09IFpfU1RSRUFNX0VORCkge1xuICAgICAgc3RhdHVzID0gaW5mbGF0ZV8xJDIuaW5mbGF0ZUVuZCh0aGlzLnN0cm0pO1xuICAgICAgdGhpcy5vbkVuZChzdGF0dXMpO1xuICAgICAgdGhpcy5lbmRlZCA9IHRydWU7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAoc3RybS5hdmFpbF9pbiA9PT0gMCkgYnJlYWs7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cblxuLyoqXG4gKiBJbmZsYXRlI29uRGF0YShjaHVuaykgLT4gVm9pZFxuICogLSBjaHVuayAoVWludDhBcnJheXxTdHJpbmcpOiBvdXRwdXQgZGF0YS4gV2hlbiBzdHJpbmcgb3V0cHV0IHJlcXVlc3RlZCxcbiAqICAgZWFjaCBjaHVuayB3aWxsIGJlIHN0cmluZy5cbiAqXG4gKiBCeSBkZWZhdWx0LCBzdG9yZXMgZGF0YSBibG9ja3MgaW4gYGNodW5rc1tdYCBwcm9wZXJ0eSBhbmQgZ2x1ZVxuICogdGhvc2UgaW4gYG9uRW5kYC4gT3ZlcnJpZGUgdGhpcyBoYW5kbGVyLCBpZiB5b3UgbmVlZCBhbm90aGVyIGJlaGF2aW91ci5cbiAqKi9cbkluZmxhdGUkMS5wcm90b3R5cGUub25EYXRhID0gZnVuY3Rpb24gKGNodW5rKSB7XG4gIHRoaXMuY2h1bmtzLnB1c2goY2h1bmspO1xufTtcblxuXG4vKipcbiAqIEluZmxhdGUjb25FbmQoc3RhdHVzKSAtPiBWb2lkXG4gKiAtIHN0YXR1cyAoTnVtYmVyKTogaW5mbGF0ZSBzdGF0dXMuIDAgKFpfT0spIG9uIHN1Y2Nlc3MsXG4gKiAgIG90aGVyIGlmIG5vdC5cbiAqXG4gKiBDYWxsZWQgZWl0aGVyIGFmdGVyIHlvdSB0ZWxsIGluZmxhdGUgdGhhdCB0aGUgaW5wdXQgc3RyZWFtIGlzXG4gKiBjb21wbGV0ZSAoWl9GSU5JU0gpLiBCeSBkZWZhdWx0IC0gam9pbiBjb2xsZWN0ZWQgY2h1bmtzLFxuICogZnJlZSBtZW1vcnkgYW5kIGZpbGwgYHJlc3VsdHNgIC8gYGVycmAgcHJvcGVydGllcy5cbiAqKi9cbkluZmxhdGUkMS5wcm90b3R5cGUub25FbmQgPSBmdW5jdGlvbiAoc3RhdHVzKSB7XG4gIC8vIE9uIHN1Y2Nlc3MgLSBqb2luXG4gIGlmIChzdGF0dXMgPT09IFpfT0spIHtcbiAgICBpZiAodGhpcy5vcHRpb25zLnRvID09PSAnc3RyaW5nJykge1xuICAgICAgdGhpcy5yZXN1bHQgPSB0aGlzLmNodW5rcy5qb2luKCcnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5yZXN1bHQgPSBjb21tb24uZmxhdHRlbkNodW5rcyh0aGlzLmNodW5rcyk7XG4gICAgfVxuICB9XG4gIHRoaXMuY2h1bmtzID0gW107XG4gIHRoaXMuZXJyID0gc3RhdHVzO1xuICB0aGlzLm1zZyA9IHRoaXMuc3RybS5tc2c7XG59O1xuXG5cbi8qKlxuICogaW5mbGF0ZShkYXRhWywgb3B0aW9uc10pIC0+IFVpbnQ4QXJyYXl8U3RyaW5nXG4gKiAtIGRhdGEgKFVpbnQ4QXJyYXl8QXJyYXlCdWZmZXIpOiBpbnB1dCBkYXRhIHRvIGRlY29tcHJlc3MuXG4gKiAtIG9wdGlvbnMgKE9iamVjdCk6IHpsaWIgaW5mbGF0ZSBvcHRpb25zLlxuICpcbiAqIERlY29tcHJlc3MgYGRhdGFgIHdpdGggaW5mbGF0ZS91bmd6aXAgYW5kIGBvcHRpb25zYC4gQXV0b2RldGVjdFxuICogZm9ybWF0IHZpYSB3cmFwcGVyIGhlYWRlciBieSBkZWZhdWx0LiBUaGF0J3Mgd2h5IHdlIGRvbid0IHByb3ZpZGVcbiAqIHNlcGFyYXRlIGB1bmd6aXBgIG1ldGhvZC5cbiAqXG4gKiBTdXBwb3J0ZWQgb3B0aW9ucyBhcmU6XG4gKlxuICogLSB3aW5kb3dCaXRzXG4gKlxuICogW2h0dHA6Ly96bGliLm5ldC9tYW51YWwuaHRtbCNBZHZhbmNlZF0oaHR0cDovL3psaWIubmV0L21hbnVhbC5odG1sI0FkdmFuY2VkKVxuICogZm9yIG1vcmUgaW5mb3JtYXRpb24uXG4gKlxuICogU3VnYXIgKG9wdGlvbnMpOlxuICpcbiAqIC0gYHJhd2AgKEJvb2xlYW4pIC0gc2F5IHRoYXQgd2Ugd29yayB3aXRoIHJhdyBzdHJlYW0sIGlmIHlvdSBkb24ndCB3aXNoIHRvIHNwZWNpZnlcbiAqICAgbmVnYXRpdmUgd2luZG93Qml0cyBpbXBsaWNpdGx5LlxuICogLSBgdG9gIChTdHJpbmcpIC0gaWYgZXF1YWwgdG8gJ3N0cmluZycsIHRoZW4gcmVzdWx0IHdpbGwgYmUgY29udmVydGVkXG4gKiAgIGZyb20gdXRmOCB0byB1dGYxNiAoamF2YXNjcmlwdCkgc3RyaW5nLiBXaGVuIHN0cmluZyBvdXRwdXQgcmVxdWVzdGVkLFxuICogICBjaHVuayBsZW5ndGggY2FuIGRpZmZlciBmcm9tIGBjaHVua1NpemVgLCBkZXBlbmRpbmcgb24gY29udGVudC5cbiAqXG4gKlxuICogIyMjIyMgRXhhbXBsZTpcbiAqXG4gKiBgYGBqYXZhc2NyaXB0XG4gKiBjb25zdCBwYWtvID0gcmVxdWlyZSgncGFrbycpO1xuICogY29uc3QgaW5wdXQgPSBwYWtvLmRlZmxhdGUobmV3IFVpbnQ4QXJyYXkoWzEsMiwzLDQsNSw2LDcsOCw5XSkpO1xuICogbGV0IG91dHB1dDtcbiAqXG4gKiB0cnkge1xuICogICBvdXRwdXQgPSBwYWtvLmluZmxhdGUoaW5wdXQpO1xuICogfSBjYXRjaCAoZXJyKSB7XG4gKiAgIGNvbnNvbGUubG9nKGVycik7XG4gKiB9XG4gKiBgYGBcbiAqKi9cbmZ1bmN0aW9uIGluZmxhdGUkMShpbnB1dCwgb3B0aW9ucykge1xuICBjb25zdCBpbmZsYXRvciA9IG5ldyBJbmZsYXRlJDEob3B0aW9ucyk7XG5cbiAgaW5mbGF0b3IucHVzaChpbnB1dCk7XG5cbiAgLy8gVGhhdCB3aWxsIG5ldmVyIGhhcHBlbnMsIGlmIHlvdSBkb24ndCBjaGVhdCB3aXRoIG9wdGlvbnMgOilcbiAgaWYgKGluZmxhdG9yLmVycikgdGhyb3cgaW5mbGF0b3IubXNnIHx8IG1lc3NhZ2VzW2luZmxhdG9yLmVycl07XG5cbiAgcmV0dXJuIGluZmxhdG9yLnJlc3VsdDtcbn1cblxuXG4vKipcbiAqIGluZmxhdGVSYXcoZGF0YVssIG9wdGlvbnNdKSAtPiBVaW50OEFycmF5fFN0cmluZ1xuICogLSBkYXRhIChVaW50OEFycmF5fEFycmF5QnVmZmVyKTogaW5wdXQgZGF0YSB0byBkZWNvbXByZXNzLlxuICogLSBvcHRpb25zIChPYmplY3QpOiB6bGliIGluZmxhdGUgb3B0aW9ucy5cbiAqXG4gKiBUaGUgc2FtZSBhcyBbW2luZmxhdGVdXSwgYnV0IGNyZWF0ZXMgcmF3IGRhdGEsIHdpdGhvdXQgd3JhcHBlclxuICogKGhlYWRlciBhbmQgYWRsZXIzMiBjcmMpLlxuICoqL1xuZnVuY3Rpb24gaW5mbGF0ZVJhdyQxKGlucHV0LCBvcHRpb25zKSB7XG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICBvcHRpb25zLnJhdyA9IHRydWU7XG4gIHJldHVybiBpbmZsYXRlJDEoaW5wdXQsIG9wdGlvbnMpO1xufVxuXG5cbi8qKlxuICogdW5nemlwKGRhdGFbLCBvcHRpb25zXSkgLT4gVWludDhBcnJheXxTdHJpbmdcbiAqIC0gZGF0YSAoVWludDhBcnJheXxBcnJheUJ1ZmZlcik6IGlucHV0IGRhdGEgdG8gZGVjb21wcmVzcy5cbiAqIC0gb3B0aW9ucyAoT2JqZWN0KTogemxpYiBpbmZsYXRlIG9wdGlvbnMuXG4gKlxuICogSnVzdCBzaG9ydGN1dCB0byBbW2luZmxhdGVdXSwgYmVjYXVzZSBpdCBhdXRvZGV0ZWN0cyBmb3JtYXRcbiAqIGJ5IGhlYWRlci5jb250ZW50LiBEb25lIGZvciBjb252ZW5pZW5jZS5cbiAqKi9cblxuXG52YXIgSW5mbGF0ZV8xJDEgPSBJbmZsYXRlJDE7XG52YXIgaW5mbGF0ZV8yID0gaW5mbGF0ZSQxO1xudmFyIGluZmxhdGVSYXdfMSQxID0gaW5mbGF0ZVJhdyQxO1xudmFyIHVuZ3ppcCQxID0gaW5mbGF0ZSQxO1xudmFyIGNvbnN0YW50cyA9IGNvbnN0YW50cyQyO1xuXG52YXIgaW5mbGF0ZV8xJDEgPSB7XG5cdEluZmxhdGU6IEluZmxhdGVfMSQxLFxuXHRpbmZsYXRlOiBpbmZsYXRlXzIsXG5cdGluZmxhdGVSYXc6IGluZmxhdGVSYXdfMSQxLFxuXHR1bmd6aXA6IHVuZ3ppcCQxLFxuXHRjb25zdGFudHM6IGNvbnN0YW50c1xufTtcblxuY29uc3QgeyBEZWZsYXRlLCBkZWZsYXRlLCBkZWZsYXRlUmF3LCBnemlwIH0gPSBkZWZsYXRlXzEkMTtcblxuY29uc3QgeyBJbmZsYXRlLCBpbmZsYXRlLCBpbmZsYXRlUmF3LCB1bmd6aXAgfSA9IGluZmxhdGVfMSQxO1xuXG5cblxudmFyIERlZmxhdGVfMSA9IERlZmxhdGU7XG52YXIgZGVmbGF0ZV8xID0gZGVmbGF0ZTtcbnZhciBkZWZsYXRlUmF3XzEgPSBkZWZsYXRlUmF3O1xudmFyIGd6aXBfMSA9IGd6aXA7XG52YXIgSW5mbGF0ZV8xID0gSW5mbGF0ZTtcbnZhciBpbmZsYXRlXzEgPSBpbmZsYXRlO1xudmFyIGluZmxhdGVSYXdfMSA9IGluZmxhdGVSYXc7XG52YXIgdW5nemlwXzEgPSB1bmd6aXA7XG52YXIgY29uc3RhbnRzXzEgPSBjb25zdGFudHMkMjtcblxudmFyIHBha28gPSB7XG5cdERlZmxhdGU6IERlZmxhdGVfMSxcblx0ZGVmbGF0ZTogZGVmbGF0ZV8xLFxuXHRkZWZsYXRlUmF3OiBkZWZsYXRlUmF3XzEsXG5cdGd6aXA6IGd6aXBfMSxcblx0SW5mbGF0ZTogSW5mbGF0ZV8xLFxuXHRpbmZsYXRlOiBpbmZsYXRlXzEsXG5cdGluZmxhdGVSYXc6IGluZmxhdGVSYXdfMSxcblx0dW5nemlwOiB1bmd6aXBfMSxcblx0Y29uc3RhbnRzOiBjb25zdGFudHNfMVxufTtcblxuZXhwb3J0IHsgRGVmbGF0ZV8xIGFzIERlZmxhdGUsIEluZmxhdGVfMSBhcyBJbmZsYXRlLCBjb25zdGFudHNfMSBhcyBjb25zdGFudHMsIHBha28gYXMgZGVmYXVsdCwgZGVmbGF0ZV8xIGFzIGRlZmxhdGUsIGRlZmxhdGVSYXdfMSBhcyBkZWZsYXRlUmF3LCBnemlwXzEgYXMgZ3ppcCwgaW5mbGF0ZV8xIGFzIGluZmxhdGUsIGluZmxhdGVSYXdfMSBhcyBpbmZsYXRlUmF3LCB1bmd6aXBfMSBhcyB1bmd6aXAgfTtcbiIsCiAgICAiaW1wb3J0IHBha28gZnJvbSAncGFrbyc7XG5pbXBvcnQgeyBVaW50MzJUb0hleCB9IGZyb20gJy4vZXJpY2NoYXNlL0FsZ29yaXRobS9BcnJheS9VaW50MzJBcnJheS5qcyc7XG5pbXBvcnQgeyBVOENvbmNhdCwgVThGcm9tU3RyaW5nLCBVOEZyb21VaW50MzIsIFU4VGFrZSB9IGZyb20gJy4vZXJpY2NoYXNlL0FsZ29yaXRobS9BcnJheS9VaW50OEFycmF5LmpzJztcbmltcG9ydCB7IENSQyB9IGZyb20gJy4vZXJpY2NoYXNlL0FsZ29yaXRobS9NYXRoL0NSQy5qcyc7XG5pbXBvcnQgeyBDb25zb2xlRXJyb3IgfSBmcm9tICcuL2VyaWNjaGFzZS9VdGlsaXR5L0NvbnNvbGUuanMnO1xuXG5leHBvcnQgY2xhc3MgQ2h1bmsge1xuICByZWFkb25seSBjcmM6IFVpbnQ4QXJyYXk7XG4gIHJlYWRvbmx5IGRhdGE6IFVpbnQ4QXJyYXk7XG4gIHJlYWRvbmx5IHNpemU6IG51bWJlcjtcbiAgcmVhZG9ubHkgdHlwZTogVWludDhBcnJheTtcbiAgY29uc3RydWN0b3IocHVibGljIHJlYWRvbmx5IGJ5dGVzOiBVaW50OEFycmF5KSB7XG4gICAgY29uc3QgeyBjcmMsIGRhdGEsIHNpemUsIHR5cGUgfSA9IGFuYWx5emVDaHVuayhieXRlcyk7XG4gICAgdGhpcy5jcmMgPSBjcmM7XG4gICAgdGhpcy5kYXRhID0gZGF0YTtcbiAgICB0aGlzLnNpemUgPSBzaXplO1xuICAgIHRoaXMudHlwZSA9IHR5cGU7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFuYWx5emVDaHVuayhieXRlczogVWludDhBcnJheSkge1xuICBjb25zdCBzaXplID0gbmV3IERhdGFWaWV3KGJ5dGVzLmJ1ZmZlcikuZ2V0SW50MzIoMCk7XG4gIGNvbnN0IHR5cGUgPSBieXRlcy5zbGljZSg0LCA4KTtcbiAgY29uc3QgW18sIHJlc3RdID0gVThUYWtlKGJ5dGVzLCA4KTtcbiAgY29uc3QgW2RhdGEsIGNyY10gPSBVOFRha2UocmVzdCwgc2l6ZSk7XG4gIHJldHVybiB7IGRhdGEsIHNpemUsIHR5cGUsIGNyYyB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29tcHJlc3NJbWFnZURhdGEoZGF0YTogVWludDhBcnJheSkge1xuICB0cnkge1xuICAgIHJldHVybiBwYWtvLmRlZmxhdGUoZGF0YSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgQ29uc29sZUVycm9yKCdFcnJvciBjb21wcmVzc2luZyBJREFUIGRhdGE6JywgZXJyb3IpO1xuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUlEQVRjaHVuayhkYXRhOiBVaW50OEFycmF5KSB7XG4gIGNvbnN0IHNpemUgPSBVOEZyb21VaW50MzIoZGF0YS5ieXRlTGVuZ3RoKTtcbiAgY29uc3QgdHlwZSA9IFU4RnJvbVN0cmluZygnSURBVCcpO1xuICBjb25zdCBjcmMgPSBVOEZyb21VaW50MzIoZ2V0Q2h1bmtDUkModHlwZSwgZGF0YSkpO1xuICByZXR1cm4gVThDb25jYXQoW3NpemUsIHR5cGUsIGRhdGEsIGNyY10pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlSUhEUmNodW5rKHsgd2lkdGgsIGhlaWdodCwgYml0RGVwdGgsIGNvbG9yVHlwZSwgY29tcHJlc3Npb25NZXRob2QgPSAwLCBmaWx0ZXJNZXRob2QgPSAwLCBpbnRlcmxhY2VNZXRob2QgPSAwIH06IHsgd2lkdGg6IG51bWJlcjsgaGVpZ2h0OiBudW1iZXI7IGJpdERlcHRoOiBudW1iZXI7IGNvbG9yVHlwZTogbnVtYmVyOyBjb21wcmVzc2lvbk1ldGhvZD86IG51bWJlcjsgZmlsdGVyTWV0aG9kPzogbnVtYmVyOyBpbnRlcmxhY2VNZXRob2Q/OiBudW1iZXIgfSkge1xuICAvLyBWYWxpZGF0ZSBpbnB1dCB2YWx1ZXNcbiAgaWYgKGJpdERlcHRoICE9PSAxICYmIGJpdERlcHRoICE9PSAyICYmIGJpdERlcHRoICE9PSA0ICYmIGJpdERlcHRoICE9PSA4ICYmIGJpdERlcHRoICE9PSAxNikge1xuICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBiaXQgZGVwdGguIE11c3QgYmUgb25lIG9mIDEsIDIsIDQsIDgsIG9yIDE2LicpO1xuICB9XG4gIGlmICghWzAsIDIsIDMsIDQsIDZdLmluY2x1ZGVzKGNvbG9yVHlwZSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgY29sb3IgdHlwZS4gTXVzdCBiZSBvbmUgb2YgMCwgMiwgMywgNCwgb3IgNi4nKTtcbiAgfVxuICBpZiAoY29tcHJlc3Npb25NZXRob2QgIT09IDApIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgY29tcHJlc3Npb24gbWV0aG9kLiBPbmx5IG1ldGhvZCAwIGlzIHN1cHBvcnRlZC4nKTtcbiAgfVxuICBpZiAoZmlsdGVyTWV0aG9kICE9PSAwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGZpbHRlciBtZXRob2QuIE9ubHkgbWV0aG9kIDAgaXMgc3VwcG9ydGVkLicpO1xuICB9XG4gIGlmIChpbnRlcmxhY2VNZXRob2QgIT09IDAgJiYgaW50ZXJsYWNlTWV0aG9kICE9PSAxKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGludGVybGFjZSBtZXRob2QuIE11c3QgYmUgZWl0aGVyIDAgKG5vIGludGVybGFjZSkgb3IgMSAoQWRhbTcpLicpO1xuICB9XG5cbiAgLy8gQ3JlYXRlIHRoZSBJSERSIGRhdGEgYXJyYXlcbiAgY29uc3QgaWhkckRhdGEgPSBuZXcgVWludDhBcnJheSgxMyk7XG5cbiAgLy8gV3JpdGUgd2lkdGggKDQgYnl0ZXMsIGJpZy1lbmRpYW4pXG4gIGloZHJEYXRhWzBdID0gKHdpZHRoID4+IDI0KSAmIDB4ZmY7XG4gIGloZHJEYXRhWzFdID0gKHdpZHRoID4+IDE2KSAmIDB4ZmY7XG4gIGloZHJEYXRhWzJdID0gKHdpZHRoID4+IDgpICYgMHhmZjtcbiAgaWhkckRhdGFbM10gPSB3aWR0aCAmIDB4ZmY7XG5cbiAgLy8gV3JpdGUgaGVpZ2h0ICg0IGJ5dGVzLCBiaWctZW5kaWFuKVxuICBpaGRyRGF0YVs0XSA9IChoZWlnaHQgPj4gMjQpICYgMHhmZjtcbiAgaWhkckRhdGFbNV0gPSAoaGVpZ2h0ID4+IDE2KSAmIDB4ZmY7XG4gIGloZHJEYXRhWzZdID0gKGhlaWdodCA+PiA4KSAmIDB4ZmY7XG4gIGloZHJEYXRhWzddID0gaGVpZ2h0ICYgMHhmZjtcblxuICAvLyBXcml0ZSBiaXQgZGVwdGggKDEgYnl0ZSlcbiAgaWhkckRhdGFbOF0gPSBiaXREZXB0aDtcblxuICAvLyBXcml0ZSBjb2xvciB0eXBlICgxIGJ5dGUpXG4gIGloZHJEYXRhWzldID0gY29sb3JUeXBlO1xuXG4gIC8vIFdyaXRlIGNvbXByZXNzaW9uIG1ldGhvZCAoMSBieXRlLCBtdXN0IGJlIDApXG4gIGloZHJEYXRhWzEwXSA9IGNvbXByZXNzaW9uTWV0aG9kO1xuXG4gIC8vIFdyaXRlIGZpbHRlciBtZXRob2QgKDEgYnl0ZSwgbXVzdCBiZSAwKVxuICBpaGRyRGF0YVsxMV0gPSBmaWx0ZXJNZXRob2Q7XG5cbiAgLy8gV3JpdGUgaW50ZXJsYWNlIG1ldGhvZCAoMSBieXRlLCBlaXRoZXIgMCBvciAxKVxuICBpaGRyRGF0YVsxMl0gPSBpbnRlcmxhY2VNZXRob2Q7XG5cbiAgLy8gQ3JlYXRlIHRoZSBJSERSIGNodW5rXG4gIGNvbnN0IGloZHJMZW5ndGggPSBpaGRyRGF0YS5sZW5ndGg7XG4gIGNvbnN0IGloZHJUeXBlID0gbmV3IFRleHRFbmNvZGVyKCkuZW5jb2RlKCdJSERSJyk7XG4gIGNvbnN0IGloZHJDaHVuayA9IG5ldyBVaW50OEFycmF5KDggKyBpaGRyTGVuZ3RoICsgNCk7IC8vIExlbmd0aCwgVHlwZSwgRGF0YSwgQ1JDXG5cbiAgLy8gV3JpdGUgbGVuZ3RoIG9mIElIRFIgZGF0YSAoNCBieXRlcywgYmlnLWVuZGlhbilcbiAgaWhkckNodW5rWzBdID0gKGloZHJMZW5ndGggPj4gMjQpICYgMHhmZjtcbiAgaWhkckNodW5rWzFdID0gKGloZHJMZW5ndGggPj4gMTYpICYgMHhmZjtcbiAgaWhkckNodW5rWzJdID0gKGloZHJMZW5ndGggPj4gOCkgJiAweGZmO1xuICBpaGRyQ2h1bmtbM10gPSBpaGRyTGVuZ3RoICYgMHhmZjtcblxuICAvLyBXcml0ZSBcIklIRFJcIiB0eXBlICg0IGJ5dGVzKVxuICBpaGRyQ2h1bmsuc2V0KGloZHJUeXBlLCA0KTtcblxuICAvLyBXcml0ZSBJSERSIGRhdGEgKDEzIGJ5dGVzKVxuICBpaGRyQ2h1bmsuc2V0KGloZHJEYXRhLCA4KTtcblxuICAvLyBDYWxjdWxhdGUgQ1JDIGZvciBJSERSIGNodW5rIHR5cGUgYW5kIGRhdGFcbiAgY29uc3QgY3JjID0gZ2V0Q2h1bmtDUkMoaWhkclR5cGUsIGloZHJEYXRhKTsgLy8gVXNlIHlvdXIgQ1JDIGNhbGN1bGF0aW9uIGZ1bmN0aW9uXG4gIGloZHJDaHVuay5zZXQobmV3IFVpbnQ4QXJyYXkoWyhjcmMgPj4gMjQpICYgMHhmZiwgKGNyYyA+PiAxNikgJiAweGZmLCAoY3JjID4+IDgpICYgMHhmZiwgY3JjICYgMHhmZl0pLCA4ICsgaWhkckxlbmd0aCk7XG5cbiAgcmV0dXJuIGloZHJDaHVuaztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRlY29tcHJlc3NJbWFnZURhdGEoZGF0YTogVWludDhBcnJheSkge1xuICB0cnkge1xuICAgIHJldHVybiBwYWtvLmluZmxhdGUoZGF0YSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgQ29uc29sZUVycm9yKCdFcnJvciBkZWNvbXByZXNzaW5nIElEQVQgZGF0YTonLCBlcnJvcik7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZXh0cmFjdENodW5rKGJ5dGVzOiBVaW50OEFycmF5KSB7XG4gIGNvbnN0IHNpemUgPSBuZXcgRGF0YVZpZXcoYnl0ZXMuYnVmZmVyKS5nZXRJbnQzMigwKTtcbiAgcmV0dXJuIFU4VGFrZShieXRlcywgOCArIHNpemUgKyA0KTsgLy8gc2l6ZSx0eXBlLGRhdGEsY3JjXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBleHRyYWN0Q2h1bmtzKGJ5dGVzOiBVaW50OEFycmF5KSB7XG4gIGxldCBbY2h1bmssIHJlc3RdID0gZXh0cmFjdENodW5rKGJ5dGVzKTtcbiAgY29uc3QgY2h1bmtzID0gW2NodW5rXTtcbiAgd2hpbGUgKHJlc3QuYnl0ZUxlbmd0aCA+IDApIHtcbiAgICBbY2h1bmssIHJlc3RdID0gZXh0cmFjdENodW5rKHJlc3QpO1xuICAgIGNodW5rcy5wdXNoKGNodW5rKTtcbiAgfVxuICByZXR1cm4gY2h1bmtzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0Q2h1bmtDUkModHlwZV9ieXRlczogVWludDhBcnJheSwgZGF0YV9ieXRlczogVWludDhBcnJheSkge1xuICByZXR1cm4gQ1JDLkluaXQoVThDb25jYXQoW3R5cGVfYnl0ZXMsIGRhdGFfYnl0ZXNdKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRDaHVua0NSQ0hleCh0eXBlX2J5dGVzOiBVaW50OEFycmF5LCBkYXRhX2J5dGVzOiBVaW50OEFycmF5KSB7XG4gIHJldHVybiBVaW50MzJUb0hleChDUkMuSW5pdChVOENvbmNhdChbdHlwZV9ieXRlcywgZGF0YV9ieXRlc10pKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRTY2FubGluZVNpemUoeyB3aWR0aCwgYml0RGVwdGgsIGNvbG9yVHlwZSB9OiB7IHdpZHRoOiBudW1iZXI7IGJpdERlcHRoOiBudW1iZXI7IGNvbG9yVHlwZTogbnVtYmVyIH0pIHtcbiAgLy8gQ2FsY3VsYXRlIGJ5dGVzIHBlciBwaXhlbCBiYXNlZCBvbiBjb2xvciB0eXBlIGFuZCBiaXQgZGVwdGhcbiAgbGV0IHNhbXBsZXNQZXJQaXhlbDogbnVtYmVyO1xuICBzd2l0Y2ggKGNvbG9yVHlwZSkge1xuICAgIGNhc2UgMDogLy8gR3JheXNjYWxlXG4gICAgICBzYW1wbGVzUGVyUGl4ZWwgPSAxO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAyOiAvLyBUcnVlY29sb3IgKFJHQilcbiAgICAgIHNhbXBsZXNQZXJQaXhlbCA9IDM7XG4gICAgICBicmVhaztcbiAgICBjYXNlIDM6IC8vIEluZGV4ZWQtY29sb3IgKHBhbGV0dGUpXG4gICAgICBzYW1wbGVzUGVyUGl4ZWwgPSAxOyAvLyBVc2VzIGEgcGFsZXR0ZSwgc28gb25seSAxIGJ5dGUgcGVyIHBpeGVsIGluZGV4XG4gICAgICBicmVhaztcbiAgICBjYXNlIDQ6IC8vIEdyYXlzY2FsZSB3aXRoIGFscGhhXG4gICAgICBzYW1wbGVzUGVyUGl4ZWwgPSAyO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSA2OiAvLyBUcnVlY29sb3Igd2l0aCBhbHBoYSAoUkdCQSlcbiAgICAgIHNhbXBsZXNQZXJQaXhlbCA9IDQ7XG4gICAgICBicmVhaztcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIGNvbG9yIHR5cGUuJyk7XG4gIH1cblxuICAvLyBDYWxjdWxhdGUgYnl0ZXMgcGVyIHBpeGVsXG4gIGNvbnN0IGJ5dGVzUGVyUGl4ZWwgPSAoYml0RGVwdGggKiBzYW1wbGVzUGVyUGl4ZWwpIC8gODtcbiAgY29uc3Qgc2NhbmxpbmVTaXplID0gMSArIHdpZHRoICogYnl0ZXNQZXJQaXhlbDtcblxuICByZXR1cm4gc2NhbmxpbmVTaXplO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VJSERSQ2h1bmsoSUhEUjogQ2h1bmspIHtcbiAgY29uc3QgZGF0YSA9IElIRFIuZGF0YTtcblxuICBpZiAoZGF0YS5sZW5ndGggIT09IDEzKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIElIRFIgY2h1bmsgbGVuZ3RoLiBFeHBlY3RlZCAxMyBieXRlcy4nKTtcbiAgfVxuXG4gIC8vIEV4dHJhY3Qgd2lkdGggKDQgYnl0ZXMpXG4gIGNvbnN0IHdpZHRoID0gKGRhdGFbMF0gPDwgMjQpIHwgKGRhdGFbMV0gPDwgMTYpIHwgKGRhdGFbMl0gPDwgOCkgfCBkYXRhWzNdO1xuXG4gIC8vIEV4dHJhY3QgaGVpZ2h0ICg0IGJ5dGVzKVxuICBjb25zdCBoZWlnaHQgPSAoZGF0YVs0XSA8PCAyNCkgfCAoZGF0YVs1XSA8PCAxNikgfCAoZGF0YVs2XSA8PCA4KSB8IGRhdGFbN107XG5cbiAgLy8gRXh0cmFjdCBiaXQgZGVwdGggKDEgYnl0ZSlcbiAgY29uc3QgYml0RGVwdGggPSBkYXRhWzhdO1xuXG4gIC8vIEV4dHJhY3QgY29sb3IgdHlwZSAoMSBieXRlKVxuICBjb25zdCBjb2xvclR5cGUgPSBkYXRhWzldO1xuXG4gIC8vIEV4dHJhY3QgY29tcHJlc3Npb24gbWV0aG9kICgxIGJ5dGUpXG4gIGNvbnN0IGNvbXByZXNzaW9uTWV0aG9kID0gZGF0YVsxMF07XG5cbiAgLy8gRXh0cmFjdCBmaWx0ZXIgbWV0aG9kICgxIGJ5dGUpXG4gIGNvbnN0IGZpbHRlck1ldGhvZCA9IGRhdGFbMTFdO1xuXG4gIC8vIEV4dHJhY3QgaW50ZXJsYWNlIG1ldGhvZCAoMSBieXRlKVxuICBjb25zdCBpbnRlcmxhY2VNZXRob2QgPSBkYXRhWzEyXTtcblxuICByZXR1cm4ge1xuICAgIGJpdERlcHRoLFxuICAgIGNvbG9yVHlwZSxcbiAgICBjb21wcmVzc2lvbk1ldGhvZCxcbiAgICBmaWx0ZXJNZXRob2QsXG4gICAgaGVpZ2h0LFxuICAgIGludGVybGFjZU1ldGhvZCxcbiAgICB3aWR0aCxcbiAgfTtcbn1cbiIsCiAgICAiaW1wb3J0IHsgVThDb25jYXQsIFU4RnJvbVVpbnQzMiwgVThTcGxpdCwgVThUYWtlLCBVOFRvQVNDSUksIFU4VG9IZXggfSBmcm9tICcuL2VyaWNjaGFzZS9BbGdvcml0aG0vQXJyYXkvVWludDhBcnJheS5qcyc7XG5pbXBvcnQgeyBDUkMgfSBmcm9tICcuL2VyaWNjaGFzZS9BbGdvcml0aG0vTWF0aC9DUkMuanMnO1xuaW1wb3J0IHsgQ2h1bmssIGFuYWx5emVDaHVuaywgZGVjb21wcmVzc0ltYWdlRGF0YSwgZXh0cmFjdENodW5rcywgZ2V0U2NhbmxpbmVTaXplLCBwYXJzZUlIRFJDaHVuayB9IGZyb20gJy4vcG5nLmpzJztcblxuLy8gY29uc3QgWywgLCBwYXRoXSA9IEJ1bi5hcmd2O1xuLy8gY29uc3QgYnVmZmVyID0gYXdhaXQgQnVuLmZpbGUocGF0aCkuYnl0ZXMoKTtcblxuZXhwb3J0IGZ1bmN0aW9uIFBOR0luc3BlY3QocG5nX2J1ZmZlcjogVWludDhBcnJheSwgb3V0cHV0OiAoZGF0YT86IGFueVtdKSA9PiB2b2lkKSB7XG4gIGNvbnN0IFtjaHVua1NpZ25hdHVyZSwgcmVzdF0gPSBVOFRha2UocG5nX2J1ZmZlciwgOCk7XG4gIGNvbnN0IGNodW5rcyA9IGV4dHJhY3RDaHVua3MocmVzdCk7XG5cbiAgb3V0cHV0KFsnU2lnbmF0dXJlJ10pO1xuICBvdXRwdXQoWy4uLlU4VG9IZXgoY2h1bmtTaWduYXR1cmUpXSk7XG4gIG91dHB1dCgpO1xuXG4gIGxldCBpZGF0X2RhdGFzOiBVaW50OEFycmF5W10gPSBbXTtcbiAgbGV0IHRvdGFsX2lkYXRfc2l6ZSA9IDA7XG4gIGxldCBJSERSOiBDaHVuayB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuICBmb3IgKGNvbnN0IGNodW5rIG9mIGNodW5rcykge1xuICAgIGNvbnN0IHsgZGF0YSwgc2l6ZSwgdHlwZSwgY3JjIH0gPSBhbmFseXplQ2h1bmsoY2h1bmspO1xuICAgIGlmIChVOFRvQVNDSUkodHlwZSkgPT09ICdJREFUJykge1xuICAgICAgaWRhdF9kYXRhcy5wdXNoKGRhdGEpO1xuICAgICAgdG90YWxfaWRhdF9zaXplICs9IHNpemU7XG4gICAgfVxuICAgIG91dHB1dChbJ0NodW5rJ10pO1xuICAgIGlmIChVOFRvQVNDSUkodHlwZSkgPT09ICdJSERSJykge1xuICAgICAgSUhEUiA9IG5ldyBDaHVuayhjaHVuayk7XG4gICAgICBvdXRwdXQoWy4uLlU4VG9IZXgoY2h1bmspXSk7XG4gICAgfVxuICAgIG91dHB1dChbJ3NpemU6Jywgc2l6ZV0pO1xuICAgIG91dHB1dChbJ3R5cGU6JywgVThUb0FTQ0lJKHR5cGUpXSk7XG4gICAgLy8gb3V0cHV0KFsnZGF0YTonLCAuLi50b0hleChkYXRhKV0pO1xuICAgIG91dHB1dChbJ2NyYzonLCAuLi5VOFRvSGV4KGNyYyldKTtcbiAgICBvdXRwdXQoWydjb21wdXRlZCBjcmM6JywgLi4uVThUb0hleChVOEZyb21VaW50MzIoQ1JDLkluaXQoVThDb25jYXQoW3R5cGUsIGRhdGFdKSkpKV0pO1xuICAgIG91dHB1dCgpO1xuICB9XG5cbiAgb3V0cHV0KFsnVG90YWwgSURBVCBDaHVua3M6JywgaWRhdF9kYXRhcy5sZW5ndGhdKTtcbiAgb3V0cHV0KFsnVG90YWwgSURBVCBDb21wcmVzc2VkIFNpemU6JywgdG90YWxfaWRhdF9zaXplXSk7XG5cbiAgLy8gQ29tYmluZSBJREFUcywgRGVjb21wcmVzcywgU3BsaXQgRGVjb21wcmVzc2VkIERhdGEgaW50byBTY2FubGluZXMsIEdyb3VwIFNjYW5saW5lcywgQ29tcHJlc3MgR3JvdXBzLCBDcmVhdGUgTmV3IFBuZ3NcbiAgY29uc3QgY29tcHJlc3NlZF9ieXRlcyA9IFU4Q29uY2F0KGlkYXRfZGF0YXMpO1xuICBvdXRwdXQoWydDb21wcmVzc2VkIERhdGEgU2l6ZTonLCBjb21wcmVzc2VkX2J5dGVzLmJ5dGVMZW5ndGhdKTtcblxuICBvdXRwdXQoWydEZWNvbXByZXNzaW5nIERhdGEnXSk7XG4gIGNvbnN0IGRlY29tcHJlc3NlZF9ieXRlcyA9IGRlY29tcHJlc3NJbWFnZURhdGEoY29tcHJlc3NlZF9ieXRlcyk7XG4gIGlmICghZGVjb21wcmVzc2VkX2J5dGVzKSB0aHJvdyAnZXJyb3I6IGRlY29tcHJlc3NlZF9ieXRlcyc7XG4gIG91dHB1dChbJ0RlY29tcHJlc3NlZCBEYXRhIFNpemU6JywgZGVjb21wcmVzc2VkX2J5dGVzLmJ5dGVMZW5ndGhdKTtcbiAgLy8gb3V0cHV0KFsnRGVjb21wcmVzc2VkIEJ5dGVzOicsIGRlY29tcHJlc3NlZF9ieXRlc10pO1xuICBvdXRwdXQoKTtcblxuICBpZiAoIUlIRFIpIHRocm93ICdlcnJvcjogSUhEUic7XG4gIGNvbnN0IHsgYml0RGVwdGgsIGNvbG9yVHlwZSwgY29tcHJlc3Npb25NZXRob2QsIGZpbHRlck1ldGhvZCwgaGVpZ2h0LCBpbnRlcmxhY2VNZXRob2QsIHdpZHRoIH0gPSBwYXJzZUlIRFJDaHVuayhJSERSKTtcblxuICBvdXRwdXQoWydXaWR0aDonLCB3aWR0aF0pO1xuICBvdXRwdXQoWydIZWlnaHQ6JywgaGVpZ2h0XSk7XG4gIG91dHB1dChbJ0JpdERlcHRoOicsIGJpdERlcHRoXSk7XG4gIG91dHB1dChbJ0NvbG9yVHlwZTonLCBjb2xvclR5cGVdKTtcbiAgb3V0cHV0KFsnQ29tcHJlc3Npb25NZXRob2Q6JywgY29tcHJlc3Npb25NZXRob2RdKTtcbiAgb3V0cHV0KFsnRmlsdGVyTWV0aG9kOicsIGZpbHRlck1ldGhvZF0pO1xuICBvdXRwdXQoWydJbnRlcmxhY2VNZXRob2Q6JywgaW50ZXJsYWNlTWV0aG9kXSk7XG4gIG91dHB1dCgpO1xuXG4gIG91dHB1dChbJ0V4dHJhY3RpbmcgU2NhbmxpbmVzJ10pO1xuICBjb25zdCBzY2FubGluZVNpemUgPSBnZXRTY2FubGluZVNpemUoeyB3aWR0aCwgYml0RGVwdGgsIGNvbG9yVHlwZSB9KTtcbiAgb3V0cHV0KFsnU2NhbmxpbmUgU2l6ZTonLCBzY2FubGluZVNpemVdKTtcbiAgY29uc3Qgc2NhbmxpbmVzID0gVThTcGxpdChkZWNvbXByZXNzZWRfYnl0ZXMsIHNjYW5saW5lU2l6ZSk7XG4gIG91dHB1dChbc2NhbmxpbmVzLmxlbmd0aCwgJ1NjYW5saW5lcyBFeHRyYWN0ZWQnXSk7XG59XG4iLAogICAgImV4cG9ydCBmdW5jdGlvbiBBcnJheUVxdWFscyhhOiBBcnJheUxpa2U8YW55PiwgYjogQXJyYXlMaWtlPGFueT4pOiBib29sZWFuIHtcbiAgaWYgKGEubGVuZ3RoICE9PSBiLmxlbmd0aCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBmb3IgKGxldCBpID0gMDsgaSA8IGEubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoYVtpXSAhPT0gYltpXSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuICByZXR1cm4gdHJ1ZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uKiBBcnJheUdldEJ5dGVzKGJ1ZmZlcjogQXJyYXlCdWZmZXJMaWtlKTogR2VuZXJhdG9yPG51bWJlcj4ge1xuICBjb25zdCB2aWV3ID0gbmV3IERhdGFWaWV3KGJ1ZmZlcik7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgdmlldy5ieXRlTGVuZ3RoOyBpKyspIHtcbiAgICB5aWVsZCB2aWV3LmdldFVpbnQ4KGkpID4+PiAwO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBBcnJheVNwbGl0PFQ+KGl0ZW1zOiBUW10sIGNvdW50OiBudW1iZXIpOiBUW11bXSB7XG4gIGlmIChjb3VudCA+IGl0ZW1zLmxlbmd0aCkge1xuICAgIHJldHVybiBbaXRlbXMuc2xpY2UoKV07XG4gIH1cbiAgaWYgKGNvdW50ID4gMCkge1xuICAgIGNvbnN0IHBhcnRzOiBUW11bXSA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgaXRlbXMubGVuZ3RoOyBpICs9IGNvdW50KSB7XG4gICAgICBwYXJ0cy5wdXNoKGl0ZW1zLnNsaWNlKGksIGkgKyBjb3VudCkpO1xuICAgIH1cbiAgICByZXR1cm4gcGFydHM7XG4gIH1cbiAgcmV0dXJuIFtpdGVtcy5zbGljZSgpXTtcbn1cbiIsCiAgICAiLy8gY29uc3QgcGF0aCA9IEJ1bi5hcmd2WzJdO1xuLy8gY29uc3QgbWF4X2hlaWdodF9wZXJfZmlsZSA9IEJ1bi5hcmd2WzNdID09PSB1bmRlZmluZWQgPyA0MDk2IDogTnVtYmVyLnBhcnNlSW50KEJ1bi5hcmd2WzNdKTtcbi8vIGNvbnN0IGJ1ZmZlciA9IGF3YWl0IEJ1bi5maWxlKHBhdGgpLmJ5dGVzKCk7XG5cbmltcG9ydCB7IEFycmF5U3BsaXQgfSBmcm9tICcuL2VyaWNjaGFzZS9BbGdvcml0aG0vQXJyYXkvQXJyYXkuanMnO1xuaW1wb3J0IHsgVThDb25jYXQsIFU4U3BsaXQsIFU4VGFrZSwgVThUb0FTQ0lJLCBVOFRvSGV4IH0gZnJvbSAnLi9lcmljY2hhc2UvQWxnb3JpdGhtL0FycmF5L1VpbnQ4QXJyYXkuanMnO1xuaW1wb3J0IHsgQ29uc29sZUVycm9yIH0gZnJvbSAnLi9lcmljY2hhc2UvVXRpbGl0eS9Db25zb2xlLmpzJztcbmltcG9ydCB7IENodW5rLCBjb21wcmVzc0ltYWdlRGF0YSwgY3JlYXRlSURBVGNodW5rLCBjcmVhdGVJSERSY2h1bmssIGRlY29tcHJlc3NJbWFnZURhdGEsIGV4dHJhY3RDaHVua3MsIGdldFNjYW5saW5lU2l6ZSwgcGFyc2VJSERSQ2h1bmsgfSBmcm9tICcuL3BuZy5qcyc7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBQTkdTcGxpdChidWZmZXI6IFVpbnQ4QXJyYXksIGhlaWdodF9wZXJfZmlsZSA9IDQwOTYsIG91dHB1dD86IChkYXRhPzogYW55W10pID0+IHZvaWQpOiBQcm9taXNlPFVpbnQ4QXJyYXlbXT4ge1xuICAvLyBFeHRyYWN0IHRoZSBTaWduYXR1cmVcbiAgY29uc3QgW3NpZ25hdHVyZUJ5dGVzLCByZXN0XSA9IFU4VGFrZShidWZmZXIsIDgpO1xuICBjb25zdCBjaHVua3MgPSBleHRyYWN0Q2h1bmtzKHJlc3QpLm1hcCgoYnl0ZXMpID0+IG5ldyBDaHVuayhieXRlcykpO1xuXG4gIC8vIEV4dHJhY3QgQWxsIHRoZSBDaHVua3NcbiAgY29uc3QgdG9wQ2h1bmtzOiBDaHVua1tdID0gW107XG4gIGNvbnN0IGRhdGFDaHVua3M6IENodW5rW10gPSBbXTtcbiAgY29uc3QgYm90Q2h1bmtzOiBDaHVua1tdID0gW107XG4gIGxldCBpbmRleCA9IDA7XG4gIHdoaWxlIChpbmRleCA8IGNodW5rcy5sZW5ndGgpIHtcbiAgICBjb25zdCBjaHVuayA9IGNodW5rc1tpbmRleF07XG4gICAgLy8gY29uc3QgeyB0eXBlIH0gPSBhbmFseXplQ2h1bmsoY2h1bmtzW2luZGV4XSk7XG4gICAgaWYgKFN0cmluZy5mcm9tQ2hhckNvZGUoLi4uY2h1bmsudHlwZSkgPT09ICdJREFUJykge1xuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHRvcENodW5rcy5wdXNoKGNodW5rKTtcbiAgICBpbmRleCsrO1xuICB9XG4gIHdoaWxlIChpbmRleCA8IGNodW5rcy5sZW5ndGgpIHtcbiAgICBjb25zdCBjaHVuayA9IGNodW5rc1tpbmRleF07XG4gICAgaWYgKFN0cmluZy5mcm9tQ2hhckNvZGUoLi4uY2h1bmsudHlwZSkgIT09ICdJREFUJykge1xuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGRhdGFDaHVua3MucHVzaChjaHVuayk7XG4gICAgaW5kZXgrKztcbiAgfVxuICB3aGlsZSAoaW5kZXggPCBjaHVua3MubGVuZ3RoKSB7XG4gICAgY29uc3QgY2h1bmsgPSBjaHVua3NbaW5kZXhdO1xuICAgIGJvdENodW5rcy5wdXNoKGNodW5rKTtcbiAgICBpbmRleCsrO1xuICB9XG5cbiAgb3V0cHV0Py4oWydFeHRyYWN0IElIRFIgYW5kIFBhcnNlJ10pO1xuICBjb25zdCBJSERSID0gdG9wQ2h1bmtzLmZpbmQoKGNodW5rKSA9PiBVOFRvQVNDSUkoY2h1bmsudHlwZSkgPT09ICdJSERSJyk7XG4gIGlmICghSUhEUikgdGhyb3cgJ2Vycm9yOiBJSERSJztcbiAgY29uc3QgeyBiaXREZXB0aCwgY29sb3JUeXBlLCBjb21wcmVzc2lvbk1ldGhvZCwgZmlsdGVyTWV0aG9kLCBoZWlnaHQsIGludGVybGFjZU1ldGhvZCwgd2lkdGggfSA9IHBhcnNlSUhEUkNodW5rKElIRFIpO1xuXG4gIC8vIENvbWJpbmUgSURBVHMsIERlY29tcHJlc3MsIFNwbGl0IERlY29tcHJlc3NlZCBEYXRhIGludG8gU2NhbmxpbmVzLCBHcm91cCBTY2FubGluZXMsIENvbXByZXNzIEdyb3VwcywgQ3JlYXRlIE5ldyBQbmdzXG4gIGNvbnN0IGNvbXByZXNzZWRfYnl0ZXMgPSBVOENvbmNhdChkYXRhQ2h1bmtzLm1hcCgoY2h1bmspID0+IGNodW5rLmRhdGEpKTtcbiAgb3V0cHV0Py4oWydDb21wcmVzc2VkIERhdGEgU2l6ZTonLCBjb21wcmVzc2VkX2J5dGVzLmJ5dGVMZW5ndGhdKTtcblxuICBvdXRwdXQ/LihbJ0RlY29tcHJlc3NpbmcgRGF0YSddKTtcbiAgY29uc3QgZGVjb21wcmVzc2VkX2J5dGVzID0gZGVjb21wcmVzc0ltYWdlRGF0YShjb21wcmVzc2VkX2J5dGVzKTtcbiAgaWYgKCFkZWNvbXByZXNzZWRfYnl0ZXMpIHRocm93ICdlcnJvcjogZGVjb21wcmVzc2VkX2J5dGVzJztcbiAgb3V0cHV0Py4oWydEZWNvbXByZXNzZWQgRGF0YSBTaXplOicsIGRlY29tcHJlc3NlZF9ieXRlcy5ieXRlTGVuZ3RoXSk7XG5cbiAgLy8gR2V0IHRvcCBjaHVua3Mgd2l0aG91dCBJSERSXG4gIGNvbnN0IHRvcENodW5rc1dpdGhvdXRJSERSID0gdG9wQ2h1bmtzLmZpbHRlcigoY2h1bmspID0+IFU4VG9BU0NJSShjaHVuay50eXBlKSAhPT0gJ0lIRFInKTtcblxuICBvdXRwdXQ/LihbJ0V4dHJhY3RpbmcgU2NhbmxpbmVzJ10pO1xuICBjb25zdCBzY2FubGluZVNpemUgPSBnZXRTY2FubGluZVNpemUoeyB3aWR0aCwgYml0RGVwdGgsIGNvbG9yVHlwZSB9KTtcbiAgY29uc3Qgc2NhbmxpbmVzID0gVThTcGxpdChkZWNvbXByZXNzZWRfYnl0ZXMsIHNjYW5saW5lU2l6ZSk7XG4gIG91dHB1dD8uKFtzY2FubGluZXMubGVuZ3RoLCAnU2NhbmxpbmVzIEV4dHJhY3RlZCddKTtcblxuICAvLyBjb25zdCByZWNvbXByZXNzZWRfYnl0ZXMgPSBjb21wcmVzc0lEQVRkYXRhKGRlY29tcHJlc3NlZF9ieXRlcyk7XG4gIC8vIGlmICghcmVjb21wcmVzc2VkX2J5dGVzKSB0aHJvdyAnZXJyb3I6IHJlY29tcHJlc3NlZF9ieXRlcyc7XG4gIC8vIGNvbnN0IG5ld0lEQVQgPSBjcmVhdGVJREFUKHJlY29tcHJlc3NlZF9ieXRlcyk7XG4gIC8vIGNvbnN0IG91dHBhdGggPSBwYXRoICsgJ19fc3BsaXQwMC5wbmcnO1xuICAvLyBvdXRwdXQ/LihbJ1dyaXRpbmcnLCBvdXRwYXRoXSk7XG4gIC8vIGF3YWl0IEJ1bi53cml0ZShvdXRwYXRoLCBVOENvbmNhdChbc2lnbmF0dXJlQnl0ZXMsIC4uLnRvcENodW5rcy5tYXAoKF8pID0+IF8uYnl0ZXMpLCBuZXdJREFULCAuLi5ib3RDaHVua3MubWFwKChfKSA9PiBfLmJ5dGVzKV0pKTtcblxuICAvLyB0aGUgaW5kaXZpZHVhbCBmaWxlcyBwcm9kdWNlZCBmcm9tIHRoaXMgbG9vcCBoYXZlIGlzc3Vlc1xuXG4gIGZ1bmN0aW9uIGNoZWNrU2NhbmxpbmVGaWx0ZXJCeXRlcyhkZWNvbXByZXNzZWREYXRhOiBVaW50OEFycmF5LCBzY2FubGluZVNpemU6IG51bWJlcikge1xuICAgIC8vIEl0ZXJhdGUgdGhyb3VnaCBlYWNoIHNjYW5saW5lXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkZWNvbXByZXNzZWREYXRhLmxlbmd0aDsgaSArPSBzY2FubGluZVNpemUpIHtcbiAgICAgIGNvbnN0IGZpbHRlckJ5dGUgPSBkZWNvbXByZXNzZWREYXRhW2ldO1xuXG4gICAgICAvLyBDaGVjayBpZiB0aGUgZmlsdGVyIGJ5dGUgaXMgd2l0aGluIHRoZSB2YWxpZCByYW5nZSBbMCwgNF1cbiAgICAgIGlmIChmaWx0ZXJCeXRlIDwgMCB8fCBmaWx0ZXJCeXRlID4gNCkge1xuICAgICAgICBDb25zb2xlRXJyb3IoYEludmFsaWQgZmlsdGVyIGJ5dGUgYXQgc2NhbmxpbmUgJHtpIC8gc2NhbmxpbmVTaXplfTogJHtmaWx0ZXJCeXRlfWApO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBmdW5jdGlvbiB2YWxpZGF0ZVNjYW5saW5lKHNjYW5saW5lOiBVaW50OEFycmF5KSB7XG4gICAgLy8gQ2FsY3VsYXRlIGJ5dGVzIHBlciBwaXhlbCBiYXNlZCBvbiBjb2xvciB0eXBlIGFuZCBiaXQgZGVwdGhcbiAgICBsZXQgc2FtcGxlc1BlclBpeGVsOiBudW1iZXI7XG4gICAgc3dpdGNoIChjb2xvclR5cGUpIHtcbiAgICAgIGNhc2UgMDogLy8gR3JheXNjYWxlXG4gICAgICAgIHNhbXBsZXNQZXJQaXhlbCA9IDE7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOiAvLyBUcnVlY29sb3IgKFJHQilcbiAgICAgICAgc2FtcGxlc1BlclBpeGVsID0gMztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6IC8vIEluZGV4ZWQtY29sb3IgKHBhbGV0dGUpXG4gICAgICAgIHNhbXBsZXNQZXJQaXhlbCA9IDE7IC8vIFVzZXMgYSBwYWxldHRlLCBzbyBvbmx5IDEgYnl0ZSBwZXIgcGl4ZWwgaW5kZXhcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDQ6IC8vIEdyYXlzY2FsZSB3aXRoIGFscGhhXG4gICAgICAgIHNhbXBsZXNQZXJQaXhlbCA9IDI7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSA2OiAvLyBUcnVlY29sb3Igd2l0aCBhbHBoYSAoUkdCQSlcbiAgICAgICAgc2FtcGxlc1BlclBpeGVsID0gNDtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gY29sb3IgdHlwZS4nKTtcbiAgICB9XG5cbiAgICAvLyBDYWxjdWxhdGUgYnl0ZXMgcGVyIHBpeGVsXG4gICAgY29uc3QgYnl0ZXNQZXJQaXhlbCA9IChiaXREZXB0aCAqIHNhbXBsZXNQZXJQaXhlbCkgLyA4O1xuICAgIGNvbnN0IHNjYW5saW5lU2l6ZSA9IDEgKyB3aWR0aCAqIGJ5dGVzUGVyUGl4ZWw7XG5cbiAgICAvLyBUaGUgc2NhbmxpbmUgc2hvdWxkIHN0YXJ0IHdpdGggYSBmaWx0ZXIgYnl0ZVxuICAgIGNvbnN0IGZpbHRlckJ5dGUgPSBzY2FubGluZVswXTtcblxuICAgIC8vIFZhbGlkYXRlIHRoZSBmaWx0ZXIgYnl0ZSAobXVzdCBiZSBiZXR3ZWVuIDAgYW5kIDQpXG4gICAgaWYgKGZpbHRlckJ5dGUgPCAwIHx8IGZpbHRlckJ5dGUgPiA0KSB7XG4gICAgICBDb25zb2xlRXJyb3IoYEludmFsaWQgZmlsdGVyIGJ5dGU6ICR7ZmlsdGVyQnl0ZX1gKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBWYWxpZGF0ZSB0aGUgbGVuZ3RoIG9mIHRoZSBzY2FubGluZSBkYXRhIChleGNsdWRpbmcgdGhlIGZpbHRlciBieXRlKVxuICAgIGNvbnN0IGV4cGVjdGVkRGF0YUxlbmd0aCA9IHdpZHRoICogYnl0ZXNQZXJQaXhlbDtcbiAgICBjb25zdCBzY2FubGluZURhdGFMZW5ndGggPSBzY2FubGluZS5sZW5ndGggLSAxOyAvLyBFeGNsdWRpbmcgdGhlIGZpbHRlciBieXRlXG5cbiAgICBpZiAoc2NhbmxpbmVEYXRhTGVuZ3RoICE9PSBleHBlY3RlZERhdGFMZW5ndGgpIHtcbiAgICAgIENvbnNvbGVFcnJvcihgSW5jb3JyZWN0IHNjYW5saW5lIGRhdGEgbGVuZ3RoOiBleHBlY3RlZCAke2V4cGVjdGVkRGF0YUxlbmd0aH0sIGdvdCAke3NjYW5saW5lRGF0YUxlbmd0aH1gKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8vIC8vIFNwbGl0dGluZyBzY2FubGluZXMgYmFzZWQgb24gbWF4IGRlY29tcHJlc3NlZCBkYXRhIHNpemVcbiAgLy8gY29uc3Qgc2NhbmxpbmVfZ3JvdXBzOiBVaW50OEFycmF5W10gPSBbXTtcbiAgLy8gbGV0IGdyb3VwOiBVaW50OEFycmF5W10gPSBbXTtcbiAgLy8gbGV0IGdyb3Vwc2l6ZSA9IDA7XG4gIC8vIGZvciAoY29uc3Qgc2NhbmxpbmUgb2Ygc2NhbmxpbmVzKSB7XG4gIC8vICAgdmFsaWRhdGVTY2FubGluZShzY2FubGluZSk7XG4gIC8vICAgaWYgKGdyb3Vwc2l6ZSArIHNjYW5saW5lLmJ5dGVMZW5ndGggPCBtYXhfaGVpZ2h0X3Blcl9maWxlKSB7XG4gIC8vICAgICBncm91cC5wdXNoKHNjYW5saW5lKTtcbiAgLy8gICAgIGdyb3Vwc2l6ZSArPSBzY2FubGluZS5ieXRlTGVuZ3RoO1xuICAvLyAgIH0gZWxzZSB7XG4gIC8vICAgICBzY2FubGluZV9ncm91cHMucHVzaChVOENvbmNhdChncm91cCkpO1xuICAvLyAgICAgZ3JvdXAgPSBbXTtcbiAgLy8gICAgIGdyb3Vwc2l6ZSA9IDA7XG4gIC8vICAgfVxuICAvLyB9XG4gIC8vIG91dHB1dD8uKFsnR3JvdXAgQ291bnQ6Jywgc2NhbmxpbmVfZ3JvdXBzLmxlbmd0aF0pO1xuXG4gIG91dHB1dD8uKFsnVmFsaWRhdGluZyBTY2FubGluZXMnXSk7XG4gIGZvciAoY29uc3Qgc2NhbmxpbmUgb2Ygc2NhbmxpbmVzKSB7XG4gICAgdmFsaWRhdGVTY2FubGluZShzY2FubGluZSk7XG4gIH1cblxuICBvdXRwdXQ/LihbJ0NyZWF0aW5nIE5ldyBQTkdzJ10pO1xuICAvLyBsZXQgdGVzdDogVWludDhBcnJheVtdID0gW107XG4gIGNvbnN0IHNjYW5saW5lX2dyb3VwcyA9IEFycmF5U3BsaXQoc2NhbmxpbmVzLCBoZWlnaHRfcGVyX2ZpbGUpO1xuICBjb25zdCBwbmdfb3V0X2J1ZmZlcnM6IFVpbnQ4QXJyYXlbXSA9IFtdO1xuICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgc2NhbmxpbmVfZ3JvdXBzLmxlbmd0aDsgaW5kZXgrKykge1xuICAgIG91dHB1dD8uKFsnUE5HJywgaW5kZXhdKTtcbiAgICBjb25zdCBncm91cCA9IHNjYW5saW5lX2dyb3Vwc1tpbmRleF07XG4gICAgY29uc3QgZGVjb21wcmVzc2VkX2RhdGEgPSBVOENvbmNhdChncm91cCk7XG4gICAgY2hlY2tTY2FubGluZUZpbHRlckJ5dGVzKGRlY29tcHJlc3NlZF9kYXRhLCBzY2FubGluZVNpemUpO1xuICAgIC8vIHRlc3QucHVzaChkZWNvbXByZXNzZWRfZGF0YSk7XG4gICAgY29uc3QgY29tcHJlc3NlZF9kYXRhID0gY29tcHJlc3NJbWFnZURhdGEoZGVjb21wcmVzc2VkX2RhdGEpO1xuICAgIGlmICghY29tcHJlc3NlZF9kYXRhKSB0aHJvdyAnZXJyb3I6IGNvbXByZXNzZWRfZGF0YSc7XG4gICAgb3V0cHV0Py4oWydjb21wcmVzc2VkIGxlbmd0aDonLCBjb21wcmVzc2VkX2RhdGEuYnl0ZUxlbmd0aF0pO1xuICAgIC8vIENyZWF0ZSB0aGUgbmV3IElEQVRcbiAgICBjb25zdCBuZXdJREFUID0gY3JlYXRlSURBVGNodW5rKGNvbXByZXNzZWRfZGF0YSk7XG4gICAgLy8gQ3JlYXRlIHRoZSBuZXcgSUhEUlxuICAgIGNvbnN0IG5ld0lIRFIgPSBjcmVhdGVJSERSY2h1bmsoeyB3aWR0aCwgaGVpZ2h0OiBncm91cC5sZW5ndGgsIGJpdERlcHRoLCBjb2xvclR5cGUsIGNvbXByZXNzaW9uTWV0aG9kLCBmaWx0ZXJNZXRob2QsIGludGVybGFjZU1ldGhvZCB9KTtcbiAgICBvdXRwdXQ/LihbJ25ldyBJSERSOicsIC4uLlU4VG9IZXgobmV3SUhEUildKTtcbiAgICBwbmdfb3V0X2J1ZmZlcnMucHVzaChVOENvbmNhdChbc2lnbmF0dXJlQnl0ZXMsIG5ld0lIRFIsIC4uLnRvcENodW5rc1dpdGhvdXRJSERSLm1hcCgoXykgPT4gXy5ieXRlcyksIG5ld0lEQVQsIC4uLmJvdENodW5rcy5tYXAoKF8pID0+IF8uYnl0ZXMpXSkpO1xuICAgIC8vIGNvbnN0IG91dHBhdGggPSBwYXRoICsgJ19fc3BsaXQnICsgaW5kZXgudG9TdHJpbmcoMTApLnBhZFN0YXJ0KDIsICcwJykgKyAnLnBuZyc7XG4gICAgLy8gb3V0cHV0Py4oWydXcml0aW5nJywgb3V0cGF0aF0pO1xuICAgIC8vIGF3YWl0IEJ1bi53cml0ZShvdXRwYXRoLCBVOENvbmNhdChbc2lnbmF0dXJlQnl0ZXMsIG5ld0lIRFIsIC4uLnRvcENodW5rc1dpdGhvdXRJSERSLm1hcCgoXykgPT4gXy5ieXRlcyksIG5ld0lEQVQsIC4uLmJvdENodW5rcy5tYXAoKF8pID0+IF8uYnl0ZXMpXSkpO1xuICB9XG5cbiAgLy8gLy8gdGhpcyBuZXcgc2luZ2xlIGZpbGUgaXMgcGVyZmVjdFxuXG4gIC8vIGNvbnN0IGRlY29tcHJlc3NlZF90b3RhbCA9IFU4Q29uY2F0KHRlc3QpO1xuICAvLyBvdXRwdXQ/LihbJ0VxdWFsOicsIEFycmF5RXF1YWxzKGRlY29tcHJlc3NlZF90b3RhbCwgZGVjb21wcmVzc2VkX2J5dGVzKV0pO1xuICAvLyBjb25zdCBjb21wcmVzc2VkX3RvdGFsID0gY29tcHJlc3NJbWFnZURhdGEoZGVjb21wcmVzc2VkX3RvdGFsKTtcbiAgLy8gaWYgKCFjb21wcmVzc2VkX3RvdGFsKSB0aHJvdyAnZXJyb3I6IGNvbXByZXNzZWRfdG90YWwnO1xuICAvLyBjb25zdCBuZXdJREFUID0gY3JlYXRlSURBVGNodW5rKGNvbXByZXNzZWRfdG90YWwpO1xuICAvLyBhd2FpdCBCdW4ud3JpdGUocGF0aCArICdfX3NwbGl0LXRlc3QucG5nJywgVThDb25jYXQoW3NpZ25hdHVyZUJ5dGVzLCBJSERSLmJ5dGVzLCAuLi50b3BDaHVua3NXaXRob3V0SUhEUi5tYXAoKF8pID0+IF8uYnl0ZXMpLCBuZXdJREFULCAuLi5ib3RDaHVua3MubWFwKChfKSA9PiBfLmJ5dGVzKV0pKTtcblxuICByZXR1cm4gcG5nX291dF9idWZmZXJzO1xufVxuIiwKICAgICJpbXBvcnQgeyBzZXR1cERyYWdBbmREcm9wRmlsZVBpY2tlciB9IGZyb20gJy4vY29tcG9uZW50cy9kcmFnLWFuZC1kcm9wLWZpbGUtcGlja2VyL2RyYWctYW5kLWRyb3AtZmlsZS1waWNrZXIuanMnO1xuaW1wb3J0IHsgQ29uc29sZUVycm9yIH0gZnJvbSAnLi9saWIvZXJpY2NoYXNlL1V0aWxpdHkvQ29uc29sZS5qcyc7XG5pbXBvcnQgdHlwZSB7IE4gfSBmcm9tICcuL2xpYi9lcmljY2hhc2UvVXRpbGl0eS9UeXBlcy5qcyc7XG5pbXBvcnQgeyBHZXRCeXRlcyB9IGZyb20gJy4vbGliL2VyaWNjaGFzZS9XZWIgQVBJL0ZpbGUuanMnO1xuaW1wb3J0IHsgUE5HSW5zcGVjdCB9IGZyb20gJy4vbGliL3BuZy1pbnNwZWN0LmpzJztcbmltcG9ydCB7IFBOR1NwbGl0IH0gZnJvbSAnLi9saWIvcG5nLXNwbGl0LmpzJztcblxuLy8gLy8gRXh0cmVtZWx5IFVzZWZ1bCBGdW5jdGlvbiBUbyBQcmludCBMb2dzIFRvIFBhZ2VzXG4vLyBleHBvcnQgZnVuY3Rpb24gbG9nKGl0ZW06IGFueSkge1xuLy8gICBjb25zdCBlbnRyeV9wb2ludCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5lbnRyeS1wb2ludCcpO1xuLy8gICBpZiAoQXJyYXkuaXNBcnJheShpdGVtKSkge1xuLy8gICAgIGZvciAoY29uc3Qga2V5IGluIGl0ZW0pIHtcbi8vICAgICAgIGlmIChBcnJheS5pc0FycmF5KGl0ZW1ba2V5XSkpIHtcbi8vICAgICAgICAgZm9yIChjb25zdCBrZXkyIGluIGl0ZW1ba2V5XSkge1xuLy8gICAgICAgICAgIGNvbnN0IGRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuLy8gICAgICAgICAgIGRpdi50ZXh0Q29udGVudCA9IGAke2tleTJ9OiAke2l0ZW1ba2V5XVtrZXkyXX1gO1xuLy8gICAgICAgICAgIGVudHJ5X3BvaW50Py5hcHBlbmRDaGlsZChkaXYpO1xuLy8gICAgICAgICB9XG4vLyAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBpdGVtW2tleV0gIT09ICdmdW5jdGlvbicpIHtcbi8vICAgICAgICAgY29uc3QgZGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4vLyAgICAgICAgIGRpdi50ZXh0Q29udGVudCA9IGAke2tleX06ICR7aXRlbVtrZXldfWA7XG4vLyAgICAgICAgIGVudHJ5X3BvaW50Py5hcHBlbmRDaGlsZChkaXYpO1xuLy8gICAgICAgfVxuLy8gICAgIH1cbi8vICAgfSBlbHNlIHtcbi8vICAgICBjb25zdCBkaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbi8vICAgICBkaXYudGV4dENvbnRlbnQgPSBpdGVtO1xuLy8gICAgIGVudHJ5X3BvaW50Py5hcHBlbmRDaGlsZChkaXYpO1xuLy8gICB9XG4vLyB9XG5cbi8vICEgb25lIGRheSB1c2UgRXZlbnRNYW5hZ2VyXG5kb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ292ZXInLCAoZXZlbnQpID0+IGV2ZW50LnByZXZlbnREZWZhdWx0KCkpO1xuXG5jb25zdCBmaWxlX3BpY2tlciA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNmaWxlLXBpY2tlcicpO1xuY29uc3QgaW1hZ2Vfdmlld2VyID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2ltYWdlLXZpZXdlcicpO1xuY29uc3QgaW1hZ2Vfdmlld2VyX2dhcHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcuaW1hZ2Utdmlld2VyLWdhcCcpO1xuY29uc3QgZWRpdF9idXR0b25zID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2VkaXQtYnV0dG9ucycpO1xuXG5jb25zdCBidG5faW5zcGVjdCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNidG4taW5zcGVjdCcpO1xuY29uc3QgYnRuX3NwbGl0ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2J0bi1zcGxpdCcpO1xuY29uc3Qgb3V0cHV0X2NvbnRhaW5lciA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNvdXRwdXQtY29udGFpbmVyJyk7XG5jb25zdCBvdXRwdXRfY29udGFpbmVyX2dhcHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcub3V0cHV0LWNvbnRhaW5lci1nYXAnKTtcblxubGV0IHNlbGVjdGVkX2ZpbGU6IEZpbGUgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cbmlmIChmaWxlX3BpY2tlcikge1xuICBjb25zdCBvbkRyYWdFbmQgPSAoKSA9PiB7XG4gICAgZmlsZV9waWNrZXIuY2xhc3NMaXN0LnJlbW92ZSgnaG92ZXInKTtcbiAgfTtcbiAgc2V0dXBEcmFnQW5kRHJvcEZpbGVQaWNrZXIoXG4gICAgZmlsZV9waWNrZXIsXG4gICAge1xuICAgICAgb25EcmFnRW50ZXIoKSB7XG4gICAgICAgIGZpbGVfcGlja2VyLmNsYXNzTGlzdC5hZGQoJ2hvdmVyJyk7XG4gICAgICB9LFxuICAgICAgb25EcmFnTGVhdmU6IG9uRHJhZ0VuZCxcbiAgICAgIG9uRHJhZ0VuZDogb25EcmFnRW5kLFxuICAgICAgb25Ecm9wOiBvbkRyYWdFbmQsXG4gICAgICBvblVwbG9hZFN0YXJ0KCkge1xuICAgICAgICBzZWxlY3RlZF9maWxlID0gdW5kZWZpbmVkO1xuICAgICAgICBmaWxlX3BpY2tlci5jbGFzc0xpc3QuYWRkKCdxdWlldC1tb2RlJyk7XG4gICAgICB9LFxuICAgICAgb25VcGxvYWROZXh0RmlsZTogc2hvd0ltYWdlSW5WaWV3ZXIsXG4gICAgICBvblVwbG9hZEVycm9yKGVycm9yKSB7XG4gICAgICAgIGFkZFRleHRzVG9PdXRwdXQoZXJyb3IsIHRydWUpO1xuICAgICAgfSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGFjY2VwdDogJy5wbmcnLCAvLyB3b24ndCB3b3JrIG9uIG1vYmlsZVxuICAgIH0sXG4gICk7XG59XG5cbmZ1bmN0aW9uIHJlc2V0Vmlld2VyKCkge1xuICBzZWxlY3RlZF9maWxlID0gdW5kZWZpbmVkO1xuICBmaWxlX3BpY2tlcj8uY2xhc3NMaXN0LnJlbW92ZSgncXVpZXQtbW9kZScpO1xuICBpbWFnZV92aWV3ZXI/LmNsYXNzTGlzdC5yZW1vdmUoJ2ltYWdlLWxvYWRlZCcpO1xuICBpbWFnZV92aWV3ZXI/LnF1ZXJ5U2VsZWN0b3IoJ2ltZycpPy5yZW1vdmUoKTtcbiAgZm9yIChjb25zdCBnYXAgb2YgaW1hZ2Vfdmlld2VyX2dhcHMgPz8gW10pIHtcbiAgICBnYXAuY2xhc3NMaXN0LmFkZCgncmVtb3ZlJyk7XG4gIH1cbiAgZm9yIChjb25zdCBidXR0b24gb2YgZWRpdF9idXR0b25zPy5xdWVyeVNlbGVjdG9yQWxsKCdidXR0b24nKSA/PyBbXSkge1xuICAgIGJ1dHRvbi5kaXNhYmxlZCA9IHRydWU7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gc2hvd0ltYWdlSW5WaWV3ZXIoZmlsZTogRmlsZSwgZG9uZTogKCkgPT4gdm9pZCkge1xuICB0cnkge1xuICAgIGlmIChmaWxlLnR5cGUgIT09ICdpbWFnZS9wbmcnKSB7XG4gICAgICB0aHJvdyBgRXJyb3I6IENvdWxkIG5vdCBwcm9jZXNzIFwiJHtmaWxlLm5hbWV9XCIuXFxuUGxlYXNlIHVwbG9hZCBQTkcgb25seS5gO1xuICAgIH1cbiAgICBzZWxlY3RlZF9maWxlID0gZmlsZTtcbiAgICBjb25zdCBpbWcgPSBhd2FpdCBuZXcgUHJvbWlzZTxIVE1MSW1hZ2VFbGVtZW50PigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBjb25zdCBpbWcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbWcnKTtcbiAgICAgIGltZy5zcmMgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKGZpbGUpO1xuICAgICAgaW1nLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWQnLCAoKSA9PiByZXNvbHZlKGltZykpO1xuICAgICAgaW1nLmFkZEV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgcmVqZWN0KTtcbiAgICB9KTtcbiAgICBmb3IgKGNvbnN0IGdhcCBvZiBpbWFnZV92aWV3ZXJfZ2FwcyA/PyBbXSkge1xuICAgICAgZ2FwLmNsYXNzTGlzdC5yZW1vdmUoJ3JlbW92ZScpO1xuICAgIH1cbiAgICBpZiAoaW1hZ2Vfdmlld2VyKSB7XG4gICAgICBpbWFnZV92aWV3ZXIucXVlcnlTZWxlY3RvcignaW1nJyk/LnJlbW92ZSgpO1xuICAgICAgaW1hZ2Vfdmlld2VyLmNsYXNzTGlzdC5hZGQoJ2ltYWdlLWxvYWRlZCcpO1xuICAgICAgaW1hZ2Vfdmlld2VyLmNsYXNzTGlzdC5yZW1vdmUoJ3JlbW92ZScpO1xuICAgICAgaW1hZ2Vfdmlld2VyLmFwcGVuZENoaWxkKGltZyk7XG4gICAgfVxuICAgIGlmIChlZGl0X2J1dHRvbnMpIHtcbiAgICAgIGZvciAoY29uc3QgYnV0dG9uIG9mIGVkaXRfYnV0dG9ucy5xdWVyeVNlbGVjdG9yQWxsKCdidXR0b24nKSkge1xuICAgICAgICBidXR0b24uZGlzYWJsZWQgPSBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgQ29uc29sZUVycm9yKGVycm9yKTtcbiAgICBhZGRUZXh0c1RvT3V0cHV0KGVycm9yIGFzIGFueSwgdHJ1ZSk7XG4gICAgcmVzZXRWaWV3ZXIoKTtcbiAgfVxuICAvLyBkb25lKCk7XG59XG5cbmlmIChidG5faW5zcGVjdCBpbnN0YW5jZW9mIEhUTUxCdXR0b25FbGVtZW50KSB7XG4gIGJ0bl9pbnNwZWN0LmRpc2FibGVkID0gdHJ1ZTtcbiAgYnRuX2luc3BlY3QuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBhc3luYyAoKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGJ5dGVzID0gYXdhaXQgR2V0Qnl0ZXMoc2VsZWN0ZWRfZmlsZSk7XG4gICAgICBjb25zdCBuYW1lID0gc2VsZWN0ZWRfZmlsZT8ubmFtZTtcbiAgICAgIGlmIChieXRlcykge1xuICAgICAgICBjb25zdCBsb2dzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICBpZiAobmFtZSkgbG9ncy5wdXNoKGBcIiR7bmFtZX1cIlxcbmApO1xuICAgICAgICBQTkdJbnNwZWN0KGJ5dGVzLCAoZGF0YTogYW55W10gPSBbXSkgPT4ge1xuICAgICAgICAgIGxvZ3MucHVzaChkYXRhLmpvaW4oJyAnKSk7XG4gICAgICAgIH0pO1xuICAgICAgICBhZGRUZXh0c1RvT3V0cHV0KGxvZ3MpO1xuICAgICAgICBhZGRUZXh0c1RvT3V0cHV0KFtgSW5zcGVjdGlvbiByZXBvcnQgZm9yIFwiJHtuYW1lfVwiYF0pO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBDb25zb2xlRXJyb3IoZXJyb3IpO1xuICAgIH1cbiAgfSk7XG59XG5pZiAoYnRuX3NwbGl0IGluc3RhbmNlb2YgSFRNTEJ1dHRvbkVsZW1lbnQpIHtcbiAgYnRuX3NwbGl0LmRpc2FibGVkID0gdHJ1ZTtcbiAgYnRuX3NwbGl0LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IGJ5dGVzID0gYXdhaXQgR2V0Qnl0ZXMoc2VsZWN0ZWRfZmlsZSk7XG4gICAgY29uc3QgbmFtZSA9IHNlbGVjdGVkX2ZpbGU/Lm5hbWU7XG4gICAgaWYgKGJ5dGVzKSB7XG4gICAgICBjb25zdCBzaXplX2lucHV0ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3NwbGl0LXNpemUnKTtcbiAgICAgIGNvbnN0IHNpemUgPSBzaXplX2lucHV0IGluc3RhbmNlb2YgSFRNTElucHV0RWxlbWVudCA/IE51bWJlci5wYXJzZUludChzaXplX2lucHV0LnZhbHVlID8/ICcxMDAwJykgOiAxMDAwO1xuICAgICAgY29uc3Qgb3V0cHV0X2J1ZmZlcnMgPSBhd2FpdCBQTkdTcGxpdChieXRlcywgc2l6ZSk7XG4gICAgICBhd2FpdCBhZGRJbWFnZXNUb091dHB1dChvdXRwdXRfYnVmZmVycyk7XG4gICAgICBhZGRUZXh0c1RvT3V0cHV0KFtgU3BsaXQgcmVzdWx0cyBmb3IgXCIke25hbWV9XCJgLCAnJywgYFNpemU6ICR7c2l6ZV9pbnB1dH1gXSk7XG4gICAgfVxuICB9KTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gYWRkSW1hZ2VzVG9PdXRwdXQoYnVmZmVyczogVWludDhBcnJheVtdKSB7XG4gIGNvbnN0IGltZ3MgPSBbXTtcbiAgZm9yIChjb25zdCBidWZmZXIgb2YgYnVmZmVycykge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBpbWdfdXJsID0gVVJMLmNyZWF0ZU9iamVjdFVSTChuZXcgQmxvYihbYnVmZmVyXSwgeyB0eXBlOiAnaW1hZ2UvcG5nJyB9KSk7XG4gICAgICBjb25zdCBpbWcgPSBhd2FpdCBuZXcgUHJvbWlzZTxIVE1MSW1hZ2VFbGVtZW50PigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGNvbnN0IGltZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2ltZycpO1xuICAgICAgICBpbWcuc3JjID0gaW1nX3VybDtcbiAgICAgICAgaW1nLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWQnLCAoKSA9PiByZXNvbHZlKGltZykpO1xuICAgICAgICBpbWcuYWRkRXZlbnRMaXN0ZW5lcignZXJyb3InLCByZWplY3QpO1xuICAgICAgfSk7XG4gICAgICBpbWdzLnB1c2goaW1nKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgQ29uc29sZUVycm9yKGVycm9yKTtcbiAgICB9XG4gIH1cbiAgaWYgKG91dHB1dF9jb250YWluZXIpIHtcbiAgICBvdXRwdXRfY29udGFpbmVyLmNsYXNzTGlzdC5yZW1vdmUoJ3JlbW92ZScpO1xuICAgIGZvciAoY29uc3QgZ2FwIG9mIG91dHB1dF9jb250YWluZXJfZ2FwcyA/PyBbXSkge1xuICAgICAgZ2FwLmNsYXNzTGlzdC5yZW1vdmUoJ3JlbW92ZScpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGltZyBvZiBpbWdzLnJldmVyc2UoKSkge1xuICAgICAgb3V0cHV0X2NvbnRhaW5lci5wcmVwZW5kKGltZyk7XG4gICAgfVxuICAgIGltZ3MuYXQoLTEpPy5zY3JvbGxJbnRvVmlldyhmYWxzZSk7XG4gIH1cbiAgcmV0dXJuIGltZ3M7XG59XG5cbmZ1bmN0aW9uIGFkZFRleHRzVG9PdXRwdXQodGV4dHM6IE48c3RyaW5nPiwgaXNfZXJyb3IgPSBmYWxzZSkge1xuICB0cnkge1xuICAgIGlmICghQXJyYXkuaXNBcnJheSh0ZXh0cykpIHtcbiAgICAgIHRleHRzID0gW3RleHRzXTtcbiAgICB9XG4gICAgaWYgKG91dHB1dF9jb250YWluZXIpIHtcbiAgICAgIG91dHB1dF9jb250YWluZXIuY2xhc3NMaXN0LnJlbW92ZSgncmVtb3ZlJyk7XG4gICAgICBmb3IgKGNvbnN0IGdhcCBvZiBvdXRwdXRfY29udGFpbmVyX2dhcHMgPz8gW10pIHtcbiAgICAgICAgZ2FwLmNsYXNzTGlzdC5yZW1vdmUoJ3JlbW92ZScpO1xuICAgICAgfVxuICAgICAgY29uc3QgZGl2X291dGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICBjb25zdCBkaXZfaW5uZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgIGNvbnN0IHByZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3ByZScpO1xuICAgICAgcHJlLnRleHRDb250ZW50ID0gdGV4dHMuam9pbignXFxuJyk7XG4gICAgICBpZiAoaXNfZXJyb3IpIHtcbiAgICAgICAgcHJlLmNsYXNzTGlzdC5hZGQoJ2Vycm9yLW1lc3NhZ2UnKTtcbiAgICAgICAgY29uc3QgZGVsZXRlX2J1dHRvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICBkZWxldGVfYnV0dG9uLmNsYXNzTGlzdC5hZGQoJ2RlbGV0ZS1vdXRwdXQnKTtcbiAgICAgICAgZGVsZXRlX2J1dHRvbi50ZXh0Q29udGVudCA9ICdYJztcbiAgICAgICAgZGl2X2lubmVyLmFwcGVuZENoaWxkKGRlbGV0ZV9idXR0b24pO1xuICAgICAgICBkZWxldGVfYnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgIGRpdl9vdXRlci5yZW1vdmUoKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBkaXZfaW5uZXIuYXBwZW5kQ2hpbGQocHJlKTtcbiAgICAgIGRpdl9vdXRlci5hcHBlbmRDaGlsZChkaXZfaW5uZXIpO1xuICAgICAgb3V0cHV0X2NvbnRhaW5lci5wcmVwZW5kKGRpdl9vdXRlcik7XG4gICAgICBkaXZfb3V0ZXIuc2Nyb2xsSW50b1ZpZXcoZmFsc2UpO1xuICAgICAgcmV0dXJuIGRpdl9vdXRlcjtcbiAgICB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgQ29uc29sZUVycm9yKGVycm9yKTtcbiAgfVxufVxuIgogIF0sCiAgIm1hcHBpbmdzIjogIjtBQUFBLGVBQXNCLEtBQUssQ0FBQyxJQUFZO0FBQ3RDLFFBQU0sSUFBSSxRQUFRLENBQUMsWUFBWSxXQUFXLFNBQVMsRUFBRSxDQUFDO0FBQUE7OztBQ0VqRCxNQUFNLE1BQWE7QUFBQSxFQUVGO0FBQUEsRUFEWixrQkFBa0IsSUFBSTtBQUFBLEVBQ2hDLFdBQVcsQ0FBVyxPQUFlO0FBQWY7QUFBQTtBQUFBLEVBQ3RCLFNBQVMsQ0FBQyxVQUFtRDtBQUMzRCxTQUFLLGdCQUFnQixJQUFJLFFBQVE7QUFDakMsUUFBSSxLQUFLLFVBQVUsV0FBVztBQUM1QixlQUFTLEtBQUssT0FBTyxNQUFNO0FBQ3pCLGFBQUssZ0JBQWdCLE9BQU8sUUFBUTtBQUFBLE9BQ3JDO0FBQUEsSUFDSDtBQUNBLFdBQU8sTUFBTTtBQUNYLFdBQUssZ0JBQWdCLE9BQU8sUUFBUTtBQUFBO0FBQUE7QUFBQSxFQUd4QyxHQUFHLEdBQW1CO0FBQ3BCLFdBQU8sSUFBSSxRQUFlLENBQUMsWUFBWTtBQUNyQyxXQUFLLFVBQVUsQ0FBQyxPQUFPLGdCQUFnQjtBQUNyQyxvQkFBWTtBQUNaLGdCQUFRLEtBQUs7QUFBQSxPQUNkO0FBQUEsS0FDRjtBQUFBO0FBQUEsRUFFSCxHQUFHLENBQUMsT0FBb0I7QUFDdEIsUUFBSSxLQUFLLFVBQVUsV0FBVztBQUM1QixXQUFLLFFBQVE7QUFDYixpQkFBVyxZQUFZLEtBQUssaUJBQWlCO0FBQzNDLGlCQUFTLE9BQU8sTUFBTTtBQUNwQixlQUFLLGdCQUFnQixPQUFPLFFBQVE7QUFBQSxTQUNyQztBQUFBLE1BQ0g7QUFBQSxJQUNGO0FBQUE7QUFFSjtBQUVPO0FBQUEsTUFBTSxNQUFhO0FBQUEsRUFJWjtBQUFBLEVBQ0E7QUFBQSxFQUpGO0FBQUEsRUFDQSxrQkFBa0IsSUFBSTtBQUFBLEVBQ2hDLFdBQVcsQ0FDQyxjQUNBLHFCQUE4QixPQUN4QztBQUZVO0FBQ0E7QUFFVixTQUFLLGVBQWU7QUFBQTtBQUFBLEVBRXRCLFNBQVMsQ0FBQyxVQUFtRDtBQUMzRCxTQUFLLGdCQUFnQixJQUFJLFFBQVE7QUFDakMsVUFBTSxjQUFjLE1BQU07QUFDeEIsV0FBSyxnQkFBZ0IsT0FBTyxRQUFRO0FBQUE7QUFFdEMsYUFBUyxLQUFLLGNBQWMsV0FBVztBQUN2QyxXQUFPO0FBQUE7QUFBQSxFQUVULEdBQUcsR0FBbUI7QUFDcEIsV0FBTyxJQUFJLFFBQWUsQ0FBQyxZQUFZO0FBQ3JDLFdBQUssVUFBVSxDQUFDLE9BQU8sZ0JBQWdCO0FBQ3JDLG9CQUFZO0FBQ1osZ0JBQVEsS0FBSztBQUFBLE9BQ2Q7QUFBQSxLQUNGO0FBQUE7QUFBQSxFQUVILEdBQUcsQ0FBQyxPQUFvQjtBQUN0QixRQUFJLEtBQUssc0JBQXNCLEtBQUssaUJBQWlCO0FBQU87QUFDNUQsU0FBSyxlQUFlO0FBQ3BCLGVBQVcsWUFBWSxLQUFLLGlCQUFpQjtBQUMzQyxlQUFTLE9BQU8sTUFBTTtBQUNwQixhQUFLLGdCQUFnQixPQUFPLFFBQVE7QUFBQSxPQUNyQztBQUFBLElBQ0g7QUFBQTtBQUFBLEVBRUYsTUFBTSxDQUFDLFVBQXVDO0FBQzVDLFNBQUssSUFBSSxTQUFTLEtBQUssWUFBWSxDQUFDO0FBQUE7QUFFeEM7OztBQzFFTyxTQUFTLFVBQVUsSUFBSSxPQUFjO0FBQzFDLFVBQVEsT0FBTyxHQUFHLEtBQUs7QUFBQTtBQUVsQixTQUFTLFlBQVksSUFBSSxPQUFjO0FBQzVDLFVBQVEsU0FBUyxHQUFHLEtBQUs7QUFBQTs7O0FDQ3BCLE1BQU0sU0FBb0M7QUFBQSxFQUk1QjtBQUFBLEVBQW5CLFdBQVcsQ0FBUSxVQUFrQjtBQUFsQjtBQUFBO0FBQUEsT0FNTixNQUFLLEdBQUc7QUFDbkIsU0FBSyxVQUFVO0FBQ2YsVUFBTSxLQUFLO0FBQUE7QUFBQSxFQUVOLEdBQUcsQ0FBQyxJQUEyQixLQUFXO0FBQy9DLFFBQUksS0FBSyxZQUFZLE9BQU87QUFDMUIsV0FBSyxNQUFNLEtBQUssRUFBRSxJQUFJLElBQUksQ0FBQztBQUMzQixVQUFJLEtBQUssWUFBWSxPQUFPO0FBQzFCLGFBQUssVUFBVTtBQUNmLGFBQUssSUFBSTtBQUFBLE1BQ1g7QUFBQSxJQUNGO0FBQUE7QUFBQSxNQUtTLElBQUksR0FBRztBQUNoQixXQUFPLElBQUksUUFBYyxDQUFDLFlBQVk7QUFDcEMsV0FBSyxhQUFhLFVBQVUsQ0FBQyxVQUFVO0FBQ3JDLFlBQUksVUFBVTtBQUFHLGtCQUFRO0FBQUEsT0FDMUI7QUFBQSxLQUNGO0FBQUE7QUFBQSxPQU9VLE1BQUssR0FBRztBQUNuQixRQUFJLEtBQUssWUFBWSxRQUFTLE1BQU0sS0FBSyxhQUFhLElBQUksSUFBSyxHQUFHO0FBQ2hFLFlBQU07QUFBQSxJQUNSO0FBQ0EsU0FBSyxVQUFVO0FBQ2YsU0FBSyxrQkFBa0I7QUFDdkIsU0FBSyxNQUFNLFNBQVM7QUFDcEIsU0FBSyxhQUFhO0FBQ2xCLFNBQUssUUFBUSxTQUFTO0FBQUE7QUFBQSxFQUVqQixTQUFTLENBQUMsVUFBeUQ7QUFDeEUsU0FBSyxnQkFBZ0IsSUFBSSxRQUFRO0FBQ2pDLGVBQVcsVUFBVSxLQUFLLFNBQVM7QUFDakMsVUFBSSxTQUFTLE9BQU8sT0FBTyxPQUFPLEtBQUssR0FBRyxVQUFVLE1BQU07QUFDeEQsYUFBSyxnQkFBZ0IsT0FBTyxRQUFRO0FBQ3BDLGVBQU8sTUFBTTtBQUFBO0FBQUEsTUFDZjtBQUFBLElBQ0Y7QUFDQSxXQUFPLE1BQU07QUFDWCxXQUFLLGdCQUFnQixPQUFPLFFBQVE7QUFBQTtBQUFBO0FBQUEsRUFHOUIsVUFBVTtBQUFBLEVBQ1Ysa0JBQWtCO0FBQUEsRUFDbEIsUUFBb0QsQ0FBQztBQUFBLEVBQ3JELGFBQWE7QUFBQSxFQUNiLFVBQStDLENBQUM7QUFBQSxFQUNoRCxVQUFVO0FBQUEsRUFDVixlQUFlLElBQUksTUFBTSxDQUFDO0FBQUEsRUFDMUIsa0JBQWtCLElBQUk7QUFBQSxFQUN0QixHQUFHLEdBQUc7QUFDZCxRQUFJLEtBQUssWUFBWSxTQUFTLEtBQUssYUFBYSxLQUFLLE1BQU0sUUFBUTtBQUNqRSxjQUFRLElBQUksUUFBUSxLQUFLLE1BQU0sS0FBSztBQUNwQyxPQUFDLFlBQVk7QUFDWCxhQUFLLGFBQWEsT0FBTyxDQUFDLFVBQVU7QUFDbEMsaUJBQU8sUUFBUTtBQUFBLFNBQ2hCO0FBQ0QsWUFBSTtBQUNGLGdCQUFNLFFBQVEsTUFBTSxHQUFHO0FBQ3ZCLGVBQUssS0FBSyxFQUFFLE9BQU8sSUFBSSxDQUFDO0FBQUEsaUJBQ2pCLE9BQVA7QUFDQSxxQkFBVyxLQUFLO0FBQ2hCLGVBQUssS0FBSyxFQUFFLE9BQU8sSUFBSSxDQUFDO0FBQUE7QUFFMUIsYUFBSyxhQUFhLE9BQU8sQ0FBQyxVQUFVO0FBQ2xDLGlCQUFPLFFBQVE7QUFBQSxTQUNoQjtBQUNELFlBQUksS0FBSyxXQUFXLEdBQUc7QUFDckIsZUFBSyxJQUFJO0FBQUEsUUFDWDtBQUFBLFNBQ0M7QUFDSCxVQUFJLEtBQUssWUFBWSxHQUFHO0FBQ3RCLG1CQUFXLE1BQU0sS0FBSyxJQUFJLEdBQUcsS0FBSyxRQUFRO0FBQUEsTUFDNUM7QUFBQSxJQUNGLE9BQU87QUFDTCxXQUFLLFVBQVU7QUFBQTtBQUFBO0FBQUEsRUFHVCxJQUFJLENBQUMsUUFBc0Q7QUFDbkUsUUFBSSxLQUFLLFlBQVksT0FBTztBQUMxQixXQUFLO0FBQ0wsV0FBSyxRQUFRLEtBQUssTUFBTTtBQUN4QixpQkFBVyxZQUFZLEtBQUssaUJBQWlCO0FBQzNDLFlBQUksU0FBUyxPQUFPLE9BQU8sT0FBTyxPQUFPLE9BQU8sR0FBRyxHQUFHLFVBQVUsTUFBTTtBQUNwRSxlQUFLLGdCQUFnQixPQUFPLFFBQVE7QUFBQSxRQUN0QztBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUE7QUFFSjs7O0FDOUdPLE1BQU0sa0JBQTJCO0FBQUEsRUFDaEI7QUFBQSxFQUF0QixXQUFXLENBQVcsSUFBNEc7QUFBNUc7QUFBQTtBQUFBLFNBQ2YsT0FBTyxDQUFDLE1BQXFEO0FBQ2xFLFVBQU0sT0FBZ0MsQ0FBQyxJQUFJO0FBQzNDLGFBQVMsSUFBSSxFQUFHLElBQUksS0FBSyxRQUFRLEtBQUs7QUFDcEMsdUJBQWlCLFdBQVcsS0FBSyxHQUFHLEtBQUssSUFBSSxDQUFDLFVBQVU7QUFDdEQsYUFBSyxLQUFLLEtBQUs7QUFBQSxPQUNoQixHQUFHO0FBQ0YsY0FBTTtBQUFBLE1BQ1I7QUFBQSxJQUNGO0FBQUE7QUFFSjs7O0FDWk8sTUFBTSx5QkFBeUI7QUFBQSxFQUNwQyxPQUEyQixDQUFDO0FBQUEsRUFDNUIsV0FBVyxDQUFDLE9BQTJEO0FBQ3JFLFFBQUksaUJBQWlCLGtCQUFrQjtBQUNyQyxXQUFLLE9BQU8sQ0FBQyxLQUFLO0FBQUEsSUFDcEIsV0FBVyxpQkFBaUIsc0JBQXNCO0FBQ2hELFdBQUssT0FBTyxNQUFNLEtBQUssS0FBSztBQUFBLElBQzlCLFdBQVcsTUFBTSxRQUFRLEtBQUssR0FBRztBQUMvQixXQUFLLE9BQU87QUFBQSxJQUNkO0FBQUE7QUFBQSxHQUVELFVBQVUsR0FBK0I7QUFDeEMsZUFBVyxRQUFRLEtBQUssTUFBTTtBQUM1QixZQUFNLFFBQVMsS0FBa0YsYUFBYSxLQUFLLEtBQUssbUJBQW1CO0FBQzNJLGlCQUFXLG9CQUFvQixlQUFlLGlCQUFpQixpQkFBaUI7QUFDOUUsY0FBTTtBQUFBLE1BQ1IsT0FBTztBQUVMLGNBQU07QUFBQTtBQUFBLElBRVY7QUFBQTtBQUFBLEdBRUQsU0FBUyxHQUFvQjtBQUM1QixlQUFXLFFBQVEsS0FBSyxNQUFNO0FBQzVCLFlBQU0sT0FBTyxLQUFLLFlBQVk7QUFDOUIsVUFBSSxnQkFBZ0IsTUFBTTtBQUN4QixjQUFNO0FBQUEsTUFDUjtBQUFBLElBQ0Y7QUFBQTtBQUFBLFNBRUssV0FBVyxHQUEyQjtBQUMzQyxlQUFXLFFBQVEsS0FBSyxNQUFNO0FBQzVCLFlBQU0sTUFBTSxJQUFJLFFBQWdCLENBQUMsU0FBUyxXQUFXO0FBQ25ELG1CQUFXLEtBQUssZ0JBQWdCLFlBQVk7QUFDMUMsZUFBSyxZQUFZLE9BQU87QUFBQSxRQUMxQixPQUFPO0FBQ0wsaUJBQU87QUFBQTtBQUFBLE9BRVY7QUFBQSxJQUNIO0FBQUE7QUFFSjs7O0FDbkNPLFNBQVMsUUFBUSxDQUFDLFFBQTJDO0FBQ2xFLE1BQUksY0FBYztBQUNsQixhQUFXLFNBQVMsUUFBUTtBQUMxQixtQkFBZSxNQUFNO0FBQUEsRUFDdkI7QUFDQSxRQUFNLFNBQVMsSUFBSSxXQUFXLFdBQVc7QUFDekMsTUFBSSxTQUFTO0FBQ2IsYUFBVyxTQUFTLFFBQVE7QUFDMUIsV0FBTyxJQUFJLE9BQU8sTUFBTTtBQUN4QixjQUFVLE1BQU07QUFBQSxFQUNsQjtBQUNBLFNBQU87QUFBQTtBQU9GLFNBQVMsWUFBWSxDQUFDLE1BQWM7QUFDekMsU0FBTyxJQUFJLFlBQVksRUFBRSxPQUFPLElBQUk7QUFBQTtBQUcvQixTQUFTLFlBQVksQ0FBQyxNQUEwQjtBQUNyRCxRQUFNLE1BQU0sSUFBSSxXQUFXLENBQUM7QUFDNUIsUUFBTSxPQUFPLElBQUksU0FBUyxJQUFJLE1BQU07QUFDcEMsT0FBSyxVQUFVLEdBQUcsU0FBUyxHQUFHLEtBQUs7QUFDbkMsU0FBTztBQUFBO0FBR0YsU0FBUyxPQUFPLENBQUMsT0FBbUIsT0FBNkI7QUFDdEUsTUFBSSxRQUFRLE1BQU0sWUFBWTtBQUM1QixXQUFPLENBQUMsTUFBTSxNQUFNLENBQUM7QUFBQSxFQUN2QjtBQUNBLE1BQUksUUFBUSxHQUFHO0FBQ2IsVUFBTSxRQUFzQixDQUFDO0FBQzdCLGFBQVMsSUFBSSxFQUFHLElBQUksTUFBTSxRQUFRLEtBQUssT0FBTztBQUM1QyxZQUFNLEtBQUssTUFBTSxNQUFNLEdBQUcsSUFBSSxLQUFLLENBQUM7QUFBQSxJQUN0QztBQUNBLFdBQU87QUFBQSxFQUNUO0FBQ0EsU0FBTyxDQUFDLE1BQU0sTUFBTSxDQUFDO0FBQUE7QUFHaEIsU0FBUyxNQUFNLENBQUMsT0FBbUIsT0FBeUM7QUFDakYsTUFBSSxRQUFRLE1BQU0sWUFBWTtBQUM1QixXQUFPLENBQUMsTUFBTSxNQUFNLEdBQUcsSUFBSSxVQUFZO0FBQUEsRUFDekM7QUFDQSxNQUFJLFFBQVEsR0FBRztBQUNiLFVBQU0sU0FBUyxNQUFNLE1BQU0sR0FBRyxLQUFLO0FBQ25DLFVBQU0sU0FBUyxNQUFNLE1BQU0sS0FBSztBQUNoQyxXQUFPLENBQUMsUUFBUSxNQUFNO0FBQUEsRUFDeEI7QUFDQSxTQUFPLENBQUMsSUFBSSxZQUFjLE1BQU0sTUFBTSxDQUFDO0FBQUE7QUFlbEMsU0FBUyxTQUFTLENBQUMsT0FBMkI7QUFDbkQsU0FBTyxNQUFNLEtBQUssS0FBSyxFQUNwQixJQUFJLENBQUMsU0FBUyxPQUFPLGFBQWEsU0FBUyxDQUFDLENBQUMsRUFDN0MsS0FBSyxFQUFFO0FBQUE7QUFPTCxTQUFTLE9BQU8sQ0FBQyxPQUE2QjtBQUNuRCxTQUFPLE1BQU0sS0FBSyxLQUFLLEVBQUUsSUFBSSxDQUFDLFVBQVUsU0FBUyxHQUFHLFNBQVMsRUFBRSxFQUFFLFNBQVMsR0FBRyxHQUFHLENBQUM7QUFBQTs7O0FDcEZuRixlQUFzQixlQUFlLENBQUMsUUFBb0M7QUFDeEUsUUFBTSxTQUFTLE9BQU8sVUFBVTtBQUNoQyxRQUFNLFNBQXVCLENBQUM7QUFDOUIsU0FBTyxNQUFNO0FBQ1gsWUFBUSxNQUFNLFVBQVUsTUFBTSxPQUFPLEtBQUs7QUFDMUMsUUFBSSxPQUFPO0FBQ1QsYUFBTyxLQUFLLEtBQUs7QUFBQSxJQUNuQjtBQUNBLFFBQUksTUFBTTtBQUNSO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDQSxTQUFPLFNBQVMsTUFBTTtBQUFBOzs7QUNaakIsU0FBUyxxQkFBcUIsQ0FBQyxNQUFnQztBQUNwRSxhQUFXLEtBQUssdUJBQXVCLGFBQWE7QUFDbEQsV0FBTyxLQUFLO0FBQUEsRUFDZDtBQUFBO0FBR0ssU0FBUyxRQUFRLENBQUMsTUFBYTtBQUNwQyxNQUFJLE1BQU07QUFDUixlQUFXLEtBQUssVUFBVSxhQUFhO0FBQ3JDLGFBQU8sS0FBSyxNQUFNO0FBQUEsSUFDcEI7QUFDQSxXQUFPLGdCQUFnQixLQUFLLE9BQU8sQ0FBQztBQUFBLEVBQ3RDO0FBQUE7OztBQ2RLLE1BQU0sd0JBQXdCO0FBQUEsRUFDbkMsT0FBMEIsQ0FBQztBQUFBLEVBQzNCLFdBQVcsQ0FBQyxTQUFzRDtBQUNoRSxRQUFJLFNBQVM7QUFDWCxVQUFJLE1BQU0sUUFBUSxPQUFPLEdBQUc7QUFDMUIsYUFBSyxPQUFPO0FBQUEsTUFDZCxPQUFPO0FBQ0wsYUFBSyxPQUFPLENBQUMsT0FBTztBQUFBO0FBQUEsSUFFeEI7QUFBQTtBQUFBLEdBRUQsaUJBQWlCLEdBQXdDO0FBQ3hELGVBQVcsU0FBUyxLQUFLLE1BQU07QUFDN0IsVUFBSSxNQUFNLGVBQWUsaUJBQWlCLDBCQUEwQjtBQUNsRSxjQUFNO0FBQUEsTUFDUjtBQUFBLElBQ0Y7QUFBQTtBQUFBLEdBRUQsWUFBWSxHQUFtQztBQUM5QyxlQUFXLFNBQVMsS0FBSyxNQUFNO0FBQzdCLGlCQUFXLHdCQUF3QixlQUFlLE1BQU0sVUFBVSxpQkFBaUIscUJBQXFCO0FBQ3RHLGNBQU07QUFBQSxNQUNSLE9BQU87QUFDTCxjQUFNO0FBQUE7QUFBQSxJQUVWO0FBQUE7QUFFSjtBQUVPO0FBQUEsTUFBTSxpQ0FBaUM7QUFBQSxFQUM1QyxPQUFtQyxDQUFDO0FBQUEsRUFDcEMsV0FBVyxDQUFDLFNBQXdFO0FBQ2xGLFFBQUksbUJBQW1CLDBCQUEwQjtBQUMvQyxXQUFLLE9BQU8sQ0FBQyxPQUFPO0FBQUEsSUFDdEIsV0FBVyxNQUFNLFFBQVEsT0FBTyxHQUFHO0FBQ2pDLFdBQUssT0FBTztBQUFBLElBQ2Q7QUFBQTtBQUFBLFNBRUssUUFBUSxHQUFvQztBQUNqRCxlQUFXLFNBQVMsS0FBSyxNQUFNO0FBQzdCLFlBQU0sU0FBUyxNQUFNLGFBQWE7QUFDbEMsaUJBQVcsVUFBUyxNQUFNLElBQUksUUFBMkIsQ0FBQyxTQUFTLFdBQVcsT0FBTyxZQUFZLFNBQVMsTUFBTSxDQUFDLEdBQUc7QUFDbEgsY0FBTTtBQUFBLE1BQ1I7QUFBQSxJQUNGO0FBQUE7QUFFSjs7O0FDNUNPLFNBQVMsZ0JBQWdCLENBQUMsU0FBbUU7QUFDbEcsU0FBTyxRQUFRLGlCQUFpQjtBQUFBO0FBRzNCLFNBQVMsdUJBQXVCLEdBQVk7QUFDakQsU0FBTyx5QkFBeUIsS0FBSyxPQUFPLFVBQVUsU0FBUyxNQUFNLE9BQU8sUUFBUTtBQUFBOzs7QUNFL0UsU0FBUywwQkFBMEIsQ0FDeEMsV0FDQSxJQVVBLFNBS0E7QUFDQSxRQUFNLFVBQVUsVUFBVSxjQUFjLE9BQU87QUFDL0MsT0FBSyxTQUFTO0FBQ1osVUFBTTtBQUFBLEVBQ1I7QUFDQSxNQUFJLFNBQVMsUUFBUTtBQUNuQixZQUFRLGFBQWEsVUFBVSxRQUFRLE1BQU07QUFBQSxFQUMvQztBQUNBLE1BQUksU0FBUyxjQUFjLFFBQVEsd0JBQXdCLEdBQUc7QUFDNUQsWUFBUSxnQkFBZ0IsbUJBQW1CLElBQUk7QUFBQSxFQUNqRDtBQUNBLE1BQUksU0FBUyxhQUFhLE1BQU07QUFDOUIsWUFBUSxnQkFBZ0IsWUFBWSxJQUFJO0FBQUEsRUFDMUM7QUFFQSxNQUFJLEdBQUcsYUFBYSxHQUFHLGVBQWUsR0FBRyxhQUFhO0FBQ3BELFVBQU0sa0JBQWtCLE1BQU07QUFDNUIsY0FBUSxpQkFBaUIsYUFBYSxnQkFBZ0I7QUFDdEQsY0FBUSxpQkFBaUIsV0FBVyxjQUFjO0FBQ2xELGNBQVEsaUJBQWlCLFFBQVEsWUFBVztBQUFBO0FBRTlDLFVBQU0saUJBQWlCLE1BQU07QUFDM0Isc0JBQWdCO0FBQ2hCLFNBQUcsWUFBWTtBQUFBO0FBRWpCLFVBQU0sbUJBQW1CLE1BQU07QUFDN0Isc0JBQWdCO0FBQ2hCLFNBQUcsY0FBYztBQUFBO0FBRW5CLFVBQU0sZUFBYyxNQUFNO0FBQ3hCLHNCQUFnQjtBQUNoQixTQUFHLFNBQVM7QUFBQTtBQUVkLFlBQVEsaUJBQWlCLGFBQWEsTUFBTTtBQUMxQyxjQUFRLGlCQUFpQixhQUFhLGdCQUFnQjtBQUN0RCxjQUFRLGlCQUFpQixXQUFXLGNBQWM7QUFDbEQsY0FBUSxpQkFBaUIsUUFBUSxZQUFXO0FBQzVDLFNBQUcsY0FBYztBQUFBLEtBQ2xCO0FBQUEsRUFDSDtBQUVBLFFBQU0sYUFBYSxJQUFJO0FBQ3ZCLFFBQU0sa0JBQWtCLElBQUksa0JBQXdELGdCQUFnQixDQUFDLGtCQUFpQixNQUFNO0FBQzFILHFCQUFpQixXQUFXLGtCQUFpQjtBQUMzQyxZQUFNLE9BQU8sUUFBUSxTQUFTLE1BQU0sQ0FBQztBQUNyQyxVQUFJLE1BQStCO0FBQ2pDLG1CQUFXLElBQUksSUFBSTtBQUNuQixjQUFNLFlBQVksSUFBSSx3QkFBd0IsT0FBTztBQUNyRCxtQkFBVyxlQUFlLFVBQVUsYUFBYSxHQUFHO0FBQ2xELGdCQUFNO0FBQUEsUUFDUjtBQUNBLG1CQUFXLG9CQUFvQixVQUFVLGtCQUFrQixHQUFHO0FBQzVELGVBQUssSUFBSSxpQ0FBaUMsZ0JBQWdCLEVBQUUsU0FBUyxDQUFDO0FBQUEsUUFDeEU7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEdBQ0Q7QUFFRCxRQUFNLFdBQVcsSUFBSSxTQUF1QixFQUFFO0FBQzlDLFdBQVMsVUFBVSxDQUFDLEdBQUcsVUFBVTtBQUMvQixRQUFJLE9BQU87QUFDVCxVQUFJLGdCQUFnQixLQUFLO0FBQUEsSUFDM0I7QUFBQSxHQUNEO0FBRUQsTUFBSSxPQUFPO0FBQ1gsTUFBSSxVQUFVO0FBQ2QsUUFBTSxjQUFjLFlBQVk7QUFDOUIsUUFBSSxZQUFZLE9BQU87QUFDckIsYUFBTztBQUNQLGdCQUFVO0FBQ1YsWUFBTSxHQUFHLGdCQUFnQjtBQUV6QixZQUFNLEdBQUcsRUFBRSxLQUFLLFlBQVk7QUFDMUIsY0FBTSxTQUFTO0FBQ2Ysa0JBQVU7QUFBQSxPQUNYO0FBQUEsSUFDSDtBQUFBO0FBRUYsUUFBTSxZQUFZLFlBQVk7QUFDNUIsV0FBTztBQUNQLGNBQVU7QUFDVixVQUFNLEdBQUcsY0FBYztBQUN2QixhQUFTLE1BQU07QUFDZixlQUFXLE1BQU07QUFBQTtBQUVuQixRQUFNLG1CQUFtQixPQUFPLFNBQTZDLFVBQW9CO0FBQy9GLFFBQUksU0FBUyxPQUFPO0FBQ2xCLHVCQUFpQixlQUFlLGdCQUFnQixRQUFRLE9BQU8sR0FBRztBQUNoRSxjQUFNLE9BQU8sTUFBTSxJQUFJLFFBQWMsQ0FBQyxTQUFTLFdBQVcsWUFBWSxLQUFLLFNBQVMsTUFBTSxDQUFDO0FBQzNGLGNBQU0sR0FBRyxpQkFBaUIsTUFBTSxNQUFPLE9BQU8sSUFBSztBQUVuRCxZQUFJLFNBQVM7QUFBTTtBQUFBLE1BQ3JCO0FBQ0EsaUJBQVcsUUFBUSxPQUFPO0FBQ3hCLGNBQU0sT0FBTyxzQkFBc0IsSUFBSSxJQUFJLEtBQUs7QUFDaEQsWUFBSSxNQUErQjtBQUNqQyxxQkFBVyxJQUFJLElBQUk7QUFDbkIsZ0JBQU0sR0FBRyxpQkFBaUIsTUFBTSxNQUFPLE9BQU8sSUFBSztBQUVuRCxjQUFJLFNBQVM7QUFBTTtBQUFBLFFBQ3JCO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQTtBQUVGLFFBQU0sZ0JBQWdCLE1BQU07QUFDMUIsYUFBUyxJQUFJLFlBQVk7QUFDdkIsWUFBTSxZQUFZO0FBQ2xCLFVBQUksU0FBUyxTQUFTLG1CQUFtQixvQkFBb0IsUUFBUSxPQUFPO0FBQzFFLGNBQU0saUJBQWlCLGlCQUFpQixPQUFPLEtBQUssQ0FBQyxHQUFHLFFBQVEsS0FBSztBQUFBLE1BQ3ZFO0FBQUEsT0FDQyxlQUFlO0FBQUE7QUFFcEIsUUFBTSxjQUFjLENBQUMsVUFBcUI7QUFDeEMsYUFBUyxJQUFJLFlBQVk7QUFDdkIsWUFBTSxZQUFZO0FBQ2xCLFVBQUksU0FBUyxTQUFTLE1BQU0sY0FBYztBQUN4QyxjQUFNLG9CQUFvQixJQUFJLHlCQUF5QixNQUFNLGFBQWEsS0FBSztBQUMvRSxjQUFNLGlCQUFpQixrQkFBa0IsV0FBVyxHQUFHLE1BQU0sYUFBYSxLQUFLO0FBQUEsTUFDakY7QUFBQSxPQUNDLGFBQWE7QUFBQTtBQUVsQixVQUFRLGlCQUFpQixVQUFVLGFBQWE7QUFDaEQsVUFBUSxpQkFBaUIsUUFBUSxXQUFXO0FBQUE7OztBQ3BKOUMsSUFBTSxZQUF5QixJQUFJLFlBQVksR0FBRztBQUNsRCxJQUFNLFlBQXlCLElBQUksWUFBWSxDQUFDO0FBQ2hELFVBQVUsS0FBSztBQUdmLFNBQVMsSUFBSSxFQUFHLElBQUksS0FBSyxLQUFLO0FBQzVCLE1BQUksSUFBSSxNQUFNO0FBQ2QsV0FBUyxJQUFJLEVBQUcsSUFBSSxHQUFHLEtBQUs7QUFDMUIsUUFBSSxJQUFJLEdBQUc7QUFDVCxVQUFJLFVBQVUsS0FBTSxNQUFNO0FBQUEsSUFDNUIsT0FBTztBQUNMLGFBQU87QUFBQTtBQUFBLEVBRVg7QUFDQSxZQUFVLEtBQUs7QUFDakI7QUFFTztBQUFBLE1BQU0sSUFBSTtBQUFBLFNBQ1IsSUFBSSxDQUFDLE9BQW1CO0FBQzdCLFlBQVEsSUFBSSxPQUFPLGVBQWUsR0FBRyxLQUFLLElBQUssZUFBZSxPQUFRO0FBQUE7QUFBQSxTQUVqRSxNQUFNLENBQUMsS0FBYSxPQUFtQjtBQUM1QyxRQUFJLElBQUksUUFBUTtBQUNoQixhQUFTLElBQUksRUFBRyxJQUFJLE1BQU0sUUFBUSxLQUFLO0FBQ3JDLFVBQUksVUFBVyxLQUFJLE1BQU0sTUFBTSxPQUFTLE1BQU07QUFBQSxJQUNoRDtBQUNBLFdBQU8sTUFBTTtBQUFBO0FBRWpCOzs7QUNhQSxTQUFTLE1BQU0sQ0FBQyxLQUFLO0FBQUUsTUFBSSxNQUFNLElBQUk7QUFBUSxXQUFTLE9BQU8sR0FBRztBQUFFLFFBQUksT0FBTztBQUFBLEVBQUc7QUFBQTtBQTJIaEYsU0FBUyxjQUFjLENBQUMsYUFBYSxZQUFZLFlBQVksT0FBTyxZQUFZO0FBRTlFLE9BQUssY0FBZTtBQUNwQixPQUFLLGFBQWU7QUFDcEIsT0FBSyxhQUFlO0FBQ3BCLE9BQUssUUFBZTtBQUNwQixPQUFLLGFBQWU7QUFHcEIsT0FBSyxZQUFlLGVBQWUsWUFBWTtBQUFBO0FBU2pELFNBQVMsUUFBUSxDQUFDLFVBQVUsV0FBVztBQUNyQyxPQUFLLFdBQVc7QUFDaEIsT0FBSyxXQUFXO0FBQ2hCLE9BQUssWUFBWTtBQUFBO0FBMHlFbkIsU0FBUyxNQUFNLENBQUMsYUFBYSxVQUFVLGFBQWEsV0FBVyxNQUFNO0FBRW5FLE9BQUssY0FBYztBQUNuQixPQUFLLFdBQVc7QUFDaEIsT0FBSyxjQUFjO0FBQ25CLE9BQUssWUFBWTtBQUNqQixPQUFLLE9BQU87QUFBQTtBQThDZCxTQUFTLFlBQVksR0FBRztBQUN0QixPQUFLLE9BQU87QUFDWixPQUFLLFNBQVM7QUFDZCxPQUFLLGNBQWM7QUFDbkIsT0FBSyxtQkFBbUI7QUFDeEIsT0FBSyxjQUFjO0FBQ25CLE9BQUssVUFBVTtBQUNmLE9BQUssT0FBTztBQUNaLE9BQUssU0FBUztBQUNkLE9BQUssVUFBVTtBQUNmLE9BQUssU0FBUztBQUNkLE9BQUssYUFBYTtBQUVsQixPQUFLLFNBQVM7QUFDZCxPQUFLLFNBQVM7QUFDZCxPQUFLLFNBQVM7QUFFZCxPQUFLLFNBQVM7QUFRZCxPQUFLLGNBQWM7QUFLbkIsT0FBSyxPQUFPO0FBTVosT0FBSyxPQUFPO0FBRVosT0FBSyxRQUFRO0FBQ2IsT0FBSyxZQUFZO0FBQ2pCLE9BQUssWUFBWTtBQUNqQixPQUFLLFlBQVk7QUFFakIsT0FBSyxhQUFhO0FBT2xCLE9BQUssY0FBYztBQUtuQixPQUFLLGVBQWU7QUFDcEIsT0FBSyxhQUFhO0FBQ2xCLE9BQUssa0JBQWtCO0FBQ3ZCLE9BQUssV0FBVztBQUNoQixPQUFLLGNBQWM7QUFDbkIsT0FBSyxZQUFZO0FBRWpCLE9BQUssY0FBYztBQUtuQixPQUFLLG1CQUFtQjtBQU14QixPQUFLLGlCQUFpQjtBQVl0QixPQUFLLFFBQVE7QUFDYixPQUFLLFdBQVc7QUFFaEIsT0FBSyxhQUFhO0FBR2xCLE9BQUssYUFBYTtBQVlsQixPQUFLLFlBQWEsSUFBSSxZQUFZLFlBQVksQ0FBQztBQUMvQyxPQUFLLFlBQWEsSUFBSSxhQUFhLElBQUksVUFBVSxLQUFLLENBQUM7QUFDdkQsT0FBSyxVQUFhLElBQUksYUFBYSxJQUFJLFdBQVcsS0FBSyxDQUFDO0FBQ3hELE9BQUssS0FBSyxTQUFTO0FBQ25CLE9BQUssS0FBSyxTQUFTO0FBQ25CLE9BQUssS0FBSyxPQUFPO0FBRWpCLE9BQUssU0FBVztBQUNoQixPQUFLLFNBQVc7QUFDaEIsT0FBSyxVQUFXO0FBR2hCLE9BQUssV0FBVyxJQUFJLFlBQVksV0FBVyxDQUFDO0FBSTVDLE9BQUssT0FBTyxJQUFJLFlBQVksSUFBSSxVQUFVLENBQUM7QUFDM0MsT0FBSyxLQUFLLElBQUk7QUFFZCxPQUFLLFdBQVc7QUFDaEIsT0FBSyxXQUFXO0FBS2hCLE9BQUssUUFBUSxJQUFJLFlBQVksSUFBSSxVQUFVLENBQUM7QUFDNUMsT0FBSyxLQUFLLEtBQUs7QUFJZixPQUFLLFVBQVU7QUFFZixPQUFLLGNBQWM7QUFvQm5CLE9BQUssV0FBVztBQUNoQixPQUFLLFVBQVU7QUFFZixPQUFLLFVBQVU7QUFDZixPQUFLLGFBQWE7QUFDbEIsT0FBSyxVQUFVO0FBQ2YsT0FBSyxTQUFTO0FBR2QsT0FBSyxTQUFTO0FBSWQsT0FBSyxXQUFXO0FBQUE7QUF1N0JsQixTQUFTLE9BQU8sR0FBRztBQUVqQixPQUFLLFFBQVE7QUFDYixPQUFLLFVBQVU7QUFFZixPQUFLLFdBQVc7QUFFaEIsT0FBSyxXQUFXO0FBRWhCLE9BQUssU0FBUztBQUNkLE9BQUssV0FBVztBQUVoQixPQUFLLFlBQVk7QUFFakIsT0FBSyxZQUFZO0FBRWpCLE9BQUssTUFBTTtBQUVYLE9BQUssUUFBUTtBQUViLE9BQUssWUFBWTtBQUVqQixPQUFLLFFBQVE7QUFBQTtBQTBHZixTQUFTLFNBQVMsQ0FBQyxTQUFTO0FBQzFCLE9BQUssVUFBVSxPQUFPLE9BQU87QUFBQSxJQUMzQixPQUFPO0FBQUEsSUFDUCxRQUFRO0FBQUEsSUFDUixXQUFXO0FBQUEsSUFDWCxZQUFZO0FBQUEsSUFDWixVQUFVO0FBQUEsSUFDVixVQUFVO0FBQUEsRUFDWixHQUFHLFdBQVcsQ0FBQyxDQUFDO0FBRWhCLE1BQUksTUFBTSxLQUFLO0FBRWYsTUFBSSxJQUFJLE9BQVEsSUFBSSxhQUFhLEdBQUk7QUFDbkMsUUFBSSxjQUFjLElBQUk7QUFBQSxFQUN4QixXQUVTLElBQUksUUFBUyxJQUFJLGFBQWEsS0FBTyxJQUFJLGFBQWEsSUFBSztBQUNsRSxRQUFJLGNBQWM7QUFBQSxFQUNwQjtBQUVBLE9BQUssTUFBUztBQUNkLE9BQUssTUFBUztBQUNkLE9BQUssUUFBUztBQUNkLE9BQUssU0FBUyxDQUFDO0FBRWYsT0FBSyxPQUFPLElBQUk7QUFDaEIsT0FBSyxLQUFLLFlBQVk7QUFFdEIsTUFBSSxTQUFTLFlBQVksYUFDdkIsS0FBSyxNQUNMLElBQUksT0FDSixJQUFJLFFBQ0osSUFBSSxZQUNKLElBQUksVUFDSixJQUFJLFFBQ047QUFFQSxNQUFJLFdBQVcsUUFBUTtBQUNyQixVQUFNLElBQUksTUFBTSxTQUFTLE9BQU87QUFBQSxFQUNsQztBQUVBLE1BQUksSUFBSSxRQUFRO0FBQ2QsZ0JBQVksaUJBQWlCLEtBQUssTUFBTSxJQUFJLE1BQU07QUFBQSxFQUNwRDtBQUVBLE1BQUksSUFBSSxZQUFZO0FBQ2xCLFFBQUk7QUFFSixlQUFXLElBQUksZUFBZSxVQUFVO0FBRXRDLGFBQU8sUUFBUSxXQUFXLElBQUksVUFBVTtBQUFBLElBQzFDLFdBQVcsV0FBVyxLQUFLLElBQUksVUFBVSxNQUFNLHdCQUF3QjtBQUNyRSxhQUFPLElBQUksV0FBVyxJQUFJLFVBQVU7QUFBQSxJQUN0QyxPQUFPO0FBQ0wsYUFBTyxJQUFJO0FBQUE7QUFHYixhQUFTLFlBQVkscUJBQXFCLEtBQUssTUFBTSxJQUFJO0FBRXpELFFBQUksV0FBVyxRQUFRO0FBQ3JCLFlBQU0sSUFBSSxNQUFNLFNBQVMsT0FBTztBQUFBLElBQ2xDO0FBRUEsU0FBSyxZQUFZO0FBQUEsRUFDbkI7QUFBQTtBQStKRixTQUFTLFNBQVMsQ0FBQyxPQUFPLFNBQVM7QUFDakMsUUFBTSxXQUFXLElBQUksVUFBVSxPQUFPO0FBRXRDLFdBQVMsS0FBSyxPQUFPLElBQUk7QUFHekIsTUFBSSxTQUFTLEtBQUs7QUFBRSxVQUFNLFNBQVMsT0FBTyxTQUFTLFNBQVM7QUFBQSxFQUFNO0FBRWxFLFNBQU8sU0FBUztBQUFBO0FBWWxCLFNBQVMsWUFBWSxDQUFDLE9BQU8sU0FBUztBQUNwQyxZQUFVLFdBQVcsQ0FBQztBQUN0QixVQUFRLE1BQU07QUFDZCxTQUFPLFVBQVUsT0FBTyxPQUFPO0FBQUE7QUFZakMsU0FBUyxNQUFNLENBQUMsT0FBTyxTQUFTO0FBQzlCLFlBQVUsV0FBVyxDQUFDO0FBQ3RCLFVBQVEsT0FBTztBQUNmLFNBQU8sVUFBVSxPQUFPLE9BQU87QUFBQTtBQTZ4QmpDLFNBQVMsWUFBWSxHQUFHO0FBQ3RCLE9BQUssT0FBTztBQUNaLE9BQUssT0FBTztBQUNaLE9BQUssT0FBTztBQUNaLE9BQUssT0FBTztBQUVaLE9BQUssV0FBVztBQUNoQixPQUFLLFFBQVE7QUFFYixPQUFLLE9BQU87QUFDWixPQUFLLFFBQVE7QUFDYixPQUFLLFFBQVE7QUFFYixPQUFLLE9BQU87QUFHWixPQUFLLFFBQVE7QUFDYixPQUFLLFFBQVE7QUFDYixPQUFLLFFBQVE7QUFDYixPQUFLLFFBQVE7QUFDYixPQUFLLFNBQVM7QUFHZCxPQUFLLE9BQU87QUFDWixPQUFLLE9BQU87QUFHWixPQUFLLFNBQVM7QUFDZCxPQUFLLFNBQVM7QUFHZCxPQUFLLFFBQVE7QUFHYixPQUFLLFVBQVU7QUFDZixPQUFLLFdBQVc7QUFDaEIsT0FBSyxVQUFVO0FBQ2YsT0FBSyxXQUFXO0FBR2hCLE9BQUssUUFBUTtBQUNiLE9BQUssT0FBTztBQUNaLE9BQUssUUFBUTtBQUNiLE9BQUssT0FBTztBQUNaLE9BQUssT0FBTztBQUVaLE9BQUssT0FBTyxJQUFJLFlBQVksR0FBRztBQUMvQixPQUFLLE9BQU8sSUFBSSxZQUFZLEdBQUc7QUFPL0IsT0FBSyxTQUFTO0FBQ2QsT0FBSyxVQUFVO0FBQ2YsT0FBSyxPQUFPO0FBQ1osT0FBSyxPQUFPO0FBQ1osT0FBSyxNQUFNO0FBQUE7QUFxNkNiLFNBQVMsUUFBUSxHQUFHO0FBRWxCLE9BQUssT0FBYTtBQUVsQixPQUFLLE9BQWE7QUFFbEIsT0FBSyxTQUFhO0FBRWxCLE9BQUssS0FBYTtBQUVsQixPQUFLLFFBQWE7QUFFbEIsT0FBSyxZQUFhO0FBV2xCLE9BQUssT0FBYTtBQUlsQixPQUFLLFVBQWE7QUFJbEIsT0FBSyxPQUFhO0FBRWxCLE9BQUssT0FBYTtBQUFBO0FBK0ZwQixTQUFTLFNBQVMsQ0FBQyxTQUFTO0FBQzFCLE9BQUssVUFBVSxPQUFPLE9BQU87QUFBQSxJQUMzQixXQUFXLE9BQU87QUFBQSxJQUNsQixZQUFZO0FBQUEsSUFDWixJQUFJO0FBQUEsRUFDTixHQUFHLFdBQVcsQ0FBQyxDQUFDO0FBRWhCLFFBQU0sTUFBTSxLQUFLO0FBSWpCLE1BQUksSUFBSSxPQUFRLElBQUksY0FBYyxLQUFPLElBQUksYUFBYSxJQUFLO0FBQzdELFFBQUksY0FBYyxJQUFJO0FBQ3RCLFFBQUksSUFBSSxlQUFlLEdBQUc7QUFBRSxVQUFJLGFBQWE7QUFBQSxJQUFLO0FBQUEsRUFDcEQ7QUFHQSxNQUFLLElBQUksY0FBYyxLQUFPLElBQUksYUFBYSxRQUN6QyxXQUFXLFFBQVEsYUFBYTtBQUNwQyxRQUFJLGNBQWM7QUFBQSxFQUNwQjtBQUlBLE1BQUssSUFBSSxhQUFhLE1BQVEsSUFBSSxhQUFhLElBQUs7QUFHbEQsU0FBSyxJQUFJLGFBQWEsUUFBUSxHQUFHO0FBQy9CLFVBQUksY0FBYztBQUFBLElBQ3BCO0FBQUEsRUFDRjtBQUVBLE9BQUssTUFBUztBQUNkLE9BQUssTUFBUztBQUNkLE9BQUssUUFBUztBQUNkLE9BQUssU0FBUyxDQUFDO0FBRWYsT0FBSyxPQUFTLElBQUk7QUFDbEIsT0FBSyxLQUFLLFlBQVk7QUFFdEIsTUFBSSxTQUFVLFlBQVksYUFDeEIsS0FBSyxNQUNMLElBQUksVUFDTjtBQUVBLE1BQUksV0FBVyxNQUFNO0FBQ25CLFVBQU0sSUFBSSxNQUFNLFNBQVMsT0FBTztBQUFBLEVBQ2xDO0FBRUEsT0FBSyxTQUFTLElBQUk7QUFFbEIsY0FBWSxpQkFBaUIsS0FBSyxNQUFNLEtBQUssTUFBTTtBQUduRCxNQUFJLElBQUksWUFBWTtBQUVsQixlQUFXLElBQUksZUFBZSxVQUFVO0FBQ3RDLFVBQUksYUFBYSxRQUFRLFdBQVcsSUFBSSxVQUFVO0FBQUEsSUFDcEQsV0FBVyxTQUFTLEtBQUssSUFBSSxVQUFVLE1BQU0sd0JBQXdCO0FBQ25FLFVBQUksYUFBYSxJQUFJLFdBQVcsSUFBSSxVQUFVO0FBQUEsSUFDaEQ7QUFDQSxRQUFJLElBQUksS0FBSztBQUNYLGVBQVMsWUFBWSxxQkFBcUIsS0FBSyxNQUFNLElBQUksVUFBVTtBQUNuRSxVQUFJLFdBQVcsTUFBTTtBQUNuQixjQUFNLElBQUksTUFBTSxTQUFTLE9BQU87QUFBQSxNQUNsQztBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUE7QUFrTkYsU0FBUyxTQUFTLENBQUMsT0FBTyxTQUFTO0FBQ2pDLFFBQU0sV0FBVyxJQUFJLFVBQVUsT0FBTztBQUV0QyxXQUFTLEtBQUssS0FBSztBQUduQixNQUFJLFNBQVM7QUFBSyxVQUFNLFNBQVMsT0FBTyxTQUFTLFNBQVM7QUFFMUQsU0FBTyxTQUFTO0FBQUE7QUFZbEIsU0FBUyxZQUFZLENBQUMsT0FBTyxTQUFTO0FBQ3BDLFlBQVUsV0FBVyxDQUFDO0FBQ3RCLFVBQVEsTUFBTTtBQUNkLFNBQU8sVUFBVSxPQUFPLE9BQU87QUFBQTtBQXRvTmpDO0FBQUEsSUFBTSxZQUEwQjtBQUloQyxJQUFNLFdBQXdCO0FBQzlCLElBQU0sU0FBd0I7QUFFOUIsSUFBTSxjQUEwQjtBQVNoQyxJQUFNLGVBQWU7QUFDckIsSUFBTSxlQUFlO0FBQ3JCLElBQU0sWUFBZTtBQUdyQixJQUFNLGNBQWlCO0FBQ3ZCLElBQU0sY0FBaUI7QUFRdkIsSUFBTSxpQkFBa0I7QUFHeEIsSUFBTSxhQUFrQjtBQUd4QixJQUFNLFlBQWtCLGFBQWEsSUFBSTtBQUd6QyxJQUFNLFlBQWtCO0FBR3hCLElBQU0sYUFBa0I7QUFHeEIsSUFBTSxjQUFrQixJQUFJLFlBQVk7QUFHeEMsSUFBTSxhQUFrQjtBQUd4QixJQUFNLFdBQWdCO0FBUXRCLElBQU0sY0FBYztBQUdwQixJQUFNLFlBQWM7QUFHcEIsSUFBTSxVQUFjO0FBR3BCLElBQU0sWUFBYztBQUdwQixJQUFNLGNBQWM7QUFJcEIsSUFBTSxjQUNKLElBQUksV0FBVyxDQUFDLEdBQUUsR0FBRSxHQUFFLEdBQUUsR0FBRSxHQUFFLEdBQUUsR0FBRSxHQUFFLEdBQUUsR0FBRSxHQUFFLEdBQUUsR0FBRSxHQUFFLEdBQUUsR0FBRSxHQUFFLEdBQUUsR0FBRSxHQUFFLEdBQUUsR0FBRSxHQUFFLEdBQUUsR0FBRSxHQUFFLEdBQUUsQ0FBQyxDQUFDO0FBRTVFLElBQU0sY0FDSixJQUFJLFdBQVcsQ0FBQyxHQUFFLEdBQUUsR0FBRSxHQUFFLEdBQUUsR0FBRSxHQUFFLEdBQUUsR0FBRSxHQUFFLEdBQUUsR0FBRSxHQUFFLEdBQUUsR0FBRSxHQUFFLEdBQUUsR0FBRSxHQUFFLEdBQUUsR0FBRSxHQUFFLElBQUcsSUFBRyxJQUFHLElBQUcsSUFBRyxJQUFHLElBQUcsRUFBRSxDQUFDO0FBRXRGLElBQU0sZUFDSixJQUFJLFdBQVcsQ0FBQyxHQUFFLEdBQUUsR0FBRSxHQUFFLEdBQUUsR0FBRSxHQUFFLEdBQUUsR0FBRSxHQUFFLEdBQUUsR0FBRSxHQUFFLEdBQUUsR0FBRSxHQUFFLEdBQUUsR0FBRSxDQUFDLENBQUM7QUFFeEQsSUFBTSxXQUNKLElBQUksV0FBVyxDQUFDLElBQUcsSUFBRyxJQUFHLEdBQUUsR0FBRSxHQUFFLEdBQUUsR0FBRSxJQUFHLEdBQUUsSUFBRyxHQUFFLElBQUcsR0FBRSxJQUFHLEdBQUUsSUFBRyxHQUFFLEVBQUUsQ0FBQztBQWFqRSxJQUFNLGdCQUFnQjtBQUd0QixJQUFNLGVBQWdCLElBQUksT0FBTyxZQUFZLEtBQUssQ0FBQztBQUNuRCxPQUFPLFlBQVk7QUFPbkIsSUFBTSxlQUFnQixJQUFJLE1BQU0sWUFBWSxDQUFDO0FBQzdDLE9BQU8sWUFBWTtBQUtuQixJQUFNLGFBQWdCLElBQUksTUFBTSxhQUFhO0FBQzdDLE9BQU8sVUFBVTtBQU1qQixJQUFNLGVBQWdCLElBQUksTUFBTSxjQUFjLGNBQWMsQ0FBQztBQUM3RCxPQUFPLFlBQVk7QUFHbkIsSUFBTSxjQUFnQixJQUFJLE1BQU0sY0FBYztBQUM5QyxPQUFPLFdBQVc7QUFHbEIsSUFBTSxZQUFnQixJQUFJLE1BQU0sU0FBUztBQUN6QyxPQUFPLFNBQVM7QUFpQmhCLElBQUk7QUFDSixJQUFJO0FBQ0osSUFBSTtBQVdKLElBQU0sU0FBUyxDQUFDLFNBQVM7QUFFdkIsU0FBTyxPQUFPLE1BQU0sV0FBVyxRQUFRLFdBQVcsT0FBTyxTQUFTO0FBQUE7QUFRcEUsSUFBTSxZQUFZLENBQUMsR0FBRyxNQUFNO0FBRzFCLElBQUUsWUFBWSxFQUFFLGFBQWMsSUFBSztBQUNuQyxJQUFFLFlBQVksRUFBRSxhQUFjLE1BQU0sSUFBSztBQUFBO0FBUTNDLElBQU0sWUFBWSxDQUFDLEdBQUcsT0FBTyxXQUFXO0FBRXRDLE1BQUksRUFBRSxXQUFZLFdBQVcsUUFBUztBQUNwQyxNQUFFLFVBQVcsU0FBUyxFQUFFLFdBQVk7QUFDcEMsY0FBVSxHQUFHLEVBQUUsTUFBTTtBQUNyQixNQUFFLFNBQVMsU0FBVSxXQUFXLEVBQUU7QUFDbEMsTUFBRSxZQUFZLFNBQVM7QUFBQSxFQUN6QixPQUFPO0FBQ0wsTUFBRSxVQUFXLFNBQVMsRUFBRSxXQUFZO0FBQ3BDLE1BQUUsWUFBWTtBQUFBO0FBQUE7QUFLbEIsSUFBTSxZQUFZLENBQUMsR0FBRyxHQUFHLFNBQVM7QUFFaEMsWUFBVSxHQUFHLEtBQUssSUFBSSxJQUFhLEtBQUssSUFBSSxJQUFJLEVBQVU7QUFBQTtBQVM1RCxJQUFNLGFBQWEsQ0FBQyxNQUFNLFFBQVE7QUFFaEMsTUFBSSxNQUFNO0FBQ1YsS0FBRztBQUNELFdBQU8sT0FBTztBQUNkLGNBQVU7QUFDVixZQUFRO0FBQUEsRUFDVixXQUFXLE1BQU07QUFDakIsU0FBTyxRQUFRO0FBQUE7QUFPakIsSUFBTSxXQUFXLENBQUMsTUFBTTtBQUV0QixNQUFJLEVBQUUsYUFBYSxJQUFJO0FBQ3JCLGNBQVUsR0FBRyxFQUFFLE1BQU07QUFDckIsTUFBRSxTQUFTO0FBQ1gsTUFBRSxXQUFXO0FBQUEsRUFFZixXQUFXLEVBQUUsWUFBWSxHQUFHO0FBQzFCLE1BQUUsWUFBWSxFQUFFLGFBQWEsRUFBRSxTQUFTO0FBQ3hDLE1BQUUsV0FBVztBQUNiLE1BQUUsWUFBWTtBQUFBLEVBQ2hCO0FBQUE7QUFjRixJQUFNLGFBQWEsQ0FBQyxHQUFHLFNBQVM7QUFJOUIsUUFBTSxPQUFrQixLQUFLO0FBQzdCLFFBQU0sV0FBa0IsS0FBSztBQUM3QixRQUFNLFFBQWtCLEtBQUssVUFBVTtBQUN2QyxRQUFNLFlBQWtCLEtBQUssVUFBVTtBQUN2QyxRQUFNLFFBQWtCLEtBQUssVUFBVTtBQUN2QyxRQUFNLE9BQWtCLEtBQUssVUFBVTtBQUN2QyxRQUFNLGFBQWtCLEtBQUssVUFBVTtBQUN2QyxNQUFJO0FBQ0osTUFBSSxHQUFHO0FBQ1AsTUFBSTtBQUNKLE1BQUk7QUFDSixNQUFJO0FBQ0osTUFBSSxXQUFXO0FBRWYsT0FBSyxPQUFPLEVBQUcsUUFBUSxZQUFZLFFBQVE7QUFDekMsTUFBRSxTQUFTLFFBQVE7QUFBQSxFQUNyQjtBQUtBLE9BQUssRUFBRSxLQUFLLEVBQUUsWUFBWSxJQUFJLEtBQWE7QUFFM0MsT0FBSyxJQUFJLEVBQUUsV0FBVyxFQUFHLElBQUksYUFBYSxLQUFLO0FBQzdDLFFBQUksRUFBRSxLQUFLO0FBQ1gsV0FBTyxLQUFLLEtBQUssSUFBSSxJQUFJLEtBQWEsSUFBSSxLQUFhO0FBQ3ZELFFBQUksT0FBTyxZQUFZO0FBQ3JCLGFBQU87QUFDUDtBQUFBLElBQ0Y7QUFDQSxTQUFLLElBQUksSUFBSSxLQUFhO0FBRzFCLFFBQUksSUFBSSxVQUFVO0FBQUU7QUFBQSxJQUFVO0FBRTlCLE1BQUUsU0FBUztBQUNYLFlBQVE7QUFDUixRQUFJLEtBQUssTUFBTTtBQUNiLGNBQVEsTUFBTSxJQUFJO0FBQUEsSUFDcEI7QUFDQSxRQUFJLEtBQUssSUFBSTtBQUNiLE1BQUUsV0FBVyxLQUFLLE9BQU87QUFDekIsUUFBSSxXQUFXO0FBQ2IsUUFBRSxjQUFjLEtBQUssTUFBTSxJQUFJLElBQUksS0FBYTtBQUFBLElBQ2xEO0FBQUEsRUFDRjtBQUNBLE1BQUksYUFBYSxHQUFHO0FBQUU7QUFBQSxFQUFRO0FBTTlCLEtBQUc7QUFDRCxXQUFPLGFBQWE7QUFDcEIsV0FBTyxFQUFFLFNBQVMsVUFBVSxHQUFHO0FBQUU7QUFBQSxJQUFRO0FBQ3pDLE1BQUUsU0FBUztBQUNYLE1BQUUsU0FBUyxPQUFPLE1BQU07QUFDeEIsTUFBRSxTQUFTO0FBSVgsZ0JBQVk7QUFBQSxFQUNkLFNBQVMsV0FBVztBQU9wQixPQUFLLE9BQU8sV0FBWSxTQUFTLEdBQUcsUUFBUTtBQUMxQyxRQUFJLEVBQUUsU0FBUztBQUNmLFdBQU8sTUFBTSxHQUFHO0FBQ2QsVUFBSSxFQUFFLEtBQUssRUFBRTtBQUNiLFVBQUksSUFBSSxVQUFVO0FBQUU7QUFBQSxNQUFVO0FBQzlCLFVBQUksS0FBSyxJQUFJLElBQUksT0FBZSxNQUFNO0FBRXBDLFVBQUUsWUFBWSxPQUFPLEtBQUssSUFBSSxJQUFJLE1BQWMsS0FBSyxJQUFJO0FBQ3pELGFBQUssSUFBSSxJQUFJLEtBQWE7QUFBQSxNQUM1QjtBQUNBO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQTtBQVlGLElBQU0sWUFBWSxDQUFDLE1BQU0sVUFBVSxhQUFhO0FBSzlDLFFBQU0sWUFBWSxJQUFJLE1BQU0sYUFBYSxDQUFDO0FBQzFDLE1BQUksT0FBTztBQUNYLE1BQUk7QUFDSixNQUFJO0FBS0osT0FBSyxPQUFPLEVBQUcsUUFBUSxZQUFZLFFBQVE7QUFDekMsV0FBUSxPQUFPLFNBQVMsT0FBTyxNQUFPO0FBQ3RDLGNBQVUsUUFBUTtBQUFBLEVBQ3BCO0FBUUEsT0FBSyxJQUFJLEVBQUksS0FBSyxVQUFVLEtBQUs7QUFDL0IsUUFBSSxNQUFNLEtBQUssSUFBSSxJQUFJO0FBQ3ZCLFFBQUksUUFBUSxHQUFHO0FBQUU7QUFBQSxJQUFVO0FBRTNCLFNBQUssSUFBSSxLQUFjLFdBQVcsVUFBVSxRQUFRLEdBQUc7QUFBQSxFQUl6RDtBQUFBO0FBT0YsSUFBTSxpQkFBaUIsTUFBTTtBQUUzQixNQUFJO0FBQ0osTUFBSTtBQUNKLE1BQUk7QUFDSixNQUFJO0FBQ0osTUFBSTtBQUNKLFFBQU0sV0FBVyxJQUFJLE1BQU0sYUFBYSxDQUFDO0FBZ0J6QyxXQUFTO0FBQ1QsT0FBSyxPQUFPLEVBQUcsT0FBTyxpQkFBaUIsR0FBRyxRQUFRO0FBQ2hELGdCQUFZLFFBQVE7QUFDcEIsU0FBSyxJQUFJLEVBQUcsSUFBSyxLQUFLLFlBQVksT0FBUSxLQUFLO0FBQzdDLG1CQUFhLFlBQVk7QUFBQSxJQUMzQjtBQUFBLEVBQ0Y7QUFNQSxlQUFhLFNBQVMsS0FBSztBQUczQixTQUFPO0FBQ1AsT0FBSyxPQUFPLEVBQUcsT0FBTyxJQUFJLFFBQVE7QUFDaEMsY0FBVSxRQUFRO0FBQ2xCLFNBQUssSUFBSSxFQUFHLElBQUssS0FBSyxZQUFZLE9BQVEsS0FBSztBQUM3QyxpQkFBVyxVQUFVO0FBQUEsSUFDdkI7QUFBQSxFQUNGO0FBRUEsV0FBUztBQUNULFFBQU8sT0FBTyxXQUFXLFFBQVE7QUFDL0IsY0FBVSxRQUFRLFFBQVE7QUFDMUIsU0FBSyxJQUFJLEVBQUcsSUFBSyxLQUFNLFlBQVksUUFBUSxHQUFLLEtBQUs7QUFDbkQsaUJBQVcsTUFBTSxVQUFVO0FBQUEsSUFDN0I7QUFBQSxFQUNGO0FBSUEsT0FBSyxPQUFPLEVBQUcsUUFBUSxZQUFZLFFBQVE7QUFDekMsYUFBUyxRQUFRO0FBQUEsRUFDbkI7QUFFQSxNQUFJO0FBQ0osU0FBTyxLQUFLLEtBQUs7QUFDZixpQkFBYSxJQUFJLElBQUksS0FBYTtBQUNsQztBQUNBLGFBQVM7QUFBQSxFQUNYO0FBQ0EsU0FBTyxLQUFLLEtBQUs7QUFDZixpQkFBYSxJQUFJLElBQUksS0FBYTtBQUNsQztBQUNBLGFBQVM7QUFBQSxFQUNYO0FBQ0EsU0FBTyxLQUFLLEtBQUs7QUFDZixpQkFBYSxJQUFJLElBQUksS0FBYTtBQUNsQztBQUNBLGFBQVM7QUFBQSxFQUNYO0FBQ0EsU0FBTyxLQUFLLEtBQUs7QUFDZixpQkFBYSxJQUFJLElBQUksS0FBYTtBQUNsQztBQUNBLGFBQVM7QUFBQSxFQUNYO0FBS0EsWUFBVSxjQUFjLFlBQVksR0FBRyxRQUFRO0FBRy9DLE9BQUssSUFBSSxFQUFHLElBQUksV0FBVyxLQUFLO0FBQzlCLGlCQUFhLElBQUksSUFBSSxLQUFhO0FBQ2xDLGlCQUFhLElBQUksS0FBYyxXQUFXLEdBQUcsQ0FBQztBQUFBLEVBQ2hEO0FBR0Esa0JBQWdCLElBQUksZUFBZSxjQUFjLGFBQWEsYUFBYSxHQUFHLFdBQVcsVUFBVTtBQUNuRyxrQkFBZ0IsSUFBSSxlQUFlLGNBQWMsYUFBYSxHQUFZLFdBQVcsVUFBVTtBQUMvRixtQkFBaUIsSUFBSSxlQUFlLElBQUksTUFBTSxDQUFDLEdBQUcsY0FBYyxHQUFXLFlBQVksV0FBVztBQUFBO0FBU3BHLElBQU0sYUFBYSxDQUFDLE1BQU07QUFFeEIsTUFBSTtBQUdKLE9BQUssSUFBSSxFQUFHLElBQUksV0FBWSxLQUFLO0FBQUUsTUFBRSxVQUFVLElBQUksS0FBYztBQUFBLEVBQUc7QUFDcEUsT0FBSyxJQUFJLEVBQUcsSUFBSSxXQUFZLEtBQUs7QUFBRSxNQUFFLFVBQVUsSUFBSSxLQUFjO0FBQUEsRUFBRztBQUNwRSxPQUFLLElBQUksRUFBRyxJQUFJLFlBQVksS0FBSztBQUFFLE1BQUUsUUFBUSxJQUFJLEtBQWM7QUFBQSxFQUFHO0FBRWxFLElBQUUsVUFBVSxZQUFZLEtBQWM7QUFDdEMsSUFBRSxVQUFVLEVBQUUsYUFBYTtBQUMzQixJQUFFLFdBQVcsRUFBRSxVQUFVO0FBQUE7QUFPM0IsSUFBTSxZQUFZLENBQUMsTUFDbkI7QUFDRSxNQUFJLEVBQUUsV0FBVyxHQUFHO0FBQ2xCLGNBQVUsR0FBRyxFQUFFLE1BQU07QUFBQSxFQUN2QixXQUFXLEVBQUUsV0FBVyxHQUFHO0FBRXpCLE1BQUUsWUFBWSxFQUFFLGFBQWEsRUFBRTtBQUFBLEVBQ2pDO0FBQ0EsSUFBRSxTQUFTO0FBQ1gsSUFBRSxXQUFXO0FBQUE7QUFPZixJQUFNLFVBQVUsQ0FBQyxNQUFNLEdBQUcsR0FBRyxVQUFVO0FBRXJDLFFBQU0sTUFBTSxJQUFJO0FBQ2hCLFFBQU0sTUFBTSxJQUFJO0FBQ2hCLFNBQVEsS0FBSyxPQUFnQixLQUFLLFFBQzFCLEtBQUssU0FBa0IsS0FBSyxRQUFpQixNQUFNLE1BQU0sTUFBTTtBQUFBO0FBU3pFLElBQU0sYUFBYSxDQUFDLEdBQUcsTUFBTSxNQUFNO0FBS2pDLFFBQU0sSUFBSSxFQUFFLEtBQUs7QUFDakIsTUFBSSxJQUFJLEtBQUs7QUFDYixTQUFPLEtBQUssRUFBRSxVQUFVO0FBRXRCLFFBQUksSUFBSSxFQUFFLFlBQ1IsUUFBUSxNQUFNLEVBQUUsS0FBSyxJQUFJLElBQUksRUFBRSxLQUFLLElBQUksRUFBRSxLQUFLLEdBQUc7QUFDbEQ7QUFBQSxJQUNGO0FBRUEsUUFBSSxRQUFRLE1BQU0sR0FBRyxFQUFFLEtBQUssSUFBSSxFQUFFLEtBQUssR0FBRztBQUFFO0FBQUEsSUFBTztBQUduRCxNQUFFLEtBQUssS0FBSyxFQUFFLEtBQUs7QUFDbkIsUUFBSTtBQUdKLFVBQU07QUFBQSxFQUNSO0FBQ0EsSUFBRSxLQUFLLEtBQUs7QUFBQTtBQVVkLElBQU0saUJBQWlCLENBQUMsR0FBRyxPQUFPLFVBQVU7QUFLMUMsTUFBSTtBQUNKLE1BQUk7QUFDSixNQUFJLEtBQUs7QUFDVCxNQUFJO0FBQ0osTUFBSTtBQUVKLE1BQUksRUFBRSxhQUFhLEdBQUc7QUFDcEIsT0FBRztBQUNELGFBQU8sRUFBRSxZQUFZLEVBQUUsVUFBVSxRQUFRO0FBQ3pDLGVBQVMsRUFBRSxZQUFZLEVBQUUsVUFBVSxRQUFRLFFBQVM7QUFDcEQsV0FBSyxFQUFFLFlBQVksRUFBRSxVQUFVO0FBQy9CLFVBQUksU0FBUyxHQUFHO0FBQ2Qsa0JBQVUsR0FBRyxJQUFJLEtBQUs7QUFBQSxNQUV4QixPQUFPO0FBRUwsZUFBTyxhQUFhO0FBQ3BCLGtCQUFVLEdBQUcsT0FBTyxhQUFhLEdBQUcsS0FBSztBQUN6QyxnQkFBUSxZQUFZO0FBQ3BCLFlBQUksVUFBVSxHQUFHO0FBQ2YsZ0JBQU0sWUFBWTtBQUNsQixvQkFBVSxHQUFHLElBQUksS0FBSztBQUFBLFFBQ3hCO0FBQ0E7QUFDQSxlQUFPLE9BQU8sSUFBSTtBQUdsQixrQkFBVSxHQUFHLE1BQU0sS0FBSztBQUN4QixnQkFBUSxZQUFZO0FBQ3BCLFlBQUksVUFBVSxHQUFHO0FBQ2Ysa0JBQVEsVUFBVTtBQUNsQixvQkFBVSxHQUFHLE1BQU0sS0FBSztBQUFBLFFBQzFCO0FBQUE7QUFBQSxJQU1KLFNBQVMsS0FBSyxFQUFFO0FBQUEsRUFDbEI7QUFFQSxZQUFVLEdBQUcsV0FBVyxLQUFLO0FBQUE7QUFZL0IsSUFBTSxhQUFhLENBQUMsR0FBRyxTQUFTO0FBSTlCLFFBQU0sT0FBVyxLQUFLO0FBQ3RCLFFBQU0sUUFBVyxLQUFLLFVBQVU7QUFDaEMsUUFBTSxZQUFZLEtBQUssVUFBVTtBQUNqQyxRQUFNLFFBQVcsS0FBSyxVQUFVO0FBQ2hDLE1BQUksR0FBRztBQUNQLE1BQUksV0FBVztBQUNmLE1BQUk7QUFNSixJQUFFLFdBQVc7QUFDYixJQUFFLFdBQVc7QUFFYixPQUFLLElBQUksRUFBRyxJQUFJLE9BQU8sS0FBSztBQUMxQixRQUFJLEtBQUssSUFBSSxPQUFnQixHQUFHO0FBQzlCLFFBQUUsS0FBSyxFQUFFLEVBQUUsWUFBWSxXQUFXO0FBQ2xDLFFBQUUsTUFBTSxLQUFLO0FBQUEsSUFFZixPQUFPO0FBQ0wsV0FBSyxJQUFJLElBQUksS0FBYTtBQUFBO0FBQUEsRUFFOUI7QUFPQSxTQUFPLEVBQUUsV0FBVyxHQUFHO0FBQ3JCLFdBQU8sRUFBRSxLQUFLLEVBQUUsRUFBRSxZQUFhLFdBQVcsTUFBTSxXQUFXO0FBQzNELFNBQUssT0FBTyxLQUFjO0FBQzFCLE1BQUUsTUFBTSxRQUFRO0FBQ2hCLE1BQUU7QUFFRixRQUFJLFdBQVc7QUFDYixRQUFFLGNBQWMsTUFBTSxPQUFPLElBQUk7QUFBQSxJQUNuQztBQUFBLEVBRUY7QUFDQSxPQUFLLFdBQVc7QUFLaEIsT0FBSyxJQUFLLEVBQUUsWUFBWSxFQUFjLEtBQUssR0FBRyxLQUFLO0FBQUUsZUFBVyxHQUFHLE1BQU0sQ0FBQztBQUFBLEVBQUc7QUFLN0UsU0FBTztBQUNQLEtBQUc7QUFHRCxRQUFJLEVBQUUsS0FBSztBQUNYLE1BQUUsS0FBSyxLQUFpQixFQUFFLEtBQUssRUFBRTtBQUNqQyxlQUFXLEdBQUcsTUFBTSxDQUFhO0FBR2pDLFFBQUksRUFBRSxLQUFLO0FBRVgsTUFBRSxLQUFLLEVBQUUsRUFBRSxZQUFZO0FBQ3ZCLE1BQUUsS0FBSyxFQUFFLEVBQUUsWUFBWTtBQUd2QixTQUFLLE9BQU8sS0FBYyxLQUFLLElBQUksS0FBYyxLQUFLLElBQUk7QUFDMUQsTUFBRSxNQUFNLFNBQVMsRUFBRSxNQUFNLE1BQU0sRUFBRSxNQUFNLEtBQUssRUFBRSxNQUFNLEtBQUssRUFBRSxNQUFNLE1BQU07QUFDdkUsU0FBSyxJQUFJLElBQUksS0FBYSxLQUFLLElBQUksSUFBSSxLQUFhO0FBR3BELE1BQUUsS0FBSyxLQUFpQjtBQUN4QixlQUFXLEdBQUcsTUFBTSxDQUFhO0FBQUEsRUFFbkMsU0FBUyxFQUFFLFlBQVk7QUFFdkIsSUFBRSxLQUFLLEVBQUUsRUFBRSxZQUFZLEVBQUUsS0FBSztBQUs5QixhQUFXLEdBQUcsSUFBSTtBQUdsQixZQUFVLE1BQU0sVUFBVSxFQUFFLFFBQVE7QUFBQTtBQVF0QyxJQUFNLFlBQVksQ0FBQyxHQUFHLE1BQU0sYUFBYTtBQUt2QyxNQUFJO0FBQ0osTUFBSSxVQUFVO0FBQ2QsTUFBSTtBQUVKLE1BQUksVUFBVSxLQUFLLElBQUksSUFBSTtBQUUzQixNQUFJLFFBQVE7QUFDWixNQUFJLFlBQVk7QUFDaEIsTUFBSSxZQUFZO0FBRWhCLE1BQUksWUFBWSxHQUFHO0FBQ2pCLGdCQUFZO0FBQ1osZ0JBQVk7QUFBQSxFQUNkO0FBQ0EsT0FBTSxZQUFXLEtBQUssSUFBSSxLQUFhO0FBRXZDLE9BQUssSUFBSSxFQUFHLEtBQUssVUFBVSxLQUFLO0FBQzlCLGFBQVM7QUFDVCxjQUFVLEtBQU0sS0FBSSxLQUFLLElBQUk7QUFFN0IsVUFBTSxRQUFRLGFBQWEsV0FBVyxTQUFTO0FBQzdDO0FBQUEsSUFFRixXQUFXLFFBQVEsV0FBVztBQUM1QixRQUFFLFFBQVEsU0FBUyxNQUFlO0FBQUEsSUFFcEMsV0FBVyxXQUFXLEdBQUc7QUFFdkIsVUFBSSxXQUFXLFNBQVM7QUFBRSxVQUFFLFFBQVEsU0FBUztBQUFBLE1BQWU7QUFDNUQsUUFBRSxRQUFRLFVBQVU7QUFBQSxJQUV0QixXQUFXLFNBQVMsSUFBSTtBQUN0QixRQUFFLFFBQVEsWUFBWTtBQUFBLElBRXhCLE9BQU87QUFDTCxRQUFFLFFBQVEsY0FBYztBQUFBO0FBRzFCLFlBQVE7QUFDUixjQUFVO0FBRVYsUUFBSSxZQUFZLEdBQUc7QUFDakIsa0JBQVk7QUFDWixrQkFBWTtBQUFBLElBRWQsV0FBVyxXQUFXLFNBQVM7QUFDN0Isa0JBQVk7QUFDWixrQkFBWTtBQUFBLElBRWQsT0FBTztBQUNMLGtCQUFZO0FBQ1osa0JBQVk7QUFBQTtBQUFBLEVBRWhCO0FBQUE7QUFRRixJQUFNLFlBQVksQ0FBQyxHQUFHLE1BQU0sYUFBYTtBQUt2QyxNQUFJO0FBQ0osTUFBSSxVQUFVO0FBQ2QsTUFBSTtBQUVKLE1BQUksVUFBVSxLQUFLLElBQUksSUFBSTtBQUUzQixNQUFJLFFBQVE7QUFDWixNQUFJLFlBQVk7QUFDaEIsTUFBSSxZQUFZO0FBR2hCLE1BQUksWUFBWSxHQUFHO0FBQ2pCLGdCQUFZO0FBQ1osZ0JBQVk7QUFBQSxFQUNkO0FBRUEsT0FBSyxJQUFJLEVBQUcsS0FBSyxVQUFVLEtBQUs7QUFDOUIsYUFBUztBQUNULGNBQVUsS0FBTSxLQUFJLEtBQUssSUFBSTtBQUU3QixVQUFNLFFBQVEsYUFBYSxXQUFXLFNBQVM7QUFDN0M7QUFBQSxJQUVGLFdBQVcsUUFBUSxXQUFXO0FBQzVCLFNBQUc7QUFBRSxrQkFBVSxHQUFHLFFBQVEsRUFBRSxPQUFPO0FBQUEsTUFBRyxXQUFXLFVBQVU7QUFBQSxJQUU3RCxXQUFXLFdBQVcsR0FBRztBQUN2QixVQUFJLFdBQVcsU0FBUztBQUN0QixrQkFBVSxHQUFHLFFBQVEsRUFBRSxPQUFPO0FBQzlCO0FBQUEsTUFDRjtBQUVBLGdCQUFVLEdBQUcsU0FBUyxFQUFFLE9BQU87QUFDL0IsZ0JBQVUsR0FBRyxRQUFRLEdBQUcsQ0FBQztBQUFBLElBRTNCLFdBQVcsU0FBUyxJQUFJO0FBQ3RCLGdCQUFVLEdBQUcsV0FBVyxFQUFFLE9BQU87QUFDakMsZ0JBQVUsR0FBRyxRQUFRLEdBQUcsQ0FBQztBQUFBLElBRTNCLE9BQU87QUFDTCxnQkFBVSxHQUFHLGFBQWEsRUFBRSxPQUFPO0FBQ25DLGdCQUFVLEdBQUcsUUFBUSxJQUFJLENBQUM7QUFBQTtBQUc1QixZQUFRO0FBQ1IsY0FBVTtBQUNWLFFBQUksWUFBWSxHQUFHO0FBQ2pCLGtCQUFZO0FBQ1osa0JBQVk7QUFBQSxJQUVkLFdBQVcsV0FBVyxTQUFTO0FBQzdCLGtCQUFZO0FBQ1osa0JBQVk7QUFBQSxJQUVkLE9BQU87QUFDTCxrQkFBWTtBQUNaLGtCQUFZO0FBQUE7QUFBQSxFQUVoQjtBQUFBO0FBUUYsSUFBTSxnQkFBZ0IsQ0FBQyxNQUFNO0FBRTNCLE1BQUk7QUFHSixZQUFVLEdBQUcsRUFBRSxXQUFXLEVBQUUsT0FBTyxRQUFRO0FBQzNDLFlBQVUsR0FBRyxFQUFFLFdBQVcsRUFBRSxPQUFPLFFBQVE7QUFHM0MsYUFBVyxHQUFHLEVBQUUsT0FBTztBQVN2QixPQUFLLGNBQWMsYUFBYSxFQUFHLGVBQWUsR0FBRyxlQUFlO0FBQ2xFLFFBQUksRUFBRSxRQUFRLFNBQVMsZUFBZSxJQUFJLE9BQWUsR0FBRztBQUMxRDtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBRUEsSUFBRSxXQUFXLEtBQUssY0FBYyxLQUFLLElBQUksSUFBSTtBQUk3QyxTQUFPO0FBQUE7QUFTVCxJQUFNLGlCQUFpQixDQUFDLEdBQUcsUUFBUSxRQUFRLFlBQVk7QUFJckQsTUFBSTtBQU1KLFlBQVUsR0FBRyxTQUFTLEtBQUssQ0FBQztBQUM1QixZQUFVLEdBQUcsU0FBUyxHQUFLLENBQUM7QUFDNUIsWUFBVSxHQUFHLFVBQVUsR0FBSSxDQUFDO0FBQzVCLE9BQUssT0FBTyxFQUFHLE9BQU8sU0FBUyxRQUFRO0FBRXJDLGNBQVUsR0FBRyxFQUFFLFFBQVEsU0FBUyxRQUFRLElBQUksSUFBWSxDQUFDO0FBQUEsRUFDM0Q7QUFHQSxZQUFVLEdBQUcsRUFBRSxXQUFXLFNBQVMsQ0FBQztBQUdwQyxZQUFVLEdBQUcsRUFBRSxXQUFXLFNBQVMsQ0FBQztBQUFBO0FBa0J0QyxJQUFNLG1CQUFtQixDQUFDLE1BQU07QUFLOUIsTUFBSSxhQUFhO0FBQ2pCLE1BQUk7QUFHSixPQUFLLElBQUksRUFBRyxLQUFLLElBQUksS0FBSyxnQkFBZ0IsR0FBRztBQUMzQyxRQUFLLGFBQWEsS0FBTyxFQUFFLFVBQVUsSUFBSSxPQUFnQixHQUFJO0FBQzNELGFBQU87QUFBQSxJQUNUO0FBQUEsRUFDRjtBQUdBLE1BQUksRUFBRSxVQUFVLElBQUksT0FBZ0IsS0FBSyxFQUFFLFVBQVUsS0FBSyxPQUFnQixLQUN0RSxFQUFFLFVBQVUsS0FBSyxPQUFnQixHQUFHO0FBQ3RDLFdBQU87QUFBQSxFQUNUO0FBQ0EsT0FBSyxJQUFJLEdBQUksSUFBSSxZQUFZLEtBQUs7QUFDaEMsUUFBSSxFQUFFLFVBQVUsSUFBSSxPQUFnQixHQUFHO0FBQ3JDLGFBQU87QUFBQSxJQUNUO0FBQUEsRUFDRjtBQUtBLFNBQU87QUFBQTtBQUlULElBQUksbUJBQW1CO0FBS3ZCLElBQU0sYUFBYSxDQUFDLE1BQ3BCO0FBRUUsT0FBSyxrQkFBa0I7QUFDckIsbUJBQWU7QUFDZix1QkFBbUI7QUFBQSxFQUNyQjtBQUVBLElBQUUsU0FBVSxJQUFJLFNBQVMsRUFBRSxXQUFXLGFBQWE7QUFDbkQsSUFBRSxTQUFVLElBQUksU0FBUyxFQUFFLFdBQVcsYUFBYTtBQUNuRCxJQUFFLFVBQVUsSUFBSSxTQUFTLEVBQUUsU0FBUyxjQUFjO0FBRWxELElBQUUsU0FBUztBQUNYLElBQUUsV0FBVztBQUdiLGFBQVcsQ0FBQztBQUFBO0FBT2QsSUFBTSxxQkFBcUIsQ0FBQyxHQUFHLEtBQUssWUFBWSxTQUFTO0FBTXZELFlBQVUsSUFBSSxnQkFBZ0IsTUFBTSxPQUFPLElBQUksSUFBSSxDQUFDO0FBQ3BELFlBQVUsQ0FBQztBQUNYLFlBQVUsR0FBRyxVQUFVO0FBQ3ZCLFlBQVUsSUFBSSxVQUFVO0FBQ3hCLE1BQUksWUFBWTtBQUNkLE1BQUUsWUFBWSxJQUFJLEVBQUUsT0FBTyxTQUFTLEtBQUssTUFBTSxVQUFVLEdBQUcsRUFBRSxPQUFPO0FBQUEsRUFDdkU7QUFDQSxJQUFFLFdBQVc7QUFBQTtBQVFmLElBQU0sY0FBYyxDQUFDLE1BQU07QUFDekIsWUFBVSxHQUFHLGdCQUFnQixHQUFHLENBQUM7QUFDakMsWUFBVSxHQUFHLFdBQVcsWUFBWTtBQUNwQyxXQUFTLENBQUM7QUFBQTtBQVFaLElBQU0sb0JBQW9CLENBQUMsR0FBRyxLQUFLLFlBQVksU0FBUztBQU10RCxNQUFJLFVBQVU7QUFDZCxNQUFJLGNBQWM7QUFHbEIsTUFBSSxFQUFFLFFBQVEsR0FBRztBQUdmLFFBQUksRUFBRSxLQUFLLGNBQWMsYUFBYTtBQUNwQyxRQUFFLEtBQUssWUFBWSxpQkFBaUIsQ0FBQztBQUFBLElBQ3ZDO0FBR0EsZUFBVyxHQUFHLEVBQUUsTUFBTTtBQUl0QixlQUFXLEdBQUcsRUFBRSxNQUFNO0FBVXRCLGtCQUFjLGNBQWMsQ0FBQztBQUc3QixlQUFZLEVBQUUsVUFBVSxJQUFJLE1BQU87QUFDbkMsa0JBQWUsRUFBRSxhQUFhLElBQUksTUFBTztBQU16QyxRQUFJLGVBQWUsVUFBVTtBQUFFLGlCQUFXO0FBQUEsSUFBYTtBQUFBLEVBRXpELE9BQU87QUFFTCxlQUFXLGNBQWMsYUFBYTtBQUFBO0FBR3hDLE1BQUssYUFBYSxLQUFLLFlBQWMsUUFBUSxJQUFLO0FBU2hELHVCQUFtQixHQUFHLEtBQUssWUFBWSxJQUFJO0FBQUEsRUFFN0MsV0FBVyxFQUFFLGFBQWEsYUFBYSxnQkFBZ0IsVUFBVTtBQUUvRCxjQUFVLElBQUksZ0JBQWdCLE1BQU0sT0FBTyxJQUFJLElBQUksQ0FBQztBQUNwRCxtQkFBZSxHQUFHLGNBQWMsWUFBWTtBQUFBLEVBRTlDLE9BQU87QUFDTCxjQUFVLElBQUksYUFBYSxNQUFNLE9BQU8sSUFBSSxJQUFJLENBQUM7QUFDakQsbUJBQWUsR0FBRyxFQUFFLE9BQU8sV0FBVyxHQUFHLEVBQUUsT0FBTyxXQUFXLEdBQUcsY0FBYyxDQUFDO0FBQy9FLG1CQUFlLEdBQUcsRUFBRSxXQUFXLEVBQUUsU0FBUztBQUFBO0FBTTVDLGFBQVcsQ0FBQztBQUVaLE1BQUksTUFBTTtBQUNSLGNBQVUsQ0FBQztBQUFBLEVBQ2I7QUFBQTtBQVNGLElBQU0sY0FBYyxDQUFDLEdBQUcsTUFBTSxPQUFPO0FBS25DLElBQUUsWUFBWSxFQUFFLFVBQVUsRUFBRSxjQUFjO0FBQzFDLElBQUUsWUFBWSxFQUFFLFVBQVUsRUFBRSxjQUFjLFFBQVE7QUFDbEQsSUFBRSxZQUFZLEVBQUUsVUFBVSxFQUFFLGNBQWM7QUFDMUMsTUFBSSxTQUFTLEdBQUc7QUFFZCxNQUFFLFVBQVUsS0FBSztBQUFBLEVBQ25CLE9BQU87QUFDTCxNQUFFO0FBRUY7QUFLQSxNQUFFLFVBQVcsY0FBYSxNQUFNLGFBQWEsS0FBSztBQUNsRCxNQUFFLFVBQVUsT0FBTyxJQUFJLElBQUk7QUFBQTtBQUc3QixTQUFRLEVBQUUsYUFBYSxFQUFFO0FBQUE7QUFHM0IsSUFBSSxhQUFjO0FBQ2xCLElBQUkscUJBQXFCO0FBQ3pCLElBQUksb0JBQXFCO0FBQ3pCLElBQUksY0FBYztBQUNsQixJQUFJLGNBQWM7QUFFbEIsSUFBSSxRQUFRO0FBQUEsRUFDWCxVQUFVO0FBQUEsRUFDVixrQkFBa0I7QUFBQSxFQUNsQixpQkFBaUI7QUFBQSxFQUNqQixXQUFXO0FBQUEsRUFDWCxXQUFXO0FBQ1o7QUF5QkEsSUFBTSxVQUFVLENBQUMsT0FBTyxLQUFLLEtBQUssUUFBUTtBQUN4QyxNQUFJLEtBQU0sUUFBUSxRQUFTLEdBQ3ZCLEtBQU8sVUFBVSxLQUFNLFFBQVMsR0FDaEMsSUFBSTtBQUVSLFNBQU8sUUFBUSxHQUFHO0FBSWhCLFFBQUksTUFBTSxPQUFPLE9BQU87QUFDeEIsV0FBTztBQUVQLE9BQUc7QUFDRCxXQUFNLEtBQUssSUFBSSxTQUFTO0FBQ3hCLFdBQU0sS0FBSyxLQUFLO0FBQUEsSUFDbEIsV0FBVztBQUVYLFVBQU07QUFDTixVQUFNO0FBQUEsRUFDUjtBQUVBLFNBQVEsS0FBTSxNQUFNLEtBQU07QUFBQTtBQUk1QixJQUFJLFlBQVk7QUEwQmhCLElBQU0sWUFBWSxNQUFNO0FBQ3RCLE1BQUksR0FBRyxRQUFRLENBQUM7QUFFaEIsV0FBUyxJQUFJLEVBQUcsSUFBSSxLQUFLLEtBQUs7QUFDNUIsUUFBSTtBQUNKLGFBQVMsSUFBSSxFQUFHLElBQUksR0FBRyxLQUFLO0FBQzFCLFVBQU0sSUFBSSxJQUFNLGFBQWMsTUFBTSxJQUFPLE1BQU07QUFBQSxJQUNuRDtBQUNBLFVBQU0sS0FBSztBQUFBLEVBQ2I7QUFFQSxTQUFPO0FBQUE7QUFJVCxJQUFNLFdBQVcsSUFBSSxZQUFZLFVBQVUsQ0FBQztBQUc1QyxJQUFNLFFBQVEsQ0FBQyxLQUFLLEtBQUssS0FBSyxRQUFRO0FBQ3BDLFFBQU0sSUFBSTtBQUNWLFFBQU0sTUFBTSxNQUFNO0FBRWxCLFNBQU87QUFFUCxXQUFTLElBQUksSUFBSyxJQUFJLEtBQUssS0FBSztBQUM5QixVQUFPLFFBQVEsSUFBSyxFQUFHLE9BQU0sSUFBSSxNQUFNO0FBQUEsRUFDekM7QUFFQSxTQUFRLE1BQU87QUFBQTtBQUlqQixJQUFJLFVBQVU7QUFxQmQsSUFBSSxXQUFXO0FBQUEsRUFDYixHQUFRO0FBQUEsRUFDUixHQUFRO0FBQUEsRUFDUixHQUFRO0FBQUEsRUFDUixNQUFRO0FBQUEsRUFDUixNQUFRO0FBQUEsRUFDUixNQUFRO0FBQUEsRUFDUixNQUFRO0FBQUEsRUFDUixNQUFRO0FBQUEsRUFDUixNQUFRO0FBQ1Y7QUFxQkEsSUFBSSxjQUFjO0FBQUEsRUFHaEIsWUFBb0I7QUFBQSxFQUNwQixpQkFBb0I7QUFBQSxFQUNwQixjQUFvQjtBQUFBLEVBQ3BCLGNBQW9CO0FBQUEsRUFDcEIsVUFBb0I7QUFBQSxFQUNwQixTQUFvQjtBQUFBLEVBQ3BCLFNBQW9CO0FBQUEsRUFLcEIsTUFBb0I7QUFBQSxFQUNwQixjQUFvQjtBQUFBLEVBQ3BCLGFBQW9CO0FBQUEsRUFDcEIsU0FBbUI7QUFBQSxFQUNuQixnQkFBbUI7QUFBQSxFQUNuQixjQUFtQjtBQUFBLEVBQ25CLGFBQW1CO0FBQUEsRUFDbkIsYUFBbUI7QUFBQSxFQUluQixrQkFBMEI7QUFBQSxFQUMxQixjQUEwQjtBQUFBLEVBQzFCLG9CQUEwQjtBQUFBLEVBQzFCLHVCQUF5QjtBQUFBLEVBR3pCLFlBQTBCO0FBQUEsRUFDMUIsZ0JBQTBCO0FBQUEsRUFDMUIsT0FBMEI7QUFBQSxFQUMxQixTQUEwQjtBQUFBLEVBQzFCLG9CQUEwQjtBQUFBLEVBRzFCLFVBQTBCO0FBQUEsRUFDMUIsUUFBMEI7QUFBQSxFQUUxQixXQUEwQjtBQUFBLEVBRzFCLFlBQTBCO0FBRTVCO0FBcUJBLE1BQVEsVUFBVSxrQkFBa0IsaUJBQWlCLFdBQVcsY0FBYztBQVE5RTtBQUFBLEVBQ0UsWUFBWTtBQUFBLEVBQWM7QUFBQSxFQUFpQixjQUFjO0FBQUEsRUFBZ0IsVUFBVTtBQUFBLEVBQVksU0FBUztBQUFBLEVBQ3hHLE1BQU07QUFBQSxFQUFRLGNBQWM7QUFBQSxFQUFnQixnQkFBZ0I7QUFBQSxFQUFrQixjQUFjO0FBQUEsRUFBZ0IsYUFBYTtBQUFBLEVBQ3pILHVCQUF1QjtBQUFBLEVBQ3ZCO0FBQUEsRUFBWTtBQUFBLEVBQWdCO0FBQUEsRUFBTztBQUFBLEVBQVMsb0JBQW9CO0FBQUEsRUFDaEU7QUFBQSxFQUNBLFlBQVk7QUFBQSxJQUNWO0FBS0osSUFBTSxnQkFBZ0I7QUFFdEIsSUFBTSxjQUFjO0FBRXBCLElBQU0sZ0JBQWdCO0FBR3RCLElBQU0sZUFBZ0I7QUFFdEIsSUFBTSxXQUFnQjtBQUV0QixJQUFNLFVBQWdCLFdBQVcsSUFBSTtBQUVyQyxJQUFNLFVBQWdCO0FBRXRCLElBQU0sV0FBZ0I7QUFFdEIsSUFBTSxZQUFnQixJQUFJLFVBQVU7QUFFcEMsSUFBTSxXQUFZO0FBR2xCLElBQU0sWUFBWTtBQUNsQixJQUFNLFlBQVk7QUFDbEIsSUFBTSxnQkFBaUIsWUFBWSxZQUFZO0FBRS9DLElBQU0sY0FBYztBQUVwQixJQUFNLGFBQWlCO0FBRXZCLElBQU0sYUFBaUI7QUFFdkIsSUFBTSxjQUFpQjtBQUN2QixJQUFNLGFBQWlCO0FBQ3ZCLElBQU0sZ0JBQWlCO0FBQ3ZCLElBQU0sYUFBZ0I7QUFDdEIsSUFBTSxhQUFnQjtBQUN0QixJQUFNLGVBQWdCO0FBRXRCLElBQU0sZUFBb0I7QUFDMUIsSUFBTSxnQkFBb0I7QUFDMUIsSUFBTSxvQkFBb0I7QUFDMUIsSUFBTSxpQkFBb0I7QUFFMUIsSUFBTSxVQUFVO0FBRWhCLElBQU0sTUFBTSxDQUFDLE1BQU0sY0FBYztBQUMvQixPQUFLLE1BQU0sU0FBUztBQUNwQixTQUFPO0FBQUE7QUFHVCxJQUFNLE9BQU8sQ0FBQyxNQUFNO0FBQ2xCLFNBQVMsSUFBSyxLQUFPLElBQUssSUFBSSxJQUFJO0FBQUE7QUFHcEMsSUFBTSxPQUFPLENBQUMsUUFBUTtBQUNwQixNQUFJLE1BQU0sSUFBSTtBQUFRLFdBQVMsT0FBTyxHQUFHO0FBQUUsUUFBSSxPQUFPO0FBQUEsRUFBRztBQUFBO0FBUTNELElBQU0sYUFBYSxDQUFDLE1BQU07QUFDeEIsTUFBSSxHQUFHO0FBQ1AsTUFBSTtBQUNKLE1BQUksUUFBUSxFQUFFO0FBRWQsTUFBSSxFQUFFO0FBQ04sTUFBSTtBQUNKLEtBQUc7QUFDRCxRQUFJLEVBQUUsS0FBSyxFQUFFO0FBQ2IsTUFBRSxLQUFLLEtBQU0sS0FBSyxRQUFRLElBQUksUUFBUTtBQUFBLEVBQ3hDLFdBQVc7QUFDWCxNQUFJO0FBRUosTUFBSTtBQUNKLEtBQUc7QUFDRCxRQUFJLEVBQUUsS0FBSyxFQUFFO0FBQ2IsTUFBRSxLQUFLLEtBQU0sS0FBSyxRQUFRLElBQUksUUFBUTtBQUFBLEVBSXhDLFdBQVc7QUFBQTtBQUtiLElBQUksWUFBWSxDQUFDLEdBQUcsTUFBTSxVQUFXLFFBQVEsRUFBRSxhQUFjLFFBQVEsRUFBRTtBQUl2RSxJQUFJLE9BQU87QUFTWCxJQUFNLGdCQUFnQixDQUFDLFNBQVM7QUFDOUIsUUFBTSxJQUFJLEtBQUs7QUFHZixNQUFJLE1BQU0sRUFBRTtBQUNaLE1BQUksTUFBTSxLQUFLLFdBQVc7QUFDeEIsVUFBTSxLQUFLO0FBQUEsRUFDYjtBQUNBLE1BQUksUUFBUSxHQUFHO0FBQUU7QUFBQSxFQUFRO0FBRXpCLE9BQUssT0FBTyxJQUFJLEVBQUUsWUFBWSxTQUFTLEVBQUUsYUFBYSxFQUFFLGNBQWMsR0FBRyxHQUFHLEtBQUssUUFBUTtBQUN6RixPQUFLLFlBQWE7QUFDbEIsSUFBRSxlQUFnQjtBQUNsQixPQUFLLGFBQWE7QUFDbEIsT0FBSyxhQUFhO0FBQ2xCLElBQUUsV0FBZ0I7QUFDbEIsTUFBSSxFQUFFLFlBQVksR0FBRztBQUNuQixNQUFFLGNBQWM7QUFBQSxFQUNsQjtBQUFBO0FBSUYsSUFBTSxtQkFBbUIsQ0FBQyxHQUFHLFNBQVM7QUFDcEMsa0JBQWdCLEdBQUksRUFBRSxlQUFlLElBQUksRUFBRSxjQUFjLElBQUssRUFBRSxXQUFXLEVBQUUsYUFBYSxJQUFJO0FBQzlGLElBQUUsY0FBYyxFQUFFO0FBQ2xCLGdCQUFjLEVBQUUsSUFBSTtBQUFBO0FBSXRCLElBQU0sV0FBVyxDQUFDLEdBQUcsTUFBTTtBQUN6QixJQUFFLFlBQVksRUFBRSxhQUFhO0FBQUE7QUFTL0IsSUFBTSxjQUFjLENBQUMsR0FBRyxNQUFNO0FBSTVCLElBQUUsWUFBWSxFQUFFLGFBQWMsTUFBTSxJQUFLO0FBQ3pDLElBQUUsWUFBWSxFQUFFLGFBQWEsSUFBSTtBQUFBO0FBV25DLElBQU0sV0FBVyxDQUFDLE1BQU0sS0FBSyxPQUFPLFNBQVM7QUFFM0MsTUFBSSxNQUFNLEtBQUs7QUFFZixNQUFJLE1BQU0sTUFBTTtBQUFFLFVBQU07QUFBQSxFQUFNO0FBQzlCLE1BQUksUUFBUSxHQUFHO0FBQUUsV0FBTztBQUFBLEVBQUc7QUFFM0IsT0FBSyxZQUFZO0FBR2pCLE1BQUksSUFBSSxLQUFLLE1BQU0sU0FBUyxLQUFLLFNBQVMsS0FBSyxVQUFVLEdBQUcsR0FBRyxLQUFLO0FBQ3BFLE1BQUksS0FBSyxNQUFNLFNBQVMsR0FBRztBQUN6QixTQUFLLFFBQVEsVUFBVSxLQUFLLE9BQU8sS0FBSyxLQUFLLEtBQUs7QUFBQSxFQUNwRCxXQUVTLEtBQUssTUFBTSxTQUFTLEdBQUc7QUFDOUIsU0FBSyxRQUFRLFFBQVEsS0FBSyxPQUFPLEtBQUssS0FBSyxLQUFLO0FBQUEsRUFDbEQ7QUFFQSxPQUFLLFdBQVc7QUFDaEIsT0FBSyxZQUFZO0FBRWpCLFNBQU87QUFBQTtBQWFULElBQU0sZ0JBQWdCLENBQUMsR0FBRyxjQUFjO0FBRXRDLE1BQUksZUFBZSxFQUFFO0FBQ3JCLE1BQUksT0FBTyxFQUFFO0FBQ2IsTUFBSTtBQUNKLE1BQUk7QUFDSixNQUFJLFdBQVcsRUFBRTtBQUNqQixNQUFJLGFBQWEsRUFBRTtBQUNuQixRQUFNLFFBQVMsRUFBRSxXQUFZLEVBQUUsU0FBUyxnQkFDcEMsRUFBRSxZQUFZLEVBQUUsU0FBUyxpQkFBaUI7QUFFOUMsUUFBTSxPQUFPLEVBQUU7QUFFZixRQUFNLFFBQVEsRUFBRTtBQUNoQixRQUFNLE9BQVEsRUFBRTtBQU1oQixRQUFNLFNBQVMsRUFBRSxXQUFXO0FBQzVCLE1BQUksWUFBYSxLQUFLLE9BQU8sV0FBVztBQUN4QyxNQUFJLFdBQWEsS0FBSyxPQUFPO0FBUTdCLE1BQUksRUFBRSxlQUFlLEVBQUUsWUFBWTtBQUNqQyxxQkFBaUI7QUFBQSxFQUNuQjtBQUlBLE1BQUksYUFBYSxFQUFFLFdBQVc7QUFBRSxpQkFBYSxFQUFFO0FBQUEsRUFBVztBQUkxRCxLQUFHO0FBRUQsWUFBUTtBQVdSLFFBQUksS0FBSyxRQUFRLGNBQWtCLFlBQy9CLEtBQUssUUFBUSxXQUFXLE9BQU8sYUFDL0IsS0FBSyxXQUEwQixLQUFLLFNBQ3BDLEtBQUssRUFBRSxXQUF3QixLQUFLLE9BQU8sSUFBSTtBQUNqRDtBQUFBLElBQ0Y7QUFRQSxZQUFRO0FBQ1I7QUFNQSxPQUFHO0FBQUEsSUFFSCxTQUFTLEtBQUssRUFBRSxVQUFVLEtBQUssRUFBRSxVQUFVLEtBQUssRUFBRSxVQUFVLEtBQUssRUFBRSxVQUMxRCxLQUFLLEVBQUUsVUFBVSxLQUFLLEVBQUUsVUFBVSxLQUFLLEVBQUUsVUFBVSxLQUFLLEVBQUUsVUFDMUQsS0FBSyxFQUFFLFVBQVUsS0FBSyxFQUFFLFVBQVUsS0FBSyxFQUFFLFVBQVUsS0FBSyxFQUFFLFVBQzFELEtBQUssRUFBRSxVQUFVLEtBQUssRUFBRSxVQUFVLEtBQUssRUFBRSxVQUFVLEtBQUssRUFBRSxVQUMxRCxPQUFPO0FBSWhCLFVBQU0sYUFBYSxTQUFTO0FBQzVCLFdBQU8sU0FBUztBQUVoQixRQUFJLE1BQU0sVUFBVTtBQUNsQixRQUFFLGNBQWM7QUFDaEIsaUJBQVc7QUFDWCxVQUFJLE9BQU8sWUFBWTtBQUNyQjtBQUFBLE1BQ0Y7QUFDQSxrQkFBYSxLQUFLLE9BQU8sV0FBVztBQUNwQyxpQkFBYSxLQUFLLE9BQU87QUFBQSxJQUMzQjtBQUFBLEVBQ0YsVUFBVSxZQUFZLEtBQUssWUFBWSxVQUFVLFdBQVcsaUJBQWlCO0FBRTdFLE1BQUksWUFBWSxFQUFFLFdBQVc7QUFDM0IsV0FBTztBQUFBLEVBQ1Q7QUFDQSxTQUFPLEVBQUU7QUFBQTtBQWNYLElBQU0sY0FBYyxDQUFDLE1BQU07QUFFekIsUUFBTSxVQUFVLEVBQUU7QUFDbEIsTUFBSSxHQUFHLE1BQU07QUFJYixLQUFHO0FBQ0QsV0FBTyxFQUFFLGNBQWMsRUFBRSxZQUFZLEVBQUU7QUFvQnZDLFFBQUksRUFBRSxZQUFZLFdBQVcsVUFBVSxnQkFBZ0I7QUFFckQsUUFBRSxPQUFPLElBQUksRUFBRSxPQUFPLFNBQVMsU0FBUyxVQUFVLFVBQVUsSUFBSSxHQUFHLENBQUM7QUFDcEUsUUFBRSxlQUFlO0FBQ2pCLFFBQUUsWUFBWTtBQUVkLFFBQUUsZUFBZTtBQUNqQixVQUFJLEVBQUUsU0FBUyxFQUFFLFVBQVU7QUFDekIsVUFBRSxTQUFTLEVBQUU7QUFBQSxNQUNmO0FBQ0EsaUJBQVcsQ0FBQztBQUNaLGNBQVE7QUFBQSxJQUNWO0FBQ0EsUUFBSSxFQUFFLEtBQUssYUFBYSxHQUFHO0FBQ3pCO0FBQUEsSUFDRjtBQWNBLFFBQUksU0FBUyxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLFdBQVcsSUFBSTtBQUM3RCxNQUFFLGFBQWE7QUFHZixRQUFJLEVBQUUsWUFBWSxFQUFFLFVBQVUsV0FBVztBQUN2QyxZQUFNLEVBQUUsV0FBVyxFQUFFO0FBQ3JCLFFBQUUsUUFBUSxFQUFFLE9BQU87QUFHbkIsUUFBRSxRQUFRLEtBQUssR0FBRyxFQUFFLE9BQU8sRUFBRSxPQUFPLE1BQU0sRUFBRTtBQUk1QyxhQUFPLEVBQUUsUUFBUTtBQUVmLFVBQUUsUUFBUSxLQUFLLEdBQUcsRUFBRSxPQUFPLEVBQUUsT0FBTyxNQUFNLFlBQVksRUFBRTtBQUV4RCxVQUFFLEtBQUssTUFBTSxFQUFFLFVBQVUsRUFBRSxLQUFLLEVBQUU7QUFDbEMsVUFBRSxLQUFLLEVBQUUsU0FBUztBQUNsQjtBQUNBLFVBQUU7QUFDRixZQUFJLEVBQUUsWUFBWSxFQUFFLFNBQVMsV0FBVztBQUN0QztBQUFBLFFBQ0Y7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBS0YsU0FBUyxFQUFFLFlBQVksaUJBQWlCLEVBQUUsS0FBSyxhQUFhO0FBQUE7QUF1RDlELElBQU0saUJBQWlCLENBQUMsR0FBRyxVQUFVO0FBTW5DLE1BQUksWUFBWSxFQUFFLG1CQUFtQixJQUFJLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxtQkFBbUI7QUFNcEYsTUFBSSxLQUFLLE1BQU0sTUFBTSxPQUFPO0FBQzVCLE1BQUksT0FBTyxFQUFFLEtBQUs7QUFDbEIsS0FBRztBQUtELFVBQU07QUFDTixXQUFRLEVBQUUsV0FBVyxNQUFPO0FBQzVCLFFBQUksRUFBRSxLQUFLLFlBQVksTUFBTTtBQUMzQjtBQUFBLElBQ0Y7QUFFQSxXQUFPLEVBQUUsS0FBSyxZQUFZO0FBQzFCLFdBQU8sRUFBRSxXQUFXLEVBQUU7QUFDdEIsUUFBSSxNQUFNLE9BQU8sRUFBRSxLQUFLLFVBQVU7QUFDaEMsWUFBTSxPQUFPLEVBQUUsS0FBSztBQUFBLElBQ3RCO0FBQ0EsUUFBSSxNQUFNLE1BQU07QUFDZCxZQUFNO0FBQUEsSUFDUjtBQU9BLFFBQUksTUFBTSxjQUFlLFFBQVEsS0FBSyxVQUFVLGNBQzVCLFVBQVUsZ0JBQ1YsUUFBUSxPQUFPLEVBQUUsS0FBSyxXQUFXO0FBQ25EO0FBQUEsSUFDRjtBQUtBLFdBQU8sVUFBVSxjQUFjLFFBQVEsT0FBTyxFQUFFLEtBQUssV0FBVyxJQUFJO0FBQ3BFLHFCQUFpQixHQUFHLEdBQUcsR0FBRyxJQUFJO0FBRzlCLE1BQUUsWUFBWSxFQUFFLFVBQVUsS0FBSztBQUMvQixNQUFFLFlBQVksRUFBRSxVQUFVLEtBQUssT0FBTztBQUN0QyxNQUFFLFlBQVksRUFBRSxVQUFVLE1BQU07QUFDaEMsTUFBRSxZQUFZLEVBQUUsVUFBVSxNQUFNLE9BQU87QUFHdkMsa0JBQWMsRUFBRSxJQUFJO0FBU3BCLFFBQUksTUFBTTtBQUNSLFVBQUksT0FBTyxLQUFLO0FBQ2QsZUFBTztBQUFBLE1BQ1Q7QUFFQSxRQUFFLEtBQUssT0FBTyxJQUFJLEVBQUUsT0FBTyxTQUFTLEVBQUUsYUFBYSxFQUFFLGNBQWMsSUFBSSxHQUFHLEVBQUUsS0FBSyxRQUFRO0FBQ3pGLFFBQUUsS0FBSyxZQUFZO0FBQ25CLFFBQUUsS0FBSyxhQUFhO0FBQ3BCLFFBQUUsS0FBSyxhQUFhO0FBQ3BCLFFBQUUsZUFBZTtBQUNqQixhQUFPO0FBQUEsSUFDVDtBQUtBLFFBQUksS0FBSztBQUNQLGVBQVMsRUFBRSxNQUFNLEVBQUUsS0FBSyxRQUFRLEVBQUUsS0FBSyxVQUFVLEdBQUc7QUFDcEQsUUFBRSxLQUFLLFlBQVk7QUFDbkIsUUFBRSxLQUFLLGFBQWE7QUFDcEIsUUFBRSxLQUFLLGFBQWE7QUFBQSxJQUN0QjtBQUFBLEVBQ0YsU0FBUyxTQUFTO0FBUWxCLFVBQVEsRUFBRSxLQUFLO0FBQ2YsTUFBSSxNQUFNO0FBSVIsUUFBSSxRQUFRLEVBQUUsUUFBUTtBQUNwQixRQUFFLFVBQVU7QUFFWixRQUFFLE9BQU8sSUFBSSxFQUFFLEtBQUssTUFBTSxTQUFTLEVBQUUsS0FBSyxVQUFVLEVBQUUsUUFBUSxFQUFFLEtBQUssT0FBTyxHQUFHLENBQUM7QUFDaEYsUUFBRSxXQUFXLEVBQUU7QUFDZixRQUFFLFNBQVMsRUFBRTtBQUFBLElBQ2YsT0FDSztBQUNILFVBQUksRUFBRSxjQUFjLEVBQUUsWUFBWSxNQUFNO0FBRXRDLFVBQUUsWUFBWSxFQUFFO0FBRWhCLFVBQUUsT0FBTyxJQUFJLEVBQUUsT0FBTyxTQUFTLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxRQUFRLEdBQUcsQ0FBQztBQUNsRSxZQUFJLEVBQUUsVUFBVSxHQUFHO0FBQ2pCLFlBQUU7QUFBQSxRQUNKO0FBQ0EsWUFBSSxFQUFFLFNBQVMsRUFBRSxVQUFVO0FBQ3pCLFlBQUUsU0FBUyxFQUFFO0FBQUEsUUFDZjtBQUFBLE1BQ0Y7QUFFQSxRQUFFLE9BQU8sSUFBSSxFQUFFLEtBQUssTUFBTSxTQUFTLEVBQUUsS0FBSyxVQUFVLE1BQU0sRUFBRSxLQUFLLE9BQU8sR0FBRyxFQUFFLFFBQVE7QUFDckYsUUFBRSxZQUFZO0FBQ2QsUUFBRSxVQUFVLE9BQU8sRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxTQUFTO0FBQUE7QUFFakUsTUFBRSxjQUFjLEVBQUU7QUFBQSxFQUNwQjtBQUNBLE1BQUksRUFBRSxhQUFhLEVBQUUsVUFBVTtBQUM3QixNQUFFLGFBQWEsRUFBRTtBQUFBLEVBQ25CO0FBR0EsTUFBSSxNQUFNO0FBQ1IsV0FBTztBQUFBLEVBQ1Q7QUFHQSxNQUFJLFVBQVUsZ0JBQWdCLFVBQVUsY0FDdEMsRUFBRSxLQUFLLGFBQWEsS0FBSyxFQUFFLGFBQWEsRUFBRSxhQUFhO0FBQ3ZELFdBQU87QUFBQSxFQUNUO0FBR0EsU0FBTyxFQUFFLGNBQWMsRUFBRTtBQUN6QixNQUFJLEVBQUUsS0FBSyxXQUFXLFFBQVEsRUFBRSxlQUFlLEVBQUUsUUFBUTtBQUV2RCxNQUFFLGVBQWUsRUFBRTtBQUNuQixNQUFFLFlBQVksRUFBRTtBQUVoQixNQUFFLE9BQU8sSUFBSSxFQUFFLE9BQU8sU0FBUyxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsUUFBUSxHQUFHLENBQUM7QUFDbEUsUUFBSSxFQUFFLFVBQVUsR0FBRztBQUNqQixRQUFFO0FBQUEsSUFDSjtBQUNBLFlBQVEsRUFBRTtBQUNWLFFBQUksRUFBRSxTQUFTLEVBQUUsVUFBVTtBQUN6QixRQUFFLFNBQVMsRUFBRTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQ0EsTUFBSSxPQUFPLEVBQUUsS0FBSyxVQUFVO0FBQzFCLFdBQU8sRUFBRSxLQUFLO0FBQUEsRUFDaEI7QUFDQSxNQUFJLE1BQU07QUFDUixhQUFTLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRSxVQUFVLElBQUk7QUFDM0MsTUFBRSxZQUFZO0FBQ2QsTUFBRSxVQUFVLE9BQU8sRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxTQUFTO0FBQUEsRUFDakU7QUFDQSxNQUFJLEVBQUUsYUFBYSxFQUFFLFVBQVU7QUFDN0IsTUFBRSxhQUFhLEVBQUU7QUFBQSxFQUNuQjtBQU9BLFNBQVEsRUFBRSxXQUFXLE1BQU87QUFFNUIsU0FBTyxFQUFFLG1CQUFtQixPQUFPLFFBQXdCLFFBQXdCLEVBQUUsbUJBQW1CO0FBQ3hHLGNBQVksT0FBTyxFQUFFLFNBQVMsRUFBRSxTQUFTO0FBQ3pDLFNBQU8sRUFBRSxXQUFXLEVBQUU7QUFDdEIsTUFBSSxRQUFRLGNBQ1AsUUFBUSxVQUFVLGVBQWUsVUFBVSxnQkFDN0MsRUFBRSxLQUFLLGFBQWEsS0FBSyxRQUFRLE1BQU87QUFDekMsVUFBTSxPQUFPLE9BQU8sT0FBTztBQUMzQixXQUFPLFVBQVUsY0FBYyxFQUFFLEtBQUssYUFBYSxLQUM5QyxRQUFRLE9BQU8sSUFBSTtBQUN4QixxQkFBaUIsR0FBRyxFQUFFLGFBQWEsS0FBSyxJQUFJO0FBQzVDLE1BQUUsZUFBZTtBQUNqQixrQkFBYyxFQUFFLElBQUk7QUFBQSxFQUN0QjtBQUdBLFNBQU8sT0FBTyxvQkFBb0I7QUFBQTtBQVdwQyxJQUFNLGVBQWUsQ0FBQyxHQUFHLFVBQVU7QUFFakMsTUFBSTtBQUNKLE1BQUk7QUFFSixZQUFTO0FBTVAsUUFBSSxFQUFFLFlBQVksZUFBZTtBQUMvQixrQkFBWSxDQUFDO0FBQ2IsVUFBSSxFQUFFLFlBQVksaUJBQWlCLFVBQVUsY0FBYztBQUN6RCxlQUFPO0FBQUEsTUFDVDtBQUNBLFVBQUksRUFBRSxjQUFjLEdBQUc7QUFDckI7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUtBLGdCQUFZO0FBQ1osUUFBSSxFQUFFLGFBQWEsV0FBVztBQUU1QixRQUFFLFFBQVEsS0FBSyxHQUFHLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxXQUFXLFlBQVksRUFBRTtBQUMvRCxrQkFBWSxFQUFFLEtBQUssRUFBRSxXQUFXLEVBQUUsVUFBVSxFQUFFLEtBQUssRUFBRTtBQUNyRCxRQUFFLEtBQUssRUFBRSxTQUFTLEVBQUU7QUFBQSxJQUV0QjtBQUtBLFFBQUksY0FBYyxLQUFjLEVBQUUsV0FBVyxhQUFlLEVBQUUsU0FBUyxlQUFpQjtBQUt0RixRQUFFLGVBQWUsY0FBYyxHQUFHLFNBQVM7QUFBQSxJQUU3QztBQUNBLFFBQUksRUFBRSxnQkFBZ0IsV0FBVztBQUsvQixlQUFTLFVBQVUsR0FBRyxFQUFFLFdBQVcsRUFBRSxhQUFhLEVBQUUsZUFBZSxTQUFTO0FBRTVFLFFBQUUsYUFBYSxFQUFFO0FBS2pCLFVBQUksRUFBRSxnQkFBZ0IsRUFBRSxrQkFBdUMsRUFBRSxhQUFhLFdBQVc7QUFDdkYsVUFBRTtBQUNGLFdBQUc7QUFDRCxZQUFFO0FBRUYsWUFBRSxRQUFRLEtBQUssR0FBRyxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsV0FBVyxZQUFZLEVBQUU7QUFDL0Qsc0JBQVksRUFBRSxLQUFLLEVBQUUsV0FBVyxFQUFFLFVBQVUsRUFBRSxLQUFLLEVBQUU7QUFDckQsWUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFO0FBQUEsUUFLdEIsV0FBVyxFQUFFLGlCQUFpQjtBQUM5QixVQUFFO0FBQUEsTUFDSixPQUNBO0FBQ0UsVUFBRSxZQUFZLEVBQUU7QUFDaEIsVUFBRSxlQUFlO0FBQ2pCLFVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRTtBQUVyQixVQUFFLFFBQVEsS0FBSyxHQUFHLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxXQUFXLEVBQUU7QUFBQTtBQUFBLElBU3ZELE9BQU87QUFJTCxlQUFTLFVBQVUsR0FBRyxHQUFHLEVBQUUsT0FBTyxFQUFFLFNBQVM7QUFFN0MsUUFBRTtBQUNGLFFBQUU7QUFBQTtBQUVKLFFBQUksUUFBUTtBQUVWLHVCQUFpQixHQUFHLEtBQUs7QUFDekIsVUFBSSxFQUFFLEtBQUssY0FBYyxHQUFHO0FBQzFCLGVBQU87QUFBQSxNQUNUO0FBQUEsSUFFRjtBQUFBLEVBQ0Y7QUFDQSxJQUFFLFNBQVcsRUFBRSxXQUFZLFlBQVksSUFBTSxFQUFFLFdBQVcsWUFBWTtBQUN0RSxNQUFJLFVBQVUsWUFBWTtBQUV4QixxQkFBaUIsR0FBRyxJQUFJO0FBQ3hCLFFBQUksRUFBRSxLQUFLLGNBQWMsR0FBRztBQUMxQixhQUFPO0FBQUEsSUFDVDtBQUVBLFdBQU87QUFBQSxFQUNUO0FBQ0EsTUFBSSxFQUFFLFVBQVU7QUFFZCxxQkFBaUIsR0FBRyxLQUFLO0FBQ3pCLFFBQUksRUFBRSxLQUFLLGNBQWMsR0FBRztBQUMxQixhQUFPO0FBQUEsSUFDVDtBQUFBLEVBRUY7QUFDQSxTQUFPO0FBQUE7QUFRVCxJQUFNLGVBQWUsQ0FBQyxHQUFHLFVBQVU7QUFFakMsTUFBSTtBQUNKLE1BQUk7QUFFSixNQUFJO0FBR0osWUFBUztBQU1QLFFBQUksRUFBRSxZQUFZLGVBQWU7QUFDL0Isa0JBQVksQ0FBQztBQUNiLFVBQUksRUFBRSxZQUFZLGlCQUFpQixVQUFVLGNBQWM7QUFDekQsZUFBTztBQUFBLE1BQ1Q7QUFDQSxVQUFJLEVBQUUsY0FBYyxHQUFHO0FBQUU7QUFBQSxNQUFPO0FBQUEsSUFDbEM7QUFLQSxnQkFBWTtBQUNaLFFBQUksRUFBRSxhQUFhLFdBQVc7QUFFNUIsUUFBRSxRQUFRLEtBQUssR0FBRyxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsV0FBVyxZQUFZLEVBQUU7QUFDL0Qsa0JBQVksRUFBRSxLQUFLLEVBQUUsV0FBVyxFQUFFLFVBQVUsRUFBRSxLQUFLLEVBQUU7QUFDckQsUUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFO0FBQUEsSUFFdEI7QUFJQSxNQUFFLGNBQWMsRUFBRTtBQUNsQixNQUFFLGFBQWEsRUFBRTtBQUNqQixNQUFFLGVBQWUsWUFBWTtBQUU3QixRQUFJLGNBQWMsS0FBWSxFQUFFLGNBQWMsRUFBRSxrQkFDNUMsRUFBRSxXQUFXLGFBQWMsRUFBRSxTQUFTLGVBQStCO0FBS3ZFLFFBQUUsZUFBZSxjQUFjLEdBQUcsU0FBUztBQUczQyxVQUFJLEVBQUUsZ0JBQWdCLE1BQ2xCLEVBQUUsYUFBYSxjQUFlLEVBQUUsaUJBQWlCLGFBQWEsRUFBRSxXQUFXLEVBQUUsY0FBYyxPQUFtQjtBQUtoSCxVQUFFLGVBQWUsWUFBWTtBQUFBLE1BQy9CO0FBQUEsSUFDRjtBQUlBLFFBQUksRUFBRSxlQUFlLGFBQWEsRUFBRSxnQkFBZ0IsRUFBRSxhQUFhO0FBQ2pFLG1CQUFhLEVBQUUsV0FBVyxFQUFFLFlBQVk7QUFPeEMsZUFBUyxVQUFVLEdBQUcsRUFBRSxXQUFXLElBQUksRUFBRSxZQUFZLEVBQUUsY0FBYyxTQUFTO0FBTTlFLFFBQUUsYUFBYSxFQUFFLGNBQWM7QUFDL0IsUUFBRSxlQUFlO0FBQ2pCLFNBQUc7QUFDRCxjQUFNLEVBQUUsWUFBWSxZQUFZO0FBRTlCLFlBQUUsUUFBUSxLQUFLLEdBQUcsRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLFdBQVcsWUFBWSxFQUFFO0FBQy9ELHNCQUFZLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBRSxVQUFVLEVBQUUsS0FBSyxFQUFFO0FBQ3JELFlBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRTtBQUFBLFFBRXRCO0FBQUEsTUFDRixXQUFXLEVBQUUsZ0JBQWdCO0FBQzdCLFFBQUUsa0JBQWtCO0FBQ3BCLFFBQUUsZUFBZSxZQUFZO0FBQzdCLFFBQUU7QUFFRixVQUFJLFFBQVE7QUFFVix5QkFBaUIsR0FBRyxLQUFLO0FBQ3pCLFlBQUksRUFBRSxLQUFLLGNBQWMsR0FBRztBQUMxQixpQkFBTztBQUFBLFFBQ1Q7QUFBQSxNQUVGO0FBQUEsSUFFRixXQUFXLEVBQUUsaUJBQWlCO0FBTzVCLGVBQVMsVUFBVSxHQUFHLEdBQUcsRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFO0FBRWpELFVBQUksUUFBUTtBQUVWLHlCQUFpQixHQUFHLEtBQUs7QUFBQSxNQUUzQjtBQUNBLFFBQUU7QUFDRixRQUFFO0FBQ0YsVUFBSSxFQUFFLEtBQUssY0FBYyxHQUFHO0FBQzFCLGVBQU87QUFBQSxNQUNUO0FBQUEsSUFDRixPQUFPO0FBSUwsUUFBRSxrQkFBa0I7QUFDcEIsUUFBRTtBQUNGLFFBQUU7QUFBQTtBQUFBLEVBRU47QUFFQSxNQUFJLEVBQUUsaUJBQWlCO0FBR3JCLGFBQVMsVUFBVSxHQUFHLEdBQUcsRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFO0FBRWpELE1BQUUsa0JBQWtCO0FBQUEsRUFDdEI7QUFDQSxJQUFFLFNBQVMsRUFBRSxXQUFXLFlBQVksSUFBSSxFQUFFLFdBQVcsWUFBWTtBQUNqRSxNQUFJLFVBQVUsWUFBWTtBQUV4QixxQkFBaUIsR0FBRyxJQUFJO0FBQ3hCLFFBQUksRUFBRSxLQUFLLGNBQWMsR0FBRztBQUMxQixhQUFPO0FBQUEsSUFDVDtBQUVBLFdBQU87QUFBQSxFQUNUO0FBQ0EsTUFBSSxFQUFFLFVBQVU7QUFFZCxxQkFBaUIsR0FBRyxLQUFLO0FBQ3pCLFFBQUksRUFBRSxLQUFLLGNBQWMsR0FBRztBQUMxQixhQUFPO0FBQUEsSUFDVDtBQUFBLEVBRUY7QUFFQSxTQUFPO0FBQUE7QUFTVCxJQUFNLGNBQWMsQ0FBQyxHQUFHLFVBQVU7QUFFaEMsTUFBSTtBQUNKLE1BQUk7QUFDSixNQUFJLE1BQU07QUFFVixRQUFNLE9BQU8sRUFBRTtBQUVmLFlBQVM7QUFLUCxRQUFJLEVBQUUsYUFBYSxXQUFXO0FBQzVCLGtCQUFZLENBQUM7QUFDYixVQUFJLEVBQUUsYUFBYSxhQUFhLFVBQVUsY0FBYztBQUN0RCxlQUFPO0FBQUEsTUFDVDtBQUNBLFVBQUksRUFBRSxjQUFjLEdBQUc7QUFBRTtBQUFBLE1BQU87QUFBQSxJQUNsQztBQUdBLE1BQUUsZUFBZTtBQUNqQixRQUFJLEVBQUUsYUFBYSxhQUFhLEVBQUUsV0FBVyxHQUFHO0FBQzlDLGFBQU8sRUFBRSxXQUFXO0FBQ3BCLGFBQU8sS0FBSztBQUNaLFVBQUksU0FBUyxLQUFLLEVBQUUsU0FBUyxTQUFTLEtBQUssRUFBRSxTQUFTLFNBQVMsS0FBSyxFQUFFLE9BQU87QUFDM0UsaUJBQVMsRUFBRSxXQUFXO0FBQ3RCLFdBQUc7QUFBQSxRQUVILFNBQVMsU0FBUyxLQUFLLEVBQUUsU0FBUyxTQUFTLEtBQUssRUFBRSxTQUN6QyxTQUFTLEtBQUssRUFBRSxTQUFTLFNBQVMsS0FBSyxFQUFFLFNBQ3pDLFNBQVMsS0FBSyxFQUFFLFNBQVMsU0FBUyxLQUFLLEVBQUUsU0FDekMsU0FBUyxLQUFLLEVBQUUsU0FBUyxTQUFTLEtBQUssRUFBRSxTQUN6QyxPQUFPO0FBQ2hCLFVBQUUsZUFBZSxhQUFhLFNBQVM7QUFDdkMsWUFBSSxFQUFFLGVBQWUsRUFBRSxXQUFXO0FBQ2hDLFlBQUUsZUFBZSxFQUFFO0FBQUEsUUFDckI7QUFBQSxNQUNGO0FBQUEsSUFFRjtBQUdBLFFBQUksRUFBRSxnQkFBZ0IsV0FBVztBQUkvQixlQUFTLFVBQVUsR0FBRyxHQUFHLEVBQUUsZUFBZSxTQUFTO0FBRW5ELFFBQUUsYUFBYSxFQUFFO0FBQ2pCLFFBQUUsWUFBWSxFQUFFO0FBQ2hCLFFBQUUsZUFBZTtBQUFBLElBQ25CLE9BQU87QUFJTCxlQUFTLFVBQVUsR0FBRyxHQUFHLEVBQUUsT0FBTyxFQUFFLFNBQVM7QUFFN0MsUUFBRTtBQUNGLFFBQUU7QUFBQTtBQUVKLFFBQUksUUFBUTtBQUVWLHVCQUFpQixHQUFHLEtBQUs7QUFDekIsVUFBSSxFQUFFLEtBQUssY0FBYyxHQUFHO0FBQzFCLGVBQU87QUFBQSxNQUNUO0FBQUEsSUFFRjtBQUFBLEVBQ0Y7QUFDQSxJQUFFLFNBQVM7QUFDWCxNQUFJLFVBQVUsWUFBWTtBQUV4QixxQkFBaUIsR0FBRyxJQUFJO0FBQ3hCLFFBQUksRUFBRSxLQUFLLGNBQWMsR0FBRztBQUMxQixhQUFPO0FBQUEsSUFDVDtBQUVBLFdBQU87QUFBQSxFQUNUO0FBQ0EsTUFBSSxFQUFFLFVBQVU7QUFFZCxxQkFBaUIsR0FBRyxLQUFLO0FBQ3pCLFFBQUksRUFBRSxLQUFLLGNBQWMsR0FBRztBQUMxQixhQUFPO0FBQUEsSUFDVDtBQUFBLEVBRUY7QUFDQSxTQUFPO0FBQUE7QUFPVCxJQUFNLGVBQWUsQ0FBQyxHQUFHLFVBQVU7QUFFakMsTUFBSTtBQUVKLFlBQVM7QUFFUCxRQUFJLEVBQUUsY0FBYyxHQUFHO0FBQ3JCLGtCQUFZLENBQUM7QUFDYixVQUFJLEVBQUUsY0FBYyxHQUFHO0FBQ3JCLFlBQUksVUFBVSxjQUFjO0FBQzFCLGlCQUFPO0FBQUEsUUFDVDtBQUNBO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFHQSxNQUFFLGVBQWU7QUFHakIsYUFBUyxVQUFVLEdBQUcsR0FBRyxFQUFFLE9BQU8sRUFBRSxTQUFTO0FBQzdDLE1BQUU7QUFDRixNQUFFO0FBQ0YsUUFBSSxRQUFRO0FBRVYsdUJBQWlCLEdBQUcsS0FBSztBQUN6QixVQUFJLEVBQUUsS0FBSyxjQUFjLEdBQUc7QUFDMUIsZUFBTztBQUFBLE1BQ1Q7QUFBQSxJQUVGO0FBQUEsRUFDRjtBQUNBLElBQUUsU0FBUztBQUNYLE1BQUksVUFBVSxZQUFZO0FBRXhCLHFCQUFpQixHQUFHLElBQUk7QUFDeEIsUUFBSSxFQUFFLEtBQUssY0FBYyxHQUFHO0FBQzFCLGFBQU87QUFBQSxJQUNUO0FBRUEsV0FBTztBQUFBLEVBQ1Q7QUFDQSxNQUFJLEVBQUUsVUFBVTtBQUVkLHFCQUFpQixHQUFHLEtBQUs7QUFDekIsUUFBSSxFQUFFLEtBQUssY0FBYyxHQUFHO0FBQzFCLGFBQU87QUFBQSxJQUNUO0FBQUEsRUFFRjtBQUNBLFNBQU87QUFBQTtBQWlCVCxJQUFNLHNCQUFzQjtBQUFBLEVBRTFCLElBQUksT0FBTyxHQUFHLEdBQUcsR0FBRyxHQUFHLGNBQWM7QUFBQSxFQUNyQyxJQUFJLE9BQU8sR0FBRyxHQUFHLEdBQUcsR0FBRyxZQUFZO0FBQUEsRUFDbkMsSUFBSSxPQUFPLEdBQUcsR0FBRyxJQUFJLEdBQUcsWUFBWTtBQUFBLEVBQ3BDLElBQUksT0FBTyxHQUFHLEdBQUcsSUFBSSxJQUFJLFlBQVk7QUFBQSxFQUVyQyxJQUFJLE9BQU8sR0FBRyxHQUFHLElBQUksSUFBSSxZQUFZO0FBQUEsRUFDckMsSUFBSSxPQUFPLEdBQUcsSUFBSSxJQUFJLElBQUksWUFBWTtBQUFBLEVBQ3RDLElBQUksT0FBTyxHQUFHLElBQUksS0FBSyxLQUFLLFlBQVk7QUFBQSxFQUN4QyxJQUFJLE9BQU8sR0FBRyxJQUFJLEtBQUssS0FBSyxZQUFZO0FBQUEsRUFDeEMsSUFBSSxPQUFPLElBQUksS0FBSyxLQUFLLE1BQU0sWUFBWTtBQUFBLEVBQzNDLElBQUksT0FBTyxJQUFJLEtBQUssS0FBSyxNQUFNLFlBQVk7QUFDN0M7QUFNQSxJQUFNLFVBQVUsQ0FBQyxNQUFNO0FBRXJCLElBQUUsY0FBYyxJQUFJLEVBQUU7QUFHdEIsT0FBSyxFQUFFLElBQUk7QUFJWCxJQUFFLGlCQUFpQixvQkFBb0IsRUFBRSxPQUFPO0FBQ2hELElBQUUsYUFBYSxvQkFBb0IsRUFBRSxPQUFPO0FBQzVDLElBQUUsYUFBYSxvQkFBb0IsRUFBRSxPQUFPO0FBQzVDLElBQUUsbUJBQW1CLG9CQUFvQixFQUFFLE9BQU87QUFFbEQsSUFBRSxXQUFXO0FBQ2IsSUFBRSxjQUFjO0FBQ2hCLElBQUUsWUFBWTtBQUNkLElBQUUsU0FBUztBQUNYLElBQUUsZUFBZSxFQUFFLGNBQWMsWUFBWTtBQUM3QyxJQUFFLGtCQUFrQjtBQUNwQixJQUFFLFFBQVE7QUFBQTtBQStMWixJQUFNLG9CQUFvQixDQUFDLFNBQVM7QUFFbEMsT0FBSyxNQUFNO0FBQ1QsV0FBTztBQUFBLEVBQ1Q7QUFDQSxRQUFNLElBQUksS0FBSztBQUNmLE9BQUssS0FBSyxFQUFFLFNBQVMsUUFBUyxFQUFFLFdBQVcsY0FFYixFQUFFLFdBQVcsY0FFYixFQUFFLFdBQVcsZUFDYixFQUFFLFdBQVcsY0FDYixFQUFFLFdBQVcsaUJBQ2IsRUFBRSxXQUFXLGNBQ2IsRUFBRSxXQUFXLGNBQ2IsRUFBRSxXQUFXLGNBQWU7QUFDeEQsV0FBTztBQUFBLEVBQ1Q7QUFDQSxTQUFPO0FBQUE7QUFJVCxJQUFNLG1CQUFtQixDQUFDLFNBQVM7QUFFakMsTUFBSSxrQkFBa0IsSUFBSSxHQUFHO0FBQzNCLFdBQU8sSUFBSSxNQUFNLGdCQUFnQjtBQUFBLEVBQ25DO0FBRUEsT0FBSyxXQUFXLEtBQUssWUFBWTtBQUNqQyxPQUFLLFlBQVk7QUFFakIsUUFBTSxJQUFJLEtBQUs7QUFDZixJQUFFLFVBQVU7QUFDWixJQUFFLGNBQWM7QUFFaEIsTUFBSSxFQUFFLE9BQU8sR0FBRztBQUNkLE1BQUUsUUFBUSxFQUFFO0FBQUEsRUFFZDtBQUNBLElBQUUsU0FFQSxFQUFFLFNBQVMsSUFBSSxhQUVmLEVBQUUsT0FBTyxhQUFhO0FBQ3hCLE9BQUssUUFBUyxFQUFFLFNBQVMsSUFDdkIsSUFFQTtBQUNGLElBQUUsYUFBYTtBQUNmLFdBQVMsQ0FBQztBQUNWLFNBQU87QUFBQTtBQUlULElBQU0sZUFBZSxDQUFDLFNBQVM7QUFFN0IsUUFBTSxNQUFNLGlCQUFpQixJQUFJO0FBQ2pDLE1BQUksUUFBUSxRQUFRO0FBQ2xCLFlBQVEsS0FBSyxLQUFLO0FBQUEsRUFDcEI7QUFDQSxTQUFPO0FBQUE7QUFJVCxJQUFNLG1CQUFtQixDQUFDLE1BQU0sU0FBUztBQUV2QyxNQUFJLGtCQUFrQixJQUFJLEtBQUssS0FBSyxNQUFNLFNBQVMsR0FBRztBQUNwRCxXQUFPO0FBQUEsRUFDVDtBQUNBLE9BQUssTUFBTSxTQUFTO0FBQ3BCLFNBQU87QUFBQTtBQUlULElBQU0sZUFBZSxDQUFDLE1BQU0sT0FBTyxRQUFRLFlBQVksVUFBVSxhQUFhO0FBRTVFLE9BQUssTUFBTTtBQUNULFdBQU87QUFBQSxFQUNUO0FBQ0EsTUFBSSxPQUFPO0FBRVgsTUFBSSxVQUFVLHlCQUF5QjtBQUNyQyxZQUFRO0FBQUEsRUFDVjtBQUVBLE1BQUksYUFBYSxHQUFHO0FBQ2xCLFdBQU87QUFDUCxrQkFBYztBQUFBLEVBQ2hCLFdBRVMsYUFBYSxJQUFJO0FBQ3hCLFdBQU87QUFDUCxrQkFBYztBQUFBLEVBQ2hCO0FBR0EsTUFBSSxXQUFXLEtBQUssV0FBVyxpQkFBaUIsV0FBVyxnQkFDekQsYUFBYSxLQUFLLGFBQWEsTUFBTSxRQUFRLEtBQUssUUFBUSxLQUMxRCxXQUFXLEtBQUssV0FBVyxXQUFZLGVBQWUsS0FBSyxTQUFTLEdBQUk7QUFDeEUsV0FBTyxJQUFJLE1BQU0sZ0JBQWdCO0FBQUEsRUFDbkM7QUFHQSxNQUFJLGVBQWUsR0FBRztBQUNwQixpQkFBYTtBQUFBLEVBQ2Y7QUFHQSxRQUFNLElBQUksSUFBSTtBQUVkLE9BQUssUUFBUTtBQUNiLElBQUUsT0FBTztBQUNULElBQUUsU0FBUztBQUVYLElBQUUsT0FBTztBQUNULElBQUUsU0FBUztBQUNYLElBQUUsU0FBUztBQUNYLElBQUUsU0FBUyxLQUFLLEVBQUU7QUFDbEIsSUFBRSxTQUFTLEVBQUUsU0FBUztBQUV0QixJQUFFLFlBQVksV0FBVztBQUN6QixJQUFFLFlBQVksS0FBSyxFQUFFO0FBQ3JCLElBQUUsWUFBWSxFQUFFLFlBQVk7QUFDNUIsSUFBRSxpQkFBaUIsRUFBRSxZQUFZLFlBQVksS0FBSztBQUVsRCxJQUFFLFNBQVMsSUFBSSxXQUFXLEVBQUUsU0FBUyxDQUFDO0FBQ3RDLElBQUUsT0FBTyxJQUFJLFlBQVksRUFBRSxTQUFTO0FBQ3BDLElBQUUsT0FBTyxJQUFJLFlBQVksRUFBRSxNQUFNO0FBS2pDLElBQUUsY0FBYyxLQUFNLFdBQVc7QUF5Q2pDLElBQUUsbUJBQW1CLEVBQUUsY0FBYztBQUNyQyxJQUFFLGNBQWMsSUFBSSxXQUFXLEVBQUUsZ0JBQWdCO0FBSWpELElBQUUsVUFBVSxFQUFFO0FBR2QsSUFBRSxXQUFXLEVBQUUsY0FBYyxLQUFLO0FBTWxDLElBQUUsUUFBUTtBQUNWLElBQUUsV0FBVztBQUNiLElBQUUsU0FBUztBQUVYLFNBQU8sYUFBYSxJQUFJO0FBQUE7QUFHMUIsSUFBTSxjQUFjLENBQUMsTUFBTSxVQUFVO0FBRW5DLFNBQU8sYUFBYSxNQUFNLE9BQU8sY0FBYyxhQUFhLGVBQWUsb0JBQW9CO0FBQUE7QUFLakcsSUFBTSxZQUFZLENBQUMsTUFBTSxVQUFVO0FBRWpDLE1BQUksa0JBQWtCLElBQUksS0FBSyxRQUFRLGFBQWEsUUFBUSxHQUFHO0FBQzdELFdBQU8sT0FBTyxJQUFJLE1BQU0sZ0JBQWdCLElBQUk7QUFBQSxFQUM5QztBQUVBLFFBQU0sSUFBSSxLQUFLO0FBRWYsT0FBSyxLQUFLLFVBQ0wsS0FBSyxhQUFhLE1BQU0sS0FBSyxTQUM3QixFQUFFLFdBQVcsZ0JBQWdCLFVBQVUsWUFBYTtBQUN2RCxXQUFPLElBQUksTUFBTyxLQUFLLGNBQWMsSUFBSyxnQkFBZ0IsZ0JBQWdCO0FBQUEsRUFDNUU7QUFFQSxRQUFNLFlBQVksRUFBRTtBQUNwQixJQUFFLGFBQWE7QUFHZixNQUFJLEVBQUUsWUFBWSxHQUFHO0FBQ25CLGtCQUFjLElBQUk7QUFDbEIsUUFBSSxLQUFLLGNBQWMsR0FBRztBQU94QixRQUFFLGFBQWE7QUFDZixhQUFPO0FBQUEsSUFDVDtBQUFBLEVBTUYsV0FBVyxLQUFLLGFBQWEsS0FBSyxLQUFLLEtBQUssS0FBSyxLQUFLLFNBQVMsS0FDN0QsVUFBVSxZQUFZO0FBQ3RCLFdBQU8sSUFBSSxNQUFNLGFBQWE7QUFBQSxFQUNoQztBQUdBLE1BQUksRUFBRSxXQUFXLGdCQUFnQixLQUFLLGFBQWEsR0FBRztBQUNwRCxXQUFPLElBQUksTUFBTSxhQUFhO0FBQUEsRUFDaEM7QUFHQSxNQUFJLEVBQUUsV0FBVyxjQUFjLEVBQUUsU0FBUyxHQUFHO0FBQzNDLE1BQUUsU0FBUztBQUFBLEVBQ2I7QUFDQSxNQUFJLEVBQUUsV0FBVyxZQUFZO0FBRTNCLFFBQUksU0FBVSxnQkFBaUIsRUFBRSxTQUFTLEtBQU0sTUFBTztBQUN2RCxRQUFJLGNBQWM7QUFFbEIsUUFBSSxFQUFFLFlBQVksa0JBQWtCLEVBQUUsUUFBUSxHQUFHO0FBQy9DLG9CQUFjO0FBQUEsSUFDaEIsV0FBVyxFQUFFLFFBQVEsR0FBRztBQUN0QixvQkFBYztBQUFBLElBQ2hCLFdBQVcsRUFBRSxVQUFVLEdBQUc7QUFDeEIsb0JBQWM7QUFBQSxJQUNoQixPQUFPO0FBQ0wsb0JBQWM7QUFBQTtBQUVoQixjQUFXLGVBQWU7QUFDMUIsUUFBSSxFQUFFLGFBQWEsR0FBRztBQUFFLGdCQUFVO0FBQUEsSUFBYTtBQUMvQyxjQUFVLEtBQU0sU0FBUztBQUV6QixnQkFBWSxHQUFHLE1BQU07QUFHckIsUUFBSSxFQUFFLGFBQWEsR0FBRztBQUNwQixrQkFBWSxHQUFHLEtBQUssVUFBVSxFQUFFO0FBQ2hDLGtCQUFZLEdBQUcsS0FBSyxRQUFRLEtBQU07QUFBQSxJQUNwQztBQUNBLFNBQUssUUFBUTtBQUNiLE1BQUUsU0FBUztBQUdYLGtCQUFjLElBQUk7QUFDbEIsUUFBSSxFQUFFLFlBQVksR0FBRztBQUNuQixRQUFFLGFBQWE7QUFDZixhQUFPO0FBQUEsSUFDVDtBQUFBLEVBQ0Y7QUFFQSxNQUFJLEVBQUUsV0FBVyxZQUFZO0FBRTNCLFNBQUssUUFBUTtBQUNiLGFBQVMsR0FBRyxFQUFFO0FBQ2QsYUFBUyxHQUFHLEdBQUc7QUFDZixhQUFTLEdBQUcsQ0FBQztBQUNiLFNBQUssRUFBRSxRQUFRO0FBQ2IsZUFBUyxHQUFHLENBQUM7QUFDYixlQUFTLEdBQUcsQ0FBQztBQUNiLGVBQVMsR0FBRyxDQUFDO0FBQ2IsZUFBUyxHQUFHLENBQUM7QUFDYixlQUFTLEdBQUcsQ0FBQztBQUNiLGVBQVMsR0FBRyxFQUFFLFVBQVUsSUFBSSxJQUNmLEVBQUUsWUFBWSxrQkFBa0IsRUFBRSxRQUFRLElBQzFDLElBQUksQ0FBRTtBQUNuQixlQUFTLEdBQUcsT0FBTztBQUNuQixRQUFFLFNBQVM7QUFHWCxvQkFBYyxJQUFJO0FBQ2xCLFVBQUksRUFBRSxZQUFZLEdBQUc7QUFDbkIsVUFBRSxhQUFhO0FBQ2YsZUFBTztBQUFBLE1BQ1Q7QUFBQSxJQUNGLE9BQ0s7QUFDSCxlQUFTLElBQUksRUFBRSxPQUFPLE9BQU8sSUFBSSxNQUNwQixFQUFFLE9BQU8sT0FBTyxJQUFJLE9BQ25CLEVBQUUsT0FBTyxRQUFRLElBQUksT0FDckIsRUFBRSxPQUFPLE9BQU8sSUFBSSxPQUNwQixFQUFFLE9BQU8sVUFBVSxJQUFJLEdBQ3JDO0FBQ0EsZUFBUyxHQUFHLEVBQUUsT0FBTyxPQUFPLEdBQUk7QUFDaEMsZUFBUyxHQUFJLEVBQUUsT0FBTyxRQUFRLElBQUssR0FBSTtBQUN2QyxlQUFTLEdBQUksRUFBRSxPQUFPLFFBQVEsS0FBTSxHQUFJO0FBQ3hDLGVBQVMsR0FBSSxFQUFFLE9BQU8sUUFBUSxLQUFNLEdBQUk7QUFDeEMsZUFBUyxHQUFHLEVBQUUsVUFBVSxJQUFJLElBQ2YsRUFBRSxZQUFZLGtCQUFrQixFQUFFLFFBQVEsSUFDMUMsSUFBSSxDQUFFO0FBQ25CLGVBQVMsR0FBRyxFQUFFLE9BQU8sS0FBSyxHQUFJO0FBQzlCLFVBQUksRUFBRSxPQUFPLFNBQVMsRUFBRSxPQUFPLE1BQU0sUUFBUTtBQUMzQyxpQkFBUyxHQUFHLEVBQUUsT0FBTyxNQUFNLFNBQVMsR0FBSTtBQUN4QyxpQkFBUyxHQUFJLEVBQUUsT0FBTyxNQUFNLFVBQVUsSUFBSyxHQUFJO0FBQUEsTUFDakQ7QUFDQSxVQUFJLEVBQUUsT0FBTyxNQUFNO0FBQ2pCLGFBQUssUUFBUSxRQUFRLEtBQUssT0FBTyxFQUFFLGFBQWEsRUFBRSxTQUFTLENBQUM7QUFBQSxNQUM5RDtBQUNBLFFBQUUsVUFBVTtBQUNaLFFBQUUsU0FBUztBQUFBO0FBQUEsRUFFZjtBQUNBLE1BQUksRUFBRSxXQUFXLGFBQWE7QUFDNUIsUUFBSSxFQUFFLE9BQU8sT0FBcUI7QUFDaEMsVUFBSSxNQUFNLEVBQUU7QUFDWixVQUFJLFFBQVEsRUFBRSxPQUFPLE1BQU0sU0FBUyxTQUFVLEVBQUU7QUFDaEQsYUFBTyxFQUFFLFVBQVUsT0FBTyxFQUFFLGtCQUFrQjtBQUM1QyxZQUFJLE9BQU8sRUFBRSxtQkFBbUIsRUFBRTtBQUdsQyxVQUFFLFlBQVksSUFBSSxFQUFFLE9BQU8sTUFBTSxTQUFTLEVBQUUsU0FBUyxFQUFFLFVBQVUsSUFBSSxHQUFHLEVBQUUsT0FBTztBQUNqRixVQUFFLFVBQVUsRUFBRTtBQUVkLFlBQUksRUFBRSxPQUFPLFFBQVEsRUFBRSxVQUFVLEtBQUs7QUFDcEMsZUFBSyxRQUFRLFFBQVEsS0FBSyxPQUFPLEVBQUUsYUFBYSxFQUFFLFVBQVUsS0FBSyxHQUFHO0FBQUEsUUFDdEU7QUFFQSxVQUFFLFdBQVc7QUFDYixzQkFBYyxJQUFJO0FBQ2xCLFlBQUksRUFBRSxZQUFZLEdBQUc7QUFDbkIsWUFBRSxhQUFhO0FBQ2YsaUJBQU87QUFBQSxRQUNUO0FBQ0EsY0FBTTtBQUNOLGdCQUFRO0FBQUEsTUFDVjtBQUdBLFVBQUksZUFBZSxJQUFJLFdBQVcsRUFBRSxPQUFPLEtBQUs7QUFHaEQsUUFBRSxZQUFZLElBQUksYUFBYSxTQUFTLEVBQUUsU0FBUyxFQUFFLFVBQVUsSUFBSSxHQUFHLEVBQUUsT0FBTztBQUMvRSxRQUFFLFdBQVc7QUFFYixVQUFJLEVBQUUsT0FBTyxRQUFRLEVBQUUsVUFBVSxLQUFLO0FBQ3BDLGFBQUssUUFBUSxRQUFRLEtBQUssT0FBTyxFQUFFLGFBQWEsRUFBRSxVQUFVLEtBQUssR0FBRztBQUFBLE1BQ3RFO0FBRUEsUUFBRSxVQUFVO0FBQUEsSUFDZDtBQUNBLE1BQUUsU0FBUztBQUFBLEVBQ2I7QUFDQSxNQUFJLEVBQUUsV0FBVyxZQUFZO0FBQzNCLFFBQUksRUFBRSxPQUFPLE1BQW9CO0FBQy9CLFVBQUksTUFBTSxFQUFFO0FBQ1osVUFBSTtBQUNKLFNBQUc7QUFDRCxZQUFJLEVBQUUsWUFBWSxFQUFFLGtCQUFrQjtBQUVwQyxjQUFJLEVBQUUsT0FBTyxRQUFRLEVBQUUsVUFBVSxLQUFLO0FBQ3BDLGlCQUFLLFFBQVEsUUFBUSxLQUFLLE9BQU8sRUFBRSxhQUFhLEVBQUUsVUFBVSxLQUFLLEdBQUc7QUFBQSxVQUN0RTtBQUVBLHdCQUFjLElBQUk7QUFDbEIsY0FBSSxFQUFFLFlBQVksR0FBRztBQUNuQixjQUFFLGFBQWE7QUFDZixtQkFBTztBQUFBLFVBQ1Q7QUFDQSxnQkFBTTtBQUFBLFFBQ1I7QUFFQSxZQUFJLEVBQUUsVUFBVSxFQUFFLE9BQU8sS0FBSyxRQUFRO0FBQ3BDLGdCQUFNLEVBQUUsT0FBTyxLQUFLLFdBQVcsRUFBRSxTQUFTLElBQUk7QUFBQSxRQUNoRCxPQUFPO0FBQ0wsZ0JBQU07QUFBQTtBQUVSLGlCQUFTLEdBQUcsR0FBRztBQUFBLE1BQ2pCLFNBQVMsUUFBUTtBQUVqQixVQUFJLEVBQUUsT0FBTyxRQUFRLEVBQUUsVUFBVSxLQUFLO0FBQ3BDLGFBQUssUUFBUSxRQUFRLEtBQUssT0FBTyxFQUFFLGFBQWEsRUFBRSxVQUFVLEtBQUssR0FBRztBQUFBLE1BQ3RFO0FBRUEsUUFBRSxVQUFVO0FBQUEsSUFDZDtBQUNBLE1BQUUsU0FBUztBQUFBLEVBQ2I7QUFDQSxNQUFJLEVBQUUsV0FBVyxlQUFlO0FBQzlCLFFBQUksRUFBRSxPQUFPLFNBQXVCO0FBQ2xDLFVBQUksTUFBTSxFQUFFO0FBQ1osVUFBSTtBQUNKLFNBQUc7QUFDRCxZQUFJLEVBQUUsWUFBWSxFQUFFLGtCQUFrQjtBQUVwQyxjQUFJLEVBQUUsT0FBTyxRQUFRLEVBQUUsVUFBVSxLQUFLO0FBQ3BDLGlCQUFLLFFBQVEsUUFBUSxLQUFLLE9BQU8sRUFBRSxhQUFhLEVBQUUsVUFBVSxLQUFLLEdBQUc7QUFBQSxVQUN0RTtBQUVBLHdCQUFjLElBQUk7QUFDbEIsY0FBSSxFQUFFLFlBQVksR0FBRztBQUNuQixjQUFFLGFBQWE7QUFDZixtQkFBTztBQUFBLFVBQ1Q7QUFDQSxnQkFBTTtBQUFBLFFBQ1I7QUFFQSxZQUFJLEVBQUUsVUFBVSxFQUFFLE9BQU8sUUFBUSxRQUFRO0FBQ3ZDLGdCQUFNLEVBQUUsT0FBTyxRQUFRLFdBQVcsRUFBRSxTQUFTLElBQUk7QUFBQSxRQUNuRCxPQUFPO0FBQ0wsZ0JBQU07QUFBQTtBQUVSLGlCQUFTLEdBQUcsR0FBRztBQUFBLE1BQ2pCLFNBQVMsUUFBUTtBQUVqQixVQUFJLEVBQUUsT0FBTyxRQUFRLEVBQUUsVUFBVSxLQUFLO0FBQ3BDLGFBQUssUUFBUSxRQUFRLEtBQUssT0FBTyxFQUFFLGFBQWEsRUFBRSxVQUFVLEtBQUssR0FBRztBQUFBLE1BQ3RFO0FBQUEsSUFFRjtBQUNBLE1BQUUsU0FBUztBQUFBLEVBQ2I7QUFDQSxNQUFJLEVBQUUsV0FBVyxZQUFZO0FBQzNCLFFBQUksRUFBRSxPQUFPLE1BQU07QUFDakIsVUFBSSxFQUFFLFVBQVUsSUFBSSxFQUFFLGtCQUFrQjtBQUN0QyxzQkFBYyxJQUFJO0FBQ2xCLFlBQUksRUFBRSxZQUFZLEdBQUc7QUFDbkIsWUFBRSxhQUFhO0FBQ2YsaUJBQU87QUFBQSxRQUNUO0FBQUEsTUFDRjtBQUNBLGVBQVMsR0FBRyxLQUFLLFFBQVEsR0FBSTtBQUM3QixlQUFTLEdBQUksS0FBSyxTQUFTLElBQUssR0FBSTtBQUNwQyxXQUFLLFFBQVE7QUFBQSxJQUNmO0FBQ0EsTUFBRSxTQUFTO0FBR1gsa0JBQWMsSUFBSTtBQUNsQixRQUFJLEVBQUUsWUFBWSxHQUFHO0FBQ25CLFFBQUUsYUFBYTtBQUNmLGFBQU87QUFBQSxJQUNUO0FBQUEsRUFDRjtBQUtBLE1BQUksS0FBSyxhQUFhLEtBQUssRUFBRSxjQUFjLEtBQ3hDLFVBQVUsZ0JBQWdCLEVBQUUsV0FBVyxjQUFlO0FBQ3ZELFFBQUksU0FBUyxFQUFFLFVBQVUsSUFBSSxlQUFlLEdBQUcsS0FBSyxJQUN2QyxFQUFFLGFBQWEsaUJBQWlCLGFBQWEsR0FBRyxLQUFLLElBQ3JELEVBQUUsYUFBYSxRQUFRLFlBQVksR0FBRyxLQUFLLElBQzNDLG9CQUFvQixFQUFFLE9BQU8sS0FBSyxHQUFHLEtBQUs7QUFFdkQsUUFBSSxXQUFXLHFCQUFxQixXQUFXLGdCQUFnQjtBQUM3RCxRQUFFLFNBQVM7QUFBQSxJQUNiO0FBQ0EsUUFBSSxXQUFXLGdCQUFnQixXQUFXLG1CQUFtQjtBQUMzRCxVQUFJLEtBQUssY0FBYyxHQUFHO0FBQ3hCLFVBQUUsYUFBYTtBQUFBLE1BRWpCO0FBQ0EsYUFBTztBQUFBLElBUVQ7QUFDQSxRQUFJLFdBQVcsZUFBZTtBQUM1QixVQUFJLFVBQVUsaUJBQWlCO0FBQzdCLGtCQUFVLENBQUM7QUFBQSxNQUNiLFdBQ1MsVUFBVSxXQUFXO0FBRTVCLHlCQUFpQixHQUFHLEdBQUcsR0FBRyxLQUFLO0FBSS9CLFlBQUksVUFBVSxnQkFBZ0I7QUFFNUIsZUFBSyxFQUFFLElBQUk7QUFFWCxjQUFJLEVBQUUsY0FBYyxHQUFHO0FBQ3JCLGNBQUUsV0FBVztBQUNiLGNBQUUsY0FBYztBQUNoQixjQUFFLFNBQVM7QUFBQSxVQUNiO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFDQSxvQkFBYyxJQUFJO0FBQ2xCLFVBQUksS0FBSyxjQUFjLEdBQUc7QUFDeEIsVUFBRSxhQUFhO0FBQ2YsZUFBTztBQUFBLE1BQ1Q7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUVBLE1BQUksVUFBVSxZQUFZO0FBQUUsV0FBTztBQUFBLEVBQVE7QUFDM0MsTUFBSSxFQUFFLFFBQVEsR0FBRztBQUFFLFdBQU87QUFBQSxFQUFnQjtBQUcxQyxNQUFJLEVBQUUsU0FBUyxHQUFHO0FBQ2hCLGFBQVMsR0FBRyxLQUFLLFFBQVEsR0FBSTtBQUM3QixhQUFTLEdBQUksS0FBSyxTQUFTLElBQUssR0FBSTtBQUNwQyxhQUFTLEdBQUksS0FBSyxTQUFTLEtBQU0sR0FBSTtBQUNyQyxhQUFTLEdBQUksS0FBSyxTQUFTLEtBQU0sR0FBSTtBQUNyQyxhQUFTLEdBQUcsS0FBSyxXQUFXLEdBQUk7QUFDaEMsYUFBUyxHQUFJLEtBQUssWUFBWSxJQUFLLEdBQUk7QUFDdkMsYUFBUyxHQUFJLEtBQUssWUFBWSxLQUFNLEdBQUk7QUFDeEMsYUFBUyxHQUFJLEtBQUssWUFBWSxLQUFNLEdBQUk7QUFBQSxFQUMxQyxPQUVBO0FBQ0UsZ0JBQVksR0FBRyxLQUFLLFVBQVUsRUFBRTtBQUNoQyxnQkFBWSxHQUFHLEtBQUssUUFBUSxLQUFNO0FBQUE7QUFHcEMsZ0JBQWMsSUFBSTtBQUlsQixNQUFJLEVBQUUsT0FBTyxHQUFHO0FBQUUsTUFBRSxRQUFRLEVBQUU7QUFBQSxFQUFNO0FBRXBDLFNBQU8sRUFBRSxZQUFZLElBQUksU0FBUztBQUFBO0FBSXBDLElBQU0sYUFBYSxDQUFDLFNBQVM7QUFFM0IsTUFBSSxrQkFBa0IsSUFBSSxHQUFHO0FBQzNCLFdBQU87QUFBQSxFQUNUO0FBRUEsUUFBTSxTQUFTLEtBQUssTUFBTTtBQUUxQixPQUFLLFFBQVE7QUFFYixTQUFPLFdBQVcsYUFBYSxJQUFJLE1BQU0sY0FBYyxJQUFJO0FBQUE7QUFRN0QsSUFBTSx1QkFBdUIsQ0FBQyxNQUFNLGVBQWU7QUFFakQsTUFBSSxhQUFhLFdBQVc7QUFFNUIsTUFBSSxrQkFBa0IsSUFBSSxHQUFHO0FBQzNCLFdBQU87QUFBQSxFQUNUO0FBRUEsUUFBTSxJQUFJLEtBQUs7QUFDZixRQUFNLE9BQU8sRUFBRTtBQUVmLE1BQUksU0FBUyxLQUFNLFNBQVMsS0FBSyxFQUFFLFdBQVcsY0FBZSxFQUFFLFdBQVc7QUFDeEUsV0FBTztBQUFBLEVBQ1Q7QUFHQSxNQUFJLFNBQVMsR0FBRztBQUVkLFNBQUssUUFBUSxVQUFVLEtBQUssT0FBTyxZQUFZLFlBQVksQ0FBQztBQUFBLEVBQzlEO0FBRUEsSUFBRSxPQUFPO0FBR1QsTUFBSSxjQUFjLEVBQUUsUUFBUTtBQUMxQixRQUFJLFNBQVMsR0FBRztBQUVkLFdBQUssRUFBRSxJQUFJO0FBQ1gsUUFBRSxXQUFXO0FBQ2IsUUFBRSxjQUFjO0FBQ2hCLFFBQUUsU0FBUztBQUFBLElBQ2I7QUFHQSxRQUFJLFVBQVUsSUFBSSxXQUFXLEVBQUUsTUFBTTtBQUNyQyxZQUFRLElBQUksV0FBVyxTQUFTLGFBQWEsRUFBRSxRQUFRLFVBQVUsR0FBRyxDQUFDO0FBQ3JFLGlCQUFhO0FBQ2IsaUJBQWEsRUFBRTtBQUFBLEVBQ2pCO0FBRUEsUUFBTSxRQUFRLEtBQUs7QUFDbkIsUUFBTSxPQUFPLEtBQUs7QUFDbEIsUUFBTSxRQUFRLEtBQUs7QUFDbkIsT0FBSyxXQUFXO0FBQ2hCLE9BQUssVUFBVTtBQUNmLE9BQUssUUFBUTtBQUNiLGNBQVksQ0FBQztBQUNiLFNBQU8sRUFBRSxhQUFhLFdBQVc7QUFDL0IsUUFBSSxNQUFNLEVBQUU7QUFDWixRQUFJLElBQUksRUFBRSxhQUFhLFlBQVk7QUFDbkMsT0FBRztBQUVELFFBQUUsUUFBUSxLQUFLLEdBQUcsRUFBRSxPQUFPLEVBQUUsT0FBTyxNQUFNLFlBQVksRUFBRTtBQUV4RCxRQUFFLEtBQUssTUFBTSxFQUFFLFVBQVUsRUFBRSxLQUFLLEVBQUU7QUFFbEMsUUFBRSxLQUFLLEVBQUUsU0FBUztBQUNsQjtBQUFBLElBQ0YsV0FBVztBQUNYLE1BQUUsV0FBVztBQUNiLE1BQUUsWUFBWSxZQUFZO0FBQzFCLGdCQUFZLENBQUM7QUFBQSxFQUNmO0FBQ0EsSUFBRSxZQUFZLEVBQUU7QUFDaEIsSUFBRSxjQUFjLEVBQUU7QUFDbEIsSUFBRSxTQUFTLEVBQUU7QUFDYixJQUFFLFlBQVk7QUFDZCxJQUFFLGVBQWUsRUFBRSxjQUFjLFlBQVk7QUFDN0MsSUFBRSxrQkFBa0I7QUFDcEIsT0FBSyxVQUFVO0FBQ2YsT0FBSyxRQUFRO0FBQ2IsT0FBSyxXQUFXO0FBQ2hCLElBQUUsT0FBTztBQUNULFNBQU87QUFBQTtBQUlULElBQUksZ0JBQWdCO0FBQ3BCLElBQUksaUJBQWlCO0FBQ3JCLElBQUksaUJBQWlCO0FBQ3JCLElBQUkscUJBQXFCO0FBQ3pCLElBQUkscUJBQXFCO0FBQ3pCLElBQUksY0FBYztBQUNsQixJQUFJLGVBQWU7QUFDbkIsSUFBSSx5QkFBeUI7QUFDN0IsSUFBSSxjQUFjO0FBWWxCLElBQUksY0FBYztBQUFBLEVBQ2pCLGFBQWE7QUFBQSxFQUNiLGNBQWM7QUFBQSxFQUNkLGNBQWM7QUFBQSxFQUNkLGtCQUFrQjtBQUFBLEVBQ2xCLGtCQUFrQjtBQUFBLEVBQ2xCLFNBQVM7QUFBQSxFQUNULFlBQVk7QUFBQSxFQUNaLHNCQUFzQjtBQUFBLEVBQ3RCO0FBQ0Q7QUFFQSxJQUFNLE9BQU8sQ0FBQyxLQUFLLFFBQVE7QUFDekIsU0FBTyxPQUFPLFVBQVUsZUFBZSxLQUFLLEtBQUssR0FBRztBQUFBO0FBR3RELElBQUksaUJBQWtCLENBQUMsS0FBa0M7QUFDdkQsUUFBTSxVQUFVLE1BQU0sVUFBVSxNQUFNLEtBQUssV0FBVyxDQUFDO0FBQ3ZELFNBQU8sUUFBUSxRQUFRO0FBQ3JCLFVBQU0sU0FBUyxRQUFRLE1BQU07QUFDN0IsU0FBSyxRQUFRO0FBQUU7QUFBQSxJQUFVO0FBRXpCLGVBQVcsV0FBVyxVQUFVO0FBQzlCLFlBQU0sSUFBSSxVQUFVLFNBQVMsb0JBQW9CO0FBQUEsSUFDbkQ7QUFFQSxlQUFXLEtBQUssUUFBUTtBQUN0QixVQUFJLEtBQUssUUFBUSxDQUFDLEdBQUc7QUFDbkIsWUFBSSxLQUFLLE9BQU87QUFBQSxNQUNsQjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBRUEsU0FBTztBQUFBO0FBS1QsSUFBSSxnQkFBZ0IsQ0FBQyxXQUFXO0FBRTlCLE1BQUksTUFBTTtBQUVWLFdBQVMsSUFBSSxHQUFHLElBQUksT0FBTyxPQUFRLElBQUksR0FBRyxLQUFLO0FBQzdDLFdBQU8sT0FBTyxHQUFHO0FBQUEsRUFDbkI7QUFHQSxRQUFNLFNBQVMsSUFBSSxXQUFXLEdBQUc7QUFFakMsV0FBUyxJQUFJLEdBQUcsTUFBTSxHQUFHLElBQUksT0FBTyxPQUFRLElBQUksR0FBRyxLQUFLO0FBQ3RELFFBQUksUUFBUSxPQUFPO0FBQ25CLFdBQU8sSUFBSSxPQUFPLEdBQUc7QUFDckIsV0FBTyxNQUFNO0FBQUEsRUFDZjtBQUVBLFNBQU87QUFBQTtBQUdULElBQUksU0FBUztBQUFBLEVBQ1o7QUFBQSxFQUNBO0FBQ0Q7QUFVQSxJQUFJLG1CQUFtQjtBQUV2QixJQUFJO0FBQUUsU0FBTyxhQUFhLE1BQU0sTUFBTSxJQUFJLFdBQVcsQ0FBQyxDQUFDO0FBQUEsU0FBWSxJQUFQO0FBQWEscUJBQW1CO0FBQUE7QUFNNUYsSUFBTSxXQUFXLElBQUksV0FBVyxHQUFHO0FBQ25DLFNBQVMsSUFBSSxFQUFHLElBQUksS0FBSyxLQUFLO0FBQzVCLFdBQVMsS0FBTSxLQUFLLE1BQU0sSUFBSSxLQUFLLE1BQU0sSUFBSSxLQUFLLE1BQU0sSUFBSSxLQUFLLE1BQU0sSUFBSSxLQUFLLE1BQU0sSUFBSTtBQUM1RjtBQUNBLFNBQVMsT0FBTyxTQUFTLE9BQU87QUFJaEMsSUFBSSxhQUFhLENBQUMsUUFBUTtBQUN4QixhQUFXLGdCQUFnQixjQUFjLFlBQVksVUFBVSxRQUFRO0FBQ3JFLFdBQU8sSUFBSSxZQUFZLEVBQUUsT0FBTyxHQUFHO0FBQUEsRUFDckM7QUFFQSxNQUFJLEtBQUssR0FBRyxJQUFJLE9BQU8sR0FBRyxVQUFVLElBQUksUUFBUSxVQUFVO0FBRzFELE9BQUssUUFBUSxFQUFHLFFBQVEsU0FBUyxTQUFTO0FBQ3hDLFFBQUksSUFBSSxXQUFXLEtBQUs7QUFDeEIsU0FBSyxJQUFJLFdBQVksU0FBVyxRQUFRLElBQUksU0FBVTtBQUNwRCxXQUFLLElBQUksV0FBVyxRQUFRLENBQUM7QUFDN0IsV0FBSyxLQUFLLFdBQVksT0FBUTtBQUM1QixZQUFJLFNBQVksSUFBSSxTQUFXLE9BQU8sS0FBSztBQUMzQztBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQ0EsZUFBVyxJQUFJLE1BQU8sSUFBSSxJQUFJLE9BQVEsSUFBSSxJQUFJLFFBQVUsSUFBSTtBQUFBLEVBQzlEO0FBR0EsUUFBTSxJQUFJLFdBQVcsT0FBTztBQUc1QixPQUFLLElBQUksR0FBRyxRQUFRLEVBQUcsSUFBSSxTQUFTLFNBQVM7QUFDM0MsUUFBSSxJQUFJLFdBQVcsS0FBSztBQUN4QixTQUFLLElBQUksV0FBWSxTQUFXLFFBQVEsSUFBSSxTQUFVO0FBQ3BELFdBQUssSUFBSSxXQUFXLFFBQVEsQ0FBQztBQUM3QixXQUFLLEtBQUssV0FBWSxPQUFRO0FBQzVCLFlBQUksU0FBWSxJQUFJLFNBQVcsT0FBTyxLQUFLO0FBQzNDO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFDQSxRQUFJLElBQUksS0FBTTtBQUVaLFVBQUksT0FBTztBQUFBLElBQ2IsV0FBVyxJQUFJLE1BQU87QUFFcEIsVUFBSSxPQUFPLE1BQVEsTUFBTTtBQUN6QixVQUFJLE9BQU8sTUFBUSxJQUFJO0FBQUEsSUFDekIsV0FBVyxJQUFJLE9BQVM7QUFFdEIsVUFBSSxPQUFPLE1BQVEsTUFBTTtBQUN6QixVQUFJLE9BQU8sTUFBUSxNQUFNLElBQUk7QUFDN0IsVUFBSSxPQUFPLE1BQVEsSUFBSTtBQUFBLElBQ3pCLE9BQU87QUFFTCxVQUFJLE9BQU8sTUFBUSxNQUFNO0FBQ3pCLFVBQUksT0FBTyxNQUFRLE1BQU0sS0FBSztBQUM5QixVQUFJLE9BQU8sTUFBUSxNQUFNLElBQUk7QUFDN0IsVUFBSSxPQUFPLE1BQVEsSUFBSTtBQUFBO0FBQUEsRUFFM0I7QUFFQSxTQUFPO0FBQUE7QUFJVCxJQUFNLGdCQUFnQixDQUFDLEtBQUssUUFBUTtBQUlsQyxNQUFJLE1BQU0sT0FBTztBQUNmLFFBQUksSUFBSSxZQUFZLGtCQUFrQjtBQUNwQyxhQUFPLE9BQU8sYUFBYSxNQUFNLE1BQU0sSUFBSSxXQUFXLE1BQU0sTUFBTSxJQUFJLFNBQVMsR0FBRyxHQUFHLENBQUM7QUFBQSxJQUN4RjtBQUFBLEVBQ0Y7QUFFQSxNQUFJLFNBQVM7QUFDYixXQUFTLElBQUksRUFBRyxJQUFJLEtBQUssS0FBSztBQUM1QixjQUFVLE9BQU8sYUFBYSxJQUFJLEVBQUU7QUFBQSxFQUN0QztBQUNBLFNBQU87QUFBQTtBQUtULElBQUksYUFBYSxDQUFDLEtBQUssUUFBUTtBQUM3QixRQUFNLE1BQU0sT0FBTyxJQUFJO0FBRXZCLGFBQVcsZ0JBQWdCLGNBQWMsWUFBWSxVQUFVLFFBQVE7QUFDckUsV0FBTyxJQUFJLFlBQVksRUFBRSxPQUFPLElBQUksU0FBUyxHQUFHLEdBQUcsQ0FBQztBQUFBLEVBQ3REO0FBRUEsTUFBSSxHQUFHO0FBS1AsUUFBTSxXQUFXLElBQUksTUFBTSxNQUFNLENBQUM7QUFFbEMsT0FBSyxNQUFNLEdBQUcsSUFBSSxFQUFHLElBQUksT0FBTTtBQUM3QixRQUFJLElBQUksSUFBSTtBQUVaLFFBQUksSUFBSSxLQUFNO0FBQUUsZUFBUyxTQUFTO0FBQUc7QUFBQSxJQUFVO0FBRS9DLFFBQUksUUFBUSxTQUFTO0FBRXJCLFFBQUksUUFBUSxHQUFHO0FBQUUsZUFBUyxTQUFTO0FBQVEsV0FBSyxRQUFRO0FBQUc7QUFBQSxJQUFVO0FBR3JFLFNBQUssVUFBVSxJQUFJLEtBQU8sVUFBVSxJQUFJLEtBQU87QUFFL0MsV0FBTyxRQUFRLEtBQUssSUFBSSxLQUFLO0FBQzNCLFVBQUssS0FBSyxJQUFNLElBQUksT0FBTztBQUMzQjtBQUFBLElBQ0Y7QUFHQSxRQUFJLFFBQVEsR0FBRztBQUFFLGVBQVMsU0FBUztBQUFRO0FBQUEsSUFBVTtBQUVyRCxRQUFJLElBQUksT0FBUztBQUNmLGVBQVMsU0FBUztBQUFBLElBQ3BCLE9BQU87QUFDTCxXQUFLO0FBQ0wsZUFBUyxTQUFTLFFBQVcsS0FBSyxLQUFNO0FBQ3hDLGVBQVMsU0FBUyxRQUFVLElBQUk7QUFBQTtBQUFBLEVBRXBDO0FBRUEsU0FBTyxjQUFjLFVBQVUsR0FBRztBQUFBO0FBVXBDLElBQUksYUFBYSxDQUFDLEtBQUssUUFBUTtBQUU3QixRQUFNLE9BQU8sSUFBSTtBQUNqQixNQUFJLE1BQU0sSUFBSSxRQUFRO0FBQUUsVUFBTSxJQUFJO0FBQUEsRUFBUTtBQUcxQyxNQUFJLE1BQU0sTUFBTTtBQUNoQixTQUFPLE9BQU8sTUFBTSxJQUFJLE9BQU8sU0FBVSxLQUFNO0FBQUU7QUFBQSxFQUFPO0FBSXhELE1BQUksTUFBTSxHQUFHO0FBQUUsV0FBTztBQUFBLEVBQUs7QUFJM0IsTUFBSSxRQUFRLEdBQUc7QUFBRSxXQUFPO0FBQUEsRUFBSztBQUU3QixTQUFRLE1BQU0sU0FBUyxJQUFJLFFBQVEsTUFBTyxNQUFNO0FBQUE7QUFHbEQsSUFBSSxVQUFVO0FBQUEsRUFDYjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQ0Q7QUE4Q0EsSUFBSSxVQUFVO0FBRWQsSUFBTSxhQUFhLE9BQU8sVUFBVTtBQUtwQztBQUFBLEVBQ0UsWUFBWTtBQUFBLEVBQWM7QUFBQSxFQUFjO0FBQUEsRUFBYyxVQUFVO0FBQUEsRUFDaEUsTUFBTTtBQUFBLEVBQVEsY0FBYztBQUFBLEVBQzVCO0FBQUEsRUFDQTtBQUFBLEVBQ0EsWUFBWTtBQUFBLElBQ1Y7QUFtTEosVUFBVSxVQUFVLGVBQWdCLENBQUMsTUFBTSxZQUFZO0FBQ3JELFFBQU0sT0FBTyxLQUFLO0FBQ2xCLFFBQU0sWUFBWSxLQUFLLFFBQVE7QUFDL0IsTUFBSSxRQUFRO0FBRVosTUFBSSxLQUFLLE9BQU87QUFBRSxXQUFPO0FBQUEsRUFBTztBQUVoQyxNQUFJLGlCQUFpQjtBQUFZLGtCQUFjO0FBQUE7QUFDMUMsa0JBQWMsZUFBZSxPQUFPLGFBQWE7QUFHdEQsYUFBVyxTQUFTLFVBQVU7QUFFNUIsU0FBSyxRQUFRLFFBQVEsV0FBVyxJQUFJO0FBQUEsRUFDdEMsV0FBVyxXQUFXLEtBQUssSUFBSSxNQUFNLHdCQUF3QjtBQUMzRCxTQUFLLFFBQVEsSUFBSSxXQUFXLElBQUk7QUFBQSxFQUNsQyxPQUFPO0FBQ0wsU0FBSyxRQUFRO0FBQUE7QUFHZixPQUFLLFVBQVU7QUFDZixPQUFLLFdBQVcsS0FBSyxNQUFNO0FBRTNCLFlBQVM7QUFDUCxRQUFJLEtBQUssY0FBYyxHQUFHO0FBQ3hCLFdBQUssU0FBUyxJQUFJLFdBQVcsU0FBUztBQUN0QyxXQUFLLFdBQVc7QUFDaEIsV0FBSyxZQUFZO0FBQUEsSUFDbkI7QUFHQSxTQUFLLGdCQUFnQixnQkFBZ0IsZ0JBQWdCLGlCQUFpQixLQUFLLGFBQWEsR0FBRztBQUN6RixXQUFLLE9BQU8sS0FBSyxPQUFPLFNBQVMsR0FBRyxLQUFLLFFBQVEsQ0FBQztBQUNsRCxXQUFLLFlBQVk7QUFDakI7QUFBQSxJQUNGO0FBRUEsYUFBUyxZQUFZLFFBQVEsTUFBTSxXQUFXO0FBRzlDLFFBQUksV0FBVyxnQkFBZ0I7QUFDN0IsVUFBSSxLQUFLLFdBQVcsR0FBRztBQUNyQixhQUFLLE9BQU8sS0FBSyxPQUFPLFNBQVMsR0FBRyxLQUFLLFFBQVEsQ0FBQztBQUFBLE1BQ3BEO0FBQ0EsZUFBUyxZQUFZLFdBQVcsS0FBSyxJQUFJO0FBQ3pDLFdBQUssTUFBTSxNQUFNO0FBQ2pCLFdBQUssUUFBUTtBQUNiLGFBQU8sV0FBVztBQUFBLElBQ3BCO0FBR0EsUUFBSSxLQUFLLGNBQWMsR0FBRztBQUN4QixXQUFLLE9BQU8sS0FBSyxNQUFNO0FBQ3ZCO0FBQUEsSUFDRjtBQUdBLFFBQUksY0FBYyxLQUFLLEtBQUssV0FBVyxHQUFHO0FBQ3hDLFdBQUssT0FBTyxLQUFLLE9BQU8sU0FBUyxHQUFHLEtBQUssUUFBUSxDQUFDO0FBQ2xELFdBQUssWUFBWTtBQUNqQjtBQUFBLElBQ0Y7QUFFQSxRQUFJLEtBQUssYUFBYTtBQUFHO0FBQUEsRUFDM0I7QUFFQSxTQUFPO0FBQUE7QUFXVCxVQUFVLFVBQVUsaUJBQWtCLENBQUMsT0FBTztBQUM1QyxPQUFLLE9BQU8sS0FBSyxLQUFLO0FBQUE7QUFheEIsVUFBVSxVQUFVLGdCQUFpQixDQUFDLFFBQVE7QUFFNUMsTUFBSSxXQUFXLFFBQVE7QUFDckIsU0FBSyxTQUFTLE9BQU8sY0FBYyxLQUFLLE1BQU07QUFBQSxFQUNoRDtBQUNBLE9BQUssU0FBUyxDQUFDO0FBQ2YsT0FBSyxNQUFNO0FBQ1gsT0FBSyxNQUFNLEtBQUssS0FBSztBQUFBO0FBOEV2QixJQUFJLGNBQWM7QUFDbEIsSUFBSSxZQUFZO0FBQ2hCLElBQUksaUJBQWlCO0FBQ3JCLElBQUksV0FBVztBQUNmLElBQUksY0FBYztBQUVsQixJQUFJLGNBQWM7QUFBQSxFQUNqQixTQUFTO0FBQUEsRUFDVCxTQUFTO0FBQUEsRUFDVCxZQUFZO0FBQUEsRUFDWixNQUFNO0FBQUEsRUFDTixXQUFXO0FBQ1o7QUFzQkEsSUFBTSxRQUFRO0FBQ2QsSUFBTSxTQUFTO0FBcUNmLElBQUksbUJBQW1CLFlBQVksQ0FBQyxNQUFNLE9BQU87QUFDL0MsTUFBSTtBQUNKLE1BQUk7QUFDSixNQUFJO0FBQ0osTUFBSTtBQUNKLE1BQUk7QUFFSixNQUFJO0FBRUosTUFBSTtBQUNKLE1BQUk7QUFDSixNQUFJO0FBRUosTUFBSTtBQUNKLE1BQUk7QUFDSixNQUFJO0FBQ0osTUFBSTtBQUNKLE1BQUk7QUFDSixNQUFJO0FBQ0osTUFBSTtBQUNKLE1BQUk7QUFDSixNQUFJO0FBRUosTUFBSTtBQUNKLE1BQUk7QUFDSixNQUFJO0FBQ0osTUFBSTtBQUdKLE1BQUksT0FBTztBQUdYLFFBQU0sUUFBUSxLQUFLO0FBRW5CLFFBQU0sS0FBSztBQUNYLFVBQVEsS0FBSztBQUNiLFNBQU8sT0FBTyxLQUFLLFdBQVc7QUFDOUIsU0FBTyxLQUFLO0FBQ1osV0FBUyxLQUFLO0FBQ2QsUUFBTSxRQUFRLFFBQVEsS0FBSztBQUMzQixRQUFNLFFBQVEsS0FBSyxZQUFZO0FBRS9CLFNBQU8sTUFBTTtBQUViLFVBQVEsTUFBTTtBQUNkLFVBQVEsTUFBTTtBQUNkLFVBQVEsTUFBTTtBQUNkLGFBQVcsTUFBTTtBQUNqQixTQUFPLE1BQU07QUFDYixTQUFPLE1BQU07QUFDYixVQUFRLE1BQU07QUFDZCxVQUFRLE1BQU07QUFDZCxXQUFTLEtBQUssTUFBTSxXQUFXO0FBQy9CLFdBQVMsS0FBSyxNQUFNLFlBQVk7QUFNaEM7QUFDQSxPQUFHO0FBQ0QsVUFBSSxPQUFPLElBQUk7QUFDYixnQkFBUSxNQUFNLFVBQVU7QUFDeEIsZ0JBQVE7QUFDUixnQkFBUSxNQUFNLFVBQVU7QUFDeEIsZ0JBQVE7QUFBQSxNQUNWO0FBRUEsYUFBTyxNQUFNLE9BQU87QUFFcEI7QUFDQSxrQkFBUztBQUNQLGVBQUssU0FBUztBQUNkLG9CQUFVO0FBQ1Ysa0JBQVE7QUFDUixlQUFNLFNBQVMsS0FBTTtBQUNyQixjQUFJLE9BQU8sR0FBRztBQUlaLG1CQUFPLFVBQVUsT0FBTztBQUFBLFVBQzFCLFdBQ1MsS0FBSyxJQUFJO0FBQ2hCLGtCQUFNLE9BQU87QUFDYixrQkFBTTtBQUNOLGdCQUFJLElBQUk7QUFDTixrQkFBSSxPQUFPLElBQUk7QUFDYix3QkFBUSxNQUFNLFVBQVU7QUFDeEIsd0JBQVE7QUFBQSxjQUNWO0FBQ0EscUJBQU8sUUFBUyxLQUFLLE1BQU07QUFDM0Isd0JBQVU7QUFDVixzQkFBUTtBQUFBLFlBQ1Y7QUFFQSxnQkFBSSxPQUFPLElBQUk7QUFDYixzQkFBUSxNQUFNLFVBQVU7QUFDeEIsc0JBQVE7QUFDUixzQkFBUSxNQUFNLFVBQVU7QUFDeEIsc0JBQVE7QUFBQSxZQUNWO0FBQ0EsbUJBQU8sTUFBTSxPQUFPO0FBRXBCO0FBQ0Esd0JBQVM7QUFDUCxxQkFBSyxTQUFTO0FBQ2QsMEJBQVU7QUFDVix3QkFBUTtBQUNSLHFCQUFNLFNBQVMsS0FBTTtBQUVyQixvQkFBSSxLQUFLLElBQUk7QUFDWCx5QkFBTyxPQUFPO0FBQ2Qsd0JBQU07QUFDTixzQkFBSSxPQUFPLElBQUk7QUFDYiw0QkFBUSxNQUFNLFVBQVU7QUFDeEIsNEJBQVE7QUFDUix3QkFBSSxPQUFPLElBQUk7QUFDYiw4QkFBUSxNQUFNLFVBQVU7QUFDeEIsOEJBQVE7QUFBQSxvQkFDVjtBQUFBLGtCQUNGO0FBQ0EsMEJBQVEsUUFBUyxLQUFLLE1BQU07QUFFNUIsc0JBQUksT0FBTyxNQUFNO0FBQ2YseUJBQUssTUFBTTtBQUNYLDBCQUFNLE9BQU87QUFDYjtBQUFBLGtCQUNGO0FBRUEsNEJBQVU7QUFDViwwQkFBUTtBQUVSLHVCQUFLLE9BQU87QUFDWixzQkFBSSxPQUFPLElBQUk7QUFDYix5QkFBSyxPQUFPO0FBQ1osd0JBQUksS0FBSyxPQUFPO0FBQ2QsMEJBQUksTUFBTSxNQUFNO0FBQ2QsNkJBQUssTUFBTTtBQUNYLDhCQUFNLE9BQU87QUFDYjtBQUFBLHNCQUNGO0FBQUEsb0JBdUJGO0FBQ0EsMkJBQU87QUFDUCxrQ0FBYztBQUNkLHdCQUFJLFVBQVUsR0FBRztBQUNmLDhCQUFRLFFBQVE7QUFDaEIsMEJBQUksS0FBSyxLQUFLO0FBQ1osK0JBQU87QUFDUCwyQkFBRztBQUNELGlDQUFPLFVBQVUsU0FBUztBQUFBLHdCQUM1QixXQUFXO0FBQ1gsK0JBQU8sT0FBTztBQUNkLHNDQUFjO0FBQUEsc0JBQ2hCO0FBQUEsb0JBQ0YsV0FDUyxRQUFRLElBQUk7QUFDbkIsOEJBQVEsUUFBUSxRQUFRO0FBQ3hCLDRCQUFNO0FBQ04sMEJBQUksS0FBSyxLQUFLO0FBQ1osK0JBQU87QUFDUCwyQkFBRztBQUNELGlDQUFPLFVBQVUsU0FBUztBQUFBLHdCQUM1QixXQUFXO0FBQ1gsK0JBQU87QUFDUCw0QkFBSSxRQUFRLEtBQUs7QUFDZiwrQkFBSztBQUNMLGlDQUFPO0FBQ1AsNkJBQUc7QUFDRCxtQ0FBTyxVQUFVLFNBQVM7QUFBQSwwQkFDNUIsV0FBVztBQUNYLGlDQUFPLE9BQU87QUFDZCx3Q0FBYztBQUFBLHdCQUNoQjtBQUFBLHNCQUNGO0FBQUEsb0JBQ0YsT0FDSztBQUNILDhCQUFRLFFBQVE7QUFDaEIsMEJBQUksS0FBSyxLQUFLO0FBQ1osK0JBQU87QUFDUCwyQkFBRztBQUNELGlDQUFPLFVBQVUsU0FBUztBQUFBLHdCQUM1QixXQUFXO0FBQ1gsK0JBQU8sT0FBTztBQUNkLHNDQUFjO0FBQUEsc0JBQ2hCO0FBQUE7QUFFRiwyQkFBTyxNQUFNLEdBQUc7QUFDZCw2QkFBTyxVQUFVLFlBQVk7QUFDN0IsNkJBQU8sVUFBVSxZQUFZO0FBQzdCLDZCQUFPLFVBQVUsWUFBWTtBQUM3Qiw2QkFBTztBQUFBLG9CQUNUO0FBQ0Esd0JBQUksS0FBSztBQUNQLDZCQUFPLFVBQVUsWUFBWTtBQUM3QiwwQkFBSSxNQUFNLEdBQUc7QUFDWCwrQkFBTyxVQUFVLFlBQVk7QUFBQSxzQkFDL0I7QUFBQSxvQkFDRjtBQUFBLGtCQUNGLE9BQ0s7QUFDSCwyQkFBTyxPQUFPO0FBQ2QsdUJBQUc7QUFDRCw2QkFBTyxVQUFVLE9BQU87QUFDeEIsNkJBQU8sVUFBVSxPQUFPO0FBQ3hCLDZCQUFPLFVBQVUsT0FBTztBQUN4Qiw2QkFBTztBQUFBLG9CQUNULFNBQVMsTUFBTTtBQUNmLHdCQUFJLEtBQUs7QUFDUCw2QkFBTyxVQUFVLE9BQU87QUFDeEIsMEJBQUksTUFBTSxHQUFHO0FBQ1gsK0JBQU8sVUFBVSxPQUFPO0FBQUEsc0JBQzFCO0FBQUEsb0JBQ0Y7QUFBQTtBQUFBLGdCQUVKLFlBQ1UsS0FBSyxRQUFRLEdBQUc7QUFDeEIseUJBQU8sTUFBTyxRQUFPLFVBQXVCLFFBQVMsS0FBSyxNQUFNO0FBQ2hFO0FBQUEsZ0JBQ0YsT0FDSztBQUNILHVCQUFLLE1BQU07QUFDWCx3QkFBTSxPQUFPO0FBQ2I7QUFBQTtBQUdGO0FBQUEsY0FDRjtBQUFBLFVBQ0YsWUFDVSxLQUFLLFFBQVEsR0FBRztBQUN4QixtQkFBTyxNQUFPLFFBQU8sVUFBdUIsUUFBUyxLQUFLLE1BQU07QUFDaEU7QUFBQSxVQUNGLFdBQ1MsS0FBSyxJQUFJO0FBRWhCLGtCQUFNLE9BQU87QUFDYjtBQUFBLFVBQ0YsT0FDSztBQUNILGlCQUFLLE1BQU07QUFDWCxrQkFBTSxPQUFPO0FBQ2I7QUFBQTtBQUdGO0FBQUEsUUFDRjtBQUFBLElBQ0YsU0FBUyxNQUFNLFFBQVEsT0FBTztBQUc5QixRQUFNLFFBQVE7QUFDZCxTQUFPO0FBQ1AsVUFBUSxPQUFPO0FBQ2YsV0FBUyxLQUFLLFFBQVE7QUFHdEIsT0FBSyxVQUFVO0FBQ2YsT0FBSyxXQUFXO0FBQ2hCLE9BQUssV0FBWSxNQUFNLE9BQU8sS0FBSyxPQUFPLE9BQU8sS0FBSyxNQUFNO0FBQzVELE9BQUssWUFBYSxPQUFPLE1BQU0sT0FBTyxNQUFNLFFBQVEsT0FBTyxPQUFPO0FBQ2xFLFFBQU0sT0FBTztBQUNiLFFBQU0sT0FBTztBQUNiO0FBQUE7QUFzQkYsSUFBTSxVQUFVO0FBQ2hCLElBQU0sZ0JBQWdCO0FBQ3RCLElBQU0saUJBQWlCO0FBR3ZCLElBQU0sVUFBVTtBQUNoQixJQUFNLFNBQVM7QUFDZixJQUFNLFVBQVU7QUFFaEIsSUFBTSxRQUFRLElBQUksWUFBWTtBQUFBLEVBQzVCO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFJO0FBQUEsRUFBSTtBQUFBLEVBQUk7QUFBQSxFQUFJO0FBQUEsRUFBSTtBQUFBLEVBQUk7QUFBQSxFQUFJO0FBQUEsRUFDckQ7QUFBQSxFQUFJO0FBQUEsRUFBSTtBQUFBLEVBQUk7QUFBQSxFQUFJO0FBQUEsRUFBSTtBQUFBLEVBQUk7QUFBQSxFQUFJO0FBQUEsRUFBSztBQUFBLEVBQUs7QUFBQSxFQUFLO0FBQUEsRUFBSztBQUFBLEVBQUs7QUFBQSxFQUFLO0FBQUEsRUFBRztBQUMvRCxDQUFDO0FBRUQsSUFBTSxPQUFPLElBQUksV0FBVztBQUFBLEVBQzFCO0FBQUEsRUFBSTtBQUFBLEVBQUk7QUFBQSxFQUFJO0FBQUEsRUFBSTtBQUFBLEVBQUk7QUFBQSxFQUFJO0FBQUEsRUFBSTtBQUFBLEVBQUk7QUFBQSxFQUFJO0FBQUEsRUFBSTtBQUFBLEVBQUk7QUFBQSxFQUFJO0FBQUEsRUFBSTtBQUFBLEVBQUk7QUFBQSxFQUFJO0FBQUEsRUFDNUQ7QUFBQSxFQUFJO0FBQUEsRUFBSTtBQUFBLEVBQUk7QUFBQSxFQUFJO0FBQUEsRUFBSTtBQUFBLEVBQUk7QUFBQSxFQUFJO0FBQUEsRUFBSTtBQUFBLEVBQUk7QUFBQSxFQUFJO0FBQUEsRUFBSTtBQUFBLEVBQUk7QUFBQSxFQUFJO0FBQUEsRUFBSTtBQUMxRCxDQUFDO0FBRUQsSUFBTSxRQUFRLElBQUksWUFBWTtBQUFBLEVBQzVCO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxF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QSxNQUN0RDtBQUFBLGFBQ08sT0FBUDtBQUNBLG1CQUFhLEtBQUs7QUFBQTtBQUFBLEdBRXJCO0FBQ0g7QUFDQSxJQUFJLHFCQUFxQixtQkFBbUI7QUFDMUMsWUFBVSxXQUFXO0FBQ3JCLFlBQVUsaUJBQWlCLFNBQVMsWUFBWTtBQUM5QyxVQUFNLFFBQVEsTUFBTSxTQUFTLGFBQWE7QUFDMUMsVUFBTSxPQUFPLGVBQWU7QUFDNUIsUUFBSSxPQUFPO0FBQ1QsWUFBTSxhQUFhLFNBQVMsY0FBYyxhQUFhO0FBQ3ZELFlBQU0sT0FBTyxzQkFBc0IsbUJBQW1CLE9BQU8sU0FBUyxXQUFXLFNBQVMsTUFBTSxJQUFJO0FBQ3BHLFlBQU0saUJBQWlCLE1BQU0sU0FBUyxPQUFPLElBQUk7QUFDakQsWUFBTSxrQkFBa0IsY0FBYztBQUN0Qyx1QkFBaUIsQ0FBQyxzQkFBc0IsU0FBUyxJQUFJLFNBQVMsWUFBWSxDQUFDO0FBQUEsSUFDN0U7QUFBQSxHQUNEO0FBQ0g7IiwKICAiZGVidWdJZCI6ICI4M0QzNzFDQUY3Mjc5RUY1NjQ3NTZFMjE2NDc1NkUyMSIsCiAgIm5hbWVzIjogW10KfQ==
