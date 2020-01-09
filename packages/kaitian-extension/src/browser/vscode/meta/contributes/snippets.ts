// import { VscodeContributionPoint, Contributes } from './common';
import { VSCodeContributePoint, Contributes } from '../../../../common';
import { Injectable, Autowired } from '@ali/common-di';
import { MonacoSnippetSuggestProvider } from '@ali/ide-monaco/lib/browser/monaco-snippet-suggest-provider';

export interface SnippetContribution {
  path: string;
  source: string;
  language?: string;
}
export type SnippetSchema = Array<SnippetContribution>;

@Injectable()
@Contributes('snippets')
export class SnippetsContributionPoint extends VSCodeContributePoint<SnippetSchema> {
  @Autowired(MonacoSnippetSuggestProvider)
  protected readonly snippetSuggestProvider: MonacoSnippetSuggestProvider;

  private registed: Map<string, boolean> = new Map();

  contribute() {
    // TODO 把languageId和provider的映射关系挪到这里来管理？
    for (const snippet of this.json) {
      this.snippetSuggestProvider.fromPath(snippet.path, {
        extPath: this.extension.path,
        language: snippet.language,
        source: this.extension.packageJSON.name,
      });
      // FIXME 装了多个snippet插件的情况下，会注册多个provider，在vscode内有一个经过优化的setSnippetSuggestSupport方法
      if (snippet.language && !this.registed.get(snippet.language)) {
        this.registed.set(snippet.language, true);
        monaco.languages.registerCompletionItemProvider(snippet.language, this.snippetSuggestProvider);
      }
    }
  }
}
