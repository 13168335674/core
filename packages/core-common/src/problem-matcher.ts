import { Injectable, Autowired } from '@ali/common-di';
import { IProblemPatternRegistry, ApplyToKind, FileLocationKind, Severity, ProblemPatternContribution, ProblemPattern, WatchingPattern } from './problem-pattern';
import { DisposableCollection, Disposable, IDisposable } from './disposable';
import { Emitter } from './event';
import { URI } from './uri';

export interface WatchingMatcherContribution {
  // If set to true the background monitor is in active mode when the task starts.
  // This is equals of issuing a line that matches the beginPattern
  activeOnStart?: boolean;
  beginsPattern: string | WatchingPattern;
  endsPattern: string | WatchingPattern;
}

export interface ProblemMatcherContribution {
  base?: string;
  name?: string;
  label: string;
  deprecated?: boolean;

  owner: string;
  source?: string;
  applyTo?: string;
  fileLocation?: 'absolute' | 'relative' | string[];
  pattern: string | ProblemPatternContribution | ProblemPatternContribution[];
  severity?: string;
  watching?: WatchingMatcherContribution; // deprecated. Use `background`.
  background?: WatchingMatcherContribution;
}


export interface WatchingMatcher {
  // If set to true the background monitor is in active mode when the task starts.
  // This is equals of issuing a line that matches the beginPattern
  activeOnStart: boolean;
  beginsPattern: WatchingPattern;
  endsPattern: WatchingPattern;
}

export namespace WatchingMatcher {
  export function fromWatchingMatcherContribution(value: WatchingMatcherContribution | undefined): WatchingMatcher | undefined {
    if (!value) {
      return undefined;
    }
    return {
      activeOnStart: !!value.activeOnStart,
      beginsPattern: typeof value.beginsPattern === 'string' ? { regexp: value.beginsPattern } : value.beginsPattern,
      endsPattern: typeof value.endsPattern === 'string' ? { regexp: value.endsPattern } : value.endsPattern
    };
  }
}


export interface ProblemMatcher {
  owner: string;
	source?: string;
	applyTo?: ApplyToKind | string;
	fileLocation: FileLocationKind | string[];
	filePrefix?: string;
	pattern: ProblemPattern | ProblemPattern[];
	severity?: Severity | string;
	watching?: WatchingMatcher;
	uriProvider?: (path: string) => URI;
}

export type ProblemMatcherType = string | ProblemMatcher | Array<string | ProblemMatcher>;

export interface NamedProblemMatcher extends ProblemMatcher {
  /**
  * This name can be used to refer to the
  * problem matcher from within a task.
  */
  name: string;

  /**
   * A human readable label.
   */
  label?: string;
  deprecated?: boolean;
}


export const IProblemMatcherRegistry = Symbol('IProblemMatcherRegistry');

export interface IProblemMatcherRegistry {
  register(matcher: ProblemMatcherContribution): IDisposable;
  get(name: string): NamedProblemMatcher | undefined;
  getAll(): NamedProblemMatcher[];
}

@Injectable()
export class ProblemMatchersRegistryImpl implements IProblemMatcherRegistry {

  @Autowired(IProblemPatternRegistry)
  problemPattern: IProblemPatternRegistry;

  protected readonly onDidChangeProblemMatcherEmitter = new Emitter<void>();

  private readonly matchers = new Map<string, NamedProblemMatcher>();

  constructor() {
    this.init();
  }

  private init() {
    this.fillDefaults();
  }

  /**
   * Finds the problem matcher from the registry by its name.
   *
   * @param name the name of the problem matcher
   * @return the problem matcher. If the task definition is not found, `undefined` is returned.
   */
  get = (name: string): NamedProblemMatcher | undefined => {
    if (name.startsWith('$')) {
      return this.matchers.get(name.slice(1));
    }
    return this.matchers.get(name);
  }

  /**
   * Returns all registered problem matchers in the registry.
   */
  getAll(): NamedProblemMatcher[] {
    const all: NamedProblemMatcher[] = [];
    for (const matcherName of this.matchers.keys()) {
      all.push(this.get(matcherName)!);
    }
    all.sort((one, other) => one.name.localeCompare(other.name));
    return all;
  }


