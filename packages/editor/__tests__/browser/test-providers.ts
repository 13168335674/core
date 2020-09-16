import { IResourceProvider, IResource } from '@ali/ide-editor';
import { URI, Emitter } from '@ali/ide-core-common';
import { IEditorDocumentModelContentProvider, IEditorComponentResolver, IEditorComponent } from '@ali/ide-editor/lib/browser';

export const TestResourceProvider: IResourceProvider = {
  scheme: 'test',
  provideResource: (uri: URI) => {
    return {
      uri,
      name: uri.path.toString(),
      icon: 'iconTest ' + uri.toString(),
      supportsRevive: true,
    };
  },
};

const _onDidChangeTestContent = new Emitter<URI>();

export const TestEditorDocumentProvider: IEditorDocumentModelContentProvider = {
  handlesScheme: (scheme: string) => {
    return scheme === 'test';
  },
  isReadonly: (uri: URI) => false,
  provideEditorDocumentModelContent: (uri: URI, encoding) => {
    return uri.toString();
  },
  onDidChangeContent: _onDidChangeTestContent.event,

};

export const TestResourceResolver: IEditorComponentResolver = (resource: IResource, results ) => {
  results.push({
    type: 'code',
  });
};

export const TestResourceResolver2: IEditorComponentResolver = (resource: IResource, results ) => {
  if (resource.uri.authority === 'component') {
    results.push({
      componentId: 'test-v-component',
      type: 'component',
      weight: 100,
    });
    return;
  }
  if (resource.uri.authority === 'diff') {
    results.push({
      componentId: 'test-v-component',
      type: 'diff',
    });
    return;
  }
};

export const TestResourceComponent: IEditorComponent = {
  component: () => null as any,
  uid: 'test-v-component',
  scheme: 'test',
};
