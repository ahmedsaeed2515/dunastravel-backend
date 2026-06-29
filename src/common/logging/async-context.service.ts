import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

@Injectable()
export class AsyncContextService {
  private readonly asyncLocalStorage = new AsyncLocalStorage<
    Map<string, string>
  >();

  run(store: Map<string, string>, callback: () => void): void {
    this.asyncLocalStorage.run(store, callback);
  }

  get(key: string): string | undefined {
    const store = this.asyncLocalStorage.getStore();
    return store?.get(key);
  }

  set(key: string, value: string): void {
    const store = this.asyncLocalStorage.getStore();
    if (store) {
      store.set(key, value);
    }
  }
}
