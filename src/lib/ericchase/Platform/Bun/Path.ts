import node_path from 'node:path';

export class PathGroup {
  constructor(
    public readonly basedir: string,
    public readonly dir: string,
    public readonly name: string,
    public readonly ext: string,
  ) {}
  static new(basedir: string, path: string) {
    const { dir, name, ext } = node_path.parse(node_path.normalize(path));
    return new PathGroup(basedir, dir, name, ext);
  }
  get path() {
    return node_path.normalize(node_path.join(this.basedir, this.dir, this.name + this.ext));
  }
  replaceBasedir(new_basedir: string) {
    return new PathGroup(node_path.normalize(new_basedir), this.dir, this.name, this.ext);
  }
  replaceDir(new_dir: string) {
    return new PathGroup(this.basedir, node_path.normalize(new_dir), this.name, this.ext);
  }
  replaceName(new_name: string) {
    return new PathGroup(this.basedir, this.dir, node_path.normalize(new_name), this.ext);
  }
  replaceExt(new_ext: string) {
    return new PathGroup(this.basedir, this.dir, this.name, node_path.normalize(new_ext));
  }
}

export class GlobGroup {
  constructor(
    public readonly basedir: string,
    public readonly pattern: string,
    public readonly pathGroupSet: Set<PathGroup>,
  ) {}
  static new({ basedir, pattern, dot = false }: { basedir: string; pattern: string; dot?: boolean }) {
    basedir = node_path.normalize(basedir);
    const pathGroupSet = new Set<PathGroup>();
    for (const path of new Bun.Glob(pattern).scanSync({ cwd: basedir, dot })) {
      pathGroupSet.add(PathGroup.new(basedir, path));
    }
    return new GlobGroup(basedir, pattern, pathGroupSet);
  }
  get pathGroups() {
    return this.pathGroup_iterator();
  }
  get paths() {
    return this.path_iterator();
  }
  replaceBasedir(new_base: string) {
    new_base = node_path.normalize(new_base);
    const new_pathGroupSet = new Set<PathGroup>();
    for (const pathGroup of this.pathGroupSet) {
      new_pathGroupSet.add(pathGroup.replaceBasedir(new_base));
    }
    return new GlobGroup(new_base, this.pattern, new_pathGroupSet);
  }
  *pathGroup_iterator() {
    for (const pathGroup of this.pathGroupSet) {
      yield pathGroup;
    }
  }
  *path_iterator() {
    for (const pathGroup of this.pathGroupSet) {
      yield pathGroup.path;
    }
  }
}

export class GlobManager {
  static Scan(basedir: string, pattern: string, dot = false) {
    return GlobGroup.new({ basedir: node_path.normalize(basedir), pattern, dot });
  }
  globGroupMap = new Map<string, GlobGroup>();
  get globGroups() {
    return this.globGroupMap.values();
  }
  get pathGroups() {
    return this.pathGroup_iterator();
  }
  get paths() {
    return this.path_iterator();
  }
  getGlobGroup(basedir: string, pattern: string) {
    this.globGroupMap.get(`${basedir}|${pattern}`);
  }
  update(globManager: GlobManager) {
    for (const [key, globGroup] of globManager.globGroupMap) {
      this.globGroupMap.set(key, globGroup);
    }
    return this;
  }
  scan(basedir: string, ...patterns: string[]) {
    for (const pattern of patterns) {
      const globGroup = GlobManager.Scan(basedir, pattern);
      this.globGroupMap.set(`${globGroup.basedir}|${globGroup.pattern}`, globGroup);
    }
    return this;
  }
  scanDot(basedir: string, ...patterns: string[]) {
    for (const pattern of patterns) {
      const globGroup = GlobManager.Scan(basedir, pattern, true);
      this.globGroupMap.set(`${globGroup.basedir}|${globGroup.pattern}`, globGroup);
    }
    return this;
  }
  *pathGroup_iterator() {
    for (const globGroup of this.globGroups) {
      for (const pathGroup of globGroup.pathGroups) {
        yield pathGroup;
      }
    }
  }
  *path_iterator() {
    for (const globGroup of this.globGroups) {
      for (const pathGroup of globGroup.pathGroups) {
        yield pathGroup.path;
      }
    }
  }
}
