import * as path from 'path';
import { Injector, Injectable } from '@ali/common-di';
import { ILoggerManagerClient, Uri } from '@ali/ide-core-common';
import { createBrowserInjector } from '@ali/ide-dev-tool/src/injector-helper';
import { LoggerManagerClient } from '@ali/ide-logs/src/browser/log-manage';
import { IWorkspaceService } from '@ali/ide-workspace';
import { EditorDocumentModelServiceImpl } from '@ali/ide-editor/lib/browser/doc-model/main';
import { IEditorDocumentModelService } from '@ali/ide-editor/lib/browser';
import { IMainLayoutService } from '@ali/ide-main-layout/lib/common';

import { ContentSearchClientService } from '../../src/browser/search.service';
import {
  IContentSearchClientService,
  ContentSearchServerPath,
  ContentSearchOptions,
  SendClientResult,
  SEARCH_STATE,
  ContentSearchResult,
  IUIState,
} from '../../src/common';
import { SearchModule } from '../../src/browser/';
import { SearchPreferences } from '../../src/browser/search-preferences';
import { CorePreferences } from '@ali/ide-core-browser';

const rootUri = Uri.file(path.resolve(__dirname, '../test-resources/')).toString();

@Injectable()
class MockWorkspaceService {
  tryGetRoots() {
    return [{
      uri: rootUri,
    }];
  }

  setMostRecentlySearchWord() {

  }
}

@Injectable()
class MockMainLayoutService {
  getTabbarHandler() { }
}

@Injectable()
class MockSearchContentService {
  catchSearchValue: string;
  catchSearchRootDirs: string[];
  catchSearchOptions: ContentSearchOptions;

  async search(value, rootDirs, searchOptions) {
    this.catchSearchValue = value;
    this.catchSearchRootDirs = rootDirs;
    this.catchSearchOptions = searchOptions;

    return 1;
  }

  cancel() { }
}

describe('search.service.ts', () => {
  let injector: Injector;
  let searchService: IContentSearchClientService;

  beforeAll(() => {
    injector = createBrowserInjector([
      SearchModule,
    ]);

    injector.addProviders({
      token: ContentSearchClientService,
      useClass: ContentSearchClientService,
    }, {
      token: ILoggerManagerClient,
      useClass: LoggerManagerClient,
    }, {
      token: IWorkspaceService,
      useClass: MockWorkspaceService,
    }, {
      token: ContentSearchServerPath,
      useClass: MockSearchContentService,
    }, {
      token: IEditorDocumentModelService,
      useClass: EditorDocumentModelServiceImpl,
    }, {
      token: IMainLayoutService,
      useClass: MockMainLayoutService,
    });

    injector.overrideProviders({
      token: SearchPreferences,
      useValue: {
        'search.exclude': {
          '**/bower_components': true,
        },
      },
    }, {
      token: CorePreferences,
      useValue: {
        'files.exclude': {
          '**/node_modules': true,
        },
      },
    });

    searchService = injector.get(ContentSearchClientService);
    // without docModel
    (searchService as any).workbenchEditorService = true;
    (searchService as any).searchAllFromDocModel = () => {
      return {
        result: null,
      };
    };
  });

  test('可以加载正常service', () => {
    expect(searchService.UIState).toBeDefined();
  });

  test('method:updateUIState', () => {
    searchService.updateUIState({ isMatchCase: true });
    expect(searchService.UIState.isMatchCase).toBe(true);
    expect(searchService.UIState.isUseRegexp).toBe(false);
  });

  test('method:search without docModel', () => {
    const service: any = searchService;
    searchService.searchValue = 'value';
    service.search();
    expect(service.contentSearchServer.catchSearchValue).toBe('value');
    expect(service.contentSearchServer.catchSearchRootDirs).toEqual([rootUri]);

    expect(service.contentSearchServer.catchSearchOptions.maxResults).toBe(2000);
    expect(service.contentSearchServer.catchSearchOptions.matchWholeWord).toBe(false);
    expect(service.contentSearchServer.catchSearchOptions.useRegExp).toBe(false);
    expect(service.contentSearchServer.catchSearchOptions.includeIgnored).toBe(false);
    expect(service.contentSearchServer.catchSearchOptions.include).toEqual([]);
    expect(service.contentSearchServer.catchSearchOptions.exclude).toEqual([
      '**/node_modules',
      '**/bower_components',
    ]);
  });

  test('method:search options', () => {
    const service: any = searchService;
    searchService.searchValue = 'value';
    (service.UIState as IUIState) = {
      isSearchFocus: false,
      isToggleOpen: true,
      isDetailOpen: false,

      // Search Options
      isMatchCase: false,
      isWholeWord: true,
      isUseRegexp: true,
      isIncludeIgnored: true,
    };
    service.includeValue = 'includeValue1, includeValue2';
    service.excludeValue = 'excludeValue';

    service.search();
    expect(service.contentSearchServer.catchSearchValue).toBe('value');
    expect(service.contentSearchServer.catchSearchRootDirs).toEqual([rootUri]);

    expect(service.contentSearchServer.catchSearchOptions.maxResults).toBe(2000);
    expect(service.contentSearchServer.catchSearchOptions.matchCase).toBe(false);
    expect(service.contentSearchServer.catchSearchOptions.matchWholeWord).toBe(true);
    expect(service.contentSearchServer.catchSearchOptions.useRegExp).toBe(true);
    expect(service.contentSearchServer.catchSearchOptions.includeIgnored).toBe(true);
    expect(service.contentSearchServer.catchSearchOptions.include).toEqual([
      'includeValue1',
      'includeValue2',
    ]);
    expect(service.contentSearchServer.catchSearchOptions.exclude).toEqual([
      'excludeValue',
      '**/node_modules',
      '**/bower_components',
    ]);
  });

  test('method:onSearchResult', () => {
    const service: any = searchService;

    const sendResult: ContentSearchResult = {
      fileUri: 'file://user.txt',
      line: 1,
      matchStart: 2,
      matchLength: 2,
      lineText: 'text',
    };

    const sendResults: SendClientResult[] = [
      {
        data: [],
        id: 2,
        searchState: SEARCH_STATE.doing,
      },
      {
        data: [sendResult],
        id: 2,
        searchState: SEARCH_STATE.doing,
      },
      {
        data: [],
        id: 2,
        searchState: SEARCH_STATE.done,
      },
    ];

    sendResults.forEach((data) => {
      service.onSearchResult(data);
    });

    expect(service.searchResults.size).toEqual(1);
    expect(service.searchResults.get(sendResult.fileUri)).toEqual([sendResult]);
  });

});