  /**
   * Add a problem matcher to the registry.
   *
   * @param definition the problem matcher to be added.
   */
  register(matcher: ProblemMatcherContribution): IDisposable {
    if (!matcher.name) {
      console.error('Only named Problem Matchers can be registered.');
      return Disposable.NULL;
    }
    const toDispose = new DisposableCollection(Disposable.create(() => {
      /* mark as not disposed */
      this.onDidChangeProblemMatcherEmitter.fire(undefined);
    }));
    this.doRegister(matcher, toDispose).then(() => this.onDidChangeProblemMatcherEmitter.fire(undefined));
    return toDispose;
  }

  protected async doRegister(matcher: ProblemMatcherContribution, toDispose: DisposableCollection): Promise<void> {
    const problemMatcher = await this.getProblemMatcherFromContribution(matcher);
    if (toDispose.disposed) {
      return;
    }
    toDispose.push(this.add(problemMatcher as NamedProblemMatcher));
  }


  private add(matcher: NamedProblemMatcher): IDisposable {
    this.matchers.set(matcher.name, matcher);
    return Disposable.create(() => this.matchers.delete(matcher.name));
  }

  /**
 * Transforms the `ProblemMatcherContribution` to a `ProblemMatcher`
 *
 * @return the problem matcher
 */
  async getProblemMatcherFromContribution(matcher: ProblemMatcherContribution): Promise<ProblemMatcher> {
    let baseMatcher: NamedProblemMatcher | undefined;
    if (matcher.base) {
      baseMatcher = this.get(matcher.base);
    }

    let fileLocation: FileLocationKind | undefined;
    let filePrefix: string | undefined;
    if (matcher.fileLocation === undefined) {
      fileLocation = baseMatcher ? baseMatcher.fileLocation as FileLocationKind : FileLocationKind.Relative;
      filePrefix = baseMatcher ? baseMatcher.filePrefix : '${workspaceFolder}';
    } else {
      const locationAndPrefix = this.getFileLocationKindAndPrefix(matcher);
      fileLocation = locationAndPrefix.fileLocation;
      filePrefix = locationAndPrefix.filePrefix;
    }

    const patterns: ProblemPattern[] = [];
    if (matcher.pattern) {
      console.log('matcher.pattern', matcher.pattern);
      if (typeof matcher.pattern === 'string') {
        await this.problemPattern.onReady();
        const registeredPattern = this.problemPattern.get(matcher.pattern);
        if (Array.isArray(registeredPattern)) {
          patterns.push(...registeredPattern);
        } else if (!!registeredPattern) {
          patterns.push(registeredPattern);
        }
      } else if (Array.isArray(matcher.pattern)) {
        patterns.push(...matcher.pattern.map(p => ProblemPattern.fromProblemPatternContribution(p)));
      } else {
        patterns.push(ProblemPattern.fromProblemPatternContribution(matcher.pattern));
      }
    } else if (baseMatcher) {
      patterns.push(...baseMatcher.pattern as ProblemPattern[]);
    }

    let deprecated: boolean | undefined = matcher.deprecated;
    if (deprecated === undefined && baseMatcher) {
      deprecated = baseMatcher.deprecated;
    }

    let applyTo: ApplyToKind | undefined;
    if (matcher.applyTo === undefined) {
      applyTo = baseMatcher ? baseMatcher.applyTo as ApplyToKind : ApplyToKind.allDocuments as ApplyToKind;
    } else {
      applyTo = ApplyToKind.fromString(matcher.applyTo) || ApplyToKind.allDocuments;
    }

    let severity: Severity = Severity.fromValue(matcher.severity);
    if (matcher.severity === undefined && baseMatcher && baseMatcher.severity !== undefined) {
      severity = baseMatcher.severity as Severity;
    }
    let watching: WatchingMatcher | undefined = WatchingMatcher.fromWatchingMatcherContribution(matcher.background || matcher.watching);
    if (watching === undefined && baseMatcher) {
      watching = baseMatcher.watching;
    }
    const problemMatcher = {
      name: matcher.name || (baseMatcher ? baseMatcher.name : undefined),
      label: matcher.label || (baseMatcher ? baseMatcher.label : undefined),
      deprecated,
      owner: matcher.owner || (baseMatcher ? baseMatcher.owner : ''),
      source: matcher.source || (baseMatcher ? baseMatcher.source : undefined),
      applyTo,
      fileLocation,
      filePrefix,
      pattern: patterns,
      severity,
      watching
    };
    console.log('transformed problemMatcher', problemMatcher);
    return problemMatcher;
  }

