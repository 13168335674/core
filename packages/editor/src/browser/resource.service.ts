import { ResourceService, IResource, IResourceProvider, ResourceNeedUpdateEvent, ResourceDidUpdateEvent, IResourceDecoration, ResourceDecorationChangeEvent } from '../common';
import { Injectable, Autowired } from '@ali/common-di';
import { URI, IDisposable, WithEventBus, OnEvent } from '@ali/ide-core-browser';
import { observable } from 'mobx';
import { Disposable, addElement, LRUMap, ILogger } from '@ali/ide-core-common';

@Injectable()
export class ResourceServiceImpl extends WithEventBus implements ResourceService {

  private providers: IResourceProvider[] = [];

  private resources: Map<string, {
    resource: IResource,
    provider: IResourceProvider,
  }> = new Map();

  private resourceDecoration: Map<string, IResourceDecoration> = new Map();

  private cachedProvider = new LRUMap<string, IResourceProvider | undefined>(500, 200);

  @Autowired(ILogger)
  logger: ILogger;

  constructor() {
    super();
  }

  @OnEvent(ResourceNeedUpdateEvent)
  onResourceNeedUpdateEvent(e: ResourceNeedUpdateEvent) {
    const uri = e.payload;
    if (this.resources.has(uri.toString())) {
      const resource = this.resources.get(uri.toString());
      this.doGetResource(uri).then((newResource) => {
        Object.assign(resource, newResource);
        this.eventBus.fire(new ResourceDidUpdateEvent(uri));
      });
    }
  }

  @OnEvent(ResourceDecorationChangeEvent)
  onResourceDecorationChangeEvent(e: ResourceDecorationChangeEvent) {
    this.getResourceDecoration(e.payload.uri); // ensure object
    Object.assign(this.resourceDecoration.get(e.payload.uri.toString()), e.payload.decoration);
  }

  async getResource(uri: URI): Promise<IResource<any> | null> {
    if (!this.resources.has(uri.toString())) {
      const r = await this.doGetResource(uri);
      if (!r) {
        return null;
      }
      const resource = observable(Object.assign({}, r));
      this.resources.set(uri.toString(), resource);
    }
    return this.resources.get(uri.toString())!.resource as IResource;
  }

  async doGetResource(uri: URI): Promise<{
    resource: IResource<any>,
    provider: IResourceProvider;
  } | null> {
    const provider = this.calculateProvider(uri);
    if (!provider) {
      this.logger.error('URI has no resource provider: ' + uri);
      return null;
    } else {
      const r = await provider.provideResource(uri);
      r.uri = uri;
      return {
        resource: r,
        provider,
      };
    }

  }

  registerResourceProvider(provider: IResourceProvider): IDisposable {
    const disposer = new Disposable();
    disposer.addDispose(addElement(this.providers, provider));
    disposer.addDispose({
      dispose: () => {
        for (const r of this.resources.values()) {
          if (r.provider === provider) {
            r.provider = GhostResourceProvider;
          }
        }
        this.cachedProvider.clear();
      },
    });
    this.cachedProvider.clear();
    return disposer;
  }

  async shouldCloseResource(resource: IResource, openedResources: IResource[][]): Promise<boolean> {
    const provider = this.getProvider(resource.uri);
    if (!provider || !provider.shouldCloseResource) {
      return true;
    } else {
      return await provider.shouldCloseResource(resource, openedResources);
    }
  }

  private calculateProvider(uri: URI): IResourceProvider | undefined {
    if (this.cachedProvider.has(uri.toString())) {
      return this.cachedProvider.get(uri.toString());
    }
    let currentProvider: IResourceProvider | undefined;
    let currentComparator: {
      weight: number
      index: number,
    } = {
      weight: -1,
      index: -1,
    };

    function acceptProvider(provider: IResourceProvider, weight: number, index: number) {
      currentComparator = {weight, index};
      currentProvider = provider;
    }

    this.providers.forEach((provider, index) => {
      let weight = -1;
      if (provider.handlesUri) {
        weight = provider.handlesUri(uri);
      } else if (provider.scheme) {
        weight = provider.scheme === uri.scheme ? 10 : -1;
      }

      if (weight >= 0) {
        if (weight > currentComparator.weight) {
          acceptProvider(provider, weight, index);
        } else if (weight === currentComparator.weight && index > currentComparator.index) {
          acceptProvider(provider, weight, index);
        }
      }
    });

    this.cachedProvider.set(uri.toString(), currentProvider);

    return currentProvider;
  }

  private getProvider(uri: URI): IResourceProvider | undefined {
    const r = this.resources.get(uri.toString());
    if (r) {
      return r.provider;
    } else {
      return undefined;
    }
  }

  public getResourceDecoration(uri: URI): IResourceDecoration {
    if (!this.resourceDecoration.has(uri.toString())) {
      this.resourceDecoration.set(uri.toString(), observable(DefaultResourceDecoration));
    }
    return this.resourceDecoration.get(uri.toString()) as IResourceDecoration;
  }

  getResourceSubname(resource: IResource<any>, groupResources: IResource<any>[]): string | null {
    const provider = this.getProvider(resource.uri);
    if (!provider) {
      this.logger.error('URI has no resource provider: ' + resource.uri);
      return null; // no provider
    } else if (!provider.provideResourceSubname) {
      return null;
    } else {
      return provider.provideResourceSubname(resource, groupResources);
    }
  }

  disposeResource(resource: IResource<any>) {
    const provider = this.getProvider(resource.uri);
    this.resources.delete(resource.uri.toString());
    if (!provider || !provider.onDisposeResource) {
      return;
    } else {
      return provider.onDisposeResource(resource);
    }
  }
}

const  DefaultResourceDecoration: IResourceDecoration = {
  dirty: false,
};

const GhostResourceProvider: IResourceProvider = {
  handlesUri: () => -1,
  provideResource: (uri: URI) => ({uri, name: '', icon: ''}) ,
};