  private getFileLocationKindAndPrefix(matcher: ProblemMatcherContribution): { fileLocation: FileLocationKind, filePrefix: string } {
    let fileLocation = FileLocationKind.Relative;
    let filePrefix = '${workspaceFolder}';
    if (matcher.fileLocation !== undefined) {
      if (Array.isArray(matcher.fileLocation)) {
        if (matcher.fileLocation.length > 0) {
          const locationKind = FileLocationKind.fromString(matcher.fileLocation[0]);
          if (matcher.fileLocation.length === 1 && locationKind === FileLocationKind.Absolute) {
            fileLocation = locationKind;
          } else if (matcher.fileLocation.length === 2 && locationKind === FileLocationKind.Relative && matcher.fileLocation[1]) {
            fileLocation = locationKind;
            filePrefix = matcher.fileLocation[1];
          }
        }
      } else {
        const locationKind = FileLocationKind.fromString(matcher.fileLocation);
        if (locationKind) {
          fileLocation = locationKind;
          if (locationKind === FileLocationKind.Relative) {
            filePrefix = '${workspaceFolder}';
          }
        }
      }
    }
    return { fileLocation, filePrefix };
  }


  // copied from https://github.com/Microsoft/vscode/blob/1.33.1/src/vs/workbench/contrib/tasks/common/problemMatcher.ts
  private fillDefaults(): void {
    this.add({
      name: 'msCompile',
      label: 'Microsoft compiler problems',
      owner: 'msCompile',
      applyTo: ApplyToKind.allDocuments,
      fileLocation: FileLocationKind.Absolute,
      pattern: (this.problemPattern.get('msCompile'))!,
    });

    this.add({
      name: 'lessCompile',
      label: 'Less problems',
      deprecated: true,
      owner: 'lessCompile',
      source: 'less',
      applyTo: ApplyToKind.allDocuments,
      fileLocation: FileLocationKind.Absolute,
      pattern: (this.problemPattern.get('lessCompile'))!,
      severity: Severity.Error,
    });

    this.add({
      name: 'gulp-tsc',
      label: 'Gulp TSC Problems',
      owner: 'typescript',
      source: 'ts',
      applyTo: ApplyToKind.closedDocuments,
      fileLocation: FileLocationKind.Relative,
      filePrefix: '${workspaceFolder}',
      pattern: (this.problemPattern.get('gulp-tsc'))!,
    });

    this.add({
      name: 'jshint',
      label: 'JSHint problems',
      owner: 'jshint',
      source: 'jshint',
      applyTo: ApplyToKind.allDocuments,
      fileLocation: FileLocationKind.Absolute,
      pattern: (this.problemPattern.get('jshint'))!,
    });

    this.add({
      name: 'jshint-stylish',
      label: 'JSHint stylish problems',
      owner: 'jshint',
      source: 'jshint',
      applyTo: ApplyToKind.allDocuments,
      fileLocation: FileLocationKind.Absolute,
      pattern: (this.problemPattern.get('jshint-stylish'))!,
    });

    this.add({
      name: 'eslint-compact',
      label: 'ESLint compact problems',
      owner: 'eslint',
      source: 'eslint',
      applyTo: ApplyToKind.allDocuments,
      fileLocation: FileLocationKind.Absolute,
      filePrefix: '${workspaceFolder}',
      pattern: (this.problemPattern.get('eslint-compact'))!,
    });

    this.add({
      name: 'eslint-stylish',
      label: 'ESLint stylish problems',
      owner: 'eslint',
      source: 'eslint',
      applyTo: ApplyToKind.allDocuments,
      fileLocation: FileLocationKind.Absolute,
      pattern: (this.problemPattern.get('eslint-stylish'))!,
    });

    this.add({
      name: 'go',
      label: 'Go problems',
      owner: 'go',
      source: 'go',
      applyTo: ApplyToKind.allDocuments,
      fileLocation: FileLocationKind.Relative,
      filePrefix: '${workspaceFolder}',
      pattern: (this.problemPattern.get('go'))!,
    });
  }
}